import { SECTIONS, TIPOS_HTML, renderModulo } from '../sections.js';
import { TIPO_CSS, TYPE_TO_PAGE, cssFilesFor } from '../css-pages.js';

const API = `http://${window.location.hostname}:3000/api`;
const token = () => sessionStorage.getItem('sisgra_token');

const ICON_CATALOG = ['location', 'lightning', 'shield', 'check', 'camera', 'gear', 'lock', 'chart', 'database'];

const e3 = {
  plantillas: [],
  activeTpl: null,        // { id_plantilla, tipo, nombre, id_menu, id_modulos:[num], contenedores, ... }
  modulos: [],            // catálogo plano (working copy) — se persiste con PUT /data/modulos
  navbar: [],             // botones del navbar (para renderizar el nav en el canvas)
  // Modelo de trabajo de contenedores (filas de 1 a 3 módulos lado a lado):
  //   conts = [{ cap:Number(1-3), modulos:[id,...] }]
  // Se serializa a plantilla.contenedores = [[id,...],...] al guardar.
  conts: [],
  sel: null,              // módulo seleccionado: { ci, mi } (contenedor, índice dentro)
  activeCont: null,       // ci del contenedor destino para insertar módulos
  dirty: false,
  propsTab: 'data',
  currentTipo: null,
  search: { query: '', selected: [] },   // buscador de chips: selected=[{kind,id_modulo?,tipo,label,color}]
};

const CONT_MAX = 3;   // máximo de módulos por contenedor (fila)

// ─── Contenedores: conversión working-model ↔ persistido ────────────
// plantilla.contenedores ([[id,..],..]) → working conts ([{cap,modulos}]).
// Migra datos viejos (sin contenedores) a 1 contenedor 1x1 por módulo.
function contsFromPlantilla(tpl) {
  const raw = (Array.isArray(tpl.contenedores) && tpl.contenedores.length)
    ? tpl.contenedores
    : (tpl.id_modulos || []).map(id => [id]);
  return raw.map(m => {
    const modulos = (Array.isArray(m) ? m : []).filter(id => id != null);
    return { cap: Math.max(1, Math.min(CONT_MAX, modulos.length || 1)), modulos };
  });
}
// working conts → contenedores persistibles (recorta a la capacidad).
function contsToContenedores() {
  return e3.conts.map(c => c.modulos.slice(0, c.cap));
}
// lista plana de ids (orden de fila e índice) — canónica para id_modulos.
function allModIds() {
  return contsToContenedores().reduce((acc, m) => acc.concat(m), []);
}
// Mantiene activeTpl.{contenedores,id_modulos} en sync con el working model,
// por si algún código viejo aún los lee.
function syncActiveTpl() {
  if (!e3.activeTpl) return;
  e3.activeTpl.contenedores = contsToContenedores();
  e3.activeTpl.id_modulos   = allModIds();
}

// Un contenedor está INCOMPLETO si tiene menos módulos que su capacidad. Regla:
// cada contenedor debe llenarse exacto a su capacidad (un 2×1 lleva 2 módulos sí
// o sí). Devuelve el índice del primer contenedor incompleto, o -1 si están todos
// completos. Mientras haya uno incompleto NO se puede crear otro ni guardar.
function pendingContIndex() {
  return e3.conts.findIndex(c => c.modulos.length < c.cap);
}

// Refresca el estado de los controles de inserción según haya o no un contenedor
// incompleto: habilita "Insertar" solo si hay destino y selección, y actualiza el
// título del popover con cuántos módulos faltan.
function refreshContControls() {
  const pending = pendingContIndex();
  e3.activeCont = pending;   // el destino de inserción siempre es el incompleto

  const insBtn = document.getElementById('e3-insert');
  if (insBtn) insBtn.disabled = e3.search.selected.length === 0 || pending === -1;

  // El título del popover de inserción refleja el contenedor incompleto destino.
  const title = document.getElementById('e3-insert-pop-title');
  if (title) {
    if (pending !== -1) {
      const c = e3.conts[pending];
      const faltan = c.cap - c.modulos.length;
      title.innerHTML = `Insertar en contenedor <b>${c.cap}×1</b> · falta${faltan !== 1 ? 'n' : ''} ${faltan} módulo${faltan !== 1 ? 's' : ''}`;
    } else {
      title.textContent = 'Insertar módulo';
    }
  }
}

// nav/footer = se referencian compartidos; el resto se clona al insertar (modelo híbrido).
const GLOBAL_TIPOS = new Set(['nav', 'footer', 'footer-full']);

// Catálogo plano de módulos (v2) + navbar. Se recarga al abrir el editor.
async function loadE3Catalog() {
  try {
    const [mr, nr] = await Promise.all([ api('GET', '/modulos'), api('GET', '/data/navbar') ]);
    e3.modulos = Array.isArray(mr.modulos) ? mr.modulos : [];
    e3.navbar  = nr.botones || [];
  } catch (e) {
    console.warn('[e3] No se pudo cargar el catálogo:', e.message);
    e3.modulos = []; e3.navbar = [];
  }
}

const modById = id => e3.modulos.find(m => m.id_modulo === id);

