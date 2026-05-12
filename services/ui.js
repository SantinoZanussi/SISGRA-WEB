// ─── Notificaciones ──────────────────────────────────────────────────────────
export function showNotif(msg, type = 'success') {
  const n = document.getElementById('save-notif');
  n.className = `save-notif ${type}`;
  n.textContent = msg;
  n.classList.add('show');
  clearTimeout(n._t);
  n._t = setTimeout(() => n.classList.remove('show'), 3500);
}

// ─── Valor de input / textarea / checkbox ────────────────────────────────────
export function setVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = !!val;
  else el.value = val ?? '';
}

export function getVal(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  if (el.type === 'checkbox') return el.checked;
  return el.value;
}

// ─── Modales ─────────────────────────────────────────────────────────────────
export function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}