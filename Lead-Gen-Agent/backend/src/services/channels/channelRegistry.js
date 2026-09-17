'use strict';

const emailChannel = require('./emailChannel');
const smsChannel = require('./smsChannel');
const whatsappChannel = require('./whatsappChannel');
const { channels: channelsRepo } = require('../../../../database');
const { badRequest } = require('../../utils/httpError');

const registry = new Map([
  [emailChannel.key, emailChannel],
  [smsChannel.key, smsChannel],
  [whatsappChannel.key, whatsappChannel],
]);

function get(key) {
  const channel = registry.get(key);
  if (!channel) throw badRequest(`Unknown channel "${key}"`);
  return channel;
}

function list() {
  return [...registry.values()].map((c) => ({ key: c.key, label: c.label, supportsSubject: c.supportsSubject }));
}

/** Registry entry + whatever the DB row says about it (enabled flag, config). */
function resolve(key) {
  const channel = get(key);
  const row = channelsRepo.findByKey(key);
  return { channel, row, config: row?.config || {}, enabled: row ? Boolean(row.enabled) : true };
}

/** One call site for every outbound send, whoever is asking. */
async function send(key, { lead, subject, body, campaignId = null }) {
  const { channel, config, enabled } = resolve(key);
  if (!enabled) return { ok: false, error: `${channel.label} is switched off` };
  return channel.send({ lead, subject, body, config, campaignId });
}

module.exports = { get, list, resolve, send, registry };
