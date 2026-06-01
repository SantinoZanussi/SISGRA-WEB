// Sección "Imágenes" del panel admin.
// CRUD de assets: subir, renombrar (cambia la ruta), bloquear/desbloquear y eliminar.
// Autocontenido: maneja su propio panel y navegación para no depender de panel.js.

import { apiGet, apiPatch, apiDelete } from '../api.js';
import { authToken, API_BASE } from '../store.js';

const notif = (msg, type = 'success') =>
  window.__svc?.showNotif?.(msg, type) ?? console.log('[assets]', msg);

const escAttr = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

let assets = [];

// ─── Navegación: mostrar el panel de imágenes ───────────────────────
function showAssetsPanel() {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.sidebar-tpl-item').forEach(i => i.classList.remove('active'));

  document.getElementById('panel-assets')?.classList.add('active');
  document.querySelector('.sidebar-item[data-panel="assets"]')?.classList.add('active');

  const title = document.getElementById('topbar-title');
  if (title) title.textContent = 'Imágenes';

  const ca = document.querySelector('.content-area');
  if (ca) { ca.style.padding = '2rem'; ca.style.overflow = 'auto'; }

  loadAssets();
}

// ─── Carga + render ─────────────────────────────────────────────────
async function loadAssets() {
  const grid = document.getElementById('assets-grid');
  if (grid) grid.innerHTML = '<div style="grid-column:1/-1;padding:2rem;text-align:center;color:var(--slate-400);font-size:.8rem;">Cargando…</div>';
  try {
    const res = await apiGet('/assets');
    assets = res.assets || [];
    renderAssets();
  } catch (e) {
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1;padding:2rem;text-align:center;color:#dc2626;font-size:.8rem;">Error al cargar imágenes: ${escAttr(e.message)}</div>`;
  }
}

