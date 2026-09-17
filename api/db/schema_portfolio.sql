-- Portfolio + watchlist schema (run after schema.sql).
--
-- Positions, working orders and trade history are now a
-- SERVER-AUTHORITATIVE ledger, not a mirror of localStorage: every fill,
-- close, limit/stop trigger and stop-loss/take-profit hit is decided by
-- api/orders/*.php using a live price this server fetches itself
-- (api/lib/quotes.php), and rows are written one at a time as those events
-- happen - never wholesale-replaced from a client snapshot. See
-- docs/SETUP_AUTH.md for the "server-side price authority" section.
--
-- The one exception is api/state/seed.php, a one-time-only import of a
-- brand-new account's pre-existing local paper-trading history (nothing
-- authoritative exists yet to protect at that point) - guarded so it can
-- never run a second time for the same account. api/state/save.php now
-- only ever touches watchlist_items; it explicitly rejects a request that
-- still tries to send positions/orders/history/balance.
--
-- client_id is the id portfolio.js/order-panel.js already generate
-- (e.g. "ord_1699999999999_123"); primary-keying on (user_id, client_id)
-- rather than client_id alone means two different users' ids can never
-- collide, and also makes api/orders/place.php's fill idempotent - a
-- retried request with the same client_id just reads back the row that
-- already exists instead of creating a second fill.

CREATE TABLE IF NOT EXISTS portfolio_accounts (
  user_id     BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  balance     DECIMAL(18,2) NOT NULL DEFAULT 100000.00,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_portfolio_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS positions (
  user_id      BIGINT UNSIGNED NOT NULL,
  client_id    VARCHAR(40) NOT NULL,
  symbol       VARCHAR(20) NOT NULL,
  side         ENUM('buy','sell') NOT NULL,
  size         DECIMAL(18,6) NOT NULL,
  leverage     DECIMAL(8,2) NOT NULL DEFAULT 1,
  entry_price  DECIMAL(18,6) NOT NULL,
  sl           DECIMAL(18,6) NULL,
  tp           DECIMAL(18,6) NULL,
  opened_at    DATETIME NOT NULL,
  PRIMARY KEY (user_id, client_id),
  CONSTRAINT fk_positions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS working_orders (
  user_id      BIGINT UNSIGNED NOT NULL,
  client_id    VARCHAR(40) NOT NULL,
  symbol       VARCHAR(20) NOT NULL,
  side         ENUM('buy','sell') NOT NULL,
  type         ENUM('limit','stop') NOT NULL,
  size         DECIMAL(18,6) NOT NULL,
  price        DECIMAL(18,6) NOT NULL,
  leverage     DECIMAL(8,2) NOT NULL DEFAULT 1,
  sl           DECIMAL(18,6) NULL,
  tp           DECIMAL(18,6) NULL,
  created_at   DATETIME NOT NULL,
  PRIMARY KEY (user_id, client_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS trade_history (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,
  client_id    VARCHAR(40) NULL,
  symbol       VARCHAR(20) NOT NULL,
  side         ENUM('buy','sell') NOT NULL,
  size         DECIMAL(18,6) NOT NULL,
  leverage     DECIMAL(8,2) NOT NULL DEFAULT 1,
  entry_price  DECIMAL(18,6) NOT NULL,
  exit_price   DECIMAL(18,6) NOT NULL,
  sl           DECIMAL(18,6) NULL,
  tp           DECIMAL(18,6) NULL,
  pnl          DECIMAL(18,2) NOT NULL,
  opened_at    DATETIME NULL,
  closed_at    DATETIME NOT NULL,
  KEY idx_user_closed (user_id, closed_at),
  CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS watchlist_items (
  user_id      BIGINT UNSIGNED NOT NULL,
  symbol       VARCHAR(20) NOT NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, symbol),
  CONSTRAINT fk_watchlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
