'use strict';

const n8n = require('../n8n');
const { isPhone } = require('../../utils/validate');

module.exports = {
  key: 'whatsapp',
  label: 'WhatsApp',
  supportsSubject: false,

  validate(lead) {
    if (!lead.phone) return { ok: false, reason: 'Lead has no phone number' };
    if (!isPhone(lead.phone)) return { ok: false, reason: 'Phone number is not valid' };
    return { ok: true };
  },

  async send({ lead, body, config = {}, campaignId = null }) {
    const check = this.validate(lead);
    if (!check.ok) return { ok: false, error: check.reason };

    return n8n.dispatch('whatsapp', {
      channel: 'whatsapp',
      to: String(lead.phone).replace(/[^\d+]/g, ''),
      from: config.senderNumber || null,
      // WhatsApp Business needs an approved template for first contact.
      // Put its name in the channel config and n8n can pass it through.
      templateName: config.templateName || null,
      body,
      lead: { id: lead.id, name: lead.name },
      campaignId,
    });
  },
};
