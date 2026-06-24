// sección "imágenes" del panel: crud de assets (subir, renombrar, bloquear, eliminar)
// autocontenido: maneja su propio panel y navegación, sin depender de panel.js
import { apiGet, apiPost, apiPatch, apiDelete } from '../api.js';
import { authToken, API_BASE } from '../store.js';
import { escAttr, fetchAssets, matchAsset, indexLabels, tagDotsHTML, createFilterBar, GRUPOS, GRUPO_NOMBRES } from './asset-shared.js';

const notif = (msg, type = 'success') =>
  window.__svc?.showNotif?.(msg, type) ?? console.log('[assets]', msg);

let assets = [];
let labels = [];
let labelIndex = {};
let filterBar = null;

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

async function loadAssets() {
  const grid = document.getElementById('assets-grid');
  if (grid) grid.innerHTML = '<div style="grid-column:1/-1;padding:2rem;text-align:center;color:var(--slate-400);font-size:.8rem;">Cargando…</div>';
  try {
    const res = await fetchAssets();
    assets = res.assets;
    labels = res.labels;
    labelIndex = indexLabels(labels);
    filterBar?.render(labels);
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

  const list = filterBar ? assets.filter(a => matchAsset(a, filterBar.getFilters())) : assets;
  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:3rem 2rem;text-align:center;color:var(--slate-400);border:2px dashed var(--slate-200);border-radius:.5rem;">
      <i class="fa-solid fa-magnifying-glass" style="font-size:1.6rem;opacity:.3;display:block;margin-bottom:.6rem;"></i>
      Ninguna imagen coincide con los filtros.</div>`;
    return;
  }

  grid.innerHTML = list.map(a => `
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
        ${tagDotsHTML(a, labelIndex)}
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:auto;">
          <button class="btn-edit-small" data-act="tags" data-id="${a.id}"><i class="fa-solid fa-tags"></i> Etiquetas</button>
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

async function handleAction(act, id) {
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  if (act === 'view') {
    openLightbox(asset);
    return;
  }

  if (act === 'tags') {
    openTagAssign(asset);
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
  ov.style.display = 'flex';
}

function closeLightbox() {
  const ov = document.getElementById('assets-lightbox');
  if (!ov) return;
  ov.style.display = 'none';
  ov.querySelector('#assets-lightbox-img').src = '';
}

function buildOverlay(id, z = 9998) {
  let ov = document.getElementById(id);
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = id;
  ov.style.cssText = `position:fixed;inset:0;z-index:${z};display:none;align-items:center;justify-content:center;padding:2rem;background:rgba(15,23,42,.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.style.display = 'none'; });
  return ov;
}

function gruposConItems() {
  return GRUPOS
    .map(g => ({ ...g, items: labels.filter(l => (l.grupo || 'color') === g.key) }))
    .filter(g => g.items.length);
}

function dot(l) {
  return `<span style="width:.7rem;height:.7rem;border-radius:50%;background:${escAttr(l.color)};display:inline-block;flex-shrink:0;"></span>`;
}

function openTagAssign(asset) {
  const ov = buildOverlay('assets-tag-overlay');
  const checked = new Set(asset.etiquetas || []);
  const grupos = gruposConItems();

  ov.innerHTML = `
    <div style="background:#fff;border-radius:.75rem;width:min(480px,95vw);max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 70px rgba(0,0,0,.4);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--slate-200);">
        <span style="font-weight:800;"><i class="fa-solid fa-tags" style="margin-right:.4rem;color:#2563eb;"></i> Etiquetas de "${escAttr(asset.nombre)}"</span>
        <button type="button" class="modal-close" data-x><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div style="flex:1;overflow:auto;padding:1rem 1.25rem;display:flex;flex-direction:column;gap:.9rem;">
        ${grupos.length ? grupos.map(g => `
          <div>
            <div style="font-size:.55rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--slate-400);margin-bottom:.4rem;">${g.label}</div>
            <div style="display:flex;flex-direction:column;gap:.3rem;">
              ${g.items.map(l => `
                <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.8rem;color:var(--slate-700);">
                  <input type="checkbox" value="${l.id}" ${checked.has(l.id) ? 'checked' : ''}/> ${dot(l)} ${escAttr(l.nombre)}
                </label>`).join('')}
            </div>
          </div>`).join('')
          : '<div style="color:var(--slate-400);font-size:.8rem;">Todavía no hay etiquetas. Creá algunas desde "Gestionar etiquetas".</div>'}
      </div>
      <div style="border-top:1px solid var(--slate-200);padding:.85rem 1.25rem;display:flex;justify-content:space-between;gap:.6rem;background:var(--slate-50);">
        <button type="button" class="btn-secondary" data-manage><i class="fa-solid fa-gear"></i> Gestionar etiquetas</button>
        <div style="display:flex;gap:.6rem;">
          <button type="button" class="btn-secondary" data-x>Cancelar</button>
          <button type="button" class="btn-add" data-save>Guardar</button>
        </div>
      </div>
    </div>`;

  ov.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => { ov.style.display = 'none'; }));
  ov.querySelector('[data-manage]').addEventListener('click', () => { ov.style.display = 'none'; openLabelManager(); });
  ov.querySelector('[data-save]').addEventListener('click', async () => {
    const etiquetas = [...ov.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
    try {
      const { asset: updated } = await apiPatch(`/assets/${asset.id}/tags`, { etiquetas });
      Object.assign(asset, updated);
      ov.style.display = 'none';
      renderAssets();
      notif('✓ Etiquetas actualizadas');
    } catch (e) { notif('Error al guardar etiquetas: ' + e.message, 'error'); }
  });

  ov.style.display = 'flex';
}

function openLabelManager() {
  const ov = buildOverlay('assets-labels-overlay', 9999);
  renderLabelManager(ov);
  ov.style.display = 'flex';
}

function renderLabelManager(ov) {
  const grupos = gruposConItems();
  ov.innerHTML = `
    <div style="background:#fff;border-radius:.75rem;width:min(560px,95vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 70px rgba(0,0,0,.4);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--slate-200);">
        <span style="font-weight:800;"><i class="fa-solid fa-gear" style="margin-right:.4rem;color:#2563eb;"></i> Gestionar etiquetas</span>
        <button type="button" class="modal-close" data-x><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div style="flex:1;overflow:auto;padding:1rem 1.25rem;display:flex;flex-direction:column;gap:1rem;">
        ${grupos.length ? grupos.map(g => `
          <div>
            <div style="font-size:.55rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--slate-400);margin-bottom:.4rem;">${g.label}</div>
            ${g.items.map(l => `
              <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;" data-lbl="${l.id}">
                <input type="color" value="${escAttr(/^#[0-9a-f]{6}$/i.test(l.color) ? l.color : '#64748b')}" data-lc style="width:2rem;height:2rem;border:1px solid var(--slate-200);border-radius:.35rem;padding:0;cursor:pointer;"/>
                <input type="text" value="${escAttr(l.nombre)}" data-ln style="flex:1;padding:.4rem .55rem;border:1px solid var(--slate-200);border-radius:.4rem;font-size:.8rem;"/>
                <button type="button" class="btn-edit-small" data-lsave title="Guardar cambios"><i class="fa-solid fa-check"></i></button>
                <button type="button" class="btn-edit-small" data-ldel title="Eliminar" style="color:#dc2626;border-color:#fca5a5;"><i class="fa-solid fa-trash"></i></button>
              </div>`).join('')}
          </div>`).join('')
          : '<div style="color:var(--slate-400);font-size:.8rem;">Todavía no hay etiquetas.</div>'}
      </div>
      <div style="border-top:1px solid var(--slate-200);padding:.85rem 1.25rem;background:var(--slate-50);display:flex;flex-direction:column;gap:.55rem;">
        <span style="font-size:.55rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--slate-400);">Nueva etiqueta</span>
        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
          <input type="color" value="#3b82f6" data-nc style="width:2rem;height:2rem;border:1px solid var(--slate-200);border-radius:.35rem;padding:0;cursor:pointer;"/>
          <input type="text" placeholder="Nombre" data-nn style="flex:1;min-width:120px;padding:.45rem .55rem;border:1px solid var(--slate-200);border-radius:.4rem;font-size:.8rem;"/>
          <select data-ng style="padding:.45rem .55rem;border:1px solid var(--slate-200);border-radius:.4rem;font-size:.8rem;">
            ${GRUPOS.map(g => `<option value="${g.key}">${g.label}</option>`).join('')}
          </select>
          <button type="button" class="btn-add" data-nadd><i class="fa-solid fa-plus"></i> Crear</button>
        </div>
      </div>
    </div>`;

  ov.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => { ov.style.display = 'none'; }));

  ov.querySelectorAll('[data-lbl]').forEach(row => {
    const id = row.dataset.lbl;
    row.querySelector('[data-lsave]').addEventListener('click', async () => {
      const nombre = row.querySelector('[data-ln]').value.trim();
      const color = row.querySelector('[data-lc]').value;
      if (!nombre) return notif('El nombre no puede estar vacío', 'error');
      try {
        await apiPatch(`/assets/labels/${id}`, { nombre, color });
        await refreshLabels();
        renderLabelManager(ov);
        notif('✓ Etiqueta actualizada');
      } catch (e) { notif('Error: ' + e.message, 'error'); }
    });
    row.querySelector('[data-ldel]').addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta etiqueta? Se quitará de todas las imágenes.')) return;
      try {
        await apiDelete(`/assets/labels/${id}`);
        await refreshLabels();
        renderLabelManager(ov);
        notif('✓ Etiqueta eliminada');
      } catch (e) { notif('Error: ' + e.message, 'error'); }
    });
  });

  ov.querySelector('[data-nadd]').addEventListener('click', async () => {
    const nombre = ov.querySelector('[data-nn]').value.trim();
    const color = ov.querySelector('[data-nc]').value;
    const grupo = ov.querySelector('[data-ng]').value;
    if (!nombre) return notif('Poné un nombre para la etiqueta', 'error');
    try {
      await apiPost('/assets/labels', { nombre, color, grupo });
      await refreshLabels();
      renderLabelManager(ov);
      notif('✓ Etiqueta creada');
    } catch (e) { notif('Error: ' + e.message, 'error'); }
  });
}

async function refreshLabels() {
  const res = await fetchAssets();
  assets = res.assets;
  labels = res.labels;
  labelIndex = indexLabels(labels);
  filterBar?.render(labels);
  renderAssets();
}

function init() {
  document.querySelector('.sidebar-item[data-panel="assets"]')
    ?.addEventListener('click', showAssetsPanel);

  const toolbar = document.getElementById('assets-toolbar');
  if (toolbar) {
    filterBar = createFilterBar({ onChange: renderAssets });
    toolbar.appendChild(filterBar.el);
  }
  document.getElementById('assets-manage-labels')
    ?.addEventListener('click', openLabelManager);

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
