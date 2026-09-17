<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/*
 * One-time import of a brand-new account's existing local crypto trading
 * history (positions/orders/watchlist from localStorage), exactly mirroring
 * api/state/seed.php's role for stocks - and for the same reason: someone
 * who's been paper-trading crypto anonymously in this browser shouldn't
 * lose that history just because they signed up. Guarded by
 * crypto_seed_marker so it can only ever run once per account (see
 * schema_crypto.sql for why that's a separate marker table rather than
 * "does crypto_positions have any rows", which zero crypto trades would
 * satisfy on a real, already-seeded account too).
 */

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();
$body = tl_read_json_body();
$uid = $user['id'];

$pdo = tl_db();

$exists = $pdo->prepare('SELECT 1 FROM crypto_seed_marker WHERE user_id = :uid');
$exists->execute([':uid' => $uid]);
if ($exists->fetch() !== false) {
    tl_json(['ok' => true, 'seeded' => false, 'reason' => 'already seeded']);
}

try {
    $data = tl_validate_crypto_seed_payload($body);
} catch (InvalidArgumentException $e) {
    tl_error($e->getMessage(), 400);
}

$now = gmdate('Y-m-d H:i:s');

$pdo->beginTransaction();
try {
    // INSERT, not upsert - a concurrent seed attempt (two tabs) loses the
    // race here and falls into the catch block below instead of double-
    // importing.
    $pdo->prepare('INSERT INTO crypto_seed_marker (user_id, seeded_at) VALUES (:uid, :now)')
        ->execute([':uid' => $uid, ':now' => $now]);

    foreach ($data['positions'] as $symbol => $p) {
        if ($p['qty'] === 0.0 && $p['avg'] === 0.0 && $p['realized'] === 0.0) {
            continue; // nothing to import for a flat symbol
        }
        $pdo->prepare(
            'INSERT INTO crypto_positions (user_id, symbol, qty, avg_price, realized_pnl, updated_at)
             VALUES (:uid, :symbol, :qty, :avg, :realized, :now)'
        )->execute([
            ':uid' => $uid, ':symbol' => $symbol, ':qty' => $p['qty'],
            ':avg' => $p['avg'], ':realized' => $p['realized'], ':now' => $now,
        ]);
    }

    if (count($data['orders']) > 0) {
        $insertOrder = $pdo->prepare(
            'INSERT INTO crypto_orders (user_id, client_id, symbol, side, qty, price, created_at)
             VALUES (:uid, :cid, :symbol, :side, :qty, :price, :created_at)'
        );
        $seen = [];
        foreach ($data['orders'] as $o) {
            if (isset($seen[$o['client_id']])) {
                continue;
            }
            $seen[$o['client_id']] = true;
            $insertOrder->execute([
                ':uid' => $uid, ':cid' => $o['client_id'], ':symbol' => $o['symbol'], ':side' => $o['side'],
                ':qty' => $o['qty'], ':price' => $o['price'], ':created_at' => $o['created_at'],
            ]);
        }
    }

    if ($data['watchlist'] !== null && count($data['watchlist']) > 0) {
        $insertWatch = $pdo->prepare(
            'INSERT INTO crypto_watchlist_items (user_id, symbol, sort_order) VALUES (:uid, :symbol, :sort_order)'
        );
        foreach (array_values($data['watchlist']) as $i => $symbol) {
            $insertWatch->execute([':uid' => $uid, ':symbol' => $symbol, ':sort_order' => $i]);
        }
    }

    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    $exists->execute([':uid' => $uid]);
    if ($exists->fetch() !== false) {
        tl_json(['ok' => true, 'seeded' => false, 'reason' => 'already seeded']);
    }
    error_log('crypto/seed failed: ' . $e->getMessage());
    tl_error('Could not import your crypto history. Please try again.', 500);
}

tl_json(['ok' => true, 'seeded' => true]);
