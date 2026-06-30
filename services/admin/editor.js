import { SECTIONS, TIPOS_HTML, renderModulo, setEditMode, setFieldColors, setModuleRegistry, SERVICE_ICON_CATALOG, SERVICE_LEGACY_ICONS, serviceCardIcon } from '../sections.js';
import { TIPO_CSS, TYPE_TO_PAGE, cssFilesFor } from '../css-pages.js';

const API = `http://${window.location.hostname}:3000/api`;
const token = () => sessionStorage.getItem('sisgra_token');

const ICON_CATALOG = ['location', 'lightning', 'shield', 'check', 'camera', 'gear', 'lock', 'chart', 'database'];

const e3 = {
  plantillas: [],
  activeTpl: null,        // { id_plantilla, tipo, nombre, id_menu, id_modulos:[num], contenedores, ... }
  modulos: [],            // catalogo plano (working copy), se persiste con PUT /data/modulos
  navbar: [],             // botones del navbar para renderizar el nav en el canvas
  // working model de contenedores: conts = [{ cap:1-3, modulos:[id,...] }]
  // se serializa a plantilla.contenedores = [[id,...],...] al guardar
  conts: [],
  sel: null,              // módulo seleccionado: { ci, mi } (contenedor, índice dentro)
  activeCont: null,       // ci del contenedor destino para insertar módulos
  dirty: false,
  propsTab: 'data',
  currentTipo: null,
  slotSearch: null,       // buscador inline abierto en un slot vacío: { ci, mi, query }
};

const CONT_MAX = 3;   // máximo de módulos por contenedor (fila)

// plantilla.contenedores [[id,..],..] a working conts [{cap,modulos}]
// migra datos viejos sin contenedores a 1x1 por modulo
function contsFromPlantilla(tpl) {
  const raw = (Array.isArray(tpl.contenedores) && tpl.contenedores.length)
    ? tpl.contenedores
    : (tpl.id_modulos || []).map(id => [id]);
  return raw.map(m => {
    const modulos = (Array.isArray(m) ? m : []).filter(id => id != null);
    return { cap: Math.max(1, Math.min(CONT_MAX, modulos.length || 1)), modulos };
  });
}
// working conts a contenedores persistibles, recorta a la capacidad
function contsToContenedores() {
  return e3.conts.map(c => c.modulos.slice(0, c.cap));
}
// entrada de contenedor inline: card suelta guardada en la plantilla
const esInline = x => x && typeof x === 'object' && x.inline === true;

// misma logica que page-bootstrap.cardEnPlantilla: 'all'/sin asignar siempre; [ids] solo si la plantilla esta
function _cardEnPlantilla(card, plantillaId) {
  const p = card && card.id_pagina;
  if (p === 'all' || p == null || p === '') return true;
  const ids = (Array.isArray(p) ? p : [p]).map(Number).filter(n => !isNaN(n));
  return ids.length ? ids.includes(Number(plantillaId)) : true;
}
// todas las entradas de todos los contenedores (ids + inline)
function allContEntries() {
  return contsToContenedores().reduce((acc, m) => acc.concat(m), []);
}
// lista plana de ids numericos (canonica para id_modulos); los inline se excluyen
function allModIds() {
  return allContEntries().filter(x => typeof x === 'number');
}
// mantiene activeTpl.{contenedores,id_modulos} en sync por si codigo viejo los lee
function syncActiveTpl() {
  if (!e3.activeTpl) return;
  e3.activeTpl.contenedores = contsToContenedores();
  e3.activeTpl.id_modulos   = allModIds();
}

// indice del primer contenedor incompleto (menos modulos que su cap), o -1
// con uno incompleto no se puede crear otro ni guardar
function pendingContIndex() {
  return e3.conts.findIndex(c => c.modulos.length < c.cap);
}

// activeCont apunta al contenedor incompleto (destino de insercion)
function refreshContControls() {
  e3.activeCont = pendingContIndex();
}

// nav/footer se referencian compartidos; el resto se clona al insertar
const GLOBAL_TIPOS = new Set(['nav', 'footer', 'footer-full']);

// catalogo plano de modulos v2 + navbar, se recarga al abrir el editor
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

// items del nav desde navbar.json (igual que page-bootstrap): jerarquico, padre con hijos = desplegable
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

// resuelve los modulos de los contenedores a instancias (con items de nav); lo usa cssFilesFor
function resolvedMods() {
  const navItems = buildNavItems(e3.navbar);
  const base = allContEntries().map(entry => {
    if (esInline(entry)) return entry;   // módulo inline: ya trae tipo/data/design
    const m = modById(entry);
    if (!m) return null;
    return m.tipo === 'nav' ? { ...m, data: { ...m.data, items: navItems } } : m;
  }).filter(Boolean);
  // suma los modulos que las grillas inyectan por id para cargar su css
  return base.concat(expandGrillaInjectedMods(base));
}

// modulos que las grillas (feature-grid) inyectan por id, resueltos recursivo contra el catalogo
function expandGrillaInjectedMods(mods, seen = new Set()) {
  const out = [];
  (mods || []).forEach(sec => {
    if ((sec.tipo || sec.type) !== 'feature-grid') return;
    (Array.isArray(sec.data?.modulos) ? sec.data.modulos : []).forEach(id => {
      if (seen.has(id)) return;
      seen.add(id);
      const m = modById(id);
      if (!m) return;
      out.push(m);
      out.push(...expandGrillaInjectedMods([m], seen));
    });
  });
  return out;
}

const escAttr = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const notif = (msg, type='success') => window.__svc?.showNotif?.(msg, type) ?? console.log('[e3]', msg);

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

// todos los módulos disponibles, sin filtrar por tipo
function modulesForTipo(_tipo) {
  return Object.entries(SECTIONS);
}

