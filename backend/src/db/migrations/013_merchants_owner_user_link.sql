-- The only connection between the two auth systems: which consumer identity
-- (if any) created this business. Nullable — a merchant can still sign up
-- standalone with no consumer account via POST /api/auth/merchant/signup.
-- Unique (ignoring NULLs) because a consumer identity owns at most one
-- merchant identity in Phase Zero, enforced here as the DB-level backstop
-- to createMerchant()'s own check. This is a pointer between two separate
-- rows with two separate password hashes — never a merged row or a role
-- field on one account.
ALTER TABLE merchants
  ADD COLUMN owner_user_id CHAR(26) NULL AFTER id,
  ADD UNIQUE KEY merchants_owner_user_uk (owner_user_id),
  ADD CONSTRAINT merchants_owner_user_fk
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
