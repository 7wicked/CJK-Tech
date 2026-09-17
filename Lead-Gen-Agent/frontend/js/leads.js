import { api } from './api.js';
import { el, fmtDate, notify, openModal, closeModal, openDrawer, closeDrawer } from './toast.js';
import { pickCsvFile, leadsToCsv, downloadCsv } from './csv.js';

const state = { q: '', status: '', source: '', items: [], total: 0 };
let debounce;

const STATUSES = ['new', 'contacted', 'replied', 'qualified', 'won', 'lost', 'unsubscribed'];

export async function renderLeads() {
  const rows = document.getElementById('leadRows');
  const empty = document.getElementById('leadEmpty');

  try {
    const res = await api.leads.list({ q: state.q, status: state.status, source: state.source, limit: 200 });
    state.items = res.items;
    state.total = res.total;

    document.getElementById('leadCount').textContent = `${res.total} lead${res.total === 1 ? '' : 's'}`;
    rows.innerHTML = '';
    empty.innerHTML = '';

    if (!res.items.length) {
      empty.append(el('div', { class: 'empty' },
        el('strong', {}, state.q || state.status ? 'Nothing matches those filters' : 'No leads yet'),
        state.q || state.status ? 'Clear the search and try again.' : 'Import a CSV or add your first lead to get started.',
      ));
      return;
    }

    for (const lead of res.items) {
      rows.append(el('tr', { class: 'clickable', onclick: () => openLead(lead.id) },
        el('td', {}, el('strong', {}, lead.name || 'Unnamed'), el('span', { class: 'secondary' }, lead.email || lead.phone || '')),
        el('td', {}, lead.company || '', lead.title ? el('span', { class: 'secondary' }, lead.title) : null),
        el('td', {}, el('span', { class: 'pill', 'data-status': lead.status }, lead.status)),
        el('td', { class: 'secondary' }, lead.source || ''),
        el('td', {}, (lead.tags || []).map((t) => el('span', { class: 'tag' }, t))),
        el('td', { class: 'secondary' }, fmtDate(lead.created_at)),
      ));
    }
  } catch (err) {
    notify.err(err);
  }
}

/* ---------------- detail drawer ---------------- */

async function openLead(id) {
  try {
    const { lead, messages } = await api.leads.get(id);
    openDrawer(lead.name || lead.email || 'Lead', leadDetail(lead, messages));
  } catch (err) {
    notify.err(err);
  }
}

function leadDetail(lead, messages) {
  const field = (label, value, key, type = 'text') => el('div', { class: 'field' },
    el('label', {}, label),
    el('input', { type, value: value || '', 'data-key': key }),
  );

  const form = el('div', {},
    el('div', { class: 'row' }, field('Name', lead.name, 'name'), field('Company', lead.company, 'company')),
    el('div', { class: 'row' }, field('Email', lead.email, 'email', 'email'), field('Phone', lead.phone, 'phone')),
    el('div', { class: 'row' },
      field('Job title', lead.title, 'title'),
      el('div', { class: 'field' },
        el('label', {}, 'Status'),
        el('select', { 'data-key': 'status' }, STATUSES.map((s) => el('option', { value: s, ...(s === lead.status ? { selected: 'selected' } : {}) }, s))),
      ),
    ),
    el('div', { class: 'field' }, el('label', {}, 'Notes'), el('textarea', { 'data-key': 'notes', style: 'min-height:80px' }, lead.notes || '')),
  );

  const save = el('button', {
    class: 'primary',
    onclick: async () => {
      const patch = {};
      form.querySelectorAll('[data-key]').forEach((input) => { patch[input.dataset.key] = input.value; });
      try {
        await api.leads.update(lead.id, patch);
        notify.ok('Lead saved');
        closeDrawer();
        renderLeads();
      } catch (err) { notify.err(err); }
    },
  }, 'Save changes');

  const message = el('button', { onclick: () => openSendModal(lead) }, 'Send a message');

  const remove = el('button', {
    class: 'danger',
    onclick: async () => {
      if (!confirm('Delete this lead and its message history?')) return;
      try {
        await api.leads.remove(lead.id);
        notify.ok('Lead deleted');
        closeDrawer();
        renderLeads();
      } catch (err) { notify.err(err); }
    },
  }, 'Delete');

  const history = el('div', { style: 'margin-top:24px' },
    el('h3', { style: 'margin-bottom:10px' }, `History (${messages.length})`),
    messages.length
      ? el('div', { class: 'timeline' }, messages.map((m) => el('div', { class: 'timeline-item' },
          el('div', { class: 'when' }, fmtDate(m.created_at), ' · ', el('span', { class: 'chan', 'data-channel': m.channel_key }, m.channel_key), ' · ',
            el('span', { class: 'pill', 'data-status': m.status }, m.status)),
          m.subject ? el('strong', {}, m.subject) : null,
          el('div', { class: 'msg' }, m.body || ''),
          m.error ? el('div', { class: 'preview-block missing' }, m.error) : null,
        )))
      : el('p', { class: 'sub' }, 'Nothing sent to this lead yet.'),
  );

  return el('div', {},
    form,
    el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, save, message, remove),
    history,
  );
}

/* ---------------- one-off send ---------------- */

