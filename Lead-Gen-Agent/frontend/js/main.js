// Hash router + per-view page headers and actions.

import { api } from './api.js';
import { el, initOverlays, notify } from './toast.js';
import { renderDashboard } from './dashboard.js';
import { renderLeads, initLeadFilters, openAddLeadModal, importCsv, exportCsv } from './leads.js';
import { renderCampaigns, openCampaignEditor } from './campaigns.js';
import { renderChannels } from './channels.js';

const VIEWS = {
  dashboard: {
    title: 'Dashboard',
    sub: 'What your outreach has done so far',
    render: renderDashboard,
    actions: () => [el('button', { onclick: () => location.hash = '#/campaigns' }, 'Go to campaigns')],
  },
  leads: {
    title: 'Leads',
    sub: 'Everyone in the system, wherever they came from',
    render: renderLeads,
    actions: () => [
      el('button', { onclick: exportCsv }, 'Export CSV'),
      ' ',
      el('button', { onclick: importCsv }, 'Import CSV'),
      ' ',
      el('button', { class: 'primary', onclick: openAddLeadModal }, 'Add lead'),
    ],
  },
  campaigns: {
    title: 'Campaigns',
    sub: 'A message, an audience, and a send button',
    render: renderCampaigns,
    actions: () => [el('button', { class: 'primary', onclick: () => openCampaignEditor() }, 'New campaign')],
  },
  channels: {
    title: 'Channels',
    sub: 'How messages actually go out, and how n8n plugs in',
    render: renderChannels,
    actions: () => [],
  },
};

function currentView() {
  const key = (location.hash || '#/dashboard').replace('#/', '');
  return VIEWS[key] ? key : 'dashboard';
}

async function route() {
  const key = currentView();
  const view = VIEWS[key];

  for (const name of Object.keys(VIEWS)) {
    document.getElementById(`view-${name}`).hidden = name !== key;
  }
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === key));

  document.getElementById('pageTitle').textContent = view.title;
  document.getElementById('pageSub').textContent = view.sub;

  const actions = document.getElementById('pageActions');
  actions.innerHTML = '';
  actions.append(...view.actions());

  await view.render();
}

async function showMode() {
  const badge = document.getElementById('modeBadge');
  const note = document.getElementById('modeNote');
  try {
    const { n8n } = await api.channels.list();
    badge.innerHTML = '';
    badge.append(el('span', { class: `mode-pill ${n8n.dryRun ? '' : 'live'}` }, n8n.dryRun ? 'Dry run' : 'Live'));
    note.textContent = n8n.dryRun
      ? 'Nothing is actually sending'
      : n8n.configured ? 'Sending through n8n' : 'No n8n webhook set';
  } catch {
    badge.innerHTML = '';
    badge.append(el('span', { class: 'mode-pill' }, 'Offline'));
    note.textContent = 'The server is not responding';
  }
}

function init() {
  initOverlays();
  initLeadFilters();
  window.addEventListener('hashchange', route);
  route().catch((err) => notify.err(err));
  showMode();
  setInterval(showMode, 30000);
}

document.addEventListener('DOMContentLoaded', init);
