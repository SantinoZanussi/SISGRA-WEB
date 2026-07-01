// renderiza la plantilla activa de un tipo en #root y conecta la funcionalidad comun
import { resolverModulos, renderModulosAgrupados, setModuleRegistry } from './sections.js';
import { cssFilesFor } from './css-pages.js';

const API_BASE = '/api';

// carga font awesome una sola vez si no está presente
const FONT_AWESOME_HREF = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
function ensureFontAwesome() {
  if (document.querySelector('link[data-fa]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = FONT_AWESOME_HREF;
  l.setAttribute('data-fa', '1');
  l.crossOrigin = 'anonymous';
  l.referrerPolicy = 'no-referrer';
  document.head.appendChild(l);
}

// inyecta los <link> de css que falten para los módulos de la plantilla (mismo cssFilesFor que el editor)
function ensurePageCss(tipo, mods) {
  const have = new Set(
    Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.getAttribute('href'))
  );
  cssFilesFor(tipo, mods || []).forEach(href => {
    if (have.has(href)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  });
}

// arma los items del nav desde navbar.json (jerárquico padre/hijos): desplegables + links sueltos
// omite el item home (href "/") porque el logo ya enlaza al inicio
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

// módulos que las grillas inyectan por id, resueltos recursivamente (grilla dentro de grilla)
// solo para sumar su css; el render los resuelve vía el registro
function expandGrillaInjected(secciones, modulos, seen = new Set()) {
  const out = [];
  (secciones || []).forEach(sec => {
    if ((sec.tipo || sec.type) !== 'feature-grid') return;
    const ids = Array.isArray(sec.data?.modulos) ? sec.data.modulos : [];
    ids.forEach(id => {
      if (seen.has(id)) return;
      seen.add(id);
      const m = (modulos || []).find(x => x.id_modulo === id);
      if (!m) return;
      out.push(m);
      out.push(...expandGrillaInjected([m], modulos, seen));   // anidadas
    });
  });
  return out;
}

// ¿la tarjeta se muestra en esta plantilla? lee card.id_pagina (null|'all'|id|[ids])
// "todas" o sin asignar: siempre
function cardEnPlantilla(card, plantillaId) {
  const p = card && card.id_pagina;
  if (p === 'all' || p == null || p === '') return true;
  const ids = (Array.isArray(p) ? p : [p]).map(Number).filter(n => !isNaN(n));
  return ids.length ? ids.includes(Number(plantillaId)) : true;
}

export async function bootstrapPage(tipo, rootId = 'plantilla-root', opts = {}) {
  const root = document.getElementById(rootId);
  if (!root) {
    console.error(`[bootstrap] No se encontró #${rootId}`);
    return;
  }
  ensureFontAwesome();

  async function loadAndRender() {
  try {
    // cache:'no-store' + ?t= fuerza fetch fresco; sin esto el browser cachea la plantilla
    const bust = `t=${Date.now()}`;
    const [r, modR, navR] = await Promise.all([
      fetch(`${API_BASE}/plantillas/activa/${tipo}?${bust}`, { cache: 'no-store' }),
      fetch(`${API_BASE}/data/modulos?${bust}`,              { cache: 'no-store' }),
      fetch(`${API_BASE}/data/navbar?${bust}`,               { cache: 'no-store' }),
    ]);
    if (!r.ok) {
      root.innerHTML = `<div style="padding:6rem 2rem;text-align:center;color:#94a3b8;font-family:'Inter',system-ui,sans-serif;">
        Esta página aún no tiene una plantilla activa.<br/>
        <small style="display:block;margin-top:.5rem;font-size:.75rem;">Andá al panel admin y activá una para "${tipo}".</small>
      </div>`;
      return;
    }
    const { plantilla } = await r.json();
    const modulos = modR.ok ? (await modR.json()).modulos  || [] : [];
    const navbar  = navR.ok ? (await navR.json()).botones  || [] : [];

    // resuelve los módulos por id_modulos (clonados) e inyecta los items del nav
    // el alias .type es para que la inyección dinámica de abajo siga funcionando
    let secciones = resolverModulos(plantilla, modulos);
    secciones.forEach(m => {
      m.type = m.tipo;
      if (m.tipo === 'nav') m.data = { ...m.data, items: buildNavItems(navbar) };
    });

    // cliente.html: si viene clienteId, inyecta los datos del cliente
    if (opts.clienteId) {
      try {
        const cr = await fetch(`${API_BASE}/data/clientes?t=${Date.now()}`, { cache: 'no-store' });
        if (cr.ok) {
          const clientesData = await cr.json();
          const cliente = (clientesData.clientes || []).find(c => c.id === opts.clienteId);
          if (!cliente || cliente.estado_perfil !== 'publicado') {
            window.location.replace('/index.html');
            return;
          }
          if (cliente.nombre) document.title = `${cliente.nombre} — SISGRA`;
          secciones = secciones.map(sec => {
            if (sec.type === 'cliente-header') {
              return { ...sec, data: {
                ...sec.data,
                backLabel: '← Volver al Inicio',
                backHref:  '/index.html',
                empresaLogo:   cliente.imagen          || sec.data.empresaLogo,
                empresaNombre: cliente.nombre          || sec.data.empresaNombre,
                titulo:        cliente.titulo_proyecto || cliente.nombre || sec.data.titulo,
                lead:          cliente.subtitulo       || sec.data.lead,
                sector:        cliente.sector          || sec.data.sector || '',
                ubicacion:     cliente.ubicacion       || sec.data.ubicacion || '',
                anio:          cliente.anio            || sec.data.anio || '',
              }};
            }
            if (sec.type === 'cliente-body') {
              return { ...sec, data: {
                ...sec.data,
                featuredImageUrl: cliente.imagen_destacada || '',
                featuredImageAlt: cliente.nombre || '',
                contentHtml:      cliente.contenido || sec.data.contentHtml,
                empresa:          cliente.nombre    || sec.data.empresa,
                sector:           cliente.sector    || sec.data.sector || '',
                ubicacion:        cliente.ubicacion || sec.data.ubicacion || '',
                anio:             cliente.anio      || sec.data.anio || '',
              }};
            }
            // compat: plantillas viejas que aún usan articulo-header/body
            if (sec.type === 'articulo-header') {
              return { ...sec, data: {
                ...sec.data,
                backLabel: '← Volver al Inicio',
                backHref:  '/index.html',
                badge:  cliente.nombre          || sec.data.badge,
                titulo: cliente.titulo_proyecto || cliente.nombre || sec.data.titulo,
                lead:   cliente.subtitulo       || sec.data.lead,
                fecha:  '',
              }};
            }
            if (sec.type === 'articulo-body') {
              return { ...sec, data: {
                ...sec.data,
                featuredImageUrl: cliente.imagen_destacada || '',
                featuredImageAlt: cliente.nombre || '',
                contentHtml:      cliente.contenido || sec.data.contentHtml,
              }};
            }
            return sec;
          });
        }
      } catch (e) {
        console.warn('[bootstrap] No se pudo cargar el cliente:', e.message);
      }
    }

    // articulo.html: el detalle se muestra con ?id=. sin post válido redirige al blog
    // (en vez de renderizar el placeholder de la plantilla vacía)
    if (tipo === 'articulo' && !opts.clienteId) {
      const postId = new URLSearchParams(window.location.search).get('id');
      if (!postId) { window.location.replace('/html/blog'); return; }

      // detecta el origen para el botón "volver" (la ruta del blog es /html/blog)
      const fromBlog = document.referrer.includes('/html/blog');
      const backLabel = fromBlog ? '← Volver al Blog'   : '← Volver al Inicio';
      const backHref  = fromBlog ? '/html/blog'         : '/index.html';
      try {
        const br = await fetch(`${API_BASE}/data/blog?t=${Date.now()}`, { cache: 'no-store' });
        if (br.ok) {
          const blogData = await br.json();
          const post = (blogData.posts || []).find(p => p.id === postId);
          // post inexistente (link viejo/borrado): al blog, nunca al placeholder
          if (!post) { window.location.replace('/html/blog'); return; }
          if (post.titulo) document.title = `${post.titulo} — SISGRA`;
          secciones = secciones.map(sec => {
            if (sec.type === 'articulo-header') {
              return { ...sec, data: {
                ...sec.data,
                backLabel,
                backHref,
                badge:  post.categoria || sec.data.badge,
                titulo: post.titulo    || sec.data.titulo,
                lead:   post.extracto  || sec.data.lead,
                fecha:  post.fecha     || '',
              }};
            }
            if (sec.type === 'articulo-body') {
              return { ...sec, data: {
                ...sec.data,
                featuredImageUrl: post.imagen || '',
                featuredImageAlt: post.titulo || '',
                contentHtml:      post.contenido || sec.data.contentHtml,
              }};
            }
            return sec;
          });
        }
      } catch (e) {
        console.warn('[bootstrap] No se pudo cargar el post:', e.message);
      }
    }

    // filtra las cards de cada módulo services por la página actual (card.id_pagina)
    // si el módulo tenía cards y ninguna es de esta página, no se renderiza
    secciones = secciones.flatMap(sec => {
      if (sec.type !== 'services') return [sec];
      // título por página si existe; si no, el titulo_seccion por defecto
      const tpp    = sec.data?.titulos_por_pagina || {};
      const titulo = tpp[plantilla.id_plantilla] || sec.data?.titulo_seccion;
      if (!Array.isArray(sec.data?.cards)) return [{ ...sec, data: { ...sec.data, titulo_seccion: titulo } }];
      const orig  = sec.data.cards;
      const cards = orig.filter(c => cardEnPlantilla(c, plantilla.id_plantilla));
      if (orig.length && !cards.length) return [];
      return [{ ...sec, data: { ...sec.data, cards, titulo_seccion: titulo } }];
    });

    // filtra los módulos inyectados en grillas por su id_pagina (no mostrar en otra página)
    secciones = secciones.map(sec => {
      if ((sec.tipo || sec.type) !== 'feature-grid') return sec;
      const ids = Array.isArray(sec.data?.modulos) ? sec.data.modulos : [];
      if (!ids.length) return sec;
      const allowed = ids.filter(id => {
        const m = modulos.find(x => x.id_modulo === id);
        return !m || cardEnPlantilla(m, plantilla.id_plantilla);
      });
      if (allowed.length === ids.length) return sec;
      return { ...sec, data: { ...sec.data, modulos: allowed } };
    });

    // suma el css de los módulos inline de los contenedores (cards sueltas, no están en secciones)
    const inlineMods = (plantilla.contenedores || [])
      .flat().filter(x => x && typeof x === 'object' && x.inline);
    // y el css de los módulos que las grillas inyectan por id (resuelto recursivo)
    const grillaInjected = expandGrillaInjected(secciones, modulos);
    // el registro permite que una grilla resuelva sus módulos por id;
    // a las cards (services) les filtra las tarjetas por la página, igual que el render directo
    const modulosReg = modulos.map(m => (m.tipo === 'services' && Array.isArray(m.data?.cards))
      ? { ...m, data: { ...m.data, cards: m.data.cards.filter(c => cardEnPlantilla(c, plantilla.id_plantilla)) } }
      : m);
    setModuleRegistry(modulosReg);
    ensurePageCss(tipo, secciones.concat(inlineMods, grillaInjected));
    root.innerHTML = renderModulosAgrupados(secciones, plantilla.contenedores);
    // post-render: reconecta la funcionalidad que vivía en el html estático
    bindMobileDrawer();
    bindContactForm();
    bindFormularioModules(tipo);
    bindNavContacto(tipo);
    bindServiciosDetalle();
    applyGlobalContactoSEO(tipo);
    hydrateBlogList();
    hydrateBlogCards();
    hydrateClientesTrack();
    hydrateFaqItems();
  } catch (e) {
    root.innerHTML = `<div style="padding:4rem;text-align:center;color:#900;font-family:sans-serif;">
      Error cargando la plantilla: ${e.message}
    </div>`;
  }
  }

  await loadAndRender();

  // re-render al re-enfocar la pestaña: refleja cambios del admin sin recargar
  // (evita la pantalla en blanco del live-reload al recargar pestañas en segundo plano)
  if (!window.__sisgraVisBound) {
    window.__sisgraVisBound = true;
    let lastRender = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRender < 1200) return;
      // no re-renderizar si el usuario está escribiendo en un formulario
      const ae = document.activeElement;
      if (root.contains(ae) && /^(INPUT|TEXTAREA)$/.test(ae.tagName || '')) return;
      if ([...root.querySelectorAll('input,textarea')].some(el => el.value && el.value.trim())) return;
      lastRender = Date.now();
      loadAndRender();
    });
  }
}

