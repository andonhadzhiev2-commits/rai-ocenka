-- Persistent pseudonymous browser registry, shared across every table.
CREATE TABLE IF NOT EXISTS review_browser_registry (
  browser_hash text PRIMARY KEY,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  review_count integer NOT NULL DEFAULT 0,
  CHECK (review_count >= 0)
);
INSERT INTO review_browser_registry (browser_hash, first_seen_at, last_seen_at, review_count)
SELECT browser_hash, min(created_at), max(created_at), count(*)::integer
FROM reviews WHERE browser_hash IS NOT NULL
GROUP BY browser_hash
ON CONFLICT (browser_hash) DO UPDATE SET
  first_seen_at=LEAST(review_browser_registry.first_seen_at, EXCLUDED.first_seen_at),
  last_seen_at=GREATEST(review_browser_registry.last_seen_at, EXCLUDED.last_seen_at),
  review_count=EXCLUDED.review_count;
CREATE INDEX IF NOT EXISTS review_browser_registry_count_idx ON review_browser_registry(review_count DESC, last_seen_at DESC);
