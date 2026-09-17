'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Outbound half of the n8n integration.
 *
 * Every channel eventually calls dispatch(). In DRY_RUN we never touch the
 * network — we log the payload and hand back a fake provider id, so the whole
 * app is testable before a single workflow exists.
 */

function webhookFor(channelKey) {
  const override = env.n8n[channelKey];
  if (override) return override;
  if (env.n8n.baseWebhookUrl) return `${env.n8n.baseWebhookUrl.replace(/\/$/, '')}/${channelKey}`;
  return '';
}

async function dispatch(channelKey, payload) {
  const url = webhookFor(channelKey);

  if (env.dryRun || !url) {
    logger.info(`[dry-run] ${channelKey} -> ${payload.to}`, { subject: payload.subject, preview: (payload.body || '').slice(0, 60) });
    return { ok: true, dryRun: true, providerMessageId: `dry_${Date.now()}_${Math.floor(Math.random() * 1e4)}` };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.n8n.timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.n8n.inboundSecret ? { 'x-webhook-secret': env.n8n.inboundSecret } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

    if (!res.ok) return { ok: false, error: `n8n responded ${res.status}: ${text.slice(0, 200)}` };

    return { ok: true, providerMessageId: data.providerMessageId || data.messageId || null, data };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'n8n webhook timed out' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

function status() {
  return {
    dryRun: env.dryRun,
    configured: Boolean(env.n8n.baseWebhookUrl || env.n8n.email || env.n8n.sms || env.n8n.whatsapp),
    inboundSecretSet: Boolean(env.n8n.inboundSecret),
    webhooks: {
      email: webhookFor('email') || null,
      sms: webhookFor('sms') || null,
      whatsapp: webhookFor('whatsapp') || null,
    },
  };
}

module.exports = { dispatch, webhookFor, status };
