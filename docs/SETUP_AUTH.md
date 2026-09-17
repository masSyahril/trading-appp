# Account foundation - setup & what's included

This adds email/password accounts to TradeLite: register, email verification,
login, logout, forgot/reset password, an account settings page (see below),
and a "Sign In / Register" -> "Hi, {name}" widget wired into the hub, the
three stock-market views (terminal, dashboard, zen) and the crypto terminal.

Nothing about how you currently load stock data (manual CSV) was touched.
This is purely the account layer.

## 1. Create the database and import the schema

1. Open phpMyAdmin (`http://localhost/phpmyadmin`) and create a new,
   **empty** database named `tradelite` (matches `api/config/secrets.local.php`
   - use a different name there if you'd rather call it something else).
2. Select that database, go to **Import**, and choose `api/db/schema.sql`.
   This creates 5 tables: `users`, `email_verification_tokens`,
   `password_reset_tokens`, `sessions`, `auth_attempts`. Comments in the
   file explain why each one exists.

`api/config/secrets.local.php` already has XAMPP's usual defaults
(`root` / empty password / `127.0.0.1:3306`). If your MySQL is set up
differently, edit that file - not `secrets.example.php`, which is just the
template and isn't read by the app.

## 2. Email - works out of the box in "dev mode"

`api/config/secrets.local.php` ships with `smtp.host` empty, which means
verification and password-reset emails aren't actually sent yet - they're
written to `api/logs/mail.log` instead (created on first use), so you can
copy the link out and test the whole flow immediately.

When you're ready to send real emails, fill in `smtp.host`, `port`,
`encryption` (`tls` for port 587, `ssl` for port 465), `username` and
`password` in `secrets.local.php` with any normal SMTP provider (Gmail with
an app password works fine for testing). No library install needed - the
mailer speaks SMTP directly over a socket.

## 3. Try it

1. Open the hub (`index.html`) - top right now shows **Sign In** / **Register**.
2. Register an account. You're logged in immediately; check
   `api/logs/mail.log` for the verification link (until SMTP is configured).
3. Open that link (`pages/auth/verify-email.html?token=...`) to verify.
4. The account menu (click your name, top right) shows **Account settings**,
   **Log out**, and **Verify email address** until you've verified.
5. Try **Forgot your password?** from the sign-in page the same way - the
   reset link also lands in `mail.log` in dev mode.

## What's already handled

- Passwords hashed with PHP's `password_hash()` (bcrypt), never stored or
  logged in plain text.
- Login/register/forgot-password are rate-limited per IP (`auth_attempts`
  table) to slow down brute-forcing.
- Sessions are their own database table (not PHP's file-based sessions),
  keyed by a random token that's hashed before storage - a database leak
  alone doesn't hand over working sessions. "Log out everywhere" runs
  automatically on password reset and password change, and is also
  available on demand from the account settings page (see below).
- Verification and password-reset links carry a random token whose hash
  (not the raw value) is stored - same reasoning as sessions.
- Forgot-password always returns the same response whether or not the
  email is registered, so it can't be used to check who has an account.
- Basic CSRF defense (SameSite=Lax cookies + Origin/Referer check on
  state-changing requests).
- All SQL uses prepared statements (PDO) - no string-built queries.

## What's deliberately NOT done yet (fast-follow candidates)

- No way to change your email address once registered (name and password
  can both be changed from the account settings page below).
- Email verification doesn't currently gate anything - you can use the app
  right after registering, unverified. That's fine for this stage; revisit
  before real money is involved.
- No admin view of users.
- No 2FA.
- `force_https_cookies` is `false` for local http:// dev. **Flip it to
  `true`** once this is served over HTTPS, or the session cookie won't get
  the `Secure` flag.
- Price alerts (`stock-market/js/price-alerts.js`) still live only in
  `localStorage` - not part of this pass, see the portfolio/watchlist
  section below for why that's a separate, deliberate scope cut.

# Account settings page - setup & what's included

A signed-in user can now change their display name and password, resend
their own verification email, and see/manage every device currently signed
in to their account - all from **Account settings** in the account menu
(`pages/auth/account.html`).

## 1. Import one more migration

Open phpMyAdmin, select the `tradelite` database, **Import**, choose
`api/db/schema_account.sql`. This adds a `public_id` column to `sessions`
(comments in the file explain why the active-sessions list uses a separate
id rather than `sessions.id` itself, which is the session's actual
credential hash). Safe to run once against a database that already has
existing sessions in it - they get backfilled automatically.

## 2. Try it

1. Sign in, click your name (top right), choose **Account settings**.
2. Change your display name - it saves immediately and sticks around after
   a refresh.
3. Sign in to the same account from a second browser (or an incognito
   window). Back on the first, refresh **Account settings** - you'll see
   both devices listed with a friendly label (e.g. "Chrome on Windows"),
   IP address, and last-active time. Click **Log out** next to the other
   device - it's signed out immediately, everywhere.
4. Change your password. You'll stay signed in on the device you did it
   from; every other device gets signed out automatically (same as a
   password-reset link), and the old password stops working right away.
5. **Log out other devices** at the top of the sessions list does the same
   mass sign-out on demand, without changing your password.

## What's already handled

- The active-sessions list and its "log out this device" action never
  expose `sessions.id` (the SHA-256 hash that IS a session's credential) to
  the browser - a separate `public_id` is generated per session just for
  this UI (see `api/db/schema_account.sql` and `tl_create_session()` in
  `api/lib/session.php`).
- Revoking a session is always scoped to `user_id = <the signed-in
  account>` in the SQL itself, so even a leaked/guessed `public_id`
  belonging to someone else's session matches no row - verified with an
  automated test (one account attempting to revoke another's session gets
  a plain 404).
- Changing your password requires re-entering the current one, is rate-
  limited per IP the same way login is, and revokes every other session
  the same way a password-reset link does.
- Covered end-to-end with a real browser (Playwright) across two separate
  sessions/devices: profile rename persists, remote device logout actually
  invalidates that session server-side, wrong-current-password and
  mismatched-confirmation are both rejected before anything changes, and a
  password change signs out every other device while leaving the one that
  made the change signed in.

## What's deliberately NOT done yet (fast-follow candidates)

- No email-address change (see the account-foundation section above).
- No "new sign-in from an unrecognized device" email notification - the
  sessions list is pull (you have to go look), not push.
- IP address is shown as-is, with no reverse-geolocation ("last seen from
  Taipei, Taiwan") - would need a geo-IP lookup service.

# Portfolio & watchlist sync - setup & what's included

Stock portfolio (balance, positions, working orders, trade history) and the
stock watchlist now follow the signed-in account instead of staying stuck in
one browser's `localStorage`. Crypto's portfolio and price alerts are **not**
part of this pass - see "What's deliberately NOT done yet" below.

## 1. Import the new tables

Same as before: open phpMyAdmin, select the `tradelite` database, **Import**,
choose `api/db/schema_portfolio.sql`. This adds 5 tables: `portfolio_accounts`,
`positions`, `working_orders`, `trade_history`, `watchlist_items`.

## 2. How it works (important: read this before relying on it)

This is a **mirror**, not a rewrite of the trading engine. `stock-market/js/
portfolio.js`, `order-panel.js` and `stock-app.prod.js` are completely
unchanged - they still decide fill prices, P&L, and stop-loss/take-profit the
exact same way they always have, still reading/writing the same
`stock_portfolio` / `stock_watchlist` `localStorage` keys.

A new script, `pages/auth/portfolio-sync.js`, loads *before* those scripts on
every stock-market page (`index.html`, `terminal.html`, `dashboard.html`,
`zen.html`) and does two things:

1. On page load, if you're signed in, it pulls your saved state down from
   the database into `localStorage` *before* the trading engine reads it -
   so it opens exactly where you left off, on any device.
2. Every few seconds, it checks whether `localStorage` changed (a trade,
   a new watchlist symbol, anything) and if so pushes the whole thing back
   up to your account.

This was a deliberate trade-off to avoid rewriting portfolio.js/order-panel.js's
business logic in this pass. The practical implication: **the browser is
still the one deciding whether an order fills and at what price** - the
database just gives that decision a permanent home. That's fine for paper
trading, but it is a real gap before real money: a modified or compromised
browser could currently claim any fill price it wants. Moving that
authority server-side (the server fetching its own price from Yahoo,
instead of trusting what the client sends) needs to happen before real
money is connected - flagged here so it doesn't get forgotten.

## 3. Try it

1. Sign in, open any stock-market view, place a paper trade or add a symbol
   to your watchlist.
2. Open the same page in a different browser (or an incognito window),
   signed in as the same account - your trade/watchlist should already be
   there.
3. Log out - this also clears `stock_portfolio`/`stock_watchlist` from that
   browser, so a second account signing in on the same computer starts
   clean instead of inheriting the first account's trades.

## What's already handled

- Every field the server accepts is validated (symbol format, numeric
  ranges, buy/sell/limit/stop enums) before touching the database - a
  malformed or hand-crafted request gets a 400, not silently-corrupted data.
- Rows are scoped to `user_id` everywhere and the save endpoint requires a
  signed-in session, so one account can never read or overwrite another's
  portfolio.
- A brand-new account seeds the server from whatever is already in that
  browser (a fresh $100k default, or existing test trades) instead of
  wiping it - see `portfolio-sync.js` for the exact logic.

## What's deliberately NOT done yet (fast-follow candidates)

- ~~Server-side price authority~~ - **done**, see the "Server-side price
  authority" section further down.
- Crypto's portfolio/watchlist (`crypto-trading/`) - out of scope for this
  pass; it sources prices from Binance directly rather than through
  `api/stocks.php`, so it needs its own look. Not covered by server-side
  price authority either yet, for the same reason.
- Price alerts (`price-alerts.js`) - same reasoning, separate localStorage
  key, not yet mirrored.
- `trade_history` is wholesale-replaced on every save rather than
  append-only. Fine at hobby/paper-trading volume; would want to switch to
  incremental inserts before this sees heavy real usage.

# Server-side price authority - setup & what's included

Every fill price, position close, limit/stop trigger, and stop-loss/
take-profit hit for stock-market paper trading is now decided by the
**server**, using a live price it fetches itself from Yahoo Finance - never
by trusting whatever the browser sends. This closes the gap flagged since
the portfolio/watchlist sync pass: before this, a modified browser could
claim any fill price, any exit price, or fabricate an entire trade history,
and the old `api/state/save.php` would happily write it straight into the
database. That's no longer possible for anything that touches balance or
P&L.

## 1. No new setup step

Like localization, this is entirely a code-level change - there's nothing
new to import or configure. The existing `positions`, `working_orders`,
`trade_history` and `portfolio_accounts` tables (from
`api/db/schema_portfolio.sql`) are unchanged; they're just written to
differently now (one verified event at a time, instead of a wholesale
snapshot replace).

## 2. How it works

- **New endpoints**, all under `api/orders/`: `place.php` (open a position
  or place a limit/stop order), `close.php` (close a position), `cancel.php`
  and `edit-price.php` (manage a not-yet-filled limit/stop order), and
  `check-fills.php` (the periodic reconciliation that triggers limit/stop
  orders and stop-loss/take-profit hits). Each one fetches its own price via
  `api/lib/quotes.php` (`tl_fetch_latest_price()`, the same function
  `api/stocks.php?latest=1` uses) whenever a fill/close actually happens - a
  request field like `price` or `entryPrice` on a *market* order is simply
  never read for that purpose.
- **`pages/auth/order-authority.js`** (new) is the client-side integration
  layer, loaded right after `portfolio-sync.js` on every stock-market page.
  For a signed-in user, it wraps `window.TradeFlowPortfolio`'s
  `submitOrder`/`closePosition`/`cancelOrder`/`editOrderPrice` so market
  fills and closes are confirmed against the server first, mirrors
  limit/stop placement and cancel/edit server-side in the background, and
  polls `check-fills.php` every 5 seconds to catch trigger/stop/target hits
  the server has decided on its own. A logged-out or local-only session is
  completely untouched - this script checks `window.TL_SIGNED_IN` and does
  nothing at all if it isn't true.
- **`stock-market/js/portfolio.js`** got a handful of small, additive hooks
  (`addServerPosition`, `closePositionAtPrice`, `applyServerState`,
  `setLocalAutoTriggersEnabled`, `getWorkingOrder`, `updateWorkingOrderPrice`)
  so order-authority.js can feed it server-decided outcomes - none of its
  existing logic changed, and a logged-out user's experience is bit-for-bit
  the same as before.
- **Idempotent by design**: every fill/close is keyed by the same
  `client_id` the browser already generates, so a flaky connection retrying
  a request can't double-fill or double-close - it just reads back the
  event that already happened.
- **`api/state/save.php`** no longer accepts positions/working orders/
  history/balance at all - it now only handles the watchlist, and explicitly
  rejects (400) a request that still tries to send a `portfolio` key, rather
  than silently ignoring it. **`api/state/seed.php`** (new) is the one
  remaining place a client's numbers are trusted wholesale: a one-time-only
  import of a brand-new account's pre-existing local paper-trading history
  (there's nothing authoritative yet to protect at that point), guarded so
  it can never run a second time for the same account.

## 3. Try it

1. Sign in and open any stock-market view, then place a market order. It
   still fills instantly in the UI - the round-trip to the server happens in
   the background and corrects the position's entry price if it differs
   from what the chart was showing locally (network hiccups aside, these
   normally match, since both read the same live market).
2. Open the browser console: `order-authority.js` logs a warning any time it
   has to fall back to a local-only price (server unreachable, symbol not
   found) - quiet otherwise.
3. Place a limit or stop order, then close the tab and reopen it (or just
   wait) - it's now sitting in the database, not just this browser's
   `localStorage`, and will trigger even if this exact browser session never
   checks back in, as long as *some* signed-in session for that account
   polls `check-fills.php` again before the market moves on.

## What's already handled

- Every `api/orders/*.php` endpoint validates its input the same strict way
  the rest of this app does (symbol format, numeric ranges, buy/sell/
  limit/stop/market enums) and is scoped to the signed-in `user_id`
  everywhere, so one account can never close, cancel, or reprice another's
  order or position even with a guessed/leaked `client_id` - covered by an
  automated test (a second account's attempt reports "not found"/no-op,
  and the first account's data is verified untouched afterward).
- Automated tests cover: a tampered/fake price in a market order request is
  ignored in favor of the server's own fetched price; retried/duplicate
  requests are idempotent (no double-fill, no double-close); a limit order
  triggers only once the server's own price crosses it, at the server's
  price (not the trigger target); a stop-loss hit closes the position, updates
  the balance, and records the correct P&L; `save.php` rejects a `portfolio`
  key; `seed.php` only ever succeeds once per account; and
  `order-authority.js` itself, in a real browser, actually wraps the right
  functions, calls the right endpoints, and falls back to local-only
  behavior correctly when signed out.
- A dev/test-only mock-quotes override (`quotes.mock_file` in
  `secrets.local.php`, pointing at a small JSON file of `{"SYMBOL": price}`)
  lets all of the above run deterministically without depending on live
  Yahoo Finance data - same "DEV MODE" pattern as the mailer. Leave this key
  out entirely for a real deployment; `api/stocks.php`'s own chart-loading
  code path never reads it either way, so this can't accidentally affect
  what a real visitor's chart shows.

## What's deliberately NOT done yet (fast-follow candidates)

- ~~Crypto is not covered.~~ **done** for the price-authority half - see the
  "Phase 1 follow-up" section below. Crypto still has no limit/stop/SL-TP
  orders at all (a UI feature, not built here) and doesn't draw from the
  same balance as stocks.
- ~~No true background job.~~ **done** - see "Phase 1 follow-up" below
  (`api/jobs/run-check-fills.php`).
- **Yahoo Finance latency/availability is now on the critical path** for
  every fill and close, not just chart loading - if Yahoo is slow or briefly
  down, `place.php`/`close.php` return a 502 and `order-authority.js` falls
  back to a local-only fill/close (logged as a console warning) rather than
  blocking the user indefinitely. That local-only fallback event is, by
  definition, not price-authoritated - rare, but worth knowing about.
- A repriced (`edit-price.php`) working order updates the server first, then
  applies locally regardless of whether that server call succeeded - if it
  silently failed, the server would still fire the *old* trigger price on
  the next reconciliation until some later action corrects it (e.g.
  cancelling and re-placing). No automated retry queue for this yet.
- TWD currency/Asia-Taipei timezone display and admin/observability tooling
  (a UI on top of the new audit log) remain unbuilt - this pass was
  specifically the price-authority/trust-boundary fix, not those.

# Phase 1 follow-up: crypto authority, background job, audit log, alerts sync

Four smaller, independent pieces that round out the server-side price
authority pass above, all backend-only (no UI/interface changes - that's a
separate pass):

1. **Crypto price authority** - `crypto-trading/` market buy/sell orders now
   get their fill price from the server (Binance), the same trust boundary
   stocks got.
2. **A real background job** - `api/orders/check-fills.php`'s reconciliation
   logic now also runs for *every* user on a schedule, not just whoever has
   a browser tab open polling it.
3. **An audit log** - every server-decided fill/close, stock or crypto, now
   writes one row to `fill_events` for debugging/support.
4. **Price alerts sync** - `stock-market/js/price-alerts.js`'s alerts now
   follow a signed-in account across devices, same trust model as the
   watchlist (no financial consequence, so nothing to protect server-side).

## 1. Import four new tables

```
mysql -u root tradelite < api/db/schema_audit.sql
mysql -u root tradelite < api/db/schema_crypto.sql
mysql -u root tradelite < api/db/schema_alerts.sql
```
(`schema_audit.sql` and `schema_crypto.sql` also both need `users` to
already exist, same as every other schema file here - run after
`schema.sql`.) No changes to any existing table.

## 2. How it works

**Crypto price authority.** `crypto-trading/crypto-app.prod.js` only ever
had market buy/sell (no limit/stop, no SL/TP, no leverage) and a *netting*
position model - one row per symbol with a running average entry price and
realized P&L, not a list of discrete trades like stocks. `crypto_positions`
mirrors that shape exactly rather than forcing crypto into the stock
schema. New endpoints under `api/crypto/`: `order.php` (the market-order
equivalent of `orders/place.php`, pricing off `tl_fetch_latest_crypto_price()`
in `api/lib/quotes.php`, which hits Binance's public REST API the same way
`tl_fetch_latest_price()` hits Yahoo - including the same dev-mode mock
override), `bootstrap.php`/`seed.php` (crypto's own hydrate/one-time-import
pair, mirroring `api/state/bootstrap.php`/`seed.php`), and
`save-watchlist.php`. Two new client files, `pages/auth/crypto-sync.js` and
`pages/auth/crypto-order-authority.js`, mirror `portfolio-sync.js`/
`order-authority.js` for `crypto-trading/index.html`. Since
`crypto-app.prod.js` never exposed its order functions on `window.cryptoApp`
the way `portfolio.js` did, it needed one small additive change:
`placeMarketOrder()` now checks for an optional `window.cryptoApp.requestServerFill`
hook (installed only for signed-in users) before falling back to its
existing local-only fill - same "untouched if logged out" guarantee as the
stock side.

  **Found, not fixed: a pre-existing accounting quirk.** Porting
  `crypto-app.prod.js`'s `updatePosition()` to PHP byte-for-byte (deliberate,
  so a server-priced fill and the local fallback always agree) surfaced a
  bug that was already there client-side: a *partial* sell that reduces a
  position without fully closing it (e.g. long 1.0 BTC, sell 0.4) doesn't
  take the "realize P&L" code path at all, because `Math.sign(qty)` doesn't
  change - it's misclassified as "adding in the same direction" and the
  average entry price inflates instead of realized P&L being booked. Fully
  closing a position to flat (qty hits exactly zero) *does* work correctly.
  This is a real, pre-existing product bug (confirmed by an automated test
  that asserts the actual, buggy numbers) - deliberately not fixed in this
  pass, since fixing the math would need a decision on what to do with
  every affected user's existing realized-P&L numbers first.

**Background job.** The reconciliation logic that used to live entirely
inside `api/orders/check-fills.php` is now `tl_reconcile_user_fills($pdo,
$uid)` in `api/lib/order_engine.php`, called both by that endpoint (for
whichever one user is polling, unchanged) and by the new
`api/jobs/run-check-fills.php` - a CLI-only script (it refuses to run if hit
over HTTP) that finds every user with a pending working order or an
sl/tp-bearing position and reconciles each one. See the comment block at the
top of that file for exact Windows Task Scheduler setup (Program:
`C:\xampp\php\php.exe`, argument: the full path to the script, trigger:
repeat every 1 minute). Each run prints a one-line summary per user it
actually touched plus a totals line.

**Audit log.** `api/lib/audit.php`'s `tl_log_fill_event()` is called from
every place a fill/close is decided: `orders/place.php` (market fills),
`orders/close.php` (manual closes), `order_engine.php` (limit/stop fills and
sl/tp hits - so both the HTTP endpoint and the background job get logged the
same way), and `crypto/order.php`. It's append-only and never read by any
trading logic - purely for debugging/support today, a foundation for
compliance reporting later.

**Price alerts sync.** `price_alerts` stores each alert's id/symbol/price
per user. `api/state/bootstrap.php`/`save.php`/`seed.php` all gained an
optional `alerts` field alongside the existing `watchlist` one (independent
of each other - a request can send either, both, or neither) -
`price-alerts.js` itself is untouched; `portfolio-sync.js` hydrates/pushes
its per-symbol `stock_alerts_<SYMBOL>` localStorage keys the same way it
already did for the watchlist.

## 3. Try it

1. Sign in, place a crypto market order on `crypto-trading/` - it fills
   instantly in the UI same as before; the server-verified price and
   position land a moment later (a console warning appears only if the
   server round-trip failed and it fell back locally).
2. Set a Windows Task Scheduler entry per the comment in
   `api/jobs/run-check-fills.php`, place a limit order, then close every
   browser tab - it still fires on schedule.
3. `SELECT * FROM fill_events ORDER BY created_at DESC` after trading a bit
   on either market - one row per fill/close, with a `reason` column.
4. Set a price alert while signed in, sign in from a different browser -
   the alert is there.

## What's already handled

- Automated tests (66 checks: 42 API-level against a real PHP+MariaDB
  backend, 24 browser-level with Playwright) cover: the refactored
  `check-fills.php`/`order_engine.php` behaves identically to before
  (regression); every fill/close type writes the right `fill_events` row
  with the right `reason` and `pnl_delta`; the background job fills orders
  for a user with **no** browser polling at all, and processes multiple
  users correctly in one run; the job refuses to execute when requested
  over HTTP; crypto market orders price off the server (not a client-sent
  price), are idempotent on `clientId`, reject an invalid symbol, and are
  isolated per user; crypto's netting math (including the accounting quirk
  above) matches the client exactly; crypto seed/bootstrap/watchlist-save
  follow the same one-time-import/server-wins pattern as stocks; and
  alerts save/replace/clear correctly and independently of the watchlist,
  isolated per user.
- `tl_fetch_latest_crypto_price()` uses the same dev-mode mock-quotes
  override as stocks (one shared `{"SYMBOL": price}` file covers both
  markets, since it's symbol-keyed either way) - this sandbox can't reach
  Binance's API either (confirmed the same way Yahoo Finance was confirmed
  unreachable), so the crypto tests run against the mock exactly like the
  stock ones do.

## What's deliberately NOT done yet (fast-follow candidates)

- The partial-reduce accounting quirk above - needs a product decision, not
  just a code fix, since it'd change historical realized-P&L numbers for
  anyone who's made a non-flipping partial crypto sell.
- Crypto still has no limit/stop orders or stop-loss/take-profit (a feature
  + UI addition, out of scope for this backend-only pass) and its position
  book (`crypto_positions`) is still not tied into `portfolio_accounts`'s
  shared cash balance - crypto trades have never drawn from or affected
  that balance, client-side or now. Unifying stock and crypto buying power
  into one account is its own design decision.
- The background job has no locking against overlapping runs - if a job
  instance somehow ran long enough to still be going when the next one
  starts (very unlikely at a 1-minute interval against this workload), they
  could both process the same user; each still runs inside its own
  transaction with `FOR UPDATE` row locks, so the worst case is one of the
  two blocking briefly on the other, not a double-fill.
- `fill_events` has no admin UI or retention/archival policy yet - it will
  grow forever until something reads or prunes it.

# Localization (English / Taiwan) - setup & what's included

The hub (`index.html`) and all six auth pages (`login`, `register`,
`forgot-password`, `reset-password`, `verify-email`, `account`) now support
two languages - English and Traditional Chinese (Taiwan) - with a 🌐 language
switcher the visitor can toggle at any time. This is built as an optional,
user-selectable system rather than a hardcoded locale, so it's ready to grow
into more languages and, eventually, automatic country-based routing as the
app goes global. Nothing outside the hub and auth pages was touched in this
pass - see the scope cut below.

## 1. No database changes, no setup step

This feature is entirely client-side - there's nothing to import or
configure. It ships in `i18n/` (`i18n.js`, `lang-switcher.js`, `en.json`,
`zh-TW.json`) plus the `data-i18n` attributes and small `t()` helpers added
to the pages themselves.

## 2. How it works

- **Storage**: the chosen language is saved to the browser's `localStorage`
  (key `tl_lang`), not to the account/database. It's per-browser, not
  per-user - the same person signed in from two browsers can have two
  different language settings. Account-linked language preference (so it
  follows you across devices) is a natural fast-follow once this proves out,
  not built here.
- **First visit**: with no saved choice yet, the page guesses from the
  browser's language list (`navigator.languages`) - anything starting with
  `zh` gets Traditional Chinese, everything else defaults to English. This
  is the seed of the "route by country" idea mentioned when this was
  scoped; it's currently a browser-language guess, not a real
  country/IP-based lookup - that would replace or extend it later.
- **Translation files**: `i18n/en.json` and `i18n/zh-TW.json` mirror each
  other key-for-key (verified by an automated diff whenever a key is
  added/changed - see "Adding a third language" below). Static text uses
  `data-i18n="some.key"` (plus `data-i18n-placeholder` / `data-i18n-aria-label`
  / `data-i18n-title` for those attributes); anything built dynamically in
  JS (alerts, badges, the sessions list, button loading states) goes through
  a small `t(key, vars)` helper that every page defines.
- **Switching languages** re-renders the current page immediately - no
  reload - by dispatching a `tl:localechange` event that `data-i18n`
  elements, the lang switcher itself, the account-menu widget, and
  account.html's JS-generated sessions list all listen for.
- **`account.html`** additionally formats dates/times with
  `toLocaleString('zh-TW')` vs `('en-US')` depending on the active language,
  so "last active" timestamps read naturally in either language.

## 3. Try it

1. Open the hub - the 🌐 switcher is top-right next to Sign In/Register.
   Click it and choose 繁體中文; the hero text, nav, platform cards, and
   footer all switch instantly.
2. Reload the page, or open an auth page (e.g. `pages/auth/login.html`) -
   the language you picked carries over, because it's read from
   `localStorage` on every page load.
3. Sign in and open **Account settings** - switch languages there and watch
   the verification badge, the "This device" tag, and the signed-in-devices
   list re-render live, dates and all.

## What's already handled

- Every static string on the hub and all 6 auth pages is wired through
  `data-i18n` or `t()` - none of them fall back to a raw key like
  `auth.login.title` if translations load correctly.
- Missing-key safety net: `t()` falls back to the English string, and if
  even that's missing, logs a console warning and shows the raw key rather
  than throwing - a typo in one language degrades gracefully instead of
  breaking the page.
- Verified end-to-end with Playwright: default-English on first visit,
  live switching on the hub and via account.html's JS-rendered content,
  persistence across reload and across navigation to every auth page, and
  both languages rendering cleanly (no visible raw keys) on all 6 auth
  pages plus the unauthenticated redirect from `account.html` to `login.html`.

## Adding a third language later

1. Add the new file, e.g. `i18n/ja.json`, mirroring every key in
   `i18n/en.json` exactly (same nesting, same array lengths for list-style
   keys like `hub.crypto.features`).
2. Add its code to the `SUPPORTED` array in `i18n/i18n.js`.
3. Add `{ code: 'ja', label: '日本語', short: 'JA' }` to the `LANGUAGES` array
   in `i18n/lang-switcher.js`.
4. If it needs a more specific `<html lang>` tag than its locale code (the
   way Taiwan uses `zh-Hant-TW` instead of just `zh-TW`), add that mapping
   to `HTML_LANG` in `i18n/i18n.js`.

Nothing else changes - no page markup, no other script.

## What's deliberately NOT done yet (fast-follow candidates)

- **Scope**: only the hub and the 6 auth pages are localized. The
  stock-market and crypto-trading terminals (prices, order tickets, the
  trading UI itself) are still English-only - a larger pass, deferred on
  purpose so this one could ship and be verified first.
- Server-side strings are English-only: API error messages
  (`err.message` from `api/*.php`) are shown as-is regardless of the
  active language. Only client-side copy is translated.
- Session "device" descriptions (e.g. "Chrome on Windows", parsed from the
  user agent) are not localized.
- No country-based auto-routing yet - the browser-language guess on first
  visit is the only automatic behavior; there's no IP/geo lookup or
  per-country default.
- No account-linked language preference - it's `localStorage` only, so it
  doesn't follow a signed-in user across browsers/devices (see above).
- TWD currency formatting and an Asia/Taipei timezone display for
  Taiwan-facing users are separate, not-yet-started items - this pass was
  language text only, not currency/timezone localization.
