-- Leasify Commercial v1: initial schema.
-- Every LC.state collection is one table: id, a few typed and indexed columns for querying,
-- the full record as jsonb (exactly as the engine holds it), and who/when last changed it.
-- `ord` keeps the order of the engine's arrays. Append-only tables use `seq` for the same job.

CREATE TABLE IF NOT EXISTS units (
  id text PRIMARY KEY,
  ord bigint NOT NULL DEFAULT 0,
  status text, city text, property_type text, owner_name text, listing_agent text, last_confirmed date,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS units_status_idx ON units (status);
CREATE INDEX IF NOT EXISTS units_owner_idx ON units (owner_name);
CREATE INDEX IF NOT EXISTS units_agent_idx ON units (listing_agent);

CREATE TABLE IF NOT EXISTS clients (
  id text PRIMARY KEY,
  ord bigint NOT NULL DEFAULT 0,
  stage text, agent text, phone text, source text, created_at timestamptz,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS clients_stage_idx ON clients (stage);
CREATE INDEX IF NOT EXISTS clients_agent_idx ON clients (agent);
CREATE INDEX IF NOT EXISTS clients_phone_idx ON clients (phone);

CREATE TABLE IF NOT EXISTS leads (
  id text PRIMARY KEY,
  ord bigint NOT NULL DEFAULT 0,
  status text, phone text, source text, channel text, client_id text, last_at timestamptz,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);
CREATE INDEX IF NOT EXISTS leads_phone_idx ON leads (phone);
CREATE INDEX IF NOT EXISTS leads_channel_idx ON leads (channel);

CREATE TABLE IF NOT EXISTS visits (
  id text PRIMARY KEY,
  ord bigint NOT NULL DEFAULT 0,
  client_id text, unit_id text, status text, when_at timestamptz, agent text,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS visits_client_idx ON visits (client_id);
CREATE INDEX IF NOT EXISTS visits_unit_idx ON visits (unit_id);
CREATE INDEX IF NOT EXISTS visits_when_idx ON visits (when_at);

CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  ord bigint NOT NULL DEFAULT 0,
  type text, assignee text, due_at timestamptz, done boolean,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasks (assignee, done);

CREATE TABLE IF NOT EXISTS queue_items (
  id text PRIMARY KEY,
  ord bigint NOT NULL DEFAULT 0,
  lead_id text, rule text, status text, assignee text, sla_due timestamptz,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS queue_status_idx ON queue_items (status);

CREATE TABLE IF NOT EXISTS activity (
  id text PRIMARY KEY,
  seq bigserial,
  ts timestamptz, kind text,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS activity_seq_idx ON activity (seq);

CREATE TABLE IF NOT EXISTS audit_log (
  id text PRIMARY KEY,
  seq bigserial,
  ts timestamptz, entity text, record_id text, "by" text,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS audit_seq_idx ON audit_log (seq);
CREATE INDEX IF NOT EXISTS audit_record_idx ON audit_log (record_id);

CREATE TABLE IF NOT EXISTS consent_log (
  id text PRIMARY KEY,
  seq bigserial,
  ts timestamptz, phone text, channel text,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS consent_seq_idx ON consent_log (seq);
CREATE INDEX IF NOT EXISTS consent_phone_idx ON consent_log (phone);

CREATE TABLE IF NOT EXISTS sync_runs (
  id text PRIMARY KEY,
  seq bigserial,
  ts timestamptz,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('ceo','manager','executive','owner')),
  owner_name text,
  title text,
  detail text,
  pin_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_exp_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS wa_events (
  id bigserial PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  direction text NOT NULL CHECK (direction IN ('in','out')),
  wa_id text,
  status text,
  raw jsonb
);
CREATE INDEX IF NOT EXISTS wa_events_ts_idx ON wa_events (ts);
CREATE INDEX IF NOT EXISTS wa_events_wa_idx ON wa_events (wa_id);

CREATE TABLE IF NOT EXISTS login_log (
  id bigserial PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  user_id text,
  role text,
  ok boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS login_log_user_idx ON login_log (user_id, ts);
