-- TradeLite account foundation schema
-- Run this once against your XAMPP MySQL/MariaDB instance (e.g. via phpMyAdmin
-- "Import", or `mysql -u root tradelite < api/db/schema.sql`).
--
-- Design notes:
--   * email_normalized (lowercased/trimmed) carries the uniqueness constraint,
--     so "User@x.com" and "user@x.com" can't become two accounts.
--   * Verification and password-reset links only ever carry a random raw
--     token; we store its SHA-256 hash here, so a database leak alone can't
--     be replayed as a working link.
--   * Sessions are our own table (not PHP's file-based session store) so we
--     can show "active sessions", revoke one device, or revoke all of them
--     after a password reset - useful now and essential later once real
--     money is involved.
--   * auth_attempts is a simple, generic throttle log shared by login,
--     register and forgot-password so brute-forcing any of them gets rate
--     limited the same way.

CREATE TABLE IF NOT EXISTS users (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email              VARCHAR(255) NOT NULL,
  email_normalized   VARCHAR(255) NOT NULL,
  password_hash      VARCHAR(255) NOT NULL,
  display_name       VARCHAR(100) NOT NULL,
  email_verified_at  DATETIME NULL,
  status             ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_email_normalized (email_normalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_token_hash (token_hash),
  KEY idx_user (user_id),
  CONSTRAINT fk_evt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_token_hash (token_hash),
  KEY idx_user (user_id),
  CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  id            CHAR(64) NOT NULL PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  ip_address    VARCHAR(45) NULL,
  user_agent    VARCHAR(255) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME NOT NULL,
  KEY idx_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auth_attempts (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  identifier    VARCHAR(255) NOT NULL COMMENT 'usually the client IP; kept generic for future use',
  action        VARCHAR(30)  NOT NULL COMMENT 'login | register | forgot_password',
  success       TINYINT(1)   NOT NULL DEFAULT 0,
  attempted_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_identifier_action_time (identifier, action, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
