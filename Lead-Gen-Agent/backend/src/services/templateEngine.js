'use strict';

/**
 * {{placeholder}} rendering with fallbacks: {{name|there}}.
 * Deliberately tiny — no eval, no expressions, nothing a lead's data can escape.
 */

const TOKEN_RE = /\{\{\s*([\w.]+)\s*(?:\|\s*([^}]*?))?\s*\}\}/g;

/** Flattens a lead into the variables a template can reach. */
function buildContext(lead = {}, extra = {}) {
  const firstName = (lead.name || '').trim().split(/\s+/)[0] || '';
  return {
    name: lead.name || '',
    first_name: firstName,
    email: lead.email || '',
    phone: lead.phone || '',
    company: lead.company || '',
    title: lead.title || '',
    ...(lead.meta && typeof lead.meta === 'object' ? lead.meta : {}),
    ...extra,
  };
}

function render(template, context = {}) {
  if (!template) return '';
  return String(template).replace(TOKEN_RE, (_match, key, fallback) => {
    const value = key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), context);
    if (value === undefined || value === null || value === '') return fallback !== undefined ? fallback.trim() : '';
    return String(value);
  });
}

/** Which tokens does this template use? Used by the campaign editor preview. */
function extractTokens(template) {
  const found = new Set();
  for (const m of String(template || '').matchAll(TOKEN_RE)) found.add(m[1]);
  return [...found];
}

/** Tokens with no value and no fallback — warn before a send goes out blank. */
function findMissing(template, context) {
  return extractTokens(template).filter((t) => {
    const v = t.split('.').reduce((acc, p) => (acc == null ? acc : acc[p]), context);
    return v === undefined || v === null || v === '';
  });
}

function renderCampaign(campaign, lead, extra = {}) {
  const ctx = buildContext(lead, extra);
  return {
    subject: render(campaign.subject, ctx),
    body: render(campaign.body, ctx),
    missing: findMissing(`${campaign.subject || ''} ${campaign.body || ''}`, ctx),
  };
}

module.exports = { render, buildContext, extractTokens, findMissing, renderCampaign };
