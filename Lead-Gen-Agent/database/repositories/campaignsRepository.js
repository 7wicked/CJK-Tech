'use strict';

const BaseRepository = require('./baseRepository');
const { ids, nowIso } = require('../utils/id');

class CampaignsRepository extends BaseRepository {
  constructor() {
    super('campaigns', { jsonFields: ['audience_filter'] });
  }

  create(input) {
    const now = nowIso();
    const row = this.serialize({
      id: ids.campaign(),
      name: input.name,
      channel_key: input.channel_key || 'email',
      status: input.status || 'draft',
      subject: input.subject || null,
      body: input.body || '',
      audience_filter: input.audience_filter || {},
      daily_cap: Number(input.daily_cap) || 50,
      created_at: now,
      updated_at: now,
    });

    this.db.prepare(`
      INSERT INTO campaigns (id, name, channel_key, status, subject, body, audience_filter, daily_cap, created_at, updated_at)
      VALUES (@id, @name, @channel_key, @status, @subject, @body, @audience_filter, @daily_cap, @created_at, @updated_at)
    `).run(row);

    return this.findById(row.id);
  }

  listWithStats() {
    const rows = this.db.prepare(`
      SELECT c.*,
             (SELECT COUNT(*) FROM campaign_leads cl WHERE cl.campaign_id = c.id) AS enrolled,
             (SELECT COUNT(*) FROM messages m WHERE m.campaign_id = c.id AND m.status IN ('sent','delivered')) AS sent,
             (SELECT COUNT(*) FROM messages m WHERE m.campaign_id = c.id AND m.status = 'replied') AS replied,
             (SELECT COUNT(*) FROM messages m WHERE m.campaign_id = c.id AND m.status = 'failed') AS failed
      FROM campaigns c
      ORDER BY c.created_at DESC
    `).all();
    return this.hydrateAll(rows);
  }

  /** Add leads to a campaign. Ignores anyone already enrolled. */
  enroll(campaignId, leadIds) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO campaign_leads (id, campaign_id, lead_id, state, created_at)
      VALUES (?, ?, ?, 'pending', ?)
    `);
    const run = this.db.transaction((list) => {
      let added = 0;
      for (const leadId of list) {
        added += stmt.run(ids.enrollment(), campaignId, leadId, nowIso()).changes;
      }
      return added;
    });
    return run(leadIds);
  }

  pendingEnrollments(campaignId, limit = 50) {
    return this.db.prepare(`
      SELECT cl.id AS enrollment_id, l.*
      FROM campaign_leads cl
      JOIN leads l ON l.id = cl.lead_id
      WHERE cl.campaign_id = ? AND cl.state = 'pending'
      ORDER BY cl.created_at ASC
      LIMIT ?
    `).all(campaignId, limit);
  }

  markEnrollment(enrollmentId, state) {
    this.db.prepare('UPDATE campaign_leads SET state = ? WHERE id = ?').run(state, enrollmentId);
  }
}

module.exports = new CampaignsRepository();
