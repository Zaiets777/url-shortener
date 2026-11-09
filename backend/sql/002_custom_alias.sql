-- Issue #15: support custom short codes of up to 32 characters.
-- Existing 6–8 character codes are preserved, as is the UNIQUE constraint.
ALTER TABLE links ALTER COLUMN short_code TYPE VARCHAR(32);
ALTER TABLE links DROP CONSTRAINT IF EXISTS links_short_code_length;
ALTER TABLE links ADD CONSTRAINT links_short_code_length
  CHECK (length(short_code) BETWEEN 3 AND 32);
