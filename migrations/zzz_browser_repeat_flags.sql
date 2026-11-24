-- Browser-based duplicate review signals. No QR regeneration; no review is discarded.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS browser_hash text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS suspected_repeat boolean NOT NULL DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS suspicion_reason text;
CREATE INDEX IF NOT EXISTS reviews_browser_recent_idx
  ON reviews (browser_hash, created_at DESC) WHERE browser_hash IS NOT NULL;
