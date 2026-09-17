// Every network call in the app goes through here, so error shape is uniform.

const BASE = '/api';

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }

  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.details = data.details;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/health'),

  dashboard: () => request('/dashboard'),

  leads: {
    list: (params = {}) => {
      const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
      return request(`/leads?${q}`);
    },
    get: (id) => request(`/leads/${id}`),
    create: (lead) => request('/leads', { method: 'POST', body: lead }),
    update: (id, patch) => request(`/leads/${id}`, { method: 'PATCH', body: patch }),
    remove: (id) => request(`/leads/${id}`, { method: 'DELETE' }),
    import: (leads) => request('/leads/import', { method: 'POST', body: { leads } }),
    message: (id, payload) => request(`/leads/${id}/messages`, { method: 'POST', body: payload }),
  },

  campaigns: {
    list: () => request('/campaigns'),
    get: (id) => request(`/campaigns/${id}`),
    create: (c) => request('/campaigns', { method: 'POST', body: c }),
    update: (id, patch) => request(`/campaigns/${id}`, { method: 'PATCH', body: patch }),
    remove: (id) => request(`/campaigns/${id}`, { method: 'DELETE' }),
    preview: (id, count = 3) => request(`/campaigns/${id}/preview?count=${count}`),
    syncAudience: (id) => request(`/campaigns/${id}/audience`, { method: 'POST' }),
    run: (id, batchSize) => request(`/campaigns/${id}/run`, { method: 'POST', body: { batchSize } }),
    setStatus: (id, status) => request(`/campaigns/${id}/status`, { method: 'POST', body: { status } }),
  },

  channels: {
    list: () => request('/channels'),
    update: (key, patch) => request(`/channels/${key}`, { method: 'PATCH', body: patch }),
    test: (key, to) => request(`/channels/${key}/test`, { method: 'POST', body: { to } }),
  },
};