function bindMobileDrawer() {
  const toggle = document.querySelector('.nav-mobile-toggle');
  const drawer = document.querySelector('.nav-mobile-drawer');
  if (!toggle || !drawer) return;
  toggle.addEventListener('click', () => {
    const isOpen = drawer.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
  drawer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      drawer.classList.remove('open');
      toggle.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// form del footer: abre gmail con la consulta
let _contactoData = {};
function bindContactForm() {
  const submit = document.querySelector('.btn-submit');
  if (!submit) return;
  submit.addEventListener('click', () => {
    const get = id => document.getElementById(id)?.value || '';
    const nombre = get('f-nombre'), empresa = get('f-empresa'),
          telefono = get('f-telefono'), email = get('f-email'),
          mensaje = get('f-mensaje');
    const required = { 'f-nombre': nombre, 'f-empresa': empresa, 'f-telefono': telefono, 'f-email': email };
    let hayError = false;
    Object.entries(required).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (!val.trim()) { el?.classList.add('error'); hayError = true; }
      else el?.classList.remove('error');
    });
    if (hayError) return;
    const destino = _contactoData.email_destino || 'info@sisgra.com.ar';
    const asunto = _contactoData.asunto_defecto || 'Consulta desde el sitio web';
    const body = `Datos del usuario:\nNombre: ${nombre} | Tel: ${telefono} | Email: ${email} | Empresa: ${empresa}\n\n${mensaje}`;
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(destino)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(body)}`,
      '_blank'
    );
    const msg = document.getElementById('successMsg');
    if (msg) msg.style.display = 'flex';
  });
}

// módulo formulario: postea los campos a la api (se guardan en contactos_log.json como "pendiente")
function bindFormularioModules(tipo) {
  document.querySelectorAll('form[data-form-modulo]').forEach(form => {
    if (form.dataset.fmBound) return;
    form.dataset.fmBound = '1';
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const campos = {};
      form.querySelectorAll('input[name],textarea[name]').forEach(el => {
        campos[el.dataset.etiqueta || el.name] = el.value;
      });
      const ok  = form.querySelector('[data-form-ok]');
      const err = form.querySelector('[data-form-err]');
      if (ok)  ok.style.display  = 'none';
      if (err) err.style.display = 'none';
      try {
        const r = await fetch(`${API_BASE}/contactos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campos, pagina: tipo || window.location.pathname }),
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        form.reset();
        if (ok) ok.style.display = '';
      } catch (_) {
        if (err) err.style.display = '';
      }
    });
  });
}

