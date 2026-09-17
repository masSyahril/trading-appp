-- Unified fill/close audit log (Phase 1 of the post-price-authority roadmap,
-- see docs/SETUP_AUTH.md). Every server-decided fill or close - stock or
-- crypto, market/limit/stop/sl/tp/manual-close - writes one row here, in
-- addition to whatever it already writes to positions/trade_history/
-- crypto_positions. This is deliberately append-only and never read by any
-- trading logic; it exists purely for debugging, support ("why did my
-- position close?"), and as a foundation for future compliance/reporting
-- needs once real money is involved. Safe to truncate or archive at any
-- time without affecting the app.

CREATE TABLE IF NOT EXISTS fill_events (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  market      ENUM('stock','crypto') NOT NULL,
  symbol      VARCHAR(20) NOT NULL,
  side        ENUM('buy','sell') NOT NULL,
  reason      VARCHAR(30) NOT NULL, -- market_fill | limit_fill | stop_fill | sl_hit | tp_hit | manual_close | crypto_market_fill
  qty         DECIMAL(24,8) NOT NULL,
  price       DECIMAL(18,8) NOT NULL,
  pnl_delta   DECIMAL(18,2) NULL,
  client_id   VARCHAR(40) NULL,
  created_at  DATETIME NOT NULL,
  KEY idx_user_created (user_id, created_at),
  CONSTRAINT fk_fill_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
