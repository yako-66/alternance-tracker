const API = '';

export const api = {
  get: (path) => fetch(path).then(r => r.json()),
  post: (path, body) => fetch(path, {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
  }).then(r => r.json()),
  put: (path, body) => fetch(path, {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
  }).then(r => r.json()),
  delete: (path) => fetch(path, { method: 'DELETE' }).then(r => r.json()),
};