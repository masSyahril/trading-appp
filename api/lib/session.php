<?php
declare(strict_types=1);

require_once __DIR__ . '/../db/connect.php';
require_once __DIR__ . '/config.php';

/**
 * We use our own `sessions` table rather than PHP's file-based session
 * store, keyed by a random opaque cookie value (hashed before it's stored,
 * same pattern as the email/reset tokens). That gives us things a bare
 * $_SESSION doesn't: a session survives PHP session-file cleanup, "log out
 * this device" / "log out everywhere" become simple DELETE queries, and each
 * row records the IP/user-agent it was created from for later auditing -
 * worth having from day one given where this app is headed.
 */

function tl_session_cookie_name(): string {
    return tl_app_config()['app']['session_cookie_name'] ?? 'tl_session';
}

function tl_create_session(int $userId): string {
    $pdo = tl_db();
    [$raw, $hash] = tl_generate_token();
    // A second, non-secret identifier just for the account-settings "active
    // sessions" list - see api/db/schema_account.sql for why this isn't
    // simply sessions.id (the hash above, which is the session's credential).
    $publicId = bin2hex(random_bytes(16));
    $lifetimeDays = (int) (tl_app_config()['app']['session_lifetime_days'] ?? 30);

    $stmt = $pdo->prepare(
        'INSERT INTO sessions (id, public_id, user_id, ip_address, user_agent, expires_at)
         VALUES (:id, :public_id, :user_id, :ip, :ua, DATE_ADD(NOW(), INTERVAL :days DAY))'
    );
    $stmt->execute([
        ':id' => $hash,
        ':public_id' => $publicId,
        ':user_id' => $userId,
        ':ip' => tl_client_ip(),
        ':ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
        ':days' => $lifetimeDays,
    ]);

    $secure = (bool) (tl_app_config()['app']['force_https_cookies'] ?? false);
    setcookie(tl_session_cookie_name(), $raw, [
        'expires' => time() + $lifetimeDays * 86400,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    return $raw;
}

function tl_destroy_current_session(): void {
    $raw = $_COOKIE[tl_session_cookie_name()] ?? null;
    if ($raw !== null && $raw !== '') {
        $hash = hash('sha256', $raw);
        $stmt = tl_db()->prepare('DELETE FROM sessions WHERE id = :id');
        $stmt->execute([':id' => $hash]);
    }
    setcookie(tl_session_cookie_name(), '', [
        'expires' => time() - 3600,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** Returns the logged-in user's public fields, or null if not logged in / session expired. */
function tl_current_user(): ?array {
    $raw = $_COOKIE[tl_session_cookie_name()] ?? null;
    if ($raw === null || $raw === '') {
        return null;
    }

    $hash = hash('sha256', $raw);
    $pdo = tl_db();
    $stmt = $pdo->prepare(
        'SELECT u.id, u.email, u.display_name, u.email_verified_at, u.status, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = :id'
    );
    $stmt->execute([':id' => $hash]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    if (strtotime($row['expires_at']) < time()) {
        $del = $pdo->prepare('DELETE FROM sessions WHERE id = :id');
        $del->execute([':id' => $hash]);
        return null;
    }
    if ($row['status'] !== 'active') {
        return null;
    }

    $touch = $pdo->prepare('UPDATE sessions SET last_seen_at = NOW() WHERE id = :id');
    $touch->execute([':id' => $hash]);

    return [
        'id' => (int) $row['id'],
        'email' => $row['email'],
        'display_name' => $row['display_name'],
        'email_verified' => $row['email_verified_at'] !== null,
    ];
}

function tl_require_auth(): array {
    $user = tl_current_user();
    if ($user === null) {
        tl_error('Not authenticated', 401);
    }
    return $user;
}

/** SHA-256 hash of the caller's own session cookie, or null if not signed in. */
function tl_current_session_hash(): ?string {
    $raw = $_COOKIE[tl_session_cookie_name()] ?? null;
    if ($raw === null || $raw === '') {
        return null;
    }
    return hash('sha256', $raw);
}

/**
 * Cosmetic-only best-effort parse of a User-Agent string into "Browser on
 * OS", for the active-sessions list. Never used for any security decision -
 * it's just so the list reads as "Chrome on Windows" instead of a raw UA
 * string.
 */
function tl_describe_user_agent(?string $ua): string {
    $ua = (string) $ua;
    if ($ua === '') {
        return 'Unknown device';
    }

    $os = 'Unknown OS';
    if (stripos($ua, 'Windows') !== false) {
        $os = 'Windows';
    } elseif (stripos($ua, 'Mac OS X') !== false || stripos($ua, 'Macintosh') !== false) {
        $os = 'macOS';
    } elseif (stripos($ua, 'Android') !== false) {
        $os = 'Android';
    } elseif (stripos($ua, 'iPhone') !== false || stripos($ua, 'iPad') !== false) {
        $os = 'iOS';
    } elseif (stripos($ua, 'Linux') !== false) {
        $os = 'Linux';
    }

    $browser = 'Unknown browser';
    if (stripos($ua, 'Edg/') !== false) {
        $browser = 'Edge';
    } elseif (stripos($ua, 'OPR/') !== false || stripos($ua, 'Opera') !== false) {
        $browser = 'Opera';
    } elseif (stripos($ua, 'Chrome/') !== false) {
        $browser = 'Chrome';
    } elseif (stripos($ua, 'Firefox/') !== false) {
        $browser = 'Firefox';
    } elseif (stripos($ua, 'Safari/') !== false) {
        $browser = 'Safari';
    }

    return "{$browser} on {$os}";
}

/** All non-expired sessions for a user, newest-active-first, for the account settings page. */
function tl_list_sessions(int $userId): array {
    $currentHash = tl_current_session_hash();
    $pdo = tl_db();
    $stmt = $pdo->prepare(
        'SELECT id, public_id, ip_address, user_agent, created_at, last_seen_at
         FROM sessions WHERE user_id = :uid AND expires_at > NOW()
         ORDER BY last_seen_at DESC'
    );
    $stmt->execute([':uid' => $userId]);

    $out = [];
    foreach ($stmt->fetchAll() as $row) {
        $out[] = [
            'id' => $row['public_id'],
            'device' => tl_describe_user_agent($row['user_agent']),
            'ip_address' => $row['ip_address'],
            'created_at' => $row['created_at'],
            'last_seen_at' => $row['last_seen_at'],
            'is_current' => $currentHash !== null && hash_equals($row['id'], $currentHash),
        ];
    }
    return $out;
}

/**
 * Revokes one session by its public (non-secret) id. Always scoped to
 * $userId, so an account can only ever revoke its own sessions - even a
 * guessed/leaked public_id belonging to someone else matches no row here.
 * Returns whether a session was found, and whether it was the caller's own
 * current one (the account-settings UI never actually calls this for its
 * own current session, but the API stays correct if it ever did).
 */
function tl_revoke_session_by_public_id(int $userId, string $publicId): array {
    $pdo = tl_db();
    $currentHash = tl_current_session_hash();

    $find = $pdo->prepare('SELECT id FROM sessions WHERE user_id = :uid AND public_id = :pid');
    $find->execute([':uid' => $userId, ':pid' => $publicId]);
    $row = $find->fetch();
    if ($row === false) {
        return ['found' => false, 'was_current' => false];
    }

    $wasCurrent = $currentHash !== null && hash_equals($row['id'], $currentHash);

    $del = $pdo->prepare('DELETE FROM sessions WHERE user_id = :uid AND public_id = :pid');
    $del->execute([':uid' => $userId, ':pid' => $publicId]);

    return ['found' => true, 'was_current' => $wasCurrent];
}

/** Logs out every device except the caller's own current session. Returns how many were revoked. */
function tl_revoke_other_sessions(int $userId): int {
    $currentHash = tl_current_session_hash();
    $pdo = tl_db();

    if ($currentHash === null) {
        $stmt = $pdo->prepare('DELETE FROM sessions WHERE user_id = :uid');
        $stmt->execute([':uid' => $userId]);
    } else {
        $stmt = $pdo->prepare('DELETE FROM sessions WHERE user_id = :uid AND id != :current');
        $stmt->execute([':uid' => $userId, ':current' => $currentHash]);
    }
    return $stmt->rowCount();
}
