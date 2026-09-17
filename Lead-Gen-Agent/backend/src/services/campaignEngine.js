'use strict';

const { leads: leadsRepo, campaigns: campaignsRepo, messages: messagesRepo } = require('../../../database');
const channelRegistry = require('./channels/channelRegistry');
const templateEngine = require('./templateEngine');
const logger = require('../utils/logger');
const env = require('../config/env');
const { notFound, badRequest } = require('../utils/httpError');

/**
 * Turns a campaign + an audience into messages.
 *
 * run() is deliberately synchronous-per-batch and capped. Nothing here schedules
 * itself — either you hit "Run batch" in the UI, or an n8n Cron node calls
 * POST /api/campaigns/:id/run on whatever rhythm you want.
 */

/** Who does this campaign's audience_filter actually match right now? */
function resolveAudience(campaign, { limit = 500 } = {}) {
  const filter = campaign.audience_filter || {};
  const { items } = leadsRepo.search({
    status: filter.status || undefined,
    source: filter.source || undefined,
    tag: filter.tag || undefined,
    limit,
  });

  const channel = channelRegistry.get(campaign.channel_key);
  return items.filter((lead) => {
    if (lead.status === 'unsubscribed') return false;
    return channel.validate(lead).ok;
  });
}

/** Preview the first N rendered messages without sending or writing anything. */
function preview(campaignId, count = 3) {
  const campaign = campaignsRepo.findById(campaignId);
  if (!campaign) throw notFound('Campaign not found');

  return resolveAudience(campaign, { limit: count }).map((lead) => {
    const rendered = templateEngine.renderCampaign(campaign, lead);
    return {
      lead: { id: lead.id, name: lead.name, email: lead.email, phone: lead.phone, company: lead.company },
      ...rendered,
    };
  });
}

/** Enrol everyone the filter matches. Safe to call repeatedly. */
function syncAudience(campaignId) {
  const campaign = campaignsRepo.findById(campaignId);
  if (!campaign) throw notFound('Campaign not found');

  const audience = resolveAudience(campaign);
  const added = campaignsRepo.enroll(campaignId, audience.map((l) => l.id));
  return { matched: audience.length, added };
}

/**
 * Send one batch. Returns a per-lead result list so the UI can show exactly
 * what happened instead of a spinner and a shrug.
 */
async function run(campaignId, { batchSize } = {}) {
  const campaign = campaignsRepo.findById(campaignId);
  if (!campaign) throw notFound('Campaign not found');
  if (campaign.status === 'paused') throw badRequest('Campaign is paused');

  const size = Math.min(batchSize || env.campaign.batchSize, campaign.daily_cap || env.campaign.defaultDailyCap);
  const pending = campaignsRepo.pendingEnrollments(campaignId, size);

  if (!pending.length) {
    campaignsRepo.update(campaignId, { status: 'done' });
    return { campaignId, sent: 0, failed: 0, results: [], note: 'Nobody left to contact in this campaign' };
  }

  if (campaign.status === 'draft') campaignsRepo.update(campaignId, { status: 'running' });

  const results = [];
  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    const { enrollment_id: enrollmentId, ...lead } = row;
    const rendered = templateEngine.renderCampaign(campaign, lead);

    const message = messagesRepo.create({
      lead_id: lead.id,
      campaign_id: campaign.id,
      channel_key: campaign.channel_key,
      subject: rendered.subject,
      body: rendered.body,
      status: 'queued',
    });

    let outcome;
    try {
      outcome = await channelRegistry.send(campaign.channel_key, {
        lead,
        subject: rendered.subject,
        body: rendered.body,
        campaignId: campaign.id,
      });
    } catch (err) {
      outcome = { ok: false, error: err.message };
    }

    if (outcome.ok) {
      sent += 1;
      messagesRepo.update(message.id, { status: 'sent', provider_message_id: outcome.providerMessageId || null });
      campaignsRepo.markEnrollment(enrollmentId, 'sent');
      if (lead.status === 'new') leadsRepo.update(lead.id, { status: 'contacted' });
    } else {
      failed += 1;
      messagesRepo.update(message.id, { status: 'failed', error: outcome.error });
      campaignsRepo.markEnrollment(enrollmentId, 'failed');
    }

    results.push({ leadId: lead.id, to: lead.email || lead.phone, ok: outcome.ok, error: outcome.error || null });
  }

  logger.info(`Campaign ${campaign.name}: ${sent} sent, ${failed} failed`);
  return { campaignId, sent, failed, results };
}

/** One-off send outside any campaign — the "message this lead" button. */
async function sendOne({ leadId, channelKey, subject, body }) {
  const lead = leadsRepo.findById(leadId);
  if (!lead) throw notFound('Lead not found');

  const ctx = templateEngine.buildContext(lead);
  const renderedSubject = templateEngine.render(subject, ctx);
  const renderedBody = templateEngine.render(body, ctx);

  const message = messagesRepo.create({
    lead_id: lead.id,
    channel_key: channelKey,
    subject: renderedSubject,
    body: renderedBody,
    status: 'queued',
  });

  const outcome = await channelRegistry.send(channelKey, { lead, subject: renderedSubject, body: renderedBody });

  messagesRepo.update(message.id, outcome.ok
    ? { status: 'sent', provider_message_id: outcome.providerMessageId || null }
    : { status: 'failed', error: outcome.error });

  if (outcome.ok && lead.status === 'new') leadsRepo.update(lead.id, { status: 'contacted' });

  return { ...outcome, message: messagesRepo.findById(message.id) };
}

module.exports = { resolveAudience, preview, syncAudience, run, sendOne };
