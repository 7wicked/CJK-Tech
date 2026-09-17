import { api } from './api.js';
import { el, notify, openModal } from './toast.js';

const FIELDS = {
  email: [
    { key: 'fromName', label: 'Sender name', placeholder: 'Your Name' },
    { key: 'fromAddress', label: 'From address', placeholder: 'you@example.com' },
  ],
  sms: [
    { key: 'senderId', label: 'Sender ID', placeholder: 'LEADGEN' },
  ],
  whatsapp: [
    { key: 'senderNumber', label: 'Sender number', placeholder: '+91 00000 00000' },
    { key: 'templateName', label: 'Approved template name', placeholder: 'intro_message_v1' },
  ],
};

export async function renderChannels() {
  const host = document.getElementById('channelCards');
  const statusHost = document.getElementById('n8nStatus');

  try {
    const { items, n8n } = await api.channels.list();

    statusHost.innerHTML = '';
    statusHost.append(
      el('div', { class: 'field', style: 'margin-top:12px' },
        el('label', {}, 'n8n posts delivery updates back to'),
        el('div', { class: 'code' }, `${window.location.origin}/api/channels/webhooks/n8n/delivery`)),
      el('div', { class: 'field' },
        el('label', {}, 'n8n pushes new leads to'),
        el('div', { class: 'code' }, `${window.location.origin}/api/leads/ingest`)),
      el('div', { class: 'field' },
        el('label', {}, 'A Cron node can trigger a batch at'),
        el('div', { class: 'code' }, `${window.location.origin}/api/campaigns/:campaignId/run`)),
      n8n.inboundSecretSet
        ? el('p', { class: 'sub' }, 'Inbound webhooks must carry your secret in the x-webhook-secret header.')
        : el('p', { class: 'sub' }, 'No inbound secret set. Anyone who can reach this server can post to those webhooks.'),
    );

    host.innerHTML = '';
    for (const ch of items) {
      const toggle = el('input', {
        type: 'checkbox',
        ...(ch.enabled ? { checked: 'checked' } : {}),
        onchange: async (e) => {
          try {
            await api.channels.update(ch.key, { enabled: e.target.checked });
            notify.ok(`${ch.label} ${e.target.checked ? 'switched on' : 'switched off'}`);
          } catch (err) { notify.err(err); e.target.checked = !e.target.checked; }
        },
      });

      const config = ch.config || {};
      const summary = (FIELDS[ch.key] || [])
        .map((f) => config[f.key])
        .filter(Boolean)
        .join(' · ') || 'Not configured yet';

      host.append(el('div', { class: 'card' },
        el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:8px' },
          el('h2', {}, el('span', { class: 'chan', 'data-channel': ch.key }, ch.label)),
          el('div', { style: 'flex:1' }),
          el('label', { class: 'switch' }, toggle)),
        el('p', { class: 'sub', style: 'color:var(--muted);font-size:13px' }, summary),
        el('div', { style: 'display:flex;gap:8px;margin-top:12px' },
          el('button', { class: 'small', onclick: () => openConfig(ch) }, 'Settings'),
          el('button', { class: 'small', onclick: () => openTest(ch) }, 'Send a test')),
      ));
    }
  } catch (err) { notify.err(err); }
}

function openConfig(ch) {
  const inputs = {};
  const form = el('div', {}, (FIELDS[ch.key] || []).map((f) => {
    inputs[f.key] = el('input', { value: (ch.config || {})[f.key] || '', placeholder: f.placeholder });
    return el('div', { class: 'field' }, el('label', {}, f.label), inputs[f.key]);
  }));

  openModal({
    title: `${ch.label} settings`,
    body: form,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      {
        label: 'Save settings',
        kind: 'primary',
        onClick: async ({ close }) => {
          const config = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim()]));
          try {
            await api.channels.update(ch.key, { config });
            notify.ok('Settings saved');
            close();
            renderChannels();
          } catch (err) { notify.err(err); }
        },
      },
    ],
  });
}

function openTest(ch) {
  const to = el('input', { placeholder: ch.key === 'email' ? 'you@example.com' : '+91 00000 00000' });
  openModal({
    title: `Test ${ch.label}`,
    body: el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'Send to'), to),
      el('p', { class: 'sub' }, 'Sends one throwaway message so you can confirm the wiring. In dry run it only writes to the server log.')),
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      {
        label: 'Send test',
        kind: 'primary',
        onClick: async ({ close, button }) => {
          button.disabled = true;
          try {
            const res = await api.channels.test(ch.key, to.value.trim());
            notify.ok(res.dryRun ? 'Dry run: check the server console' : 'Test sent');
            close();
          } catch (err) { notify.err(err); button.disabled = false; }
        },
      },
    ],
  });
}
