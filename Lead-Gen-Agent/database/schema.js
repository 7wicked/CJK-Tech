'use strict';

/**
 * Raw SQL schema. Executed once on boot (idempotent).
 * SQLite dialect. If you move to Postgres, the only real changes are
 * TEXT PRIMARY KEY -> same, and INTEGER booleans -> BOOLEAN.
 */
const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id            TEXT PRIMARY KEY,
  name          TEXT,
  email         TEXT,
  phone         TEXT,
  company       TEXT,
  title         TEXT,
  source        TEXT,                        -- 'manual' | 'csv' | 'n8n' | 'webform'
  status        TEXT NOT NULL DEFAULT 'new', -- new|contacted|replied|qualified|won|lost|unsubscribed
  score         INTEGER NOT NULL DEFAULT 0,
  tags          TEXT,                        -- JSON array as text
  notes         TEXT,
  meta          TEXT,                        -- JSON blob for anything extra
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email   ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);

CREATE TABLE IF NOT EXISTS channels (
  id            TEXT PRIMARY KEY,
  key           TEXT NOT NULL UNIQUE,        -- 'email' | 'sms' | 'whatsapp'
  label         TEXT NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 1,
  config        TEXT,                        -- JSON: from address, sender id, n8n webhook override
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  channel_key    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft', -- draft|running|paused|done
  subject        TEXT,                          -- used by email only
  body           TEXT NOT NULL,                 -- template with {{placeholders}}
  audience_filter TEXT,                         -- JSON: { status, tags, source }
  daily_cap      INTEGER NOT NULL DEFAULT 50,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

CREATE TABLE IF NOT EXISTS campaign_leads (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id      TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  state        TEXT NOT NULL DEFAULT 'pending', -- pending|sent|failed|skipped
  created_at   TEXT NOT NULL,
  UNIQUE (campaign_id, lead_id)
);
CREATE INDEX IF NOT EXISTS idx_cl_campaign ON campaign_leads(campaign_id, state);

CREATE TABLE IF NOT EXISTS messages (
  id                  TEXT PRIMARY KEY,
  lead_id             TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id         TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  channel_key         TEXT NOT NULL,
  direction           TEXT NOT NULL DEFAULT 'outbound', -- outbound|inbound
  status              TEXT NOT NULL DEFAULT 'queued',   -- queued|sent|delivered|failed|replied
  subject             TEXT,
  body                TEXT,
  provider_message_id TEXT,
  error               TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_lead    ON messages(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_status  ON messages(status);
`;

/** Channels that exist the moment the app boots. */
const SEED_CHANNELS = [
  { key: 'email',    label: 'Email',    config: { fromName: 'Your Name', fromAddress: 'you@example.com' } },
  { key: 'sms',      label: 'SMS',      config: { senderId: 'LEADGEN' } },
  { key: 'whatsapp', label: 'WhatsApp', config: { senderNumber: '+910000000000' } },
];

module.exports = { SCHEMA_SQL, SEED_CHANNELS };
