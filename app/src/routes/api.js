// JSON endpoints used by WR6 (uploads) and WR7 (status polling).
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db');
const config = require('../config');
const { STEPS } = require('../journey');
const { requireStep, requireAuth } = require('../middleware');
const { presignIdUpload, MAX_ID_PHOTO_BYTES, ALLOWED_TYPES } = require('../aws');
const localVerifier = require('../local-verifier');

const router = express.Router();
const SIDES = new Set(['front', 'back']);

function readUploadRequest(req, res) {
  const side = String(req.body.side || '');
  const contentType = String(req.body.contentType || '');
  if (!SIDES.has(side)) { res.status(400).json({ error: 'side must be front or back' }); return null; }
  if (!ALLOWED_TYPES[contentType]) { res.status(400).json({ error: 'Only JPG or PNG images are accepted.' }); return null; }
  return { side, contentType };
}

// Step 1 of an upload: ask the server for permission to upload one side.
// In AWS mode this returns an S3 pre-signed POST (the file goes browser → S3 directly).
router.post('/upload-url', requireStep(STEPS.ID_PHOTO), async (req, res, next) => {
  try {
    const r = readUploadRequest(req, res);
    if (!r) return;
    if (config.storageMode === 's3') {
      const { url, fields, key } = await presignIdUpload(req.user.id, r.side, r.contentType);
      return res.json({ mode: 's3', url, fields, key, maxBytes: MAX_ID_PHOTO_BYTES });
    }
    const key = `ids/${req.user.id}/${r.side}.${ALLOWED_TYPES[r.contentType]}`;
    return res.json({ mode: 'local', url: `/api/local-upload/${r.side}`, fields: { 'Content-Type': r.contentType }, key, maxBytes: MAX_ID_PHOTO_BYTES });
  } catch (err) {
    next(err);
  }
});

// Step 2 (after the browser's upload succeeded): record the object in RDS and mark the user pending.
router.post('/upload-complete', requireStep(STEPS.ID_PHOTO), async (req, res, next) => {
  try {
    const side = String(req.body.side || '');
    const key = String(req.body.key || '');
    const expected = new RegExp(`^ids/${req.user.id}/${side}\\.(jpg|png)$`);
    if (!SIDES.has(side) || !expected.test(key)) return res.status(400).json({ error: 'Invalid upload' });
    await db.query(
      `INSERT INTO id_documents (user_id, side, s3_key) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE s3_key = VALUES(s3_key), uploaded_at = CURRENT_TIMESTAMP`,
      [req.user.id, side, key],
    );
    // Only move none → pending; never overwrite a 'verified' the Lambda may already have written.
    await db.query("UPDATE users SET verification_status = 'pending' WHERE id = ? AND verification_status = 'none'", [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// LOCAL MODE ONLY: stands in for the S3 bucket.
if (config.storageMode === 'local') {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(localVerifier.UPLOAD_DIR, 'ids', String(req.user.id));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = ALLOWED_TYPES[file.mimetype];
      const dir = path.join(localVerifier.UPLOAD_DIR, 'ids', String(req.user.id));
      for (const f of fs.readdirSync(dir)) if (f.startsWith(`${req.params.side}.`)) fs.unlinkSync(path.join(dir, f));
      cb(null, `${req.params.side}.${ext}`);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: MAX_ID_PHOTO_BYTES, files: 1 },
    fileFilter: (req, file, cb) => cb(null, Boolean(ALLOWED_TYPES[file.mimetype])),
  });
  router.post('/local-upload/:side', requireStep(STEPS.ID_PHOTO), (req, res, next) => {
    if (!SIDES.has(req.params.side)) return res.status(400).end();
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 10 MB.' : err.message });
      if (!req.file) return res.status(400).json({ error: 'Only JPG or PNG images are accepted.' });
      localVerifier.onUpload(req.user.id);
      res.status(204).end();
    });
  });
}

// WR7 polls this until the Lambda (or the local verifier) has written the result to RDS.
router.get('/verification-status', requireAuth, (req, res) => {
  res.json({ status: req.user.verification_status, verifiedAt: req.user.verified_at });
});

module.exports = router;
