'use strict';

const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const { SCHEMA_SQL, SEED_CHANNELS } = require('./schema');
const { ids, nowIso } = require('./utils/id');

let db = null;

/**
 * Opens (and creates, if needed) the SQLite file, applies the schema and seeds
 * the three channels. Safe to call more than once.
 */
function connect(dbFile) {
  if (db) return db;

  const file = dbFile || process.env.DB_FILE || path.join(__dirname, 'data', 'leadgen.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });

  db = new Database(file);
  db.exec(SCHEMA_SQL);
  seedChannels();
  return db;
}

function getDb() {
  if (!db) connect();
  return db;
}

function seedChannels() {
  const exists = db.prepare('SELECT 1 FROM channels WHERE key = ?');
  const insert = db.prepare(`
    INSERT INTO channels (id, key, label, enabled, config, created_at, updated_at)
    VALUES (@id, @key, @label, 1, @config, @now, @now)
  `);
  for (const c of SEED_CHANNELS) {
    if (exists.get(c.key)) continue;
    insert.run({ id: ids.channel(), key: c.key, label: c.label, config: JSON.stringify(c.config), now: nowIso() });
  }
}

/** Wrap several writes so a half-finished campaign run can't be persisted. */
function transaction(fn) {
  return getDb().transaction(fn);
}

function close() {
  if (db) { db.close(); db = null; }
}

module.exports = { connect, getDb, transaction, close };
