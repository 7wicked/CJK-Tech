'use strict';

const { leads: leadsRepo, messages: messagesRepo } = require('../../../database');
const { assertLead, paginate } = require('../utils/validate');
const { notFound, badRequest } = require('../utils/httpError');
const campaignEngine = require('../services/campaignEngine');
const logger = require('../utils/logger');

async function list(req, res) {
  const { limit, offset, page } = paginate(req.query);
  const { q, status, source, tag } = req.query;
  const { items, total } = leadsRepo.search({ q, status, source, tag, limit, offset });
  res.json({ ok: true, items, total, page, limit });
}

async function get(req, res) {
  const lead = leadsRepo.findById(req.params.id);
  if (!lead) throw notFound('Lead not found');
  res.json({ ok: true, lead, messages: messagesRepo.listForLead(lead.id) });
}

async function create(req, res) {
  assertLead(req.body);
  const { lead, created } = leadsRepo.upsert(req.body);
  res.status(created ? 201 : 200).json({ ok: true, lead, created });
}

async function update(req, res) {
  const existing = leadsRepo.findById(req.params.id);
  if (!existing) throw notFound('Lead not found');

  const allowed = ['name', 'email', 'phone', 'company', 'title', 'status', 'score', 'tags', 'notes', 'source'];
  const patch = {};
  for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];

  res.json({ ok: true, lead: leadsRepo.update(existing.id, patch) });
}

async function remove(req, res) {
  if (!leadsRepo.remove(req.params.id)) throw notFound('Lead not found');
  res.json({ ok: true });
}

/**
 * Bulk import. Same endpoint serves the CSV upload in the UI and an n8n
 * HTTP Request node — both just POST { leads: [...] }.
 */
async function bulkImport(req, res) {
  const rows = Array.isArray(req.body) ? req.body : req.body?.leads;
  if (!Array.isArray(rows) || !rows.length) throw badRequest('Send a non-empty array of leads');

  const summary = { received: rows.length, created: 0, merged: 0, skipped: [] };

  for (const [i, row] of rows.entries()) {
    try {
      assertLead(row);
      const { created } = leadsRepo.upsert({ ...row, source: row.source || 'csv' });
      created ? (summary.created += 1) : (summary.merged += 1);
    } catch (err) {
      summary.skipped.push({ row: i + 1, reason: err.details?.[0] || err.message });
    }
  }

  logger.info(`Import: ${summary.created} new, ${summary.merged} merged, ${summary.skipped.length} skipped`);
  res.json({ ok: true, ...summary });
}

/** Inbound webhook — n8n drops a single scraped/enriched lead here. */
async function ingestFromN8n(req, res) {
  const payload = req.body || {};
  assertLead(payload);
  const { lead, created } = leadsRepo.upsert({ ...payload, source: payload.source || 'n8n' });
  res.status(created ? 201 : 200).json({ ok: true, leadId: lead.id, created });
}

/** "Message this lead" — one-off send outside any campaign. */
async function sendMessage(req, res) {
  const { channel_key: channelKey, subject, body } = req.body || {};
  if (!channelKey) throw badRequest('Pick a channel');
  if (!body?.trim()) throw badRequest('Write a message first');

  const result = await campaignEngine.sendOne({ leadId: req.params.id, channelKey, subject, body });
  if (!result.ok) throw badRequest(result.error || 'The message could not be sent');
  res.json({ ok: true, message: result.message, dryRun: Boolean(result.dryRun) });
}

module.exports = { list, get, create, update, remove, bulkImport, ingestFromN8n, sendMessage };
