-- Consumer profile picture.
ALTER TABLE users ADD COLUMN photo_url TEXT NULL AFTER full_name;
