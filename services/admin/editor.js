import { SECTIONS, TIPOS_HTML, renderModulo, setEditMode, setFieldColors, SERVICE_ICON_CATALOG, SERVICE_LEGACY_ICONS, serviceCardIcon } from '../sections.js';
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
  slotSearch: null,       // buscador inline abierto en un slot vacío: { ci, mi, query }
};

const CONT_MAX = 3;   // máximo de módulos por contenedor (fila)

// Contenedores: conversión working-model ↔ persistido
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
// ¿Entrada de contenedor inline? (card suelta guardada dentro de la plantilla)
const esInline = x => x && typeof x === 'object' && x.inline === true;
// Todas las entradas de todos los contenedores (ids numéricos + módulos inline).
function allContEntries() {
  return contsToContenedores().reduce((acc, m) => acc.concat(m), []);
}
// lista plana de ids NUMÉRICOS (orden de fila e índice) — canónica para
// id_modulos. Los módulos inline no tienen id, así que se excluyen.
function allModIds() {
  return allContEntries().filter(x => typeof x === 'number');
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

// Mantiene activeCont apuntando al contenedor incompleto (destino de inserción).
function refreshContControls() {
  e3.activeCont = pendingContIndex();
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

// Items del nav (dropdowns + links) desde navbar.json — igual que el runtime
// (page-bootstrap): menú jerárquico padre/hijos; un contenedor (encabezado con
// hijos) se vuelve desplegable, el resto links sueltos.
function buildNavItems(botones) {
  const all = botones || [];
  const visibles = b => b.activo !== false && b.href !== '/';
  const hijosDe = id => all
    .filter(b => (b.padre || 0) === id && visibles(b))
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const top = all.filter(b => (b.padre || 0) === 0 && visibles(b));
  const dropdowns = [];
  const links = [];
  top.forEach(b => {
    const hijos = hijosDe(b.id_menu);
    if (hijos.length) {
      dropdowns.push({ orden: b.orden || 0, item: {
        tipo: 'dropdown', titulo: b.titulo,
        children: hijos.map(h => ({ titulo: h.titulo, href: h.href || '#' })),
      } });
    } else if (b.href) {
      links.push(b);   // ítems sin href ni hijos (contenedor vacío) se omiten
    }
  });
  const items = [];
  dropdowns.sort((a, b) => a.orden - b.orden).forEach(d => items.push(d.item));
  links.sort((a, b) => (a.orden || 0) - (b.orden || 0))
       .forEach(b => items.push({ tipo: 'link', titulo: b.titulo, href: b.href || '#' }));
  return items;
}

// Resuelve los módulos de todos los contenedores → instancias (con items de nav
// inyectados). Lo usa cssFilesFor para saber qué CSS cargar en el iframe.
function resolvedMods() {
  const navItems = buildNavItems(e3.navbar);
  return allContEntries().map(entry => {
    if (esInline(entry)) return entry;   // módulo inline: ya trae tipo/data/design
    const m = modById(entry);
    if (!m) return null;
    return m.tipo === 'nav' ? { ...m, data: { ...m.data, items: navItems } } : m;
  }).filter(Boolean);
}

const escAttr = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const notif = (msg, type='success') => window.__svc?.showNotif?.(msg, type) ?? console.log('[e3]', msg);

// API helper
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

// Module list (todos los módulos disponibles, sin filtro por tipo)
function modulesForTipo(_tipo) {
  return Object.entries(SECTIONS);
}

// pageKey — slug común para unir el navbar (href "/html/fibra_optica") con la
// lista de páginas (file "html/fibra_optica.html"). La raíz "/" se mapea a "index".
const pageKey = s => String(s ?? '').replace(/^\//, '').replace(/\.html$/, '') || 'index';

// Tipo select populate
// Llena el <select> de "HTML destino" a partir de los ÍTEMS DEL NAVBAR (así las
// pestañas recién creadas aparecen como destino). Cada ítem del menú es una
// página posible: si ya tiene una plantilla vinculada (por id_menu) se usa su
// tipo; si no, es una página personalizada nueva → `btn-{id_menu}`. Los ítems
// con hijos (desplegables, p.ej. "Instalaciones") se muestran como <optgroup> con
// sus hijos adentro. Al final se agregan las páginas del sistema que no están en
// el menú (Artículo, Perfil de Cliente). El id_menu viaja en `data-idmenu` para
// que crearPlantilla vincule la página con su pestaña.
function populateTipoSelect() {
  const sel = document.getElementById('np-tipo');
  if (!sel) return;

  const botones = e3.navbar || [];
  // tipo de un ítem: el de su plantilla vinculada, o btn-{id_menu} si no tiene.
  const plantillaDeMenu = idm => (e3.plantillas || []).find(p => (p.id_menu || []).includes(idm));
  const tipoDeItem = b => { const p = plantillaDeMenu(b.id_menu); return p ? p.tipo : `btn-${b.id_menu}`; };

  const hijosDe = id => botones.filter(b => (b.padre || 0) === id).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const top     = botones.filter(b => (b.padre || 0) === 0).sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const opt = (tipo, label, idmenu) =>
    `<option value="${escAttr(tipo)}"${idmenu != null ? ` data-idmenu="${idmenu}"` : ''}>${escAttr(label)}</option>`;

  const emitidos = new Set();   // tipos ya agregados (evita duplicar con TIPOS_HTML)
  let html = '<option value="">— Seleccionar página destino —</option>';

  top.forEach(b => {
    const hijos = hijosDe(b.id_menu);
    if (hijos.length) {
      // Contenedor desplegable → optgroup; sus hijos son las páginas.
      const inner = hijos.map(h => {
        const tipo = tipoDeItem(h); emitidos.add(tipo);
        return opt(tipo, h.titulo, h.id_menu);
      }).join('');
      html += `<optgroup label="${escAttr(b.titulo)}">${inner}</optgroup>`;
    } else {
      const tipo = tipoDeItem(b); emitidos.add(tipo);
      html += opt(tipo, b.titulo, b.id_menu);
    }
  });

  // Páginas del sistema que no están en el menú (Artículo, Perfil de Cliente).
  TIPOS_HTML.forEach(t => {
    if (emitidos.has(t.value)) return;
    emitidos.add(t.value);
    html += opt(t.value, t.label, null);
  });

  sel.innerHTML = html;
}

// Load + render dashboard
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

// Helpers de vencimiento
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
    banner.style.background = '#fff7ed';
    banner.style.borderLeftColor = '#ea580c';
    banner.querySelector('.dash-vencidas-banner-text').style.color = '#9a3412';
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
    // El vencimiento se muestra también en borradores (se asigna al crear).
    if (p.fecha_fin) {
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
            <button class="tpl-rename-btn" data-e3-rename="${p.id_plantilla}" title="Renombrar plantilla"><i class="fa-solid fa-pencil fa-xs"></i></button>
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
    if (p.fecha_fin) {
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

// Modal
async function openNuevaModal(preTipo = '') {
  document.getElementById('np-name').value = '';
  document.getElementById('np-desc').value = '';
  // Releemos el navbar al abrir para reflejar las pestañas recién creadas en el
  // selector de "HTML destino" (si no, quedaba con la copia vieja de e3.navbar).
  try { const nav = await api('GET', '/data/navbar'); e3.navbar = nav.botones || e3.navbar; } catch (_) {}
  populateTipoSelect();
  const tipoSel = document.getElementById('np-tipo');
  if (tipoSel) tipoSel.value = preTipo;
  document.getElementById('modal-nueva-plantilla').classList.add('open');
  setTimeout(() => document.getElementById('np-name').focus(), 50);
}

async function crearPlantilla() {
  const nombre = document.getElementById('np-name').value.trim();
  const sel = document.getElementById('np-tipo');
  const tipo = sel?.value || '';
  // La opción lleva el id_menu de su pestaña del navbar (data-idmenu): se manda
  // para vincular la página con esa pestaña (y, en custom btn-*, el backend le
  // pone el href para que el menú la enlace).
  const idmenu = sel?.selectedOptions?.[0]?.dataset?.idmenu;
  const descripcion = document.getElementById('np-desc').value.trim();
  if (!nombre) return notif('El nombre es requerido', 'error');
  if (!tipo) return notif('Seleccioná el HTML destino', 'error');
  try {
    const body = { nombre, tipo, descripcion };
    if (idmenu) body.id_menu = [Number(idmenu)];
    const { plantilla } = await api('POST', '/plantillas', body);
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

// EDITOR
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
    e3.slotSearch = null;
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
  e3.slotSearch = null;
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
      <div style="background:var(--white);border-bottom:1px solid var(--slate-200);padding:.75rem 1.5rem; display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">
          <button class="btn-edit-small" id="e3-back"><i class="fa-solid fa-arrow-left fa-lg"></i> Volver</button>
        </div>
      <div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;">
        <span style="font-size:.5rem;font-weight:900;letter-spacing:.3em;text-transform:uppercase;background:var(--sisgra-blue);color:#fff;padding:.2rem .6rem;">Plantilla</span>
        <span style="font-size:1.4rem;font-weight:900;color:var(--sisgra-blue);letter-spacing:-.03em;font-style:italic;">"${escAttr(tpl.nombre)}"</span>
        <span style="font-size:.6rem;font-weight:900;letter-spacing:.2em;text-transform:uppercase;padding:.2rem .6rem;${tpl.activa ? 'background:#dcfce7;color:#166534;' : 'background:#fef3c7;color:#92400e;'}">${tpl.activa ? 'Activa' : 'Borrador'}</span>
        <span id="e3-dirty" style="display:none;color:#dc2626;font-size:.6rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">● Sin guardar</span>
      </div>
      <div style="display:flex;align-items:center;gap:1.25rem;">
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
      .e3-props-tabs{display:flex;gap:.25rem;}
      .e3-props-tabs button{font-size:.58rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:.25rem .55rem;border:1px solid var(--slate-200);background:#fff;color:var(--slate-500);cursor:pointer;border-radius:.3rem;}
      .e3-props-tabs button.active{background:var(--sisgra-blue);color:#fff;border-color:var(--sisgra-blue);}
    </style>
    <div class="editor-shell">
      <div class="page-canvas-wrap">
        <div style="flex:1;min-height:0;overflow:auto;display:flex;align-items:stretch;justify-content:center;padding:1rem 2rem;">
          <iframe class="page-frame desktop" id="e3-canvas" style="border:none;background:#fff;height:100%;min-height:420px;"></iframe>
        </div>
      </div>
    </div>`;

  document.getElementById('e3-back').addEventListener('click', backToOverview);
  document.getElementById('e3-guardar').addEventListener('click', guardarPlantilla);
  document.getElementById('e3-activar')?.addEventListener('click', async () => {
    await activarPlantilla(tpl.id_plantilla);
    renderEditorShell();
  });
  // Click fuera del iframe (en el panel) → cierra el buscador inline del slot.
  document.removeEventListener('mousedown', onParentMouseCloseSlotSearch);
  document.addEventListener('mousedown', onParentMouseCloseSlotSearch);
  document.querySelectorAll('[data-e3-tab]').forEach(t => t.addEventListener('click', () => {
    e3.propsTab = t.dataset.e3Tab;
    document.querySelectorAll('[data-e3-tab]').forEach(x => x.classList.toggle('active', x === t));
    renderProps();
  }));

  initIframe(() => {
    try { renderCanvas(); } catch (e) { console.error('[e3] renderCanvas error:', e); }
  });
  renderProps();
}

// BUSCADOR INLINE EN EL SLOT
// El buscador vive DENTRO del slot vacío clickeado (en el iframe): buscar acá
// inserta SOLO en ese contenedor. Elegir un resultado inserta el módulo al
// instante (un módulo por slot, sin chips ni botón "Insertar seleccionados").
/* Páginas asignadas de un módulo, normalizadas: 'all' | [ids].
   `id_pagina` puede ser null, 'all', un id suelto (datos viejos) o un array
   de ids (multi-página). Compartido con el catálogo de módulos de abajo. */
function _paginasDe(id_pagina) {
  if (id_pagina === 'all') return 'all';
  if (id_pagina == null || id_pagina === '') return [];
  return (Array.isArray(id_pagina) ? id_pagina : [id_pagina]).map(Number).filter(n => !isNaN(n));
}

/* ¿La asignación (id_pagina) de una VARIANTE la habilita en la plantilla que se
   está editando? La asignación es SIEMPRE por variante (nunca por tipo). Reglas:
     • 'all' o SIN asignar → disponible en TODAS las plantillas.
     • asignada a ítem(s)  → SOLO en las plantillas vinculadas a esos ítems del navbar.
   Así, al asignar una variante a un ítem del menú, aparece en el buscador de
   inserción de la plantilla de ese ítem (y no se "esconde" si no tiene asignación). */
function _idPaginaAllowsActiveTpl(idp) {
  const pags = _paginasDe(idp);
  if (pags === 'all') return true;        // "Todas las páginas" → en todos los buscadores
  if (pags.length === 0) return false;    // SIN asignar a ningún ítem → no se muestra en ninguno
  const tplId = e3.activeTpl?.id_plantilla;
  return tplId != null && pags.includes(Number(tplId));
}
function _modAllowedInActiveTpl(m) {
  return GLOBAL_TIPOS.has(m.tipo) || _idPaginaAllowsActiveTpl(m.id_pagina);
}

function searchResults(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const res = [];
  for (const m of e3.modulos) {
    if (m.data?.soloCard) continue;             // copias inline de una card: no se listan acá
    // Resultado de MÓDULO entero: si esta VARIANTE está asignada a esta plantilla
    // (o es global / "Todas" / sin asignar). SIN límite de repetición: el mismo
    // módulo se puede insertar las veces que se quiera en la misma plantilla
    // (cada ocurrencia es una referencia más en id_modulos/contenedores).
    if (_modAllowedInActiveTpl(m)) {
      const hay = `${m.nombre} ${m.tipo} ${SECTIONS[m.tipo]?.label || ''}`.toLowerCase();
      if (hay.includes(q)) res.push({ kind: 'mod', id_modulo: m.id_modulo, tipo: m.tipo, label: m.nombre, sub: SECTIONS[m.tipo]?.label || m.tipo });
    }
    // Resultados por TARJETA: cada card de un módulo "services" se puede insertar
    // suelta (copia de 1 sola card). Se filtra por la asignación de CADA tarjeta
    // (card.id_pagina), no por la del módulo: una card asignada a "Soporte" aparece
    // en el buscador de Soporte aunque su módulo de origen sea de otra página.
    if (m.tipo === 'services' && Array.isArray(m.data?.cards)) {
      m.data.cards.forEach((c, idx) => {
        if (!_idPaginaAllowsActiveTpl(c.id_pagina)) return;
        const hay = `${c.titulo || ''} ${c.descripcion || ''}`.toLowerCase();
        if (hay.includes(q)) res.push({
          kind: 'card', parentId: m.id_modulo, cardId: c.id || '', cardIndex: idx,
          tipo: 'services', label: c.titulo || 'Tarjeta', sub: `Tarjeta · ${m.nombre}`,
        });
      });
    }
  }
  return res.slice(0, 40);
}

// Conecta el buscador inline del slot abierto (si hay uno en el canvas).
function bindSlotSearch(doc) {
  const slot = doc.querySelector('.e3-slot-open');
  if (!slot || !e3.slotSearch) return;
  const ci = +slot.dataset.ci;
  slot.querySelector('.e3-slot-search-close')?.addEventListener('click', ev => {
    ev.stopPropagation();
    closeSlotSearch();
  });
  const input = slot.querySelector('.e3-slot-search-input');
  if (!input) return;
  input.value = e3.slotSearch.query || '';
  setTimeout(() => input.focus(), 0);
  input.addEventListener('input', () => {
    e3.slotSearch.query = input.value;
    renderSlotResults(slot, ci);
  });
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      closeSlotSearch();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const r = searchResults(e3.slotSearch.query)[0];
      if (!r) return;
      if (r.kind === 'card') insertarCardEnContenedor(ci, r);
      else insertarEnContenedor(ci, r.id_modulo);
    }
  });
  renderSlotResults(slot, ci);
}

function renderSlotResults(slot, ci) {
  const box = slot.querySelector('.e3-slot-results');
  if (!box || !e3.slotSearch) return;
  const q = (e3.slotSearch.query || '').trim();
  if (!q) { box.style.display = 'none'; box.innerHTML = ''; return; }
  const res = searchResults(q);
  box.style.display = 'block';
  if (!res.length) {
    box.innerHTML = '<div class="e3-slot-empty">No hay módulos disponibles para esta búsqueda.</div>';
    return;
  }
  box.innerHTML = res.map((r, i) => {
    const tag  = r.kind === 'card'
      ? '<span style="margin-left:.4rem;font-size:.5rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:#2563eb;padding:.05rem .3rem;border-radius:3px;vertical-align:middle;">tarjeta</span>'
      : '';
    const meta = r.kind === 'card'
      ? escAttr(r.sub)
      : `${escAttr(r.sub)} · #${r.id_modulo}${GLOBAL_TIPOS.has(r.tipo) ? ' · global' : ''}`;
    return `
    <div class="e3-slot-result" data-res="${i}">
      <span class="e3-slot-result-name">${escAttr(r.label)}${tag}</span>
      <span class="e3-slot-result-sub">${meta}</span>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-res]').forEach(el =>
    el.addEventListener('click', ev => {
      ev.stopPropagation();
      const r = res[+el.dataset.res];
      if (r.kind === 'card') insertarCardEnContenedor(ci, r);
      else insertarEnContenedor(ci, r.id_modulo);
    }));
}

function closeSlotSearch() {
  if (!e3.slotSearch) return;
  e3.slotSearch = null;
  renderCanvas();
}

// Inserta el módulo elegido en ESE contenedor (el del slot donde está el buscador).
// Referencia DIRECTA al módulo (sin clonar): editar su contenido se refleja en
// vivo en la plantilla donde está usado.
function insertarEnContenedor(ci, id_modulo) {
  const cont = e3.conts[ci];
  if (!cont) return;
  if (cont.modulos.length >= cont.cap) {
    notif('Este contenedor ya está completo', 'error');
    return;
  }
  cont.modulos.push(id_modulo);
  e3.sel = { ci, mi: cont.modulos.length - 1 };
  e3.slotSearch = null;
  markDirty(); renderCanvas(); renderProps();
  notif('✓ Módulo insertado');
}

// Inserta una TARJETA suelta como módulo INLINE dentro del contenedor: una copia
// de la card (con `soloCard` → se renderiza sin el título de sección) guardada
// EN LA PLANTILLA, sin crear ningún módulo en el catálogo. Es independiente:
// editar la tarjeta original no la modifica.
function insertarCardEnContenedor(ci, r) {
  const cont = e3.conts[ci];
  if (!cont) return;
  if (cont.modulos.length >= cont.cap) {
    notif('Este contenedor ya está completo', 'error');
    return;
  }
  const parent = modById(r.parentId);
  if (!parent) { notif('No se encontró el módulo de origen', 'error'); return; }
  const cards = parent.data?.cards || [];
  const card  = cards.find(c => (c.id || '') === r.cardId && r.cardId) || cards[r.cardIndex];
  if (!card) { notif('No se encontró la tarjeta', 'error'); return; }
  const inline = {
    inline: true,
    tipo:   'services',
    nombre: card.titulo || 'Tarjeta',
    data:   { ...JSON.parse(JSON.stringify(parent.data || {})), cards: [JSON.parse(JSON.stringify(card))], soloCard: true },
    design: JSON.parse(JSON.stringify(parent.design || {})),
  };
  cont.modulos.push(inline);
  e3.sel = { ci, mi: cont.modulos.length - 1 };
  e3.slotSearch = null;
  markDirty(); renderCanvas(); renderProps();
  notif('✓ Tarjeta insertada');
}

// Cierra el buscador del slot al click fuera del iframe (en el panel).
function onParentMouseCloseSlotSearch() {
  if (e3.slotSearch) closeSlotSearch();
}

// Cierra el buscador del slot al click DENTRO del iframe pero fuera de un slot.
function onIframeClickCloseSlotSearch(ev) {
  if (!e3.slotSearch) return;
  if (ev.target.closest('.e3-slot')) return;   // clicks en slots: abren/usan el buscador
  closeSlotSearch();
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
  // El buscador NO se abre solo: aparece recién al click en "+ Insertar módulo".
  e3.slotSearch = null;
  markDirty(); renderCanvas(); renderProps();
  notif(`✓ Contenedor ${n}×1 creado — tocá "+ Insertar módulo" para llenar sus ${n} lugar${n > 1 ? 'es' : ''}`);
}

// Botón "Nuevo contenedor" (al fondo del canvas, dentro del iframe)
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

// Iframe con CSS específico por tipo

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
  /* Contenedores (filas) en el canvas */
  .e3-cont{position:relative;border:2px dashed #cbd5e1;margin:10px;transition:border-color .15s,box-shadow .15s;}
  .e3-cont.e3-cont-active{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12);}
  .e3-cont-bar{display:flex;align-items:center;justify-content:space-between;gap:.5rem;background:#f1f5f9;border-bottom:1px solid #e2e8f0;padding:.25rem .4rem;font-family:Inter,system-ui,sans-serif;}
  .e3-cont-tag{font-size:.58rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#475569;cursor:pointer;display:flex;align-items:center;gap:.35rem;}
  .e3-cont-active .e3-cont-tag{color:#2563eb;}
  .e3-cont-ctrls{display:flex;gap:.2rem;}
  .e3-cont-ctrls button{background:#fff;border:1px solid #cbd5e1;padding:.2rem .4rem;font-size:.65rem;line-height:1;color:#0A1D37;cursor:pointer;font-family:inherit;border-radius:2px;}
  .e3-cont-ctrls .e3-danger{color:#dc2626;}
  .e3-cont-grid{display:grid;align-items:stretch;}
  .e3-slot{position:relative;display:flex;align-items:center;justify-content:center;min-height:90px;border:2px dashed #d4dae3;margin:6px;background:repeating-linear-gradient(45deg,#fafbfc,#fafbfc 8px,#f1f5f9 8px,#f1f5f9 16px);cursor:pointer;transition:border-color .15s,background .15s;}
  .e3-slot:hover{border-color:#60a5fa;}
  .e3-slot-inner{font:700 .68rem/1.3 Inter,system-ui,sans-serif;color:#94a3b8;letter-spacing:.06em;text-transform:uppercase;display:flex;align-items:center;gap:.4rem;}
  /* Buscador inline DENTRO del slot clickeado */
  .e3-slot.e3-slot-open{cursor:default;align-items:stretch;background:#fff;border-color:#2563eb;border-style:solid;}
  .e3-slot-search{display:flex;flex-direction:column;gap:.45rem;width:100%;padding:.7rem;font-family:Inter,system-ui,sans-serif;box-sizing:border-box;}
  .e3-slot-search-title{font-size:.58rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#2563eb;display:flex;align-items:center;justify-content:space-between;gap:.5rem;}
  .e3-slot-search-close{background:none;border:none;font-size:1.05rem;line-height:1;color:#94a3b8;cursor:pointer;padding:0 .2rem;}
  .e3-slot-search-close:hover{color:#334155;}
  .e3-slot-search-input{border:1px solid #cbd5e1;border-radius:.35rem;padding:.45rem .6rem;font-size:.78rem;font-family:inherit;outline:none;background:#fff;width:100%;box-sizing:border-box;}
  .e3-slot-search-input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12);}
  .e3-slot-results{max-height:180px;overflow:auto;border:1px solid #e2e8f0;border-radius:.35rem;background:#fff;display:none;}
  .e3-slot-result{padding:.45rem .6rem;cursor:pointer;border-bottom:1px solid #f1f5f9;display:flex;flex-direction:column;gap:.1rem;}
  .e3-slot-result:last-child{border-bottom:none;}
  .e3-slot-result:hover{background:#eff6ff;}
  .e3-slot-result-name{font-size:.74rem;font-weight:700;color:#1e293b;}
  .e3-slot-result-sub{font-size:.58rem;color:#94a3b8;letter-spacing:.04em;text-transform:uppercase;}
  .e3-slot-empty{font-size:.66rem;color:#94a3b8;padding:.45rem .6rem;}
  /* Botón "Nuevo contenedor" al fondo del canvas */
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
        // Slot vacío: si el buscador está abierto EN ESTE slot, se renderiza
        // adentro (reemplaza al "+ Insertar módulo"); si no, el mensaje.
        const abierto = e3.slotSearch && e3.slotSearch.ci === ci && e3.slotSearch.mi === mi;
        slots.push(abierto ? `
<div class="e3-slot e3-slot-open" data-ci="${ci}" data-mi="${mi}">
  <div class="e3-slot-search">
    <div class="e3-slot-search-title"><span>Insertar módulo acá</span><button type="button" class="e3-slot-search-close" title="Cerrar">×</button></div>
    <input class="e3-slot-search-input" type="text" placeholder="Buscar módulo (ej: noticias)…" autocomplete="off"/>
    <div class="e3-slot-results"></div>
  </div>
</div>` : `<div class="e3-slot" data-ci="${ci}" data-mi="${mi}"><div class="e3-slot-inner"><i class="fa-solid fa-plus"></i> Insertar módulo</div></div>`);
        continue;
      }
      const inline = esInline(id);
      const m = inline ? id : modById(id);
      const inner = m
        ? renderModulo(m.tipo === 'nav' ? { ...m, data: { ...m.data, items: navItems } } : m)
        : `<div style="padding:2rem;background:#fee;color:#900;text-align:center;">Módulo #${id} no está en el catálogo</div>`;
      const tipoLbl = m ? (SECTIONS[m.tipo]?.label || m.tipo) : '—';
      const global = m && GLOBAL_TIPOS.has(m.tipo);
      const isSel = e3.sel && e3.sel.ci === ci && e3.sel.mi === mi;
      const badge = inline
        ? `Tarjeta suelta · ${escAttr(tipoLbl)}`
        : `#${id} · ${escAttr(tipoLbl)}${global ? ' · global' : ''}`;
      slots.push(`
<div class="e3-sec-wrap ${isSel ? 'e3-selected' : ''}" data-ci="${ci}" data-mi="${mi}">
  <div class="e3-sec-badge">${badge}</div>
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
  // Slots vacíos → abren el buscador inline DENTRO del slot clickeado (solo
  // se puede insertar en ESE contenedor).
  doc.querySelectorAll('.e3-slot:not(.e3-slot-open)').forEach(s => {
    s.addEventListener('click', () => {
      e3.slotSearch = { ci: +s.dataset.ci, mi: +s.dataset.mi, query: '' };
      renderCanvas();
    });
  });
  bindSlotSearch(doc);
  // Click dentro del iframe pero fuera de un slot → cierra el buscador.
  doc.removeEventListener('click', onIframeClickCloseSlotSearch);
  doc.addEventListener('click', onIframeClickCloseSlotSearch);
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
  e3.slotSearch = null;   // los índices de slots cambiaron
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
  e3.slotSearch = null;   // los índices de contenedores cambiaron
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
  e3.slotSearch = null;   // los índices de contenedores cambiaron
  markDirty(); renderCanvas(); renderProps();
}

function markDirty() { e3.dirty = true; syncActiveTpl(); document.getElementById('e3-dirty').style.display = 'inline'; }
function clearDirty() { e3.dirty = false; document.getElementById('e3-dirty').style.display = 'none'; }

// PROPS PANEL
function renderProps() {
  const body = document.getElementById('e3-props-body');
  if (!body) return;
  const typeEl = document.getElementById('e3-props-type');
  const entry = e3.sel ? e3.conts[e3.sel.ci]?.modulos?.[e3.sel.mi] : undefined;
  if (esInline(entry)) { renderInlineCardProps(entry, body, typeEl); return; }
  const id = entry;
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

// Props de una TARJETA suelta (módulo inline guardado en la plantilla). Edita la
// única card del módulo inline en vivo (título, descripción, enlace) y re-renderiza.
function renderInlineCardProps(entry, body, typeEl) {
  if (typeEl) typeEl.textContent = 'Tarjeta suelta';
  entry.data = entry.data || {};
  if (!Array.isArray(entry.data.cards) || !entry.data.cards.length) entry.data.cards = [{}];
  const card = entry.data.cards[0];
  body.innerHTML = `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;font-size:.62rem;padding:.5rem .6rem;margin-bottom:.6rem;line-height:1.5;border-radius:.3rem;">
      Tarjeta guardada <b>dentro de esta plantilla</b> (no es un módulo del catálogo). Es una copia independiente: editar la original no la cambia.
    </div>
    <div class="props-field"><label class="props-label">Título</label><input class="props-input" type="text" data-icf="titulo" value="${escAttr(card.titulo || '')}"/></div>
    <div class="props-field"><label class="props-label">Descripción</label><textarea class="props-textarea" data-icf="descripcion" style="min-height:80px;">${escAttr(card.descripcion || '').replace(/&quot;/g,'"')}</textarea></div>
    <div class="props-field"><label class="props-label">Texto del enlace</label><input class="props-input" type="text" data-icf="linkText" value="${escAttr(card.linkText || '')}"/></div>
    <div class="props-field"><label class="props-label">URL de destino</label><input class="props-input" type="text" data-icf="enlace" value="${escAttr(card.enlace || '')}" placeholder="/html/… o https://…"/></div>`;
  body.querySelectorAll('[data-icf]').forEach(inp => {
    inp.addEventListener('input', () => { card[inp.dataset.icf] = inp.value; markDirty(); });
    inp.addEventListener('change', () => renderCanvas());   // refresca el preview al salir del campo
  });
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

// SAVE
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

// Quick access (dashboard card + sidebar link)
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
  card.style.cssText = 'background:linear-gradient(135deg,#0A1D37,#15294d);color:#fff;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:1.25rem 1.75rem;margin-bottom:1.5rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:1.5rem;flex-wrap:wrap;box-shadow:0 2px 10px rgba(10,29,55,.12);transition:transform .15s,box-shadow .15s,border-color .15s;';
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:1rem;">
      <div style="width:42px;height:42px;border-radius:9px;background:rgba(96,165,250,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="fa-solid fa-code" style="color:#60a5fa;font-size:1.05rem;"></i>
      </div>
      <div>
        <div style="font-size:1.05rem;font-weight:700;letter-spacing:-.01em;margin-bottom:.2rem;">Plantillas del sitio</div>
        <div style="font-size:.8125rem;color:rgba(255,255,255,.6);line-height:1.45;">Editá visualmente cada HTML del sitio. Cada plantilla controla en vivo su página correspondiente.</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:.5rem;color:#93c5fd;font-weight:600;font-size:.8125rem;white-space:nowrap;">Ir a plantillas <i class="fa-solid fa-arrow-right"></i></div>`;
  card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-1px)'; card.style.boxShadow = '0 4px 16px rgba(10,29,55,.2)'; card.style.borderColor = 'rgba(96,165,250,.25)'; });
  card.addEventListener('mouseleave', () => { card.style.transform = 'translateY(0)'; card.style.boxShadow = '0 2px 10px rgba(10,29,55,.12)'; card.style.borderColor = 'rgba(255,255,255,.07)'; });
  card.addEventListener('click', goToPlantillas);
  const pageHeader = dash.querySelector('.page-header');
  if (pageHeader) pageHeader.insertAdjacentElement('afterend', card);
  else dash.insertAdjacentElement('afterbegin', card);
}

// Aviso de cambios sin guardar al salir por el sidebar
// El botón "← Volver" ya avisa (backToOverview); esto cubre el resto de las
// salidas del editor: cambiar de panel por el sidebar, "Ver todas las
// plantillas", logout y "+ Nueva plantilla". Corre en fase CAPTURA para frenar
// el click ANTES de que llegue a los handlers de navegación.
function onSidebarLeaveGuard(ev) {
  const navBtn = ev.target.closest('.sidebar-item, .sidebar-logout, #btn-nueva-plantilla');
  if (!navBtn) return;
  const editorAbierto = document.getElementById('panel-tpl-editor')?.classList.contains('active');
  if (!editorAbierto || !e3.dirty || !e3.activeTpl) return;
  if (!confirm('Hay cambios sin guardar. ¿Salir igual?')) {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    return;
  }
  // Sale igual: descartamos el estado del editor para no volver a preguntar.
  e3.slotSearch = null;
  e3.activeTpl = null; e3.conts = []; e3.sel = null; e3.activeCont = null;
  e3.dirty = false;
}

// Init: override old plantilla buttons + inject UI
function initE3() {
  populateTipoSelect();
  injectSidebarLink();
  injectDashboardCard();

  // Guardia de cambios sin guardar (sidebar / logout / nueva plantilla).
  document.removeEventListener('click', onSidebarLeaveGuard, true);
  document.addEventListener('click', onSidebarLeaveGuard, true);

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

/* MÓDULOS — catálogo plano v2: lista → editor de módulo */
const SIMPLE_FIELD_TYPES = ['text','textarea','number','color','toggle'];
const GLOBAL_TIPOS_MOD = new Set(['nav','footer','footer-full']);

let _mods       = [];      // catálogo plano [{ id_modulo, tipo, nombre, id_pagina, data, design, alerta }]
let _modUsos    = {};      // id_modulo → cantidad de plantillas que lo usan
let _plantillas = [];      // lista de plantillas/páginas (para el desplegable "Página asignada")
let _navbar     = [];      // ítems del navbar (botones), para rotular cada página con su ítem
let _modQuery   = '';      // texto del buscador del catálogo de módulos
let _curModId   = null;
let _curModType = null;
let _curModData = { nombre: '', alerta: false, id_pagina: null, data: {}, design: {} };

/* Ítem del navbar al que apunta una plantilla: { titulo, grupo, orden }.
   El grupo es el título del contenedor padre (ej: "Instalaciones"); '' si no
   tiene. Si la página no está en el menú, cae al nombre de la plantilla. */
function _navInfoDePlantilla(id_plantilla) {
  const p      = _plantillas.find(x => x.id_plantilla === id_plantilla);
  const idMenu = (p?.id_menu || [])[0];
  const item   = idMenu != null ? _navbar.find(b => b.id_menu === idMenu) : null;
  const padre  = item?.padre ? _navbar.find(b => b.id_menu === item.padre) : null;
  return {
    item,   // null si la plantilla no existe o no corresponde a un ítem del navbar
    titulo: item?.titulo || p?.nombre || String(id_plantilla),
    grupo:  padre?.titulo || '',
    orden:  item?.orden ?? 999,
  };
}

/* Ítem(s) del navbar a los que pertenece un módulo (o '' si no tiene ninguno
   válido). Solo cuenta plantillas que resuelven a un ítem REAL del navbar: una
   referencia a una plantilla inexistente o sin ítem (ej: id_pagina viejo) se
   ignora en vez de mostrar el id crudo (ej: «13»). */
function _paginaLabel(id_pagina) {
  const pags = _paginasDe(id_pagina);
  if (pags === 'all') return 'Todas las páginas';
  return pags
    .map(id => _navInfoDePlantilla(id))
    .filter(nav => nav.item)
    .map(nav => nav.titulo)
    .join(', ');
}

/* Badge "a dónde pertenece": muestra la página asignada del módulo en el editor. */
function _paginaBadgeHTML(id_pagina) {
  const esTodas = id_pagina === 'all';
  const label   = esTodas ? 'Todas las páginas' : (_paginaLabel(id_pagina) || 'Sin asignar');
  const none    = !esTodas && label === 'Sin asignar';
  const cls     = esTodas ? 'is-global' : (none ? 'is-none' : '');
  const icon    = esTodas ? 'fa-globe' : (none ? 'fa-circle-question' : 'fa-file-lines');
  return `<span class="mod-pertenece ${cls}" title="Página a la que pertenece este módulo"><i class="fa-solid ${icon}"></i> ${escAttr(label)}</span>`;
}

/* Coloca el badge de página en el header de la tarjeta de contenido que corresponda:
   en la tarjeta de lista (blog/clientes) si la tiene, o en la de campos en el resto. */
function _refreshPaginaBadges() {
  const isList = !!MOD_CONTENT_CONFIG[_curModType];
  const badge  = _paginaBadgeHTML(_curModData.id_pagina);
  const dataSlot    = document.getElementById('modulos-editor-data-pagina');
  const contentSlot = document.getElementById('modulos-content-pagina');
  if (dataSlot)    dataSlot.innerHTML    = isList ? '' : badge;
  if (contentSlot) contentSlot.innerHTML = isList ? badge : '';
}

/* Arma una lista de checkboxes de páginas dentro de `box` (multi-página):
   "Todas las páginas" + un check por plantilla. Marcar "Todas" deshabilita
   el resto. `onChange` recibe el valor normalizado: null | 'all' | [ids]. */
function _renderPaginaChecks(box, value, onChange) {
  const pags    = _paginasDe(value);
  const esTodas = pags === 'all';
  const ids     = esTodas ? [] : pags;
  // Solo plantillas que correspondan a un ÍTEM REAL del navbar: las que tienen un
  // id_menu que resuelve a un botón existente. Las páginas del sistema sin ítem
  // (Artículo, Perfil de Cliente) o borradores sin asignar no son ítems del
  // navbar, así que no se listan acá.
  const esItemNavbar = p => {
    const idMenu = (p.id_menu || [])[0];
    return idMenu != null && _navbar.some(b => b.id_menu === idMenu);
  };
  const items   = _plantillas
    .filter(esItemNavbar)
    .map(p => ({ p, nav: _navInfoDePlantilla(p.id_plantilla) }))
    .sort((a, b) => a.nav.orden - b.nav.orden);
  box.innerHTML = [
    `<label class="mod-pag-check"><input type="checkbox" data-pag="all" ${esTodas ? 'checked' : ''}/> 🌐 Todas las páginas</label>`,
    ...items.map(({ p, nav }) =>
      `<label class="mod-pag-check ${esTodas ? 'is-disabled' : ''}"><input type="checkbox" data-pag="${p.id_plantilla}" ${ids.includes(p.id_plantilla) ? 'checked' : ''} ${esTodas ? 'disabled' : ''}/> ${escAttr(nav.titulo)}${nav.grupo ? ` <span class="mod-pag-grupo">${escAttr(nav.grupo)}</span>` : ''}</label>`),
  ].join('');
  box.querySelectorAll('[data-pag]').forEach(cb => cb.addEventListener('change', () => {
    let v;
    if (box.querySelector('[data-pag="all"]')?.checked) v = 'all';
    else {
      const marcados = [...box.querySelectorAll('[data-pag]:checked')]
        .map(c => c.dataset.pag).filter(x => x !== 'all').map(Number);
      v = marcados.length ? marcados : null;
    }
    _renderPaginaChecks(box, v, onChange);   // re-render: habilita/deshabilita según "Todas"
    onChange(v);
  }));
}

/* Llena la lista de "Ítems del navbar" del editor de módulo.
   Los módulos globales (nav / footer) aplican a TODO el sitio: queda fijo en
   "Todas las páginas". El resto puede marcar uno o varios ítems. */
function _renderPaginaSelect(selected) {
  const box  = document.getElementById('modulos-variant-pagina');
  const hint = document.getElementById('modulos-variant-pagina-hint');
  if (!box) return;

  if (GLOBAL_TIPOS_MOD.has(_curModType)) {
    box.innerHTML = '<label class="mod-pag-check is-disabled"><input type="checkbox" checked disabled/> 🌐 Todas las páginas (global)</label>';
    _curModData.id_pagina = 'all';
    if (hint) hint.textContent = 'Módulo global: se muestra en todas las páginas del sitio. No se asigna a una página específica.';
    _refreshPaginaBadges();
    return;
  }

  _renderPaginaChecks(box, selected, v => {
    _curModData.id_pagina = v;
    _refreshPaginaBadges();
  });
  if (hint) hint.textContent = 'Marcá a qué ítem(s) del navbar pertenece esta variante: aparecerá en el buscador de inserción de esas plantillas. Marcá «Todas las páginas» para que aparezca en todas. Si no marcás nada, NO aparece en ningún buscador.';
}

function _showView(id) {
  // El editor de módulo es ahora un modal (modulos-editor-view = .modal-overlay),
  // se abre/cierra con openModal/closeModal, no con este toggle de vistas.
  ['modulos-catalog-view','modulos-variants-view'].forEach(v => {
    const el = document.getElementById(v);
    if (el) el.style.display = v === id ? '' : 'none';
  });
}

/* Cerrar el modal del editor de módulo y volver al catálogo */
function _closeModEditor() {
  closePreviewModal();
  window.__svc?.closeModal('modulos-editor-view');
  renderModCatalog();
}

window.loadModulos = async function() {
  try {
    const [mres, pres, nres] = await Promise.all([
      window.__svc.apiGet('/modulos'),
      window.__svc.apiGet('/plantillas').catch(() => ({ plantillas: [] })),
      window.__svc.apiGet('/data/navbar').catch(() => ({ botones: [] })),
    ]);
    _mods = Array.isArray(mres.modulos) ? mres.modulos : [];
    _plantillas = Array.isArray(pres.plantillas) ? pres.plantillas : [];
    _navbar = Array.isArray(nres.botones) ? nres.botones : [];
    _modUsos = {};
    _plantillas.forEach(p => (p.id_modulos || []).forEach(id => { _modUsos[id] = (_modUsos[id] || 0) + 1; }));
    renderModCatalog();
  } catch(e) {
    window.__svc.showNotif('Error cargando módulos: ' + e.message, 'error');
  }
};

/* ¿El módulo coincide con la búsqueda? Busca en nombre, tipo, label, #id y página. */
function _modMatches(m, q) {
  if (!q) return true;
  const label = SECTIONS[m.tipo]?.label || m.tipo;
  const pag   = GLOBAL_TIPOS_MOD.has(m.tipo) || m.id_pagina === 'all'
    ? 'todas las páginas' : _paginaLabel(m.id_pagina);
  return `${m.nombre || ''} ${label} ${m.tipo} #${m.id_modulo} ${pag}`
    .toLowerCase().includes(q);
}

/* Vista 1: catálogo — UNA fila por sección (formato lista, como el blog)
   Regla "un módulo por sección": de cada tipo se muestra un solo módulo (el
   principal). Si un tipo tiene varios, se prefiere uno que esté EN USO y, entre
   esos, el de menor id. Los demás NO se borran: siguen existiendo y funcionando
   en sus plantillas, simplemente no aparecen en el catálogo. */
function _principalDeTipo(mods) {
  const enUso = mods.filter(m => (_modUsos[m.id_modulo] || 0) > 0);
  const pool  = enUso.length ? enUso : mods;
  return pool.slice().sort((a, b) => a.id_modulo - b.id_modulo)[0];
}

/* Texto de "descripción" de la fila: primer campo de texto significativo del módulo. */
const _PREVIEW_FIELDS = ['titulo_seccion', 'titulo', 'titulo1', 'lead', 'descripcion', 'badge', 'eyebrow', 'formTitulo', 'loadingMessage'];
function _modPreview(m) {
  const d = m.data || {};
  for (const f of _PREVIEW_FIELDS) {
    const v = d[f];
    if (typeof v === 'string' && v.trim()) return v.replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  return '';
}

/* FAMILIAS de módulos: agrupan varios `tipo` de sección bajo UNA fila del
   catálogo ("tipo de módulo"). En el catálogo se ve una sola fila por familia
   (ej: "Hero" en vez de los 7 tipos de hero); "Lista" abre TODAS las variantes
   de esos tipos. Los tipos que NO figuran acá son su propia familia (una fila
   por tipo, como antes — ej: "Cards", "Nosotros", "Navbar"). */
const MOD_FAMILIES = [
  { id: '__hero',   label: 'Hero',   tipos: ['hero', 'hero-centered', 'cableado-hero', 'fibra-hero', 'seguridad-hero', 'soporte-hero', 'desarrollo-hero'] },
  { id: '__footer', label: 'Footer', tipos: ['footer', 'footer-full'] },
  { id: '__header', label: 'Header', tipos: ['articulo-header', 'cliente-header'] },
];
const _famByTipo = {};
MOD_FAMILIES.forEach(f => f.tipos.forEach(t => { _famByTipo[t] = f; }));
const _familyOf   = tipo => _famByTipo[tipo] || null;
const _familyById = id   => MOD_FAMILIES.find(f => f.id === id) || null;

function renderModCatalog() {
  _showView('modulos-catalog-view');
  const grid = document.getElementById('modulos-grid');
  if (!grid) return;

  // Recalcular el uso (en cuántas PLANTILLAS distintas se usa cada módulo) desde
  // las plantillas actuales en CADA render, para que "En uso / Sin usar" y el resto
  // de la descripción reflejen altas/bajas/uso sin tener que recargar el panel.
  // Se cuenta por plantilla distinta (un módulo repetido en la misma plantilla
  // cuenta 1, no infla el total).
  _modUsos = {};
  (_plantillas || []).forEach(p => {
    new Set((p.id_modulos || []).filter(x => typeof x === 'number')).forEach(id => {
      _modUsos[id] = (_modUsos[id] || 0) + 1;
    });
  });

  // El catálogo lista TIPOS de módulo: una fila por familia (Hero/Footer/Header)
  // o, para los demás, una fila por tipo de sección. Las copias sueltas de una
  // card (soloCard, insertadas en plantillas) no son módulos de catálogo: se
  // omiten de esta vista de gestión.
  const visibles = _mods.filter(m => !m.data?.soloCard);

  // Agrupar por clave: familia.id si el tipo pertenece a una familia, si no el
  // propio tipo. Solo se muestran los tipos/familias que TIENEN al menos un
  // módulo (no se listan familias vacías: no sirven de nada hasta crear uno; se
  // crean desde el botón "Nuevo" del catálogo).
  const groups = new Map();   // key → { key, fam, label, tipos:Set, variants:[] }
  const ensureGroup = (key, fam, label) => {
    if (!groups.has(key)) groups.set(key, { key, fam, label, tipos: new Set(), variants: [] });
    return groups.get(key);
  };
  visibles.forEach(m => {
    const fam = _familyOf(m.tipo);
    const g   = ensureGroup(fam ? fam.id : m.tipo, fam, fam ? fam.label : (SECTIONS[m.tipo]?.label || m.tipo));
    g.tipos.add(m.tipo);
    g.variants.push(m);
  });

  let list = [...groups.values()];
  // Orden estable: por el menor id_modulo de sus variantes.
  list.forEach(g => { g.minId = Math.min(...g.variants.map(v => v.id_modulo)); });
  list.sort((a, b) => a.minId - b.minId);

  if (!list.length) {
    grid.innerHTML = `<div class="mod-cat-empty">No hay módulos todavía. Tocá <b>Nuevo</b> para crear el primero.</div>`;
    return;
  }

  // Buscador: coincide si el rótulo del tipo o alguna de sus variantes coincide.
  const q = _modQuery.trim().toLowerCase();
  if (q) list = list.filter(g => g.label.toLowerCase().includes(q) || g.variants.some(m => _modMatches(m, q)));
  if (!list.length) {
    grid.innerHTML = `<div class="mod-cat-empty">Ningún módulo coincide con “${escAttr(_modQuery.trim())}”.</div>`;
    return;
  }

  const rows = list.map(g => {
    const tiposArr = g.fam ? g.fam.tipos : [...g.tipos];
    const esGlobal = tiposArr.some(t => GLOBAL_TIPOS_MOD.has(t));
    const totalUsos = g.variants.reduce((s, m) => s + (_modUsos[m.id_modulo] || 0), 0);
    const enUso    = totalUsos > 0 || esGlobal;
    const nVar     = g.variants.length;
    const badge    = enUso
      ? `<span class="mod-row-badge on">En uso</span>`
      : `<span class="mod-row-badge off">Sin usar</span>`;
    // Subtítulo: cantidad de variantes + uso. SIN "pertenece" (ahora se ve dentro
    // de "Lista", por variante — no en la fila del catálogo).
    const variantesTxt = `${nVar} ${nVar === 1 ? 'módulo' : 'módulos'}`;
    const usoTxt = esGlobal ? 'Global · todo el sitio'
                 : enUso    ? `En uso en ${totalUsos} plantilla${totalUsos !== 1 ? 's' : ''}`
                            : 'Sin usar todavía';
    // "Lista": familia → openModVerFamilia(id); tipo suelto → openModVer(principal).
    // "Eliminar" en todas las filas (borra el módulo principal del tipo/familia,
    // con confirmación que nombra cuál; si está en uso, eliminarModulo lo impide).
    const principal = _principalDeTipo(g.variants);
    const listaAttr = g.fam ? `data-fam="${escAttr(g.fam.id)}"` : `data-mod="${principal.id_modulo}"`;
    return `<div class="blog-item">
      <div class="blog-info">
        <div class="mod-row-headline">
          <span class="blog-title-text">${escAttr(g.label)}</span>
          ${badge}
        </div>
        <div class="blog-meta">${escAttr(variantesTxt)} · ${escAttr(usoTxt)}</div>
      </div>
      <div class="blog-actions">
        <button type="button" class="btn-edit-small" data-mod-lista ${listaAttr}>Lista</button>
        <button type="button" class="btn-edit-small" style="color:var(--red-400);border-color:var(--red-400);" data-mod-del="${principal.id_modulo}">Eliminar</button>
      </div>
    </div>`;
  }).join('');

  grid.innerHTML = `<div class="blog-grid">${rows}</div>`;
  grid.querySelectorAll('[data-mod-lista]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.fam) openModVerFamilia(b.dataset.fam);
    else window.openModVer(Number(b.dataset.mod));
  }));
  grid.querySelectorAll('[data-mod-del]').forEach(b => b.addEventListener('click', () => window.eliminarModulo(b.dataset.modDel)));
}

/* Tipos de sección que todavía NO tienen módulo (para el botón "Nuevo") */
function _tiposSinModulo() {
  const existentes = new Set(_mods.map(m => m.tipo));
  return Object.keys(SECTIONS).filter(t => !existentes.has(t));
}

/* Llena la lista de checkboxes de "Páginas asignadas" del modal de nuevo módulo. */
function _fillNuevoPaginaSelect() {
  const box = document.getElementById('nm-pagina');
  if (!box) return;
  _renderPaginaChecks(box, null, () => {});
}

/* Lee las páginas marcadas en el modal de nuevo módulo: null | 'all' | [ids]. */
function _nmPaginaValue() {
  const box = document.getElementById('nm-pagina');
  if (!box) return null;
  if (box.querySelector('[data-pag="all"]')?.checked) return 'all';
  const ids = [...box.querySelectorAll('[data-pag]:checked')]
    .map(c => c.dataset.pag).filter(x => x !== 'all').map(Number);
  return ids.length ? ids : null;
}

/* Abrir el modal "Nuevo módulo": Sección + Nombre + Página asignada */
window.openNuevoModulo = function() {
  const disponibles = _tiposSinModulo();
  const sel    = document.getElementById('nm-tipo');
  const nombre = document.getElementById('nm-nombre');
  const pagSel = document.getElementById('nm-pagina');
  const crear  = document.getElementById('nm-crear-btn');
  if (!sel) return;

  _fillNuevoPaginaSelect();

  if (!disponibles.length) {
    sel.innerHTML = `<option value="">— No quedan secciones —</option>`;
    sel.disabled = true;
    if (nombre) { nombre.value = ''; nombre.disabled = true; }
    if (pagSel) pagSel.innerHTML = '';
    if (crear)  crear.disabled = true;
    return void window.__svc?.openModal('modal-nuevo-modulo');
  }

  sel.disabled = false;
  sel.innerHTML = disponibles
    .map(t => `<option value="${escAttr(t)}">${escAttr(SECTIONS[t]?.label || t)}</option>`)
    .join('');
  if (nombre) nombre.disabled = false;
  if (crear)  crear.disabled = false;

  // Al cambiar de sección: sugerir nombre y, si es un tipo global, fijar la página.
  const syncForTipo = () => {
    if (nombre) nombre.value = SECTIONS[sel.value]?.label || sel.value;
    if (pagSel) {
      if (GLOBAL_TIPOS_MOD.has(sel.value)) {
        pagSel.innerHTML = '<label class="mod-pag-check is-disabled"><input type="checkbox" data-pag="all" checked disabled/> 🌐 Todas las páginas (global)</label>';
      } else {
        _fillNuevoPaginaSelect();
      }
    }
  };
  sel.onchange = syncForTipo;
  syncForTipo();

  window.__svc?.openModal('modal-nuevo-modulo');
};

/* Crear el módulo elegido en el modal (con su página) y abrir su editor */
async function crearModuloDesdeModal() {
  const sel    = document.getElementById('nm-tipo');
  const nombre = document.getElementById('nm-nombre');
  const tipo   = sel?.value;
  const sec    = tipo && SECTIONS[tipo];
  if (!sec) return;
  const id_pagina = _nmPaginaValue();
  try {
    const res = await window.__svc.apiPost('/modulos', {
      tipo,
      nombre: (nombre?.value || '').trim() || sec.label,
      id_pagina,
      data:   JSON.parse(JSON.stringify(sec.defaultData   || {})),
      design: JSON.parse(JSON.stringify(sec.defaultDesign || {})),
    });
    _mods.push(res.modulo);
    renderModCatalog();   // refleja el alta en el catálogo al instante
    window.__svc?.closeModal('modal-nuevo-modulo');
    window.__svc.showNotif('Módulo creado', 'success');
    openModEditor(res.modulo.id_modulo);
  } catch (e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
  }
}

/* Carga un módulo del catálogo en los globales de edición (_curMod*). */
function _setCurMod(m) {
  const sec = SECTIONS[m.tipo] || {};
  _curModId   = m.id_modulo;
  _curModType = m.tipo;
  _curModData = {
    nombre: m.nombre || '',
    alerta: m.alerta === true,
    id_pagina: m.id_pagina ?? null,
    data:   { ...(sec.defaultData   || {}), ...(m.data   || {}) },
    design: { ...(sec.defaultDesign || {}), ...(m.design || {}) },
  };
}

/* Vista 2: editor de un módulo del catálogo.
   Ya no abre el cuestionario de campos: lleva directo al PREVIEW visual
   (mod-preview-modal), donde el contenido se edita con los lápices y los
   colores + ítems del navbar viven en el panel lateral. */
window.openModEditor = function(id) {
  const m = _mods.find(x => x.id_modulo === Number(id));
  if (!m) return;
  const sec = SECTIONS[m.tipo];
  if (!sec) { window.__svc.showNotif('Tipo de módulo desconocido: ' + m.tipo, 'error'); return; }
  _setCurMod(m);
  _previewFromCards = false;
  openPreviewModal();
};

/* Gestión de contenido global embebida (blog posts / clientes)
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
  // "Listado de artículos" (página Blog): gestiona los MISMOS artículos (blog.json)
  // que el módulo Blog. Sus campos propios son solo mensajes de estado, por eso
  // mostramos la lista de artículos en vez de esos campos.
  'blog-list': {
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

// Módulos cuyos campos sueltos son técnicos/secundarios: se ocultan en el editor
// y la gestión real va por la lista de contenido (ej: blog-list → solo mensajes
// de estado, se editan los artículos en la lista).
const MOD_HIDE_DATA_CARD = new Set(['blog-list']);

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

/* Modal "Ver módulo": SOLO la lista de contenido
   Desde el catálogo se entra con "Ver". Muestra únicamente la lista del módulo
   (artículos para blog, clientes para clientes, y para el resto la lista de
   módulos de esa sección). Recién al tocar "Editar" en la lista se abre el
   modal de edición correspondiente. */
function _closeModVer() {
  window.__svc?.closeModal('modulos-view-modal');
  const body = document.getElementById('modulos-view-body');
  if (body) body.innerHTML = '';
  _curVerFamilia = null;
}

/* Lápiz del modal Ver: renombra el módulo desde el encabezado (input inline). */
function _renameModuloInline(m) {
  const titleEl = document.getElementById('modulos-view-title');
  const penBtn  = document.getElementById('modulos-view-rename');
  if (!titleEl || titleEl.style.display === 'none') return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'mod-rename-input';
  input.value = m.nombre || '';
  titleEl.style.display = 'none';
  if (penBtn) penBtn.style.display = 'none';
  titleEl.insertAdjacentElement('afterend', input);
  input.focus();
  input.select();

  let cerrado = false;
  const restaurar = () => {
    if (cerrado) return;
    cerrado = true;
    input.remove();
    titleEl.style.display = '';
    if (penBtn) penBtn.style.display = '';
  };
  const guardar = async () => {
    const nuevo = input.value.trim();
    restaurar();
    if (!nuevo || nuevo === m.nombre) return;
    try {
      await window.__svc.apiPut(`/modulos/${m.id_modulo}`, { nombre: nuevo });
      m.nombre = nuevo;
      window.__svc.showNotif('Módulo renombrado', 'success');
      if (!MOD_CONTENT_CONFIG[m.tipo]) _renderModVerLista(m.tipo);
      renderModCatalog();
    } catch (e) {
      window.__svc.showNotif('Error: ' + e.message, 'error');
    }
  };
  input.addEventListener('blur', guardar);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = m.nombre || ''; restaurar(); }
  });
}

window.openModVer = function(id) {
  const m = _mods.find(x => x.id_modulo === Number(id));
  if (!m) return;
  const sec = SECTIONS[m.tipo];
  if (!sec) { window.__svc.showNotif('Tipo de módulo desconocido: ' + m.tipo, 'error'); return; }
  _curVerFamilia = null;   // viendo un tipo suelto, no una familia

  const cfg     = MOD_CONTENT_CONFIG[m.tipo];
  const titleEl = document.getElementById('modulos-view-title');
  const pagEl   = document.getElementById('modulos-view-pagina');
  const noteEl  = document.getElementById('modulos-view-note');
  const addBtn  = document.getElementById('modulos-view-add-btn');
  const body    = document.getElementById('modulos-view-body');
  if (!body) return;

  const esTodas = GLOBAL_TIPOS_MOD.has(m.tipo) || m.id_pagina === 'all';
  // La asignación de página NO se muestra a nivel TIPO de módulo: solo vive en cada
  // variante (en su fila de la lista y en su editor). Acá limpiamos el badge del
  // encabezado para no sugerir que el tipo entero está asignado a una plantilla.
  if (pagEl) pagEl.innerHTML = '';

  const renameBtn = document.getElementById('modulos-view-rename');
  if (renameBtn) { renameBtn.style.display = ''; renameBtn.onclick = () => _renameModuloInline(m); }

  // El contenido compartido (#blog-list / #clientes-tbody) debe existir en UN
  // solo lugar: limpiamos el del editor para que render() apunte a este modal.
  const editorContent = document.getElementById('modulos-content-body');
  if (editorContent) editorContent.innerHTML = '';

  // Botón "Editar módulo": solo para módulos de contenido compartido (blog /
  // blog-list / clientes). Abre el Preview, donde está la pestaña "Ítems del
  // navbar" (igual que el resto de los tipos). El resto se edita por variante.
  const editBtn = document.getElementById('modulos-view-edit-btn');
  if (editBtn) editBtn.style.display = 'none';

  if (cfg) {
    if (titleEl) titleEl.textContent = cfg.title;
    if (noteEl) {
      noteEl.style.display = '';
      noteEl.textContent = 'Este contenido es compartido: los cambios se aplican automáticamente a todas las variantes de este módulo.';
    }
    if (addBtn) { addBtn.style.display = ''; addBtn.innerHTML = cfg.addLabel; addBtn.onclick = cfg.add; }
    if (editBtn) { editBtn.style.display = ''; editBtn.onclick = () => { _closeModVer(); window.openModEditor(m.id_modulo); }; }
    body.innerHTML = cfg.bodyHTML;
    cfg.render();
  } else if (m.tipo === 'services') {
    // CARDS: "1 tarjeta = 1 módulo". "Ver" lista cada tarjeta (de todos los
    // módulos de servicios) como una fila; "Editar" abre el editor de UNA
    // tarjeta y "Nuevo" crea un módulo de una sola tarjeta.
    if (titleEl) titleEl.textContent = sec.label;
    if (noteEl) {
      noteEl.style.display = '';
      noteEl.textContent = 'Tus tarjetas. Tocá “Editar” para modificar una (ícono, texto y a dónde se dirige), o “Nuevo” para agregar otra.';
    }
    if (addBtn) {
      addBtn.style.display = '';
      addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Nuevo';
      addBtn.onclick = () => _openNuevaCardFlujo();
    }
    _renderCardsFlatList();
  } else {
    if (titleEl) titleEl.textContent = sec.label;
    if (noteEl) noteEl.style.display = 'none';
    if (addBtn) {
      addBtn.style.display = '';
      addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Nuevo';
      addBtn.onclick = () => nuevaVarianteDeModulo(m.tipo, esTodas ? 'all' : m.id_pagina);
    }
    _renderModVerLista(m.tipo);
  }
  window.__svc?.openModal('modulos-view-modal');
};

/* CARDS — lista plana de todas las tarjetas de todos los módulos de servicios.
   Cada fila es UNA tarjeta (modelo "1 tarjeta = 1 módulo"). */
function _allServiceCards() {
  const out = [];
  _mods.filter(x => x.tipo === 'services')
       .sort((a, b) => a.id_modulo - b.id_modulo)
       .forEach(m => {
         const cards = Array.isArray(m.data?.cards) ? m.data.cards : [];
         cards.forEach((card, i) => out.push({ m, i, card }));
       });
  return out;
}

function _renderCardsFlatList() {
  const body = document.getElementById('modulos-view-body');
  if (!body) return;
  const all = _allServiceCards();
  if (!all.length) {
    body.innerHTML = `<div class="mod-cat-empty">No hay tarjetas todavía. Tocá <b>Nuevo</b> para crear la primera.</div>`;
    return;
  }
  body.innerHTML = `<div class="blog-grid">${all.map(({ m, i, card }) => {
    const icon  = serviceCardIcon(card);
    const color = card.iconoColor || '#2563eb';
    const desc  = (card.descripcion || '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Sin descripción.';
    const item  = _cardPaginaLabel(card);
    const badge = item
      ? `<span class="mod-pertenece" title="Ítem del navbar al que pertenece esta tarjeta"><i class="fa-solid fa-diagram-project"></i> ${escAttr(item)}</span>`
      : `<span class="mod-pertenece is-none" title="Sin ítem asignado"><i class="fa-solid fa-circle-question"></i> Sin asignar</span>`;
    return `<div class="blog-item">
      <div class="blog-info">
        <div class="mod-row-headline">
          <span class="card-row-ico"><i class="fa-solid ${escAttr(icon)}" style="color:${escAttr(color)}"></i></span>
          <span class="blog-title-text">${escAttr(card.titulo || '(sin título)')}</span>
          ${badge}
        </div>
        <div class="blog-excerpt">${escAttr(desc)}</div>
      </div>
      <div class="blog-actions">
        <button type="button" class="btn-edit-small" data-cf-edit="${m.id_modulo}:${i}">Editar</button>
        <button type="button" class="btn-edit-small" style="color:var(--red-400);border-color:var(--red-400);" data-cf-del="${m.id_modulo}:${i}">Eliminar</button>
      </div>
    </div>`;
  }).join('')}</div>`;

  body.querySelectorAll('[data-cf-edit]').forEach(b => b.addEventListener('click', () => {
    const [mid, i] = b.dataset.cfEdit.split(':');
    const m = _mods.find(x => x.id_modulo === Number(mid));
    if (m) openCardEditor(m, Number(i));
  }));
  body.querySelectorAll('[data-cf-del]').forEach(b => b.addEventListener('click', () => _deleteCardFlat(b.dataset.cfDel)));
}

/* Elimina una tarjeta de la lista plana. Si el módulo se queda sin tarjetas y no
   está en uso, se elimina el módulo entero. */
async function _deleteCardFlat(key) {
  const [mid, idx] = key.split(':');
  const m = _mods.find(x => x.id_modulo === Number(mid));
  if (!m) return;
  if (!confirm('¿Eliminar esta tarjeta?')) return;
  m.data = m.data || {};
  m.data.cards = Array.isArray(m.data.cards) ? m.data.cards : [];
  m.data.cards.splice(Number(idx), 1);
  try {
    if (!m.data.cards.length && (_modUsos[m.id_modulo] || 0) === 0) {
      await window.__svc.apiDelete(`/modulos/${m.id_modulo}`);
      _mods = _mods.filter(x => x.id_modulo !== m.id_modulo);
    } else {
      await window.__svc.apiPut(`/modulos/${m.id_modulo}`, { data: m.data });
    }
    _renderCardsFlatList();
    renderModCatalog();
    window.__svc.showNotif('Tarjeta eliminada', 'success');
  } catch (e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
  }
}

/* "Nuevo" en la lista de tarjetas: arma un BORRADOR de módulo de servicios con
   UNA sola tarjeta y abre el editor de tarjeta. Se persiste (POST) al Guardar.
   id_pagina (pertenece) arranca null: se define al elegir el destino del navbar. */
function _openNuevaCardFlujo() {
  const sec = SECTIONS['services'];
  if (!sec) return;
  const card = {
    id: 'card-' + Date.now(),
    icono: 'fa-server', iconoColor: '',
    titulo: 'Nueva tarjeta', descripcion: '',
    linkText: 'Ver Detalles', enlace: '',
    detalle: { titulo: '', descripcion: '', imagen: '' },
  };
  const draft = {
    _isNew: true,
    id_modulo: null,
    tipo: 'services',
    nombre: 'Nueva tarjeta',
    id_pagina: null,
    data:   { ...JSON.parse(JSON.stringify(sec.defaultData || {})), cards: [card] },
    design: JSON.parse(JSON.stringify(sec.defaultDesign || {})),
  };
  openCardEditor(draft, 0);
}

/* Lista genérica (mismo formato que la del blog): los módulos de esa sección.
   "Editar" cierra este modal y abre el editor del módulo (el otro modal). */
function _renderModVerLista(tipo) {
  const body = document.getElementById('modulos-view-body');
  if (!body) return;
  const mods = _mods.filter(x => x.tipo === tipo && !x.data?.soloCard).sort((a, b) => a.id_modulo - b.id_modulo);
  if (!mods.length) { _closeModVer(); return; }
  body.innerHTML = `<div class="blog-grid">${mods.map(m => {
    const usos  = _modUsos[m.id_modulo] || 0;
    const enUso = usos > 0 || GLOBAL_TIPOS_MOD.has(m.tipo);
    const badge = enUso
      ? '<span class="mod-row-badge on">En uso</span>'
      : '<span class="mod-row-badge off">Sin usar</span>';
    const desc  = _modPreview(m) || (enUso ? `En uso en ${usos} plantilla${usos !== 1 ? 's' : ''}.` : 'Todavía no se usa en ninguna plantilla.');
    const esTodas   = GLOBAL_TIPOS_MOD.has(m.tipo) || m.id_pagina === 'all';
    const pertenece = _paginaBadgeHTML(esTodas ? 'all' : m.id_pagina);
    return `<div class="blog-item">
      <div class="blog-info">
        <div class="mod-row-headline">
          <span class="blog-title-text">${escAttr(m.nombre || '(sin nombre)')}</span>
          ${badge}
        </div>
        <div class="blog-meta">${escAttr(SECTIONS[m.tipo]?.label || m.tipo)} · #${m.id_modulo}</div>
        <div class="blog-excerpt">${escAttr(desc)}</div>
      </div>
      <div class="mod-row-pertenece">${pertenece}</div>
      <div class="blog-actions">
        <button type="button" class="btn-edit-small" data-ver-edit="${m.id_modulo}">Editar</button>
        <button type="button" class="btn-edit-small" style="color:var(--red-400);border-color:var(--red-400);" data-ver-del="${m.id_modulo}">Eliminar</button>
      </div>
    </div>`;
  }).join('')}</div>`;
  body.querySelectorAll('[data-ver-edit]').forEach(b => b.addEventListener('click', () => {
    const mod = _mods.find(x => x.id_modulo === Number(b.dataset.verEdit));
    // Las "cards" (services) se editan tarjeta por tarjeta en el segundo modal,
    // sin cerrar la lista (se vuelve con "Volver"). El resto abre el editor normal.
    if (mod && mod.tipo === 'services') {
      window.openServiciosCards(b.dataset.verEdit);
    } else {
      _closeModVer();
      window.openModEditor(b.dataset.verEdit);
    }
  }));
  body.querySelectorAll('[data-ver-del]').forEach(b => b.addEventListener('click', async () => {
    await window.eliminarModulo(b.dataset.verDel);
    _renderModVerLista(tipo);   // refresca la lista (o cierra si no quedan)
  }));
}

/* ── FAMILIAS: "Lista" de una familia (Hero/Footer/Header) ────────────────────
   Usa el mismo modal "Ver" pero lista TODAS las variantes de todos los tipos de
   la familia. Cada fila muestra a qué ítem(s) pertenece (badge) y permite editar
   (incluye asignar el ítem) o eliminar. "Nuevo" elige el tipo puntual a crear. */
let _curVerFamilia = null;   // familia abierta en el modal "Ver" (null = tipo suelto)

window.openModVerFamilia = function(familyId) {
  const fam = _familyById(familyId);
  if (!fam) return;
  _curVerFamilia = fam;

  const titleEl   = document.getElementById('modulos-view-title');
  const pagEl     = document.getElementById('modulos-view-pagina');
  const noteEl    = document.getElementById('modulos-view-note');
  const addBtn    = document.getElementById('modulos-view-add-btn');
  const renameBtn = document.getElementById('modulos-view-rename');
  const body      = document.getElementById('modulos-view-body');
  if (!body) return;

  // Limpiamos el contenido compartido (#blog-list / #clientes-tbody) por si venía
  // de otra vista, para que no quede colgado en este modal.
  const editorContent = document.getElementById('modulos-content-body');
  if (editorContent) editorContent.innerHTML = '';

  const editBtn = document.getElementById('modulos-view-edit-btn');
  if (editBtn)   editBtn.style.display = 'none';        // las variantes se editan desde la lista
  if (titleEl)   titleEl.textContent = fam.label;
  if (pagEl)     pagEl.innerHTML = '';                  // una familia no tiene un único "pertenece"
  if (renameBtn) renameBtn.style.display = 'none';      // no se renombra una familia
  if (noteEl) {
    noteEl.style.display = '';
    noteEl.textContent = `Variantes de ${fam.label}. Tocá “Editar” para modificar una y asignarle su ítem del navbar, o “Nuevo” para agregar otra.`;
  }
  if (addBtn) {
    addBtn.style.display = '';
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Nuevo';
    addBtn.onclick = () => _nuevaVarianteFamilia(fam);
  }
  _renderModVerListaFamilia(fam);
  window.__svc?.openModal('modulos-view-modal');
};

/* Lista de variantes de una familia (todos sus tipos), con badge de pertenencia. */
function _renderModVerListaFamilia(fam) {
  const body = document.getElementById('modulos-view-body');
  if (!body) return;
  const mods = _mods
    .filter(m => fam.tipos.includes(m.tipo) && !m.data?.soloCard)
    .sort((a, b) => a.id_modulo - b.id_modulo);
  if (!mods.length) {
    body.innerHTML = `<div class="mod-cat-empty">No hay variantes de ${escAttr(fam.label)} todavía. Tocá <b>Nuevo</b> para crear la primera.</div>`;
    return;
  }
  body.innerHTML = `<div class="blog-grid">${mods.map(m => {
    const usos    = _modUsos[m.id_modulo] || 0;
    const enUso   = usos > 0 || GLOBAL_TIPOS_MOD.has(m.tipo);
    const badge   = enUso
      ? '<span class="mod-row-badge on">En uso</span>'
      : '<span class="mod-row-badge off">Sin usar</span>';
    const esTodas = GLOBAL_TIPOS_MOD.has(m.tipo) || m.id_pagina === 'all';
    const pertenece = _paginaBadgeHTML(esTodas ? 'all' : m.id_pagina);
    const desc    = _modPreview(m) || (enUso ? `En uso en ${usos} plantilla${usos !== 1 ? 's' : ''}.` : 'Todavía no se usa en ninguna plantilla.');
    return `<div class="blog-item">
      <div class="blog-info">
        <div class="mod-row-headline">
          <span class="blog-title-text">${escAttr(m.nombre || '(sin nombre)')}</span>
          ${badge}
        </div>
        <div class="blog-meta">${escAttr(SECTIONS[m.tipo]?.label || m.tipo)} · #${m.id_modulo}</div>
        <div class="blog-excerpt">${escAttr(desc)}</div>
      </div>
      <div class="mod-row-pertenece">${pertenece}</div>
      <div class="blog-actions">
        <button type="button" class="btn-edit-small" data-fam-edit="${m.id_modulo}">Editar</button>
        <button type="button" class="btn-edit-small" style="color:var(--red-400);border-color:var(--red-400);" data-fam-del="${m.id_modulo}">Eliminar</button>
      </div>
    </div>`;
  }).join('')}</div>`;
  body.querySelectorAll('[data-fam-edit]').forEach(b => b.addEventListener('click', () => {
    _closeModVer();
    window.openModEditor(b.dataset.famEdit);
  }));
  body.querySelectorAll('[data-fam-del]').forEach(b => b.addEventListener('click', async () => {
    await window.eliminarModulo(b.dataset.famDel);
    if (_curVerFamilia) _renderModVerListaFamilia(_curVerFamilia);   // refresca (o muestra vacío)
  }));
}

/* "Nuevo" en una familia: si tiene un solo tipo, lo crea directo; si tiene varios
   (ej: Hero), abre un mini-selector del tipo puntual anclado al botón. */
function _nuevaVarianteFamilia(fam) {
  const tipos = fam.tipos.filter(t => SECTIONS[t]);
  if (tipos.length <= 1) { if (tipos[0]) nuevaVarianteDeModulo(tipos[0], null); return; }
  const addBtn = document.getElementById('modulos-view-add-btn');
  if (!addBtn) return;
  const html = `<div class="svc-pop-form" style="gap:.3rem;">
    <div class="svc-pop-label" style="margin-bottom:.25rem;">¿Qué tipo de ${escAttr(fam.label.toLowerCase())} querés crear?</div>
    ${tipos.map(t => `<button type="button" class="btn-edit-small" data-fam-newtipo="${escAttr(t)}" style="width:100%;text-align:left;">${escAttr(SECTIONS[t]?.label || t)}</button>`).join('')}
  </div>`;
  const pop = _floatPopover(addBtn, html, 280);
  pop.el.querySelectorAll('[data-fam-newtipo]').forEach(b => b.addEventListener('click', () => {
    pop.close();
    nuevaVarianteDeModulo(b.dataset.famNewtipo, null);
  }));
}

document.getElementById('modulos-view-close')?.addEventListener('click', _closeModVer);

/* ───────────────────────────────────────────────────────────────────────────
   MÓDULO "SERVICIOS" — editor de tarjetas dentro del modal "Ver".
   En vez de listar las variantes del módulo, listamos cada tarjeta del módulo
   con edición in-place: ícono + color (selector), título, descripción, texto y
   URL del enlace, y un detalle (título/descripción/imagen) que en el sitio
   público se abre como popup al tocar "Ver Detalles".
   Los cambios se guardan en este módulo (PUT /modulos/:id) con debounce.
   ─────────────────────────────────────────────────────────────────────────── */

const _svcSaveTimers = {};
function _saveServiciosModulo(m, immediate) {
  // Borrador sin persistir (flujo "Nuevo"): los cambios viven en memoria y se
  // guardan recién al tocar "Guardar cambios". No hay PUT hasta entonces.
  if (m._isNew) return;
  clearTimeout(_svcSaveTimers[m.id_modulo]);
  const doSave = async () => {
    try {
      // Persistimos también id_pagina: el destino de la tarjeta define a qué
      // ítem/página pertenece el módulo (para el filtro al insertar en plantillas).
      const res = await window.__svc.apiPut(`/modulos/${m.id_modulo}`, { data: m.data, id_pagina: m.id_pagina ?? null });
      const idx = _mods.findIndex(x => x.id_modulo === m.id_modulo);
      if (idx !== -1 && res?.modulo) _mods[idx] = res.modulo;
    } catch (e) {
      window.__svc.showNotif('Error al guardar: ' + e.message, 'error');
    }
  };
  if (immediate) return doSave();
  _svcSaveTimers[m.id_modulo] = setTimeout(doSave, 500);
}

function _hasDetalle(c) {
  const d = c && c.detalle;
  return !!(d && (d.titulo || d.descripcion || d.imagen));
}

function _servicioCardRowHTML(c, i) {
  const icon  = serviceCardIcon(c);
  const color = c.iconoColor || '#2563eb';
  const desc  = escAttr(c.descripcion || '').replace(/&quot;/g, '"');
  const enlace = c.enlace ? escAttr(c.enlace) : '';
  return `<div class="svc-card-row" data-svc-i="${i}">
    <div class="svc-card-top">
      <div class="svc-icon-wrap">
        <span class="svc-icon-preview"><i class="fa-solid ${escAttr(icon)}" style="color:${escAttr(color)}"></i></span>
        <button type="button" class="svc-icon-pen" data-svc-icon title="Cambiar ícono y color"><i class="fa-solid fa-pen"></i></button>
      </div>
      <button type="button" class="svc-card-del" data-svc-del title="Quitar tarjeta"><i class="fa-solid fa-trash"></i></button>
    </div>
    <input class="svc-card-titulo" data-svc-f="titulo" value="${escAttr(c.titulo || '')}" placeholder="Título de la tarjeta"/>
    <textarea class="svc-card-desc" data-svc-f="descripcion" placeholder="Descripción de la tarjeta">${desc}</textarea>
    <div class="svc-link-row">
      <input class="svc-card-linktext" data-svc-f="linkText" value="${escAttr(c.linkText || 'Ver Detalles')}" placeholder="Texto del enlace"/>
      <button type="button" class="svc-link-pen" data-svc-arrow title="Editar la URL de destino (la flechita)"><i class="fa-solid fa-arrow-right"></i><i class="fa-solid fa-pen"></i></button>
      <button type="button" class="svc-link-pen${_hasDetalle(c) ? ' has-detalle' : ''}" data-svc-detalle title="Editar el detalle (título, descripción, imagen)"><i class="fa-solid fa-pen"></i></button>
    </div>
  </div>`;
}

/* ── NIVEL 2: lista de tarjetas (services/cards) ──────────────────────────────
   Se abre al tocar "Editar" en una variante del modal "Ver", encima de la lista
   de variantes (se vuelve con "Volver"). Muestra cada tarjeta como una fila;
   "Editar" abre el editor de UNA tarjeta (nivel 3) y "Nuevo" un modal chico. */
let _curCardsMod = null;     // módulo cuyas tarjetas se están listando (para "Nuevo")

function _closeModCards() {
  // Al volver, refrescamos la lista de variantes del modal "Ver" que quedó
  // abierto detrás: así se ven los módulos recién creados con "Nuevo".
  const tipo = _curCardsMod?.tipo;
  window.__svc?.closeModal('modulos-cards-modal');
  const body = document.getElementById('modulos-cards-body');
  if (body) body.innerHTML = '';
  _curCardsMod = null;
  const verModal = document.getElementById('modulos-view-modal');
  if (tipo && verModal?.classList.contains('open') && !MOD_CONTENT_CONFIG[tipo]) {
    _renderModVerLista(tipo);
  }
}

// Acepta un id (módulo existente del catálogo) o directamente un objeto módulo
// (borrador del flujo "Nuevo", todavía sin persistir → m._isNew).
window.openServiciosCards = function(idOrMod) {
  const m = (idOrMod && typeof idOrMod === 'object')
    ? idOrMod
    : _mods.find(x => x.id_modulo === Number(idOrMod));
  if (!m) return;
  const sec = SECTIONS[m.tipo];
  if (!sec) { window.__svc.showNotif('Tipo de módulo desconocido: ' + m.tipo, 'error'); return; }
  _curCardsMod = m;

  const titleEl = document.getElementById('modulos-cards-title');
  const pagEl   = document.getElementById('modulos-cards-pagina');
  const noteEl  = document.getElementById('modulos-cards-note');
  const addBtn  = document.getElementById('modulos-cards-add-btn');
  const footer  = document.getElementById('modulos-cards-footer');
  const esTodas = GLOBAL_TIPOS_MOD.has(m.tipo) || m.id_pagina === 'all';

  if (titleEl) titleEl.textContent = m._isNew ? `Nuevo — ${m.nombre || sec.label}` : (m.nombre || sec.label);
  if (pagEl)   pagEl.innerHTML = _paginaBadgeHTML(esTodas ? 'all' : m.id_pagina);
  if (noteEl)  noteEl.textContent = m._isNew
    ? 'Módulo nuevo (todavía sin guardar). Cargá las tarjetas y asigná los ítems del navbar, después tocá “Guardar cambios”.'
    : 'Las tarjetas de este módulo. Tocá “Editar” para modificar una, o “Nuevo” para agregar otra.';
  if (addBtn)  addBtn.onclick = () => _openNuevaCardModal(m);
  // El footer con "Guardar cambios" solo aparece al crear un módulo nuevo.
  if (footer)  footer.style.display = m._isNew ? '' : 'none';

  _renderCardsPaginaSelect(m);
  _renderCardsLista(m);
  window.__svc?.openModal('modulos-cards-modal');
};

/* Flujo "Nuevo": arma un BORRADOR de módulo de servicios en memoria (sin POST) y
   abre el editor de tarjetas. El módulo se crea recién al tocar "Guardar cambios"
   (_saveCardsDraft). Si se cierra/cancela antes, no se persiste nada. */
function _openNuevoServiciosModulo(tipo, id_pagina) {
  const sec = SECTIONS[tipo];
  if (!sec) return;
  const draft = {
    _isNew: true,
    id_modulo: null,
    tipo,
    nombre: sec.label,
    id_pagina: id_pagina === 'all' ? 'all'
      : (Array.isArray(id_pagina) ? [...id_pagina] : (id_pagina ?? null)),
    data:   JSON.parse(JSON.stringify(sec.defaultData   || {})),
    design: JSON.parse(JSON.stringify(sec.defaultDesign || {})),
  };
  draft.data.cards = Array.isArray(draft.data.cards) ? draft.data.cards : [];
  window.openServiciosCards(draft);
}

/* "Guardar cambios" del editor de tarjetas. Para un borrador (módulo nuevo) hace
   el POST que lo crea; para un módulo existente no hace falta (ya se autoguarda),
   simplemente cierra. */
async function _saveCardsDraft() {
  const m = _curCardsMod;
  if (!m) return;
  if (!m._isNew) { _closeModCards(); return; }
  const btn = document.getElementById('modulos-cards-save');
  if (btn) btn.disabled = true;
  try {
    const res = await window.__svc.apiPost('/modulos', {
      tipo:      m.tipo,
      nombre:    m.nombre,
      id_pagina: m.id_pagina ?? null,
      data:      m.data,
      design:    m.design,
    });
    _mods.push(res.modulo);
    _modUsos[res.modulo.id_modulo] = 0;
    _curCardsMod = res.modulo;   // el borrador pasa a ser un módulo real
    window.__svc.showNotif('Módulo creado', 'success');
    _closeModCards();            // refresca la lista "Ver" detrás
    renderModCatalog();
  } catch (e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.getElementById('modulos-cards-save')?.addEventListener('click', _saveCardsDraft);
document.getElementById('modulos-cards-cancel')?.addEventListener('click', _closeModCards);

/* Preview del módulo de servicios (mismo modal visual que los demás módulos).
   Apuntamos los globales _curMod* al módulo de tarjetas en edición (misma
   referencia de data/design → las ediciones del preview se reflejan en `m`). */
let _previewFromCards = false;
function openCardsPreview() {
  const m = _curCardsMod;
  if (!m) return;
  _curModId   = m.id_modulo;     // null si es un borrador
  _curModType = m.tipo;
  _curModData = m;               // misma ref: m.data === _curModData.data
  _previewFromCards = true;
  openPreviewModal();
}

/* Guardar desde el preview cuando se abrió desde el editor de tarjetas. Para un
   borrador no persiste (lo hace después "Guardar cambios"); para un módulo real
   hace el PUT completo (data + design + página). */
async function _saveCardsFromPreview() {
  const m = _curCardsMod;
  if (!m) return;
  if (m._isNew) {
    _renderCardsLista(m);
    window.__svc.showNotif('Cambios aplicados al borrador', 'success');
    return;
  }
  try {
    const res = await window.__svc.apiPut(`/modulos/${m.id_modulo}`, {
      nombre:    m.nombre,
      alerta:    m.alerta === true,
      id_pagina: m.id_pagina ?? null,
      data:      m.data,
      design:    m.design,
    });
    const idx = _mods.findIndex(x => x.id_modulo === m.id_modulo);
    if (idx !== -1) _mods[idx] = res.modulo;
    _renderCardsLista(m);
    window.__svc.showNotif('Módulo guardado', 'success');
  } catch (e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
  }
}

document.getElementById('modulos-cards-preview-btn')?.addEventListener('click', openCardsPreview);

/* Lista de "Ítems del navbar" dentro del editor de tarjetas: permite asignar a
   qué ítem(s) del navbar pertenece este módulo de servicios. Reusa la misma
   checklist que el editor de módulo y persiste el cambio (PUT /modulos/:id). */
function _renderCardsPaginaSelect(m) {
  const box  = document.getElementById('modulos-cards-pagina-select');
  const hint = document.getElementById('modulos-cards-pagina-hint');
  const pagEl = document.getElementById('modulos-cards-pagina');
  if (!box) return;

  if (GLOBAL_TIPOS_MOD.has(m.tipo)) {
    box.innerHTML = '<label class="mod-pag-check is-disabled"><input type="checkbox" checked disabled/> 🌐 Todas las páginas (global)</label>';
    if (hint) hint.textContent = 'Módulo global: se muestra en todas las páginas del sitio.';
    return;
  }

  _renderPaginaChecks(box, m.id_pagina, async (v) => {
    m.id_pagina = v;
    const esTodas = v === 'all';
    if (pagEl) pagEl.innerHTML = _paginaBadgeHTML(esTodas ? 'all' : v);
    // Borrador: solo se actualiza en memoria; se persiste al "Guardar cambios".
    if (m._isNew) return;
    try {
      const res = await window.__svc.apiPut(`/modulos/${m.id_modulo}`, { id_pagina: v });
      const idx = _mods.findIndex(x => x.id_modulo === m.id_modulo);
      if (idx !== -1) _mods[idx].id_pagina = res?.modulo?.id_pagina ?? v;
      renderModCatalog();
    } catch (e) {
      window.__svc.showNotif('Error al asignar ítem: ' + e.message, 'error');
    }
  });
  if (hint) hint.textContent = 'Marcá a qué ítem(s) del navbar pertenece este módulo (ej: «Fibra Óptica»), o «Todas las páginas».';
}

document.getElementById('modulos-cards-close')?.addEventListener('click', _closeModCards);
document.getElementById('modulos-cards-back')?.addEventListener('click', _closeModCards);

/* Lista de tarjetas en filas (mismo formato que las variantes). */
function _renderCardsLista(m) {
  const body = document.getElementById('modulos-cards-body');
  if (!body) return;
  m.data = m.data || {};
  const cards = Array.isArray(m.data.cards) ? m.data.cards : (m.data.cards = []);
  if (!cards.length) {
    body.innerHTML = `<div class="mod-cat-empty">Este módulo no tiene tarjetas todavía. Tocá <b>Nuevo</b> para crear la primera.</div>`;
    return;
  }
  body.innerHTML = `<div class="blog-grid">${cards.map((c, i) => {
    const icon  = serviceCardIcon(c);
    const color = c.iconoColor || '#2563eb';
    const desc  = (c.descripcion || '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Sin descripción.';
    return `<div class="blog-item">
      <div class="blog-info">
        <div class="mod-row-headline">
          <span class="card-row-ico"><i class="fa-solid ${escAttr(icon)}" style="color:${escAttr(color)}"></i></span>
          <span class="blog-title-text">${escAttr(c.titulo || '(sin título)')}</span>
        </div>
        <div class="blog-excerpt">${escAttr(desc)}</div>
      </div>
      <div class="blog-actions">
        <button type="button" class="btn-edit-small" data-card-edit="${i}">Editar</button>
        <button type="button" class="btn-edit-small" style="color:var(--red-400);border-color:var(--red-400);" data-card-del="${i}">Eliminar</button>
      </div>
    </div>`;
  }).join('')}</div>`;
  body.querySelectorAll('[data-card-edit]').forEach(b =>
    b.addEventListener('click', () => openCardEditor(m, Number(b.dataset.cardEdit))));
  body.querySelectorAll('[data-card-del]').forEach(b =>
    b.addEventListener('click', () => {
      if (!confirm('¿Eliminar esta tarjeta?')) return;
      m.data.cards.splice(Number(b.dataset.cardDel), 1);
      _saveServiciosModulo(m, true);
      _renderCardsLista(m);
      renderModCatalog();
    }));
}

/* ── NIVEL 3: editor de UNA tarjeta ───────────────────────────────────────────
   Reutiliza la fila visual completa (ícono, título, descripción, enlace, detalle)
   pero mostrando una sola tarjeta, con su propio botón "Guardar". */
let _curCardEdit = null;     // { m, i } de la tarjeta en edición

function openCardEditor(m, i) {
  const card = m.data?.cards?.[i];
  if (!card) return;
  _curCardEdit = { m, i };
  const titleEl = document.getElementById('modulos-card-edit-title');
  if (titleEl) titleEl.textContent = m._isNew ? `Nueva tarjeta` : (card.titulo || 'Tarjeta');
  const body = document.getElementById('modulos-card-edit-body');
  if (body) {
    body.innerHTML = `<div class="svc-cards-list">${_servicioCardRowHTML(card, i)}</div>`;
    _bindSingleCardRow(m, i);
  }
  _renderCardNavSelect(m, i);
  _renderCardPerteneceSelect(m, i);
  window.__svc?.openModal('modulos-card-edit-modal');
}

/* Ítems del navbar a los que puede apuntar una tarjeta: botones activos del
   navbar con un href navegable. */
function _navDestItems() {
  return (_navbar || [])
    .filter(b => b.activo !== false && b.href)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

/* Ítem del navbar (botón) cuyo href coincide con `href`. */
function _navItemByHref(href) {
  return href ? (_navbar || []).find(b => b.href === href) : null;
}

/* id_pagina (pertenece) que corresponde a un href del navbar: la plantilla cuyo
   id_menu incluye al ítem de ese href. Devuelve [id_plantilla] o null si el href
   no mapea a un ítem con plantilla (ej: URL personalizada o «Inicio» sin página). */
function _idPaginaForNavHref(href) {
  const item = _navItemByHref(href);
  if (!item) return null;
  const plt = (_plantillas || []).find(p => (p.id_menu || []).includes(item.id_menu));
  return plt ? [plt.id_plantilla] : null;
}

/* Etiqueta del ítem del navbar al que pertenece/apunta una tarjeta (para el
   badge de la lista). '' si no apunta a ningún ítem (sin enlace / URL libre). */
function _cardPerteneceLabel(card) {
  return _navItemByHref(card && card.enlace)?.titulo || '';
}

/* Etiqueta de "pertenece" de una tarjeta para la lista: usa la pertenencia
   explícita por tarjeta (card.id_pagina); si no está definida, cae al ítem
   derivado del destino (enlace) para no perder el rótulo de datos viejos. */
function _cardPaginaLabel(card) {
  const pags = _paginasDe(card && card.id_pagina);
  if (pags === 'all') return 'Todas las páginas';
  if (pags.length) {
    return pags.map(id => _navInfoDePlantilla(id)).filter(n => n.item).map(n => n.titulo).join(', ');
  }
  return _cardPerteneceLabel(card);   // fallback: derivar del destino
}

/* Selector "¿A dónde se dirige?": elige el ítem del navbar al que apunta el
   botón "Ver Detalles" de la tarjeta (card.enlace = href del ítem). Incluye la
   opción "Personalizado" para una URL libre y "Sin enlace". */
function _renderCardNavSelect(m, i) {
  const box = document.getElementById('modulos-card-edit-nav');
  if (!box) return;
  const card = m.data?.cards?.[i];
  if (!card) { box.innerHTML = ''; return; }
  const items = _navDestItems();
  const cur = card.enlace || '';
  const isCustom = !!cur && !items.some(b => b.href === cur);
  box.innerHTML = [
    `<label class="mod-pag-check"><input type="radio" name="cardnav" data-cn="" ${!cur ? 'checked' : ''}/> — Sin enlace —</label>`,
    ...items.map(b => {
      const padre = b.padre ? (_navbar.find(x => x.id_menu === b.padre)?.titulo || '') : '';
      return `<label class="mod-pag-check"><input type="radio" name="cardnav" data-cn="${escAttr(b.href)}" ${cur === b.href ? 'checked' : ''}/> ${escAttr(b.titulo)}${padre ? ` <span class="mod-pag-grupo">${escAttr(padre)}</span>` : ''}</label>`;
    }),
    `<label class="mod-pag-check"><input type="radio" name="cardnav" data-cn="__custom__" ${isCustom ? 'checked' : ''}/> Personalizado (URL)</label>`,
    `<input type="text" class="form-input" id="modulos-card-edit-customurl" placeholder="https://…" value="${isCustom ? escAttr(cur) : ''}" style="margin-top:.4rem;${isCustom ? '' : 'display:none;'}">`,
  ].join('');
  const custom = box.querySelector('#modulos-card-edit-customurl');
  // En módulos de UNA sola tarjeta (modelo "1 tarjeta = 1 módulo") el destino
  // define también la pertenencia del módulo (m.id_pagina = plantilla del ítem),
  // para que al armar esa plantilla la tarjeta aparezca al insertar un módulo. En
  // módulos MULTI-tarjeta la pertenencia es por tarjeta ("¿En qué página(s) se
  // muestra?", card.id_pagina) y el destino no la toca.
  const syncPertenenciaModulo = href => {
    if ((m.data?.cards?.length || 0) <= 1) m.id_pagina = _idPaginaForNavHref(href);
  };
  box.querySelectorAll('[data-cn]').forEach(r => r.addEventListener('change', () => {
    const v = r.dataset.cn;
    if (v === '__custom__') {
      if (custom) { custom.style.display = ''; custom.focus(); }
      card.enlace = (custom?.value || '').trim();
      syncPertenenciaModulo(card.enlace);   // URL libre → null
    } else {
      if (custom) custom.style.display = 'none';
      card.enlace = v;   // '' (sin enlace) o el href del ítem del navbar
      syncPertenenciaModulo(v);
    }
    _saveServiciosModulo(m);
  }));
  custom?.addEventListener('input', () => {
    card.enlace = custom.value.trim();
    syncPertenenciaModulo(card.enlace);
    _saveServiciosModulo(m);
  });
}

/* Selector "¿En qué página(s) se muestra?" de UNA tarjeta: a qué ítem(s) del
   navbar pertenece la tarjeta (card.id_pagina). Reusa la misma checklist que la
   pertenencia de módulo. Al renderizar una plantilla, solo se muestran las
   tarjetas que pertenecen a ese ítem (o las marcadas "Todas" / sin asignar). */
function _renderCardPerteneceSelect(m, i) {
  const box = document.getElementById('modulos-card-edit-pertenece');
  if (!box) return;
  const card = m.data?.cards?.[i];
  if (!card) { box.innerHTML = ''; return; }
  _renderPaginaChecks(box, card.id_pagina, v => {
    card.id_pagina = v;
    _saveServiciosModulo(m);
  });
}

function _bindSingleCardRow(m, i) {
  const body = document.getElementById('modulos-card-edit-body');
  if (!body) return;
  const card = m.data.cards[i];
  const row  = body.querySelector('.svc-card-row');
  if (!row || !card) return;
  row.querySelectorAll('[data-svc-f]').forEach(inp => {
    inp.addEventListener('input', () => {
      card[inp.dataset.svcF] = inp.value;
      _saveServiciosModulo(m);
      if (inp.dataset.svcF === 'titulo') {
        const t = document.getElementById('modulos-card-edit-title');
        if (t) t.textContent = inp.value || 'Tarjeta';
      }
    });
  });
  row.querySelector('[data-svc-icon]')?.addEventListener('click', e => _openIconPicker(e.currentTarget, m, i));
  row.querySelector('[data-svc-arrow]')?.addEventListener('click', e => _openEnlaceEditor(e.currentTarget, m, i));
  row.querySelector('[data-svc-detalle]')?.addEventListener('click', () => _openCardDetalle(m, i));
  row.querySelector('[data-svc-del]')?.addEventListener('click', async () => {
    if (!confirm('¿Eliminar esta tarjeta?')) return;
    // Borrador sin guardar: simplemente se descarta cerrando el editor.
    if (m._isNew) { _closeCardEditor(); return; }
    m.data.cards.splice(i, 1);
    try {
      if (!m.data.cards.length && (_modUsos[m.id_modulo] || 0) === 0) {
        await window.__svc.apiDelete(`/modulos/${m.id_modulo}`);
        _mods = _mods.filter(x => x.id_modulo !== m.id_modulo);
      } else {
        await window.__svc.apiPut(`/modulos/${m.id_modulo}`, { data: m.data });
      }
      window.__svc.showNotif('Tarjeta eliminada', 'success');
    } catch (e) { window.__svc.showNotif('Error: ' + e.message, 'error'); }
    _closeCardEditor();
    renderModCatalog();
  });
}

function _closeCardEditor() {
  window.__svc?.closeModal('modulos-card-edit-modal');
  const body = document.getElementById('modulos-card-edit-body');
  if (body) body.innerHTML = '';
  const nav = document.getElementById('modulos-card-edit-nav');
  if (nav) nav.innerHTML = '';
  _curCardEdit = null;
  // Si la lista de tarjetas (modal "Ver") quedó abierta detrás, la refrescamos.
  const verModal = document.getElementById('modulos-view-modal');
  if (verModal?.classList.contains('open')) _renderCardsFlatList();
}

async function _saveCardEditor() {
  if (!_curCardEdit) { _closeCardEditor(); return; }
  const { m } = _curCardEdit;
  if (m._isNew) {
    // Nueva tarjeta → crea un módulo de servicios con esta única tarjeta.
    const card = m.data.cards[0] || {};
    const nombre = (card.titulo || '').trim() || 'Cards';
    try {
      const res = await window.__svc.apiPost('/modulos', {
        tipo:      m.tipo,
        nombre,
        id_pagina: m.id_pagina ?? null,
        data:      m.data,
        design:    m.design,
      });
      _mods.push(res.modulo);
      _modUsos[res.modulo.id_modulo] = 0;
      window.__svc.showNotif('Tarjeta creada', 'success');
    } catch (e) {
      window.__svc.showNotif('Error: ' + e.message, 'error');
      return;
    }
  } else {
    // Para un módulo existente, el módulo ya se autoguarda en cada cambio; el
    // botón "Guardar" fuerza un guardado inmediato. Solo en módulos de UNA tarjeta
    // (modelo "1 tarjeta = 1 módulo") sincronizamos el nombre con el título de la
    // tarjeta; los módulos legacy con varias tarjetas conservan su nombre.
    const card = m.data.cards[_curCardEdit.i] || {};
    if (m.data.cards.length === 1 && card.titulo && card.titulo.trim() && m.nombre !== card.titulo.trim()) {
      m.nombre = card.titulo.trim();
      try { await window.__svc.apiPut(`/modulos/${m.id_modulo}`, { nombre: m.nombre }); } catch (_) {}
    }
    _saveServiciosModulo(m, true);
    window.__svc.showNotif('Tarjeta guardada', 'success');
  }
  _closeCardEditor();          // refresca la lista plana si el modal "Ver" está abierto
  renderModCatalog();
}

document.getElementById('modulos-card-edit-close')?.addEventListener('click', _closeCardEditor);
document.getElementById('modulos-card-edit-back')?.addEventListener('click', _closeCardEditor);
document.getElementById('modulos-card-edit-cancel')?.addEventListener('click', _closeCardEditor);
document.getElementById('modulos-card-edit-save')?.addEventListener('click', _saveCardEditor);

/* ── Modal chico: agregar una tarjeta a la lista ──────────────────────────── */
function _openNuevaCardModal(m) {
  _curCardsMod = m;
  const inp = document.getElementById('nc-titulo');
  if (inp) inp.value = '';
  window.__svc?.openModal('modulos-card-new-modal');
  setTimeout(() => inp?.focus(), 50);
}

function _crearNuevaCard() {
  const m = _curCardsMod;
  if (!m) return;
  const inp = document.getElementById('nc-titulo');
  const titulo = (inp?.value || '').trim() || 'Nueva tarjeta';
  m.data = m.data || {};
  m.data.cards = Array.isArray(m.data.cards) ? m.data.cards : [];
  m.data.cards.push({
    id: 'card-' + Date.now(),
    icono: 'fa-server', iconoColor: '',
    titulo, descripcion: '',
    linkText: 'Ver Detalles', enlace: '',
    detalle: { titulo: '', descripcion: '', imagen: '' },
  });
  _saveServiciosModulo(m, true);
  window.__svc?.closeModal('modulos-card-new-modal');
  _renderCardsLista(m);
  renderModCatalog();
  window.__svc?.showNotif('Tarjeta agregada', 'success');
}

document.getElementById('nc-crear-btn')?.addEventListener('click', _crearNuevaCard);
document.getElementById('nc-titulo')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); _crearNuevaCard(); }
});

function _refreshCardIconPreview(m, i) {
  const row = document.querySelector(`.svc-card-row[data-svc-i="${i}"]`);
  const card = m.data.cards[i];
  if (!row || !card) return;
  const ic = row.querySelector('.svc-icon-preview i');
  if (ic) { ic.className = `fa-solid ${serviceCardIcon(card)}`; ic.style.color = card.iconoColor || '#2563eb'; }
}

/* Popover flotante reutilizable, anclado a un botón. Vive sobre el body con
   z-index alto para no quedar recortado por el modal. */
function _floatPopover(anchor, innerHTML, width) {
  document.querySelectorAll('.svc-float-pop').forEach(p => p.remove());
  const el = document.createElement('div');
  el.className = 'svc-float-pop';
  if (width) el.style.width = width + 'px';
  el.innerHTML = innerHTML;
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const w = el.offsetWidth;
  let left = r.left + window.scrollX;
  if (left + w > window.scrollX + vw - 10) left = window.scrollX + vw - w - 10;
  el.style.left = Math.max(10, left) + 'px';
  el.style.top  = (r.bottom + window.scrollY + 6) + 'px';
  const close = () => { el.remove(); document.removeEventListener('mousedown', onDoc, true); };
  const onDoc = e => { if (!el.contains(e.target) && !anchor.contains(e.target)) close(); };
  setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
  return { el, close };
}

function _openIconPicker(anchor, m, i) {
  const card = m.data.cards[i];
  const cur = serviceCardIcon(card);
  const color = card.iconoColor || '#2563eb';
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#2563eb';
  const pop = _floatPopover(anchor, `
    <div class="svc-iconpick-head">
      <span>Color del ícono</span>
      <input type="color" data-ip-color value="${safeColor}"/>
    </div>
    <div class="svc-iconpick-grid">
      ${SERVICE_ICON_CATALOG.map(cls => `<button type="button" class="svc-iconpick-btn${cls === cur ? ' is-sel' : ''}" data-ip-icon="${cls}" title="${cls}"><i class="fa-solid ${cls}"></i></button>`).join('')}
    </div>`, 300);
  const colorInp = pop.el.querySelector('[data-ip-color]');
  colorInp.addEventListener('input', () => {
    card.iconoColor = colorInp.value;
    _refreshCardIconPreview(m, i);
    _saveServiciosModulo(m);
  });
  pop.el.querySelectorAll('[data-ip-icon]').forEach(b => b.addEventListener('click', () => {
    card.icono = b.dataset.ipIcon;
    pop.el.querySelectorAll('[data-ip-icon]').forEach(x => x.classList.remove('is-sel'));
    b.classList.add('is-sel');
    _refreshCardIconPreview(m, i);
    _saveServiciosModulo(m);
  }));
}

function _openEnlaceEditor(anchor, m, i) {
  const card = m.data.cards[i];
  const pop = _floatPopover(anchor, `
    <div class="svc-pop-form">
      <label class="svc-pop-label">URL de destino de “Ver Detalles”</label>
      <input class="svc-pop-input" data-en-url value="${escAttr(card.enlace || '')}" placeholder="https://…"/>
      <div class="svc-pop-note">Si la tarjeta tiene detalle cargado, esta URL se usa como botón dentro del popup.</div>
      <button type="button" class="svc-pop-ok" data-en-ok>Guardar</button>
    </div>`, 280);
  const inp = pop.el.querySelector('[data-en-url]');
  const commit = () => {
    card.enlace = inp.value.trim();
    const hint = anchor.closest('.svc-card-row')?.querySelector('[data-svc-hint]');
    if (hint) hint.innerHTML = card.enlace ? escAttr(card.enlace) : '<span class="svc-muted">sin enlace de destino</span>';
    _saveServiciosModulo(m);
    pop.close();
  };
  pop.el.querySelector('[data-en-ok]').addEventListener('click', commit);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
  inp.focus();
  inp.select();
}

/* Modal de detalle de tarjeta (título, descripción, imagen) → popup público.
   Genérico: recibe la card y un callback `onSave` (persistir + refrescar). Lo
   usan el modal "Ver" (guarda en el módulo) y el preview visual (actualiza
   _curModData + re-render del iframe). */
let _curDetalleTarget = null;
function _openCardDetalleFor(card, onSave) {
  if (!card) return;
  card.detalle = card.detalle || { titulo: '', descripcion: '', imagen: '' };
  _curDetalleTarget = { card, onSave };
  const t   = document.getElementById('card-detalle-titulo');
  const d   = document.getElementById('card-detalle-desc');
  const img = document.getElementById('card-detalle-img');
  const prv = document.getElementById('card-detalle-img-prev');
  if (t)   t.value   = card.detalle.titulo || '';
  if (d)   d.value   = card.detalle.descripcion || '';
  if (img) img.value = card.detalle.imagen || '';
  if (prv) { const v = card.detalle.imagen || ''; prv.src = v; prv.style.display = v ? '' : 'none'; }
  window.__svc?.openModal('modal-card-detalle');
}

function _openCardDetalle(m, i) {
  const card = m.data.cards[i];
  if (!card) return;
  _openCardDetalleFor(card, () => {
    _saveServiciosModulo(m, true);
    const pen = document.querySelector(`.svc-card-row[data-svc-i="${i}"] [data-svc-detalle]`);
    if (pen) pen.classList.toggle('has-detalle', _hasDetalle(card));
  });
}

document.getElementById('card-detalle-save')?.addEventListener('click', () => {
  if (!_curDetalleTarget) return;
  const { card, onSave } = _curDetalleTarget;
  if (!card) return;
  card.detalle = {
    titulo:      document.getElementById('card-detalle-titulo')?.value || '',
    descripcion: document.getElementById('card-detalle-desc')?.value || '',
    imagen:      document.getElementById('card-detalle-img')?.value || '',
  };
  if (typeof onSave === 'function') onSave();
  window.__svc?.closeModal('modal-card-detalle');
  window.__svc?.showNotif('Detalle guardado', 'success');
});

document.getElementById('card-detalle-img-btn')?.addEventListener('click', async () => {
  const inp = document.getElementById('card-detalle-img');
  const path = await window.__imgPicker?.open({ current: inp?.value || '' });
  if (path && inp) {
    inp.value = path;
    const prv = document.getElementById('card-detalle-img-prev');
    if (prv) { prv.src = path; prv.style.display = ''; }
  }
});

document.getElementById('card-detalle-img')?.addEventListener('input', e => {
  const prv = document.getElementById('card-detalle-img-prev');
  if (prv) { const v = e.target.value || ''; prv.src = v; prv.style.display = v ? '' : 'none'; }
});

/* Selector de íconos global (Promise) — usado por el preview visual.
   Devuelve { icono, color } al Aplicar, o null al cancelar. */
let _iconPickerResolve = null;
function _ensureIconPicker() {
  if (document.getElementById('iconpicker-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'iconpicker-overlay';
  ov.className = 'svc-picker-overlay';
  ov.innerHTML = `
    <div class="svc-picker-dialog">
      <div class="svc-picker-head">
        <span><i class="fa-solid fa-icons" style="color:#2563eb;margin-right:.4rem;"></i>Elegir ícono</span>
        <div class="svc-picker-color"><label>Color</label><input type="color" id="iconpicker-color" value="#2563eb"/></div>
        <button type="button" id="iconpicker-x" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="svc-iconpick-grid" id="iconpicker-grid" style="max-height:320px;padding:.25rem;"></div>
      <div class="svc-picker-foot">
        <button type="button" class="btn-secondary" id="iconpicker-cancel">Cancelar</button>
        <button type="button" class="btn-save" id="iconpicker-apply">Aplicar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const grid = ov.querySelector('#iconpicker-grid');
  grid.innerHTML = SERVICE_ICON_CATALOG.map(cls => `<button type="button" class="svc-iconpick-btn" data-ip-icon="${cls}" title="${cls}"><i class="fa-solid ${cls}"></i></button>`).join('');
  grid.addEventListener('click', e => {
    const b = e.target.closest('[data-ip-icon]');
    if (!b) return;
    grid.querySelectorAll('[data-ip-icon]').forEach(x => x.classList.remove('is-sel'));
    b.classList.add('is-sel');
  });
  const finish = val => { ov.classList.remove('open'); const r = _iconPickerResolve; _iconPickerResolve = null; if (r) r(val); };
  ov.querySelector('#iconpicker-apply').addEventListener('click', () => {
    const sel = grid.querySelector('[data-ip-icon].is-sel');
    finish({ icono: sel ? sel.dataset.ipIcon : null, color: ov.querySelector('#iconpicker-color').value });
  });
  ov.querySelector('#iconpicker-cancel').addEventListener('click', () => finish(null));
  ov.querySelector('#iconpicker-x').addEventListener('click', () => finish(null));
  ov.addEventListener('mousedown', e => { if (e.target === ov) finish(null); });
}
window.__iconPicker = {
  open({ current, color } = {}) {
    _ensureIconPicker();
    const ov = document.getElementById('iconpicker-overlay');
    const grid = ov.querySelector('#iconpicker-grid');
    grid.querySelectorAll('[data-ip-icon]').forEach(b => b.classList.toggle('is-sel', b.dataset.ipIcon === current));
    const c = ov.querySelector('#iconpicker-color');
    c.value = /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#2563eb';
    ov.classList.add('open');
    return new Promise(res => { _iconPickerResolve = res; });
  },
};

/* Mini-overlay de texto (Promise) — para editar la URL desde el preview. */
let _promptResolve = null;
function _promptOverlay({ label, value = '', placeholder = '' } = {}) {
  let ov = document.getElementById('svc-prompt-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'svc-prompt-overlay';
    ov.className = 'svc-picker-overlay';
    ov.innerHTML = `
      <div class="svc-prompt-dialog">
        <div class="svc-pop-label" id="svc-prompt-label" style="margin-bottom:.5rem;"></div>
        <input class="svc-pop-input" id="svc-prompt-input"/>
        <div class="svc-picker-foot" style="margin-top:.85rem;">
          <button type="button" class="btn-secondary" id="svc-prompt-cancel">Cancelar</button>
          <button type="button" class="btn-save" id="svc-prompt-ok">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const finish = v => { ov.classList.remove('open'); const r = _promptResolve; _promptResolve = null; if (r) r(v); };
    ov.querySelector('#svc-prompt-ok').addEventListener('click', () => finish(ov.querySelector('#svc-prompt-input').value));
    ov.querySelector('#svc-prompt-cancel').addEventListener('click', () => finish(null));
    ov.addEventListener('mousedown', e => { if (e.target === ov) finish(null); });
    ov.querySelector('#svc-prompt-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(ov.querySelector('#svc-prompt-input').value); }
      if (e.key === 'Escape') finish(null);
    });
  }
  ov.querySelector('#svc-prompt-label').textContent = label || '';
  const inp = ov.querySelector('#svc-prompt-input');
  inp.value = value; inp.placeholder = placeholder;
  ov.classList.add('open');
  setTimeout(() => { inp.focus(); inp.select(); }, 30);
  return new Promise(res => { _promptResolve = res; });
}

function renderModFieldGroup(group, fields, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const editableFields = fields.filter(f => SIMPLE_FIELD_TYPES.includes(f.type));
  const complexFields  = fields.filter(f => !SIMPLE_FIELD_TYPES.includes(f.type));

  const fieldHtml = editableFields.map(f => {
    const val = _curModData[group]?.[f.name] ?? '';
    const attrs = `data-mf="${f.name}" data-mg="${group}"`;
    if (f.type === 'textarea') return `<div class="mf-row">
      <label class="mf-label">${f.label}</label>
      <textarea class="form-input mf-input" rows="3" style="resize:vertical;" ${attrs}>${String(val).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
    </div>`;
    if (f.type === 'toggle') return `<div class="mf-row mf-row-toggle">
      <input type="checkbox" id="mf-${group}-${f.name}" ${attrs} ${val ? 'checked' : ''} style="width:1.15rem;height:1.15rem;flex-shrink:0;cursor:pointer;">
      <label for="mf-${group}-${f.name}" class="mf-label mf-label-inline">${f.label}</label>
    </div>`;
    if (f.type === 'color') return `<div class="mf-row">
      <label class="mf-label">${f.label}</label>
      <div class="mf-color-wrap">
        <input type="color" ${attrs} value="${String(val||'#000000')}" class="mf-swatch">
        <input type="text" class="form-input mf-input" data-mf="${f.name}-txt" data-mg="${group}" value="${String(val||'').replace(/"/g,'&quot;')}" style="flex:1;" placeholder="#rrggbb">
      </div>
    </div>`;
    if (f.type === 'number') return `<div class="mf-row">
      <label class="mf-label">${f.label}</label>
      <input type="number" class="form-input mf-input" ${attrs} value="${val}" ${f.min!=null?`min="${f.min}"`:''}  ${f.max!=null?`max="${f.max}"`:''}>
    </div>`;
    return `<div class="mf-row">
      <label class="mf-label">${f.label}</label>
      <input type="text" class="form-input mf-input" ${attrs} value="${String(val).replace(/"/g,'&quot;')}"${f.placeholder ? ` placeholder="${String(f.placeholder).replace(/"/g,'&quot;')}"` : ''}>
    </div>`;
  }).join('');

  // Para tipos con su propia gestión de contenido (blog/clientes) el aviso de
  // campos complejos sobra (se editan en la tarjeta de contenido de abajo). Para
  // el resto (ej: las cards de Servicios) apuntamos al Preview visual.
  const hasContentCard = !!MOD_CONTENT_CONFIG[_curModType];
  const complexNote = (complexFields.length && !hasContentCard)
    ? `<div class="mf-advanced">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <div>
          <strong>${complexFields.map(f => f.label).join(' · ')}</strong>
          <span>Se editan visualmente desde <b>Preview</b>: tocá el lápiz ✎ al lado de cada elemento.</span>
        </div>
      </div>`
    : '';

  container.innerHTML = (editableFields.length || complexNote)
    ? fieldHtml + complexNote
    : `<p class="mf-empty">No hay campos sueltos acá. Usá el <b>Preview</b> para editar el contenido visualmente.</p>`;

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

/* Editor de campos del módulo Formulario: una fila por campo (etiqueta + tipo +
   requerido + mover/borrar) editando _curModData.data.campos en vivo. */
const FM_TIPOS = [
  ['text', 'Texto'], ['textarea', 'Texto largo'], ['email', 'Email'],
  ['tel', 'Teléfono'], ['number', 'Número'], ['date', 'Fecha'],
];

function renderFormCamposEditor(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let box = document.getElementById('fm-campos-editor');
  if (!box) {
    box = document.createElement('div');
    box.id = 'fm-campos-editor';
    container.appendChild(box);
  }
  const campos = _curModData.data.campos = Array.isArray(_curModData.data.campos)
    ? _curModData.data.campos : [];

  const filas = campos.map((c, i) => `
    <div class="fm-campo-row">
      <input type="text" class="form-input" data-fmc="etiqueta" data-i="${i}" value="${escAttr(c.etiqueta || '')}" placeholder="Etiqueta del campo">
      <select class="form-input form-select" data-fmc="tipo" data-i="${i}">
        ${FM_TIPOS.map(([v, l]) => `<option value="${v}"${(c.tipo || 'text') === v ? ' selected' : ''}>${l}</option>`).join('')}
      </select>
      <label class="fm-campo-req" title="Campo obligatorio">
        <input type="checkbox" data-fmc="requerido" data-i="${i}" ${c.requerido ? 'checked' : ''}> Req.
      </label>
      <button type="button" class="btn-icon" data-fmc="up" data-i="${i}" title="Subir" ${i === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
      <button type="button" class="btn-icon" data-fmc="down" data-i="${i}" title="Bajar" ${i === campos.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
      <button type="button" class="btn-icon fm-campo-del" data-fmc="del" data-i="${i}" title="Eliminar campo"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');

  box.innerHTML = `
    <div class="mf-row">
      <label class="mf-label">Campos del formulario</label>
      <div class="fm-campos-list">${filas || '<div class="fm-campos-empty">Sin campos. Agregá el primero.</div>'}</div>
      <button type="button" class="btn-secondary" id="fm-campo-add" style="margin-top:.5rem;font-size:.7rem;padding:.45rem .9rem;"><i class="fa-solid fa-plus"></i> Agregar campo</button>
    </div>`;

  const redraw = () => { renderFormCamposEditor(containerId); scheduleLivePreview(); };
  box.querySelectorAll('[data-fmc]').forEach(el => {
    const i = Number(el.dataset.i);
    const op = el.dataset.fmc;
    if (op === 'etiqueta') el.addEventListener('input', () => { campos[i].etiqueta = el.value; scheduleLivePreview(); });
    if (op === 'tipo')      el.addEventListener('change', () => { campos[i].tipo = el.value; scheduleLivePreview(); });
    if (op === 'requerido') el.addEventListener('change', () => { campos[i].requerido = el.checked; scheduleLivePreview(); });
    if (op === 'del')       el.addEventListener('click', () => { campos.splice(i, 1); redraw(); });
    if (op === 'up')        el.addEventListener('click', () => { [campos[i - 1], campos[i]] = [campos[i], campos[i - 1]]; redraw(); });
    if (op === 'down')      el.addEventListener('click', () => { [campos[i + 1], campos[i]] = [campos[i], campos[i + 1]]; redraw(); });
  });
  box.querySelector('#fm-campo-add')?.addEventListener('click', () => {
    campos.push({ etiqueta: 'Campo nuevo', tipo: 'text', requerido: false });
    redraw();
  });
}

/* MODAL DE EDICIÓN VISUAL EN VIVO
   Preview del módulo + lápiz al lado de cada texto editable (cuadro
   flotante) + panel lateral de colores. El diseño (colores) y el preview
   ya no van en el editor: viven acá. */

// Estilos inyectados DENTRO del iframe (aislados del panel admin).
const ED_STYLE = `
.ed-f{outline:1px dashed rgba(37,99,235,.55);outline-offset:2px;cursor:pointer;border-radius:2px;transition:background .1s;}
.ed-f:hover{outline-style:solid;outline-color:#2563eb;background:rgba(37,99,235,.08);}
.ed-pencil{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin:0 2px;border:none;border-radius:50%;background:#2563eb;color:#fff;font-size:10px;line-height:1;cursor:pointer;vertical-align:middle;padding:0;box-shadow:0 1px 3px rgba(0,0,0,.3);}
.ed-pencil:hover{background:#1d4ed8;transform:scale(1.1);}
.ed-box{position:absolute;z-index:99999;background:#fff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 10px 34px rgba(0,0,0,.2);padding:10px;min-width:240px;max-width:340px;font-family:Inter,system-ui,sans-serif;}
.ed-box-label{font-size:11px;font-weight:700;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em;}
.ed-box input,.ed-box textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:7px 9px;font-size:13px;font-family:inherit;color:#0f172a;outline:none;}
.ed-box input:focus,.ed-box textarea:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.15);}
.ed-box textarea{min-height:92px;resize:vertical;}
.ed-box-color{display:flex;align-items:center;gap:8px;margin-top:9px;}
.ed-box-color label{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.04em;}
.ed-box-color input[type=color]{width:34px;height:26px;border:1px solid #cbd5e1;border-radius:6px;padding:0;cursor:pointer;background:#fff;}
.ed-box-color .ed-color-clear{margin-left:auto;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;}
.ed-box-color .ed-color-clear:hover{background:#e2e8f0;}
.ed-box-done{margin-top:10px;width:100%;background:#2563eb;color:#fff;border:none;border-radius:6px;padding:7px;font-size:12px;font-weight:600;cursor:pointer;}
.ed-box-done:hover{background:#1d4ed8;}
[data-imgfield]{cursor:pointer;outline:2px dashed rgba(37,99,235,.6);outline-offset:3px;transition:outline .1s,filter .1s;}
[data-imgfield]:hover{outline-style:solid;outline-color:#2563eb;filter:brightness(.9);}`;

// Script inyectado DENTRO del iframe: coloca un lápiz al lado de cada texto y
// maneja el cuadro flotante (editar la palabra + cambiar su color).
// Recibe del padre: __ft (tipos), __fd (valores), __fl (etiquetas), __fc (colores).
function ED_SCRIPT() {
  var FT = window.__ft || {}, FD = window.__fd || {}, FL = window.__fl || {}, FC = window.__fc || {};
  var box = null;
  function close() { if (box) { box.remove(); box = null; } }
  function pretty(n) { return String(n).replace(/\./g, ' › ').replace(/_/g, ' '); }
  function rgb2hex(rgb) {
    var m = String(rgb || '').match(/\d+/g);
    if (!m || m.length < 3) return '#000000';
    return '#' + m.slice(0, 3).map(function (x) { return ('0' + parseInt(x, 10).toString(16)).slice(-2); }).join('');
  }
  function isLong(name) { return FT[name] === 'textarea' || /desc|extracto|contenido|lead|texto/i.test(name); }
  function open(el) {
    close();
    var name = el.getAttribute('data-field');
    box = document.createElement('div');
    box.className = 'ed-box';

    var label = document.createElement('div'); label.className = 'ed-box-label';
    label.textContent = FL[name] || pretty(name);

    var ctrl = document.createElement(isLong(name) ? 'textarea' : 'input');
    ctrl.value = (FD[name] != null ? FD[name] : el.textContent);

    // Fila de color
    var crow = document.createElement('div'); crow.className = 'ed-box-color';
    var clab = document.createElement('label'); clab.textContent = 'Color';
    var cin = document.createElement('input'); cin.type = 'color';
    cin.value = FC[name] || rgb2hex(getComputedStyle(el).color);
    var cclr = document.createElement('button'); cclr.type = 'button'; cclr.className = 'ed-color-clear'; cclr.textContent = 'Quitar color';
    crow.appendChild(clab); crow.appendChild(cin); crow.appendChild(cclr);

    var done = document.createElement('button'); done.className = 'ed-box-done'; done.textContent = 'Listo';

    box.appendChild(label); box.appendChild(ctrl); box.appendChild(crow); box.appendChild(done);
    document.body.appendChild(box);

    var r = el.getBoundingClientRect();
    var sy = window.scrollY || window.pageYOffset || 0;
    var sx = window.scrollX || window.pageXOffset || 0;
    var bw = box.offsetWidth || 260;
    box.style.top = (r.bottom + sy + 6) + 'px';
    box.style.left = Math.max(8, Math.min(r.left + sx, (document.documentElement.clientWidth || 9999) - bw - 10)) + 'px';
    ctrl.focus();

    function applyText() {
      el.textContent = ctrl.value;
      FD[name] = ctrl.value;
      try { parent.postMessage({ __ed: true, field: name, value: ctrl.value }, '*'); } catch (e) {}
    }
    function applyColor(c) {
      el.style.color = c || '';
      FC[name] = c;
      try { parent.postMessage({ __ed: true, field: name, color: c || '' }, '*'); } catch (e) {}
    }
    ctrl.addEventListener('input', applyText);
    ctrl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !isLong(name)) { e.preventDefault(); close(); }
      if (e.key === 'Escape') { close(); }
    });
    cin.addEventListener('input', function () { applyColor(cin.value); });
    cclr.addEventListener('click', function (e) { e.preventDefault(); applyColor(''); });
    done.addEventListener('click', function (e) { e.preventDefault(); close(); });
  }
  // Durante la edición, los enlaces NO deben navegar (romperían el preview).
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (a) e.preventDefault();
  }, true);
  // Inserta un lápiz al lado de `el` que dispara `handler`.
  function addPencil(el, glyph, title, handler) {
    var p = document.createElement('button');
    p.type = 'button'; p.className = 'ed-pencil'; p.title = title || ''; p.innerHTML = glyph || '✎';
    p.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); handler(); });
    el.insertAdjacentElement('afterend', p);
  }
  var nodes = document.querySelectorAll('[data-field]');
  for (var i = 0; i < nodes.length; i++) {
    (function (el) {
      addPencil(el, '✎', 'Editar texto y color', function () { open(el); });
      el.addEventListener('click', function (e) { e.stopPropagation(); open(el); });
    })(nodes[i]);
  }
  // Imágenes editables: click → avisar al padre para abrir el selector de imágenes.
  var imgs = document.querySelectorAll('[data-imgfield]');
  for (var k = 0; k < imgs.length; k++) {
    (function (el) {
      el.title = 'Click para cambiar la imagen';
      el.addEventListener('click', function (e) {
        e.stopPropagation(); e.preventDefault();
        try { parent.postMessage({ __edimg: true, field: el.getAttribute('data-imgfield') }, '*'); } catch (e) {}
      });
    })(imgs[k]);
  }
  // Ícono editable (servicios): lápiz → el padre abre el selector de íconos + color.
  var icons = document.querySelectorAll('[data-iconfield]');
  for (var a = 0; a < icons.length; a++) {
    (function (el) {
      addPencil(el, '✎', 'Cambiar ícono y color', function () {
        try { parent.postMessage({ __edicon: true, field: el.getAttribute('data-iconfield') }, '*'); } catch (e) {}
      });
    })(icons[a]);
  }
  // URL de destino del enlace (servicios): lápiz "flechita" → editar la URL.
  var links = document.querySelectorAll('[data-linkfield]');
  for (var b = 0; b < links.length; b++) {
    (function (el) {
      addPencil(el, '↗', 'Editar la URL de destino', function () {
        try { parent.postMessage({ __edlink: true, field: el.getAttribute('data-linkfield') }, '*'); } catch (e) {}
      });
    })(links[b]);
  }
  // Detalle del enlace (servicios): lápiz → el padre abre el modal título/descr/imagen.
  var dets = document.querySelectorAll('[data-detallefield]');
  for (var c = 0; c < dets.length; c++) {
    (function (el) {
      addPencil(el, '＋', 'Editar el detalle (título, descripción, imagen)', function () {
        try { parent.postMessage({ __eddetalle: true, field: el.getAttribute('data-detallefield') }, '*'); } catch (e) {}
      });
    })(dets[c]);
  }
  document.addEventListener('click', function (e) {
    if (box && !box.contains(e.target) && !(e.target.classList && e.target.classList.contains('ed-pencil'))) close();
  });
}

