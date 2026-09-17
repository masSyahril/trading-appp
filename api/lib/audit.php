<?php
declare(strict_types=1);

/**
 * Single insert point for fill_events (see api/db/schema_audit.sql). Every
 * place a server endpoint decides a real fill/close - api/orders/place.php,
 * api/orders/close.php, api/lib/order_engine.php (check-fills reconciliation,
 * called both from the HTTP endpoint and the background job), and
 * api/crypto/order.php - calls this once per event. Deliberately swallows
 * its own failures: a broken audit insert must never take down the actual
 * trade it's trying to record.
 *
 * @param array{user_id:int,market:string,symbol:string,side:string,reason:string,qty:float,price:float,pnl_delta?:?float,client_id?:?string,created_at?:string} $event
 */
function tl_log_fill_event(PDO $pdo, array $event): void {
    try {
        $pdo->prepare(
            'INSERT INTO fill_events (user_id, market, symbol, side, reason, qty, price, pnl_delta, client_id, created_at)
             VALUES (:uid, :market, :symbol, :side, :reason, :qty, :price, :pnl_delta, :client_id, :created_at)'
        )->execute([
            ':uid' => $event['user_id'],
            ':market' => $event['market'],
            ':symbol' => $event['symbol'],
            ':side' => $event['side'],
            ':reason' => $event['reason'],
            ':qty' => $event['qty'],
            ':price' => $event['price'],
            ':pnl_delta' => $event['pnl_delta'] ?? null,
            ':client_id' => $event['client_id'] ?? null,
            ':created_at' => $event['created_at'] ?? gmdate('Y-m-d H:i:s'),
        ]);
    } catch (Throwable $e) {
        error_log('tl_log_fill_event failed (non-fatal): ' . $e->getMessage());
    }
}
