'use strict';

const { badRequest } = require('./httpError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s\-()]{6,17}$/;

function isEmail(v) { return typeof v === 'string' && EMAIL_RE.test(v.trim()); }
function isPhone(v) { return typeof v === 'string' && PHONE_RE.test(v.trim()); }

/** Every lead needs at least one way to reach it. */
function assertLead(body) {
  const errors = [];
  if (!body || typeof body !== 'object') throw badRequest('Request body must be an object');
  if (!body.email && !body.phone) errors.push('Add an email address or a phone number');
  if (body.email && !isEmail(body.email)) errors.push('Email address is not valid');
  if (body.phone && !isPhone(body.phone)) errors.push('Phone number is not valid');
  if (errors.length) throw badRequest('This lead could not be saved', errors);
}

function assertCampaign(body) {
  const errors = [];
  if (!body?.name?.trim()) errors.push('Give the campaign a name');
  if (!body?.body?.trim()) errors.push('Write the message body');
  if (!['email', 'sms', 'whatsapp'].includes(body?.channel_key)) errors.push('Pick a channel');
  if (body?.channel_key === 'email' && !body?.subject?.trim()) errors.push('Email campaigns need a subject line');
  if (errors.length) throw badRequest('This campaign could not be saved', errors);
}

/** Keeps `?limit=99999` from dragging the whole table into memory. */
function paginate(query) {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 500);
  const page = Math.max(Number(query.page) || 1, 1);
  return { limit, offset: (page - 1) * limit, page };
}

module.exports = { isEmail, isPhone, assertLead, assertCampaign, paginate };