function nextModId() {
  const nums = e3.modulos.map(m => Number(m.id_modulo)).filter(n => !isNaN(n));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

// Items del nav (dropdowns + links) desde navbar.json — igual que el runtime.
function buildNavItems(botones) {
  const activos = (botones || []).filter(b => b.activo !== false && b.href !== '/');
  const grupos = {}; const sueltos = [];
  activos.forEach(b => { if (b.grupo) (grupos[b.grupo] = grupos[b.grupo] || []).push(b); else sueltos.push(b); });
  const items = [];
  Object.entries(grupos).forEach(([grupo, hijos]) => items.push({
    tipo: 'dropdown', titulo: grupo,
    children: hijos.sort((a,b)=>(a.orden||0)-(b.orden||0)).map(b => ({ titulo: b.titulo, href: b.href || '#' })),
  }));
  sueltos.sort((a,b)=>(a.orden||0)-(b.orden||0)).forEach(b => items.push({ tipo: 'link', titulo: b.titulo, href: b.href || '#' }));
  return items;
}

// Resuelve los módulos de todos los contenedores → instancias (con items de nav
// inyectados). Lo usa cssFilesFor para saber qué CSS cargar en el iframe.
function resolvedMods() {
  const navItems = buildNavItems(e3.navbar);
  return allModIds().map(id => {
    const m = modById(id);
    if (!m) return null;
    return m.tipo === 'nav' ? { ...m, data: { ...m.data, items: navItems } } : m;
  }).filter(Boolean);
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
    // También bajamos el navbar para poder rotular cada página personalizada
    // con el nombre de su ítem del menú (en vez de "Páginas personalizadas").
    const [{ plantillas }, nav] = await Promise.all([
      api('GET', '/plantillas'),
      api('GET', '/data/navbar').catch(() => ({ botones: [] })),
    ]);
    e3.plantillas = plantillas || [];
    e3.navbar = nav.botones || [];
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
  // Card de una plantilla (reutilizada por los grupos del sistema y los custom).
  const cardHtml = (p) => {
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
  };

  // Header de un grupo + sus cards (o un mensaje de vacío).
  const grupoHtml = (label, file, pls, vacioMsg) => `
    <div style="margin-bottom:1.25rem;">
      <div style="display:flex;align-items:center;gap:.75rem;padding:.4rem 0 .5rem;border-bottom:1px solid var(--slate-100);margin-bottom:.5rem;">
        <span style="font-size:.625rem;font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:var(--sisgra-blue);">${label}</span>
        <span style="font-size:.6rem;color:var(--slate-400);font-family:monospace;">${file}</span>
      </div>
      ${pls.length === 0
        ? (vacioMsg ? `<div style="padding:.85rem;color:var(--slate-400);font-size:.7rem;text-align:center;background:var(--slate-50);">${vacioMsg}</div>` : '')
        : pls.map(cardHtml).join('')}
    </div>`;

  // Grupos del sistema (tipos fijos)…
  let html = TIPOS_HTML.map(t =>
    grupoHtml(t.label, t.file, e3.plantillas.filter(p => p.tipo === t.value), 'Sin plantillas todavía.')
  ).join('');
  // …y una sección por página personalizada (btn-*), rotulada con el nombre
  //    de su ítem del navbar (no con un genérico "Páginas personalizadas").
  const customTipos = [...new Set(
    e3.plantillas.filter(p => !TIPOS_HTML.some(t => t.value === p.tipo)).map(p => p.tipo)
  )];
  customTipos.forEach(tipo => {
    const pls  = e3.plantillas.filter(p => p.tipo === tipo);
    const item = (e3.navbar || []).find(b => pls.some(p => (p.id_menu || []).includes(b.id_menu)));
    const titulo = item ? item.titulo : (pls[0]?.nombre || tipo);
    html += grupoHtml(titulo, `html/${tipo}/index.html`, pls, '');
  });
  list.innerHTML = html;

  list.querySelectorAll('[data-e3-newtipo]').forEach(b => b.addEventListener('click', () => openNuevaModal(b.dataset.e3Newtipo)));
  list.querySelectorAll('[data-e3-edit]').forEach(b => b.addEventListener('click', () => openEditor(b.dataset.e3Edit)));
  list.querySelectorAll('[data-e3-activar]').forEach(b => b.addEventListener('click', () => activarPlantilla(b.dataset.e3Activar)));
  list.querySelectorAll('[data-e3-extender]').forEach(b => b.addEventListener('click', () => extenderVencimiento(b.dataset.e3Extender)));
  list.querySelectorAll('[data-e3-eliminar]').forEach(b => b.addEventListener('click', () => eliminarPlantilla(b.dataset.e3Eliminar)));
  list.querySelectorAll('[data-e3-rename]').forEach(b => b.addEventListener('click', () => renombrarPlantilla(b.dataset.e3Rename, b)));
  refreshDashVencidas();
}

async function renombrarPlantilla(id, btn) {
  id = Number(id);
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
  id = Number(id);
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
      expiryLine = `<div class="sidebar-tpl-expiry ${cls}">${label}</div>`;
    }
    return `
    <div>
      <div class="sidebar-tpl-item ${e3.activeTpl?.id_plantilla === p.id_plantilla ? 'active' : ''} ${vencida ? 'sidebar-item-vencida' : ''}" data-e3-tpl="${p.id_plantilla}" title="${escAttr(p.nombre)} (${p.tipo})" style="${vencida ? 'border-left-color:#f87171;' : ''}">
        <span class="sidebar-tpl-dot" style="${vencida ? 'background:#f87171;' : ''}"></span>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escAttr(p.nombre)}</span>
        ${expiryLine}
        ${vencida ? '<span class="sidebar-vencida-badge">VENC.</span>' : p.activa ? '<span style="font-size:.5rem;font-weight:900;letter-spacing:.1em;color:#86efac;">LIVE</span>' : ''}
        </div>
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
    const { plantilla } = await api('POST', '/plantillas', { nombre, tipo, descripcion });
    e3.plantillas.push(plantilla);
    document.getElementById('modal-nueva-plantilla').classList.remove('open');
    renderOverview(); renderSidebarList();
    notif('✓ Plantilla creada');
    openEditor(plantilla.id_plantilla);
  } catch (e) { notif('Error: ' + e.message, 'error'); }
}

async function activarPlantilla(id) {
  id = Number(id);
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
  id = Number(id);
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
      e3.activeTpl = null; e3.conts = []; e3.sel = null; e3.activeCont = null; e3.dirty = false;
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
    e3.conts = contsFromPlantilla(plantilla);
    e3.activeTpl.id_modulos   = allModIds();
    e3.activeTpl.contenedores = contsToContenedores();
    e3.currentTipo = plantilla.tipo;
    e3.sel = null;
    e3.activeCont = e3.conts.length ? e3.conts.length - 1 : null;
    e3.dirty = false;
    e3.search = { query: '', selected: [] };
    await loadE3Catalog();
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-tpl-editor').classList.add('active');
    // Editando una plantilla → "Ver todas las plantillas" no debe quedar activo
    // (si no, se resaltaban los dos en el sidebar).
    document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
    document.getElementById('topbar-title').textContent = `Editor — ${plantilla.nombre}`;
    renderSidebarList();
    renderEditorShell();
  } catch (e) { notif('Error: ' + e.message, 'error'); }
}

function backToOverview() {
  if (e3.dirty && !confirm('Hay cambios sin guardar. ¿Salir igual?')) return;
  closeInsertPopover();
  e3.activeTpl = null; e3.conts = []; e3.sel = null; e3.activeCont = null;
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
    <style>
      /* El editor llena el alto disponible con flex; el canvas ocupa todo el alto. */
      #panel-tpl-editor{height:100%;}
      #tpl-editor-inner{display:flex;flex-direction:column;height:100%;min-height:0;}
      .editor-shell{flex:1;min-height:0;height:auto;}
      /* El preview del e3 ocupa el ancho disponible (con un margen via el padding del
         scroll), en vez del 1200px fijo de .page-frame.desktop (esa regla la usa el
         editor legacy con su switcher de viewport, no la tocamos). */
      #e3-canvas.page-frame.desktop{width:100%;min-width:0;max-width:1600px;}
      /* Popover de inserción de módulos: aparece al click en "+ Insertar módulo"
         (ya no es una barra fija arriba del canvas). */
      .e3-insert-pop{position:fixed;z-index:2000;width:360px;max-width:calc(100vw - 1.5rem);background:#fff;border:1px solid var(--slate-200);border-radius:.5rem;box-shadow:0 12px 40px rgba(0,0,0,.22);padding:.7rem;}
      .e3-insert-pop-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.55rem;}
      .e3-insert-pop-title{font-size:.58rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--sisgra-blue);line-height:1.3;}
      .e3-insert-pop-close{background:none;border:none;font-size:1.15rem;line-height:1;color:var(--slate-400);cursor:pointer;padding:0 .2rem;}
      .e3-insert-pop-close:hover{color:var(--slate-700);}
      .e3-chipsearch{position:relative;margin-bottom:.55rem;}
      .e3-chipbox{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;border:1px solid var(--slate-300);border-radius:.4rem;padding:.3rem;background:#fff;min-height:2.2rem;}
      .e3-chip{display:inline-flex;align-items:center;gap:.3rem;color:#fff;font-size:.68rem;font-weight:700;padding:.2rem .5rem;border-radius:1rem;white-space:nowrap;}
      .e3-chip button{background:rgba(255,255,255,.3);border:none;color:#fff;border-radius:50%;width:1rem;height:1rem;line-height:1;cursor:pointer;font-size:.7rem;padding:0;}
      .e3-search-input{flex:1;min-width:90px;border:none;outline:none;font-size:.75rem;font-family:inherit;padding:.2rem;background:transparent;}
      .e3-insert{width:100%;white-space:nowrap;}
      .e3-insert:disabled{opacity:.5;cursor:not-allowed;}
      .e3-results{position:absolute;left:0;right:0;top:calc(100% + .3rem);background:#fff;border:1px solid var(--slate-200);border-radius:.4rem;box-shadow:0 8px 24px rgba(0,0,0,.14);max-height:300px;overflow:auto;z-index:60;}
      .e3-result{padding:.5rem .6rem;cursor:pointer;display:flex;flex-direction:column;gap:.1rem;border-bottom:1px solid var(--slate-100);}
      .e3-result:hover{background:var(--slate-50);}
      .e3-result-name{font-size:.75rem;font-weight:700;color:var(--slate-800);}
      .e3-result-sub{font-size:.6rem;color:var(--slate-400);letter-spacing:.04em;text-transform:uppercase;}
      .e3-props-tabs{display:flex;gap:.25rem;}
      .e3-props-tabs button{font-size:.58rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:.25rem .55rem;border:1px solid var(--slate-200);background:#fff;color:var(--slate-500);cursor:pointer;border-radius:.3rem;}
      .e3-props-tabs button.active{background:var(--sisgra-blue);color:#fff;border-color:var(--sisgra-blue);}
    </style>
    <div class="editor-shell">
      <div class="page-canvas-wrap">
        <div class="canvas-ruler"><span style="font-size:.5rem;font-weight:700;color:var(--slate-400);letter-spacing:.2em;text-transform:uppercase;">Vista previa — ${escAttr(tpl.tipo)}.html</span></div>
        <div style="flex:1;min-height:0;overflow:auto;display:flex;align-items:stretch;justify-content:center;padding:1rem 2rem;">
          <iframe class="page-frame desktop" id="e3-canvas" style="border:none;background:#fff;height:100%;min-height:420px;"></iframe>
        </div>
      </div>
      <div class="props-panel">
        <div class="props-header" style="display:flex;align-items:center;justify-content:center;gap:.3rem;">
          <span id="e3-props-type">Propiedades</span>
          <div class="e3-props-tabs">
            <button data-e3-tab="data" class="${e3.propsTab==='data'?'active':''}">Contenido</button>
            <button data-e3-tab="design" class="${e3.propsTab==='design'?'active':''}">Diseño</button>
          </div>
        </div>
        <div class="props-body" id="e3-props-body"><div class="props-empty">Click sobre un módulo del canvas para editarlo.</div></div>
      </div>
    </div>
    <div class="e3-insert-pop" id="e3-insert-pop" style="display:none;">
      <div class="e3-insert-pop-head">
        <span class="e3-insert-pop-title" id="e3-insert-pop-title">Insertar módulo</span>
        <button type="button" class="e3-insert-pop-close" id="e3-insert-pop-close" title="Cerrar">×</button>
      </div>
      <div class="e3-chipsearch">
        <div class="e3-chipbox" id="e3-chipbox"><input class="e3-search-input" id="e3-search-input" placeholder="Buscar módulo (ej: noticias)…" autocomplete="off"/></div>
        <div class="e3-results" id="e3-results" style="display:none;"></div>
      </div>
      <button class="btn-save e3-insert" id="e3-insert" disabled><i class="fa-solid fa-plus"></i> Insertar seleccionados</button>
    </div>`;

  document.getElementById('e3-back').addEventListener('click', backToOverview);
  document.getElementById('e3-guardar').addEventListener('click', guardarPlantilla);
  document.getElementById('e3-activar')?.addEventListener('click', async () => {
    await activarPlantilla(tpl.id_plantilla);
    renderEditorShell();
  });
  document.getElementById('e3-insert').addEventListener('click', insertSelected);
  bindChipSearch();
  bindInsertPopover();
  document.querySelectorAll('[data-e3-tab]').forEach(t => t.addEventListener('click', () => {
    e3.propsTab = t.dataset.e3Tab;
    document.querySelectorAll('[data-e3-tab]').forEach(x => x.classList.toggle('active', x === t));
    renderProps();
  }));

  renderChips();
  initIframe(() => {
    try { renderCanvas(); } catch (e) { console.error('[e3] renderCanvas error:', e); }
  });
  renderProps();
}

