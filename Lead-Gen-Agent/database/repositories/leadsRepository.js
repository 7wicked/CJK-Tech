'use strict';

const BaseRepository = require('./baseRepository');
const { ids, nowIso } = require('../utils/id');

class LeadsRepository extends BaseRepository {
  constructor() {
    super('leads', { jsonFields: ['tags', 'meta'] });
  }

  create(input) {
    const now = nowIso();
    const row = this.serialize({
      id: ids.lead(),
      name: input.name || null,
      email: input.email ? String(input.email).trim().toLowerCase() : null,
      phone: input.phone || null,
      company: input.company || null,
      title: input.title || null,
      source: input.source || 'manual',
      status: input.status || 'new',
      score: Number(input.score) || 0,
      tags: input.tags || [],
      notes: input.notes || null,
      meta: input.meta || {},
      created_at: now,
      updated_at: now,
    });

    this.db.prepare(`
      INSERT INTO leads (id, name, email, phone, company, title, source, status, score, tags, notes, meta, created_at, updated_at)
      VALUES (@id, @name, @email, @phone, @company, @title, @source, @status, @score, @tags, @notes, @meta, @created_at, @updated_at)
    `).run(row);

    return this.findById(row.id);
  }

  /** Dedupe key for CSV / n8n ingest. Email first, phone as fallback. */
  findByEmailOrPhone({ email, phone }) {
    if (email) {
      const hit = this.db.prepare('SELECT * FROM leads WHERE email = ?').get(String(email).trim().toLowerCase());
      if (hit) return this.hydrate(hit);
    }
    if (phone) {
      const hit = this.db.prepare('SELECT * FROM leads WHERE phone = ?').get(phone);
      if (hit) return this.hydrate(hit);
    }
    return null;
  }

  /** Insert, or merge into the existing lead. Returns { lead, created }. */
  upsert(input) {
    const existing = this.findByEmailOrPhone(input);
    if (!existing) return { lead: this.create(input), created: true };

    const patch = {};
    for (const f of ['name', 'phone', 'email', 'company', 'title', 'notes']) {
      if (!existing[f] && input[f]) patch[f] = input[f];
    }
    const lead = Object.keys(patch).length ? this.update(existing.id, patch) : existing;
    return { lead, created: false };
  }

  /**
   * Filtered list. `filter` is the same shape a campaign stores in audience_filter,
   * so the campaign engine and the leads table share one code path.
   */
  search({ q, status, source, tag, limit = 100, offset = 0 } = {}) {
    const where = [];
    const params = {};

    if (q) {
      where.push('(LOWER(COALESCE(name,\'\')) LIKE @q OR LOWER(COALESCE(email,\'\')) LIKE @q OR LOWER(COALESCE(company,\'\')) LIKE @q)');
      params.q = `%${String(q).toLowerCase()}%`;
    }
    if (status) { where.push('status = @status'); params.status = status; }
    if (source) { where.push('source = @source'); params.source = source; }
    if (tag)    { where.push('tags LIKE @tag');   params.tag = `%"${tag}"%`; }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM leads ${whereSql} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset });

    const total = this.db.prepare(`SELECT COUNT(*) AS n FROM leads ${whereSql}`).get(params).n;
    return { items: this.hydrateAll(rows), total };
  }

  countByStatus() {
    return this.db.prepare('SELECT status, COUNT(*) AS n FROM leads GROUP BY status').all();
  }

  /** Leads created per day, for the dashboard chart. */
  countByDay(days = 14) {
    return this.db.prepare(`
      SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n
      FROM leads
      WHERE created_at >= date('now', ?)
      GROUP BY day ORDER BY day ASC
    `).all(`-${days} days`);
  }
}

module.exports = new LeadsRepository();
