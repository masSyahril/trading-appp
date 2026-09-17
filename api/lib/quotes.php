<?php
declare(strict_types=1);

/**
 * Shared "what is this symbol trading at right now" helper, used by
 * api/stocks.php (for the ?latest=1 quick-quote mode) and by every
 * api/orders/*.php endpoint that needs to decide a real fill/exit price
 * server-side instead of trusting whatever the browser sends.
 *
 * This is the actual fix for the gap flagged since the portfolio-sync
 * pass (see api/db/schema_portfolio.sql and docs/SETUP_AUTH.md): before
 * this, ALL fill/stop/close prices were decided by the client and just
 * mirrored into the database as-is. tl_fetch_latest_price() is now the
 * one place a price enters the system for anything that touches money
 * (even paper money) - a modified browser can send whatever it wants,
 * but the order endpoints below never look at it for the actual fill.
 */

const TL_SYMBOL_REGEX = '/^\^?[A-Z0-9]{1,10}(?:[.\-][A-Z0-9]{1,6})?(?:=[A-Z])?$/';

function tl_validate_ticker_symbol(string $symbol): bool {
    return preg_match(TL_SYMBOL_REGEX, $symbol) === 1;
}

/**
 * Thrown when a live price can't be obtained - callers should turn this
 * into a 502 rather than ever falling back to a client-supplied price.
 */
class TlQuoteUnavailableException extends RuntimeException {
}

/**
 * @return array{last: float, prevClose: float, lastTime: int}
 */
function tl_fetch_latest_price(string $symbol): array {
    $symbol = strtoupper(trim($symbol));
    if ($symbol === '' || !tl_validate_ticker_symbol($symbol)) {
        throw new TlQuoteUnavailableException("Invalid symbol: {$symbol}");
    }

    $mock = tl_fetch_mock_price($symbol);
    if ($mock !== null) {
        return $mock;
    }

    return tl_fetch_yahoo_latest_price($symbol);
}

/**
 * Dev/test-only override: if secrets.local.php sets quotes.mock_file to a
 * path, and that file exists, prices come from that small JSON map instead
 * of a real network call to Yahoo. This is what lets the automated test
 * suite (and any local dev work) run deterministically without depending on
 * live market data or outbound network access - a real XAMPP install's
 * secrets.local.php simply never sets this key, so production behavior is
 * completely unaffected (same DEV MODE pattern as api/lib/mailer.php).
 *
 * File shape: { "AAPL": 231.45, "TSLA": { "last": 410.2, "prevClose": 408.9 } }
 */
function tl_fetch_mock_price(string $symbol): ?array {
    // stocks.php intentionally works standalone, without requiring
    // secrets.local.php to exist - tl_app_config() may not even be defined
    // when it calls in here, so this has to degrade to "no mock" rather than
    // fatally require config.php just for this one dev-only feature.
    if (!function_exists('tl_app_config')) {
        return null;
    }
    $mockFile = tl_app_config()['quotes']['mock_file'] ?? null;
    if (!$mockFile || !is_file($mockFile)) {
        return null;
    }
    $raw = file_get_contents($mockFile);
    $data = $raw !== false ? json_decode($raw, true) : null;
    if (!is_array($data) || !array_key_exists($symbol, $data)) {
        return null;
    }
    $entry = $data[$symbol];
    if (is_array($entry)) {
        $last = (float) ($entry['last'] ?? 0);
        $prev = (float) ($entry['prevClose'] ?? $last);
    } else {
        $last = (float) $entry;
        $prev = $last;
    }
    if (!is_finite($last) || $last <= 0) {
        throw new TlQuoteUnavailableException("Mock quote for {$symbol} is invalid");
    }
    return ['last' => $last, 'prevClose' => $prev, 'lastTime' => time()];
}

// Binance pairs: 5-15 alnum chars, must end in one of the quote assets this
// app actually trades against (matches crypto-app.prod.js's own
// isCryptoSymbol allowlist, plus a length cap to keep the regex tight).
const TL_CRYPTO_SYMBOL_REGEX = '/^[A-Z0-9]{2,12}(?:USDT|BUSD|BTC|ETH)$/';

function tl_validate_crypto_symbol(string $symbol): bool {
    return preg_match(TL_CRYPTO_SYMBOL_REGEX, $symbol) === 1 && strlen($symbol) <= 20;
}

/**
 * Crypto counterpart of tl_fetch_latest_price() - same "never trust the
 * client's price" contract, same dev-mode mock override (tl_fetch_mock_price
 * reads a plain symbol->price map that doesn't care which market a symbol
 * belongs to, so one test-quotes.json file covers both), but fetches from
 * Binance's public REST API instead of Yahoo Finance when there's no mock.
 *
 * @return array{last: float, prevClose: float, lastTime: int}
 */
function tl_fetch_latest_crypto_price(string $symbol): array {
    $symbol = strtoupper(trim($symbol));
    if ($symbol === '' || !tl_validate_crypto_symbol($symbol)) {
        throw new TlQuoteUnavailableException("Invalid crypto symbol: {$symbol}");
    }

    $mock = tl_fetch_mock_price($symbol);
    if ($mock !== null) {
        return $mock;
    }

    return tl_fetch_binance_latest_price($symbol);
}

