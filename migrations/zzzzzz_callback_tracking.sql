-- Record actual owner callback completion separately from review read/resolve status.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS callback_called_at timestamptz;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS callback_called_by uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS reviews_callback_pending_idx ON reviews(created_at DESC)
  WHERE phone_consent = true AND phone IS NOT NULL AND callback_called_at IS NULL;
