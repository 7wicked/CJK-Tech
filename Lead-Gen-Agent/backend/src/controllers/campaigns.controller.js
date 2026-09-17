'use strict';

const { campaigns: campaignsRepo } = require('../../../database');
const campaignEngine = require('../services/campaignEngine');
const templateEngine = require('../services/templateEngine');
const { assertCampaign } = require('../utils/validate');
const { notFound, badRequest } = require('../utils/httpError');

async function list(req, res) {
  res.json({ ok: true, items: campaignsRepo.listWithStats() });
}

async function get(req, res) {
  const campaign = campaignsRepo.findById(req.params.id);
  if (!campaign) throw notFound('Campaign not found');
  res.json({
    ok: true,
    campaign,
    tokens: templateEngine.extractTokens(`${campaign.subject || ''} ${campaign.body}`),
    audienceSize: campaignEngine.resolveAudience(campaign).length,
  });
}

async function create(req, res) {
  assertCampaign(req.body);
  res.status(201).json({ ok: true, campaign: campaignsRepo.create(req.body) });
}

async function update(req, res) {
  const existing = campaignsRepo.findById(req.params.id);
  if (!existing) throw notFound('Campaign not found');

  const allowed = ['name', 'channel_key', 'status', 'subject', 'body', 'audience_filter', 'daily_cap'];
  const patch = {};
  for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];

  res.json({ ok: true, campaign: campaignsRepo.update(existing.id, patch) });
}

async function remove(req, res) {
  if (!campaignsRepo.remove(req.params.id)) throw notFound('Campaign not found');
  res.json({ ok: true });
}

/** Rendered samples, no writes, no sends. */
async function preview(req, res) {
  res.json({ ok: true, samples: campaignEngine.preview(req.params.id, Number(req.query.count) || 3) });
}

/** Pull everyone matching the audience filter into campaign_leads. */
async function syncAudience(req, res) {
  res.json({ ok: true, ...campaignEngine.syncAudience(req.params.id) });
}

/**
 * Send one batch. Called by the Run button, or by an n8n Cron/Schedule node
 * pointed at this same URL.
 */
async function run(req, res) {
  const result = await campaignEngine.run(req.params.id, { batchSize: Number(req.body?.batchSize) || undefined });
  res.json({ ok: true, ...result });
}

async function setStatus(req, res) {
  const { status } = req.body || {};
  if (!['draft', 'running', 'paused', 'done'].includes(status)) throw badRequest('Unknown campaign status');
  const campaign = campaignsRepo.findById(req.params.id);
  if (!campaign) throw notFound('Campaign not found');
  res.json({ ok: true, campaign: campaignsRepo.update(campaign.id, { status }) });
}

module.exports = { list, get, create, update, remove, preview, syncAudience, run, setStatus };
