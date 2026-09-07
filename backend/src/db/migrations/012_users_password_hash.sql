-- Phase Zero originally deferred consumer login to Phase One (see
-- 001_users.sql). The mobile app's profile-selection signup needs a real
-- consumer identity now, so this brings that forward: 001_users.sql was
-- already applied, so per this repo's own migration discipline the column
-- is added here instead of editing that file.
ALTER TABLE users
  ADD COLUMN password_hash VARCHAR(255) NOT NULL AFTER email;
