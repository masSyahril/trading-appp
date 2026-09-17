-- Server-authoritative crypto position book (extends the "server-side price
-- authority" model from schema_portfolio.sql to crypto-trading/). See the
-- "Crypto price authority" section of docs/SETUP_AUTH.md.
--
-- Crypto trading today only has market buy/sell (no limit/stop orders, no
-- SL/TP, no leverage - see crypto-trading/crypto-app.prod.js) and a NETTING
-- position model: one row per (user, symbol) with a running average entry
-- price and realized P&L, not a list of discrete trades like stocks'
-- `positions` table. crypto_positions mirrors that model exactly rather
-- than forcing crypto into the stock schema - the fill math in
-- api/lib/crypto.php is a straight port of crypto-app.prod.js's own
-- updatePosition().
--
-- crypto_positions/crypto_orders are also intentionally NOT tied into
-- portfolio_accounts.balance - crypto trading has never drawn from or
-- affected the shared cash balance client-side either. Unifying crypto and
-- stock buying power into one balance is a deliberate fast-follow, not done
-- here (see docs/SETUP_AUTH.md).

CREATE TABLE IF NOT EXISTS crypto_positions (
  user_id       BIGINT UNSIGNED NOT NULL,
  symbol        VARCHAR(20) NOT NULL,
  qty           DECIMAL(24,8) NOT NULL DEFAULT 0,
  avg_price     DECIMAL(18,8) NOT NULL DEFAULT 0,
  realized_pnl  DECIMAL(18,2) NOT NULL DEFAULT 0,
  updated_at    DATETIME NOT NULL,
  PRIMARY KEY (user_id, symbol),
  CONSTRAINT fk_crypto_positions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per fill, doubling as both the idempotency record (PK on
-- user_id+client_id, same pattern as `positions`/`working_orders`) and the
-- "recent orders" history crypto-app.prod.js already renders locally.
CREATE TABLE IF NOT EXISTS crypto_orders (
  user_id     BIGINT UNSIGNED NOT NULL,
  client_id   VARCHAR(40) NOT NULL,
  symbol      VARCHAR(20) NOT NULL,
  side        ENUM('buy','sell') NOT NULL,
  qty         DECIMAL(24,8) NOT NULL,
  price       DECIMAL(18,8) NOT NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (user_id, client_id),
  CONSTRAINT fk_crypto_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS crypto_watchlist_items (
  user_id      BIGINT UNSIGNED NOT NULL,
  symbol       VARCHAR(20) NOT NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, symbol),
  CONSTRAINT fk_crypto_watchlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Separate one-time-seed guard (mirrors the role portfolio_accounts' mere
-- existence plays for stocks' api/state/seed.php) - crypto has no "account
-- row" of its own to check, and a brand-new account legitimately having
-- zero crypto positions must not be confused with "never seeded".
CREATE TABLE IF NOT EXISTS crypto_seed_marker (
  user_id     BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  seeded_at   DATETIME NOT NULL,
  CONSTRAINT fk_crypto_seed_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