// cta "contáctese" del navbar: si href es #contacto abre un modal en vez de navegar
// el formulario es configurable (primer módulo 'formulario' del catálogo); los envíos van a POST /api/contactos
let _contactoModalPromise = null;
function bindNavContacto(tipo) {
  const triggers = Array.from(document.querySelectorAll('a.btn-contact, a.nav-mobile-cta'))
    .filter(a => (a.getAttribute('href') || '').trim() === '#contacto');
  if (!triggers.length) return;

  // prefetch del modal para que esté listo al click
  _contactoModalPromise = _contactoModalPromise || buildContactoModal(tipo);
  triggers.forEach(a => a.addEventListener('click', async e => {
    e.preventDefault();
    const modal = await _contactoModalPromise;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }));
}

// config del form de contacto: el primer módulo 'formulario' del catálogo, o campos por defecto
async function fetchContactoFormConfig() {
  const fallback = {
    titulo: 'Contáctese',
    descripcion: 'Complete el formulario y un asesor se comunicará a la brevedad.',
    btn: 'Enviar consulta',
    successMsg: '✓ Recibimos su consulta. Le responderemos a la brevedad.',
    campos: [
      { etiqueta: 'Nombre',   tipo: 'text',     requerido: true },
      { etiqueta: 'Empresa',  tipo: 'text',     requerido: true },
      { etiqueta: 'Email',    tipo: 'email',    requerido: true },
      { etiqueta: 'Teléfono', tipo: 'tel',      requerido: true },
      { etiqueta: 'Mensaje',  tipo: 'textarea', requerido: true },
    ],
  };
  try {
    const r = await fetch(`${API_BASE}/modulos`, { cache: 'no-store' });
    if (!r.ok) throw 0;
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data.modulos || []);
    const mod = list.find(m => m.tipo === 'formulario');
    if (mod && mod.data && Array.isArray(mod.data.campos) && mod.data.campos.length) {
      return { ...fallback, ...mod.data };
    }
  } catch (_) { /* sin API/módulo: fallback */ }
  return fallback;
}