// Construye el srcdoc del iframe (render + CSS del sitio + capa de edición).
function _moduleSrcdoc({ editable }) {
  const sec = SECTIONS[_curModType];
  if (!sec) return '';
  if (editable) setEditMode(true);
  setFieldColors(_curModData.data?.__colores || {});   // colores por palabra
  const html = sec.render(_curModData.data || {}, _curModData.design || {});
  setFieldColors({});
  if (editable) setEditMode(false);   // se apaga inmediato: el sitio público nunca lo ve

  const pageType = TYPE_TO_PAGE[_curModType] || 'index';
  const cssFiles = TIPO_CSS[pageType] || TIPO_CSS.index;
  const origin   = window.location.origin;
  const links    = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">\n' + cssFiles.map(f => `<link rel="stylesheet" href="${origin}${f}">`).join('\n');

  // Mapas para el editor inline (solo campos de texto simples).
  let editStyle = '', editScript = '';
  if (editable) {
    const fields = (sec.dataFields || []).filter(f => f.type === 'text' || f.type === 'textarea');
    const fTypes = {}, fData = {}, fLabels = {};
    fields.forEach(f => { fTypes[f.name] = f.type; fData[f.name] = _curModData.data?.[f.name] ?? ''; fLabels[f.name] = f.label; });
    const colores = _curModData.data?.__colores || {};
    const j = o => JSON.stringify(o).replace(/</g, '\\u003c');
    const S = 'scr' + 'ipt';
    editStyle  = `<style>${ED_STYLE}</style>`;
    editScript = `<${S}>window.__ft=${j(fTypes)};window.__fd=${j(fData)};window.__fl=${j(fLabels)};window.__fc=${j(colores)};(${ED_SCRIPT})();</${S}>`;
  }

  // Partir los tags para que Live Server no inyecte su hot-reload en el literal.
  const _B = 'bo'+'dy', _H = 'hea'+'d';
  return `<!doctype html><html lang="es"><${_H}><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Inter:ital,wght@0,400;0,500;0,700;0,900;1,700;1,900&display=swap" rel="stylesheet">${links}<style>html,body{margin:0;padding:0;}body{overflow-x:hidden;}</style>${editStyle}</${_H}><${_B}>${html}${editScript}</${_B}></html>`;
}

