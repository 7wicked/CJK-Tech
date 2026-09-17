'use strict';

const n8n = require('../n8n');
const { isPhone } = require('../../utils/validate');

const MAX_LEN = 480; // ~3 concatenated segments

module.exports = {
  key: 'sms',
  label: 'SMS',
  supportsSubject: false,

  validate(lead) {
    if (!lead.phone) return { ok: false, reason: 'Lead has no phone number' };
    if (!isPhone(lead.phone)) return { ok: false, reason: 'Phone number is not valid' };
    return { ok: true };
  },

  async send({ lead, body, config = {}, campaignId = null }) {
    const check = this.validate(lead);
    if (!check.ok) return { ok: false, error: check.reason };
    if (body && body.length > MAX_LEN) {
      return { ok: false, error: `Message is ${body.length} characters; SMS caps at ${MAX_LEN}` };
    }

    return n8n.dispatch('sms', {
      channel: 'sms',
      to: lead.phone,
      senderId: config.senderId || null,
      body,
      lead: { id: lead.id, name: lead.name },
      campaignId,
    });
  },
};
