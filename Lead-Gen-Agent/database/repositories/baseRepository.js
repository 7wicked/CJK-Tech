'use strict';

const { getDb } = require('../db');
const { nowIso } = require('../utils/id');

/**
 * Thin helpers over better-sqlite3 so the concrete repositories stay readable.
 * Everything here is raw SQL — no ORM, no query builder.
 */
class BaseRepository {
  constructor(table, { jsonFields = [] } = {}) {
    this.table = table;
    this.jsonFields = jsonFields;
  }

  get db() { return getDb(); }

  /** Turn JSON-as-text columns back into objects on the way out. */
  hydrate(row) {
    if (!row) return null;
    const out = { ...row };
    for (const f of this.jsonFields) {
      if (typeof out[f] === 'string' && out[f].length) {
        try { out[f] = JSON.parse(out[f]); } catch { /* leave as text */ }
      } else if (out[f] == null) {
        out[f] = null;
      }
    }
    return out;
  }

  hydrateAll(rows) { return rows.map((r) => this.hydrate(r)); }

  /** Stringify JSON fields on the way in. */
  serialize(data) {
    const out = { ...data };
    for (const f of this.jsonFields) {
      if (out[f] !== undefined && typeof out[f] !== 'string') {
        out[f] = out[f] === null ? null : JSON.stringify(out[f]);
      }
    }
    return out;
  }

  findById(id) {
    return this.hydrate(this.db.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).get(id));
  }

  all({ limit = 100, offset = 0, orderBy = 'created_at DESC' } = {}) {
    const rows = this.db
      .prepare(`SELECT * FROM ${this.table} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
      .all(limit, offset);
    return this.hydrateAll(rows);
  }

  count(whereSql = '', params = []) {
    const sql = `SELECT COUNT(*) AS n FROM ${this.table} ${whereSql}`;
    return this.db.prepare(sql).get(...params).n;
  }

  /** Generic partial update. Only columns present in `patch` are written. */
  update(id, patch) {
    const data = this.serialize(patch);
    const cols = Object.keys(data).filter((k) => k !== 'id');
    if (!cols.length) return this.findById(id);

    const sets = cols.map((c) => `${c} = @${c}`).join(', ');
    this.db
      .prepare(`UPDATE ${this.table} SET ${sets}, updated_at = @updated_at WHERE id = @id`)
      .run({ ...data, id, updated_at: nowIso() });
    return this.findById(id);
  }

  remove(id) {
    return this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id).changes > 0;
  }
}

module.exports = BaseRepository;
