const API = process.env.REACT_APP_API_URL || '';

async function req(url, opts = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { ...opts, headers });
  let data;
  try { data = await r.json(); } catch { data = {}; }
  if (r.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user_email');
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('Session expirée');
  }
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

export const api = {
  get:    (path)       => req(`${API}${path}`),
  post:   (path, body) => req(`${API}${path}`, { method: 'POST',   headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }),
  put:    (path, body) => req(`${API}${path}`, { method: 'PUT',    headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }),
  delete: (path)       => req(`${API}${path}`, { method: 'DELETE' }),
};
