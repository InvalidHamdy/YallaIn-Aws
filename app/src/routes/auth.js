// WR1 Welcome, WR2 Create account, WR3 Verify mobile, Login, Logout.
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const otp = require('../otp');
const config = require('../config');
const { STEPS, pathForStep } = require('../journey');
const { normalizeMobile, maskMobile, passwordOk } = require('../validators');
const { redirectIfLoggedIn, requireStep } = require('../middleware');

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

// Regenerating the session id on login prevents session fixation.
function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((e) => (e ? reject(e) : resolve()));
    });
  });
}

// ---------- WR1 Welcome ----------
router.get('/', (req, res) => {
  if (req.user) return res.redirect(pathForStep(req.user.registration_step));
  res.render('welcome', { title: 'YallaIn — Your way into every match' });
});

// ---------- WR2 Create account ----------
router.get('/signup', redirectIfLoggedIn, (req, res) => {
  res.render('signup', { title: 'Create account · YallaIn', step: 1, values: {}, errors: {} });
});

router.post('/signup', authLimiter, redirectIfLoggedIn, async (req, res, next) => {
  const { mobile, password, terms } = req.body;
  const values = { mobile };
  const errors = {};
  const e164 = normalizeMobile(mobile);
  if (!e164) errors.mobile = 'Enter a valid Egyptian mobile number (10 digits after +20).';
  if (!passwordOk(password)) errors.password = 'Use at least 8 characters, including a number.';
  if (!terms) errors.terms = 'Please accept the terms to continue.';
  if (Object.keys(errors).length) {
    return res.status(422).render('signup', { title: 'Create account · YallaIn', step: 1, values, errors });
  }

  try {
    const hash = await bcrypt.hash(password, 11);
    let result;
    try {
      result = await db.query(
        `INSERT INTO users (mobile, password_hash, terms_accepted_at, registration_step)
         VALUES (?, ?, UTC_TIMESTAMP(), ?)`,
        [e164, hash, STEPS.VERIFY],
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        errors.mobile = 'This number already has an account.';
        errors.mobileLogin = true;
        return res.status(409).render('signup', { title: 'Create account · YallaIn', step: 1, values, errors });
      }
      throw err;
    }
    const user = { id: result.insertId, mobile: e164 };
    const demoCode = await otp.issue(user);
    await startSession(req, user.id);
    req.session.demoCode = demoCode;
    req.session.save(() => res.redirect('/verify'));
  } catch (err) {
    next(err);
  }
});

// ---------- WR3 Verify mobile ----------
async function renderVerify(req, res, { error = null, status = 200 } = {}) {
  const state = await otp.state(req.user.id);
  res.status(status).render('verify', {
    title: 'Verify mobile · YallaIn',
    step: 2,
    masked: maskMobile(req.user.mobile),
    resendIn: state ? Number(state.resend_in) : 0,
    error,
    demoCode: config.otpMode === 'demo' ? req.session.demoCode : null,
  });
}

router.get('/verify', requireStep(STEPS.VERIFY), async (req, res, next) => {
  try { await renderVerify(req, res); } catch (err) { next(err); }
});

router.post('/verify', authLimiter, requireStep(STEPS.VERIFY), async (req, res, next) => {
  try {
    const code = String(req.body.code || '').replace(/\D/g, '');
    const result = await otp.check(req.user.id, code);
    if (!result.ok) return renderVerify(req, res, { error: result.error, status: 422 });
    await db.query('UPDATE users SET mobile_verified = TRUE, registration_step = ? WHERE id = ?', [STEPS.EMAIL, req.user.id]);
    delete req.session.demoCode;
    res.redirect('/email');
  } catch (err) {
    next(err);
  }
});

router.post('/verify/resend', authLimiter, requireStep(STEPS.VERIFY), async (req, res, next) => {
  try {
    const state = await otp.state(req.user.id);
    if (state && Number(state.resend_in) > 0) {
      return renderVerify(req, res, { error: `Please wait ${state.resend_in}s before asking for a new code.`, status: 429 });
    }
    req.session.demoCode = await otp.issue(req.user);
    req.session.flash = { type: 'ok', text: 'A new code is on its way.' };
    req.session.save(() => res.redirect('/verify'));
  } catch (err) {
    next(err);
  }
});

// "Change number": the account is not usable yet, so delete it and start over.
router.post('/verify/change-number', requireStep(STEPS.VERIFY), async (req, res, next) => {
  try {
    await db.query('DELETE FROM users WHERE id = ? AND mobile_verified = FALSE', [req.user.id]);
    req.session.destroy(() => res.redirect('/signup'));
  } catch (err) {
    next(err);
  }
});

// ---------- Login / Logout ----------
router.get('/login', redirectIfLoggedIn, (req, res) => {
  res.render('login', { title: 'Log in · YallaIn', values: {}, error: null });
});

router.post('/login', authLimiter, redirectIfLoggedIn, async (req, res, next) => {
  try {
    const e164 = normalizeMobile(req.body.mobile);
    const user = e164 ? await db.one('SELECT id, password_hash, registration_step FROM users WHERE mobile = ?', [e164]) : null;
    // Same message whether the number or the password is wrong, so the form can't be used to find accounts.
    const ok = user && (await bcrypt.compare(String(req.body.password || ''), user.password_hash));
    if (!ok) {
      return res.status(401).render('login', {
        title: 'Log in · YallaIn', values: { mobile: req.body.mobile }, error: 'Wrong mobile number or password.',
      });
    }
    await startSession(req, user.id);
    res.redirect(pathForStep(user.registration_step));
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('yallain.sid');
    res.redirect('/');
  });
});

module.exports = router;
