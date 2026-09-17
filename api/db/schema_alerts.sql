-- Cross-device sync for stock-market/js/price-alerts.js. Unlike positions/
-- orders, an alert has no financial consequence - it's just a browser
-- notification trigger - so there is nothing to protect by moving the
-- TRIGGER LOGIC server-side (checkAlertTriggers() stays exactly as it is,
-- running client-side against the live chart feed). This table only makes
-- the alert LIST itself persist across devices/browsers/signed-in sessions,
-- the same "server wins on load, push on change" pattern as watchlist_items.

CREATE TABLE IF NOT EXISTS price_alerts (
  user_id     BIGINT UNSIGNED NOT NULL,
  alert_id    VARCHAR(40) NOT NULL, -- price-alerts.js's own `alert_<ts>_<rand>` id
  symbol      VARCHAR(20) NOT NULL,
  price       DECIMAL(18,6) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, alert_id),
  KEY idx_user_symbol (user_id, symbol),
  CONSTRAINT fk_price_alerts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
