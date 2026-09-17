<?php
// Stock data via Yahoo Finance (no API key required)
// Usage:
//   /api/stocks.php?symbol=AAPL                        -> returns JSON candles (daily, 5y)
//   /api/stocks.php?symbol=AAPL&interval=5m&range=1mo  -> candle size / history length, passed to Yahoo
//   /api/stocks.php?symbol=AAPL&latest=1               -> returns { last, prevClose, lastTime }
//
// The ?latest=1 quick-quote path now shares its actual fetch with
// api/lib/quotes.php (tl_fetch_latest_price) - the same function the
// server-authoritative order endpoints (api/orders/*.php) use to decide
// real fill/exit prices. This file's own chart-candle logic below is
// unchanged and unaffected.

require_once __DIR__ . '/lib/quotes.php';

header('Content-Type: application/json');

// Values Yahoo's chart API accepts. Anything else is rejected rather than
// forwarded, so the query string can't be used to build arbitrary Yahoo URLs.
const VALID_INTERVALS = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo'];
const VALID_RANGES    = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'];
// Bar length in seconds for the intraday intervals (see the merge step below).
const INTRADAY_SECONDS = ['1m' => 60, '2m' => 120, '5m' => 300, '15m' => 900, '30m' => 1800, '60m' => 3600, '90m' => 5400, '1h' => 3600];

// Ticker symbols Yahoo's chart API actually uses: plain letters (AAPL), an
// optional leading ^ for indices (^GSPC, ^IXIC), an optional .SUFFIX or
// -SUFFIX for share classes and foreign exchanges (BRK-B, BRK.B, and - since
// this app is headed for Taiwan - Taiwan Stock Exchange tickers like
// 2330.TW), and an optional =X for FX pairs (EURUSD=X). Anything outside
// this shape is rejected outright rather than forwarded: $symbol used to go
// straight into the request URL unescaped and unchecked, which meant a
// crafted "symbol" value could alter the outbound request to Yahoo (path
// segments, extra query parameters, even raw CRLF/header injection) instead
// of just naming a ticker.
const VALID_SYMBOL = '/^\^?[A-Z0-9]{1,10}(?:[.\-][A-Z0-9]{1,6})?(?:=[A-Z])?$/';

$symbol   = isset($_GET['symbol']) ? strtoupper(trim($_GET['symbol'])) : '';
$latest   = isset($_GET['latest']) ? (int)$_GET['latest'] : 0;
$interval = $_GET['interval'] ?? '1d';
$range    = $_GET['range'] ?? '5y';

if ($symbol === '') {
  http_response_code(400);
  echo json_encode(['error' => 'symbol is required']);
  exit;
}

if (!preg_match(VALID_SYMBOL, $symbol)) {
  http_response_code(400);
  echo json_encode(['error' => 'invalid symbol']);
  exit;
}

// ?latest=1 only ever wants "the current price", regardless of whatever
// interval/range params happen to be in the query string - handled by the
// shared quote fetcher (see file header) rather than by fetching and
// re-deriving it from a full candle series below.
if ($latest === 1) {
  try {
    $quote = tl_fetch_latest_price($symbol);
  } catch (TlQuoteUnavailableException $e) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to fetch data from Yahoo Finance', 'symbol' => $symbol]);
    exit;
  }
  echo json_encode([
    'symbol' => $symbol,
    'last' => $quote['last'],
    'prevClose' => $quote['prevClose'],
    'lastTime' => $quote['lastTime'],
  ]);
  exit;
}

if (!in_array($interval, VALID_INTERVALS, true) || !in_array($range, VALID_RANGES, true)) {
  http_response_code(400);
  echo json_encode(['error' => 'invalid interval or range']);
  exit;
}

// rawurlencode as defense-in-depth even after the whitelist above - ^ isn't
// a URL-safe character, so this also just makes index symbols work correctly.
$url = 'https://query1.finance.yahoo.com/v8/finance/chart/' . rawurlencode($symbol)
     . '?range=' . rawurlencode($range) . '&interval=' . rawurlencode($interval);