// ─── BUSCADOR DE CHIPS ──────────────────────────────────────────────
function bindChipSearch() {
  const input = document.getElementById('e3-search-input');
  if (!input) return;
  input.addEventListener('input', () => { e3.search.query = input.value; renderResults(); });
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Backspace' && !input.value && e3.search.selected.length) {
      e3.search.selected.pop(); renderChips();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const res = searchResults(e3.search.query);
      if (res.length) selectResult(res[0]);
    } else if (ev.key === 'Escape') {
      e3.search.query = ''; input.value = ''; renderResults();
    }
  });
  document.addEventListener('click', ev => {
    if (!ev.target.closest('.e3-chipsearch')) {
      const b = document.getElementById('e3-results'); if (b) b.style.display = 'none';
    }
  });
}

// Resultados = módulos existentes del catálogo + tipos de SECTIONS (para crear nuevos).
function searchResults(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const res = [];
  for (const m of e3.modulos) {
    const hay = `${m.nombre} ${m.tipo} ${SECTIONS[m.tipo]?.label || ''}`.toLowerCase();
    if (hay.includes(q)) res.push({ kind: 'modulo', id_modulo: m.id_modulo, tipo: m.tipo, label: m.nombre, sub: SECTIONS[m.tipo]?.label || m.tipo });
  }
  for (const [tipo, def] of Object.entries(SECTIONS)) {
    if (`${def.label} ${tipo}`.toLowerCase().includes(q)) {
      res.push({ kind: 'tipo', tipo, label: def.label, sub: 'crear módulo nuevo' });
    }
  }
  return res.slice(0, 40);
}

function chipColor(sel) {
  if (sel.kind === 'tipo') return '#16a34a';
  return GLOBAL_TIPOS.has(sel.tipo) ? '#7c3aed' : '#2563eb';
}

