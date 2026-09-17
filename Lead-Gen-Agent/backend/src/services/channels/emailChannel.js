'use strict';

const n8n = require('../n8n');
const { isEmail } = require('../../utils/validate');

/**
 * Every channel implements the same three things:
 *   key, validate(lead) -> { ok, reason }, send({ lead, subject, body, config })
 * Add a channel by copying this file and registering it in channelRegistry.js.
 */
module.exports = {
  key: 'email',
  label: 'Email',
  supportsSubject: true,

  validate(lead) {
    if (!lead.email) return { ok: false, reason: 'Lead has no email address' };
    if (!isEmail(lead.email)) return { ok: false, reason: 'Email address is not valid' };
    return { ok: true };
  },

  async send({ lead, subject, body, config = {}, campaignId = null }) {
    const check = this.validate(lead);
    if (!check.ok) return { ok: false, error: check.reason };

    // TODO(you): if you ever want to send directly instead of via n8n,
    // swap this dispatch for your SMTP / Resend / SES client.
    return n8n.dispatch('email', {
      channel: 'email',
      to: lead.email,
      from: config.fromAddress || null,
      fromName: config.fromName || null,
      subject,
      body,
      lead: { id: lead.id, name: lead.name, company: lead.company },
      campaignId,
    });
  },
};
