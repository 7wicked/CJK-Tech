import { api } from './api.js';
import { el, fmtDate, notify } from './toast.js';

const STAGES = [
  { key: 'new',        label: 'New',        color: '#98989f' },
  { key: 'contacted',  label: 'Contacted',  color: '#0a84ff' },
  { key: 'replied',    label: 'Replied',    color: '#bf5af2' },
  { key: 'qualified',  label: 'Qualified',  color: '#ff9f0a' },
  { key: 'won',        label: 'Won',        color: '#30d158' },
];

function renderPipeline(byStatus) {
  const chart = document.getElementById('pipelineBar');
  const key = document.getElementById('pipelineKey');
  chart.innerHTML = '';
  key.innerHTML = '';
  chart.className = 'donut-row';

  const counts = STAGES.map((s) => ({ ...s, n: byStatus[s.key] || 0 }));
  const total = counts.reduce((a, b) => a + b.n, 0);

  if (!total) {
    chart.append(
      el('div', { class: 'donut', style: 'background:#2c2c2e' },
        el('div', { class: 'donut-hole' }, el('span', { class: 'n' }, '0'), el('span', { class: 'l' }, 'leads'))),
    );
    key.append(el('div', { class: 'legend-row' }, el('span', { class: 'label' }, 'No leads yet. Import a CSV or add one by hand to get going.')));
    return;
  }

  // Build the conic-gradient stops for the donut ring.
  let angle = 0;
  const stops = [];
  for (const stage of counts) {
    if (!stage.n) continue;
    const start = angle;
    angle += (stage.n / total) * 360;
    stops.push(`${stage.color} ${start}deg ${angle}deg`);
  }

  chart.append(
    el('div', { class: 'donut', style: `background: conic-gradient(${stops.join(', ')})` },
      el('div', { class: 'donut-hole' },
        el('span', { class: 'n' }, total),
        el('span', { class: 'l' }, 'leads'))),
  );

  for (const stage of counts) {
    key.append(el('div', { class: 'legend-row' },
      el('span', { class: 'swatch', style: `background:${stage.color}` }),
      el('span', { class: 'label' }, stage.label),
      el('span', { class: 'n' }, stage.n),
    ));
  }
}

function statCard(value, label, sub) {
  return el('div', { class: 'card stat' },
    el('span', { class: 'v' }, value),
    el('span', { class: 'k' }, label),
    sub ? el('div', { class: 'trend' }, sub) : null,
  );
}

function renderChannelStats(rows) {
  const host = document.getElementById('channelStats');
  host.innerHTML = '';

  if (!rows.length) {
    host.append(el('div', { class: 'empty' }, el('strong', {}, 'Nothing sent yet'), 'Run a campaign and delivery numbers land here.'));
    return;
  }

  const table = el('table', {},
    el('thead', {}, el('tr', {}, el('th', {}, 'Channel'), el('th', {}, 'Messages'), el('th', {}, 'Delivered'), el('th', {}, 'Replied'))),
    el('tbody', {}, rows.map((r) => el('tr', {},
      el('td', {}, el('span', { class: 'chan', 'data-channel': r.channel_key }, r.channel_key)),
      el('td', {}, r.n),
      el('td', {}, r.delivered || 0),
      el('td', {}, r.replied || 0),
    ))),
  );
  host.append(table);
}

function renderRecent(rows) {
  const host = document.getElementById('recentMessages');
  host.innerHTML = '';

  if (!rows.length) {
    host.append(el('div', { class: 'empty' }, el('strong', {}, 'No activity yet'), 'Messages show up here the moment a campaign runs.'));
    return;
  }

  host.append(el('table', {},
    el('tbody', {}, rows.map((m) => el('tr', {},
      el('td', {}, el('strong', {}, m.lead_name || m.lead_email || 'Unknown lead'),
        el('span', { class: 'secondary' }, m.subject || (m.body || '').slice(0, 60))),
      el('td', {}, el('span', { class: 'chan', 'data-channel': m.channel_key }, m.channel_key)),
      el('td', {}, el('span', { class: 'pill', 'data-status': m.status }, m.status)),
      el('td', { class: 'secondary' }, fmtDate(m.created_at)),
    ))),
  ));
}

export async function renderDashboard() {
  try {
    const d = await api.dashboard();

    renderPipeline(d.leadsByStatus || {});

    const cards = document.getElementById('statCards');
    cards.innerHTML = '';
    cards.append(
      statCard(d.totals.leads, 'Leads in the system'),
      statCard(d.totals.messagesSent, 'Messages sent', d.totals.messagesFailed ? `${d.totals.messagesFailed} failed` : null),
      statCard(`${d.totals.replyRate}%`, 'Reply rate'),
      statCard(d.activeCampaigns, 'Campaigns running'),
    );

    renderChannelStats(d.channels || []);
    renderRecent(d.recentMessages || []);

    return d;
  } catch (err) {
    notify.err(err);
    return null;
  }
}