function renderResults() {
  const box = document.getElementById('e3-results');
  if (!box) return;
  const res = searchResults(e3.search.query);
  if (!res.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = '';
  box.innerHTML = res.map((r, i) => `
    <div class="e3-result" data-res="${i}">
      <span class="e3-result-name">${escAttr(r.label)}</span>
      <span class="e3-result-sub">${escAttr(r.sub)}${r.kind === 'modulo' ? ` · #${r.id_modulo}${GLOBAL_TIPOS.has(r.tipo) ? ' · global' : ''}` : ''}</span>
    </div>`).join('');
  box.querySelectorAll('[data-res]').forEach(el => el.addEventListener('click', () => selectResult(res[+el.dataset.res])));
}

function selectResult(r) {
  // Solo se pueden seleccionar tantos módulos como falten para completar el
  // contenedor incompleto (regla #1: cantidad exacta = capacidad del contenedor).
  const pending = pendingContIndex();
  if (pending === -1) {
    notif('Creá un contenedor primero para insertar módulos', 'error');
    return;
  }
  const c = e3.conts[pending];
  const restante = c.cap - c.modulos.length - e3.search.selected.length;
  if (restante <= 0) {
    notif(`El contenedor ${c.cap}×1 admite exactamente ${c.cap} módulo${c.cap !== 1 ? 's' : ''}`, 'error');
    return;
  }
  e3.search.selected.push({ ...r, color: chipColor(r) });
  e3.search.query = '';
  const input = document.getElementById('e3-search-input');
  if (input) input.value = '';
  renderChips();
  renderResults();
  input?.focus();
}

function renderChips() {
  const wrap = document.getElementById('e3-chipbox');
  const input = document.getElementById('e3-search-input');
  if (!wrap || !input) return;
  wrap.querySelectorAll('.e3-chip').forEach(c => c.remove());
  e3.search.selected.forEach((s, i) => {
    const chip = document.createElement('span');
    chip.className = 'e3-chip';
    chip.style.background = s.color;
    chip.innerHTML = `${escAttr(s.label)} <button title="Quitar">×</button>`;
    chip.querySelector('button').addEventListener('click', () => { e3.search.selected.splice(i, 1); renderChips(); });
    wrap.insertBefore(chip, input);
  });
  input.placeholder = e3.search.selected.length ? 'Agregar otro…' : 'Buscar módulo (ej: noticias)…';
  refreshContControls();
}

// Clona un módulo de contenido → nuevo id_modulo en el catálogo (working copy).
function cloneModule(src) {
  const c = JSON.parse(JSON.stringify(src));
  c.id_modulo = nextModId();
  c.creado_en = new Date().toISOString();
  c.editado_en = new Date().toISOString();
  e3.modulos.push(c);
  return c.id_modulo;
}

// Crea un módulo nuevo desde un tipo de SECTIONS (defaults).
function newModuleFromType(tipo) {
  const def = SECTIONS[tipo];
  const m = {
    id_modulo: nextModId(),
    tipo,
    nombre: `${def?.label || tipo} — ${e3.activeTpl?.nombre || 'nuevo'}`,
    data:   JSON.parse(JSON.stringify(def?.defaultData   || {})),
    design: JSON.parse(JSON.stringify(def?.defaultDesign || {})),
    alerta: false,
    creado_en: new Date().toISOString(),
    editado_en: new Date().toISOString(),
  };
  e3.modulos.push(m);
  return m.id_modulo;
}

// Inserta los chips seleccionados DENTRO del contenedor incompleto (regla #2).
// No crea contenedores nuevos: si algo no entra, se rechaza con aviso.
function insertSelected() {
  if (!e3.search.selected.length) return;
  if (pendingContIndex() === -1) {
    notif('Creá un contenedor primero (no hay ninguno esperando módulos)', 'error');
    return;
  }
  const ids = [];
  for (const sel of e3.search.selected) {
    if (sel.kind === 'tipo') {
      ids.push(newModuleFromType(sel.tipo));
    } else {
      const src = modById(sel.id_modulo);
      if (!src) continue;
      ids.push(GLOBAL_TIPOS.has(src.tipo) ? src.id_modulo : cloneModule(src));
    }
  }
  const { placed, rejected } = placeModuleIds(ids);
  closeInsertPopover();   // limpia chips/buscador y oculta el popover
  markDirty(); renderCanvas(); renderProps();
  const base = `✓ ${placed} módulo${placed !== 1 ? 's' : ''} insertado${placed !== 1 ? 's' : ''}`;
  notif(rejected ? `${base} · ${rejected} no entró: el contenedor ya está completo` : base, rejected ? 'error' : 'success');
}

// Llena los contenedores incompletos en orden (hasta su capacidad exacta, regla #1).
// NO crea contenedores nuevos: devuelve { placed, rejected } (rejected = sin lugar).
function placeModuleIds(ids) {
  const queue = ids.slice();
  let placed = 0;
  for (let ci = 0; ci < e3.conts.length && queue.length; ci++) {
    const cont = e3.conts[ci];
    while (cont.modulos.length < cont.cap && queue.length) {
      cont.modulos.push(queue.shift());
      e3.sel = { ci, mi: cont.modulos.length - 1 };
      placed++;
    }
  }
  return { placed, rejected: queue.length };
}

// Crea un contenedor vacío de `cap` columnas (1 a 3) y lo deja activo para insertar.
// Bloqueado si ya hay un contenedor incompleto (regla #3).
function crearContenedor(cap) {
  if (pendingContIndex() !== -1) {
    notif('Completá el contenedor actual antes de crear otro', 'error');
    return;
  }
  const n = Math.max(1, Math.min(CONT_MAX, cap | 0));
  e3.conts.push({ cap: n, modulos: [] });
  e3.activeCont = e3.conts.length - 1;
  e3.sel = null;
  markDirty(); renderCanvas(); renderProps();
  notif(`✓ Contenedor ${n}×1 creado — insertá ${n} módulo${n > 1 ? 's' : ''} adentro para continuar`);
  openInsertPopoverForPending();   // abre el buscador anclado al primer slot vacío
}

// ─── Botón "Nuevo contenedor" (al fondo del canvas, dentro del iframe) ──
// HTML del botón grande de "Nuevo contenedor" que se renderiza SIEMPRE al final
// del canvas (los contenedores nuevos siempre aparecen abajo). Si hay un
// contenedor incompleto, en su lugar se muestra un aviso (no se puede crear otro).
function buildAddContHtml() {
  if (pendingContIndex() !== -1) {
    return `
<div class="e3-addcont">
  <div class="e3-addcont-blocked"><i class="fa-solid fa-circle-info"></i> Completá el contenedor de arriba para agregar otro</div>
</div>`;
  }
  return `
<div class="e3-addcont" data-addcont>
  <button type="button" class="e3-addcont-btn" data-addcont-toggle><span class="e3-addcont-plus">+</span> Nuevo contenedor</button>
  <div class="e3-addcont-pick" data-addcont-pick style="display:none;">
    <span class="e3-addcont-pick-hint">¿Cuántos módulos en fila?</span>
    <div class="e3-addcont-pick-cells">
      <button type="button" data-addk="1">1 × 1</button>
      <button type="button" data-addk="2">2 × 1</button>
      <button type="button" data-addk="3">3 × 1</button>
    </div>
  </div>
</div>`;
}

// Conecta el botón del fondo del canvas: al click, el selector de tamaño (1 a 3
// módulos en fila) REEMPLAZA al botón en el mismo lugar (sin empujar el layout), y
// cada celda crea el contenedor. Click fuera del bloque → vuelve al botón.
function bindAddCont(doc) {
  const wrap = doc.querySelector('[data-addcont]');
  if (!wrap) return;
  const toggle = wrap.querySelector('[data-addcont-toggle]');
  toggle?.addEventListener('click', ev => { ev.stopPropagation(); setAddContOpen(wrap, true); });
  wrap.querySelectorAll('[data-addk]').forEach(b =>
    b.addEventListener('click', () => crearContenedor(+b.dataset.addk)));
  // Colapsar el selector al click fuera del bloque (listener de-duplicado: el doc
  // del iframe persiste entre renders, sólo cambia su innerHTML).
  doc.removeEventListener('click', onIframeClickCollapseAddCont);
  doc.addEventListener('click', onIframeClickCollapseAddCont);
}

function setAddContOpen(wrap, open) {
  const toggle = wrap.querySelector('[data-addcont-toggle]');
  const pick = wrap.querySelector('[data-addcont-pick]');
  if (pick) pick.style.display = open ? 'flex' : 'none';
  if (toggle) toggle.style.display = open ? 'none' : 'flex';
}

function onIframeClickCollapseAddCont(ev) {
  if (ev.target.closest('[data-addcont]')) return;   // click dentro del bloque
  const wrap = ev.currentTarget.querySelector('[data-addcont]');
  if (wrap) setAddContOpen(wrap, false);
}

// ─── Popover de inserción de módulos (aparece al click en "+ Insertar módulo") ──
function bindInsertPopover() {
  document.getElementById('e3-insert-pop-close')?.addEventListener('click', closeInsertPopover);
  // Listeners a nivel documento: de-duplicados (esta función corre por cada editor abierto).
  document.removeEventListener('mousedown', onDocMouseForPopover);
  document.addEventListener('mousedown', onDocMouseForPopover);
  document.removeEventListener('keydown', onKeyForPopover);
  document.addEventListener('keydown', onKeyForPopover);
}

// Cierra el popover al click fuera de él (los clicks dentro del iframe no llegan acá,
// así que abrir desde un slot no lo cierra al instante).
function onDocMouseForPopover(ev) {
  const pop = document.getElementById('e3-insert-pop');
  if (!pop || pop.style.display === 'none') return;
  if (ev.target.closest('#e3-insert-pop')) return;
  closeInsertPopover();
}
function onKeyForPopover(ev) {
  if (ev.key !== 'Escape') return;
  const pop = document.getElementById('e3-insert-pop');
  if (pop && pop.style.display !== 'none') closeInsertPopover();
}

// Abre el popover de inserción anclado a un slot del canvas (elemento del iframe).
function openInsertPopover(slotEl) {
  const pop = document.getElementById('e3-insert-pop');
  if (!pop) return;
  if (pendingContIndex() === -1) { notif('Este contenedor ya está completo', 'error'); return; }
  pop.style.display = 'block';
  positionInsertPopover(slotEl);
  refreshContControls();             // título + estado del botón insertar
  const input = document.getElementById('e3-search-input');
  if (input) { input.value = e3.search.query || ''; setTimeout(() => input.focus(), 0); }
  renderResults();
}

// Abre el popover sobre el primer slot vacío del contenedor incompleto, trayéndolo
// a la vista primero (un contenedor recién creado puede quedar bajo el fold).
function openInsertPopoverForPending() {
  const slot = document.getElementById('e3-canvas')?.contentDocument?.querySelector('.e3-slot');
  if (!slot) return;
  slot.scrollIntoView({ block: 'center' });
  openInsertPopover(slot);
}

// Posiciona el popover (position:fixed) justo debajo del slot clickeado, dentro del
// iframe; mapea las coordenadas del iframe al viewport del padre y las recorta.
function positionInsertPopover(slotEl) {
  const pop = document.getElementById('e3-insert-pop');
  const iframe = document.getElementById('e3-canvas');
  if (!pop || !iframe) return;
  const ifr = iframe.getBoundingClientRect();
  const margin = 8;
  let top, left;
  if (slotEl) {
    const r = slotEl.getBoundingClientRect();   // relativo al viewport del iframe
    top = ifr.top + r.bottom + 6;
    left = ifr.left + r.left;
  } else {
    top = ifr.top + 40; left = ifr.left + 40;
  }
  const pw = pop.offsetWidth || 360;
  const ph = pop.offsetHeight || 200;
  if (left + pw > window.innerWidth - margin) left = window.innerWidth - margin - pw;
  if (left < margin) left = margin;
  if (top + ph > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - margin - ph);
  pop.style.top = `${Math.round(top)}px`;
  pop.style.left = `${Math.round(left)}px`;
}

// Cierra el popover y limpia el buscador (chips + query) para arrancar en limpio.
function closeInsertPopover() {
  const pop = document.getElementById('e3-insert-pop');
  if (pop) pop.style.display = 'none';
  e3.search.query = '';
  e3.search.selected = [];
  const input = document.getElementById('e3-search-input');
  if (input) input.value = '';
  const box = document.getElementById('e3-results');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
  renderChips();
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
  cssFilesFor(e3.currentTipo, resolvedMods().filter(Boolean)).forEach(href => {
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
  const cssFiles = cssFilesFor(e3.currentTipo, resolvedMods().filter(Boolean));
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
  .e3-sec-wrap{position:relative;outline:2px solid transparent;outline-offset:-2px;transition:outline-color .15s;min-height:40px;}
  .e3-sec-wrap:hover{outline-color:#cbd5e1;}
  .e3-sec-wrap.e3-selected{outline-color:#2563eb;}
  .e3-sec-ctrls{position:absolute;top:8px;right:8px;display:flex;gap:.25rem;z-index:9999;background:rgba(255,255,255,.96);padding:.25rem;box-shadow:0 4px 12px rgba(0,0,0,.18);opacity:0;transition:opacity .15s;}
  .e3-sec-wrap:hover .e3-sec-ctrls,.e3-sec-wrap.e3-selected .e3-sec-ctrls{opacity:1;}
  .e3-sec-ctrls button{background:#fff;border:1px solid #cbd5e1;padding:.3rem .5rem;font-size:.75rem;line-height:1;color:#0A1D37;cursor:pointer;font-family:inherit;}
  .e3-sec-ctrls .e3-danger{color:#dc2626;}
  .e3-sec-badge{position:absolute;top:8px;left:8px;z-index:9998;background:rgba(15,23,42,.85);color:#fff;font:700 .6rem/1 Inter,system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;padding:.25rem .5rem;border-radius:.25rem;opacity:0;transition:opacity .15s;pointer-events:none;}
  .e3-sec-wrap:hover .e3-sec-badge,.e3-sec-wrap.e3-selected .e3-sec-badge{opacity:1;}
  /* ── Contenedores (filas) en el canvas ── */
  .e3-cont{position:relative;border:2px dashed #cbd5e1;margin:10px;transition:border-color .15s,box-shadow .15s;}
  .e3-cont.e3-cont-active{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12);}
  .e3-cont-bar{display:flex;align-items:center;justify-content:space-between;gap:.5rem;background:#f1f5f9;border-bottom:1px solid #e2e8f0;padding:.25rem .4rem;font-family:Inter,system-ui,sans-serif;}
  .e3-cont-tag{font-size:.58rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#475569;cursor:pointer;display:flex;align-items:center;gap:.35rem;}
  .e3-cont-active .e3-cont-tag{color:#2563eb;}
  .e3-cont-ctrls{display:flex;gap:.2rem;}
  .e3-cont-ctrls button{background:#fff;border:1px solid #cbd5e1;padding:.2rem .4rem;font-size:.65rem;line-height:1;color:#0A1D37;cursor:pointer;font-family:inherit;border-radius:2px;}
  .e3-cont-ctrls .e3-danger{color:#dc2626;}
  .e3-cont-grid{display:grid;align-items:stretch;}
  .e3-slot{display:flex;align-items:center;justify-content:center;min-height:90px;border:2px dashed #d4dae3;margin:6px;background:repeating-linear-gradient(45deg,#fafbfc,#fafbfc 8px,#f1f5f9 8px,#f1f5f9 16px);cursor:pointer;transition:border-color .15s,background .15s;}
  .e3-slot:hover{border-color:#60a5fa;}
  .e3-slot-inner{font:700 .68rem/1.3 Inter,system-ui,sans-serif;color:#94a3b8;letter-spacing:.06em;text-transform:uppercase;display:flex;align-items:center;gap:.4rem;}
  /* ── Botón "Nuevo contenedor" al fondo del canvas ── */
  .e3-empty-lite{padding:3rem 2rem 1rem;text-align:center;color:#94a3b8;font:700 .82rem/1.6 Inter,system-ui,sans-serif;}
  .e3-empty-lite small{display:block;margin-top:.4rem;font-weight:500;font-size:.68rem;opacity:.8;}
  .e3-addcont{margin:10px;}
  .e3-addcont-btn{width:100%;min-height:96px;display:flex;align-items:center;justify-content:center;gap:.5rem;border:2px dashed #c2cad6;background:repeating-linear-gradient(45deg,#fafbfc,#fafbfc 8px,#f1f5f9 8px,#f1f5f9 16px);color:#94a3b8;font:800 .82rem/1 Inter,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;border-radius:4px;transition:border-color .15s,color .15s,background .15s;}
  .e3-addcont-btn:hover{border-color:#60a5fa;color:#2563eb;background:#eff6ff;}
  .e3-addcont-plus{font-size:1.4rem;line-height:1;font-weight:400;}
  .e3-addcont-pick{flex-direction:column;align-items:center;justify-content:center;gap:.6rem;min-height:96px;border:2px dashed #93c5fd;background:#eff6ff;border-radius:4px;padding:1rem;}
  .e3-addcont-pick-hint{font:700 .62rem/1 Inter,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#2563eb;}
  .e3-addcont-pick-cells{display:flex;gap:.5rem;}
  .e3-addcont-pick-cells button{font:800 .82rem/1 'IBM Plex Mono',monospace;color:#1d4ed8;background:#fff;border:1px solid #93c5fd;border-radius:4px;padding:.6rem .95rem;cursor:pointer;transition:background .12s,color .12s,border-color .12s;}
  .e3-addcont-pick-cells button:hover{background:#2563eb;color:#fff;border-color:#2563eb;}
  .e3-addcont-blocked{display:flex;align-items:center;justify-content:center;gap:.4rem;min-height:64px;border:2px dashed #e2e8f0;background:#f8fafc;color:#94a3b8;font:700 .68rem/1.3 Inter,system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;border-radius:4px;}
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
  refreshContControls();   // fija activeCont = contenedor incompleto y estado de botones
  if (!e3.conts.length) {
    doc.body.innerHTML = `<div class="e3-empty-lite">
      <div style="font-size:2.25rem;margin-bottom:.5rem;opacity:.25;line-height:1;">⊞</div>
      Esta plantilla todavía no tiene contenedores.<br>
      <small>Creá uno abajo: elegí 1 a 3 módulos en fila y después insertá los módulos adentro.</small>
    </div>` + buildAddContHtml();
    bindAddCont(doc);
    return;
  }
  const navItems = buildNavItems(e3.navbar);
  doc.body.innerHTML = e3.conts.map((cont, ci) => {
    const cols = Math.min(Math.max(cont.cap, 1), CONT_MAX);
    const slots = [];
    for (let mi = 0; mi < cont.cap; mi++) {
      const id = cont.modulos[mi];
      if (id == null) {
        slots.push(`<div class="e3-slot" data-ci="${ci}"><div class="e3-slot-inner"><i class="fa-solid fa-plus"></i> Insertar módulo</div></div>`);
        continue;
      }
      const m = modById(id);
      const inner = m
        ? renderModulo(m.tipo === 'nav' ? { ...m, data: { ...m.data, items: navItems } } : m)
        : `<div style="padding:2rem;background:#fee;color:#900;text-align:center;">Módulo #${id} no está en el catálogo</div>`;
      const tipoLbl = m ? (SECTIONS[m.tipo]?.label || m.tipo) : '—';
      const global = m && GLOBAL_TIPOS.has(m.tipo);
      const isSel = e3.sel && e3.sel.ci === ci && e3.sel.mi === mi;
      slots.push(`
<div class="e3-sec-wrap ${isSel ? 'e3-selected' : ''}" data-ci="${ci}" data-mi="${mi}">
  <div class="e3-sec-badge">#${id} · ${escAttr(tipoLbl)}${global ? ' · global' : ''}</div>
  <div class="e3-sec-ctrls">
    ${cont.cap > 1 ? `<button data-mact="left" title="Mover a la izquierda"><i class="fa-solid fa-chevron-left"></i></button>
    <button data-mact="right" title="Mover a la derecha"><i class="fa-solid fa-chevron-right"></i></button>` : ''}
    <button data-mact="del" class="e3-danger" title="Quitar del contenedor"><i class="fa-solid fa-trash"></i></button>
  </div>
  ${inner}
</div>`);
    }
    const incompleto = cont.modulos.length < cont.cap;
    const faltan = cont.cap - cont.modulos.length;
    return `
<div class="e3-cont ${incompleto ? 'e3-cont-active' : ''}" data-ci="${ci}">
  <div class="e3-cont-bar" data-cont-bar="${ci}">
    <span class="e3-cont-tag"><i class="fa-solid fa-table-cells-large"></i> Contenedor ${cont.cap}×1${incompleto ? ` · faltan ${faltan} módulo${faltan !== 1 ? 's' : ''}` : ''}</span>
    <div class="e3-cont-ctrls">
      <button data-cact="up" title="Subir contenedor"><i class="fa-solid fa-arrow-up"></i></button>
      <button data-cact="down" title="Bajar contenedor"><i class="fa-solid fa-arrow-down"></i></button>
      <button data-cact="del" class="e3-danger" title="Eliminar contenedor"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>
  <div class="e3-cont-grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr));">${slots.join('')}</div>
</div>`;
  }).join('') + buildAddContHtml();

  // Selección de módulo (para el panel de propiedades)
  doc.querySelectorAll('.e3-sec-wrap').forEach(w => {
    const ci = +w.dataset.ci, mi = +w.dataset.mi;
    w.addEventListener('click', ev => {
      if (ev.target.closest('.e3-sec-ctrls')) return;
      e3.sel = { ci, mi };
      renderCanvas(); renderProps();
    });
    w.querySelectorAll('button[data-mact]').forEach(b => {
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        const act = b.dataset.mact;
        if (act === 'left')  moveModuleInCont(ci, mi, -1);
        if (act === 'right') moveModuleInCont(ci, mi, 1);
        if (act === 'del')   removeModuleFromCont(ci, mi);
      });
    });
  });
  // Slots vacíos → abren el popover de inserción anclado al slot clickeado.
  doc.querySelectorAll('.e3-slot').forEach(s => {
    s.addEventListener('click', () => openInsertPopover(s));
  });
  // Botones de la barra del contenedor → mover/eliminar
  doc.querySelectorAll('[data-cont-bar]').forEach(bar => {
    const ci = +bar.dataset.contBar;
    bar.querySelectorAll('button[data-cact]').forEach(b => {
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        const act = b.dataset.cact;
        if (act === 'up')   moveContenedor(ci, -1);
        if (act === 'down') moveContenedor(ci, 1);
        if (act === 'del')  deleteContenedor(ci);
      });
    });
  });
  // Botón "Nuevo contenedor" al fondo del canvas.
  bindAddCont(doc);
  doc.querySelectorAll('a').forEach(a => a.addEventListener('click', ev => ev.preventDefault()));
  doc.querySelectorAll('form').forEach(f => f.addEventListener('submit', ev => ev.preventDefault()));
}

