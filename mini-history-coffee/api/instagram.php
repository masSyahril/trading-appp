<?php
declare(strict_types=1);

/*
 * Server-side proxy for the cafe's Instagram feed. The browser never sees the
 * access token: the page calls this file, this file calls graph.instagram.com,
 * caches the answer for a few minutes and returns a trimmed JSON list.
 *
 * Responses:
 *   200 {"status":"ok","fetched_at":"...","posts":[...]}
 *   503 {"status":"not_configured"}  - no token in config.local.php yet
 *   502 {"status":"error","message":"..."} - Instagram refused / unreachable
 *       (if an older cached feed exists it is served instead, status "stale")
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const GRAPH = 'https://graph.instagram.com';
const REFRESH_AFTER_SECONDS = 50 * 86400; // tokens live 60 days

$configFile = __DIR__ . '/config.local.php';
$config = is_file($configFile) ? (require $configFile)['instagram'] ?? [] : [];
$cacheDir = __DIR__ . '/cache';
$feedFile = $cacheDir . '/feed.json';
$tokenFile = $cacheDir . '/token.json';
$limit = max(1, min(25, (int) ($config['limit'] ?? 12)));
$cacheSeconds = max(60, (int) ($config['cache_seconds'] ?? 300));

function respond(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function read_json(string $file): ?array
{
    if (!is_file($file)) {
        return null;
    }
    $data = json_decode((string) file_get_contents($file), true);
    return is_array($data) ? $data : null;
}

function write_json(string $file, array $data): void
{
    if (!is_dir(dirname($file))) {
        @mkdir(dirname($file), 0775, true);
    }
    @file_put_contents($file, json_encode($data, JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function graph_get(string $path, array $query): array
{
    $url = GRAPH . $path . '?' . http_build_query($query);
    $ctx = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => true]]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) {
        throw new RuntimeException('Instagram tidak bisa dihubungi.');
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || isset($data['error'])) {
        throw new RuntimeException($data['error']['message'] ?? 'Jawaban Instagram tidak terbaca.');
    }
    return $data;
}

// Fresh cache: answer without touching Instagram.
$cached = read_json($feedFile);
if ($cached && time() - (int) ($cached['fetched_ts'] ?? 0) < $cacheSeconds) {
    respond(200, ['status' => 'ok'] + $cached);
}

// The newest token wins: one refreshed earlier beats the one in config.
$tokenState = read_json($tokenFile);
$token = $tokenState['access_token'] ?? ($config['access_token'] ?? '');
if ($token === '') {
    respond(503, ['status' => 'not_configured']);
}

try {
    $issuedAt = (int) ($tokenState['refreshed_ts'] ?? 0);
    if (time() - $issuedAt > REFRESH_AFTER_SECONDS) {
        try {
            $fresh = graph_get('/refresh_access_token', [
                'grant_type' => 'ig_refresh_token',
                'access_token' => $token,
            ]);
            $token = $fresh['access_token'];
            write_json($tokenFile, ['access_token' => $token, 'refreshed_ts' => time()]);
        } catch (RuntimeException $e) {
            // A token younger than 24h can't be refreshed yet; keep using it
            // and try again in a day instead of on every cache miss.
            write_json($tokenFile, [
                'access_token' => $token,
                'refreshed_ts' => time() - REFRESH_AFTER_SECONDS + 86400,
            ]);
        }
    }

    $me = graph_get('/me', ['fields' => 'username', 'access_token' => $token]);
    $media = graph_get('/me/media', [
        'fields' => 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
        'limit' => $limit,
        'access_token' => $token,
    ]);

    $posts = [];
    foreach ($media['data'] ?? [] as $item) {
        $image = $item['media_type'] === 'VIDEO'
            ? ($item['thumbnail_url'] ?? null)
            : ($item['media_url'] ?? null);
        if (!$image) {
            continue;
        }
        $posts[] = [
            'id' => $item['id'],
            'type' => $item['media_type'],
            'image' => $image,
            'caption' => mb_substr((string) ($item['caption'] ?? ''), 0, 400),
            'permalink' => $item['permalink'],
            'timestamp' => $item['timestamp'],
        ];
    }

    $feed = [
        'username' => $me['username'] ?? null,
        'fetched_at' => gmdate('c'),
        'fetched_ts' => time(),
        'posts' => $posts,
    ];
    write_json($feedFile, $feed);
    respond(200, ['status' => 'ok'] + $feed);
} catch (RuntimeException $e) {
    if ($cached) {
        respond(200, ['status' => 'stale'] + $cached);
    }
    respond(502, ['status' => 'error', 'message' => $e->getMessage()]);
}
