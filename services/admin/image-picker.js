// Selector modal de imágenes (global). Reemplaza pegar rutas a mano: abre un
// popup con toda la galería + el mismo buscador/filtros de la sección Imágenes,
// y permite además pegar una URL externa.
//
// Uso:  const ruta = await window.__imgPicker.open({ current, allowUrl });
//       (resuelve con la ruta elegida, o null si se cancela)

import { fetchAssets, matchAsset, indexLabels, tagDotsHTML, createFilterBar, escAttr } from './asset-shared.js';

const S = { assets: [], labelIndex: {}, resolve: null, filterBar: null, current: '' };

function close(value) {
  const ov = document.getElementById('imgpicker-overlay');
  if (ov) ov.style.display = 'none';
  const r = S.resolve; S.resolve = null;
  if (r) r(value ?? null);
}

function choose(path) { close(path); }

function renderGrid() {
  const grid = document.getElementById('imgpicker-grid');
  if (!grid) return;
  const filters = S.filterBar.getFilters();
  const list = S.assets.filter(a => matchAsset(a, filters));

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:2.5rem;text-align:center;color:var(--slate-400);font-size:.8rem;">Ninguna imagen coincide con el filtro.</div>`;
    return;
  }

  grid.innerHTML = list.map(a => {
    const sel = a.path === S.current;
    return `<button type="button" class="imgpicker-card" data-path="${escAttr(a.path)}" title="${escAttr(a.nombre)}"
      style="text-align:left;background:#fff;border:2px solid ${sel ? '#2563eb' : 'var(--slate-200)'};border-radius:.5rem;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;padding:0;">
      <div style="aspect-ratio:16/10;background:repeating-conic-gradient(#f1f5f9 0% 25%, #fff 0% 50%) 50% / 16px 16px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
        <img src="${escAttr(a.path)}" alt="${escAttr(a.nombre)}" loading="lazy" style="max-width:100%;max-height:100%;object-fit:contain;" onerror="this.style.display='none'"/>
      </div>
      <div style="padding:.45rem .55rem;display:flex;flex-direction:column;gap:.3rem;">
        <span style="font-size:.72rem;font-weight:600;color:var(--slate-800);word-break:break-word;">${escAttr(a.nombre)}</span>
        ${tagDotsHTML(a, S.labelIndex)}
      </div>
    </button>`;
  }).join('');

  grid.querySelectorAll('.imgpicker-card').forEach(b =>
    b.addEventListener('click', () => choose(b.dataset.path)));
}

function ensureModal() {
  if (document.getElementById('imgpicker-overlay')) return;

  const ov = document.createElement('div');
  ov.id = 'imgpicker-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;padding:2rem;background:rgba(15,23,42,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:.75rem;width:min(920px,95vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 70px rgba(0,0,0,.4);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--slate-200);">
        <span style="font-weight:800;font-size:1rem;color:var(--slate-800);"><i class="fa-solid fa-image" style="margin-right:.4rem;color:#2563eb;"></i> Elegir imagen</span>
        <button type="button" id="imgpicker-close" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div style="padding:1rem 1.25rem 0;" id="imgpicker-filters"></div>
      <div id="imgpicker-grid" style="flex:1;overflow:auto;padding:.25rem 1.25rem 1rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.85rem;"></div>
      <div style="border-top:1px solid var(--slate-200);padding:.85rem 1.25rem;display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;background:var(--slate-50);">
        <span style="font-size:.6rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--slate-400);">URL externa</span>
        <input type="text" id="imgpicker-url" placeholder="https://… (CDN, externa)" style="flex:1;min-width:200px;padding:.5rem .65rem;border:1px solid var(--slate-200);border-radius:.45rem;font-size:.8rem;"/>
        <button type="button" id="imgpicker-use-url" class="btn-secondary">Usar URL</button>
        <button type="button" id="imgpicker-cancel" class="btn-secondary">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  // Montar la barra de filtros
  S.filterBar = createFilterBar({ onChange: renderGrid });
  ov.querySelector('#imgpicker-filters').appendChild(S.filterBar.el);

  // Cierres
  ov.addEventListener('click', e => { if (e.target === ov) close(null); });
  ov.querySelector('#imgpicker-close').addEventListener('click', () => close(null));
  ov.querySelector('#imgpicker-cancel').addEventListener('click', () => close(null));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && ov.style.display === 'flex') close(null);
  });

  const urlInput = ov.querySelector('#imgpicker-url');
  const useUrl = () => { const v = urlInput.value.trim(); if (v) close(v); };
  ov.querySelector('#imgpicker-use-url').addEventListener('click', useUrl);
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); useUrl(); } });
}

async function open({ current = '', allowUrl = true } = {}) {
  ensureModal();
  const ov = document.getElementById('imgpicker-overlay');
  S.current = current || '';

  const urlRow = ov.querySelector('#imgpicker-url').parentElement;
  urlRow.style.display = allowUrl ? 'flex' : 'none';
  const urlInput = ov.querySelector('#imgpicker-url');
  // Si la ruta actual no está en la galería, mostrarla como URL externa
  urlInput.value = '';
  S.filterBar.reset();

  const grid = document.getElementById('imgpicker-grid');
  grid.innerHTML = `<div style="grid-column:1/-1;padding:2.5rem;text-align:center;color:var(--slate-400);font-size:.8rem;">Cargando…</div>`;
  ov.style.display = 'flex';

  return new Promise(async (resolve) => {
    S.resolve = resolve;
    try {
      const { assets, labels } = await fetchAssets();
      S.assets = assets;
      S.labelIndex = indexLabels(labels);
      if (allowUrl && current && !assets.some(a => a.path === current)) urlInput.value = current;
      S.filterBar.render(labels);
      renderGrid();
    } catch (e) {
      grid.innerHTML = `<div style="grid-column:1/-1;padding:2.5rem;text-align:center;color:#dc2626;font-size:.8rem;">Error al cargar imágenes: ${escAttr(e.message)}</div>`;
    }
  });
}

window.__imgPicker = { open };