// Reordena un módulo dentro de su contenedor (fila).
function moveModuleInCont(ci, mi, delta) {
  const arr = e3.conts[ci]?.modulos;
  if (!arr) return;
  const j = mi + delta;
  if (j < 0 || j >= arr.length) return;
  [arr[mi], arr[j]] = [arr[j], arr[mi]];
  if (e3.sel && e3.sel.ci === ci) {
    if (e3.sel.mi === mi) e3.sel.mi = j;
    else if (e3.sel.mi === j) e3.sel.mi = mi;
  }
  markDirty(); renderCanvas(); renderProps();
}

// Quita un módulo de su contenedor (el contenedor queda con un slot libre).
function removeModuleFromCont(ci, mi) {
  if (!confirm('¿Quitar este módulo del contenedor?')) return;
  e3.conts[ci].modulos.splice(mi, 1);
  if (e3.sel && e3.sel.ci === ci) {
    if (e3.sel.mi === mi) e3.sel = null;
    else if (e3.sel.mi > mi) e3.sel.mi--;
  }
  markDirty(); renderCanvas(); renderProps();
}

// Reordena un contenedor entero (sube/baja la fila).
function moveContenedor(ci, delta) {
  const j = ci + delta;
  if (j < 0 || j >= e3.conts.length) return;
  [e3.conts[ci], e3.conts[j]] = [e3.conts[j], e3.conts[ci]];
  if (e3.activeCont === ci) e3.activeCont = j;
  else if (e3.activeCont === j) e3.activeCont = ci;
  if (e3.sel) { if (e3.sel.ci === ci) e3.sel.ci = j; else if (e3.sel.ci === j) e3.sel.ci = ci; }
  markDirty(); renderCanvas(); renderProps();
}

