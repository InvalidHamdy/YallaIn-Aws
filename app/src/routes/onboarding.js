// WR4 Add email, WR5 National ID, WR6 ID photo, WR7 ID status, WR8 Favorites.
const express = require('express');
const db = require('../db');
const config = require('../config');
const { STEPS } = require('../journey');
const { emailOk, parseNationalId, hashNationalId, nameOk } = require('../validators');
const { requireStep } = require('../middleware');

const router = express.Router();
const advance = (userId, step) => db.query('UPDATE users SET registration_step = ? WHERE id = ?', [step, userId]);

// ---------- WR4 Add email (optional) ----------
router.get('/email', requireStep(STEPS.EMAIL), (req, res) => {
  res.render('email', { title: 'Add email · YallaIn', step: 3, values: {}, error: null });
});

router.post('/email', requireStep(STEPS.EMAIL), async (req, res, next) => {
  try {
    if (req.body.skip) {
      await advance(req.user.id, STEPS.NATIONAL_ID);
      return res.redirect('/national-id');
    }
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!emailOk(email)) {
      return res.status(422).render('email', {
        title: 'Add email · YallaIn', step: 3, values: { email }, error: 'Enter a valid email address.',
      });
    }
    await db.query('UPDATE users SET email = ?, registration_step = ? WHERE id = ?', [email, STEPS.NATIONAL_ID, req.user.id]);
    res.redirect('/national-id');
  } catch (err) {
    next(err);
  }
});

// ---------- WR5 National ID ----------
router.get('/national-id', requireStep(STEPS.NATIONAL_ID), (req, res) => {
  res.render('national-id', { title: 'National ID · YallaIn', step: 4, values: {}, errors: {} });
});

router.post('/national-id', requireStep(STEPS.NATIONAL_ID), async (req, res, next) => {
  const values = { nationalId: req.body.nationalId, fullName: req.body.fullName };
  const errors = {};
  const parsed = parseNationalId(req.body.nationalId);
  if (!parsed.ok) errors.nationalId = parsed.error;
  if (!nameOk(req.body.fullName)) errors.fullName = 'Enter your full name exactly as written on your ID.';
  const render = (status) => res.status(status).render('national-id', { title: 'National ID · YallaIn', step: 4, values, errors });
  if (Object.keys(errors).length) return render(422);

  try {
    await db.query(
      `UPDATE users SET national_id_hash = ?, national_id_last4 = ?, full_name = ?, registration_step = ?
        WHERE id = ?`,
      [hashNationalId(parsed.id), parsed.id.slice(-4), String(req.body.fullName).trim(), STEPS.ID_PHOTO, req.user.id],
    );
    res.redirect('/id-photo');
  } catch (err) {
    // The UNIQUE index on national_id_hash is what enforces "one ticket per verified ID".
    if (err.code === 'ER_DUP_ENTRY') {
      errors.nationalId = 'This national ID is already linked to another YallaIn account.';
      return render(409);
    }
    next(err);
  }
});