/* Preview en vivo (debounced): re-renderiza el iframe del modal si está abierto */
let _previewTimer = null;
function scheduleLivePreview() {
  const modal = document.getElementById('mod-preview-modal');
  if (!modal || modal.style.display === 'none') return;
  clearTimeout(_previewTimer);
  _previewTimer = setTimeout(() => {
    const iframe = document.getElementById('mpm-iframe');
    if (iframe) iframe.srcdoc = _moduleSrcdoc({ editable: true });
  }, 200);
}

/* Cambia la pestaña activa del panel lateral del Preview ("settings" | "design"). */
function _switchPreviewTab(tab) {
  document.querySelectorAll('.mpm-side-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.mpmTab === tab));
  document.querySelectorAll('.mpm-side .mpm-tabpane').forEach(p =>
    p.classList.toggle('active', p.dataset.mpmPane === tab));
}

/* Pestaña "Ajustes del módulo" del Preview: nombre + ítems del navbar a los que
   pertenece. Solo se muestra cuando el preview se abre para editar un módulo
   (no desde el flujo viejo de tarjetas). Los cambios se aplican en memoria y se
   persisten al tocar "Guardar". Devuelve true si la pestaña queda disponible. */
function _renderPreviewModuleSettings() {
  const tabBtn    = document.getElementById('mpm-tab-btn-settings');
  const nombreInp = document.getElementById('mpm-nombre');
  const navBox    = document.getElementById('mpm-nav');
  const hint      = document.getElementById('mpm-nav-hint');
  const show = !_previewFromCards;
  if (tabBtn) tabBtn.style.display = show ? '' : 'none';
  if (!show) return false;

  if (nombreInp) {
    nombreInp.value = _curModData.nombre || '';
    nombreInp.oninput = () => { _curModData.nombre = nombreInp.value; };
  }
  if (!navBox) return true;

  if (GLOBAL_TIPOS_MOD.has(_curModType)) {
    navBox.innerHTML = '<label class="mod-pag-check is-disabled"><input type="checkbox" checked disabled/> 🌐 Todas las páginas (global)</label>';
    _curModData.id_pagina = 'all';
    if (hint) hint.textContent = 'Módulo global: se muestra en todas las páginas del sitio.';
    return true;
  }
  _renderPaginaChecks(navBox, _curModData.id_pagina, v => { _curModData.id_pagina = v; });
  if (hint) hint.textContent = 'Marcá a qué ítem(s) del navbar pertenece este módulo (ej: «Fibra Óptica»), o «Todas las páginas».';
  return true;
}

/* Abrir / cerrar el modal de edición visual */
function openPreviewModal() {
  if (!_curModType) return;
  const sec = SECTIONS[_curModType];
  if (!sec) return;
  const modal  = document.getElementById('mod-preview-modal');
  const iframe = document.getElementById('mpm-iframe');
  if (!modal || !iframe) return;

  const titleEl = document.getElementById('mpm-title');
  const idLbl = _curModId != null ? `· #${_curModId}` : '· nuevo';
  if (titleEl) titleEl.innerHTML = `${sec.icon || ''} ${escAttr(sec.label)} ${idLbl}`;

  // Pestaña "Ajustes del módulo" (nombre + ítems del navbar).
  const hasSettings = _renderPreviewModuleSettings();

  // Pestaña "Colores y diseño" (reusa el render de campos → live-sync).
  renderModFieldGroup('design', sec.designFields || [], 'mpm-design-fields');
  const hasDesign = !!(sec.designFields || []).length;
  const designTabBtn = document.getElementById('mpm-tab-btn-design');
  if (designTabBtn) designTabBtn.style.display = hasDesign ? '' : 'none';

  // Pestaña inicial: "Ajustes" si está disponible; si no, "Colores y diseño".
  _switchPreviewTab(hasSettings ? 'settings' : 'design');

  iframe.srcdoc = _moduleSrcdoc({ editable: true });
  modal.style.display = '';
  document.body.style.overflow = 'hidden';
}
function closePreviewModal() {
  const modal = document.getElementById('mod-preview-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
  // Si el preview se abrió desde el editor de tarjetas, refrescamos esa lista
  // (refleja textos/íconos editados visualmente) y limpiamos el flag.
  if (_previewFromCards) {
    _previewFromCards = false;
    if (_curCardsMod) _renderCardsLista(_curCardsMod);
  }
}

/* Duplicar módulo */
window.duplicarModulo = async function(id) {
  const m = _mods.find(x => x.id_modulo === Number(id));
  if (!m) return;
  try {
    const res = await window.__svc.apiPost('/modulos', {
      tipo:      m.tipo,
      nombre:    `${m.nombre} (copia)`,
      id_pagina: m.id_pagina ?? null,
      data:      JSON.parse(JSON.stringify(m.data   || {})),
      design:    JSON.parse(JSON.stringify(m.design || {})),
      alerta:    m.alerta === true,
    });
    _mods.push(res.modulo);
    renderModCatalog();
    window.__svc.showNotif('Módulo duplicado', 'success');
  } catch(e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
  }
};

/* Eliminar módulo (guarda si está referenciado) */
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

// "Nuevo" del modal Ver: agrega otra variante del mismo tipo, hereda la página
// del módulo visto y abre su editor.
async function nuevaVarianteDeModulo(tipo, id_pagina) {
  const sec = SECTIONS[tipo];
  if (!sec) return;
  try {
    const res = await window.__svc.apiPost('/modulos', {
      tipo,
      nombre: sec.label,
      id_pagina: id_pagina ?? null,
      data:   JSON.parse(JSON.stringify(sec.defaultData   || {})),
      design: JSON.parse(JSON.stringify(sec.defaultDesign || {})),
    });
    _mods.push(res.modulo);
    renderModCatalog();   // refleja el alta en el catálogo al instante
    window.__svc.showNotif('Módulo creado', 'success');
    // Las "cards" (services) se editan en el segundo modal (tarjeta por tarjeta);
    // el resto en el editor de campos normal.
    if (tipo === 'services') {
      // Refrescamos la lista de variantes del modal "Ver" (abierto detrás) para
      // que el módulo recién creado aparezca al volver.
      _renderModVerLista(tipo);
      openServiciosCards(res.modulo.id_modulo);
    } else {
      _closeModVer();
      openModEditor(res.modulo.id_modulo);
    }
  } catch (e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
  }
}

/* Guardar el módulo en edición (lo usan el editor y el modal) */
async function saveCurrentModule() {
  if (!_curModId) return false;
  const nombre = document.getElementById('mpm-nombre')?.value?.trim()
    || document.getElementById('modulos-variant-name-input')?.value?.trim()
    || _curModData.nombre;
  try {
    const res = await window.__svc.apiPut(`/modulos/${_curModId}`, {
      nombre,
      alerta:    _curModData.alerta,
      id_pagina: _curModData.id_pagina ?? null,
      data:      _curModData.data,
      design:    _curModData.design,
    });
    const idx = _mods.findIndex(m => m.id_modulo === _curModId);
    if (idx !== -1) _mods[idx] = res.modulo;
    _curModData.nombre = nombre;
    const nameEl = document.getElementById('modulos-editor-variant-name');
    if (nameEl) nameEl.textContent = nombre;
    // Si la lista de variantes del modal "Ver" quedó abierta detrás, la refrescamos.
    const verModal = document.getElementById('modulos-view-modal');
    if (verModal?.classList.contains('open') && !MOD_CONTENT_CONFIG[_curModType] && _curModType !== 'services') {
      _renderModVerLista(_curModType);
    }
    renderModCatalog();
    window.__svc.showNotif('Módulo guardado', 'success');
    return true;
  } catch (e) {
    window.__svc.showNotif('Error: ' + e.message, 'error');
    return false;
  }
}

/* Buscador del catálogo de módulos */
document.getElementById('modulos-search')?.addEventListener('input', e => {
  _modQuery = e.target.value || '';
  renderModCatalog();
});

/* Botón único "Nuevo" del catálogo + modal de creación */
document.getElementById('modulos-nuevo-btn')?.addEventListener('click', () => window.openNuevoModulo());
document.getElementById('nm-crear-btn')?.addEventListener('click', crearModuloDesdeModal);

/* Botón: abrir el modal de edición visual (Preview) */
document.getElementById('modulos-preview-btn')?.addEventListener('click', () => {
  _previewFromCards = false;
  openPreviewModal();
});

/* Pestañas del panel lateral (Ajustes / Colores y diseño) */
document.querySelectorAll('.mpm-side-tab').forEach(btn =>
  btn.addEventListener('click', () => _switchPreviewTab(btn.dataset.mpmTab)));

/* Modal: cerrar */
document.getElementById('mpm-close')?.addEventListener('click', closePreviewModal);
document.getElementById('mpm-backdrop')?.addEventListener('click', closePreviewModal);
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const modal = document.getElementById('mod-preview-modal');
  if (modal && modal.style.display !== 'none') closePreviewModal();
});