// Elimina un contenedor y todos sus módulos.
function deleteContenedor(ci) {
  const c = e3.conts[ci];
  if (!c) return;
  if (c.modulos.length && !confirm(`¿Eliminar el contenedor y sus ${c.modulos.length} módulo(s)?`)) return;
  e3.conts.splice(ci, 1);
  if (e3.activeCont === ci) e3.activeCont = e3.conts.length ? Math.min(ci, e3.conts.length - 1) : null;
  else if (e3.activeCont != null && e3.activeCont > ci) e3.activeCont--;
  if (e3.sel) { if (e3.sel.ci === ci) e3.sel = null; else if (e3.sel.ci > ci) e3.sel.ci--; }
  markDirty(); renderCanvas(); renderProps();
}

function markDirty() { e3.dirty = true; syncActiveTpl(); document.getElementById('e3-dirty').style.display = 'inline'; }
function clearDirty() { e3.dirty = false; document.getElementById('e3-dirty').style.display = 'none'; }

// ─── PROPS PANEL ────────────────────────────────────────────────────
function renderProps() {
  const body = document.getElementById('e3-props-body');
  if (!body) return;
  const typeEl = document.getElementById('e3-props-type');
  const id = e3.sel ? e3.conts[e3.sel.ci]?.modulos?.[e3.sel.mi] : undefined;
  const sec = (id == null) ? null : modById(id);
  if (!sec) { body.innerHTML = '<div class="props-empty">Click sobre un módulo del canvas para editarlo.</div>'; if (typeEl) typeEl.textContent = 'Propiedades'; return; }
  const def = SECTIONS[sec.tipo];
  if (!def) { body.innerHTML = `<div class="props-empty">Tipo desconocido: ${sec.tipo}</div>`; return; }
  if (typeEl) typeEl.textContent = `${def.label} · #${sec.id_modulo}`;
  const compartido = GLOBAL_TIPOS.has(sec.tipo);
  const aviso = compartido ? `<div style="background:#f3e8ff;border:1px solid #d8b4fe;color:#6b21a8;font-size:.62rem;padding:.5rem .6rem;margin-bottom:.6rem;line-height:1.5;border-radius:.3rem;">Módulo <b>global compartido</b>: los cambios impactan en todas las páginas que lo usan.</div>` : '';
  const fields = e3.propsTab === 'data' ? def.dataFields : def.designFields;
  body.innerHTML = aviso + alertaFieldHTML(sec) + (fields || []).map(f => fieldHTML(f, sec[e3.propsTab]?.[f.name], e3.propsTab)).join('');
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
    const def = SECTIONS[sec.tipo];
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
  const pend = pendingContIndex();
  if (pend !== -1) {
    const c = e3.conts[pend];
    notif(`No se puede guardar: el contenedor ${c.cap}×1 está incompleto (faltan ${c.cap - c.modulos.length}). Completálo o eliminálo.`, 'error');
    return;
  }
  try {
    // 1) Persistir el catálogo de módulos (clones nuevos + ediciones).
    await api('PUT', '/data/modulos', { modulos: e3.modulos });
    // 2) Persistir la plantilla. `contenedores` es la fuente de verdad; mandamos
    //    también id_modulos (aplanado) por compatibilidad — el backend los re-sincroniza.
    const { plantilla } = await api('PATCH', `/plantillas/${e3.activeTpl.id_plantilla}`, {
      nombre: e3.activeTpl.nombre,
      descripcion: e3.activeTpl.descripcion,
      id_menu: e3.activeTpl.id_menu,
      contenedores: contsToContenedores(),
      id_modulos: allModIds(),
    });
    e3.activeTpl = plantilla;
    e3.conts = contsFromPlantilla(plantilla);
    e3.activeTpl.id_modulos   = allModIds();
    e3.activeTpl.contenedores = contsToContenedores();
    if (e3.activeCont != null && e3.activeCont >= e3.conts.length) e3.activeCont = e3.conts.length ? e3.conts.length - 1 : null;
    e3.sel = null;
    clearDirty();
    const idx = e3.plantillas.findIndex(p => p.id_plantilla === plantilla.id_plantilla);
    if (idx >= 0) e3.plantillas[idx] = plantilla;
    renderSidebarList();
    notif(plantilla.activa
      ? '✓ Guardado — cambios en vivo en /' + plantilla.tipo
      : '✓ Borrador guardado — activalo para verlo en vivo');
  } catch (e) { notif('Error: ' + e.message, 'error'); }
}

