import { SECTIONS, TIPOS_HTML, renderSection, createSection } from '../sections.js';
import { TIPO_CSS, TYPE_TO_PAGE, cssFilesFor } from '../css-pages.js';

const API = `http://${window.location.hostname}:3000/api`;
const token = () => sessionStorage.getItem('sisgra_token');

const ICON_CATALOG = ['location', 'lightning', 'shield', 'check', 'camera', 'gear', 'lock', 'chart', 'database'];

const e3 = {
  plantillas: [],
  activeTpl: null,
  selectedSecId: null,
  dirty: false,
  propsTab: 'data',
  currentTipo: null,
};

// Cache de módulos+variantes para el tray del editor. Se recarga al abrir el editor.
let e3Modulos = {};
async function loadE3Modulos() {
  try {
    const res = await api('GET', '/modulos');
    e3Modulos = res.modulos || {};
  } catch (e) {
    console.warn('[e3] No se pudieron cargar variantes:', e.message);
    e3Modulos = {};
  }
}

const escAttr = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const notif = (msg, type='success') => window.__svc?.showNotif?.(msg, type) ?? console.log('[e3]', msg);

// ─── API helper ─────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  const t = token();
  if (t) opts.headers['Authorization'] = `Bearer ${t}`;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(`${API}${path}`, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `${method} ${path} → ${r.status}`);
  return data;
}

function stripListeners(el) {
  if (!el) return null;
  const c = el.cloneNode(true);
  el.parentNode.replaceChild(c, el);
  return c;
}

// ─── Module list (todos los módulos disponibles, sin filtro por tipo) ──
function modulesForTipo(_tipo) {
  return Object.entries(SECTIONS);
}

// ─── Tipo select populate ───────────────────────────────────────────
function populateTipoSelect() {
  const sel = document.getElementById('np-tipo');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Seleccionar página destino —</option>'
    + TIPOS_HTML.map(t => `<option value="${t.value}">${t.label} — ${t.file}</option>`).join('');
}

// ─── Load + render dashboard ────────────────────────────────────────
async function loadPlantillas() {
  try {
    const { plantillas } = await api('GET', '/plantillas');
    e3.plantillas = plantillas || [];
    renderOverview();
    renderSidebarList();
  } catch (e) { notif('Error cargando plantillas: ' + e.message, 'error'); }
}

// ─── Helpers de vencimiento ────────────────────────────────────────
function isVencida(p) {
  if (!p.activa || !p.fecha_fin) return false;
  return Date.now() > new Date(p.fecha_fin).getTime();
}
function diasRestantes(p) {
  if (!p.fecha_fin) return null;
  return Math.ceil((new Date(p.fecha_fin).getTime() - Date.now()) / 86400000);
}
function fmtFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function expiryClass(p) {
  if (!p.activa || !p.fecha_fin) return '';
  if (isVencida(p)) return 'expired';
  const dias = diasRestantes(p);
  return (dias !== null && dias <= 2) ? 'soon' : '';
}

// Actualiza el banner de vencidas en el dashboard
function refreshDashVencidas() {
  const banner = document.getElementById('dash-vencidas-banner');
  const text   = document.getElementById('dash-vencidas-text');
  if (!banner || !text) return;
  const vencidas = e3.plantillas.filter(p => isVencida(p));
  const proximas = e3.plantillas.filter(p => p.activa && !isVencida(p) && diasRestantes(p) !== null && diasRestantes(p) <= 2);
  if (vencidas.length > 0) {
    const nombres = vencidas.map(p => `"${p.nombre}"`).join(', ');
    text.innerHTML = `<strong>${vencidas.length} plantilla${vencidas.length>1?'s':''} vencida${vencidas.length>1?'s':''}:</strong> ${nombres}. Activá una nueva versión para renovar su vigencia.`;
    banner.style.display = '';
  } else if (proximas.length > 0) {
    const n = proximas[0];
    text.innerHTML = `<strong>Atención:</strong> "${n.nombre}" vence en ${diasRestantes(n)} día${diasRestantes(n)===1?'':'s'} (${fmtFecha(n.fecha_fin)}). Considerá renovarla.`;
    banner.style.background = '#78350f';
    banner.style.borderLeftColor = '#f59e0b';
    banner.querySelector('.dash-vencidas-banner-text').style.color = '#fef3c7';
    banner.style.display = '';
  } else {
    banner.style.display = 'none';
  }
}

