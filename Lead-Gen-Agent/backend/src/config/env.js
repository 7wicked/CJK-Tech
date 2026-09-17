'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const bool = (v, fallback = false) => {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,

  dbFile: process.env.DB_FILE || path.join(__dirname, '../../../database/data/leadgen.db'),

  /**
   * DRY_RUN is the switch that lets this thing run before anything is connected.
   * true  -> channels log a fake send and return a fake provider id
   * false -> channels hand the payload to n8n
   */
  dryRun: bool(process.env.DRY_RUN, true),

  n8n: {
    // Outbound: we POST here, n8n does the actual sending.
    baseWebhookUrl: process.env.N8N_WEBHOOK_URL || '',
    // Per-channel override; falls back to `${baseWebhookUrl}/${channelKey}`.
    email: process.env.N8N_WEBHOOK_EMAIL || '',
    sms: process.env.N8N_WEBHOOK_SMS || '',
    whatsapp: process.env.N8N_WEBHOOK_WHATSAPP || '',
    // Inbound: n8n must send this in the x-webhook-secret header.
    inboundSecret: process.env.N8N_INBOUND_SECRET || '',
    timeoutMs: Number(process.env.N8N_TIMEOUT_MS) || 10000,
  },

  campaign: {
    defaultDailyCap: Number(process.env.DEFAULT_DAILY_CAP) || 50,
    batchSize: Number(process.env.CAMPAIGN_BATCH_SIZE) || 25,
  },

  logLevel: process.env.LOG_LEVEL || 'info',
};

module.exports = env;
