// galería compartida (la usan assets.js y image-picker.js): carga de assets+etiquetas,
// filtrado tipo finder y una barra de filtros reutilizable
import { apiGet } from '../api.js';

export const escAttr = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export const GRUPOS = [
  { key: 'color',     label: 'Colores' },
  { key: 'modulo',    label: 'Módulos' },
  { key: 'plantilla', label: 'Plantillas' },
  { key: 'menu',      label: 'Menú' },
];
export const GRUPO_NOMBRES = Object.fromEntries(GRUPOS.map(g => [g.key, g.label]));

// GET /api/assets devuelve { assets, labels }
export async function fetchAssets() {
  const res = await apiGet('/assets');
  return { assets: res.assets || [], labels: res.labels || [] };
}

export function indexLabels(labels) {
  return Object.fromEntries((labels || []).map(l => [l.id, l]));
}

// ¿el asset pasa los filtros? (texto + etiquetas en and)
export function matchAsset(asset, filters) {
  const text = (filters?.text || '').trim().toLowerCase();
  if (text) {
    const hay = `${asset.nombre || ''} ${asset.filename || ''}`.toLowerCase();
    if (!hay.includes(text)) return false;
  }
  const ids = filters?.labelIds;
  if (ids && ids.size) {
    const tags = asset.etiquetas || [];
    for (const id of ids) if (!tags.includes(id)) return false; // AND
  }
  return true;
}

export function tagDotsHTML(asset, labelIndex) {
  const tags = (asset.etiquetas || []).map(id => labelIndex[id]).filter(Boolean);
  if (!tags.length) return '';
  return `<div style="display:flex;gap:.2rem;flex-wrap:wrap;align-items:center;">${
    tags.map(l => `<span title="${escAttr(l.nombre)}" style="display:inline-flex;align-items:center;gap:.2rem;font-size:.55rem;color:var(--slate-600);background:var(--slate-50);border:1px solid var(--slate-200);border-radius:999px;padding:.05rem .35rem .05rem .25rem;">
        <span style="width:.5rem;height:.5rem;border-radius:50%;background:${escAttr(l.color)};display:inline-block;"></span>${escAttr(l.nombre)}</span>`).join('')
  }</div>`;
}

// barra de filtros reutilizable: buscador de texto + chips agrupados (colores/categorías)
// cada cambio dispara onChange(filters)
export function createFilterBar({ onChange, placeholder = 'Buscar imágenes…' } = {}) {
  const filters = { text: '', labelIds: new Set() };
  let labels = [];

  const el = document.createElement('div');
  el.className = 'asset-filterbar';
  el.style.cssText = 'display:flex;flex-direction:column;gap:.6rem;margin-bottom:1.1rem;';

  const fire = () => onChange?.(filters);

  function render(newLabels) {
    if (newLabels) labels = newLabels;
    const grupos = GRUPOS.map(g => ({
      ...g, items: labels.filter(l => (l.grupo || 'color') === g.key),
    })).filter(g => g.items.length);

    el.innerHTML = `
      <div style="position:relative;">
        <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:.7rem;top:50%;transform:translateY(-50%);color:var(--slate-400);font-size:.8rem;"></i>
        <input type="search" class="asset-filter-text" placeholder="${escAttr(placeholder)}" value="${escAttr(filters.text)}"
          style="width:100%;padding:.55rem .7rem .55rem 2rem;border:1px solid var(--slate-200);border-radius:.5rem;font-size:.85rem;outline:none;" />
      </div>
      ${grupos.map(g => `
        <div style="display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;">
          <span style="font-size:.55rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--slate-400);min-width:4.5rem;">${g.label}</span>
          ${g.items.map(l => chipHTML(l, filters.labelIds.has(l.id))).join('')}
        </div>`).join('')}
      ${filters.labelIds.size || filters.text ? `<div><button type="button" class="asset-filter-clear btn-edit-small"><i class="fa-solid fa-xmark"></i> Limpiar filtros</button></div>` : ''}
    `;

    const input = el.querySelector('.asset-filter-text');
    input?.addEventListener('input', () => { filters.text = input.value; fire(); });

    el.querySelectorAll('[data-filter-label]').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.filterLabel;
        if (filters.labelIds.has(id)) filters.labelIds.delete(id);
        else filters.labelIds.add(id);
        render();   // re-render para reflejar estado activo + botón limpiar
        fire();
      });
    });

    el.querySelector('.asset-filter-clear')?.addEventListener('click', () => {
      filters.text = ''; filters.labelIds.clear(); render(); fire();
    });
  }

  function chipHTML(l, active) {
    const color = escAttr(l.color);
    if ((l.grupo || 'color') === 'color') {
      return `<button type="button" data-filter-label="${l.id}" title="${escAttr(l.nombre)}"
        style="width:1.35rem;height:1.35rem;border-radius:50%;background:${color};cursor:pointer;
        border:2px solid ${active ? 'var(--slate-800)' : '#fff'};box-shadow:0 0 0 1px var(--slate-200);${active ? '' : 'opacity:.85;'}"></button>`;
    }
    return `<button type="button" data-filter-label="${l.id}"
      style="display:inline-flex;align-items:center;gap:.35rem;font-size:.7rem;cursor:pointer;
      border:1px solid ${active ? 'var(--slate-800)' : 'var(--slate-200)'};border-radius:999px;
      padding:.2rem .55rem;background:${active ? 'var(--slate-800)' : '#fff'};color:${active ? '#fff' : 'var(--slate-700)'};">
      <span style="width:.6rem;height:.6rem;border-radius:50%;background:${color};display:inline-block;"></span>${escAttr(l.nombre)}</button>`;
  }

  return { el, render, getFilters: () => filters, reset: () => { filters.text = ''; filters.labelIds.clear(); render(); } };
}
