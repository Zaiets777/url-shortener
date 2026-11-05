-- Initial PostgreSQL schema for Issues #6 and #7.
-- User accounts (username is case-insensitively unique).
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_username_not_empty CHECK (length(trim(username)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON users (lower(username));

-- Short links owned by users. Delete user -> delete their links.
CREATE TABLE IF NOT EXISTS links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    short_code VARCHAR(8) NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    click_count INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT links_short_code_length CHECK (length(short_code) BETWEEN 6 AND 8),
    CONSTRAINT links_url_not_empty CHECK (length(trim(original_url)) > 0),
    CONSTRAINT links_expiry_after_creation CHECK (expires_at > created_at),
    CONSTRAINT links_click_count_nonnegative CHECK (click_count >= 0)
);
CREATE INDEX IF NOT EXISTS links_user_id_idx ON links(user_id);
CREATE INDEX IF NOT EXISTS links_user_created_idx ON links(user_id, created_at DESC);
