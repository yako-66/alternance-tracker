const API = process.env.REACT_APP_API_URL || '';

async function req(url, opts = {}) {
  const r = await fetch(url, { ...opts });
  let data;
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

const CACHE_KEY = 'api_cache_v2';

function getCached(path) {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')[path] ?? null; } catch { return null; }
}

function setCache(path, data) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    store[path] = data;
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

export const api = {
  get:    async (path) => { const d = await req(`${API}${path}`); setCache(path, d); return d; },
  getCached,
  post:   (path, body) => req(`${API}${path}`, { method: 'POST',   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  put:    (path, body) => req(`${API}${path}`, { method: 'PUT',    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  patch:  (path, body) => req(`${API}${path}`, { method: 'PATCH',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  delete: (path)       => req(`${API}${path}`, { method: 'DELETE' }),
};
