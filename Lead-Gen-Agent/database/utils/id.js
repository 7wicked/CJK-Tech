'use strict';

const { randomUUID } = require('node:crypto');

/**
 * Prefixed, sortable-ish ids. Prefixes make logs and n8n payloads readable:
 *   lead_8f2c...  camp_1a9b...  msg_44de...
 */
function newId(prefix) {
  const raw = randomUUID().replace(/-/g, '').slice(0, 20);
  return prefix ? `${prefix}_${raw}` : raw;
}

const ids = {
  lead: () => newId('lead'),
  campaign: () => newId('camp'),
  channel: () => newId('chan'),
  message: () => newId('msg'),
  enrollment: () => newId('enr'),
};

function nowIso() {
  return new Date().toISOString();
}

module.exports = { newId, ids, nowIso };
