'use strict';

const { channels: channelsRepo, messages: messagesRepo } = require('../../../database');
const channelRegistry = require('../services/channels/channelRegistry');
const n8n = require('../services/n8n');
const { notFound, badRequest, unauthorized } = require('../utils/httpError');
const env = require('../config/env');
const logger = require('../utils/logger');

async function list(req, res) {
  const rows = channelsRepo.list();
  const capabilities = Object.fromEntries(channelRegistry.list().map((c) => [c.key, c]));
  res.json({
    ok: true,
    items: rows.map((r) => ({ ...r, enabled: Boolean(r.enabled), capabilities: capabilities[r.key] || null })),
    n8n: n8n.status(),
  });
}

async function update(req, res) {
  const { key } = req.params;
  if (!channelsRepo.findByKey(key)) throw notFound('Channel not found');

  if (req.body.enabled !== undefined) channelsRepo.setEnabled(key, Boolean(req.body.enabled));
  if (req.body.config) channelsRepo.saveConfig(key, req.body.config);

  res.json({ ok: true, channel: channelsRepo.findByKey(key) });
}

/** Fire a throwaway message so you can confirm the wiring end to end. */
async function test(req, res) {
  const { key } = req.params;
  const { to } = req.body || {};
  if (!to) throw badRequest('Give a test address or number');

  const fakeLead = { id: 'test', name: 'Test Lead', email: to.includes('@') ? to : null, phone: to.includes('@') ? null : to, company: 'Test Co' };
  const result = await channelRegistry.send(key, {
    lead: fakeLead,
    subject: 'Test from your lead gen agent',
    body: 'If you are reading this, the channel is wired up correctly.',
  });

  res.json({ ok: result.ok, error: result.error || null, dryRun: Boolean(result.dryRun), providerMessageId: result.providerMessageId || null });
}

/**
 * Inbound webhook: n8n tells us what happened to a message.
 * Body: { providerMessageId, status, error? }
 */
async function deliveryWebhook(req, res) {
  if (env.n8n.inboundSecret && req.get('x-webhook-secret') !== env.n8n.inboundSecret) {
    throw unauthorized('Webhook secret did not match');
  }

  const { providerMessageId, status, error } = req.body || {};
  if (!providerMessageId || !status) throw badRequest('Send providerMessageId and status');
  if (!['sent', 'delivered', 'failed', 'replied'].includes(status)) throw badRequest(`Unknown status "${status}"`);

  messagesRepo.updateStatusByProviderId(providerMessageId, status, error || null);
  logger.info(`n8n delivery update: ${providerMessageId} -> ${status}`);
  res.json({ ok: true });
}

async function n8nStatus(req, res) {
  res.json({ ok: true, ...n8n.status() });
}

module.exports = { list, update, test, deliveryWebhook, n8nStatus };
