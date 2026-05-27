import { authToken, API_BASE } from './store.js';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };
}

async function parseError(r, label) {
  const data = await r.json().catch(() => ({}));
  throw new Error(data.error || `${label} → ${r.status}`);
}

export async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) await parseError(r, `GET ${path}`);
  return r.json();
}

export async function apiPut(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) await parseError(r, `PUT ${path}`);
  return r.json();
}

export async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) await parseError(r, `POST ${path}`);
  return r.json();
}

export async function apiPatch(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) await parseError(r, `PATCH ${path}`);
  return r.json();
}

export async function apiDelete(path) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${authToken}` },
  });
  if (!r.ok) await parseError(r, `DELETE ${path}`);
  return r.json();
}
