<?php
declare(strict_types=1);

/**
 * Crypto counterpart of api/lib/portfolio.php: validation, row<->client
 * shape conversion, and the netting position math for the server-side
 * crypto price authority (api/crypto/order.php). See
 * api/db/schema_crypto.sql for why this is a separate, netting-shaped
 * model instead of reusing the stock `positions` table.
 */

const TL_MAX_CRYPTO_POSITIONS = 200;
const TL_MAX_CRYPTO_ORDERS = 1000;
const TL_MAX_CRYPTO_WATCHLIST = 100;

function tl_expect_crypto_symbol($val, string $field): string {
    tl_expect(is_string($val), "Invalid {$field}: expected a string");
    $s = strtoupper($val);
    tl_expect(tl_validate_crypto_symbol($s), "Invalid {$field}: expected a crypto trading pair (e.g. BTCUSDT)");
    return $s;
}

/**
 * Ports crypto-app.prod.js's updatePosition() exactly: weighted-average
 * entry price while adding in the same direction, realized P&L booked on
 * the closing/flipping portion, average price reset to the fill price on a
 * flip. $pos is the CURRENT row shape {qty, avg, realized}; returns the new
 * shape plus the realized P&L delta booked by *this* fill (for fill_events).
 *
 * @param array{qty:float,avg:float,realized:float} $pos
 * @return array{0: array{qty:float,avg:float,realized:float}, 1: float}
 */
function tl_apply_crypto_fill(array $pos, string $side, float $qty, float $price): array {
    $signedQty = $side === 'buy' ? $qty : -$qty;
    $newQty = $pos['qty'] + $signedQty;
    $realizedDelta = 0.0;

    if ($pos['qty'] === 0.0 || tl_sign($pos['qty']) === tl_sign($newQty)) {
        // Adding to the same direction (or opening from flat) - weighted-average the entry price.
        $absOld = abs($pos['qty']);
        $absNew = abs($newQty);
        $totalCost = $pos['avg'] * $absOld + $price * abs($signedQty);
        $pos['avg'] = $absNew === 0.0 ? 0.0 : $totalCost / $absNew;
        $pos['qty'] = $newQty;
    } else {
        // Reducing or flipping - this is a byte-for-byte port of
        // crypto-app.prod.js's updatePosition(), including its sign check
        // running AFTER pos.qty has already been reassigned to $newQty
        // (so it's really comparing sign($newQty) vs sign($newQty +
        // $signedQty), not "did this fill flip the position"). Kept exactly
        // as-is rather than "fixed" so a server-priced fill and the
        // logged-out local fallback always land on identical numbers -
        // see docs/SETUP_AUTH.md.
        $closingQty = min(abs($pos['qty']), abs($signedQty));
        $pnlPerUnit = ($price - $pos['avg']) * tl_sign($pos['qty']);
        $realizedDelta = $pnlPerUnit * $closingQty;
        $pos['realized'] += $realizedDelta;
        $pos['qty'] = $newQty;

        if (tl_sign($pos['qty']) !== tl_sign($pos['qty'] + $signedQty)) {
            $pos['avg'] = $price;
        }
        if ($pos['qty'] === 0.0) {
            $pos['avg'] = 0.0;
        }
    }

    return [$pos, $realizedDelta];
}

function tl_sign(float $n): int {
    return $n > 0 ? 1 : ($n < 0 ? -1 : 0);
}

function tl_crypto_position_row_to_client(array $row): array {
    return [
        'qty' => (float) $row['qty'],
        'avg' => (float) $row['avg_price'],
        'realized' => (float) $row['realized_pnl'],
    ];
}

function tl_crypto_order_row_to_client(array $row): array {
    return [
        'id' => $row['client_id'],
        'ts' => tl_datetime_to_ms($row['created_at']),
        'symbol' => $row['symbol'],
        'side' => strtoupper($row['side']),
        'qty' => (float) $row['qty'],
        'price' => (float) $row['price'],
        'status' => 'Filled',
    ];
}

