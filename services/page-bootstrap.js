// Renderiza la plantilla activa de un tipo dentro de #root y conecta
// funcionalidad común (mobile drawer, form submit, contacto/SEO globales).
//
// Uso desde una página HTML:
//   <div id="plantilla-root"></div>
//   <script type="module">
//     import { bootstrapPage } from '/services/page-bootstrap.js';
//     bootstrapPage('index', 'plantilla-root');
//   </script>

import { resolverModulos, renderModulosAgrupados } from './sections.js';
import { cssFilesFor } from './css-pages.js';

const API_BASE = `http://${window.location.hostname}:3000/api`;

// Inyecta en el <head> los <link> de CSS que falten para los módulos de la
// plantilla. El HTML de cada página trae un set base, pero los módulos de otra
// página (o las páginas nuevas btn-*) necesitan su hoja de /css/pages/ propia.
// Calcularlo en runtime cubre también módulos agregados después de generar el
// HTML. Usa la misma cssFilesFor que el editor para no divergir.
// Carga Font Awesome (iconos del sitio) una sola vez, si no está ya presente.
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

// Construye los items del nav (dropdowns + links) desde navbar.json. Reemplaza
// el armado embebido en cada plantilla (el viejo syncNavEnPlantillas del backend).
// Se omite el item "home" (href "/") porque el logo ya enlaza al inicio.
// Menú jerárquico (padre/hijos): cada ítem tiene `padre` (id del contenedor padre,
// 0 = nivel principal). Un contenedor (encabezado de submenú) es un ítem con hijos
// y sin destino propio. Se arma: desplegables (con hijos) + links sueltos.
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

export async function bootstrapPage(tipo, rootId = 'plantilla-root', opts = {}) {
  const root = document.getElementById(rootId);
  if (!root) {
    console.error(`[bootstrap] No se encontró #${rootId}`);
    return;
  }
  ensureFontAwesome();

  async function loadAndRender() {
  try {
    // cache:'no-store' + cache-buster ?t= → fuerza fetch fresh siempre.
    // Sin esto el browser cachea la plantilla y los cambios del editor no se ven hasta refresh duro.
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

    // Resolver los módulos por id_modulos (clonados) e inyectar los items del nav
    // desde navbar.json. `secciones` es el array de módulos resueltos; se le agrega
    // el alias `.type` para que el código de inyección dinámica de abajo siga igual.
    let secciones = resolverModulos(plantilla, modulos);
    secciones.forEach(m => {
      m.type = m.tipo;
      if (m.tipo === 'nav') m.data = { ...m.data, items: buildNavItems(navbar) };
    });

    // Para cliente.html: si se pasa clienteId, inyectar datos del cliente
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
            // Header dedicado de cliente (cliente-header) o el viejo articulo-header
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
            // Compatibilidad: plantillas viejas que aún usan articulo-header/body
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

    // Para articulo.html: si hay ?id= en la URL, inyectar el post real
    if (tipo === 'articulo' && !opts.clienteId) {
      const postId = new URLSearchParams(window.location.search).get('id');
      if (postId) {
        // Detectar de dónde viene el usuario para el botón "Volver"
        const fromBlog = document.referrer.includes('blog.html');
        const backLabel = fromBlog ? '← Volver al Blog'   : '← Volver al Inicio';
        const backHref  = fromBlog ? '/html/blog'     : '/index.html';
        try {
          const br = await fetch(`${API_BASE}/data/blog?t=${Date.now()}`, { cache: 'no-store' });
          if (br.ok) {
            const blogData = await br.json();
            const post = (blogData.posts || []).find(p => p.id === postId);
            if (post) {
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
                    // La portada (post.imagen) es solo para la card del index/blog,
                    // NO se muestra al principio del artículo.
                    featuredImageUrl: '',
                    featuredImageAlt: '',
                    contentHtml:      post.contenido || sec.data.contentHtml,
                  }};
                }
                return sec;
              });
            }
          }
        } catch (e) {
          console.warn('[bootstrap] No se pudo cargar el post:', e.message);
        }
      }
    }

    ensurePageCss(tipo, secciones);
    // Render respetando los contenedores (filas de 1 a 3 módulos) de la plantilla.
    root.innerHTML = renderModulosAgrupados(secciones, plantilla.contenedores);
    // Post-render: conectar funcionalidad que estaba en el HTML estático
    bindMobileDrawer();
    bindContactForm();
    applyGlobalContactoSEO(tipo);
    hydrateBlogList();
    hydrateBlogCards();
    hydrateClientesTrack();
  } catch (e) {
    root.innerHTML = `<div style="padding:4rem;text-align:center;color:#900;font-family:sans-serif;">
      Error cargando la plantilla: ${e.message}
    </div>`;
  }
  }   // ← fin de loadAndRender

  await loadAndRender();

  // Re-render al volver a enfocar la pestaña: refleja los cambios guardados desde
  // el admin SIN recargar la página (evita la pantalla en blanco que deja el
  // live-reload del dev server al recargar pestañas en segundo plano).
  if (!window.__sisgraVisBound) {
    window.__sisgraVisBound = true;
    let lastRender = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRender < 1200) return;
      // No re-renderizar si el usuario está escribiendo en un formulario (no perder lo tipeado).
      const ae = document.activeElement;
      if (root.contains(ae) && /^(INPUT|TEXTAREA)$/.test(ae.tagName || '')) return;
      if ([...root.querySelectorAll('input,textarea')].some(el => el.value && el.value.trim())) return;
      lastRender = Date.now();
      loadAndRender();
    });
  }
}