// crea una vez el modal de contacto; estilos inline porque el sitio público no carga el css del admin
async function buildContactoModal(tipo) {
  const cfg = await fetchContactoFormConfig();
  const inputStyle = 'width:100%;box-sizing:border-box;padding:.7rem .85rem;border:1px solid #cbd5e1;border-radius:6px;font-family:inherit;font-size:.9rem;color:#0f172a;background:#fff;outline:none;';
  const labelStyle = 'display:block;font-size:.72rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#334155;margin-bottom:.35rem;';
  const slug = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'campo';
  const camposHtml = (cfg.campos || []).map((c, i) => {
    const name = slug(c.etiqueta) || `campo_${i}`;
    const req  = c.requerido ? ' required' : '';
    const star = c.requerido ? ' <span style="color:#ef4444;">*</span>' : '';
    const input = c.tipo === 'textarea'
      ? `<textarea name="${name}" data-etiqueta="${esc(c.etiqueta)}" rows="4" style="${inputStyle}resize:vertical;"${req}></textarea>`
      : `<input name="${name}" data-etiqueta="${esc(c.etiqueta)}" type="${esc(c.tipo || 'text')}" style="${inputStyle}"${req}>`;
    return `<div style="margin-bottom:1rem;"><label style="${labelStyle}">${esc(c.etiqueta)}${star}</label>${input}</div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'nav-contacto-modal';
  modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(10,29,55,.7);padding:1rem;font-family:'Inter',system-ui,sans-serif;";
  modal.innerHTML = `
    <div role="dialog" aria-modal="true" style="background:#fff;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;border-radius:12px;box-shadow:0 25px 60px rgba(0,0,0,.35);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid #e2e8f0;">
        <h3 style="margin:0;font-size:1.15rem;font-weight:900;color:#0A1D37;letter-spacing:-.02em;">${esc(cfg.titulo || 'Contáctese')}</h3>
        <button type="button" data-contacto-close aria-label="Cerrar" style="border:none;background:none;font-size:1.6rem;line-height:1;color:#94a3b8;cursor:pointer;">&times;</button>
      </div>
      <form data-contacto-form style="padding:1.5rem;">
        <p style="margin:0 0 1.25rem;color:#475569;font-size:.9rem;line-height:1.5;">${esc(cfg.descripcion || '')}</p>
        ${camposHtml}
        <button type="submit" style="width:100%;background:#2563eb;color:#fff;border:none;cursor:pointer;padding:.85rem 1.5rem;font-size:.72rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;border-radius:6px;font-family:inherit;">${esc(cfg.btn || 'Enviar consulta')}</button>
        <div data-contacto-ok style="display:none;margin-top:1rem;padding:.75rem 1rem;background:#dcfce7;color:#166534;border-radius:6px;font-size:.875rem;">${esc(cfg.successMsg || '✓ Recibimos su consulta.')}</div>
        <div data-contacto-err style="display:none;margin-top:1rem;padding:.75rem 1rem;background:#fee2e2;color:#991b1b;border-radius:6px;font-size:.875rem;">No se pudo enviar el formulario. Intentá de nuevo en unos minutos.</div>
      </form>
    </div>`;
  document.body.appendChild(modal);

  const close = () => { modal.style.display = 'none'; document.body.style.overflow = ''; };
  modal.querySelector('[data-contacto-close]').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.style.display === 'flex') close(); });

  const form = modal.querySelector('[data-contacto-form]');
  const ok   = modal.querySelector('[data-contacto-ok]');
  const err  = modal.querySelector('[data-contacto-err]');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const campos = {};
    form.querySelectorAll('input[name],textarea[name]').forEach(el => {
      campos[el.dataset.etiqueta || el.name] = el.value;
    });
    ok.style.display = 'none';
    err.style.display = 'none';
    try {
      const r = await fetch(`${API_BASE}/contactos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campos, pagina: tipo || window.location.pathname, formulario: 'navbar' }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      form.reset();
      ok.style.display = '';
    } catch (_) {
      err.style.display = '';
    }
  });

  return modal;
}

