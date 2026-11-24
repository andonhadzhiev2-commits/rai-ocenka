-- Persistent push queue: one delivery per subscribed device and review event.
CREATE TABLE IF NOT EXISTS push_outbox (
 id bigserial PRIMARY KEY,
 review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
 subscription_id integer NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('new','escalation')),
 payload jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','sent','failed')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 locked_at timestamptz,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 UNIQUE(review_id, subscription_id, kind)
);
CREATE INDEX IF NOT EXISTS push_outbox_ready_idx ON push_outbox(next_attempt_at, id) WHERE state IN ('pending','processing');
