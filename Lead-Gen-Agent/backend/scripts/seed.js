'use strict';

/**
 * Drops a handful of fake leads and one campaign in, so the dashboard has
 * something to show the first time you open it. Safe to re-run — the lead
 * upsert dedupes on email.
 *
 *   npm run seed
 */
const env = require('../src/config/env');
const { db, leads, campaigns } = require('../../database');

db.connect(env.dbFile);

const SAMPLE_LEADS = [
  { name: 'Anita Rao',      email: 'anita@northwindlabs.in',  phone: '+919000000001', company: 'Northwind Labs',  title: 'Head of Growth',   source: 'csv',    tags: ['saas', 'warm'] },
  { name: 'Rahul Menon',    email: 'rahul@brightpath.co',     phone: '+919000000002', company: 'Brightpath',      title: 'Founder',          source: 'n8n',    tags: ['saas'] },
  { name: 'Sara Iqbal',     email: 'sara@quayside.io',        phone: '+919000000003', company: 'Quayside',        title: 'Marketing Lead',   source: 'csv',    tags: ['agency'] },
  { name: 'Dev Patel',      email: 'dev@stackhouse.dev',      phone: '+919000000004', company: 'Stackhouse',      title: 'CTO',              source: 'manual', tags: ['dev-tools', 'warm'] },
  { name: 'Meera Shah',     email: 'meera@clovercare.health', phone: '+919000000005', company: 'Clovercare',      title: 'Ops Director',     source: 'csv',    tags: ['healthcare'] },
  { name: 'Joel Fernandes', email: 'joel@tidalworks.com',     phone: '+919000000006', company: 'Tidalworks',      title: 'Sales Manager',    source: 'n8n',    tags: ['agency'] },
];

let created = 0;
for (const row of SAMPLE_LEADS) {
  if (leads.upsert(row).created) created += 1;
}

const existing = campaigns.listWithStats();
if (!existing.length) {
  campaigns.create({
    name: 'Cold intro — SaaS founders',
    channel_key: 'email',
    subject: 'Quick question about {{company}}',
    body: 'Hi {{first_name|there}},\n\nI came across {{company}} and had one question about how you handle inbound leads right now.\n\nWorth a 10 minute call this week?\n\n— {{sender_name|Your Name}}',
    audience_filter: { status: 'new' },
    daily_cap: 25,
  });
}

console.log(`Seeded ${created} new leads. Open http://localhost:${env.port}`);
db.close();