function tl_fetch_binance_latest_price(string $symbol): array {
    // data-api.binance.vision is Binance's unauthenticated market-data
    // mirror (no geo/API-key restrictions some binance.com endpoints have);
    // api.binance.com is the fallback, matching crypto-app.prod.js's own
    // BINANCE_KLINE_BASES order for the same reason.
    $bases = [
        'https://data-api.binance.vision/api/v3/ticker/24hr',
        'https://api.binance.com/api/v3/ticker/24hr',
    ];

    $sslOptions = ['verify_peer' => true, 'verify_peer_name' => true];
    $caBundle = __DIR__ . '/cacert.pem';
    if (is_file($caBundle)) {
        $sslOptions['cafile'] = $caBundle;
    }

    $lastError = null;
    foreach ($bases as $base) {
        $url = $base . '?symbol=' . rawurlencode($symbol);
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => implode("\r\n", [
                    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                    'Accept: application/json',
                ]),
                'timeout' => 8,
                'ignore_errors' => true,
            ],
            'ssl' => $sslOptions,
        ]);

        $raw = @file_get_contents($url, false, $context);
        if ($raw === false || $raw === '') {
            $lastError = 'no response from ' . $base;
            continue;
        }

        $data = json_decode($raw, true);
        if (!is_array($data) || !isset($data['lastPrice'])) {
            // Binance returns {"code":-1121,"msg":"Invalid symbol."} (still
            // valid JSON, still HTTP 400) for an unknown pair - treat that
            // the same as unreachable rather than a fatal PHP error.
            $lastError = is_array($data) && isset($data['msg']) ? $data['msg'] : ('bad response from ' . $base);
            continue;
        }

        $last = (float) $data['lastPrice'];
        if (!is_finite($last) || $last <= 0) {
            $lastError = 'non-positive price from ' . $base;
            continue;
        }
        $prevClose = isset($data['prevClosePrice']) ? (float) $data['prevClosePrice'] : $last;

        return ['last' => $last, 'prevClose' => $prevClose, 'lastTime' => time()];
    }

    error_log('quotes: binance fetch failed for ' . $symbol . ': ' . ($lastError ?? 'unknown error'));
    throw new TlQuoteUnavailableException("Could not reach Binance for {$symbol}");
}

function tl_fetch_yahoo_latest_price(string $symbol): array {
    // A tight, always-the-same request shape (1 day of 1-minute bars) -
    // independent of whatever range/interval a chart request happens to be
    // using - so "the current price" always means the same thing here.
    $url = 'https://query1.finance.yahoo.com/v8/finance/chart/' . rawurlencode($symbol)
         . '?range=1d&interval=1m';

    $sslOptions = [
        'verify_peer' => true,
        'verify_peer_name' => true,
    ];
    $caBundle = __DIR__ . '/cacert.pem';
    if (is_file($caBundle)) {
        $sslOptions['cafile'] = $caBundle;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => implode("\r\n", [
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Accept: application/json',
                'Accept-Language: en-US,en;q=0.9',
            ]),
            'timeout' => 10,
            'ignore_errors' => true,
        ],
        'ssl' => $sslOptions,
    ]);

    $raw = @file_get_contents($url, false, $context);
    if ($raw === false || $raw === '') {
        $sslErr = error_get_last();
        if ($sslErr !== null) {
            error_log('quotes: fetch failed for ' . $symbol . ': ' . $sslErr['message']);
        }
        throw new TlQuoteUnavailableException("Could not reach Yahoo Finance for {$symbol}");
    }

    $data = json_decode($raw, true);
    if (!$data || empty($data['chart']['result'][0])) {
        throw new TlQuoteUnavailableException("No quote available for {$symbol}");
    }

    $result = $data['chart']['result'][0];
    $meta = $result['meta'] ?? [];
    $timestamps = $result['timestamp'] ?? [];
    $closes = $result['indicators']['quote'][0]['close'] ?? [];

    // Walk backwards for the last non-null close - Yahoo's most recent
    // intraday row is sometimes a null placeholder for the bar still forming.
    $last = null;
    $lastTime = null;
    for ($i = count($timestamps) - 1; $i >= 0; $i--) {
        if (isset($closes[$i]) && $closes[$i] !== null) {
            $last = (float) $closes[$i];
            $lastTime = (int) $timestamps[$i];
            break;
        }
    }
    // Fall back to Yahoo's own "regularMarketPrice" meta field if the
    // intraday candle array didn't have a usable close (e.g. market not
    // open yet today).
    if ($last === null && isset($meta['regularMarketPrice'])) {
        $last = (float) $meta['regularMarketPrice'];
        $lastTime = (int) ($meta['regularMarketTime'] ?? time());
    }
    if ($last === null || !is_finite($last) || $last <= 0) {
        throw new TlQuoteUnavailableException("No usable price for {$symbol}");
    }

    $prevClose = isset($meta['chartPreviousClose'])
        ? (float) $meta['chartPreviousClose']
        : (isset($meta['previousClose']) ? (float) $meta['previousClose'] : $last);

    return ['last' => $last, 'prevClose' => $prevClose, 'lastTime' => $lastTime ?? time()];
}
