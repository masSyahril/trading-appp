<?php
declare(strict_types=1);

/**
 * Validation + row<->client shape conversion for the portfolio/watchlist
 * mirror (see api/db/schema_portfolio.sql for why this is a mirror, not an
 * independently-validated ledger).
 *
 * Every tl_validate_* function throws InvalidArgumentException with a
 * human-readable message on bad input; api/state/save.php catches that once
 * and turns it into a 400. This is deliberately strict (reject the whole
 * save rather than silently drop a bad row) because silently losing a
 * trade from someone's history would be a much worse surprise than an
 * error message.
 */

const TL_MAX_POSITIONS = 500;
const TL_MAX_ORDERS = 500;
const TL_MAX_HISTORY = 5000;
const TL_MAX_WATCHLIST = 200;
const TL_MAX_ALERTS = 1000;

function tl_expect(bool $cond, string $message): void {
    if (!$cond) {
        throw new InvalidArgumentException($message);
    }
}

function tl_expect_string($val, string $field, int $maxLen): string {
    tl_expect(is_string($val) && $val !== '' && strlen($val) <= $maxLen, "Invalid {$field}");
    return $val;
}

function tl_expect_symbol($val, string $field): string {
    tl_expect(is_string($val) && preg_match('/^[A-Z0-9.\-]{1,20}$/', $val) === 1, "Invalid {$field}: expected a ticker symbol");
    return $val;
}

function tl_expect_side($val, string $field): string {
    tl_expect($val === 'buy' || $val === 'sell', "Invalid {$field}: expected 'buy' or 'sell'");
    return $val;
}

function tl_expect_number($val, string $field, float $min, float $max): float {
    tl_expect(is_int($val) || is_float($val), "Invalid {$field}: expected a number");
    $f = (float) $val;
    tl_expect(is_finite($f) && $f >= $min && $f <= $max, "Invalid {$field}: out of range");
    return $f;
}

function tl_expect_nullable_number($val, string $field, float $min, float $max): ?float {
    if ($val === null) {
        return null;
    }
    return tl_expect_number($val, $field, $min, $max);
}

// Client timestamps are JS Date.now() milliseconds; stored as DATETIME
// (second precision - plenty for paper-trading records) and converted back
// to milliseconds on read.
function tl_expect_timestamp_ms($val, string $field): string {
    tl_expect(is_int($val) || is_float($val), "Invalid {$field}: expected a millisecond timestamp");
    $seconds = ((float) $val) / 1000;
    tl_expect($seconds > 0 && $seconds < 4102444800, "Invalid {$field}: timestamp out of range"); // < year 2100
    return gmdate('Y-m-d H:i:s', (int) $seconds);
}

function tl_datetime_to_ms(?string $dt): ?int {
    if ($dt === null) {
        return null;
    }
    return strtotime($dt . ' UTC') * 1000;
}

/** @return array{client_id:string,symbol:string,side:string,size:float,leverage:float,entry_price:float,sl:?float,tp:?float,opened_at:string} */
function tl_validate_position(array $p): array {
    return [
        'client_id' => tl_expect_string($p['id'] ?? null, 'position.id', 40),
        'symbol' => tl_expect_symbol($p['symbol'] ?? null, 'position.symbol'),
        'side' => tl_expect_side($p['side'] ?? null, 'position.side'),
        'size' => tl_expect_number($p['size'] ?? null, 'position.size', 0, 1e12),
        'leverage' => tl_expect_number($p['leverage'] ?? 1, 'position.leverage', 0, 500),
        'entry_price' => tl_expect_number($p['entryPrice'] ?? null, 'position.entryPrice', 0, 1e12),
        'sl' => tl_expect_nullable_number($p['sl'] ?? null, 'position.sl', 0, 1e12),
        'tp' => tl_expect_nullable_number($p['tp'] ?? null, 'position.tp', 0, 1e12),
        'opened_at' => tl_expect_timestamp_ms($p['openedAt'] ?? null, 'position.openedAt'),
    ];
}

function tl_validate_order(array $o): array {
    $type = $o['type'] ?? null;
    tl_expect($type === 'limit' || $type === 'stop', 'Invalid order.type: expected \'limit\' or \'stop\'');
    return [
        'client_id' => tl_expect_string($o['id'] ?? null, 'order.id', 40),
        'symbol' => tl_expect_symbol($o['symbol'] ?? null, 'order.symbol'),
        'side' => tl_expect_side($o['side'] ?? null, 'order.side'),
        'type' => $type,
        'size' => tl_expect_number($o['size'] ?? null, 'order.size', 0, 1e12),
        'price' => tl_expect_number($o['price'] ?? null, 'order.price', 0, 1e12),
        'leverage' => tl_expect_number($o['leverage'] ?? 1, 'order.leverage', 0, 500),
        'sl' => tl_expect_nullable_number($o['sl'] ?? null, 'order.sl', 0, 1e12),
        'tp' => tl_expect_nullable_number($o['tp'] ?? null, 'order.tp', 0, 1e12),
        'created_at' => tl_expect_timestamp_ms($o['createdAt'] ?? null, 'order.createdAt'),
    ];
}