// ---------- WR6 ID photo ----------
router.get('/id-photo', requireStep(STEPS.ID_PHOTO), async (req, res, next) => {
  try {
    const docs = await db.query('SELECT side FROM id_documents WHERE user_id = ?', [req.user.id]);
    res.render('id-photo', {
      title: 'ID photos · YallaIn',
      step: 5,
      uploaded: { front: docs.some((d) => d.side === 'front'), back: docs.some((d) => d.side === 'back') },
      storageMode: config.storageMode,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/id-photo', requireStep(STEPS.ID_PHOTO), async (req, res, next) => {
  try {
    const docs = await db.query('SELECT side FROM id_documents WHERE user_id = ?', [req.user.id]);
    if (docs.length < 2) {
      return res.status(422).render('id-photo', {
        title: 'ID photos · YallaIn', step: 5,
        uploaded: { front: docs.some((d) => d.side === 'front'), back: docs.some((d) => d.side === 'back') },
        storageMode: config.storageMode,
        error: 'Upload both the front and the back of your ID.',
      });
    }
    await advance(req.user.id, STEPS.ID_STATUS);
    res.redirect('/id-status');
  } catch (err) {
    next(err);
  }
});

// ---------- WR7 ID verified / pending ----------
router.get('/id-status', requireStep(STEPS.ID_STATUS, [STEPS.FAVORITES, STEPS.DONE]), async (req, res, next) => {
  try {
    const submitted = await db.one('SELECT MAX(uploaded_at) AS at FROM id_documents WHERE user_id = ?', [req.user.id]);
    res.render('id-status', { title: 'ID verification · YallaIn', step: 6, submittedAt: submitted && submitted.at });
  } catch (err) {
    next(err);
  }
});

router.post('/id-status', requireStep(STEPS.ID_STATUS), async (req, res, next) => {
  try {
    await advance(req.user.id, STEPS.FAVORITES);
    res.redirect('/favorites');
  } catch (err) {
    next(err);
  }
});

// ---------- WR8 Pick favorites (also reachable from Home to edit) ----------
async function loadCatalog(userId, q) {
  const like = `%${String(q || '').trim()}%`;
  const [clubs, artists, favs] = await Promise.all([
    db.query('SELECT id, code, name FROM clubs WHERE name LIKE ? OR code LIKE ? ORDER BY sort_order', [like, like]),
    db.query('SELECT id, name, photo_key FROM artists WHERE name LIKE ? ORDER BY sort_order', [like]),
    db.query('SELECT item_type, item_id FROM user_favorites WHERE user_id = ?', [userId]),
  ]);
  const picked = new Set(favs.map((f) => `${f.item_type}:${f.item_id}`));
  return { clubs, artists, picked };
}

router.get('/favorites', requireStep(STEPS.FAVORITES, [STEPS.DONE]), async (req, res, next) => {
  try {
    const catalog = await loadCatalog(req.user.id, '');
    res.render('favorites', {
      title: 'Pick favorites · YallaIn', step: 6, q: '', ...catalog,
      editing: req.user.registration_step === STEPS.DONE,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/favorites', requireStep(STEPS.FAVORITES, [STEPS.DONE]), async (req, res, next) => {
  const toList = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(Number).filter(Number.isInteger).slice(0, 30);
  const clubs = req.body.skip ? [] : toList(req.body.clubs);
  const artists = req.body.skip ? [] : toList(req.body.artists);
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    if (!req.body.skip) {
      await conn.execute('DELETE FROM user_favorites WHERE user_id = ?', [req.user.id]);
      const rows = [...clubs.map((id) => ['club', id]), ...artists.map((id) => ['artist', id])];
      for (const [type, id] of rows) {
        // Only ids that exist in the catalog are saved.
        await conn.execute(
          `INSERT IGNORE INTO user_favorites (user_id, item_type, item_id)
           SELECT ?, ?, id FROM ${type === 'club' ? 'clubs' : 'artists'} WHERE id = ?`,
          [req.user.id, type, id],
        );
      }
    }
    await conn.execute('UPDATE users SET registration_step = ? WHERE id = ?', [STEPS.DONE, req.user.id]);
    await conn.commit();
    req.session.flash = { type: 'ok', text: req.body.skip ? 'You can pick favorites any time.' : 'Favorites saved.' };
    res.redirect('/home');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// Search box on WR8: a LIKE query on RDS; the page hides the items that don't match
// (they stay in the form, so ticked favorites are never lost by searching).
router.get('/api/catalog/search', requireStep(STEPS.FAVORITES, [STEPS.DONE]), async (req, res, next) => {
  try {
    const q = String(req.query.q || '').slice(0, 40);
    const { clubs, artists } = await loadCatalog(req.user.id, q);
    res.json({ clubs: clubs.map((c) => c.id), artists: artists.map((a) => a.id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