// ─── Quick access (dashboard card + sidebar link) ───────────────────
function goToPlantillas() {
  // Salimos del editor → ninguna plantilla queda "abierta", así el sidebar no
  // resalta una plantilla además de "Ver todas las plantillas" (eran 2 activos).
  e3.activeTpl = null;
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

  // El botón "Gestionar Plantillas" del dashboard apuntaba al editor legacy
  // (openTemplateEditor con state.templates, que está vacío en el sistema e3).
  // Lo redirigimos al overview de plantillas e3.
  const dashBtn = stripListeners(document.getElementById('dash-editar-home'));
  if (dashBtn) dashBtn.addEventListener('click', goToPlantillas);

  // Override old globals so any leftover async old code doesn't overwrite our renders
  window.renderSidebarTemplates = renderSidebarList;
  window.renderTemplateOverview = renderOverview;
  window.openTemplateEditor = (id) => openEditor(id);
  window.openTemplateEditorFromList = (id) => openEditor(id);
  window.setActiveTpl = (id) => activarPlantilla(id);
  window.deleteTpl = (id) => eliminarPlantilla(id);
  window.saveTpl = () => guardarPlantilla();
  // Permite a otros paneles (ej: navbar) refrescar la lista de plantillas tras
  // crear una página personalizada, sin recargar toda la página.
  window.reloadPlantillas = () => loadPlantillas();

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
   MÓDULOS — catálogo plano v2: lista → editor de módulo
   ═══════════════════════════════════════════════════════ */
const SIMPLE_FIELD_TYPES = ['text','textarea','number','color','toggle'];
const GLOBAL_TIPOS_MOD = new Set(['nav','footer','footer-full']);

let _mods       = [];      // catálogo plano [{ id_modulo, tipo, nombre, data, design, alerta }]
let _modUsos    = {};      // id_modulo → cantidad de plantillas que lo usan
let _curModId   = null;
let _curModType = null;
let _curModData = { nombre: '', alerta: false, data: {}, design: {} };

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
    const [mres, pres] = await Promise.all([
      window.__svc.apiGet('/modulos'),
      window.__svc.apiGet('/plantillas').catch(() => ({ plantillas: [] })),
    ]);
    _mods = Array.isArray(mres.modulos) ? mres.modulos : [];
    _modUsos = {};
    (pres.plantillas || []).forEach(p => (p.id_modulos || []).forEach(id => { _modUsos[id] = (_modUsos[id] || 0) + 1; }));
    renderModCatalog();
  } catch(e) {
    window.__svc.showNotif('Error cargando módulos: ' + e.message, 'error');
  }
};

