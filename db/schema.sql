-- YallaIn registration journey — RDS MySQL 8 schema
-- Run with:  npm run db:init   (from app/, uses the DB_* values in .env)

CREATE TABLE IF NOT EXISTS users (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  mobile              VARCHAR(16)  NOT NULL UNIQUE,          -- E.164, e.g. +201012344417
  password_hash       VARCHAR(100) NOT NULL,                 -- bcrypt
  email               VARCHAR(120) NULL,
  full_name           VARCHAR(120) NULL,
  national_id_hash    CHAR(64)     NULL UNIQUE,              -- HMAC-SHA256: enforces one account per ID
  national_id_last4   CHAR(4)      NULL,                     -- only the last 4 digits are kept in clear
  mobile_verified     BOOLEAN      NOT NULL DEFAULT FALSE,
  verification_status ENUM('none','pending','verified','rejected') NOT NULL DEFAULT 'none',
  registration_step   TINYINT      NOT NULL DEFAULT 2,        -- next page in the journey (see app/src/journey.js)
  terms_accepted_at   DATETIME     NOT NULL,
  verified_at         DATETIME     NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otp_codes (
  user_id     INT PRIMARY KEY,
  code_hash   VARCHAR(100) NOT NULL,
  expires_at  DATETIME     NOT NULL,
  attempts    TINYINT      NOT NULL DEFAULT 0,
  sent_at     DATETIME     NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS id_documents (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  side         ENUM('front','back') NOT NULL,
  s3_key       VARCHAR(255) NOT NULL,
  uploaded_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_side (user_id, side),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clubs (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  code      CHAR(4)      NOT NULL,
  name      VARCHAR(60)  NOT NULL,
  sort_order INT         NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS artists (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(60)  NOT NULL,
  photo_key  VARCHAR(255) NULL,          -- object key in the public assets bucket
  sort_order INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id    INT NOT NULL,
  item_type  ENUM('club','artist') NOT NULL,
  item_id    INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, item_type, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- The sessions table is created automatically by express-mysql-session.