// Mobile nav toggle (busca .nav-mobile-toggle + .nav-mobile-drawer)
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

// Form submit del footer (envía email via Gmail)
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

// Hidratar [data-blog-list] desde /api/data/blog
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
          <div class="blog-row-icon"><i class="fa-solid ${blogCategoriaIcon(p.categoria)}" aria-hidden="true"></i></div>
          <div class="blog-row-body">
            <div class="blog-row-meta">
              <span class="blog-row-tag">${esc(p.categoria||'')}</span>
              ${p.fecha ? `<span class="blog-row-date">${esc(p.fecha)}</span>` : ''}
            </div>
            <h3 class="blog-row-title">${esc(p.titulo||'')}</h3>
            <p class="blog-row-excerpt">${esc(p.extracto||'')}</p>
            <a href="/html/articulo?id=${esc(p.id)}" class="blog-row-link">Leer artículo completo <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
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

// Hidratar [data-blog-cards] (grid del index) desde /api/data/blog
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
            <a href="${p.id ? `/html/articulo?id=${esc(p.id)}` : '/html/blog'}" class="blog-card-link"${ds.linkColor ? ` style="color:${ds.linkColor};"` : ''}>Leer Artículo <i class="fa-solid fa-arrow-right fa-lg" style="color: var(--blue-500);" aria-hidden="true"></i></a>
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

// Hidratar carrusel de clientes con datos en vivo y links a perfiles
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
        return `<a href="/html/cliente?id=${esc(c.id)}" class="logos-cell logos-cell-link" title="Ver caso: ${esc(c.nombre)}">${inner}</a>`;
      }
      return `<div class="logos-cell">${inner}</div>`;
    };

    // Triplicar para el loop infinito del carrusel (igual que el render estático)
    const cells = [...clientes, ...clientes, ...clientes].map(makeCell).join('');
    tracks.forEach(track => { track.innerHTML = cells; });
  } catch (e) {
    // Falla silenciosamente — queda el contenido estático del template
  }
}

// Aplicar contacto + SEO globales (datos transversales a todas las plantillas)
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
      // Clave SEO: del tipo de la plantilla (index→home, igual que el admin). Si no
      // hay datos guardados para esa clave, caemos al mapeo por ruta (compatibilidad
      // con las páginas estándar).
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
