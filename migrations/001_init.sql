CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','manager')),
  active boolean NOT NULL DEFAULT true,
  notify boolean NOT NULL DEFAULT true,
  on_duty boolean NOT NULL DEFAULT false,
  token_version int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zones (
  id serial PRIMARY KEY,
  name text NOT NULL,
  sort int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS tables (
  id serial PRIMARY KEY,
  zone_id int REFERENCES zones(id) ON DELETE SET NULL,
  label text NOT NULL,
  code text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_categories (
  id serial PRIMARY KEY,
  name_bg text NOT NULL, name_en text, name_el text,
  sort int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS products (
  id serial PRIMARY KEY,
  category_id int REFERENCES product_categories(id) ON DELETE SET NULL,
  name_bg text NOT NULL, name_en text, name_el text,
  is_new boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  table_id int REFERENCES tables(id) ON DELETE SET NULL,
  table_label text,
  zone_name text,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags text[] NOT NULL DEFAULT '{}',
  comment text,
  phone text,
  phone_consent boolean NOT NULL DEFAULT false,
  phone_purge_at timestamptz,
  lang text NOT NULL DEFAULT 'bg',
  client_hash text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','acknowledged','resolved')),
  ack_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ack_at timestamptz,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  escalated_at timestamptz,
  notified_count int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS reviews_created_idx ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_table_idx ON reviews(table_id);

CREATE TABLE IF NOT EXISTS review_products (
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  product_id int REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  vote smallint NOT NULL CHECK (vote IN (-1, 1)),
  PRIMARY KEY (review_id, product_name)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  fail_count int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS error_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  message text NOT NULL,
  detail text
);

CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
