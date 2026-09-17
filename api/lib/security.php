<?php
declare(strict_types=1);

require_once __DIR__ . '/../db/connect.php';
require_once __DIR__ . '/response.php';

/**
 * Lightweight CSRF defense. Our session cookie is issued with SameSite=Lax,
 * so a cross-site page can't get it attached to a fetch()/XHR POST at all -
 * the forged request just arrives logged out. This adds a second, redundant
 * layer: reject state-changing requests whose Origin/Referer doesn't match
 * our own host, in case that cookie setting is ever loosened (e.g. by a
 * future reverse proxy). It intentionally does NOT block requests with no
 * Origin/Referer at all, since some same-origin situations omit both.
 */
function tl_check_same_origin(): void {
    $source = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? null);
    if ($source === null) {
        return;
    }
    $sourceHost = parse_url($source, PHP_URL_HOST);
    $expectedHost = explode(':', $_SERVER['HTTP_HOST'] ?? '')[0];
    if ($sourceHost !== null && $sourceHost !== $expectedHost) {
        tl_error('Cross-origin request rejected', 403);
    }
}

function tl_client_ip(): string {
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45);
}

/**
 * Generic throttle shared by login/register/forgot-password: rejects once an
 * identifier (normally the caller's IP) has hit $maxAttempts recorded
 * attempts for $action within the last $windowMinutes.
 */
function tl_check_rate_limit(string $identifier, string $action, int $maxAttempts, int $windowMinutes): void {
    $pdo = tl_db();
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM auth_attempts
         WHERE identifier = :id AND action = :action
           AND attempted_at > (NOW() - INTERVAL :mins MINUTE)'
    );
    $stmt->bindValue(':id', $identifier);
    $stmt->bindValue(':action', $action);
    $stmt->bindValue(':mins', $windowMinutes, PDO::PARAM_INT);
    $stmt->execute();
    $count = (int) $stmt->fetchColumn();
    if ($count >= $maxAttempts) {
        tl_error('Too many attempts. Please wait a few minutes and try again.', 429);
    }
}

function tl_record_attempt(string $identifier, string $action, bool $success): void {
    $pdo = tl_db();
    $stmt = $pdo->prepare('INSERT INTO auth_attempts (identifier, action, success) VALUES (:id, :action, :success)');
    $stmt->execute([':id' => $identifier, ':action' => $action, ':success' => $success ? 1 : 0]);
}

/** Returns an error string if the password is too weak, or null if it's fine. */
function tl_validate_password(string $password): ?string {
    if (strlen($password) < 8) {
        return 'Password must be at least 8 characters.';
    }
    if (strlen($password) > 200) {
        return 'Password is too long.';
    }
    if (!preg_match('/[A-Za-z]/', $password) || !preg_match('/[0-9]/', $password)) {
        return 'Password must contain at least one letter and one number.';
    }
    return null;
}

function tl_validate_email(string $email): bool {
    return strlen($email) <= 255 && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function tl_normalize_email(string $email): string {
    return strtolower(trim($email));
}

/**
 * Returns [rawToken, sha256HashOfToken]. Only the hash is ever persisted;
 * the raw token goes out in an email link and nowhere else, so a database
 * leak alone can't be replayed as a working verification/reset link.
 */
function tl_generate_token(): array {
    $raw = bin2hex(random_bytes(32));
    $hash = hash('sha256', $raw);
    return [$raw, $hash];
}
