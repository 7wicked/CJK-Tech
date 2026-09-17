import { api } from './api.js';
import { el, fmtDate, notify, openModal } from './toast.js';

const CHANNELS = [
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

export async function renderCampaigns() {
  const rows = document.getElementById('campaignRows');
  const empty = document.getElementById('campaignEmpty');

  try {
    const { items } = await api.campaigns.list();
    rows.innerHTML = '';
    empty.innerHTML = '';

    if (!items.length) {
      empty.append(el('div', { class: 'empty' },
        el('strong', {}, 'No campaigns yet'),
        'A campaign is a message plus the audience it goes to. Create one to start sending.',
      ));
      return;
    }

    for (const c of items) {
      rows.append(el('tr', {},
        el('td', { class: 'clickable', onclick: () => openCampaignEditor(c) },
          el('strong', {}, c.name), el('span', { class: 'secondary' }, `Created ${fmtDate(c.created_at)}`)),
        el('td', {}, el('span', { class: 'chan', 'data-channel': c.channel_key }, c.channel_key)),
        el('td', {}, el('span', { class: 'pill', 'data-status': c.status }, c.status)),
        el('td', {}, c.enrolled),
        el('td', {}, c.sent),
        el('td', {}, c.replied),
        el('td', {}, c.failed ? el('span', { class: 'pill', 'data-status': 'failed' }, c.failed) : '0'),
        el('td', { style: 'text-align:right;white-space:nowrap' },
          el('button', { class: 'small', onclick: () => previewCampaign(c) }, 'Preview'),
          ' ',
          el('button', { class: 'small primary', onclick: (e) => runCampaign(c, e.target) }, 'Run batch'),
        ),
      ));
    }
  } catch (err) { notify.err(err); }
}

/* ---------------- editor ---------------- */

export function openCampaignEditor(existing = null) {
  const name = el('input', { value: existing?.name || '', placeholder: 'Cold intro — SaaS founders' });
  const channel = el('select', {}, CHANNELS.map((c) =>
    el('option', { value: c.key, ...(existing?.channel_key === c.key ? { selected: 'selected' } : {}) }, c.label)));
  const subject = el('input', { value: existing?.subject || '', placeholder: 'Quick question about {{company}}' });
  const body = el('textarea', {}, existing?.body || 'Hi {{first_name|there}},\n\n');
  const cap = el('input', { type: 'number', min: '1', value: existing?.daily_cap || 50 });

  const filterStatus = el('select', {},
    el('option', { value: '' }, 'Any status'),
    ...['new', 'contacted', 'replied', 'qualified'].map((s) =>
      el('option', { value: s, ...(existing?.audience_filter?.status === s ? { selected: 'selected' } : {}) }, s)));
  const filterTag = el('input', { value: existing?.audience_filter?.tag || '', placeholder: 'warm' });

  const subjectField = el('div', { class: 'field' }, el('label', {}, 'Subject'), subject);
  const syncSubject = () => { subjectField.style.display = channel.value === 'email' ? '' : 'none'; };
  channel.addEventListener('change', syncSubject);

  const form = el('div', {},
    el('div', { class: 'row' },
      el('div', { class: 'field' }, el('label', {}, 'Campaign name'), name),
      el('div', { class: 'field' }, el('label', {}, 'Channel'), channel)),
    subjectField,
    el('div', { class: 'field' }, el('label', {}, 'Message'), body,
      el('div', { class: 'hint' }, 'Placeholders: {{name}}, {{first_name}}, {{company}}, {{title}}. Fallbacks look like {{first_name|there}}.')),
    el('h3', { style: 'margin:18px 0 10px' }, 'Who gets this'),
    el('div', { class: 'row' },
      el('div', { class: 'field' }, el('label', {}, 'Lead status'), filterStatus),
      el('div', { class: 'field' }, el('label', {}, 'Tag'), filterTag)),
    el('div', { class: 'field' }, el('label', {}, 'Leads per batch'), cap,
      el('div', { class: 'hint' }, 'One "Run batch" sends at most this many. Point an n8n Cron node at the run endpoint to keep it going.')),
  );
  setTimeout(syncSubject);

  openModal({
    title: existing ? 'Edit campaign' : 'New campaign',
    body: form,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      existing && {
        label: existing.status === 'paused' ? 'Resume' : 'Pause',
        onClick: async ({ close }) => {
          try {
            await api.campaigns.setStatus(existing.id, existing.status === 'paused' ? 'running' : 'paused');
            notify.ok(existing.status === 'paused' ? 'Campaign resumed' : 'Campaign paused');
            close();
            renderCampaigns();
          } catch (err) { notify.err(err); }
        },
      },
      {
        label: existing ? 'Save campaign' : 'Create campaign',
        kind: 'primary',
        onClick: async ({ close, button }) => {
          button.disabled = true;
          const payload = {
            name: name.value.trim(),
            channel_key: channel.value,
            subject: channel.value === 'email' ? subject.value.trim() : null,
            body: body.value,
            daily_cap: Number(cap.value) || 50,
            audience_filter: { status: filterStatus.value || undefined, tag: filterTag.value.trim() || undefined },
          };
          try {
            const res = existing ? await api.campaigns.update(existing.id, payload) : await api.campaigns.create(payload);
            const id = res.campaign.id;
            const sync = await api.campaigns.syncAudience(id);
            notify.ok(`Saved. ${sync.matched} leads match, ${sync.added} newly enrolled.`);
            close();
            renderCampaigns();
          } catch (err) {
            notify.err(err);
            button.disabled = false;
          }
        },
      },
    ].filter(Boolean),
  });
}

/* ---------------- preview + run ---------------- */

async function previewCampaign(campaign) {
  try {
    await api.campaigns.syncAudience(campaign.id);
    const { samples } = await api.campaigns.preview(campaign.id, 3);

    const body = samples.length
      ? el('div', {}, samples.map((s) => el('div', { class: 'preview-block' },
          el('div', { class: 'to' }, `To ${s.lead.email || s.lead.phone} · ${s.lead.company || ''}`),
          s.subject ? el('div', { class: 'subject' }, s.subject) : null,
          el('div', { class: 'body' }, s.body),
          s.missing.length ? el('div', { class: 'missing' }, `Blank placeholders: ${s.missing.join(', ')}`) : null,
        )))
      : el('div', { class: 'empty' },
          el('strong', {}, 'Nobody matches this audience'),
          'Loosen the filters, or check the leads have the contact details this channel needs.');

    openModal({ title: `Preview: ${campaign.name}`, body, actions: [{ label: 'Close', onClick: ({ close }) => close() }] });
  } catch (err) { notify.err(err); }
}

async function runCampaign(campaign, button) {
  button.disabled = true;
  button.textContent = 'Running';
  try {
    await api.campaigns.syncAudience(campaign.id);
    const res = await api.campaigns.run(campaign.id);
    if (res.note) notify.info(res.note);
    else notify.ok(`${res.sent} sent, ${res.failed} failed`);

    if (res.failed) {
      const failures = res.results.filter((r) => !r.ok);
      openModal({
        title: 'Some messages did not send',
        body: el('div', {}, failures.map((f) => el('div', { class: 'preview-block' },
          el('div', { class: 'subject' }, f.to || f.leadId),
          el('div', { class: 'missing' }, f.error)))),
        actions: [{ label: 'Close', onClick: ({ close }) => close() }],
      });
    }
    renderCampaigns();
  } catch (err) {
    notify.err(err);
  } finally {
    button.disabled = false;
    button.textContent = 'Run batch';
  }
}