function renderOverview() {
  const list = document.getElementById('tpl-overview-list');
  if (!list) return;
  list.innerHTML = TIPOS_HTML.map(t => {
    const pls = e3.plantillas.filter(p => p.tipo === t.value);
    return `
      <div style="margin-bottom:1.25rem;">
        <div style="display:flex;align-items:center;gap:.75rem;padding:.4rem 0 .5rem;border-bottom:1px solid var(--slate-100);margin-bottom:.5rem;">
          <span style="font-size:.625rem;font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:var(--sisgra-blue);">${t.label}</span>
          <span style="font-size:.6rem;color:var(--slate-400);font-family:monospace;">${t.file}</span>
        </div>
        ${pls.length === 0
          ? `<div style="padding:.85rem;color:var(--slate-400);font-size:.7rem;text-align:center;background:var(--slate-50);">Sin plantillas todavía.</div>`
          : pls.map(p => {
              const vencida = isVencida(p);
              const dias    = diasRestantes(p);
              const cls     = expiryClass(p);
              let expiryHtml = '';
              if (p.activa && p.fecha_fin) {
                const label = vencida
                  ? `Venció el ${fmtFecha(p.fecha_fin)}`
                  : `Vence ${dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`} · ${fmtFecha(p.fecha_fin)}`;
                expiryHtml = `<span class="tpl-expiry-date ${cls}" style="font-size:.62rem;font-family:'IBM Plex Mono',monospace;">${label}</span>`;
              }
              const statusLabel = vencida ? 'Vencida' : p.activa ? 'Activa' : 'Borrador';
              const statusCls   = vencida ? 'tpl-status-vencida' : p.activa ? 'tpl-status-active' : 'tpl-status-draft';
              return `
              <div class="tpl-list-item ${p.activa ? 'active-tpl' : ''} ${vencida ? 'vencida-tpl' : ''}" style="margin-bottom:.4rem;cursor:default;flex-wrap:wrap;gap:.5rem;">
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;">
                    <span class="tpl-list-name-text" style="font-weight:700;color:var(--slate-800);font-size:.8125rem;">${escAttr(p.nombre)}</span>
                    ${vencida ? '<span class="tpl-badge-vencida">[ VENCIDA ]</span>' : ''}
                    <button class="tpl-rename-btn" data-e3-rename="${p.id_plantilla}" title="Renombrar plantilla">✏</button>
                  </div>
                  ${p.descripcion ? `<div style="font-size:.6875rem;color:var(--slate-500);">${escAttr(p.descripcion)}</div>` : ''}
                  <div style="font-size:.6rem;color:var(--slate-400);font-family:'IBM Plex Mono',monospace;margin-top:.1rem;">ID: ${escAttr(p.id_plantilla)}</div>
                  ${expiryHtml}
                </div>
                <span class="tpl-list-status ${statusCls}">${statusLabel}</span>
                <button class="btn-edit-small" data-e3-edit="${p.id_plantilla}">Editar</button>
                ${p.activa ? `<button class="btn-edit-small" data-e3-extender="${p.id_plantilla}" style="color:#2563eb;border-color:#93c5fd;" title="Extiende el vencimiento 7 días más">+ Extender</button>` : `<button class="btn-edit-small" data-e3-activar="${p.id_plantilla}">Activar</button>`}
                ${p.activa && (vencida || !p.fecha_fin) ? `<button class="btn-edit-small" data-e3-activar="${p.id_plantilla}" style="${vencida ? 'background:#fee2e2;color:#991b1b;border-color:#fca5a5;' : ''}">↺ Renovar</button>` : ''}
                <button class="btn-edit-small" style="color:#dc2626;border-color:#fca5a5;" data-e3-eliminar="${p.id_plantilla}">Eliminar</button>
              </div>`;
            }).join('')}
      </div>`;
  }).join('');

  list.querySelectorAll('[data-e3-newtipo]').forEach(b => b.addEventListener('click', () => openNuevaModal(b.dataset.e3Newtipo)));
  list.querySelectorAll('[data-e3-edit]').forEach(b => b.addEventListener('click', () => openEditor(b.dataset.e3Edit)));
  list.querySelectorAll('[data-e3-activar]').forEach(b => b.addEventListener('click', () => activarPlantilla(b.dataset.e3Activar)));
  list.querySelectorAll('[data-e3-extender]').forEach(b => b.addEventListener('click', () => extenderVencimiento(b.dataset.e3Extender)));
  list.querySelectorAll('[data-e3-eliminar]').forEach(b => b.addEventListener('click', () => eliminarPlantilla(b.dataset.e3Eliminar)));
  list.querySelectorAll('[data-e3-rename]').forEach(b => b.addEventListener('click', () => renombrarPlantilla(b.dataset.e3Rename, b)));
  refreshDashVencidas();
}

async function renombrarPlantilla(id, btn) {
  // Encontrar el span del nombre en la misma fila
  const nameSpan = btn.closest('div').querySelector('.tpl-list-name-text');
  if (!nameSpan) return;
  const nombreActual = e3.plantillas.find(p => p.id_plantilla === id)?.nombre || nameSpan.textContent;

  // Convertir el span en un input inline
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tpl-name-input';
  input.value = nombreActual;
  nameSpan.replaceWith(input);
  btn.style.display = 'none';
  input.focus();
  input.select();

  async function commit() {
    const nuevoNombre = input.value.trim();
    // Restaurar siempre el span, luego actualizar si cambió
    const span = document.createElement('span');
    span.className = 'tpl-list-name-text';
    span.style.cssText = 'font-weight:700;color:var(--slate-800);font-size:.8125rem;';
    input.replaceWith(span);
    btn.style.display = '';

    if (!nuevoNombre || nuevoNombre === nombreActual) {
      span.textContent = nombreActual;
      return;
    }
    span.textContent = nuevoNombre;
    try {
      await api('PATCH', `/plantillas/${id}`, { nombre: nuevoNombre });
      const p = e3.plantillas.find(x => x.id_plantilla === id);
      if (p) p.nombre = nuevoNombre;
      // Actualizar también la sidebar
      renderSidebarList();
      notif('✓ Plantilla renombrada');
    } catch (e) {
      span.textContent = nombreActual; // revertir si falla
      notif('Error al renombrar: ' + e.message, 'error');
    }
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = nombreActual; input.blur(); }
  });
}

async function extenderVencimiento(id) {
  try {
    const { plantilla } = await api('POST', `/plantillas/${id}/extender`);
    const p = e3.plantillas.find(x => x.id_plantilla === id);
    if (p) p.fecha_fin = plantilla.fecha_fin;
    renderOverview(); renderSidebarList();
    notif(`✓ Vencimiento extendido hasta el ${fmtFecha(plantilla.fecha_fin)} (+7 días)`);
  } catch (e) { notif('Error: ' + e.message, 'error'); }
}

function renderSidebarList() {
  const el = document.getElementById('sidebar-tpl-list');
  if (!el) return;
  el.innerHTML = e3.plantillas.map(p => {
    const vencida = isVencida(p);
    const dias    = diasRestantes(p);
    const cls     = expiryClass(p);
    let expiryLine = '';
    if (p.activa && p.fecha_fin) {
      const label = vencida
        ? `Venció ${fmtFecha(p.fecha_fin)}`
        : dias === 0 ? 'Vence hoy'
        : dias === 1 ? 'Vence mañana'
        : `Vence ${fmtFecha(p.fecha_fin)}`;
      expiryLine = `<div class="sidebar-tpl-expiry ${cls}" style="padding-left:2rem;">${label}</div>`;
    }
    return `
    <div>
      <div class="sidebar-tpl-item ${e3.activeTpl?.id_plantilla === p.id_plantilla ? 'active' : ''} ${vencida ? 'sidebar-item-vencida' : ''}" data-e3-tpl="${p.id_plantilla}" title="${escAttr(p.nombre)} (${p.tipo})" style="${vencida ? 'border-left-color:#f87171;' : ''}">
        <span class="sidebar-tpl-dot" style="${vencida ? 'background:#f87171;' : ''}"></span>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escAttr(p.nombre)}</span>
        ${vencida ? '<span class="sidebar-vencida-badge">VENC.</span>' : p.activa ? '<span style="font-size:.5rem;font-weight:900;letter-spacing:.1em;color:#86efac;">LIVE</span>' : ''}
        <button data-e3-sb-del="${p.id_plantilla}" title="Eliminar" style="background:transparent;border:1px solid rgba(220,38,38,.4);color:rgba(252,165,165,.85);width:1.1rem;height:1.1rem;display:flex;align-items:center;justify-content:center;font-size:.7rem;line-height:1;padding:0;flex-shrink:0;margin-left:.3rem;"><i class="fa-solid fa-xmark"></i></button>
      </div>
      ${expiryLine}
    </div>`;
  }).join('') || '<div style="padding:.5rem 1.5rem;font-size:.65rem;color:rgba(255,255,255,.3);">Sin plantillas</div>';
  el.querySelectorAll('[data-e3-tpl]').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('[data-e3-sb-del]')) return;
      openEditor(item.dataset.e3Tpl);
    });
  });
  el.querySelectorAll('[data-e3-sb-del]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); eliminarPlantilla(btn.dataset.e3SbDel); });
  });
}

// ─── Modal ─────────────────────────────────────────────────────────
function openNuevaModal(preTipo = '') {
  document.getElementById('np-name').value = '';
  document.getElementById('np-desc').value = '';
  const tipoSel = document.getElementById('np-tipo');
  if (tipoSel) tipoSel.value = preTipo;
  document.getElementById('modal-nueva-plantilla').classList.add('open');
  setTimeout(() => document.getElementById('np-name').focus(), 50);
}

async function crearPlantilla() {
  const nombre = document.getElementById('np-name').value.trim();
  const tipo = document.getElementById('np-tipo')?.value || '';
  const descripcion = document.getElementById('np-desc').value.trim();
  if (!nombre) return notif('El nombre es requerido', 'error');
  if (!tipo) return notif('Seleccioná el HTML destino', 'error');
  try {
    const { plantilla } = await api('POST', '/plantillas', { nombre, tipo, descripcion, secciones: [] });
    e3.plantillas.push(plantilla);
    document.getElementById('modal-nueva-plantilla').classList.remove('open');
    renderOverview(); renderSidebarList();
    notif('✓ Plantilla creada');
    openEditor(plantilla.id_plantilla);
  } catch (e) { notif('Error: ' + e.message, 'error'); }
}

async function activarPlantilla(id) {
  try {
    const { plantilla } = await api('POST', `/plantillas/${id}/activar`);
    e3.plantillas.forEach(p => {
      if (p.tipo === plantilla.tipo) {
        p.activa = (p.id_plantilla === id);
        // Sincronizar fechas desde el servidor
        if (p.id_plantilla === id) {
          p.fecha_inicio = plantilla.fecha_inicio;
          p.fecha_fin    = plantilla.fecha_fin;
        }
      }
    });
    if (e3.activeTpl?.id_plantilla === id) {
      e3.activeTpl.activa      = true;
      e3.activeTpl.fecha_inicio = plantilla.fecha_inicio;
      e3.activeTpl.fecha_fin    = plantilla.fecha_fin;
    }
    renderOverview(); renderSidebarList();
    const dias = diasRestantes(plantilla);
    notif(`✓ Plantilla activada · Vence el ${fmtFecha(plantilla.fecha_fin)} (${dias} días)`);
  } catch (e) { notif('Error: ' + e.message, 'error'); }
}

async function eliminarPlantilla(id) {
  const p = e3.plantillas.find(x => x.id_plantilla === id);
  if (!p) return;
  const otras = e3.plantillas.filter(x => x.tipo === p.tipo && x.id_plantilla !== id);
  if (p.activa && otras.length === 0) {
    notif(`No se puede eliminar: "${p.nombre}" es la única plantilla para ${p.tipo}. Creá otra primero.`, 'error');
    return;
  }
  const msg = p.activa
    ? `¿Eliminar "${p.nombre}"?\n\nEs la plantilla ACTIVA. Al borrarla, se activará automáticamente otra plantilla de "${p.tipo}".`
    : `¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`;
  if (!confirm(msg)) return;
  try {
    const r = await api('DELETE', `/plantillas/${id}`);
    e3.plantillas = e3.plantillas.filter(x => x.id_plantilla !== id);
    if (r.promoted) {
      e3.plantillas.forEach(x => { if (x.tipo === r.tipoAffected) x.activa = (x.id_plantilla === r.promoted.id_plantilla); });
    }
    if (e3.activeTpl?.id_plantilla === id) {
      e3.activeTpl = null; e3.selectedSecId = null; e3.dirty = false;
      document.querySelectorAll('.panel').forEach(pn => pn.classList.remove('active'));
      document.getElementById('panel-plantillas').classList.add('active');
      document.getElementById('topbar-title').textContent = 'Plantillas';
    }
    renderOverview(); renderSidebarList();
    notif(r.promoted ? `✓ Eliminada. Se activó "${r.promoted.nombre}" automáticamente.` : '✓ Plantilla eliminada');
  } catch (e) { notif('Error: ' + e.message, 'error'); }
}

// ─── EDITOR ────────────────────────────────────────────────────────
async function openEditor(id) {
  // Bloquear en pantallas móviles (< 1024px)
  if (window.innerWidth < 1024) {
    document.getElementById('e3-mobile-block').classList.add('active');
    return;
  }
  try {
    const { plantilla } = await api('GET', `/plantillas/${id}`);
    e3.activeTpl = plantilla;
    e3.currentTipo = plantilla.tipo;
    e3.selectedSecId = null;
    e3.dirty = false;
    _e3DndBound = false;   // reset DnD binding for the new iframe
    await loadE3Modulos();
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-tpl-editor').classList.add('active');
    document.getElementById('topbar-title').textContent = `Editor — ${plantilla.nombre}`;
    renderSidebarList();
    renderEditorShell();
  } catch (e) { notif('Error: ' + e.message, 'error'); }
}

function backToOverview() {
  if (e3.dirty && !confirm('Hay cambios sin guardar. ¿Salir igual?')) return;
  e3.activeTpl = null; e3.selectedSecId = null;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-plantillas').classList.add('active');
  document.getElementById('topbar-title').textContent = 'Plantillas';
  renderSidebarList();
}

function renderEditorShell() {
  const tpl = e3.activeTpl;
  const inner = document.getElementById('tpl-editor-inner');
  inner.innerHTML = `
    <div style="background:var(--white);border-bottom:1px solid var(--slate-200);padding:.75rem 1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">
        <button class="btn-edit-small" id="e3-back"><i class="fa-solid fa-arrow-left fa-lg"></i> Volver</button>
        <span style="font-size:.5rem;font-weight:900;letter-spacing:.3em;text-transform:uppercase;background:var(--sisgra-blue);color:#fff;padding:.2rem .6rem;">Plantilla</span>
        <span style="font-size:1rem;font-weight:900;color:var(--sisgra-blue);letter-spacing:-.03em;font-style:italic;">${escAttr(tpl.nombre)}</span>
        <span style="font-size:.55rem;font-weight:700;color:var(--slate-400);letter-spacing:.2em;text-transform:uppercase;">— ${escAttr(tpl.tipo)}</span>
        <span style="font-size:.5rem;font-weight:900;letter-spacing:.2em;text-transform:uppercase;padding:.2rem .6rem;${tpl.activa ? 'background:#dcfce7;color:#166534;' : 'background:#fef3c7;color:#92400e;'}">${tpl.activa ? 'Activa' : 'Borrador'}</span>
        <span id="e3-dirty" style="display:none;color:#dc2626;font-size:.6rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">● Sin guardar</span>
      </div>
      <div style="display:flex;align-items:center;gap:.5rem;">
        ${!tpl.activa ? '<button class="btn-edit-small" id="e3-activar">Activar</button>' : '<span style="color:#166534;font-size:.6rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">✓ En vivo</span>'}
        <button class="btn-save" id="e3-guardar">Guardar plantilla</button>
      </div>
    </div>
    <div class="editor-shell">
      <div class="section-tray">
        <div class="tray-header">Módulos · ${escAttr(tpl.tipo)}</div>
        <input class="tray-search" id="e3-search" placeholder="Buscar módulo..."/>
        <div class="tray-body" id="e3-tray-body"></div>
      </div>
      <div class="page-canvas-wrap">
        <div class="canvas-ruler"><span style="font-size:.5rem;font-weight:700;color:var(--slate-400);letter-spacing:.2em;text-transform:uppercase;">Vista previa — ${escAttr(tpl.tipo)}.html</span></div>
        <div style="flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:1.5rem;">
          <iframe class="page-frame desktop" id="e3-canvas" style="border:none;background:#fff;min-height:600px;height:80vh;"></iframe>
        </div>
      </div>
      <div class="props-panel">
        <div class="props-header"><span id="e3-props-type">Propiedades</span></div>
        <div class="props-body" id="e3-props-body"><div class="props-empty">Click sobre una sección del canvas para editarla.</div></div>
      </div>
    </div>`;

  document.getElementById('e3-back').addEventListener('click', backToOverview);
  document.getElementById('e3-guardar').addEventListener('click', guardarPlantilla);
  document.getElementById('e3-activar')?.addEventListener('click', async () => {
    await activarPlantilla(tpl.id_plantilla);
    renderEditorShell();
  });
  document.getElementById('e3-search').addEventListener('input', ev => {
    const q = ev.target.value.toLowerCase();
    document.querySelectorAll('#e3-tray-body .tray-chip').forEach(c => {
      const n = c.querySelector('.tray-chip-name')?.textContent.toLowerCase() || '';
      const d = c.querySelector('.tray-chip-desc')?.textContent.toLowerCase() || '';
      c.style.display = (n + d).includes(q) ? '' : 'none';
    });
  });
  document.querySelectorAll('[data-e3-tab]').forEach(t => t.addEventListener('click', () => {
    e3.propsTab = t.dataset.e3Tab;
    document.querySelectorAll('[data-e3-tab]').forEach(x => x.classList.toggle('active', x === t));
    renderProps();
  }));

  renderTray();
  initIframe(() => {
    try { renderCanvas(); } catch (e) { console.error('[e3] renderCanvas error:', e); }
    bindCanvasDnd();
  });
  renderProps();
}

function renderTray() {
  const body = document.getElementById('e3-tray-body');
  const mods = modulesForTipo(e3.currentTipo);
  if (mods.length === 0) {
    body.innerHTML = '<div style="padding:1rem;color:var(--slate-400);font-size:.7rem;text-align:center;">No hay módulos para este tipo.</div>';
    return;
  }
  // Un chip por variante. Si un módulo no tiene variantes cargadas, cae a un chip base con defaults.
  const html = mods.flatMap(([type, def]) => {
    const variantes = e3Modulos[type]?.variantes || [];
    if (!variantes.length) {
      return [`
        <div class="tray-chip" draggable="true" data-e3-type="${type}" data-e3-variant="">
          <div class="tray-chip-thumb"></div>
          <div class="tray-chip-info">
            <div class="tray-chip-name">${escAttr(def.label)}</div>
            <div class="tray-chip-desc">${escAttr(def.description || '')}</div>
          </div>
        </div>`];
    }
    return variantes.map(v => `
      <div class="tray-chip" draggable="true" data-e3-type="${type}" data-e3-variant="${escAttr(v.id)}">
        <div class="tray-chip-thumb"></div>
        <div class="tray-chip-info">
          <div class="tray-chip-name">${escAttr(v.nombre || def.label)}</div>
          <div class="tray-chip-desc">${escAttr(def.label)}</div>
        </div>
      </div>`);
  });
  body.innerHTML = html.join('');
  body.querySelectorAll('.tray-chip').forEach(chip => {
    chip.addEventListener('dragstart', ev => {
      const type = chip.dataset.e3Type;
      const variant = chip.dataset.e3Variant || '';
      ev.dataTransfer.setData('text/e3-sec-type', type);
      ev.dataTransfer.setData('text/e3-variant', variant);
      ev.dataTransfer.setData('text/plain', type);
      ev.dataTransfer.effectAllowed = 'copy';
      chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    chip.addEventListener('dblclick', () => addSection(chip.dataset.e3Type, undefined, chip.dataset.e3Variant || null));
  });
}

// ─── Iframe con CSS específico por tipo ─────────────────────────────

// Inyecta en el <head> del iframe los <link> de CSS que falten para los módulos
// actuales (sin quitar los existentes). Se llama en cada render del canvas, así
// un módulo recién arrastrado de otro tipo obtiene su CSS sin recrear el iframe.
// La lista de CSS la calcula cssFilesFor (compartida con el runtime).
function ensureCanvasCss(doc) {
  if (!doc || !doc.head) return;
  const have = new Set(
    Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(l => l.getAttribute('href'))
  );
  cssFilesFor(e3.currentTipo, e3.activeTpl?.secciones || []).forEach(href => {
    if (have.has(href)) return;
    const l = doc.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    doc.head.appendChild(l);
  });
}

function initIframe(cb) {
  const iframe = document.getElementById('e3-canvas');
  if (!iframe) return;
  const cssFiles = cssFilesFor(e3.currentTipo, e3.activeTpl?.secciones || []);
  // OJO: usamos `<bo${''}dy>` en vez de `<body>` para evitar que Live Server inyecte
  // su <script> de auto-reload acá adentro (rompería el template literal del padre).
  const B = 'bo'+'dy';
  iframe.srcdoc = `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
