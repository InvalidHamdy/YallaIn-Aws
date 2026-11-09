// Server-side validation. The UI validates too, but the server is the source of truth.
const crypto = require('crypto');
const config = require('./config');

// Egyptian mobile: 10 digits after +20, starting 10 / 11 / 12 / 15.
function normalizeMobile(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (digits.startsWith('20') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^1[0125]\d{8}$/.test(digits)) return null;
  return `+20${digits}`;
}

function maskMobile(e164) {
  const d = e164.replace('+20', '');
  return `+20 ${d.slice(0, 2)} •••• ${d.slice(-4)}`;
}

function passwordChecks(pw) {
  const s = String(pw || '');
  return {
    length: s.length >= 8,
    number: /\d/.test(s),
    symbol: /[^A-Za-z0-9]/.test(s),
  };
}

function passwordOk(pw) {
  const c = passwordChecks(pw);
  return c.length && c.number && String(pw).length <= 72; // bcrypt only reads 72 bytes
}

function emailOk(email) {
  return /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '')) && String(email).length <= 120;
}

// Egyptian national ID: 14 digits = C YYMMDD GG SSSS K
//   C = century (2 → 1900s, 3 → 2000s), YYMMDD = birth date, GG = governorate code.
const GOVERNORATES = new Set([
  '01', '02', '03', '04', '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '31', '32', '33', '34', '35', '88',
]);

function parseNationalId(input) {
  const id = String(input || '').replace(/\D/g, '');
  if (id.length !== 14) return { ok: false, error: 'National ID must be exactly 14 digits.' };
  const century = { 2: 1900, 3: 2000 }[id[0]];
  if (!century) return { ok: false, error: 'The first digit should be 2 or 3.' };
  const year = century + Number(id.slice(1, 3));
  const month = Number(id.slice(3, 5));
  const day = Number(id.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 1, day));
  const validDate = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!validDate || date > new Date()) return { ok: false, error: 'The birth date inside this ID is not valid.' };
  const age = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 16) return { ok: false, error: 'You must be 16 or older to register.' };
  if (age > 110) return { ok: false, error: 'The birth date inside this ID is not valid.' };
  if (!GOVERNORATES.has(id.slice(7, 9))) return { ok: false, error: 'The governorate code in this ID is not valid.' };
  return { ok: true, id };
}

// Keyed hash: lets the database enforce "one account per ID" without storing the ID itself.
function hashNationalId(id) {
  return crypto.createHmac('sha256', config.idHashSecret).update(id).digest('hex');
}

function nameOk(name) {
  const s = String(name || '').trim();
  return s.length >= 5 && s.length <= 120 && s.split(/\s+/).length >= 2;
}

module.exports = {
  normalizeMobile, maskMobile, passwordChecks, passwordOk, emailOk,
  parseNationalId, hashNationalId, nameOk,
};
