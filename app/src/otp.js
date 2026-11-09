// WR3 one-time codes: 6 digits, stored hashed, 5-minute expiry, 3 attempts, 60 s resend cooldown.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');
const { sendSms } = require('./aws');

const CODE_TTL_SEC = 5 * 60;
const RESEND_COOLDOWN_SEC = 60;
const MAX_ATTEMPTS = 3;

async function issue(user) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const hash = await bcrypt.hash(code, 8);
  await db.query(
    `INSERT INTO otp_codes (user_id, code_hash, expires_at, attempts, sent_at)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), 0, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at),
                             attempts = 0, sent_at = VALUES(sent_at)`,
    [user.id, hash, CODE_TTL_SEC],
  );

  if (config.otpMode === 'sms') {
    await sendSms(user.mobile, `YallaIn code: ${code}. It expires in 5 minutes.`);
    console.log(JSON.stringify({ event: 'otp_sent', via: 'sns', userId: user.id }));
  } else {
    // Demo mode (SNS sandbox / Learner Lab): the code goes to the server log and is shown on the page.
    console.log(JSON.stringify({ event: 'otp_issued_demo', userId: user.id, code }));
  }
  return config.otpMode === 'sms' ? null : code;
}

async function state(userId) {
  return db.one(
    `SELECT attempts, expires_at < UTC_TIMESTAMP() AS expired,
            GREATEST(0, ? - TIMESTAMPDIFF(SECOND, sent_at, UTC_TIMESTAMP())) AS resend_in
       FROM otp_codes WHERE user_id = ?`,
    [RESEND_COOLDOWN_SEC, userId],
  );
}

// Returns { ok } or { ok:false, error, triesLeft }
async function check(userId, code) {
  const row = await db.one(
    'SELECT code_hash, attempts, expires_at < UTC_TIMESTAMP() AS expired FROM otp_codes WHERE user_id = ?',
    [userId],
  );
  if (!row) return { ok: false, error: 'No code was sent yet. Tap “Resend code”.', triesLeft: 0 };
  if (row.expired) return { ok: false, error: 'That code has expired. Request a new one.', triesLeft: 0 };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'Too many wrong tries. Request a new code.', triesLeft: 0 };

  const match = /^\d{6}$/.test(code) && (await bcrypt.compare(code, row.code_hash));
  if (match) {
    await db.query('DELETE FROM otp_codes WHERE user_id = ?', [userId]);
    return { ok: true };
  }
  await db.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE user_id = ?', [userId]);
  const triesLeft = MAX_ATTEMPTS - row.attempts - 1;
  return {
    ok: false,
    triesLeft,
    error: triesLeft > 0
      ? `That code is wrong — ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left`
      : 'That code is wrong. Request a new code.',
  };
}

module.exports = { issue, state, check, RESEND_COOLDOWN_SEC, MAX_ATTEMPTS };