${cssFiles.map(c => `<link rel="stylesheet" href="${c}">`).join('\n')}
<style>
  body{margin:0;background:#fff;min-height:100vh;}
  .e3-sec-wrap{position:relative;outline:2px solid transparent;outline-offset:-2px;transition:outline-color .15s;}
  .e3-sec-wrap:hover{outline-color:#cbd5e1;}
  .e3-sec-wrap.e3-selected{outline-color:#2563eb;}
  .e3-sec-ctrls{position:absolute;top:8px;right:8px;display:flex;gap:.25rem;z-index:9999;background:rgba(255,255,255,.96);padding:.25rem;box-shadow:0 4px 12px rgba(0,0,0,.18);opacity:0;transition:opacity .15s;}
  .e3-sec-wrap:hover .e3-sec-ctrls,.e3-sec-wrap.e3-selected .e3-sec-ctrls{opacity:1;}
  .e3-sec-ctrls button{background:#fff;border:1px solid #cbd5e1;padding:.3rem .5rem;font-size:.75rem;line-height:1;color:#0A1D37;cursor:pointer;font-family:inherit;}
  .e3-sec-ctrls .e3-danger{color:#dc2626;}
  .e3-drop{height:6px;background:#2563eb;margin:0;display:none;}
  .e3-drop.e3-active{display:block;}
  .e3-empty{padding:6rem 2rem;text-align:center;color:#94a3b8;border:2px dashed #cbd5e1;margin:1rem;font-family:Inter,system-ui,sans-serif;}
</style>
</head><${B}></${B}></html>`;
  iframe._queue = iframe._queue || [];
  iframe._queue.push(cb);
  iframe.addEventListener('load', () => {
    const q = iframe._queue || []; iframe._queue = [];
    q.forEach(fn => { try { fn(iframe); } catch (e) { console.error(e); } });
  }, { once: true });
}

function renderCanvas() {
  const iframe = document.getElementById('e3-canvas');
  if (!iframe || !iframe.contentDocument) return;
  const doc = iframe.contentDocument;
  ensureCanvasCss(doc);
  const secs = e3.activeTpl?.secciones || [];
  if (secs.length === 0) {
    doc.body.innerHTML = `<div class="e3-empty" data-e3-emptydrop style="min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:border-color .15s,background .15s;">
      <div style="font-size:2.5rem;margin-bottom:.75rem;opacity:.25;line-height:1;">⊕</div>
      Arrastrá un módulo desde la izquierda<br>
      <small style="font-size:.65rem;display:block;margin-top:.4rem;opacity:.7;">o doble-click sobre un módulo para agregarlo</small>
    </div>`;
  } else {
    doc.body.innerHTML = secs.map((sec, i) => `
<div class="e3-drop" data-dropidx="${i}"></div>
<div class="e3-sec-wrap ${e3.selectedSecId === sec.id ? 'e3-selected' : ''}" data-e3-sec="${sec.id}">
  <div class="e3-sec-ctrls">
    <button data-e3-act="up"><i class="fa-solid fa-chevron-up"></i></button>
    <button data-e3-act="down"><i class="fa-solid fa-chevron-down"></i></button>
    <button data-e3-act="del" class="e3-danger"><i class="fa-solid fa-trash"></i></button>
  </div>
  ${renderSection(sec)}
</div>`).join('') + `<div class="e3-drop" data-dropidx="${secs.length}"></div>`;
  }
  doc.querySelectorAll('.e3-sec-wrap').forEach(w => {
    w.addEventListener('click', ev => {
      if (ev.target.closest('.e3-sec-ctrls')) return;
      e3.selectedSecId = w.dataset.e3Sec;
      renderCanvas(); renderProps();
    });
    w.querySelectorAll('button[data-e3-act]').forEach(b => {
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        const id = w.dataset.e3Sec, act = b.dataset.e3Act;
        if (act === 'up')   moveSection(id, -1);
        if (act === 'down') moveSection(id, 1);
        if (act === 'del')  deleteSection(id);
      });
    });
  });
  doc.querySelectorAll('a').forEach(a => a.addEventListener('click', ev => ev.preventDefault()));
  doc.querySelectorAll('form').forEach(f => f.addEventListener('submit', ev => ev.preventDefault()));
}

let _e3DndBound = false;
function bindCanvasDnd() {
  if (_e3DndBound) return;
  const iframe = document.getElementById('e3-canvas');
  if (!iframe?.contentDocument) return;
  _e3DndBound = true;
  const doc = iframe.contentDocument;

  function acceptDrag(ev) {
    const types = Array.from(ev.dataTransfer?.types || []);
    return types.includes('text/e3-sec-type') || types.includes('text/plain');
  }

  doc.addEventListener('dragenter', ev => {
    if (!acceptDrag(ev)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    const empty = doc.querySelector('.e3-empty');
    if (empty) empty.style.borderColor = '#2563eb';
  });
  doc.addEventListener('dragleave', ev => {
    if (!ev.relatedTarget || !doc.contains(ev.relatedTarget)) {
      const empty = doc.querySelector('.e3-empty');
      if (empty) empty.style.borderColor = '';
    }
  });
  doc.addEventListener('dragover', ev => {
    if (!acceptDrag(ev)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    const markers = [...doc.querySelectorAll('.e3-drop')];
    if (markers.length) {
      let closest = null, best = Infinity;
      for (const m of markers) {
        const r = m.getBoundingClientRect();
        const d = Math.abs((r.top + r.bottom) / 2 - ev.clientY);
        if (d < best) { best = d; closest = m; }
      }
      markers.forEach(m => m.classList.toggle('e3-active', m === closest));
    }
  });
  doc.addEventListener('drop', ev => {
    const type = ev.dataTransfer.getData('text/e3-sec-type') || ev.dataTransfer.getData('text/plain');
    if (!type) return;
    const variantId = ev.dataTransfer.getData('text/e3-variant') || null;
    ev.preventDefault(); ev.stopPropagation();
    const empty = doc.querySelector('.e3-empty');
    if (empty) empty.style.borderColor = '';
    const active = doc.querySelector('.e3-drop.e3-active');
    const idx = active ? parseInt(active.dataset.dropidx, 10) : (e3.activeTpl?.secciones || []).length;
    doc.querySelectorAll('.e3-drop').forEach(m => m.classList.remove('e3-active'));
    addSection(type, idx, variantId);
  });
}

function addSection(type, atIdx, variantId) {
  const def = SECTIONS[type];
  if (!def) return;
  const sec = createSection(type);
  if (!sec) return;
  if (variantId) {
    const v = (e3Modulos[type]?.variantes || []).find(x => x.id === variantId);
    if (v) {
      sec.data   = { ...sec.data,   ...(v.data   || {}) };
      sec.design = { ...sec.design, ...(v.design || {}) };
      sec.variantId = v.id;
      if (v.alerta === true) sec.alerta = true;
    }
  }
  const secs = e3.activeTpl.secciones = e3.activeTpl.secciones || [];
  if (typeof atIdx === 'number') secs.splice(atIdx, 0, sec);
  else secs.push(sec);
  e3.selectedSecId = sec.id;
  markDirty();
  renderCanvas(); renderProps();
}

function moveSection(id, delta) {
  const secs = e3.activeTpl.secciones;
  const i = secs.findIndex(s => s.id === id);
  if (i < 0) return;
  const j = i + delta;
  if (j < 0 || j >= secs.length) return;
  [secs[i], secs[j]] = [secs[j], secs[i]];
  markDirty(); renderCanvas();
}

function deleteSection(id) {
  if (!confirm('¿Eliminar esta sección?')) return;
  e3.activeTpl.secciones = e3.activeTpl.secciones.filter(s => s.id !== id);
  if (e3.selectedSecId === id) e3.selectedSecId = null;
  markDirty(); renderCanvas(); renderProps();
}

function markDirty() { e3.dirty = true; document.getElementById('e3-dirty').style.display = 'inline'; }
function clearDirty() { e3.dirty = false; document.getElementById('e3-dirty').style.display = 'none'; }

// ─── PROPS PANEL ────────────────────────────────────────────────────
function renderProps() {
  const body = document.getElementById('e3-props-body');
  if (!body) return;
  const typeEl = document.getElementById('e3-props-type');
  const sec = (e3.activeTpl?.secciones || []).find(s => s.id === e3.selectedSecId);
  if (!sec) { body.innerHTML = '<div class="props-empty">Click sobre una sección del canvas para editarla.</div>'; if (typeEl) typeEl.textContent = 'Propiedades'; return; }
  const def = SECTIONS[sec.type];
  if (!def) { body.innerHTML = `<div class="props-empty">Tipo desconocido: ${sec.type}</div>`; return; }
  if (typeEl) typeEl.textContent = def.label;
  const fields = e3.propsTab === 'data' ? def.dataFields : def.designFields;
  body.innerHTML = alertaFieldHTML(sec) + (fields || []).map(f => fieldHTML(f, sec[e3.propsTab]?.[f.name], e3.propsTab)).join('');
  bindFieldEvents(sec);
  bindAlertaField(sec);
}

// Check de alerta a nivel sección (módulo). Se persiste dentro de cada
// objeto de `secciones`, así el scheduler del backend sabe qué módulos
// deben disparar la alerta de vencimiento (id_alerta=1) al vencer la plantilla.
function alertaFieldHTML(sec) {
  return `<div class="props-field" style="border:1px solid #fed7aa;background:#fff7ed;padding:.6rem;margin-bottom:.85rem;">
    <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.6875rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9a3412;">
      <input type="checkbox" id="e3-sec-alerta" ${sec.alerta ? 'checked' : ''}/> ⚠ Alerta de vencimiento
    </label>
    <div style="font-size:.6rem;color:#b45309;margin-top:.35rem;line-height:1.4;">Si está activo, se envía una alerta (ID 1) cuando esta plantilla venza.</div>
  </div>`;
}

function bindAlertaField(sec) {
  const cb = document.getElementById('e3-sec-alerta');
  if (!cb) return;
  cb.addEventListener('change', () => { sec.alerta = cb.checked; markDirty(); });
}

function fieldHTML(f, val, group) {
  const safe = escAttr(val);
  switch (f.type) {
    case 'text':
      return `<div class="props-field"><label class="props-label">${f.label}</label><input class="props-input" type="text" data-ef="${f.name}" data-eg="${group}" value="${safe}"/></div>`;
    case 'textarea':
      return `<div class="props-field"><label class="props-label">${f.label}</label><textarea class="props-textarea" data-ef="${f.name}" data-eg="${group}" style="min-height:80px;">${escAttr(val).replace(/&quot;/g,'"')}</textarea></div>`;
    case 'image':
      return `<div class="props-field"><label class="props-label">${f.label}</label>
        <div style="display:flex;gap:.4rem;align-items:center;">
          <input class="props-input" type="text" data-ef="${f.name}" data-eg="${group}" value="${safe}" placeholder="/img/… o URL externa" style="flex:1;"/>
          <button type="button" class="btn-edit-small" data-eimg="${f.name}" data-eg="${group}" title="Elegir imagen"><i class="fa-solid fa-image"></i></button>
        </div>
        <img data-eimgprev="${f.name}" data-eg="${group}" src="${safe}" alt="" style="margin-top:.4rem;max-height:70px;border:1px solid var(--slate-200);border-radius:.35rem;background:#fff;object-fit:contain;${val ? '' : 'display:none;'}" onerror="this.style.display='none'"/>
      </div>`;
    case 'number':
      return `<div class="props-field"><label class="props-label">${f.label}</label><input class="props-input" type="number" data-ef="${f.name}" data-eg="${group}" min="${f.min ?? 0}" max="${f.max ?? 9999}" value="${val ?? ''}"/></div>`;
    case 'color': {
      const v = val || '#000000';
      const isHex = /^#[0-9a-f]{3,8}$/i.test(v);
      return `<div class="props-field"><label class="props-label">${f.label}</label>
        <div class="props-color-row">
          <input class="props-color" type="color" data-ef="${f.name}" data-eg="${group}" data-epicker value="${isHex ? v : '#000000'}"/>
          <input class="props-input" type="text" data-ef="${f.name}" data-eg="${group}" value="${safe}" placeholder="#fff o rgba(...)" style="flex:1;"/>
        </div></div>`;
    }
    case 'select':
      return `<div class="props-field"><label class="props-label">${f.label}</label>
        <select class="props-input" data-ef="${f.name}" data-eg="${group}">
          ${(f.options||[]).map(o=>`<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}
        </select></div>`;
    case 'toggle':
      return `<div class="props-field"><label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.6875rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--slate-500);"><input type="checkbox" data-ef="${f.name}" data-eg="${group}" data-etoggle ${val ? 'checked' : ''}/> ${f.label}</label></div>`;
    case 'cards':      return arrayEditorHTML('cards',     val || [], ['titulo','descripcion','link'], { titulo: 'Título', descripcion: 'Descripción', link: 'Link' });
    case 'spec-cards': return arrayEditorHTML('cards',     val || [], ['badge','titulo','desc'],       { badge: 'Badge', titulo: 'Título', desc: 'Descripción' });
    case 'logos':      return arrayEditorHTML('logos',     val || [], ['nombre','imagen'],            { nombre: 'Nombre', imagen: 'URL imagen' });
    case 'clientes':   return arrayEditorHTML('clientes',  val || [], ['nombre','imagen'],            { nombre: 'Nombre', imagen: 'URL imagen' }, { activo: true });
    case 'posts':      return arrayEditorHTML('posts',     val || [], ['titulo','categoria','extracto','imagen'], { titulo: 'Título', categoria: 'Categoría', extracto: 'Extracto', imagen: 'URL imagen' });
    case 'features-icon':  return iconFeaturesEditorHTML(val || []);
    case 'features-emoji': return arrayEditorHTML('emoji-features', val || [], ['emoji','titulo','desc'], { emoji: 'Emoji (paste)', titulo: 'Título', desc: 'Descripción' });
    case 'text-list':  return textListEditorHTML(val || []);
    case 'link-list':  return arrayEditorHTML('links',     val || [], ['label','href'],                { label: 'Label', href: 'URL' });
    case 'contact-item':return contactItemEditorHTML(f.name, val || {});
    default:
      return `<div class="props-field"><label class="props-label">${f.label}</label><input class="props-input" type="text" data-ef="${f.name}" data-eg="${group}" value="${safe}"/></div>`;
  }
}

function arrayEditorHTML(kind, items, fieldKeys, labels, extraToggle) {
  return `<div class="props-field"><label class="props-label">${kind}</label><div data-e3-arr="${kind}">
    ${items.map((it, i) => `
      <div data-e3-aitem="${i}" style="border:1px solid var(--slate-200);padding:.55rem;margin-bottom:.4rem;background:var(--slate-50);">
        ${fieldKeys.map(k => {
          if (labels[k]?.toLowerCase().includes('extracto') || labels[k]?.toLowerCase().includes('descripción'))
            return `<textarea class="props-textarea" data-e3-akey="${k}" placeholder="${labels[k]}" style="margin-bottom:.3rem;min-height:50px;">${escAttr(it[k]||'').replace(/&quot;/g,'"')}</textarea>`;
          if (k === 'imagen')
            return `<div style="display:flex;gap:.3rem;margin-bottom:.3rem;">
              <input class="props-input" data-e3-akey="${k}" value="${escAttr(it[k]||'')}" placeholder="${labels[k]}" style="flex:1;"/>
              <button type="button" class="btn-edit-small" data-e3-aimg title="Elegir imagen"><i class="fa-solid fa-image"></i></button>
            </div>`;
          return `<input class="props-input" data-e3-akey="${k}" value="${escAttr(it[k]||'')}" placeholder="${labels[k]}" style="margin-bottom:.3rem;"/>`;
        }).join('')}
        ${extraToggle ? `<label style="display:flex;align-items:center;gap:.4rem;font-size:.65rem;color:var(--slate-500);cursor:pointer;"><input type="checkbox" data-e3-akey="activo" ${it.activo !== false ? 'checked' : ''}/> Activo</label>` : ''}
        <button class="btn-edit-small" data-e3-aremove="${i}" style="color:#dc2626;border-color:#fca5a5;width:100%;margin-top:.3rem;"><i class="fa-solid fa-trash"></i> Quitar</button>
      </div>`).join('')}
    <button class="btn-edit-small" data-e3-aadd style="width:100%;"><i class="fa-solid fa-plus"></i> Agregar</button>
  </div></div>`;
}

function iconFeaturesEditorHTML(items) {
  return `<div class="props-field"><label class="props-label">Features (con iconos)</label><div data-e3-arr="icon-features">
    ${items.map((it, i) => `
      <div data-e3-aitem="${i}" style="border:1px solid var(--slate-200);padding:.55rem;margin-bottom:.4rem;background:var(--slate-50);">
        <label class="props-label" style="font-size:.55rem;">Icono</label>
        <select class="props-input" data-e3-akey="iconType" style="margin-bottom:.3rem;">
          ${ICON_CATALOG.map(ic => `<option value="${ic}" ${it.iconType === ic ? 'selected' : ''}>${ic}</option>`).join('')}
        </select>
        <input class="props-input" data-e3-akey="titulo" value="${escAttr(it.titulo||'')}" placeholder="Título" style="margin-bottom:.3rem;"/>
        <textarea class="props-textarea" data-e3-akey="desc" placeholder="Descripción" style="margin-bottom:.3rem;min-height:50px;">${escAttr(it.desc||'').replace(/&quot;/g,'"')}</textarea>
        <button class="btn-edit-small" data-e3-aremove="${i}" style="color:#dc2626;border-color:#fca5a5;width:100%;"><i class="fa-solid fa-trash"></i> Quitar</button>
      </div>`).join('')}
    <button class="btn-edit-small" data-e3-aadd style="width:100%;"><i class="fa-solid fa-plus"></i> Agregar feature</button>
  </div></div>`;
}

function textListEditorHTML(items) {
  return `<div class="props-field"><label class="props-label">Líneas (orden importa)</label><div data-e3-arr="text-list">
    ${items.map((s, i) => `
      <div data-e3-aitem="${i}" style="display:flex;gap:.3rem;margin-bottom:.3rem;">
        <input class="props-input" data-e3-akey="_text" value="${escAttr(s)}" style="flex:1;font-family:monospace;"/>
        <button class="btn-edit-small" data-e3-aremove="${i}" style="color:#dc2626;border-color:#fca5a5;"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join('')}
    <button class="btn-edit-small" data-e3-aadd style="width:100%;"><i class="fa-solid fa-plus"></i> Agregar línea</button>
  </div></div>`;
}

function contactItemEditorHTML(fieldName, item) {
  return `<div class="props-field"><label class="props-label">${fieldName}</label>
    <div data-e3-contact="${fieldName}" style="border:1px solid var(--slate-200);padding:.55rem;background:var(--slate-50);">
      <input class="props-input" data-e3-ckey="tipo" value="${escAttr(item.tipo||'')}" placeholder="Tipo (ej: Oficina)" style="margin-bottom:.3rem;"/>
      <textarea class="props-textarea" data-e3-ckey="valor" placeholder="Valor (HTML permitido)" style="margin-bottom:.3rem;min-height:50px;">${escAttr(item.valor||'').replace(/&quot;/g,'"')}</textarea>
      <input class="props-input" data-e3-ckey="href" value="${escAttr(item.href||'')}" placeholder="URL (opcional)"/>
    </div></div>`;
}

function bindFieldEvents(sec) {
  const body = document.getElementById('e3-props-body');

  // Simple fields
  body.querySelectorAll('[data-ef]').forEach(inp => {
    if (inp.dataset.epicker !== undefined) return;
    inp.addEventListener('input', () => {
      const f = inp.dataset.ef, g = inp.dataset.eg;
      sec[g] = sec[g] || {};
      let v = inp.value;
      if (inp.type === 'number') v = v === '' ? '' : Number(v);
      if (inp.dataset.etoggle !== undefined) v = inp.checked;
      sec[g][f] = v;
      markDirty(); renderCanvas();
    });
  });

  // Color pickers
  body.querySelectorAll('[data-epicker]').forEach(picker => {
    picker.addEventListener('input', () => {
      const f = picker.dataset.ef, g = picker.dataset.eg;
      sec[g] = sec[g] || {};
      sec[g][f] = picker.value;
      const text = body.querySelector(`input[type=text][data-ef="${f}"][data-eg="${g}"]`);
      if (text) text.value = picker.value;
      markDirty(); renderCanvas();
    });
  });

  // Campos de imagen: botón "Elegir" → abre el selector modal
  body.querySelectorAll('[data-eimg]').forEach(btn => {
    const f = btn.dataset.eimg, g = btn.dataset.eg;
    const input = body.querySelector(`input[data-ef="${f}"][data-eg="${g}"]`);
    const prev = body.querySelector(`img[data-eimgprev="${f}"][data-eg="${g}"]`);
    const syncPrev = () => { if (!prev) return; const v = input?.value || ''; prev.src = v; prev.style.display = v ? '' : 'none'; };
    input?.addEventListener('input', syncPrev);
    btn.addEventListener('click', async () => {
      const path = await window.__imgPicker?.open({ current: input?.value || '' });
      if (path && input) {
        input.value = path;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        syncPrev();
      }
    });
  });

  // Array editors (cards / spec-cards / logos / clientes / posts / icon-features / emoji-features / links / text-list)
  body.querySelectorAll('[data-e3-arr]').forEach(arrWrap => {
    const kind = arrWrap.dataset.e3Arr;
    // Map kind → sec.data field name + new-item template
    const arrMap = {
      'cards':           { key: 'cards',    newItem: () => ({ titulo: 'Nuevo', descripcion: '', link: '' }) },
      'logos':           { key: 'logos',    newItem: () => ({ nombre: 'Nuevo logo', imagen: '' }) },
      'clientes':        { key: 'clientes', newItem: () => ({ nombre: 'Nuevo cliente', imagen: '', activo: true }) },
      'posts':           { key: 'posts',    newItem: () => ({ titulo: 'Nuevo post', categoria: '', extracto: '', imagen: '' }) },
      'icon-features':   { key: 'features', newItem: () => ({ iconType: 'gear', titulo: 'Nuevo feature', desc: '' }) },
      'emoji-features':  { key: 'features', newItem: () => ({ emoji: '⭐', titulo: 'Nuevo', desc: '' }) },
      'links':           { key: 'servicios',newItem: () => ({ label: 'Nuevo link', href: '#' }) },
      'text-list':       { key: 'codeRows', newItem: () => '' },
    };
    const cfg = arrMap[kind];
    if (!cfg) return;
    // Detect actual key: spec-cards goes in data.cards; cards-in-services also data.cards
    // For spec-cards/cards we use 'cards' key. For features (icon|emoji) use 'features'.
    // For links: in footer-full it's "servicios". This is a known limitation — for now we use the field type.
    // Better: pass the field name. For now, find a key in sec.data whose value matches val.
    // Simpler approach: look up by which dataField uses this type.
    const def = SECTIONS[sec.type];
    const ownerField = def?.dataFields?.find(df => {
      if (kind === 'cards')          return df.type === 'cards' || df.type === 'spec-cards';
      if (kind === 'logos')          return df.type === 'logos';
      if (kind === 'clientes')      return df.type === 'clientes';
      if (kind === 'posts')         return df.type === 'posts';
      if (kind === 'icon-features') return df.type === 'features-icon';
      if (kind === 'emoji-features')return df.type === 'features-emoji';
      if (kind === 'links')         return df.type === 'link-list';
      if (kind === 'text-list')     return df.type === 'text-list';
      return false;
    });
    const arrField = ownerField?.name || cfg.key;

    arrWrap.querySelectorAll('[data-e3-aitem]').forEach(item => {
      const idx = parseInt(item.dataset.e3Aitem, 10);
      item.querySelectorAll('[data-e3-akey]').forEach(inp => {
        const evt = inp.type === 'checkbox' ? 'change' : 'input';
        inp.addEventListener(evt, () => {
          sec.data[arrField] = sec.data[arrField] || [];
          if (kind === 'text-list') {
            sec.data[arrField][idx] = inp.value;
          } else {
            sec.data[arrField][idx] = sec.data[arrField][idx] || {};
            sec.data[arrField][idx][inp.dataset.e3Akey] = inp.type === 'checkbox' ? inp.checked : inp.value;
          }
          markDirty(); renderCanvas();
        });
      });
      item.querySelector('[data-e3-aimg]')?.addEventListener('click', async () => {
        const inp = item.querySelector('[data-e3-akey="imagen"]');
        const path = await window.__imgPicker?.open({ current: inp?.value || '' });
        if (path && inp) { inp.value = path; inp.dispatchEvent(new Event('input', { bubbles: true })); }
      });
      item.querySelector('[data-e3-aremove]')?.addEventListener('click', () => {
        sec.data[arrField].splice(idx, 1);
        markDirty(); renderCanvas(); renderProps();
      });
    });
    arrWrap.querySelector('[data-e3-aadd]')?.addEventListener('click', () => {
      sec.data[arrField] = sec.data[arrField] || [];
      sec.data[arrField].push(cfg.newItem());
      markDirty(); renderCanvas(); renderProps();
    });
  });

  // Contact-item single object editor
  body.querySelectorAll('[data-e3-contact]').forEach(wrap => {
    const fname = wrap.dataset.e3Contact;
    wrap.querySelectorAll('[data-e3-ckey]').forEach(inp => {
      inp.addEventListener('input', () => {
        sec.data[fname] = sec.data[fname] || {};
        sec.data[fname][inp.dataset.e3Ckey] = inp.value;
        markDirty(); renderCanvas();
      });
    });
  });
}

// ─── SAVE ──────────────────────────────────────────────────────────
async function guardarPlantilla() {
  if (!e3.activeTpl) return;
  try {
    const { plantilla } = await api('PATCH', `/plantillas/${e3.activeTpl.id_plantilla}`, {
      nombre: e3.activeTpl.nombre,
      descripcion: e3.activeTpl.descripcion,
      secciones: e3.activeTpl.secciones,
    });
    e3.activeTpl = plantilla; clearDirty();
    const idx = e3.plantillas.findIndex(p => p.id_plantilla === plantilla.id_plantilla);
    if (idx >= 0) e3.plantillas[idx] = plantilla;
    renderSidebarList();
    notif(plantilla.activa
      ? '✓ Guardado — cambios en vivo en /' + plantilla.tipo + '.html'
      : '✓ Borrador guardado — activalo para verlo en /' + plantilla.tipo + '.html');
  } catch (e) { notif('Error: ' + e.message, 'error'); }
}

// ─── Quick access (dashboard card + sidebar link) ───────────────────
function goToPlantillas() {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-plantillas').classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
  document.getElementById('sidebar-go-plantillas')?.classList.add('active');
  document.getElementById('topbar-title').textContent = 'Plantillas';
  loadPlantillas();
}

function injectSidebarLink() {
  if (document.getElementById('sidebar-go-plantillas')) return;
  const label = document.querySelector('.sidebar-section-label span');
  if (!label || label.textContent.trim() !== 'Plantillas') return;
  const sb = document.createElement('div');
  sb.className = 'sidebar-item';
  sb.id = 'sidebar-go-plantillas';
  sb.style.cssText = 'font-size:.65rem;font-weight:600;color:rgba(255,255,255,.6);';
  sb.innerHTML = `<i class="fa-solid fa-layer-group"></i>Ver todas las plantillas`;
  sb.addEventListener('click', goToPlantillas);
  label.parentElement.insertAdjacentElement('afterend', sb);
}

function injectDashboardCard() {
  const dash = document.getElementById('panel-dashboard');
  if (!dash || document.getElementById('dash-go-plantillas')) return;
  const card = document.createElement('div');
  card.id = 'dash-go-plantillas';
  card.style.cssText = 'background:linear-gradient(135deg,#0A1D37,#1e3a8a);color:#fff;padding:1.5rem 2rem;margin-bottom:1.5rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:1.5rem;flex-wrap:wrap;box-shadow:0 4px 16px rgba(10,29,55,.15);transition:transform .15s,box-shadow .15s;';
  card.innerHTML = `
    <div>
      <div style="font-size:.55rem;font-weight:900;letter-spacing:.3em;text-transform:uppercase;color:#60a5fa;margin-bottom:.4rem;">EDITOR VISUAL</div>
      <div style="font-size:1.25rem;font-weight:900;letter-spacing:-.02em;margin-bottom:.25rem;">Plantillas del sitio</div>
      <div style="font-size:.8125rem;color:rgba(255,255,255,.7);">Editá visualmente cada HTML del sitio. Cada plantilla controla en vivo su página correspondiente.</div>
    </div>
    <div style="background:#2563eb;color:#fff;padding:.75rem 1.5rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;font-size:.7rem;white-space:nowrap;">Ir a Plantillas <i class="fa-solid fa-arrow-right fa-lg"></i></div>`;
  card.addEventListener('mouseenter', () => card.style.transform = 'translateY(-2px)');
  card.addEventListener('mouseleave', () => card.style.transform = 'translateY(0)');
  card.addEventListener('click', goToPlantillas);
  const pageHeader = dash.querySelector('.page-header');
  if (pageHeader) pageHeader.insertAdjacentElement('afterend', card);
  else dash.insertAdjacentElement('afterbegin', card);
}

// ─── Init: override old plantilla buttons + inject UI ───────────────
function initE3() {
  populateTipoSelect();
  injectSidebarLink();
  injectDashboardCard();

  // Fix: el botón "Ver todas las plantillas" tiene un handler viejo que
  // llama openTemplateEditor con un ID del estado legacy. Lo reemplazamos.
  const goBtn = stripListeners(document.getElementById('sidebar-go-plantillas'));
  if (goBtn) goBtn.addEventListener('click', goToPlantillas);

  const a = stripListeners(document.getElementById('btn-nueva-plantilla-main'));
  if (a) a.addEventListener('click', () => openNuevaModal());

  const b = stripListeners(document.getElementById('btn-nueva-plantilla'));
  if (b) b.addEventListener('click', () => openNuevaModal());

  const c = stripListeners(document.getElementById('crear-plantilla-btn'));
  if (c) c.addEventListener('click', crearPlantilla);

  // Override old globals so any leftover async old code doesn't overwrite our renders
  window.renderSidebarTemplates = renderSidebarList;
  window.renderTemplateOverview = renderOverview;
  window.openTemplateEditor = (id) => openEditor(id);
  window.openTemplateEditorFromList = (id) => openEditor(id);
  window.setActiveTpl = (id) => activarPlantilla(id);
  window.deleteTpl = (id) => eliminarPlantilla(id);
  window.saveTpl = () => guardarPlantilla();

  loadPlantillas();
}

const appEl = document.getElementById('app');
function tryInit() {
  if (!appEl) return false;
  const visible = appEl.style.display === 'block' || getComputedStyle(appEl).display !== 'none';
  if (visible) { initE3(); return true; }
  return false;
}
if (!tryInit()) {
  const obs = new MutationObserver(() => { if (tryInit()) obs.disconnect(); });
  obs.observe(appEl, { attributes: true, attributeFilter: ['style'] });
}

/* ═══════════════════════════════════════════════════════
   MÓDULOS — catálogo 3-views: tipos → variantes → editor
   ═══════════════════════════════════════════════════════ */
const MOD_GROUPS = [
  { label: 'Globales',         types: ['nav','footer','footer-full','cta','spacer'] },
  { label: 'Inicio',           types: ['hero','hero-centered','clientes','blog','services','about'] },
  { label: 'Cableado',         types: ['cableado-hero'] },
  { label: 'Fibra Óptica',     types: ['fibra-hero'] },
  { label: 'Seguridad',        types: ['seguridad-hero'] },
  { label: 'Soporte IT',       types: ['soporte-hero'] },
  { label: 'Desarrollo',       types: ['desarrollo-hero'] },
  { label: 'Blog / Artículos', types: ['blog-list','articulo-header','articulo-body'] },
  { label: 'Clientes',         types: ['cliente-header','cliente-body'] },
];
const SIMPLE_FIELD_TYPES = ['text','textarea','number','color','toggle'];

let _modData       = {};   // { [type]: { variantes: [...] } }
let _curModType    = null;
let _curVariantId  = null;
let _curModData    = { nombre: '', alerta: false, data: {}, design: {} };

function _showView(id) {
  ['modulos-catalog-view','modulos-variants-view','modulos-editor-view'].forEach(v => {
    const el = document.getElementById(v);
    if (el) el.style.display = v === id ? '' : 'none';
  });
  // Hide preview when leaving editor
  if (id !== 'modulos-editor-view') {
    const card = document.getElementById('modulos-preview-card');
    if (card) card.style.display = 'none';
  }
}

window.loadModulos = async function() {
  try {
    const res = await window.__svc.apiGet('/modulos');
    _modData = res.modulos || {};
    renderModCatalog();
  } catch(e) {
    window.__svc.showNotif('Error cargando módulos: ' + e.message, 'error');
  }
};

/* ── Vista 1: Catálogo ── */
function renderModCatalog() {
  _showView('modulos-catalog-view');
  const grid = document.getElementById('modulos-grid');
  if (!grid) return;
  grid.innerHTML = MOD_GROUPS.flatMap(group => {
    const cards = group.types.filter(t => SECTIONS[t]).map(t => {
      const sec = SECTIONS[t];
      const count = (_modData[t]?.variantes || []).length;
      const hasDesign = (sec.designFields || []).length > 0;
      return `<div class="section-card" style="margin:0;">
        <div class="section-card-body" style="padding:1rem;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.75rem;">
            <div>
              <span style="font-size:1.4rem;line-height:1;display:block;margin-bottom:.35rem;"></span>
              <div style="font-size:.78rem;font-weight:700;color:#1e293b;margin-bottom:.2rem;">${sec.label}</div>
              <div style="font-size:.68rem;color:#64748b;line-height:1.4;">${sec.description || ''}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.3rem;flex-shrink:0;">
              ${count > 0 ? `<span style="font-size:.5rem;background:#dbeafe;color:#1d4ed8;padding:.15rem .4rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;border-radius:2px;">${count} variante${count !== 1 ? 's' : ''}</span>` : ''}
              ${hasDesign ? `<span style="font-size:.5rem;background:#f0fdf4;color:#166534;padding:.15rem .4rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;border-radius:2px;">DISEÑO</span>` : ''}
            </div>
          </div>
          <button class="btn-edit-small" style="width:100%;" onclick="openModVariants('${t}')">Ver variantes</button>
        </div>
      </div>`;
    });
    if (!cards.length) return [];
    return [
      `<div style="grid-column:1/-1;padding-top:.25rem;"><span style="font-size:.58rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#94a3b8;">${group.label}</span></div>`,
      ...cards,
    ];
  }).join('');
}

/* ── Vista 2: Lista de variantes ── */
window.openModVariants = function(type) {
  const sec = SECTIONS[type];
  if (!sec) return;
  _curModType = type;
  _showView('modulos-variants-view');
  const titleEl = document.getElementById('modulos-variants-title');
  const descEl  = document.getElementById('modulos-variants-desc');
  if (titleEl) titleEl.innerHTML = `${sec.icon || ''} ${sec.label}`;
  if (descEl)  descEl.textContent  = sec.description || '';
  renderVariantsList();
};

function renderVariantsList() {
  const tbody = document.getElementById('modulos-variants-tbody');
  if (!tbody) return;
  const variantes = _modData[_curModType]?.variantes || [];
  if (!variantes.length) {
    tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;padding:2rem;color:var(--slate-400);font-size:.75rem;">Sin variantes. Creá una nueva.</td></tr>`;
    return;
  }
  tbody.innerHTML = variantes.map((v, idx) => {
    const isFirst = idx === 0;
    const canDelete = variantes.length > 1;
    return `<tr>
      <td style="font-size:.78rem;font-weight:600;color:var(--slate-800);">
        ${v.nombre || v.id}
        ${isFirst ? `<span style="font-size:.5rem;background:#f1f5f9;color:#64748b;padding:.1rem .35rem;margin-left:.4rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border-radius:2px;">DEFAULT</span>` : ''}
      </td>
      <td style="text-align:right;padding-right:1rem;">
        <div style="display:flex;gap:.4rem;justify-content:flex-end;">
          <button class="btn-edit-small" onclick="openModEditor('${_curModType}','${v.id}')">Editar</button>
          <button class="btn-edit-small" style="background:#f1f5f9;color:#334155;" onclick="duplicarVariante('${_curModType}','${v.id}')">Duplicar</button>
          ${canDelete ? `<button class="btn-edit-small" style="background:#fee2e2;color:#991b1b;" onclick="eliminarVariante('${_curModType}','${v.id}')">Eliminar</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ── Vista 3: Editor de variante ── */
window.openModEditor = function(type, variantId) {
  const sec = SECTIONS[type];
  if (!sec) return;
  _curModType   = type;
  _curVariantId = variantId;

  const variantes = _modData[type]?.variantes || [];
  const variant   = variantes.find(v => v.id === variantId) || variantes[0];
  if (!variant) return;

  _curModData = {
    nombre: variant.nombre || '',
    alerta: variant.alerta === true,
    data:   { ...sec.defaultData,   ...(variant.data   || {}) },
    design: { ...sec.defaultDesign, ...(variant.design || {}) },
  };

  const titleEl = document.getElementById('modulos-editor-title');
  const nameEl  = document.getElementById('modulos-editor-variant-name');
  if (titleEl) titleEl.innerHTML = `${sec.icon || ''} ${sec.label}`;
  if (nameEl)  nameEl.textContent  = variant.nombre || '';

  const nameInput = document.getElementById('modulos-variant-name-input');
  if (nameInput) {
    nameInput.value = variant.nombre || '';
    nameInput.oninput = () => { _curModData.nombre = nameInput.value; };
  }

  const alertaInput = document.getElementById('modulos-variant-alerta');
  if (alertaInput) {
    alertaInput.checked = _curModData.alerta;
    alertaInput.onchange = () => { _curModData.alerta = alertaInput.checked; };
  }

  renderModFieldGroup('data',   sec.dataFields   || [], 'modulos-editor-data-fields');
  renderModFieldGroup('design', sec.designFields || [], 'modulos-editor-design-fields');

  const designCard = document.getElementById('modulos-editor-design-card');
  if (designCard) designCard.style.display = (sec.designFields || []).length ? '' : 'none';

  renderModContentCard(type);

  _showView('modulos-editor-view');
};

/* ── Gestión de contenido global embebida (blog posts / clientes) ──
   Para los módulos `blog` y `clientes`, el contenido real (artículos / logos)
   vive en blog.json / clientes.json y se hidrata en vivo en el sitio, por lo
   que editarlo acá se aplica automáticamente a TODAS las variantes del módulo.
   Reutilizamos las funciones de gestión definidas en panel.js. */
const MOD_CONTENT_CONFIG = {
  blog: {
    title: 'Artículos del blog',
    addLabel: '<i class="fa-solid fa-plus"></i> Nuevo artículo',
    bodyHTML: '<div class="blog-grid" id="blog-list"></div>',
    render: () => window.renderBlogList?.(),
    add:    () => window.openNewPost?.(),
  },
  clientes: {
    title: 'Logos / Clientes',
    addLabel: '<i class="fa-solid fa-plus"></i> Agregar',
    bodyHTML: `<div class="data-table-scroll" style="padding:0;">
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Logo</th><th>Carrusel</th><th>Perfil</th><th>Acciones</th></tr></thead>
        <tbody id="clientes-tbody"></tbody>
      </table>
    </div>`,
    render: () => window.renderClientesList?.(),
    add:    () => window.openNewCliente?.(),
  },
};

function renderModContentCard(type) {
  const card = document.getElementById('modulos-editor-content-card');
  if (!card) return;
  const cfg = MOD_CONTENT_CONFIG[type];
  if (!cfg) { card.style.display = 'none'; return; }
  card.style.display = '';
  const titleEl = document.getElementById('modulos-content-title');
  if (titleEl) titleEl.textContent = cfg.title;
  const body = document.getElementById('modulos-content-body');
  if (body) { body.innerHTML = cfg.bodyHTML; cfg.render(); }
  const addBtn = document.getElementById('modulos-content-add-btn');
  if (addBtn) { addBtn.innerHTML = cfg.addLabel; addBtn.onclick = cfg.add; }
}

function renderModFieldGroup(group, fields, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const editableFields = fields.filter(f => SIMPLE_FIELD_TYPES.includes(f.type));
  const complexFields  = fields.filter(f => !SIMPLE_FIELD_TYPES.includes(f.type));

  const fieldHtml = editableFields.map(f => {
    const val = _curModData[group]?.[f.name] ?? '';
    const attrs = `data-mf="${f.name}" data-mg="${group}"`;
    if (f.type === 'textarea') return `<div>
      <label class="form-label">${f.label}</label>
      <textarea class="form-input" rows="3" style="resize:vertical;" ${attrs}>${String(val).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
    </div>`;
    if (f.type === 'toggle') return `<div style="display:flex;align-items:center;gap:.75rem;">
      <input type="checkbox" id="mf-${group}-${f.name}" ${attrs} ${val ? 'checked' : ''} style="width:1.1rem;height:1.1rem;flex-shrink:0;">
      <label for="mf-${group}-${f.name}" class="form-label" style="margin:0;">${f.label}</label>
    </div>`;
    if (f.type === 'color') return `<div>
      <label class="form-label">${f.label}</label>
      <div style="display:flex;gap:.5rem;align-items:center;">
        <input type="color" ${attrs} value="${String(val||'#000000')}" style="width:2.5rem;height:2rem;border:none;padding:0;cursor:pointer;flex-shrink:0;">
        <input type="text" class="form-input" data-mf="${f.name}-txt" data-mg="${group}" value="${String(val||'').replace(/"/g,'&quot;')}" style="flex:1;" placeholder="#rrggbb">
      </div>
    </div>`;
    if (f.type === 'number') return `<div>
      <label class="form-label">${f.label}</label>
      <input type="number" class="form-input" ${attrs} value="${val}" ${f.min!=null?`min="${f.min}"`:''}  ${f.max!=null?`max="${f.max}"`:''}>
    </div>`;
    return `<div>
      <label class="form-label">${f.label}</label>
      <input type="text" class="form-input" ${attrs} value="${String(val).replace(/"/g,'&quot;')}"${f.placeholder ? ` placeholder="${String(f.placeholder).replace(/"/g,'&quot;')}"` : ''}>
    </div>`;
  }).join('');

  const complexNote = complexFields.length
    ? `<div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:.375rem;padding:.75rem;font-size:.7rem;color:#64748b;line-height:1.6;">
        <strong style="color:#475569;">Campos avanzados (editables en el editor de plantilla):</strong><br>
        ${complexFields.map(f => f.label).join(' · ')}
      </div>`
    : '';

  container.innerHTML = (editableFields.length || complexFields.length)
    ? fieldHtml + complexNote
    : `<p style="font-size:.75rem;color:#94a3b8;padding:.5rem 0;">Sin campos editables en esta sección.</p>`;

  // Live sync
  container.querySelectorAll('[data-mf]').forEach(inp => {
    inp.addEventListener('input', () => {
      const field = inp.dataset.mf;
      const grp   = inp.dataset.mg;
      if (!field || !grp || field.endsWith('-txt')) return;
      let val;
      if (inp.type === 'checkbox') val = inp.checked;
      else if (inp.type === 'number') val = Number(inp.value);
      else val = inp.value;
      _curModData[grp] = _curModData[grp] || {};
      _curModData[grp][field] = val;
      if (inp.type === 'color') {
        const txt = container.querySelector(`[data-mf="${field}-txt"]`);
        if (txt) txt.value = val;
      }
    });
    if (inp.dataset.mf.endsWith('-txt')) {
      inp.addEventListener('input', () => {
        const realField = inp.dataset.mf.replace(/-txt$/, '');
        const picker = container.querySelector(`input[type=color][data-mf="${realField}"]`);
        if (picker && /^#[0-9a-fA-F]{6}$/.test(inp.value)) {
          picker.value = inp.value;
          _curModData[inp.dataset.mg] = _curModData[inp.dataset.mg] || {};
          _curModData[inp.dataset.mg][realField] = inp.value;
        }
      });
    }
  });
}

/* ── Preview de variante ── */
function previewCurrentVariant() {
  if (!_curModType) return;
  const sec = SECTIONS[_curModType];
  if (!sec) return;

  // Render section HTML with current data/design
  const html = sec.render(_curModData.data || {}, _curModData.design || {});

  // Pick CSS files for this section type
  const pageType = TYPE_TO_PAGE[_curModType] || 'index';
  const cssFiles = TIPO_CSS[pageType] || TIPO_CSS.index;
  const origin   = window.location.origin;
  const links    = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">\n' + cssFiles.map(f => `<link rel="stylesheet" href="${origin}${f}">`).join('\n');

  // Partir los tags para que Live Server no inyecte su script de hot-reload
  // dentro del template literal (busca </'+'body> literalmente).
  const _B = 'bo'+'dy', _H = 'hea'+'d';
  const srcdoc = `<!doctype html><html lang="es"><${_H}><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Inter:ital,wght@0,400;0,500;0,700;0,900;1,700;1,900&display=swap" rel="stylesheet">${links}<style>html,body{margin:0;padding:0;}body{overflow-x:hidden;}</style></${_H}><${_B}>${html}</${_B}></html>`;

  const card   = document.getElementById('modulos-preview-card');
  const iframe = document.getElementById('modulos-preview-iframe');
  if (!card || !iframe) return;

  iframe.srcdoc = srcdoc;
  card.style.display = '';

  // Auto-resize iframe to content height after load
  iframe.onload = () => {
    try {
      const h = iframe.contentDocument?.documentElement?.scrollHeight;
      if (h && h > 100) iframe.style.minHeight = h + 'px';
    } catch(e) { /* cross-origin sandbox */ }
  };

  // Scroll preview into view
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Duplicar variante ── */
window.duplicarVariante = async function(type, variantId) {
  const variantes = _modData[type]?.variantes || [];
  const origin = variantes.find(v => v.id === variantId);
  if (!origin) return;
  const nombre = `${origin.nombre} (copia)`;
  try {
    const res = await window.__svc.apiPost(`/modulos/${type}/variantes`, {
      nombre,
      data:   JSON.parse(JSON.stringify(origin.data || {})),
      design: JSON.parse(JSON.stringify(origin.design || {})),
    });
    if (!_modData[type]) _modData[type] = { variantes: [] };
    _modData[type].variantes.push(res.variante);
    renderVariantsList();
    window.__svc.showNotif('Variante duplicada', 'success');
  } catch(e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
  }
};

/* ── Eliminar variante ── */
window.eliminarVariante = async function(type, variantId) {
  const variantes = _modData[type]?.variantes || [];
  const v = variantes.find(x => x.id === variantId);
  if (!v) return;
  if (!confirm(`¿Eliminar la variante "${v.nombre}"?`)) return;
  try {
    await window.__svc.apiDelete(`/modulos/${type}/variantes/${variantId}`);
    _modData[type].variantes = _modData[type].variantes.filter(x => x.id !== variantId);
    renderVariantsList();
    window.__svc.showNotif('Variante eliminada', 'success');
  } catch(e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
  }
};

/* ── Botón: Preview ── */
document.getElementById('modulos-preview-btn')?.addEventListener('click', previewCurrentVariant);

/* ── Botón: cerrar Preview ── */
document.getElementById('modulos-preview-close-btn')?.addEventListener('click', () => {
  const card = document.getElementById('modulos-preview-card');
  if (card) card.style.display = 'none';
});

/* ── Botón: volver al catálogo ── */
document.getElementById('modulos-variants-back-btn')?.addEventListener('click', renderModCatalog);

/* ── Botón: volver a variantes ── */
document.getElementById('modulos-back-btn')?.addEventListener('click', () => openModVariants(_curModType));

/* ── Botón: nueva variante ── */
document.getElementById('modulos-add-variant-btn')?.addEventListener('click', async () => {
  if (!_curModType) return;
  const sec = SECTIONS[_curModType];
  const nombre = prompt('Nombre para la nueva variante:');
  if (!nombre?.trim()) return;
  try {
    const res = await window.__svc.apiPost(`/modulos/${_curModType}/variantes`, {
      nombre: nombre.trim(),
      data:   JSON.parse(JSON.stringify(sec?.defaultData   || {})),
      design: JSON.parse(JSON.stringify(sec?.defaultDesign || {})),
    });
    if (!_modData[_curModType]) _modData[_curModType] = { variantes: [] };
    _modData[_curModType].variantes.push(res.variante);
    renderVariantsList();
    window.__svc.showNotif('Variante creada', 'success');
    // Open editor for the new variant directly
    openModEditor(_curModType, res.variante.id);
  } catch(e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
  }
});

/* ── Botón: guardar variante ── */
document.getElementById('modulos-save-btn')?.addEventListener('click', async () => {
  if (!_curModType || !_curVariantId) return;
  const nombre = document.getElementById('modulos-variant-name-input')?.value?.trim() || _curModData.nombre;
  try {
    const res = await window.__svc.apiPut(`/modulos/${_curModType}/variantes/${_curVariantId}`, {
      nombre,
      alerta: _curModData.alerta,
      data:   _curModData.data,
      design: _curModData.design,
    });
    // Update local cache
    const variantes = _modData[_curModType]?.variantes || [];
    const idx = variantes.findIndex(v => v.id === _curVariantId);
    if (idx !== -1) _modData[_curModType].variantes[idx] = res.variante;
    const nameEl = document.getElementById('modulos-editor-variant-name');
    if (nameEl) nameEl.textContent = nombre;
    window.__svc.showNotif('Variante guardada', 'success');
    // Auto-show preview after save
    previewCurrentVariant();
  } catch(e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
  }
});
