<<<<<<< HEAD
import { authToken } from './store.js';

const API_BASE = 'http://192.168.1.61:3000/api';
=======
<<<<<<<< HEAD:services/api_helpers.js
const API_BASE = "http://192.168.1.61:3000/api";
========
import { authToken } from './store.js';

const API_BASE = 'http://localhost:3000/api';
>>>>>>> d6bf022b06fff58891c6a11794c0c1fbd2c4de26

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };
}
<<<<<<< HEAD
=======
>>>>>>>> d6bf022b06fff58891c6a11794c0c1fbd2c4de26:services/api.js
>>>>>>> d6bf022b06fff58891c6a11794c0c1fbd2c4de26

export async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
}

export async function apiPut(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PUT ${path} → ${r.status}`);
  return r.json();
}

export async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}`);
  return r.json();
}

export async function apiPatch(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${path} → ${r.status}`);
  return r.json();
}

export async function apiDelete(path) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${authToken}` },
  });
  if (!r.ok) throw new Error(`DELETE ${path} → ${r.status}`);
  return r.json();
}