/* Modal: guardar (deja el modal abierto). Según de dónde se abrió el preview,
   guarda el módulo de tarjetas o el módulo del editor normal. */
document.getElementById('mpm-save')?.addEventListener('click', () => {
  if (_previewFromCards) _saveCardsFromPreview();
  else saveCurrentModule();
});

// Asigna un valor por "path" con puntos/índices (ej: "cards.0.titulo").
function _setByPath(obj, path, val) {
  const parts = String(path).split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (o[k] == null) o[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    o = o[k];
  }
  o[parts[parts.length - 1]] = val;
}

// Lee un valor por "path" con puntos/índices (ej: "cards.0.titulo").
function _getByPath(obj, path) {
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/* Re-renderiza el iframe del preview (refleja cambios en _curModData). */
function _rerenderPreviewIframe() {
  const iframe = document.getElementById('mpm-iframe');
  if (iframe) iframe.srcdoc = _moduleSrcdoc({ editable: true });
}

/* Ediciones inline (texto, color y ahora imágenes) que llegan del iframe */
window.addEventListener('message', async e => {
  const d = e.data;
  if (!d || !d.field) return;
  // Cambio de imagen desde el preview: abre el selector y re-renderiza el iframe.
  if (d.__edimg === true) {
    const current = _getByPath(_curModData.data || {}, d.field) || '';
    const path = await window.__imgPicker?.open({ current });
    if (path) {
      _curModData.data = _curModData.data || {};
      _setByPath(_curModData.data, d.field, path);
      _rerenderPreviewIframe();
    }
    return;
  }
  // Cambio de ícono + color de una tarjeta de servicios desde el preview.
  if (d.__edicon === true) {
    _curModData.data = _curModData.data || {};
    const card = _getByPath(_curModData.data, d.field) || {};
    const picked = await window.__iconPicker?.open({ current: serviceCardIcon(card), color: card.iconoColor || '' });
    if (picked && picked.icono) {
      _setByPath(_curModData.data, d.field + '.icono', picked.icono);
      _setByPath(_curModData.data, d.field + '.iconoColor', picked.color || '');
      _rerenderPreviewIframe();
    }
    return;
  }
  // Cambio de la URL de destino del enlace de una tarjeta desde el preview.
  if (d.__edlink === true) {
    _curModData.data = _curModData.data || {};
    const current = _getByPath(_curModData.data, d.field) || '';
    const url = await _promptOverlay({ label: 'URL de destino de “Ver Detalles”', value: current, placeholder: '/html/… o https://…' });
    if (url !== null) { _setByPath(_curModData.data, d.field, url.trim()); _rerenderPreviewIframe(); }
    return;
  }
  // Editar el detalle (título/descr/imagen) de una tarjeta desde el preview.
  if (d.__eddetalle === true) {
    _curModData.data = _curModData.data || {};
    const card = _getByPath(_curModData.data, d.field);
    if (card) _openCardDetalleFor(card, () => _rerenderPreviewIframe());
    return;
  }
  if (d.__ed !== true) return;
  _curModData.data = _curModData.data || {};
  if (d.value !== undefined) _setByPath(_curModData.data, d.field, d.value);
  if (d.color !== undefined) {
    const cols = _curModData.data.__colores = _curModData.data.__colores || {};
    if (d.color) cols[d.field] = d.color; else delete cols[d.field];
  }
});

/* Botón: volver al catálogo / Cancelar */
document.getElementById('modulos-variants-back-btn')?.addEventListener('click', renderModCatalog);
document.getElementById('modulos-back-btn')?.addEventListener('click', _closeModEditor);
document.getElementById('modulos-cancel-btn')?.addEventListener('click', _closeModEditor);

/* Botón: guardar módulo (editor) */
document.getElementById('modulos-save-btn')?.addEventListener('click', async () => {
  const ok = await saveCurrentModule();
  if (ok) _closeModEditor();
});
