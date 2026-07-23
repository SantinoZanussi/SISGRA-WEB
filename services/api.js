import { authToken, API_BASE, clearAuthToken } from './store.js';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };
}

// sesión inválida/expirada: limpia el token y vuelve al login. Autocura tokens viejos
// (p.ej. los que quedaron de la época de Node, firmados con otro secret).
export function sessionExpired() {
  clearAuthToken();
  const app = document.getElementById('app');
  const login = document.getElementById('login-screen');
  if (app && login) {
    app.style.display = 'none';
    login.style.display = '';
    const err = document.getElementById('login-error');
    if (err) { err.textContent = 'Tu sesión expiró. Volvé a iniciar sesión.'; err.style.display = 'block'; }
  }
}

async function parseError(r, label) {
  if (r.status === 401) sessionExpired();
  const data = await r.json().catch(() => ({}));
  throw new Error(data.error || `${label} → ${r.status}`);
}

export async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`, { headers: { 'Authorization': `Bearer ${authToken}` } });
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
