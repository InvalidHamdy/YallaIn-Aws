const db = require('./db');
const config = require('./config');
const { pathForStep, STEPS, TRACKER } = require('./journey');
const { icon } = require('./icons');

// Loads the logged-in user (if any) from RDS on every request.
async function loadUser(req, res, next) {
  res.locals.user = null;
  if (req.session.userId) {
    try {
      const user = await db.one(
        `SELECT id, mobile, email, full_name, national_id_last4, mobile_verified,
                verification_status, registration_step, verified_at, created_at
           FROM users WHERE id = ?`,
        [req.session.userId],
      );
      if (user) {
        req.user = user;
        res.locals.user = user;
      } else {
        delete req.session.userId;
      }
    } catch (err) {
      return next(err);
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

// Keeps the step tracker honest: a user can only open the page for the step they are on.
// `alsoAllow` lists later steps that may still open the page (e.g. editing favorites from Home).
function requireStep(step, alsoAllow = []) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    const current = req.user.registration_step;
    if (current === step || alsoAllow.includes(current)) return next();
    return res.redirect(pathForStep(current));
  };
}

function redirectIfLoggedIn(req, res, next) {
  if (req.user) return res.redirect(pathForStep(req.user.registration_step));
  next();
}

// CSRF defence for form posts: browsers always send Origin on cross-site POSTs,
// so reject any POST whose Origin is not this site. Cookies are also SameSite=Lax.
function sameOrigin(req, res, next) {
  if (req.method !== 'POST') return next();
  const origin = req.get('origin');
  if (!origin) return next();
  const host = req.get('x-forwarded-host') || req.get('host');
  try {
    if (new URL(origin).host === host) return next();
  } catch (_) { /* fall through */ }
  return res.status(403).send('Cross-site request blocked');
}

// View helpers available in every template.
function viewHelpers(req, res, next) {
  res.locals.asset = (key) => (config.aws.assetsBaseUrl ? `${config.aws.assetsBaseUrl}/${key}` : `/assets/${key}`);
  res.locals.path = req.path;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.STEPS = STEPS;
  res.locals.TRACKER = TRACKER;
  res.locals.icon = icon;
  res.locals.otpMode = config.otpMode;
  next();
}

module.exports = { loadUser, requireAuth, requireStep, redirectIfLoggedIn, sameOrigin, viewHelpers };
