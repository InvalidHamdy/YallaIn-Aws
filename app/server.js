// YallaIn web app — runs on EC2 behind Nginx, talks to RDS (MySQL), S3, SNS.
const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const config = require('./src/config');
const db = require('./src/db');
const { loadUser, sameOrigin, viewHelpers } = require('./src/middleware');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // Nginx sits in front of the app
app.disable('x-powered-by');

// Security headers. The CSP allows Google Fonts, images from the S3 assets bucket,
// and browser → S3 uploads (connect-src) for WR6.
const awsHosts = ['https://*.amazonaws.com'];
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      styleSrcAttr: ["'unsafe-inline'"], // small style="" attributes in templates (e.g. per-page panel photo)
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', ...awsHosts],
      connectSrc: ["'self'", ...awsHosts],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: config.cookieSecure ? [] : null,
    },
  },
  // 'same-origin' keeps the Origin header on our own form posts (the CSRF check in middleware.js relies on it).
  referrerPolicy: { policy: 'same-origin' },
  strictTransportSecurity: config.cookieSecure,
  crossOriginEmbedderPolicy: false,
}));

app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.json({ limit: '20kb' }));
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: config.isProd ? '7d' : 0 }));
if (!config.aws.assetsBaseUrl) {
  // Local fallback for images that live in the S3 assets bucket in production.
  app.use('/assets', express.static(path.join(__dirname, '..', 'assets'), { maxAge: '1d' }));
}

// Sessions are stored in RDS, so restarting or replacing the EC2 instance doesn't log anyone out.
app.use(session({
  name: 'yallain.sid',
  secret: config.sessionSecret,
  store: new MySQLStore({ clearExpired: true, checkExpirationInterval: 15 * 60 * 1000 }, db.pool),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: 7 * 24 * 3600 * 1000 },
}));

app.use(sameOrigin);
app.use(loadUser);
app.use(viewHelpers);

// Health check: proves EC2 → RDS connectivity (useful during the demo).
app.get('/healthz', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: 'up', storage: config.storageMode, otp: config.otpMode });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'down' });
  }
});

app.use(require('./src/routes/auth'));
app.use(require('./src/routes/onboarding'));
app.use(require('./src/routes/home'));
app.use('/api', require('./src/routes/api'));

app.use((req, res) => res.status(404).render('error', { title: 'Not found · YallaIn', code: 404, message: 'This page doesn’t exist.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(JSON.stringify({ event: 'error', path: req.path, message: err.message, code: err.code }));
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  res.status(500).render('error', { title: 'Error · YallaIn', code: 500, message: 'Something went wrong on our side. Please try again.' });
});

app.listen(config.port, () => {
  console.log(JSON.stringify({
    event: 'started', port: config.port, storage: config.storageMode, otp: config.otpMode, db: config.db.host,
  }));
});
