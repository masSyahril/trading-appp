<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();

$body = tl_read_json_body();
$displayName = trim((string) ($body['display_name'] ?? ''));

if ($displayName === '' || mb_strlen($displayName) > 100) {
    tl_error('Please enter a name (up to 100 characters).');
}

$pdo = tl_db();
$stmt = $pdo->prepare('UPDATE users SET display_name = :name WHERE id = :id');
$stmt->execute([':name' => $displayName, ':id' => $user['id']]);

tl_json([
    'message' => 'Display name updated.',
    'user' => [
        'id' => $user['id'],
        'email' => $user['email'],
        'display_name' => $displayName,
        'email_verified' => $user['email_verified'],
    ],
]);
