// Central config, read once from environment variables (.env locally, real values on EC2).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const env = (key, fallback) => {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
};

const config = {
  port: Number(env('PORT', 3000)),
  isProd: env('NODE_ENV', 'development') === 'production',

  db: {
    host: env('DB_HOST', '127.0.0.1'),
    port: Number(env('DB_PORT', 3306)),
    user: env('DB_USER', 'yallain'),
    password: env('DB_PASS', ''),
    database: env('DB_NAME', 'yallain'),
  },

  aws: {
    region: env('AWS_REGION', 'us-east-1'),
    // Private bucket for national ID photos. Empty = local mode (files saved to ./uploads, Lambda simulated).
    idsBucket: env('S3_IDS_BUCKET', ''),
    // Public base URL of the assets bucket, e.g. https://yallain-assets-team.s3.us-east-1.amazonaws.com
    // Empty = serve images from the repo's /assets folder.
    assetsBaseUrl: env('ASSETS_BASE_URL', '').replace(/\/$/, ''),
  },

  otpMode: env('OTP_MODE', 'demo'), // 'sms' (Amazon SNS) or 'demo' (code printed in logs + shown on the page)
  sessionSecret: env('SESSION_SECRET', 'dev-only-change-me'),
  idHashSecret: env('ID_HASH_SECRET', 'dev-only-change-me-too'),
  cookieSecure: env('COOKIE_SECURE', 'false') === 'true',
};

config.storageMode = config.aws.idsBucket ? 's3' : 'local';

if (config.isProd && config.sessionSecret.startsWith('dev-only')) {
  throw new Error('Set SESSION_SECRET in .env before running in production');
}

module.exports = config;
