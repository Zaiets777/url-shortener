-- Issue #20: immutable timestamped clicks for daily analytics.
-- Safe to run multiple times. No existing link or counter values are changed.
CREATE TABLE IF NOT EXISTS link_clicks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS link_clicks_link_date_idx ON link_clicks (link_id, clicked_at);

-- Old click_count totals are preserved, but clicks from before this migration
-- cannot be assigned to specific days retroactively.
