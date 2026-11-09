// Home (after login): reads back everything the journey stored, from RDS and the assets bucket.
const express = require('express');
const db = require('../db');
const { STEPS } = require('../journey');
const { requireStep } = require('../middleware');
const { maskMobile } = require('../validators');

const router = express.Router();

router.get('/home', requireStep(STEPS.DONE), async (req, res, next) => {
  try {
    const [clubs, artists] = await Promise.all([
      db.query(
        `SELECT c.id, c.code, c.name FROM user_favorites f JOIN clubs c ON c.id = f.item_id
          WHERE f.user_id = ? AND f.item_type = 'club' ORDER BY c.sort_order`,
        [req.user.id],
      ),
      db.query(
        `SELECT a.id, a.name, a.photo_key FROM user_favorites f JOIN artists a ON a.id = f.item_id
          WHERE f.user_id = ? AND f.item_type = 'artist' ORDER BY a.sort_order`,
        [req.user.id],
      ),
    ]);
    res.render('home', {
      title: 'Home · YallaIn',
      clubs,
      artists,
      maskedMobile: maskMobile(req.user.mobile),
      firstName: (req.user.full_name || '').split(/\s+/)[0] || 'fan',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