function openSendModal(lead) {
  const channel = el('select', {},
    el('option', { value: 'email' }, 'Email'),
    el('option', { value: 'sms' }, 'SMS'),
    el('option', { value: 'whatsapp' }, 'WhatsApp'),
  );
  const subject = el('input', { placeholder: 'Quick question about {{company}}' });
  const body = el('textarea', {}, `Hi {{first_name|there}},\n\n`);

  const form = el('div', {},
    el('div', { class: 'field' }, el('label', {}, 'Channel'), channel),
    el('div', { class: 'field' }, el('label', {}, 'Subject'), subject, el('div', { class: 'hint' }, 'Email only. Ignored on SMS and WhatsApp.')),
    el('div', { class: 'field' }, el('label', {}, 'Message'), body,
      el('div', { class: 'hint' }, 'Placeholders: {{name}}, {{first_name}}, {{company}}, {{title}}. Add a fallback with {{first_name|there}}.')),
  );

  openModal({
    title: `Message ${lead.name || lead.email}`,
    body: form,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      {
        label: 'Send message',
        kind: 'primary',
        onClick: async ({ close, button }) => {
          button.disabled = true;
          try {
            const res = await api.leads.message(lead.id, { channel_key: channel.value, subject: subject.value, body: body.value });
            notify.ok(res.dryRun ? 'Queued in dry run — nothing actually left the building' : 'Message sent');
            close();
            closeDrawer();
            renderLeads();
          } catch (err) {
            notify.err(err);
            button.disabled = false;
          }
        },
      },
    ],
  });
}

/* ---------------- add + import + export ---------------- */

export function openAddLeadModal() {
  const inputs = {};
  const field = (label, key, placeholder = '', type = 'text') => {
    inputs[key] = el('input', { type, placeholder });
    return el('div', { class: 'field' }, el('label', {}, label), inputs[key]);
  };

  const form = el('div', {},
    el('div', { class: 'row' }, field('Name', 'name', 'Anita Rao'), field('Company', 'company', 'Northwind Labs')),
    el('div', { class: 'row' }, field('Email', 'email', 'anita@northwind.in', 'email'), field('Phone', 'phone', '+91 90000 00001')),
    field('Job title', 'title', 'Head of Growth'),
    el('div', { class: 'field' }, el('label', {}, 'Tags'), (inputs.tags = el('input', { placeholder: 'saas, warm' })),
      el('div', { class: 'hint' }, 'Separate with commas. Campaigns can target a single tag.')),
  );

  openModal({
    title: 'Add a lead',
    body: form,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      {
        label: 'Add lead',
        kind: 'primary',
        onClick: async ({ close, button }) => {
          button.disabled = true;
          const payload = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim()]));
          payload.tags = payload.tags ? payload.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
          payload.source = 'manual';
          try {
            const res = await api.leads.create(payload);
            notify.ok(res.created ? 'Lead added' : 'Merged into an existing lead');
            close();
            renderLeads();
          } catch (err) {
            notify.err(err);
            button.disabled = false;
          }
        },
      },
    ],
  });
}

export async function importCsv() {
  const parsed = await pickCsvFile();
  if (!parsed) return;
  if (!parsed.leads.length) return notify.err('That file had no rows we could read');

  const sample = parsed.leads.slice(0, 3);
  const body = el('div', {},
    el('p', {}, `${parsed.leads.length} rows found in ${parsed.filename}.`),
    parsed.unmapped.length
      ? el('p', { class: 'sub' }, `Kept as extra fields: ${parsed.unmapped.join(', ')}`)
      : null,
    el('h3', { style: 'margin:14px 0 8px' }, 'First few rows'),
    ...sample.map((l) => el('div', { class: 'preview-block' },
      el('div', { class: 'subject' }, l.name || 'Unnamed'),
      el('div', { class: 'to' }, [l.email, l.phone, l.company].filter(Boolean).join(' · ')),
    )),
  );

  openModal({
    title: 'Import leads',
    body,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      {
        label: `Import ${parsed.leads.length} leads`,
        kind: 'primary',
        onClick: async ({ close, button }) => {
          button.disabled = true;
          try {
            const res = await api.leads.import(parsed.leads);
            notify.ok(`${res.created} added, ${res.merged} merged, ${res.skipped.length} skipped`);
            close();
            renderLeads();
          } catch (err) {
            notify.err(err);
            button.disabled = false;
          }
        },
      },
    ],
  });
}

export async function exportCsv() {
  try {
    const res = await api.leads.list({ q: state.q, status: state.status, source: state.source, limit: 500 });
    if (!res.items.length) return notify.info('No leads to export');
    downloadCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, leadsToCsv(res.items));
    notify.ok(`Exported ${res.items.length} leads`);
  } catch (err) { notify.err(err); }
}

/** Called once by main.js. */
export function initLeadFilters() {
  document.getElementById('leadSearch').addEventListener('input', (e) => {
    state.q = e.target.value;
    clearTimeout(debounce);
    debounce = setTimeout(renderLeads, 250);
  });
  document.getElementById('leadStatusFilter').addEventListener('change', (e) => { state.status = e.target.value; renderLeads(); });
  document.getElementById('leadSourceFilter').addEventListener('change', (e) => { state.source = e.target.value; renderLeads(); });
}