/** @return array{positions: array<string,array{qty:float,avg:float,realized:float}>, orders: array} */
function tl_get_full_crypto_state(PDO $pdo, int $uid): array {
    $posStmt = $pdo->prepare('SELECT symbol, qty, avg_price, realized_pnl FROM crypto_positions WHERE user_id = :uid');
    $posStmt->execute([':uid' => $uid]);
    $positions = [];
    foreach ($posStmt->fetchAll() as $row) {
        $positions[$row['symbol']] = tl_crypto_position_row_to_client($row);
    }

    $ordStmt = $pdo->prepare(
        'SELECT client_id, symbol, side, qty, price, created_at FROM crypto_orders
         WHERE user_id = :uid ORDER BY created_at DESC LIMIT ' . TL_MAX_CRYPTO_ORDERS
    );
    $ordStmt->execute([':uid' => $uid]);
    $orders = array_map('tl_crypto_order_row_to_client', $ordStmt->fetchAll());

    return ['positions' => $positions, 'orders' => $orders];
}

/**
 * Validates the one-time seed payload from a brand-new account's existing
 * localStorage (api/crypto/seed.php only - see crypto_seed_marker in
 * schema_crypto.sql for the one-shot guard).
 */
function tl_validate_crypto_seed_payload(array $body): array {
    $positionsIn = $body['positions'] ?? [];
    tl_expect(is_array($positionsIn) && count($positionsIn) <= TL_MAX_CRYPTO_POSITIONS, 'Invalid or too many positions');
    $positions = [];
    foreach ($positionsIn as $symbol => $p) {
        tl_expect(is_array($p), 'Invalid position for ' . (string) $symbol);
        $sym = tl_expect_crypto_symbol($symbol, 'position symbol');
        $positions[$sym] = [
            'qty' => tl_expect_number($p['qty'] ?? 0, 'position.qty', -1e15, 1e15),
            'avg' => tl_expect_number($p['avg'] ?? 0, 'position.avg', 0, 1e15),
            'realized' => tl_expect_number($p['realized'] ?? 0, 'position.realized', -1e15, 1e15),
        ];
    }

    $ordersIn = $body['orders'] ?? [];
    tl_expect(is_array($ordersIn) && count($ordersIn) <= TL_MAX_CRYPTO_ORDERS, 'Invalid or too many orders');
    $orders = [];
    foreach ($ordersIn as $o) {
        tl_expect(is_array($o), 'Invalid order entry');
        $orders[] = [
            'client_id' => tl_expect_string($o['id'] ?? null, 'order.id', 40),
            'symbol' => tl_expect_crypto_symbol($o['symbol'] ?? null, 'order.symbol'),
            'side' => strtolower((string) ($o['side'] ?? '')) === 'sell' ? 'sell' : 'buy',
            'qty' => tl_expect_number($o['qty'] ?? null, 'order.qty', 0, 1e15),
            'price' => tl_expect_number($o['price'] ?? null, 'order.price', 0, 1e15),
            'created_at' => tl_expect_timestamp_ms($o['ts'] ?? null, 'order.ts'),
        ];
    }

    $watchlist = tl_validate_crypto_watchlist_payload($body);

    return ['positions' => $positions, 'orders' => $orders, 'watchlist' => $watchlist];
}

function tl_validate_crypto_watchlist_payload(array $body): ?array {
    $watchlistIn = $body['watchlist'] ?? null;
    if ($watchlistIn === null) {
        return null;
    }
    tl_expect(is_array($watchlistIn) && count($watchlistIn) <= TL_MAX_CRYPTO_WATCHLIST, 'Invalid or too many watchlist symbols');
    $watchlist = [];
    foreach ($watchlistIn as $sym) {
        $s = tl_expect_crypto_symbol($sym, 'watchlist symbol');
        if (!in_array($s, $watchlist, true)) {
            $watchlist[] = $s;
        }
    }
    return $watchlist;
}
