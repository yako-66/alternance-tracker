const API = process.env.REACT_APP_API_URL || '';

async function req(url, opts = {}) {
  const r = await fetch(url, { credentials: 'same-origin', ...opts });
  let data;
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

export const api = {
  get: (path) => req(`${API}${path}`),
  post: (path, body) => req(`${API}${path}`, {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body),
  }),
  put: (path, body) => req(`${API}${path}`, {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body),
  }),
  delete: (path) => req(`${API}${path}`, { method: 'DELETE' }),
};
