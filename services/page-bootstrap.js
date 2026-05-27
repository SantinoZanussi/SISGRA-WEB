// Renderiza la plantilla activa de un tipo dentro de #root y conecta
// funcionalidad común (mobile drawer, form submit, contacto/SEO globales).
//
// Uso desde una página HTML:
//   <div id="plantilla-root"></div>
//   <script type="module">
//     import { bootstrapPage } from '/services/page-bootstrap.js';
//     bootstrapPage('index', 'plantilla-root');
//   </script>

import { renderPlantilla } from './sections.js';

const API_BASE = `http://${window.location.hostname}:3000/api`;

export async function bootstrapPage(tipo, rootId = 'plantilla-root', opts = {}) {
  const root = document.getElementById(rootId);
  if (!root) {
    console.error(`[bootstrap] No se encontró #${rootId}`);
    return;
  }
  try {
    // cache:'no-store' + cache-buster ?t= → fuerza fetch fresh siempre.
    // Sin esto el browser cachea la plantilla y los cambios del editor no se ven hasta refresh duro.
    const r = await fetch(`${API_BASE}/plantillas/activa/${tipo}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) {
      root.innerHTML = `<div style="padding:6rem 2rem;text-align:center;color:#94a3b8;font-family:'Inter',system-ui,sans-serif;">
        Esta página aún no tiene una plantilla activa.<br/>
        <small style="display:block;margin-top:.5rem;font-size:.75rem;">Andá al panel admin y activá una para "${tipo}".</small>
      </div>`;
      return;
    }
    const { plantilla } = await r.json();

    // ── Para cliente.html: si se pasa clienteId, inyectar datos del cliente ──
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
          plantilla.secciones = plantilla.secciones.map(sec => {
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
                // Si no hay imagen destacada → string vacío (no se renderiza)
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

    // ── Para articulo.html: si hay ?id= en la URL, inyectar el post real ──
    if (tipo === 'articulo' && !opts.clienteId) {
      const postId = new URLSearchParams(window.location.search).get('id');
      if (postId) {
        // Detectar de dónde viene el usuario para el botón "Volver"
        const fromBlog = document.referrer.includes('blog.html');
        const backLabel = fromBlog ? '← Volver al Blog'   : '← Volver al Inicio';
        const backHref  = fromBlog ? '/html/blog.html'     : '/index.html';
        try {
          const br = await fetch(`${API_BASE}/data/blog?t=${Date.now()}`, { cache: 'no-store' });
          if (br.ok) {
            const blogData = await br.json();
            const post = (blogData.posts || []).find(p => p.id === postId);
            if (post) {
              if (post.titulo) document.title = `${post.titulo} — SISGRA`;
              plantilla.secciones = plantilla.secciones.map(sec => {
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
                    // Si el post no tiene imagen → string vacío (no se renderiza)
                    featuredImageUrl: post.imagen || '',
                    featuredImageAlt: post.titulo || '',
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

    root.innerHTML = renderPlantilla(plantilla);
    // Post-render: conectar funcionalidad que estaba en el HTML estático
    bindMobileDrawer();
    bindContactForm();
    applyGlobalContactoSEO();
    hydrateBlogList();
    hydrateClientesTrack();
  } catch (e) {
    root.innerHTML = `<div style="padding:4rem;text-align:center;color:#900;font-family:sans-serif;">
      Error cargando la plantilla: ${e.message}
    </div>`;
  }
}

// ── Mobile nav toggle (busca .nav-mobile-toggle + .nav-mobile-drawer) ──
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

// ── Form submit del footer (envía email via Gmail) ──
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

// ── Hidratar [data-blog-list] desde /api/data/blog ──
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
        <article class="news-row">
          <div class="news-content">
            <div class="news-meta">
              <span class="news-tag">${esc(p.categoria||'')}</span>
              <span class="news-date">${esc(p.fecha||'')}</span>
            </div>
            <h3 class="news-title">${esc(p.titulo||'')}</h3>
            <p class="news-excerpt">${esc(p.extracto||'')}</p>
            <a href="/html/articulo.html?id=${esc(p.id)}" class="news-link">Leer artículo completo <span>→</span></a>
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

// ── Hidratar carrusel de clientes con datos en vivo y links a perfiles ──
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
        return `<a href="/html/cliente.html?id=${esc(c.id)}" class="logos-cell logos-cell-link" title="Ver caso: ${esc(c.nombre)}">${inner}</a>`;
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

// ── Aplicar contacto + SEO globales (datos transversales a todas las plantillas) ──
async function applyGlobalContactoSEO() {
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
      // Determinar key SEO por título de página
      const route = (() => {
        const path = window.location.pathname.toLowerCase();
        if (path.endsWith('/blog.html')) return 'blog';
        if (path.endsWith('/articulo.html')) return 'articulo';
        if (path.endsWith('/cableado_estructurado.html')) return 'cableado';
        if (path.endsWith('/fibra_optica.html')) return 'fibra';
        if (path.endsWith('/seguridad.html')) return 'seguridad';
        if (path.endsWith('/soporte_it.html')) return 'soporte';
        if (path.endsWith('/desarrollo.html')) return 'desarrollo';
        return 'home';
      })();
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
