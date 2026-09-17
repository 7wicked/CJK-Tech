// Toasts, modal and drawer plumbing. Shared by every view.

const host = () => document.getElementById('toasts');

export function toast(message, kind = 'info', ms = 3600) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  host().appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export const notify = {
  ok: (m) => toast(m, 'success'),
  err: (e) => toast(typeof e === 'string' ? e : [e.message, ...(e.details || [])].join(' — '), 'error', 6000),
  info: (m) => toast(m),
};

/** Modal: pass a body node and an array of { label, kind, onClick }. */
export function openModal({ title, body, actions = [] }) {
  document.getElementById('modalTitle').textContent = title;
  const bodyEl = document.getElementById('modalBody');
  bodyEl.innerHTML = '';
  bodyEl.append(body);

  const foot = document.getElementById('modalFoot');
  foot.innerHTML = '';
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.textContent = a.label;
    if (a.kind) btn.className = a.kind;
    btn.onclick = () => a.onClick({ close: closeModal, button: btn });
    foot.appendChild(btn);
  }
  document.getElementById('modal').hidden = false;
}

export function closeModal() { document.getElementById('modal').hidden = true; }

export function openDrawer(title, node) {
  document.getElementById('leadDrawerTitle').textContent = title;
  const body = document.getElementById('leadDrawerBody');
  body.innerHTML = '';
  body.append(node);
  document.getElementById('leadDrawer').hidden = false;
}

export function closeDrawer() { document.getElementById('leadDrawer').hidden = true; }

/** Tiny DOM helper so views can build markup without template-string soup. */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' +
         d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Wire the close buttons once. */
export function initOverlays() {
  document.querySelectorAll('[data-close-modal]').forEach((b) => b.addEventListener('click', closeModal));
  document.querySelectorAll('[data-close-drawer]').forEach((b) => b.addEventListener('click', closeDrawer));
  for (const id of ['modal', 'leadDrawer']) {
    const scrim = document.getElementById(id);
    scrim.addEventListener('click', (e) => { if (e.target === scrim) scrim.hidden = true; });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeDrawer(); }
  });
}