function renderAssets() {
  const grid = document.getElementById('assets-grid');
  if (!grid) return;

  if (!assets.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:3rem 2rem;text-align:center;color:var(--slate-400);border:2px dashed var(--slate-200);border-radius:.5rem;">
      <i class="fa-solid fa-images" style="font-size:2rem;opacity:.3;display:block;margin-bottom:.75rem;"></i>
      Todavía no subiste ninguna imagen.<br>
      <small style="font-size:.7rem;">Usá el botón "Subir imagen" o arrastrá archivos acá.</small>
    </div>`;
    return;
  }

  grid.innerHTML = assets.map(a => `
    <div class="asset-card" style="border:3px solid var(--slate-200);border-radius:.5rem;overflow:hidden;background:#fff;display:flex;flex-direction:column;">
      <div data-act="view" data-id="${a.id}" title="Ver en grande" style="position:relative;aspect-ratio:16/10;background:repeating-conic-gradient(#f1f5f9 0% 25%, #fff 0% 50%) 50% / 16px 16px;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:zoom-in;">
        <img src="${escAttr(a.path)}" alt="${escAttr(a.nombre)}" style="max-width:100%;max-height:100%;object-fit:contain;" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<span style=\\'color:#94a3b8;font-size:.7rem;\\'>sin vista previa</span>')"/>
        ${a.locked ? '<span title="Bloqueada" style="position:absolute;top:.4rem;right:.4rem;background:#fbbf24;color:#78350f;font-size:.55rem;font-weight:900;letter-spacing:.05em;padding:.15rem .4rem;border-radius:.25rem;"><i class="fa-solid fa-lock"></i> BLOQUEADA</span>' : ''}
      </div>
      <div style="padding:.6rem;display:flex;flex-direction:column;gap:.45rem;flex:1;">
        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;">
          <span style="font-weight:700;font-size:.78rem;color:var(--slate-800);word-break:break-word;">${escAttr(a.nombre)}</span>
          ${a.origen === 'existente' ? '<span title="Detectada en la carpeta /img" style="font-size:.5rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;background:var(--slate-100);color:var(--slate-500);padding:.15rem .35rem;border-radius:.25rem;">NATIVO</span>' : ''}
        </div>
        <div style="display:flex;gap:1rem;align-items:center;">
          <code style="flex:1;font-size:.65rem;background:var(--slate-50);border:1px solid var(--slate-200);padding:.25rem .4rem;border-radius:.25rem;color:var(--slate-600);word-break:break-all;font-family:'IBM Plex Mono',monospace;">${escAttr(a.path)}</code>
          <button class="btn-edit-small" data-act="copy" data-id="${a.id}" title="Copiar ruta" style="flex-shrink:0;"><i class="fa-solid fa-copy"></i></button>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:auto;">
          <button class="btn-edit-small" data-act="rename" data-id="${a.id}" ${a.locked ? 'disabled style="opacity:.4;cursor:not-allowed;"' : ''}><i class="fa-solid fa-pen"></i> Renombrar</button>
          <button class="btn-edit-small" data-act="lock" data-id="${a.id}">${a.locked ? '<i class="fa-solid fa-lock-open"></i> Desbloquear' : '<i class="fa-solid fa-lock"></i> Bloquear'}</button>
          <button class="btn-edit-small" data-act="delete" data-id="${a.id}" ${a.locked ? 'disabled style="opacity:.4;cursor:not-allowed;"' : 'style="color:#dc2626;border-color:#fca5a5;"'}><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>`).join('');

  grid.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.act, btn.dataset.id));
  });
}

// ─── Acciones ───────────────────────────────────────────────────────
async function handleAction(act, id) {
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  if (act === 'view') {
    openLightbox(asset);
    return;
  }

  if (act === 'copy') {
    copyToClipboard(asset.path);
    notif('✓ Ruta copiada: ' + asset.path);
    return;
  }

  if (act === 'rename') {
    if (asset.locked) return;
    const nuevo = prompt('Nuevo nombre para la imagen (cambia su ruta):', asset.nombre);
    if (nuevo === null) return;
    const nombre = nuevo.trim();
    if (!nombre || nombre === asset.nombre) return;
    try {
      const { asset: updated } = await apiPatch(`/assets/${id}`, { nombre });
      Object.assign(asset, updated);
      renderAssets();
      notif('✓ Renombrada → ' + updated.path);
    } catch (e) { notif('Error al renombrar: ' + e.message, 'error'); }
    return;
  }

  if (act === 'lock') {
    try {
      const { asset: updated } = await apiPatch(`/assets/${id}/lock`);
      Object.assign(asset, updated);
      renderAssets();
      notif(updated.locked ? '✓ Imagen bloqueada' : '✓ Imagen desbloqueada');
    } catch (e) { notif('Error: ' + e.message, 'error'); }
    return;
  }

  if (act === 'delete') {
    if (asset.locked) return;
    if (!confirm(`¿Eliminar "${asset.nombre}"?\n\nSe borra el archivo de forma permanente y cualquier página que use ${asset.path} dejará de mostrarlo.`)) return;
    try {
      await apiDelete(`/assets/${id}`);
      assets = assets.filter(a => a.id !== id);
      renderAssets();
      notif('✓ Imagen eliminada');
    } catch (e) { notif('Error al eliminar: ' + e.message, 'error'); }
    return;
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(ta);
}

// ─── Subida ─────────────────────────────────────────────────────────
async function uploadFiles(fileList) {
  const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/'));
  if (!files.length) { notif('Seleccioná archivos de imagen', 'error'); return; }

  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('nombre', file.name.replace(/\.[^.]+$/, ''));
    try {
      const r = await fetch(`${API_BASE}/assets`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: fd,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
      assets.push(data.asset);
    } catch (e) {
      notif(`Error subiendo ${file.name}: ${e.message}`, 'error');
    }
  }
  renderAssets();
  notif('✓ Subida completada');
}

// ─── Lightbox (ver imagen en grande con fondo difuminado) ───────────
function ensureLightbox() {
  if (document.getElementById('assets-lightbox')) return;
  const ov = document.createElement('div');
  ov.id = 'assets-lightbox';
  ov.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999', 'display:none',
    'align-items:center', 'justify-content:center', 'padding:3rem',
    'background:rgba(15,23,42,.55)',
    'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
    'cursor:zoom-out',
  ].join(';');
  ov.innerHTML = `
    <button id="assets-lightbox-close" title="Cerrar (Esc)" style="position:absolute;top:1.25rem;right:1.5rem;width:2.5rem;height:2.5rem;border:none;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">
      <i class="fa-solid fa-xmark"></i>
    </button>
    <figure style="margin:0;display:flex;flex-direction:column;align-items:center;gap:.75rem;cursor:default;">
      <img id="assets-lightbox-img" src="" alt="" style="max-width:90vw;max-height:80vh;object-fit:contain;border-radius:.5rem;box-shadow:0 20px 60px rgba(0,0,0,.5);background:#fff;"/>
      <figcaption style="text-align:center;color:#fff;font-family:'Inter',system-ui,sans-serif;">
        <div id="assets-lightbox-name" style="font-weight:700;font-size:.95rem;"></div>
        <code id="assets-lightbox-path" style="font-size:.7rem;color:rgba(255,255,255,.7);font-family:'IBM Plex Mono',monospace;"></code>
      </figcaption>
    </figure>`;
  document.body.appendChild(ov);

  ov.addEventListener('click', e => { if (e.target === ov) closeLightbox(); });
  ov.querySelector('#assets-lightbox-close').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && ov.style.display === 'flex') closeLightbox();
  });
}

function openLightbox(asset) {
  ensureLightbox();
  const ov = document.getElementById('assets-lightbox');
  ov.querySelector('#assets-lightbox-img').src = asset.path;
  ov.querySelector('#assets-lightbox-img').alt = asset.nombre || '';
  ov.querySelector('#assets-lightbox-name').textContent = asset.nombre || '';
  ov.querySelector('#assets-lightbox-path').textContent = asset.path || '';
  ov.style.display = 'flex';
}

function closeLightbox() {
  const ov = document.getElementById('assets-lightbox');
  if (!ov) return;
  ov.style.display = 'none';
  ov.querySelector('#assets-lightbox-img').src = '';
}

// ─── Init ───────────────────────────────────────────────────────────
function init() {
  document.querySelector('.sidebar-item[data-panel="assets"]')
    ?.addEventListener('click', showAssetsPanel);

  const input = document.getElementById('assets-file-input');
  const btn = document.getElementById('assets-upload-btn');
  const drop = document.getElementById('assets-dropzone');

  btn?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', () => { uploadFiles(input.files); input.value = ''; });

  if (drop) {
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.add('dragover');
      drop.style.borderColor = '#2563eb'; drop.style.background = '#eff6ff';
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.remove('dragover');
      drop.style.borderColor = ''; drop.style.background = '';
    }));
    drop.addEventListener('drop', e => uploadFiles(e.dataTransfer?.files));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