// Verify Yahoo's TLS certificate for real (this used to be turned off
// entirely, which let anyone positioned between this server and Yahoo - a
// malicious Wi-Fi hotspot, a compromised router, a hostile proxy - serve
// fake "market data" indistinguishable from the real thing). A CA bundle is
// shipped alongside this file so verification works out of the box even on
// a XAMPP install whose php.ini doesn't already point openssl at one; if
// that file is ever missing, PHP falls back to the system CA store instead
// of silently going unverified.
$sslOptions = [
  'verify_peer'      => true,
  'verify_peer_name' => true,
];
$caBundle = __DIR__ . '/lib/cacert.pem';
if (is_file($caBundle)) {
  $sslOptions['cafile'] = $caBundle;
}

$context = stream_context_create([
  'http' => [
    'method'          => 'GET',
    'header'          => implode("\r\n", [
      'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept: application/json',
      'Accept-Language: en-US,en;q=0.9',
    ]),
    'timeout'         => 15,
    'ignore_errors'   => true,
  ],
  'ssl' => $sslOptions,
]);

$raw = @file_get_contents($url, false, $context);
if ($raw === false || $raw === '') {
  $sslErr = error_get_last();
  if ($sslErr !== null) {
    // Not sent to the client (it can leak local paths/config) - just enough
    // in the server log to tell "Yahoo is down" apart from "this XAMPP
    // install has no usable CA store", which is the one thing enabling TLS
    // verification here could newly break.
    error_log('stocks.php fetch failed for ' . $symbol . ': ' . $sslErr['message']);
  }
  http_response_code(502);
  echo json_encode(['error' => 'Failed to fetch data from Yahoo Finance', 'symbol' => $symbol]);
  exit;
}

$data = json_decode($raw, true);
if (!$data || empty($data['chart']['result'][0])) {
  $msg = isset($data['chart']['error']['description']) ? $data['chart']['error']['description'] : 'No data';
  http_response_code(404);
  echo json_encode(['error' => $msg, 'symbol' => $symbol]);
  exit;
}

$result     = $data['chart']['result'][0];
$timestamps = $result['timestamp'] ?? [];
$quote      = $result['indicators']['quote'][0] ?? [];
$opens      = $quote['open']   ?? [];
$highs      = $quote['high']   ?? [];
$lows       = $quote['low']    ?? [];
$closes     = $quote['close']  ?? [];
$volumes    = $quote['volume'] ?? [];

// Yahoo can send a row that starts inside the previous bar's window - a live
// partial tick during market hours, or the closing print right after the last
// 60m bar. Fold those into the previous bar instead of emitting a sliver
// candle; this also keeps times strictly ascending, which the chart requires.
// Intraday rows with no trades (volume 0, one price - e.g. the 16:00 closing
// print on 5m/15m) are folded in too: they're just the last price, and a
// zero-volume bar divides by zero in the volume-ratio indicators.
$intraday   = isset(INTRADAY_SECONDS[$interval]);
$barSeconds = max(INTRADAY_SECONDS[$interval] ?? 0, 1);

$candles = [];
foreach ($timestamps as $i => $ts) {
  $o = isset($opens[$i])  ? $opens[$i]  : null;
  $h = isset($highs[$i])  ? $highs[$i]  : null;
  $l = isset($lows[$i])   ? $lows[$i]   : null;
  $c = isset($closes[$i]) ? $closes[$i] : null;
  if ($o === null || $h === null || $l === null || $c === null) continue;
  $v = (int)(isset($volumes[$i]) ? $volumes[$i] : 0);
  $noTrades = $intraday && $v === 0 && $o == $h && $h == $l && $l == $c;
  $n = count($candles);
  if ($n > 0 && ($ts < $candles[$n - 1]['time'] + $barSeconds || $noTrades)) {
    $prev = &$candles[$n - 1];
    $prev['high']    = max($prev['high'], round((float)$h, 4));
    $prev['low']     = min($prev['low'], round((float)$l, 4));
    $prev['close']   = round((float)$c, 4);
    $prev['volume'] += $v;
    unset($prev);
    continue;
  }
  $candles[] = [
    'time'   => (int)$ts,
    'open'   => round((float)$o, 4),
    'high'   => round((float)$h, 4),
    'low'    => round((float)$l, 4),
    'close'  => round((float)$c, 4),
    'volume' => $v,
  ];
}

echo json_encode([
  'symbol'   => $symbol,
  'interval' => $interval,
  'range'    => $range,
  // IANA zone of the exchange (e.g. America/New_York), so the chart can label
  // intraday bars in market time instead of UTC.
  'timezone' => $result['meta']['exchangeTimezoneName'] ?? null,
  'candles'  => $candles,
]);