// cada card de servicios con detalle (título/descripción/imagen) lleva data-svc-detalle
// click en "ver detalles" abre un popup; sin detalle, el enlace navega normal
function bindServiciosDetalle() {
  const links = document.querySelectorAll('.services-section a.card-link[data-svc-detalle]');
  links.forEach(a => {
    a.addEventListener('click', e => {
      let d;
      try { d = JSON.parse(a.getAttribute('data-svc-detalle')); } catch (_) { return; }
      if (!d || !(d.titulo || d.descripcion || d.imagen)) return;
      e.preventDefault();
      openServiciosDetalle(d);
    });
  });
}

let _svcDetalleModal = null;
function ensureServiciosDetalleModal() {
  if (_svcDetalleModal) return _svcDetalleModal;
  const modal = document.createElement('div');
  modal.id = 'svc-detalle-modal';
  modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(10,29,55,.7);padding:1rem;font-family:'Inter',system-ui,sans-serif;";
  modal.innerHTML = `
    <div role="dialog" aria-modal="true" style="background:#fff;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;border-radius:14px;box-shadow:0 25px 60px rgba(0,0,0,.35);">
      <div style="position:relative;">
        <img data-svc-img alt="" style="display:none;width:100%;max-height:280px;object-fit:cover;border-radius:14px 14px 0 0;"/>
        <button type="button" data-svc-close aria-label="Cerrar" style="position:absolute;top:.75rem;right:.75rem;width:36px;height:36px;border:none;border-radius:50%;background:rgba(10,29,55,.55);color:#fff;font-size:1.2rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;">&times;</button>
      </div>
      <div style="padding:1.85rem 1.9rem 2rem;">
        <h3 data-svc-titulo style="font-size:1.6rem;font-weight:900;letter-spacing:-.02em;color:#0A1D37;margin:0 0 .9rem;"></h3>
        <p data-svc-desc style="font-size:.975rem;line-height:1.65;color:#475569;margin:0 0 1.6rem;white-space:pre-line;"></p>
        <a data-svc-cta style="display:none;align-items:center;gap:.6rem;background:#2563eb;color:#fff;padding:.8rem 1.7rem;font-size:.7rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;border-radius:7px;"></a>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => { modal.style.display = 'none'; document.body.style.overflow = ''; };
  modal.querySelector('[data-svc-close]').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.style.display === 'flex') close(); });
  _svcDetalleModal = modal;
  return modal;
}

function openServiciosDetalle(d) {
  const modal = ensureServiciosDetalleModal();
  const img = modal.querySelector('[data-svc-img]');
  if (d.imagen) { img.src = d.imagen; img.style.display = ''; } else { img.removeAttribute('src'); img.style.display = 'none'; }
  modal.querySelector('[data-svc-titulo]').textContent = d.titulo || '';
  modal.querySelector('[data-svc-desc]').textContent = d.descripcion || '';
  const cta = modal.querySelector('[data-svc-cta]');
  if (d.enlace && d.enlace !== '#') {
    cta.href = d.enlace;
    cta.style.display = 'inline-flex';
    cta.textContent = (d.linkText || 'Ver más') + ' ';
    const arrow = document.createElement('i');
    arrow.className = 'fa-solid fa-arrow-right';
    cta.appendChild(arrow);
  } else {
    cta.style.display = 'none';
  }
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// hidrata [data-blog-list] desde /api/data/blog
async function hydrateBlogList() {
  const lists = document.querySelectorAll('[data-blog-list]');
  if (!lists.length) return;
  try {
    const r = await fetch(`${API_BASE}/data/blog?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('no blog data');
    const data = await r.json();
    const posts = (data.posts || []).filter(p => p.estado === 'publicado');
    lists.forEach(list => {
      const emptyMsg = list.dataset.emptyMsg || 'No hay artículos publicados aún.';
      if (posts.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:3rem 0;color:#94a3b8;font-size:.875rem;">${emptyMsg}</div>`;
        return;
      }
      list.innerHTML = posts.map(p => `
        <article class="blog-row-card">
          ${p.imagen
            ? `<div class="blog-row-icon" style="width:120px;height:120px;border-radius:18px;overflow:hidden;flex:0 0 auto;"><img src="${esc(p.imagen)}" alt="${esc(p.titulo||'')}" style="width:100%;height:100%;object-fit:cover;display:block;"></div>`
            : `<div class="blog-row-icon"><i class="fa-solid ${blogCategoriaIcon(p.categoria)}" aria-hidden="true"></i></div>`}
          <div class="blog-row-body">
            <div class="blog-row-meta">
              <span class="blog-row-tag">${esc(p.categoria||'')}</span>
              ${p.fecha ? `<span class="blog-row-date">${esc(p.fecha)}</span>` : ''}
            </div>
            <h3 class="blog-row-title">${esc(p.titulo||'')}</h3>
            <p class="blog-row-excerpt">${esc(p.extracto||'')}</p>
            <a href="/html/articulo/?id=${esc(p.id)}" class="blog-row-link">Leer artículo completo <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
          </div>
        </article>`).join('');
    });
  } catch (e) {
    lists.forEach(list => {
      const errMsg = list.dataset.errorMsg || 'No se pudieron cargar los artículos.';
      list.innerHTML = `<div style="text-align:center;padding:3rem 0;color:#94a3b8;font-size:.875rem;">${errMsg}</div>`;
    });
  }
}

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function blogCategoriaIcon(categoria) {
  const c = String(categoria || '').toLowerCase();
  if (/cablead|infra|red/.test(c)) return 'fa-sitemap';
  if (/fibra|óptic|optic/.test(c)) return 'fa-wifi';
  if (/segurid|cámara|camara|cctv|alarma/.test(c)) return 'fa-shield-halved';
  if (/soporte|it\b|help/.test(c)) return 'fa-headset';
  if (/software|desarrollo|web|app|código|codigo/.test(c)) return 'fa-code';
  if (/novedad|noticia|evento/.test(c)) return 'fa-bullhorn';
  return 'fa-newspaper';
}