function tl_validate_history_entry(array $h): array {
    return [
        'client_id' => is_string($h['id'] ?? null) ? substr($h['id'], 0, 40) : null,
        'symbol' => tl_expect_symbol($h['symbol'] ?? null, 'history.symbol'),
        'side' => tl_expect_side($h['side'] ?? null, 'history.side'),
        'size' => tl_expect_number($h['size'] ?? null, 'history.size', 0, 1e12),
        'leverage' => tl_expect_number($h['leverage'] ?? 1, 'history.leverage', 0, 500),
        'entry_price' => tl_expect_number($h['entryPrice'] ?? null, 'history.entryPrice', 0, 1e12),
        'exit_price' => tl_expect_number($h['exitPrice'] ?? null, 'history.exitPrice', 0, 1e12),
        'sl' => tl_expect_nullable_number($h['sl'] ?? null, 'history.sl', 0, 1e12),
        'tp' => tl_expect_nullable_number($h['tp'] ?? null, 'history.tp', 0, 1e12),
        'pnl' => tl_expect_number($h['pnl'] ?? null, 'history.pnl', -1e12, 1e12),
        'opened_at' => isset($h['openedAt']) ? tl_expect_timestamp_ms($h['openedAt'], 'history.openedAt') : null,
        'closed_at' => tl_expect_timestamp_ms($h['closedAt'] ?? null, 'history.closedAt'),
    ];
}

/**
 * Validates the FULL snapshot shape used only by api/state/seed.php - the
 * one-time import of a brand-new account's pre-existing local
 * paper-trading history. Every other endpoint (api/orders/*.php) writes
 * positions/orders/history one at a time with server-verified prices; this
 * is the sole remaining place a client's own balance/positions/orders/
 * history are trusted wholesale, and only because there is nothing
 * authoritative yet to protect on a brand-new account (see seed.php for
 * the one-shot guard that keeps this from being reusable).
 */
function tl_validate_portfolio_payload(array $body): array {
    $portfolio = $body['portfolio'] ?? null;
    tl_expect(is_array($portfolio), 'Missing or invalid "portfolio"');

    $balance = tl_expect_number($portfolio['balance'] ?? null, 'portfolio.balance', -1e12, 1e12);

    $positionsIn = $portfolio['positions'] ?? [];
    tl_expect(is_array($positionsIn) && count($positionsIn) <= TL_MAX_POSITIONS, 'Invalid or too many positions');
    $positions = array_map('tl_validate_position', $positionsIn);

    $ordersIn = $portfolio['workingOrders'] ?? [];
    tl_expect(is_array($ordersIn) && count($ordersIn) <= TL_MAX_ORDERS, 'Invalid or too many workingOrders');
    $orders = array_map('tl_validate_order', $ordersIn);

    $historyIn = $portfolio['history'] ?? [];
    tl_expect(is_array($historyIn) && count($historyIn) <= TL_MAX_HISTORY, 'Invalid or too much history');
    $history = array_map('tl_validate_history_entry', $historyIn);

    $watchlist = tl_validate_watchlist_payload($body);
    $alerts = tl_validate_alerts_payload($body);

    return [
        'balance' => $balance,
        'positions' => $positions,
        'orders' => $orders,
        'history' => $history,
        'watchlist' => $watchlist,
        'alerts' => $alerts,
    ];
}

/**
 * Validates the (optional) price-alerts list - no financial consequence
 * (see api/db/schema_alerts.sql), so this is a much looser check than
 * positions/orders: just "is this a sane list of {id, symbol, price}".
 * Returns null if the caller sent no "alerts" key at all (meaning "don't
 * touch it"), same convention as tl_validate_watchlist_payload.
 */
function tl_validate_alerts_payload(array $body): ?array {
    $alertsIn = $body['alerts'] ?? null;
    if ($alertsIn === null) {
        return null;
    }
    tl_expect(is_array($alertsIn) && count($alertsIn) <= TL_MAX_ALERTS, 'Invalid or too many price alerts');
    $alerts = [];
    $seen = [];
    foreach ($alertsIn as $a) {
        tl_expect(is_array($a), 'Invalid alert entry');
        $id = tl_expect_string($a['id'] ?? null, 'alert.id', 40);
        if (isset($seen[$id])) {
            continue;
        }
        $seen[$id] = true;
        $alerts[] = [
            'id' => $id,
            'symbol' => tl_expect_symbol($a['symbol'] ?? null, 'alert.symbol'),
            'price' => tl_expect_number($a['price'] ?? null, 'alert.price', 0, 1e12),
        ];
    }
    return $alerts;
}

