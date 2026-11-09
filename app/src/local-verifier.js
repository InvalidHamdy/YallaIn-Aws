// LOCAL MODE ONLY (no S3_IDS_BUCKET set): stands in for S3 + the yallain-verify-id Lambda,
// so the whole journey can be tested on a laptop. In AWS, lambda/verify/index.mjs does this job.
const fs = require('fs');
const path = require('path');
const db = require('./db');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

function sidesOnDisk(userId) {
  const dir = path.join(UPLOAD_DIR, 'ids', String(userId));
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map((f) => f.split('.')[0]);
}

// Same rule as the Lambda: once both sides exist, mark the user verified after a short "registry" delay.
function onUpload(userId) {
  const sides = sidesOnDisk(userId);
  console.log(JSON.stringify({ event: 'local_verify_check', userId, sides }));
  if (!(sides.includes('front') && sides.includes('back'))) return;
  setTimeout(async () => {
    try {
      await db.query(
        `UPDATE users SET verification_status = 'verified', verified_at = UTC_TIMESTAMP()
          WHERE id = ? AND verification_status IN ('none','pending')`,
        [userId],
      );
      console.log(JSON.stringify({ event: 'local_verify_done', userId, status: 'verified' }));
    } catch (err) {
      console.error('local verifier failed', err);
    }
  }, 4000);
}

module.exports = { UPLOAD_DIR, onUpload };