// hidrata [data-blog-cards] (grid del index) desde /api/data/blog
async function hydrateBlogCards() {
  const grids = document.querySelectorAll('[data-blog-cards]');
  if (!grids.length) return;
  try {
    const r = await fetch(`${API_BASE}/data/blog?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('no blog data');
    const data = await r.json();
    let posts = (data.posts || []).filter(p => p.estado === 'publicado');
    posts.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    grids.forEach(grid => {
      const ds = grid.dataset;
      const limit = parseInt(ds.limit || '3', 10);
      const list = posts.slice(0, limit);
      if (!list.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem 0;color:#94a3b8;font-size:.875rem;">No hay artículos publicados aún.</div>`;
        return;
      }
      const st = (prop, v) => v ? `${prop}:${v};` : '';
      grid.innerHTML = list.map(p => {
        const cardStyle = st('background', ds.cardBg) + st('border-color', ds.cardBorder) + st('border-radius', ds.cardRadius);
        const imgInner = p.imagen
          ? `<img src="${esc(p.imagen)}" alt="${esc(p.titulo)}">`
          : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#0A1D37,#1e3a8a);display:flex;align-items:center;justify-content:center;"><span style="color:#60a5fa;font-size:.625rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;">${esc(p.categoria || 'Blog')}</span></div>`;
        return `
        <article class="blog-card"${cardStyle ? ` style="${cardStyle}"` : ''}>
          <div class="blog-card-img">${imgInner}</div>
          <div class="blog-card-content">
            <span class="blog-tag"${(ds.tagBg || ds.tagColor) ? ` style="${st('background', ds.tagBg)}${st('color', ds.tagColor)}"` : ''}>${esc(p.categoria || '')}</span>
            <h3 class="blog-card-title"${ds.cardTitle ? ` style="color:${ds.cardTitle};"` : ''}>${esc(p.titulo || '')}</h3>
            <p class="blog-card-desc"${ds.cardText ? ` style="color:${ds.cardText};"` : ''}>${esc(p.extracto || '')}</p>
            <a href="${p.id ? `/html/articulo/?id=${esc(p.id)}` : '/html/blog'}" class="blog-card-link"${ds.linkColor ? ` style="color:${ds.linkColor};"` : ''}>Leer Artículo <i class="fa-solid fa-arrow-right fa-lg" style="color: var(--blue-500);" aria-hidden="true"></i></a>
          </div>
        </article>`;
      }).join('');
    });
  } catch (e) {
    grids.forEach(grid => {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem 0;color:#94a3b8;font-size:.875rem;">No se pudieron cargar los artículos.</div>`;
    });
  }
}

