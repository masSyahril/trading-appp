-- TradeLite account-settings migration.
-- Run this once against your existing `tradelite` database (phpMyAdmin ->
-- select tradelite -> Import -> pick this file), after schema.sql and
-- schema_portfolio.sql already exist.
--
-- What this adds: a `public_id` column on `sessions`, used only by the new
-- account settings page (change name/password, active-sessions list).
--
-- Why a *separate* public_id instead of reusing sessions.id: sessions.id is
-- the SHA-256 hash of the actual session cookie - the value that IS a
-- session's credential (see session.php). There's no way to turn that hash
-- back into a working cookie, but there's also no good reason to ever send
-- it to the browser just so a "log out this device" button has an id to
-- post back. public_id is a separate, meaningless-on-its-own random value
-- created just for that. Revoking by it is still always scoped to
-- `user_id = <the signed-in account>` in the query itself (see
-- tl_revoke_session_by_public_id in api/lib/session.php), so even seeing
-- another user's public_id would never let you touch their session.

ALTER TABLE sessions
  ADD COLUMN public_id CHAR(32) NULL AFTER id;

-- Backfill any sessions created before this migration (new ones get a
-- public_id from tl_create_session() going forward). Not meant to be
-- unguessable on its own - RAND()/UUID() here is just to make each row
-- unique, the same way the app-generated ones are - the actual security
-- boundary is the user_id scoping above, not secrecy of this value.
UPDATE sessions
  SET public_id = SUBSTRING(SHA2(CONCAT(id, RAND(), UUID()), 256), 1, 32)
  WHERE public_id IS NULL;

ALTER TABLE sessions
  MODIFY COLUMN public_id CHAR(32) NOT NULL,
  ADD UNIQUE KEY uniq_public_id (public_id);
