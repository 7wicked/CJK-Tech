'use strict';

const BaseRepository = require('./baseRepository');
const { ids, nowIso } = require('../utils/id');

class MessagesRepository extends BaseRepository {
  constructor() {
    super('messages');
  }

  create(input) {
    const now = nowIso();
    const row = {
      id: ids.message(),
      lead_id: input.lead_id,
      campaign_id: input.campaign_id || null,
      channel_key: input.channel_key,
      direction: input.direction || 'outbound',
      status: input.status || 'queued',
      subject: input.subject || null,
      body: input.body || null,
      provider_message_id: input.provider_message_id || null,
      error: input.error || null,
      created_at: now,
      updated_at: now,
    };

    this.db.prepare(`
      INSERT INTO messages (id, lead_id, campaign_id, channel_key, direction, status, subject, body, provider_message_id, error, created_at, updated_at)
      VALUES (@id, @lead_id, @campaign_id, @channel_key, @direction, @status, @subject, @body, @provider_message_id, @error, @created_at, @updated_at)
    `).run(row);

    return this.findById(row.id);
  }

  listForLead(leadId) {
    return this.hydrateAll(
      this.db.prepare('SELECT * FROM messages WHERE lead_id = ? ORDER BY created_at ASC').all(leadId),
    );
  }

  recent(limit = 25) {
    return this.hydrateAll(this.db.prepare(`
      SELECT m.*, l.name AS lead_name, l.email AS lead_email
      FROM messages m LEFT JOIN leads l ON l.id = m.lead_id
      ORDER BY m.created_at DESC LIMIT ?
    `).all(limit));
  }

  /** Called by the n8n delivery webhook. Matches on our id or the provider's. */
  updateStatusByProviderId(providerMessageId, status, error = null) {
    this.db.prepare(`
      UPDATE messages SET status = ?, error = ?, updated_at = ?
      WHERE provider_message_id = ? OR id = ?
    `).run(status, error, nowIso(), providerMessageId, providerMessageId);
  }

  countByStatus() {
    return this.db.prepare('SELECT status, COUNT(*) AS n FROM messages GROUP BY status').all();
  }

  countByChannel() {
    return this.db.prepare(`
      SELECT channel_key, COUNT(*) AS n,
             SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END) AS delivered,
             SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) AS replied
      FROM messages GROUP BY channel_key
    `).all();
  }
}

module.exports = new MessagesRepository();