/** Groups flat alert rows into price-alerts.js's own per-symbol shape: {SYMBOL: [{id, price}, ...]}. */
function tl_group_alerts_by_symbol(array $rows): array {
    $grouped = [];
    foreach ($rows as $row) {
        $grouped[$row['symbol']] ??= [];
        $grouped[$row['symbol']][] = ['id' => $row['alert_id'], 'price' => (float) $row['price']];
    }
    return $grouped;
}

/**
 * Validates just the watchlist half of a payload - what api/state/save.php
 * accepts now that positions/workingOrders/history/balance are no longer
 * client-writable (see api/orders/*.php). Returns null if the caller sent
 * no watchlist at all (meaning "don't touch it").
 */
function tl_validate_watchlist_payload(array $body): ?array {
    $watchlistIn = $body['watchlist'] ?? null;
    if ($watchlistIn === null) {
        return null;
    }
    tl_expect(is_array($watchlistIn) && count($watchlistIn) <= TL_MAX_WATCHLIST, 'Invalid or too many watchlist symbols');
    $watchlist = [];
    foreach ($watchlistIn as $sym) {
        $s = tl_expect_symbol($sym, 'watchlist symbol');
        if (!in_array($s, $watchlist, true)) {
            $watchlist[] = $s;
        }
    }
    return $watchlist;
}

function tl_position_row_to_client(array $row): array {
    return [
        'id' => $row['client_id'],
        'symbol' => $row['symbol'],
        'side' => $row['side'],
        'size' => (float) $row['size'],
        'leverage' => (float) $row['leverage'],
        'entryPrice' => (float) $row['entry_price'],
        'sl' => $row['sl'] !== null ? (float) $row['sl'] : null,
        'tp' => $row['tp'] !== null ? (float) $row['tp'] : null,
        'openedAt' => tl_datetime_to_ms($row['opened_at']),
    ];
}

function tl_order_row_to_client(array $row): array {
    return [
        'id' => $row['client_id'],
        'symbol' => $row['symbol'],
        'side' => $row['side'],
        'type' => $row['type'],
        'size' => (float) $row['size'],
        'price' => (float) $row['price'],
        'leverage' => (float) $row['leverage'],
        'sl' => $row['sl'] !== null ? (float) $row['sl'] : null,
        'tp' => $row['tp'] !== null ? (float) $row['tp'] : null,
        'createdAt' => tl_datetime_to_ms($row['created_at']),
    ];
}

/**
 * Reads a user's complete authoritative portfolio state - used by
 * api/state/bootstrap.php (page load) and api/orders/check-fills.php
 * (after reconciling fills/stops), so both return the exact same shape the
 * client already knows how to consume via PortfolioSync/order-authority.js.
 */
function tl_get_full_portfolio_state(PDO $pdo, int $uid): ?array {
    $acct = $pdo->prepare('SELECT balance FROM portfolio_accounts WHERE user_id = :uid');
    $acct->execute([':uid' => $uid]);
    $acctRow = $acct->fetch();
    if ($acctRow === false) {
        return null;
    }

    $positionsStmt = $pdo->prepare(
        'SELECT client_id, symbol, side, size, leverage, entry_price, sl, tp, opened_at
         FROM positions WHERE user_id = :uid ORDER BY opened_at'
    );
    $positionsStmt->execute([':uid' => $uid]);
    $positions = array_map('tl_position_row_to_client', $positionsStmt->fetchAll());

    $ordersStmt = $pdo->prepare(
        'SELECT client_id, symbol, side, type, size, price, leverage, sl, tp, created_at
         FROM working_orders WHERE user_id = :uid ORDER BY created_at'
    );
    $ordersStmt->execute([':uid' => $uid]);
    $orders = array_map('tl_order_row_to_client', $ordersStmt->fetchAll());

    $historyStmt = $pdo->prepare(
        'SELECT client_id, symbol, side, size, leverage, entry_price, exit_price, sl, tp, pnl, opened_at, closed_at
         FROM trade_history WHERE user_id = :uid ORDER BY closed_at DESC LIMIT ' . TL_MAX_HISTORY
    );
    $historyStmt->execute([':uid' => $uid]);
    $history = array_map('tl_history_row_to_client', $historyStmt->fetchAll());

    return [
        'balance' => (float) $acctRow['balance'],
        'positions' => $positions,
        'workingOrders' => $orders,
        'history' => $history,
    ];
}

function tl_history_row_to_client(array $row): array {
    return [
        'id' => $row['client_id'],
        'symbol' => $row['symbol'],
        'side' => $row['side'],
        'size' => (float) $row['size'],
        'leverage' => (float) $row['leverage'],
        'entryPrice' => (float) $row['entry_price'],
        'exitPrice' => (float) $row['exit_price'],
        'sl' => $row['sl'] !== null ? (float) $row['sl'] : null,
        'tp' => $row['tp'] !== null ? (float) $row['tp'] : null,
        'pnl' => (float) $row['pnl'],
        'openedAt' => tl_datetime_to_ms($row['opened_at']),
        'closedAt' => tl_datetime_to_ms($row['closed_at']),
    ];
}