// hidrata el carrusel de clientes con datos en vivo + links a perfiles
async function hydrateClientesTrack() {
  const tracks = document.querySelectorAll('[data-clientes-track]');
  if (!tracks.length) return;
  try {
    const r = await fetch(`${API_BASE}/data/clientes?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('no clientes data');
    const data = await r.json();
    const clientes = (data.clientes || []).filter(c => c.activo !== false);
    if (!clientes.length) return;

    const makeCell = (c) => {
      const inner = c.imagen
        ? `<img src="${esc(c.imagen)}" alt="${esc(c.nombre)}">`
        : `<div class="logos-cell-text">${esc(c.nombre)}</div>`;
      if (c.estado_perfil === 'publicado') {
        return `<a href="/html/cliente/?id=${esc(c.id)}" class="logos-cell logos-cell-link" title="Ver caso: ${esc(c.nombre)}">${inner}</a>`;
      }
      return `<div class="logos-cell">${inner}</div>`;
    };

    // triplicado para el loop infinito del carrusel
    const cells = [...clientes, ...clientes, ...clientes].map(makeCell).join('');
    tracks.forEach(track => { track.innerHTML = cells; });
  } catch (e) {
    // falla en silencio: queda el contenido estático del template
  }
}

// anima los acordeones <details> de faq (apertura y cierre suaves)
function hydrateFaqItems() {
  document.querySelectorAll('.sg-faqitem details, .sg-faq details').forEach(det => {
    if (det.__faqBound) return;
    det.__faqBound = true;
    const body = det.querySelector('.sg-ans');
    if (!body) return;
    // wrapper animado para height/opacidad; el details sigue siendo nativo
    const wrap = document.createElement('div');
    wrap.style.cssText = 'overflow:hidden;transition:max-height .32s ease,opacity .26s ease;';
    body.parentNode.insertBefore(wrap, body);
    wrap.appendChild(body);
    if (det.open) { wrap.style.maxHeight = body.scrollHeight + 'px'; wrap.style.opacity = '1'; }
    else           { wrap.style.maxHeight = '0'; wrap.style.opacity = '0'; }
    det.querySelector('summary')?.addEventListener('click', ev => {
      ev.preventDefault();
      if (det.open) {
        wrap.style.maxHeight = '0';
        wrap.style.opacity = '0';
        const onEnd = e => {
          if (e.propertyName !== 'max-height') return;
          wrap.removeEventListener('transitionend', onEnd);
          det.removeAttribute('open');
        };
        wrap.addEventListener('transitionend', onEnd);
      } else {
        // abrir: open + animar con raf para que el browser pinte primero
        det.setAttribute('open', '');
        requestAnimationFrame(() => {
          wrap.style.maxHeight = body.scrollHeight + 'px';
          wrap.style.opacity = '1';
        });
      }
    });
  });
}

// aplica contacto + seo globales (datos transversales a todas las plantillas)
async function applyGlobalContactoSEO(tipo) {
  try {
    const [contacto, seo] = await Promise.all([
      fetch(`${API_BASE}/data/contacto?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE}/data/seo?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    if (contacto) {
      _contactoData = contacto;
      if (contacto.whatsapp) {
        const wa = `https://wa.me/${contacto.whatsapp}`;
        document.querySelectorAll('a[href*="wa.me"]').forEach(a => a.href = wa);
      }
    }
    if (seo) {
      // clave seo del tipo (index = home); si no hay datos, cae al mapeo por ruta
      const byPath = () => {
        const path = window.location.pathname.toLowerCase();
        if (path.endsWith('/blog.html')) return 'blog';
        if (path.endsWith('/articulo.html')) return 'articulo';
        if (path.endsWith('/cableado_estructurado.html')) return 'cableado';
        if (path.endsWith('/fibra_optica.html')) return 'fibra';
        if (path.endsWith('/seguridad.html')) return 'seguridad';
        if (path.endsWith('/soporte_it.html')) return 'soporte';
        if (path.endsWith('/desarrollo.html')) return 'desarrollo';
        return 'home';
      };
      const tipoKey = tipo ? (tipo === 'index' ? 'home' : tipo) : null;
      const route = (tipoKey && seo[tipoKey]) ? tipoKey : byPath();
      const meta = seo[route];
      if (meta) {
        const t = document.getElementById('meta-title');
        const d = document.getElementById('meta-desc');
        if (t && meta.title) t.textContent = meta.title;
        if (d && meta.description) d.setAttribute('content', meta.description);
        if (meta.title && !t) document.title = meta.title;
      }
    }
  } catch (e) {
    console.warn('[bootstrap] contacto/SEO no cargado:', e.message);
  }
}