// slug comun para unir navbar (href "/html/fibra_optica") con la lista de paginas; "/" es "index"
const pageKey = s => String(s ?? '').replace(/^\//, '').replace(/\.html$/, '') || 'index';

// llena el select de "html destino" desde los items del navbar (tipo de su plantilla o btn-{id_menu})
// los items con hijos van como optgroup; el id_menu viaja en data-idmenu para vincular la pagina
function populateTipoSelect() {
  const sel = document.getElementById('np-tipo');
  if (!sel) return;

  const botones = e3.navbar || [];
  // tipo de un item: el de su plantilla vinculada, o btn-{id_menu}
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
      // contenedor desplegable: optgroup con sus hijos
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

  // paginas del sistema que no estan en el menu (articulo, perfil de cliente)
  TIPOS_HTML.forEach(t => {
    if (emitidos.has(t.value)) return;
    emitidos.add(t.value);
    html += opt(t.value, t.label, null);
  });

  sel.innerHTML = html;
}

// si es la primera carga, intenta restaurar el panel/template activo previo a un reload
let _e3RestorePending = true;

async function loadPlantillas() {
  try {
    // bajamos el navbar para rotular cada pagina personalizada con el nombre de su item
    const [{ plantillas }, nav] = await Promise.all([
      api('GET', '/plantillas'),
      api('GET', '/data/navbar').catch(() => ({ botones: [] })),
    ]);
    e3.plantillas = plantillas || [];
    e3.navbar = nav.botones || [];
    renderOverview();
    renderSidebarList();
    // restaura el estado post-reload una vez que los datos estan disponibles
    if (_e3RestorePending) {
      _e3RestorePending = false;
      try {
        const panel = sessionStorage.getItem('sisgra_panel');
        if (panel === 'tpl-editor') {
          const tplId = Number(sessionStorage.getItem('sisgra_tpl'));
          if (tplId && e3.plantillas.some(p => p.id_plantilla === tplId)) {
            openEditor(tplId);
          }
        }
        // 'plantillas' lo maneja showPanel() + reloadPlantillas(), ya cargado arriba
      } catch(_) {}
    }
  } catch (e) { notif('Error cargando plantillas: ' + e.message, 'error'); }
}

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
  // card de una plantilla (la usan grupos del sistema y custom)
  const cardHtml = (p) => {
    const vencida = isVencida(p);
    const dias    = diasRestantes(p);
    const cls     = expiryClass(p);
    let expiryHtml = '';
    // el vencimiento se muestra tambien en borradores (se asigna al crear)
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

  // header de un grupo + sus cards, o un mensaje de vacio
  const grupoHtml = (label, file, pls, vacioMsg) => `
    <div style="margin-bottom:1.25rem;">
      <div style="display:flex;align-items:center;gap:.75rem;padding:.4rem 0 .5rem;border-bottom:1px solid var(--slate-100);margin-bottom:.5rem;">
        <span style="font-size:.625rem;font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:var(--sisgra-blue);">${label}</span>
      </div>
      ${pls.length === 0
        ? (vacioMsg ? `<div style="padding:.85rem;color:var(--slate-400);font-size:.7rem;text-align:center;background:var(--slate-50);">${vacioMsg}</div>` : '')
        : pls.map(cardHtml).join('')}
    </div>`;

  // grupos del sistema (tipos fijos)
  let html = TIPOS_HTML.map(t =>
    grupoHtml(t.label, t.file, e3.plantillas.filter(p => p.tipo === t.value), 'Sin plantillas todavía.')
  ).join('');
  // y una seccion por pagina personalizada (btn-*), rotulada con el nombre de su item del navbar
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
  const nameSpan = btn.closest('div').querySelector('.tpl-list-name-text');
  if (!nameSpan) return;
  const nombreActual = e3.plantillas.find(p => p.id_plantilla === id)?.nombre || nameSpan.textContent;

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

async function openNuevaModal(preTipo = '') {
  document.getElementById('np-name').value = '';
  document.getElementById('np-desc').value = '';
  // releemos el navbar para reflejar las pestañas recien creadas en el selector de html destino
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
  // id_menu (data-idmenu) vincula la pagina con esa pestaña; en btn-* el backend le pone el href
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

async function openEditor(id) {
  try { sessionStorage.setItem('sisgra_panel', 'tpl-editor'); sessionStorage.setItem('sisgra_tpl', String(id)); } catch(_) {}
  // bloquea en pantallas moviles (< 1024px)
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
    // editando una plantilla: "ver todas las plantillas" no debe quedar activo en el sidebar
    document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
    document.getElementById('topbar-title').textContent = `Editor — ${plantilla.nombre}`;
    renderSidebarList();
    renderEditorShell();
  } catch (e) { notif('Error: ' + e.message, 'error'); }
}

function backToOverview() {
  if (e3.dirty && !confirm('Hay cambios sin guardar. ¿Salir igual?')) return;
  try { sessionStorage.setItem('sisgra_panel', 'plantillas'); } catch(_) {}
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
      #panel-tpl-editor{height:100%;}
      #tpl-editor-inner{display:flex;flex-direction:column;height:100%;min-height:0;}
      .editor-shell{flex:1;min-height:0;height:auto;}
      /* ancho disponible en vez del 1200px fijo de .page-frame.desktop (esa regla la usa el editor legacy) */
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
  // click fuera del iframe cierra el buscador inline del slot
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

// el buscador vive dentro del slot vacío clickeado: inserta solo en ese contenedor
// elegir un resultado inserta el módulo al instante (uno por slot)
// paginas asignadas normalizadas: 'all' | [ids]; id_pagina puede ser null/'all'/id/array
function _paginasDe(id_pagina) {
  if (id_pagina === 'all') return 'all';
  if (id_pagina == null || id_pagina === '') return [];
  return (Array.isArray(id_pagina) ? id_pagina : [id_pagina]).map(Number).filter(n => !isNaN(n));
}

// habilita una variante en la plantilla en edicion (asignacion siempre por variante)
// 'all'/sin asignar: todas las plantillas; asignada a items: solo las plantillas de esos items
function _idPaginaAllowsActiveTpl(idp) {
  const pags = _paginasDe(idp);
  if (pags === 'all') return true;        // todas las paginas
  if (pags.length === 0) return false;    // sin asignar: no se muestra
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
    // modulo entero si la variante esta asignada a esta plantilla; sin limite de repeticion
    if (_modAllowedInActiveTpl(m)) {
      const hay = `${m.nombre} ${m.tipo} ${SECTIONS[m.tipo]?.label || ''}`.toLowerCase();
      if (hay.includes(q)) res.push({ kind: 'mod', id_modulo: m.id_modulo, tipo: m.tipo, label: m.nombre, sub: SECTIONS[m.tipo]?.label || m.tipo });
    }
    // El módulo "Cards" se inserta entero: al renderizarse muestra SOLO las
    // tarjetas asignadas a la página actual (card.id_pagina). Ya NO se insertan
    // tarjetas sueltas desde el buscador.
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

// inserta el modulo en ese contenedor; referencia directa (sin clonar), se edita en vivo
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

// inserta una tarjeta como modulo inline (copia con soloCard) en la plantilla, sin tocar el catalogo
// es independiente: editar la tarjeta original no la modifica
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

// cierra el buscador del slot al click fuera del iframe
function onParentMouseCloseSlotSearch() {
  if (e3.slotSearch) closeSlotSearch();
}

// cierra el buscador al click dentro del iframe pero fuera de un slot
function onIframeClickCloseSlotSearch(ev) {
  if (!e3.slotSearch) return;
  if (ev.target.closest('.e3-slot')) return;   // clicks en slots: abren/usan el buscador
  closeSlotSearch();
}

// crea un contenedor vacio de cap columnas (1-3); bloqueado si hay uno incompleto
function crearContenedor(cap) {
  if (pendingContIndex() !== -1) {
    notif('Completá el contenedor actual antes de crear otro', 'error');
    return;
  }
  const n = Math.max(1, Math.min(CONT_MAX, cap | 0));
  e3.conts.push({ cap: n, modulos: [] });
  e3.activeCont = e3.conts.length - 1;
  e3.sel = null;
  // el buscador no se abre solo, aparece al click en "+ insertar modulo"
  e3.slotSearch = null;
  markDirty(); renderCanvas(); renderProps();
  notif(`✓ Contenedor ${n}×1 creado — tocá "+ Insertar módulo" para llenar sus ${n} lugar${n > 1 ? 'es' : ''}`);
}

// html del boton "nuevo contenedor", siempre al final; si hay uno incompleto muestra un aviso
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

// al click, el selector de tamaño reemplaza al boton en su lugar; cada celda crea el contenedor
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

// inyecta los <link> de css que falten para los modulos actuales; lista calculada por cssFilesFor
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
  // partimos <body> para que live server no inyecte su auto-reload en el template
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
  /* contenedores (filas) en el canvas */
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
  /* buscador inline dentro del slot clickeado */
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
  /* boton "nuevo contenedor" al fondo del canvas */
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
  // registro para que las grillas resuelvan modulos por id; a las cards les filtra por la plantilla activa
  const _tplId = e3.activeTpl?.id_plantilla;
  setModuleRegistry(e3.modulos.map(m => (m.tipo === 'services' && Array.isArray(m.data?.cards))
    ? { ...m, data: { ...m.data, cards: m.data.cards.filter(c => _cardEnPlantilla(c, _tplId)) } }
    : m));
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
        // slot vacio: si el buscador esta abierto en este slot se renderiza adentro, si no el mensaje
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
      // el preview de "cards" refleja el sitio publico: filtra las cards de esta plantilla y su titulo
      let mRender = m;
      if (m && m.tipo === 'services') {
        const tplId = e3.activeTpl?.id_plantilla;
        const titulo = (m.data?.titulos_por_pagina || {})[tplId] || m.data?.titulo_seccion;
        const cards = Array.isArray(m.data?.cards)
          ? m.data.cards.filter(c => _cardEnPlantilla(c, tplId))
          : m.data?.cards;
        mRender = { ...m, data: { ...m.data, cards, titulo_seccion: titulo } };
      }
      const inner = mRender
        ? renderModulo(mRender.tipo === 'nav' ? { ...mRender, data: { ...mRender.data, items: navItems } } : mRender)
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
  // slots vacios abren el buscador inline dentro del slot clickeado
  doc.querySelectorAll('.e3-slot:not(.e3-slot-open)').forEach(s => {
    s.addEventListener('click', () => {
      e3.slotSearch = { ci: +s.dataset.ci, mi: +s.dataset.mi, query: '' };
      renderCanvas();
    });
  });
  bindSlotSearch(doc);
  // click dentro del iframe pero fuera de un slot cierra el buscador
  doc.removeEventListener('click', onIframeClickCloseSlotSearch);
  doc.addEventListener('click', onIframeClickCloseSlotSearch);
  // botones de la barra del contenedor: mover/eliminar
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
  bindAddCont(doc);
  doc.querySelectorAll('a').forEach(a => a.addEventListener('click', ev => ev.preventDefault()));
  doc.querySelectorAll('form').forEach(f => f.addEventListener('submit', ev => ev.preventDefault()));
}

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

// props de una tarjeta suelta (modulo inline); edita su unica card en vivo
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

// check de alerta por modulo; el scheduler dispara la alerta de vencimiento (id_alerta=1) al vencer la plantilla
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

  // campos de imagen: el botón "elegir" abre el selector modal
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

  // editores de arrays (cards, logos, clientes, posts, features, links, text-list)
  body.querySelectorAll('[data-e3-arr]').forEach(arrWrap => {
    const kind = arrWrap.dataset.e3Arr;
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
    // resuelve el campo real del array por el tipo del dataField del módulo
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

async function guardarPlantilla() {
  if (!e3.activeTpl) return;
  const pend = pendingContIndex();
  if (pend !== -1) {
    const c = e3.conts[pend];
    notif(`No se puede guardar: el contenedor ${c.cap}×1 está incompleto (faltan ${c.cap - c.modulos.length}). Completálo o eliminálo.`, 'error');
    return;
  }
  try {
    await api('PUT', '/data/modulos', { modulos: e3.modulos });
    // contenedores es la fuente de verdad; mandamos id_modulos por compatibilidad
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

function goToPlantillas() {
  try { sessionStorage.setItem('sisgra_panel', 'plantillas'); } catch(_) {}
  // al salir del editor ninguna plantilla queda abierta, asi el sidebar no resalta dos
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

// guardia de cambios sin guardar al salir por el sidebar (logout, nueva plantilla, etc.)
// corre en fase captura para frenar el click antes de los handlers de navegacion
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
  // sale igual: descarta el estado del editor para no volver a preguntar
  e3.slotSearch = null;
  e3.activeTpl = null; e3.conts = []; e3.sel = null; e3.activeCont = null;
  e3.dirty = false;
}

// reemplaza los botones viejos de plantillas e inyecta la ui del editor e3
function initE3() {
  populateTipoSelect();
  injectSidebarLink();
  injectDashboardCard();

  // guardia de cambios sin guardar (sidebar / logout / nueva plantilla)
  document.removeEventListener('click', onSidebarLeaveGuard, true);
  document.addEventListener('click', onSidebarLeaveGuard, true);

  // el boton "ver todas las plantillas" tenia un handler legacy (openTemplateEditor); lo reemplazamos
  const goBtn = stripListeners(document.getElementById('sidebar-go-plantillas'));
  if (goBtn) goBtn.addEventListener('click', goToPlantillas);

  const a = stripListeners(document.getElementById('btn-nueva-plantilla-main'));
  if (a) a.addEventListener('click', () => openNuevaModal());

  const b = stripListeners(document.getElementById('btn-nueva-plantilla'));
  if (b) b.addEventListener('click', () => openNuevaModal());

  const c = stripListeners(document.getElementById('crear-plantilla-btn'));
  if (c) c.addEventListener('click', crearPlantilla);

  // "gestionar plantillas" apuntaba al editor legacy; lo redirigimos al overview e3
  const dashBtn = stripListeners(document.getElementById('dash-editar-home'));
  if (dashBtn) dashBtn.addEventListener('click', goToPlantillas);

  // pisa los globals viejos para que código legacy async no sobrescriba nuestros renders
  window.renderSidebarTemplates = renderSidebarList;
  window.renderTemplateOverview = renderOverview;
  window.openTemplateEditor = (id) => openEditor(id);
  window.openTemplateEditorFromList = (id) => openEditor(id);
  window.setActiveTpl = (id) => activarPlantilla(id);
  window.deleteTpl = (id) => eliminarPlantilla(id);
  window.saveTpl = () => guardarPlantilla();
  // permite a otros paneles (ej navbar) refrescar la lista sin recargar la pagina
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

// catalogo plano de modulos v2: lista y editor de modulo
const SIMPLE_FIELD_TYPES = ['text','textarea','number','color','toggle'];
const GLOBAL_TIPOS_MOD = new Set(['nav','footer','footer-full']);

let _mods       = [];      // catalogo plano [{ id_modulo, tipo, nombre, id_pagina, data, design, alerta }]
let _modUsos    = {};      // id_modulo: cantidad de plantillas que lo usan
let _plantillas = [];      // lista de plantillas/páginas (para el desplegable "Página asignada")
let _navbar     = [];      // ítems del navbar (botones), para rotular cada página con su ítem
let _modQuery   = '';      // texto del buscador del catálogo de módulos
let _curModId   = null;
let _curModType = null;
let _curModData = { nombre: '', alerta: false, id_pagina: null, data: {}, design: {} };

// item del navbar al que apunta una plantilla; grupo = titulo del contenedor padre
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

// items del navbar a los que pertenece un modulo; ignora referencias a plantillas inexistentes
function _paginaLabel(id_pagina) {
  const pags = _paginasDe(id_pagina);
  if (pags === 'all') return 'Todas las páginas';
  return pags
    .map(id => _navInfoDePlantilla(id))
    .filter(nav => nav.item)
    .map(nav => nav.titulo)
    .join(', ');
}

// badge de la pagina a la que pertenece el modulo
function _paginaBadgeHTML(id_pagina) {
  const esTodas = id_pagina === 'all';
  const label   = esTodas ? 'Todas las páginas' : (_paginaLabel(id_pagina) || 'Sin asignar');
  const none    = !esTodas && label === 'Sin asignar';
  const cls     = esTodas ? 'is-global' : (none ? 'is-none' : '');
  const icon    = esTodas ? 'fa-globe' : (none ? 'fa-circle-question' : 'fa-file-lines');
  return `<span class="mod-pertenece ${cls}" title="Página a la que pertenece este módulo"><i class="fa-solid ${icon}"></i> ${escAttr(label)}</span>`;
}

// coloca el badge de pagina en el header de la tarjeta de contenido o de campos
function _refreshPaginaBadges() {
  const isList = !!MOD_CONTENT_CONFIG[_curModType];
  const badge  = _paginaBadgeHTML(_curModData.id_pagina);
  const dataSlot    = document.getElementById('modulos-editor-data-pagina');
  const contentSlot = document.getElementById('modulos-content-pagina');
  if (dataSlot)    dataSlot.innerHTML    = isList ? '' : badge;
  if (contentSlot) contentSlot.innerHTML = isList ? badge : '';
}

// lista de checkboxes de paginas (multi-pagina); onChange recibe null | 'all' | [ids]
function _renderPaginaChecks(box, value, onChange) {
  const pags    = _paginasDe(value);
  const esTodas = pags === 'all';
  const ids     = esTodas ? [] : pags;
  // solo plantillas que son item real del navbar; las del sistema sin item o borradores no se listan
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
  // el editor de modulo es un modal (.modal-overlay), se abre/cierra con openModal/closeModal
  ['modulos-catalog-view','modulos-variants-view'].forEach(v => {
    const el = document.getElementById(v);
    if (el) el.style.display = v === id ? '' : 'none';
  });
}

// cierra el modal del editor y vuelve al catalogo
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

// coincidencia de busqueda: nombre, tipo, label, #id y pagina
function _modMatches(m, q) {
  if (!q) return true;
  const label = SECTIONS[m.tipo]?.label || m.tipo;
  const pag   = GLOBAL_TIPOS_MOD.has(m.tipo) || m.id_pagina === 'all'
    ? 'todas las páginas' : _paginaLabel(m.id_pagina);
  return `${m.nombre || ''} ${label} ${m.tipo} #${m.id_modulo} ${pag} ${_tipoAlias(m.tipo)}`
    .toLowerCase().includes(q);
}

// catalogo: una fila por tipo (el modulo principal); si hay varios prefiere uno en uso, menor id
function _principalDeTipo(mods) {
  const enUso = mods.filter(m => (_modUsos[m.id_modulo] || 0) > 0);
  const pool  = enUso.length ? enUso : mods;
  return pool.slice().sort((a, b) => a.id_modulo - b.id_modulo)[0];
}

// descripcion de la fila: primer campo de texto significativo del modulo
const _PREVIEW_FIELDS = ['titulo_seccion', 'titulo', 'titulo1', 'lead', 'descripcion', 'badge', 'eyebrow', 'formTitulo', 'loadingMessage'];
function _modPreview(m) {
  const d = m.data || {};
  for (const f of _PREVIEW_FIELDS) {
    const v = d[f];
    if (typeof v === 'string' && v.trim()) return v.replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  return '';
}

// familias: agrupan varios tipos bajo una fila del catalogo (ej hero); los demas son su propia familia
const MOD_FAMILIES = [
  { id: '__hero',   label: 'Hero',   tipos: ['hero', 'hero-centered', 'cableado-hero', 'fibra-hero', 'seguridad-hero', 'soporte-hero', 'desarrollo-hero'] },
  { id: '__footer', label: 'Footer', tipos: ['footer', 'footer-full'] },
  { id: '__header', label: 'Header', tipos: ['articulo-header', 'cliente-header'] },
];
const _famByTipo = {};
MOD_FAMILIES.forEach(f => f.tipos.forEach(t => { _famByTipo[t] = f; }));
const _familyOf   = tipo => _famByTipo[tipo] || null;

// tipos building-block siempre visibles aunque tengan 0 variantes (no se pierden al borrar la ultima)
const ALWAYS_VISIBLE_TIPOS = ['feature-grid', 'feature-item', 'faq-item', 'process-step-item'];

// alias de busqueda por tipo: terminos extra para encontrar un modulo (ej "preguntas frecuentes")
const MOD_SEARCH_ALIASES = {
  'feature-grid':      ['grilla', 'grilla de caracteristicas', 'contenedor'],
  'feature-item':      ['caracteristica', 'caracteristicas', 'grilla de caracteristicas'],
  'faq-item':          ['preguntas frecuentes', 'pregunta frecuente', 'faq'],
  'process-step-item': ['pasos del proceso', 'paso del proceso', 'pasos'],
};
const _tipoAlias = tipo => (MOD_SEARCH_ALIASES[tipo] || []).join(' ');
const _familyById = id   => MOD_FAMILIES.find(f => f.id === id) || null;

function renderModCatalog() {
  _showView('modulos-catalog-view');
  const grid = document.getElementById('modulos-grid');
  if (!grid) return;

  // recalcula el uso (plantillas distintas por modulo) en cada render; un modulo repetido cuenta 1
  _modUsos = {};
  (_plantillas || []).forEach(p => {
    new Set((p.id_modulos || []).filter(x => typeof x === 'number')).forEach(id => {
      _modUsos[id] = (_modUsos[id] || 0) + 1;
    });
  });

  // el catalogo lista tipos; las copias soloCard no son modulos de catalogo y se omiten
  const visibles = _mods.filter(m => !m.data?.soloCard);

  // agrupa por familia.id o por tipo; solo muestra los que tienen al menos un modulo
  const groups = new Map();   // key: { key, fam, label, tipos:Set, variants:[] }
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

  // building-block siempre presentes aunque tengan 0 variantes
  ALWAYS_VISIBLE_TIPOS.forEach(t => {
    if (!SECTIONS[t] || _familyOf(t)) return;
    const g = ensureGroup(t, null, SECTIONS[t]?.label || t);
    g.tipos.add(t);
  });

  let list = [...groups.values()];
  // orden estable por el menor id_modulo de sus variantes (los vacios al final)
  list.forEach(g => { g.minId = g.variants.length ? Math.min(...g.variants.map(v => v.id_modulo)) : Infinity; });
  list.sort((a, b) => a.minId - b.minId);

  if (!list.length) {
    grid.innerHTML = `<div class="mod-cat-empty">No hay módulos todavía. Tocá <b>Nuevo</b> para crear el primero.</div>`;
    return;
  }

  // busca por rotulo del tipo, alias o variantes (los alias encuentran tambien filas vacias)
  const q = _modQuery.trim().toLowerCase();
  if (q) list = list.filter(g =>
    g.label.toLowerCase().includes(q) ||
    [...g.tipos].some(t => _tipoAlias(t).toLowerCase().includes(q)) ||
    g.variants.some(m => _modMatches(m, q)));
  if (!list.length) {
    grid.innerHTML = `<div class="mod-cat-empty">Ningún módulo coincide con “${escAttr(_modQuery.trim())}”.</div>`;
    return;
  }

  const rows = list.map(g => {
    // building-block sin variantes: fila con accion "nuevo"
    if (!g.variants.length) {
      const tipo = [...g.tipos][0] || g.key;
      return `<div class="blog-item">
      <div class="blog-info">
        <div class="mod-row-headline">
          <span class="blog-title-text">${escAttr(g.label)}</span>
          <span class="mod-row-badge off">Sin módulos</span>
        </div>
        <div class="blog-meta">0 módulos · Tocá “Nuevo” para crear el primero</div>
      </div>
      <div class="blog-actions">
        <button type="button" class="btn-edit-small" data-mod-new="${escAttr(tipo)}">Nuevo</button>
      </div>
    </div>`;
    }
    const tiposArr = g.fam ? g.fam.tipos : [...g.tipos];
    const esGlobal = tiposArr.some(t => GLOBAL_TIPOS_MOD.has(t));
    const totalUsos = g.variants.reduce((s, m) => s + (_modUsos[m.id_modulo] || 0), 0);
    const enUso    = totalUsos > 0 || esGlobal;
    const nVar     = g.variants.length;
    const badge    = enUso
      ? `<span class="mod-row-badge on">En uso</span>`
      : `<span class="mod-row-badge off">Sin usar</span>`;
    // subtitulo: cantidad de variantes + uso (sin "pertenece", ahora se ve dentro de "lista")
    const variantesTxt = `${nVar} ${nVar === 1 ? 'módulo' : 'módulos'}`;
    const usoTxt = esGlobal ? 'Global · todo el sitio'
                 : enUso    ? `En uso en ${totalUsos} plantilla${totalUsos !== 1 ? 's' : ''}`
                            : 'Sin usar todavía';
    // "lista": familia o tipo suelto; "eliminar" borra el principal (si esta en uso, eliminarModulo lo impide)
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
  grid.querySelectorAll('[data-mod-new]').forEach(b => b.addEventListener('click', () => nuevaVarianteDeModulo(b.dataset.modNew, null)));
}

// tipos legacy que no deben crearse: su contenido va dentro de una grilla (faq-item, process-step-item)
const LEGACY_HIDDEN_TIPOS = new Set(['faq', 'process-steps']);

// tipos de seccion que todavia no tienen modulo (para el boton "nuevo")
function _tiposSinModulo() {
  const existentes = new Set(_mods.map(m => m.tipo));
  return Object.keys(SECTIONS).filter(t => !existentes.has(t) && !LEGACY_HIDDEN_TIPOS.has(t));
}

// llena los checkboxes de "paginas asignadas" del modal de nuevo modulo
function _fillNuevoPaginaSelect() {
  const box = document.getElementById('nm-pagina');
  if (!box) return;
  _renderPaginaChecks(box, null, () => {});
}

// lee las paginas marcadas en el modal de nuevo modulo: null | 'all' | [ids]
function _nmPaginaValue() {
  const box = document.getElementById('nm-pagina');
  if (!box) return null;
  if (box.querySelector('[data-pag="all"]')?.checked) return 'all';
  const ids = [...box.querySelectorAll('[data-pag]:checked')]
    .map(c => c.dataset.pag).filter(x => x !== 'all').map(Number);
  return ids.length ? ids : null;
}

// abre el modal "nuevo modulo": seccion + nombre + pagina asignada
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

// crea el modulo elegido en el modal y abre su editor
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

// carga un modulo del catalogo en los globales de edicion (_curMod*)
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

// editor de un modulo: va directo al preview visual; colores e items del navbar en el panel lateral
window.openModEditor = function(id) {
  const m = _mods.find(x => x.id_modulo === Number(id));
  if (!m) return;
  const sec = SECTIONS[m.tipo];
  if (!sec) { window.__svc.showNotif('Tipo de módulo desconocido: ' + m.tipo, 'error'); return; }
  _setCurMod(m);
  _previewFromCards = false;
  openPreviewModal();
};

// modulos blog/clientes: el contenido real vive en blog.json/clientes.json y aplica a todas las variantes
const MOD_CONTENT_CONFIG = {
  blog: {
    title: 'Artículos del blog',
    addLabel: '<i class="fa-solid fa-plus"></i> Nuevo artículo',
    bodyHTML: '<div class="blog-grid" id="blog-list"></div>',
    render: () => window.renderBlogList?.(),
    add:    () => window.openNewPost?.(),
  },
  // blog-list gestiona los mismos articulos que blog; sus campos propios son solo mensajes de estado
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

// modulos cuyos campos sueltos son tecnicos: se ocultan, la gestion va por la lista de contenido
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

// modal "ver modulo": solo la lista de contenido; "editar" abre el modal de edicion
function _closeModVer() {
  window.__svc?.closeModal('modulos-view-modal');
  const body = document.getElementById('modulos-view-body');
  if (body) body.innerHTML = '';
  _curVerFamilia = null;
}

// lapiz del modal ver: renombra el modulo desde el encabezado
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
    // cards "1 tarjeta = 1 modulo": "ver" lista cada tarjeta; "editar" abre una, "nuevo" crea un modulo de una sola
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

// lista plana de todas las tarjetas de los modulos de servicios (1 tarjeta = 1 modulo)
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
  body.innerHTML = `<div class="blog-grid">
  ${all.map(({ m, i, card }) => {
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

// elimina una tarjeta; si el modulo queda sin tarjetas y sin uso, se borra entero
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

// "nuevo" arma un borrador de modulo de servicios con una sola tarjeta; se persiste al guardar
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

// lista generica (formato blog) de los modulos de esa seccion; "editar" abre el editor del modulo
function _renderModVerLista(tipo) {
  const body = document.getElementById('modulos-view-body');
  if (!body) return;
  const mods = _mods.filter(x => x.tipo === tipo && !x.data?.soloCard).sort((a, b) => a.id_modulo - b.id_modulo);
  if (!mods.length) {
    // sin variantes: no cerramos (perdia el tipo); mostramos vacio, "nuevo" sigue disponible
    body.innerHTML = `<div class="mod-cat-empty">No quedan módulos de este tipo. Tocá <b>Nuevo</b> para crear uno.</div>`;
    return;
  }
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
    // las cards se editan tarjeta por tarjeta en el segundo modal; el resto abre el editor normal
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

// "lista" de una familia: lista todas las variantes de sus tipos en el mismo modal "ver"
// cada fila muestra a que item pertenece y permite editar o eliminar; "nuevo" elige el tipo a crear
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

// lista de variantes de una familia (todos sus tipos), con badge de pertenencia
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

// modulo "servicios": edicion in-place de cada tarjeta (icono, color, texto, enlace, detalle)
// los cambios se guardan con debounce (PUT /modulos/:id)
const _svcSaveTimers = {};
function _saveServiciosModulo(m, immediate) {
  // Borrador sin persistir (flujo "Nuevo"): los cambios viven en memoria y se
  // guardan recién al tocar "Guardar cambios". No hay PUT hasta entonces.
  if (m._isNew) return;
  clearTimeout(_svcSaveTimers[m.id_modulo]);
  const doSave = async () => {
    try {
      // persistimos id_pagina: el destino de la tarjeta define a que pagina pertenece el modulo
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
  return `
  <div class="svc-card-row" data-svc-i="${i}">
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

// lista de tarjetas (services/cards), encima de la lista de variantes
// "editar" abre el editor de una tarjeta y "nuevo" un modal chico
let _curCardsMod = null;     // módulo cuyas tarjetas se están listando (para "Nuevo")

function _closeModCards() {
  // al volver, refresca la lista de variantes del modal "ver" de atras (muestra los nuevos)
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

// acepta un id del catalogo o un objeto modulo (borrador del flujo "nuevo", m._isNew)
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
  // el footer "guardar cambios" solo aparece al crear un modulo nuevo
  if (footer)  footer.style.display = m._isNew ? '' : 'none';

  // titulo editable de la seccion (titulo_seccion por defecto) + override por pagina
  const tituloInp = document.getElementById('modulos-cards-titulo');
  if (tituloInp) {
    m.data = m.data || {};
    tituloInp.value = m.data.titulo_seccion || '';
    tituloInp.oninput = () => {
      m.data.titulo_seccion = tituloInp.value;
      _refreshTitulosPlaceholders(m);   // actualiza el placeholder "(por defecto)" de cada página
      if (!m._isNew) _saveServiciosModulo(m);
    };
  }
  _renderCardsTitulosPorPagina(m);

  _renderCardsPaginaSelect(m);
  _renderCardsLista(m);
  window.__svc?.openModal('modulos-cards-modal');
};

// plantillas que son items del navbar (para el editor de titulo por pagina)
function _plantillasNavbar() {
  const esItem = p => { const idm = (p.id_menu || [])[0]; return idm != null && _navbar.some(b => b.id_menu === idm); };
  return _plantillas.filter(esItem)
    .map(p => ({ id_plantilla: p.id_plantilla, ..._navInfoDePlantilla(p.id_plantilla) }))
    .sort((a, b) => a.orden - b.orden);
}

// editor de "titulo por pagina": un input por item; vacio usa titulo_seccion
// se guarda en m.data.titulos_por_pagina ({ id_plantilla: titulo })
function _renderCardsTitulosPorPagina(m) {
  const box = document.getElementById('modulos-cards-titulos-por-pagina');
  if (!box) return;
  m.data = m.data || {};
  const map = m.data.titulos_por_pagina = m.data.titulos_por_pagina || {};
  const def = m.data.titulo_seccion || '(título por defecto)';
  const items = _plantillasNavbar();
  box.innerHTML = items.map(it => `
    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;">
      <label style="flex:0 0 40%;font-size:.7rem;color:var(--slate-600);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escAttr(it.titulo)}${it.grupo ? ` <span class="mod-pag-grupo">${escAttr(it.grupo)}</span>` : ''}</label>
      <input class="form-input" data-tpp="${it.id_plantilla}" value="${escAttr(map[it.id_plantilla] || '')}" placeholder="${escAttr(def)}" style="flex:1;font-size:.78rem;">
    </div>`).join('') || '<div style="font-size:.7rem;color:#94a3b8;">No hay ítems del navbar.</div>';
  box.querySelectorAll('[data-tpp]').forEach(inp => inp.addEventListener('input', () => {
    const id = inp.dataset.tpp;
    const v = inp.value.trim();
    if (v) map[id] = v; else delete map[id];
    if (!m._isNew) _saveServiciosModulo(m);
  }));
}

// actualiza solo los placeholders sin pisar lo que el usuario tipea
function _refreshTitulosPlaceholders(m) {
  const box = document.getElementById('modulos-cards-titulos-por-pagina');
  if (!box) return;
  const def = m.data?.titulo_seccion || '(título por defecto)';
  box.querySelectorAll('[data-tpp]').forEach(inp => { inp.placeholder = def; });
}

// flujo "nuevo": borrador de modulo de servicios en memoria; se crea recien al "guardar cambios"
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

// "guardar cambios": para un borrador hace el POST que lo crea; un modulo existente ya se autoguarda
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

// preview del modulo de servicios; los globales _curMod* apuntan al modulo en edicion (misma ref)
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

// guardar desde el preview cuando viene del editor de tarjetas; un borrador no persiste, uno real hace PUT
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

// lista de items del navbar a los que pertenece el modulo de servicios; persiste con PUT /modulos/:id
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
    // borrador: solo en memoria; se persiste al "guardar cambios"
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

// lista de tarjetas en filas (formato de las variantes)
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

// editor de una sola tarjeta (icono, titulo, descripcion, enlace, detalle) con su propio "guardar"
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

// items del navbar a los que puede apuntar una tarjeta (botones activos con href)
function _navDestItems() {
  return (_navbar || [])
    .filter(b => b.activo !== false && b.href)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

// item del navbar cuyo href coincide
function _navItemByHref(href) {
  return href ? (_navbar || []).find(b => b.href === href) : null;
}

// id_pagina que corresponde a un href del navbar: [id_plantilla] o null si no mapea a una plantilla
function _idPaginaForNavHref(href) {
  const item = _navItemByHref(href);
  if (!item) return null;
  const plt = (_plantillas || []).find(p => (p.id_menu || []).includes(item.id_menu));
  return plt ? [plt.id_plantilla] : null;
}

// etiqueta del item al que apunta una tarjeta; '' si no apunta a ninguno
function _cardPerteneceLabel(card) {
  return _navItemByHref(card && card.enlace)?.titulo || '';
}

// etiqueta de "pertenece" de una tarjeta; usa card.id_pagina y cae al item del destino para datos viejos
function _cardPaginaLabel(card) {
  const pags = _paginasDe(card && card.id_pagina);
  if (pags === 'all') return 'Todas las páginas';
  if (pags.length) {
    return pags.map(id => _navInfoDePlantilla(id)).filter(n => n.item).map(n => n.titulo).join(', ');
  }
  return _cardPerteneceLabel(card);   // fallback: derivar del destino
}

// selector "¿a donde se dirige?": elige el item del navbar (card.enlace = href); incluye personalizado y sin enlace
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
  // en modulos de 1 tarjeta el destino define tambien la pertenencia (m.id_pagina); en multi-tarjeta es por tarjeta
  const syncPertenenciaModulo = href => {
    if ((m.data?.cards?.length || 0) <= 1) m.id_pagina = _idPaginaForNavHref(href);
  };
  box.querySelectorAll('[data-cn]').forEach(r => r.addEventListener('change', () => {
    const v = r.dataset.cn;
    if (v === '__custom__') {
      if (custom) { custom.style.display = ''; custom.focus(); }
      card.enlace = (custom?.value || '').trim();
      syncPertenenciaModulo(card.enlace);   // url libre: null
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

// selector "¿en que pagina(s) se muestra?" de una tarjeta (card.id_pagina); reusa la checklist de pertenencia
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
  // si la lista de tarjetas (modal "ver") quedo abierta detras, la refresca
  const verModal = document.getElementById('modulos-view-modal');
  if (verModal?.classList.contains('open')) _renderCardsFlatList();
}

async function _saveCardEditor() {
  if (!_curCardEdit) { _closeCardEditor(); return; }
  const { m } = _curCardEdit;
  if (m._isNew) {
    // nueva tarjeta: crea un modulo de servicios con esta unica tarjeta
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
    // un modulo existente ya se autoguarda; en modulos de 1 tarjeta sincronizamos el nombre con su titulo
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

// modal chico: agregar una tarjeta a la lista
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

// popover flotante anclado a un boton, sobre el body con z-index alto
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

// modal de detalle de tarjeta (titulo, descripcion, imagen); generico, recibe card y onSave
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

// selector de iconos global (promise); devuelve { icono, color } al aplicar o null al cancelar
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

// mini-overlay de texto (promise) para editar la url desde el preview
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

  // para tipos con gestion de contenido (blog/clientes) el aviso de campos complejos sobra; el resto apunta al preview
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

// editor de campos del modulo formulario (etiqueta, tipo, requerido) editando _curModData.data.campos en vivo
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

// modal de edicion visual en vivo: preview del modulo + lapiz por texto editable + panel de colores

// estilos inyectados dentro del iframe (aislados del panel admin)
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

// script inyectado dentro del iframe: lapiz por texto + cuadro flotante (editar palabra y color)
// recibe del padre __ft (tipos), __fd (valores), __fl (etiquetas), __fc (colores)
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

    // fila de color
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
  // durante la edicion los enlaces no deben navegar (romperian el preview)
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (a) e.preventDefault();
  }, true);
  // inserta un lapiz al lado de el que dispara handler
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
  // imagenes editables: el click avisa al padre para abrir el selector
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
  // icono editable: el lapiz abre el selector de iconos y color en el padre
  var icons = document.querySelectorAll('[data-iconfield]');
  for (var a = 0; a < icons.length; a++) {
    (function (el) {
      addPencil(el, '✎', 'Cambiar ícono y color', function () {
        try { parent.postMessage({ __edicon: true, field: el.getAttribute('data-iconfield') }, '*'); } catch (e) {}
      });
    })(icons[a]);
  }
  // url de destino del enlace: el lapiz edita la url
  var links = document.querySelectorAll('[data-linkfield]');
  for (var b = 0; b < links.length; b++) {
    (function (el) {
      addPencil(el, '↗', 'Editar la URL de destino', function () {
        try { parent.postMessage({ __edlink: true, field: el.getAttribute('data-linkfield') }, '*'); } catch (e) {}
      });
    })(links[b]);
  }
  // detalle del enlace: el lapiz abre el modal titulo/descr/imagen en el padre
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

// modulos que una grilla (feature-grid) inyecta por id, resueltos recursivo contra _mods
function _grillaInjectedFromMods(tipo, data, seen = new Set()) {
  if (tipo !== 'feature-grid' || !Array.isArray(data?.modulos)) return [];
  const out = [];
  data.modulos.forEach(id => {
    if (seen.has(id)) return;
    seen.add(id);
    const m = _mods.find(x => x.id_modulo === id);
    if (!m) return;
    out.push(m);
    out.push(..._grillaInjectedFromMods(m.tipo, m.data, seen));
  });
  return out;
}

function _moduleSrcdoc({ editable }) {
  const sec = SECTIONS[_curModType];
  if (!sec) return '';
  setModuleRegistry(_mods);   // para que una Grilla resuelva sus módulos por id
  if (editable) setEditMode(true);
  setFieldColors(_curModData.data?.__colores || {});   // colores por palabra
  const html = sec.render(_curModData.data || {}, _curModData.design || {});
  setFieldColors({});
  if (editable) setEditMode(false);   // se apaga inmediato: el sitio público nunca lo ve

  const pageType = TYPE_TO_PAGE[_curModType] || 'index';
  // si es grilla, suma el css de los modulos que inyecta, resueltos contra _mods
  const injected = _grillaInjectedFromMods(_curModType, _curModData.data);
  const cssFiles = injected.length
    ? cssFilesFor(pageType, injected)
    : (TIPO_CSS[pageType] || TIPO_CSS.index);
  const origin   = window.location.origin;
  const links    = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">\n' + cssFiles.map(f => `<link rel="stylesheet" href="${origin}${f}">`).join('\n');

  // mapas para el editor inline (solo campos de texto simples)
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

  // partimos los tags para que live server no inyecte su hot-reload en el literal
  const _B = 'bo'+'dy', _H = 'hea'+'d';
  return `<!doctype html><html lang="es"><${_H}><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Inter:ital,wght@0,400;0,500;0,700;0,900;1,700;1,900&display=swap" rel="stylesheet">${links}<style>html,body{margin:0;padding:0;}body{overflow-x:hidden;}</style>${editStyle}</${_H}><${_B}>${html}${editScript}</${_B}></html>`;
}

// preview en vivo (debounced): re-renderiza el iframe del modal si esta abierto
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

// cambia la pestaña activa del panel lateral del preview (settings | design)
function _switchPreviewTab(tab) {
  document.querySelectorAll('.mpm-side-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.mpmTab === tab));
  document.querySelectorAll('.mpm-side .mpm-tabpane').forEach(p =>
    p.classList.toggle('active', p.dataset.mpmPane === tab));
}

// pestaña "ajustes del modulo" del preview: nombre + items del navbar; los cambios se persisten al guardar
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

// abrir / cerrar el modal de edicion visual
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

  // pestaña "ajustes del modulo" (nombre + items del navbar)
  const hasSettings = _renderPreviewModuleSettings();

  // pestaña "contenido" (solo grilla): modulos inyectados por id
  const hasContent = _renderPreviewGrillaContent();

  // pestaña "colores y diseño" (reusa el render de campos, live-sync)
  renderModFieldGroup('design', sec.designFields || [], 'mpm-design-fields');
  const hasDesign = !!(sec.designFields || []).length;
  const designTabBtn = document.getElementById('mpm-tab-btn-design');
  if (designTabBtn) designTabBtn.style.display = hasDesign ? '' : 'none';

  // pestaña inicial: "ajustes" si esta disponible, si no "contenido"/"colores"
  _switchPreviewTab(hasSettings ? 'settings' : hasContent ? 'content' : 'design');

  iframe.srcdoc = _moduleSrcdoc({ editable: true });
  modal.style.display = '';
  document.body.style.overflow = 'hidden';
}
function closePreviewModal() {
  const modal = document.getElementById('mod-preview-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
  // si el preview venia del editor de tarjetas, refresca esa lista y limpia el flag
  if (_previewFromCards) {
    _previewFromCards = false;
    if (_curCardsMod) _renderCardsLista(_curCardsMod);
  }
}

// pestaña "contenido" del preview (solo grilla): edita los modulos inyectados (data.modulos)
let _grillaSearchQuery = '';
function _renderPreviewGrillaContent() {
  const tabBtn = document.getElementById('mpm-tab-btn-content');
  const pane   = document.getElementById('mpm-content-fields');
  const isGrilla = _curModType === 'feature-grid';
  if (tabBtn) tabBtn.style.display = isGrilla ? '' : 'none';
  if (!isGrilla) { if (pane) pane.innerHTML = ''; return false; }
  if (!pane) return false;

  _curModData.data = _curModData.data || {};
  const ids = Array.isArray(_curModData.data.modulos)
    ? _curModData.data.modulos
    : (_curModData.data.modulos = []);

  const info = id => {
    const m = _mods.find(x => x.id_modulo === id);
    return m
      ? { name: m.nombre || '(sin nombre)', sub: `${SECTIONS[m.tipo]?.label || m.tipo} · #${id}`, missing: false }
      : { name: `#${id}`, sub: 'no está en el catálogo', missing: true };
  };

  const slotsHtml = ids.length
    ? ids.map((id, i) => {
        const { name, sub, missing } = info(id);
        return `<div class="grilla-slot${missing ? ' is-missing' : ''}">
          <div class="grilla-slot-info">
            <span class="grilla-slot-name">${escAttr(name)}</span>
            <span class="grilla-slot-sub">${escAttr(sub)}</span>
          </div>
          <div class="grilla-slot-actions">
            <button type="button" data-g-up="${i}" title="Subir" ${i === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
            <button type="button" data-g-down="${i}" title="Bajar" ${i === ids.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
            <button type="button" data-g-del="${i}" title="Quitar"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`;
      }).join('')
    : `<div class="grilla-empty">Todavía no inyectaste ningún módulo. Buscá uno abajo para agregarlo.</div>`;

  pane.innerHTML = `
    <div class="mf-row">
      <label class="mf-label">Módulos inyectados</label>
      <div class="grilla-slots">${slotsHtml}</div>
    </div>
    <div class="mf-row">
      <label class="mf-label">Insertar módulo</label>
      <input type="text" class="form-input mf-input" id="grilla-search" placeholder="Buscar módulo (nombre o tipo)…" autocomplete="off" value="${escAttr(_grillaSearchQuery)}">
      <div class="grilla-results" id="grilla-results"></div>
    </div>`;

  const rebuild = () => { _renderPreviewGrillaContent(); _rerenderPreviewIframe(); };
  pane.querySelectorAll('[data-g-del]').forEach(b => b.addEventListener('click', () => { ids.splice(Number(b.dataset.gDel), 1); rebuild(); }));
  pane.querySelectorAll('[data-g-up]').forEach(b => b.addEventListener('click', () => {
    const i = Number(b.dataset.gUp); if (i <= 0) return;
    [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; rebuild();
  }));
  pane.querySelectorAll('[data-g-down]').forEach(b => b.addEventListener('click', () => {
    const i = Number(b.dataset.gDown); if (i >= ids.length - 1) return;
    [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]]; rebuild();
  }));

  const input   = pane.querySelector('#grilla-search');
  const results = pane.querySelector('#grilla-results');
  const renderResults = () => {
    const q = _grillaSearchQuery.trim().toLowerCase();
    if (!q) { results.innerHTML = ''; return; }
    const matches = _mods.filter(m =>
      m.id_modulo !== _curModId &&
      !m.data?.soloCard &&
      `${m.nombre} ${m.tipo} ${SECTIONS[m.tipo]?.label || ''} ${_tipoAlias(m.tipo)}`.toLowerCase().includes(q)
    ).slice(0, 30);
    if (!matches.length) { results.innerHTML = `<div class="grilla-empty">Sin resultados.</div>`; return; }

    // agrupa por tipo: 2+ coincidencias del mismo tipo dan un solo resultado (agrega todas); 1 sola, individual
    const byTipo = new Map();
    matches.forEach(m => { if (!byTipo.has(m.tipo)) byTipo.set(m.tipo, []); byTipo.get(m.tipo).push(m); });
    const grouped = new Set(); // ids cubiertos por un resultado de tipo
    let html = '';
    byTipo.forEach((mods, tipo) => {
      if (mods.length < 2) return;
      const newIds = mods.map(m => m.id_modulo).filter(id => !ids.includes(id));
      if (!newIds.length) return;
      mods.forEach(m => grouped.add(m.id_modulo));
      const label = SECTIONS[tipo]?.label || tipo;
      html += `<div class="grilla-result" data-g-addtype="${escAttr(JSON.stringify(newIds))}">
        <span class="grilla-slot-name">${escAttr(label)}</span>
        <span class="grilla-slot-sub">${escAttr(label)} · ${mods.length} módulos</span>
      </div>`;
    });
    // tipos con una sola coincidencia van individuales
    matches.forEach(m => {
      if (grouped.has(m.id_modulo)) return;
      html += `<div class="grilla-result" data-g-add="${m.id_modulo}">
        <span class="grilla-slot-name">${escAttr(m.nombre || '(sin nombre)')}</span>
        <span class="grilla-slot-sub">${escAttr(SECTIONS[m.tipo]?.label || m.tipo)} · #${m.id_modulo}</span>
      </div>`;
    });
    results.innerHTML = html || `<div class="grilla-empty">Sin resultados.</div>`;

    results.querySelectorAll('[data-g-addtype]').forEach(el => el.addEventListener('click', () => {
      JSON.parse(el.dataset.gAddtype).forEach(id => ids.push(id));
      _grillaSearchQuery = '';
      rebuild();
    }));
    results.querySelectorAll('[data-g-add]').forEach(el => el.addEventListener('click', () => {
      ids.push(Number(el.dataset.gAdd));
      _grillaSearchQuery = '';
      rebuild();
    }));
  };
  input?.addEventListener('input', () => { _grillaSearchQuery = input.value; renderResults(); });
  renderResults();
  return true;
}

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

// "nuevo" del modal ver: agrega otra variante del mismo tipo, hereda la pagina y abre su editor
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
    // las cards se editan en el segundo modal (tarjeta por tarjeta); el resto en el editor de campos
    if (tipo === 'services') {
      // refresca la lista de variantes del modal "ver" para que aparezca el nuevo
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

// guarda el modulo en edicion (lo usan el editor y el modal)
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
    // si la lista de variantes del modal "ver" quedo abierta detras, la refresca
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

// buscador del catalogo de modulos
document.getElementById('modulos-search')?.addEventListener('input', e => {
  _modQuery = e.target.value || '';
  renderModCatalog();
});

// boton "nuevo" del catalogo + modal de creacion
document.getElementById('modulos-nuevo-btn')?.addEventListener('click', () => window.openNuevoModulo());
document.getElementById('nm-crear-btn')?.addEventListener('click', crearModuloDesdeModal);

// boton: abrir el modal de edicion visual (preview)
document.getElementById('modulos-preview-btn')?.addEventListener('click', () => {
  _previewFromCards = false;
  openPreviewModal();
});

// pestañas del panel lateral (ajustes / colores y diseño)
document.querySelectorAll('.mpm-side-tab').forEach(btn =>
  btn.addEventListener('click', () => _switchPreviewTab(btn.dataset.mpmTab)));

// modal: cerrar
document.getElementById('mpm-close')?.addEventListener('click', closePreviewModal);
document.getElementById('mpm-backdrop')?.addEventListener('click', closePreviewModal);
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const modal = document.getElementById('mod-preview-modal');
  if (modal && modal.style.display !== 'none') closePreviewModal();
});

// modal: guardar (deja el modal abierto); guarda el modulo de tarjetas o el del editor segun de donde se abrio
document.getElementById('mpm-save')?.addEventListener('click', () => {
  if (_previewFromCards) _saveCardsFromPreview();
  else saveCurrentModule();
  closePreviewModal();
});

// asigna un valor por path con puntos/indices (ej "cards.0.titulo")
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

// lee un valor por path con puntos/indices (ej "cards.0.titulo")
function _getByPath(obj, path) {
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// re-renderiza el iframe del preview (refleja cambios en _curModData)
function _rerenderPreviewIframe() {
  const iframe = document.getElementById('mpm-iframe');
  if (iframe) iframe.srcdoc = _moduleSrcdoc({ editable: true });
}

// ediciones inline (texto, color, imagenes) que llegan del iframe
window.addEventListener('message', async e => {
  const d = e.data;
  if (!d || !d.field) return;
  // cambio de imagen desde el preview: abre el selector y re-renderiza
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
  // cambio de icono desde el preview: campo plano (string fa-*) directo; tarjeta usa .icono/.iconoColor
  if (d.__edicon === true) {
    _curModData.data = _curModData.data || {};
    const target = _getByPath(_curModData.data, d.field);
    if (typeof target === 'string' || target == null) {
      const cur = typeof target === 'string' && target.startsWith('fa-') ? target : '';
      const picked = await window.__iconPicker?.open({ current: cur, color: '' });
      if (picked && picked.icono) { _setByPath(_curModData.data, d.field, picked.icono); _rerenderPreviewIframe(); }
      return;
    }
    const picked = await window.__iconPicker?.open({ current: serviceCardIcon(target), color: target.iconoColor || '' });
    if (picked && picked.icono) {
      _setByPath(_curModData.data, d.field + '.icono', picked.icono);
      _setByPath(_curModData.data, d.field + '.iconoColor', picked.color || '');
      _rerenderPreviewIframe();
    }
    return;
  }
  // cambio de la url de destino del enlace de una tarjeta desde el preview
  if (d.__edlink === true) {
    _curModData.data = _curModData.data || {};
    const current = _getByPath(_curModData.data, d.field) || '';
    const url = await _promptOverlay({ label: 'URL de destino de “Ver Detalles”', value: current, placeholder: '/html/… o https://…' });
    if (url !== null) { _setByPath(_curModData.data, d.field, url.trim()); _rerenderPreviewIframe(); }
    return;
  }
  // editar el detalle (titulo/descr/imagen) de una tarjeta desde el preview
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

// boton: volver al catalogo / cancelar
document.getElementById('modulos-variants-back-btn')?.addEventListener('click', renderModCatalog);
document.getElementById('modulos-back-btn')?.addEventListener('click', _closeModEditor);
document.getElementById('modulos-cancel-btn')?.addEventListener('click', _closeModEditor);

// boton: guardar modulo (editor)
document.getElementById('modulos-save-btn')?.addEventListener('click', async () => {
  const ok = await saveCurrentModule();
  if (ok) _closeModEditor();
});
