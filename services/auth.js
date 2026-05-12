import { setAuthToken, clearAuthToken } from './store.js';
import { showNotif } from './ui.js';

const API_BASE = 'http://localhost:3000/api';

export async function doLogin() {
  const usuario  = document.getElementById('l-user').value.trim();
  const password = document.getElementById('l-pass').value.trim();
  const errEl    = document.getElementById('login-error');
  const spinEl   = document.getElementById('login-spinner');
  const btn      = document.getElementById('login-btn');

  errEl.style.display = 'none';
  btn.disabled = true;
  spinEl.style.display = 'block';

  try {
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error de autenticación');

    setAuthToken(data.token);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    // Importamos init dinámicamente para evitar dependencias circulares
    const { initApp } = await import('./app.js');
    initApp();
  } catch (e) {
    errEl.textContent = e.message || 'Usuario o contraseña incorrectos.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    spinEl.style.display = 'none';
  }
}

export function doLogout() {
  clearAuthToken();
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('l-pass').value = '';
}