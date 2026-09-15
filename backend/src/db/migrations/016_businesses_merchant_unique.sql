-- 003_businesses.sql deliberately left "one merchant owns one business" as an
-- app-code-only rule to keep a future Phase One multi-business migration
-- simple. In practice that left a real race: saveStep1's check-then-insert
-- (SELECT ... WHERE merchant_id = ?, then INSERT if nothing found) has no
-- locking, so two near-simultaneous requests for the same merchant (double
-- tap on "Continue", or a client retry after a slow response that actually
-- succeeded) can both pass the check and insert two business rows for one
-- merchant. Every other query in this table assumes at most one row per
-- merchant and just grabs whichever queryOne returns first, so a duplicate
-- silently corrupts which row a merchant is actually editing.
--
-- A DB-level constraint is the only way to close a check-then-insert race —
-- app-code checks can't. When Phase One adds real multi-business support,
-- this constraint is what needs to be dropped first.
ALTER TABLE businesses
ADD UNIQUE KEY businesses_merchant_unique (merchant_id);