/* ── Vista 1: catálogo plano (un card por módulo, agrupado por tipo) ── */
function renderModCatalog() {
  _showView('modulos-catalog-view');
  const grid = document.getElementById('modulos-grid');
  if (!grid) return;
  if (!_mods.length) {
    grid.innerHTML = `<div class="mod-cat-empty">No hay módulos todavía.</div>`;
    return;
  }
  const byTipo = {};
  _mods.forEach(m => (byTipo[m.tipo] = byTipo[m.tipo] || []).push(m));

  // Una sección por tipo: header (ícono + label + contador + "Nuevo") y grilla de cards.
  grid.innerHTML = Object.entries(byTipo).map(([tipo, mods]) => {
    const label  = SECTIONS[tipo]?.label || tipo;
    const icon   = SECTIONS[tipo]?.icon || '';
    const global = GLOBAL_TIPOS_MOD.has(tipo);
    const cards = mods.map(m => {
      const usos = _modUsos[m.id_modulo] || 0;
      return `<div class="mod-card">
        <div class="mod-card-top">
          <span class="mod-card-id">#${m.id_modulo}</span>
          <span class="mod-usos ${usos ? 'on' : ''}">${usos} uso${usos!==1?'s':''}</span>
        </div>
        <div class="mod-card-name" title="${escAttr(m.nombre || '')}">${escAttr(m.nombre || '(sin nombre)')}</div>
        <div class="mod-card-actions">
          <button class="btn-edit-small mod-card-edit" onclick="openModEditor(${m.id_modulo})">Editar</button>
          <button class="btn-edit-small mod-icon-btn" style="background:#f1f5f9;color:#334155;" onclick="duplicarModulo(${m.id_modulo})" title="Duplicar"><i class="fa-solid fa-clone"></i></button>
          <button class="btn-edit-small mod-icon-btn" style="background:#fee2e2;color:#991b1b;" onclick="eliminarModulo(${m.id_modulo})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
    }).join('');
    return `<section class="mod-group">
      <div class="mod-group-head">
        <div class="mod-group-title">${icon}<span>${escAttr(label)}</span><span class="mod-group-count">${mods.length}</span>${global ? '<span class="mod-global-badge">global</span>' : ''}</div>
        <button class="btn-add mod-group-new" onclick="nuevoModulo('${tipo}')"><i class="fa-solid fa-plus"></i> Nuevo</button>
      </div>
      <div class="mod-group-grid">${cards}</div>
    </section>`;
  }).join('');
}

/* ── Vista 2: editor de un módulo del catálogo ── */
window.openModEditor = function(id) {
  const m = _mods.find(x => x.id_modulo === Number(id));
  if (!m) return;
  const sec = SECTIONS[m.tipo];
  if (!sec) { window.__svc.showNotif('Tipo de módulo desconocido: ' + m.tipo, 'error'); return; }
  _curModId   = m.id_modulo;
  _curModType = m.tipo;
  _curModData = {
    nombre: m.nombre || '',
    alerta: m.alerta === true,
    data:   { ...sec.defaultData,   ...(m.data   || {}) },
    design: { ...sec.defaultDesign, ...(m.design || {}) },
  };

  const titleEl = document.getElementById('modulos-editor-title');
  const nameEl  = document.getElementById('modulos-editor-variant-name');
  if (titleEl) titleEl.innerHTML = `${sec.icon || ''} ${sec.label} · #${m.id_modulo}`;
  if (nameEl)  nameEl.textContent  = m.nombre || '';

  const nameInput = document.getElementById('modulos-variant-name-input');
  if (nameInput) {
    nameInput.value = m.nombre || '';
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

  renderModContentCard(m.tipo);

  _showView('modulos-editor-view');
  previewCurrentVariant({ scroll: false });   // preview en vivo abierto desde el inicio
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
      scheduleLivePreview();
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
        scheduleLivePreview();
      });
    }
  });
}

/* ── Preview en vivo (debounced): actualiza si el preview ya está abierto ── */
let _previewTimer = null;
function scheduleLivePreview() {
  const card = document.getElementById('modulos-preview-card');
  if (!card || card.style.display === 'none') return;
  clearTimeout(_previewTimer);
  _previewTimer = setTimeout(() => previewCurrentVariant({ scroll: false }), 200);
}

/* ── Preview del módulo ── */
function previewCurrentVariant(opts = {}) {
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

  // Scroll preview into view (solo en apertura manual, no en updates en vivo)
  if (opts.scroll !== false) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Duplicar módulo ── */
window.duplicarModulo = async function(id) {
  const m = _mods.find(x => x.id_modulo === Number(id));
  if (!m) return;
  try {
    const res = await window.__svc.apiPost('/modulos', {
      tipo:   m.tipo,
      nombre: `${m.nombre} (copia)`,
      data:   JSON.parse(JSON.stringify(m.data   || {})),
      design: JSON.parse(JSON.stringify(m.design || {})),
      alerta: m.alerta === true,
    });
    _mods.push(res.modulo);
    renderModCatalog();
    window.__svc.showNotif('Módulo duplicado', 'success');
  } catch(e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
  }
};

/* ── Eliminar módulo (guarda si está referenciado) ── */
window.eliminarModulo = async function(id) {
  const m = _mods.find(x => x.id_modulo === Number(id));
  if (!m) return;
  const usos = _modUsos[m.id_modulo] || 0;
  if (usos > 0) { window.__svc.showNotif(`No se puede eliminar: lo usan ${usos} plantilla(s). Quitalo de ellas primero.`, 'error'); return; }
  if (!confirm(`¿Eliminar el módulo "${m.nombre}" (#${m.id_modulo})?`)) return;
  try {
    await window.__svc.apiDelete(`/modulos/${m.id_modulo}`);
    _mods = _mods.filter(x => x.id_modulo !== m.id_modulo);
    renderModCatalog();
    window.__svc.showNotif('Módulo eliminado', 'success');
  } catch(e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
  }
};

/* ── Crear módulo nuevo de un tipo ── */
window.nuevoModulo = async function(tipo) {
  const sec = SECTIONS[tipo];
  if (!sec) return;
  const nombre = prompt(`Nombre del nuevo módulo (${sec.label}):`, `${sec.label} — nuevo`);
  if (!nombre?.trim()) return;
  try {
    const res = await window.__svc.apiPost('/modulos', {
      tipo,
      nombre: nombre.trim(),
      data:   JSON.parse(JSON.stringify(sec.defaultData   || {})),
      design: JSON.parse(JSON.stringify(sec.defaultDesign || {})),
    });
    _mods.push(res.modulo);
    window.__svc.showNotif('Módulo creado', 'success');
    openModEditor(res.modulo.id_modulo);
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

/* ── Botón: volver al catálogo (desde editor o vista vieja) ── */
document.getElementById('modulos-variants-back-btn')?.addEventListener('click', renderModCatalog);
document.getElementById('modulos-back-btn')?.addEventListener('click', renderModCatalog);

/* ── Botón: guardar módulo ── */
document.getElementById('modulos-save-btn')?.addEventListener('click', async () => {
  if (!_curModId) return;
  const nombre = document.getElementById('modulos-variant-name-input')?.value?.trim() || _curModData.nombre;
  try {
    const res = await window.__svc.apiPut(`/modulos/${_curModId}`, {
      nombre,
      alerta: _curModData.alerta,
      data:   _curModData.data,
      design: _curModData.design,
    });
    const idx = _mods.findIndex(m => m.id_modulo === _curModId);
    if (idx !== -1) _mods[idx] = res.modulo;
    const nameEl = document.getElementById('modulos-editor-variant-name');
    if (nameEl) nameEl.textContent = nombre;
    window.__svc.showNotif('Módulo guardado', 'success');
    previewCurrentVariant();
  } catch(e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
  }
});
