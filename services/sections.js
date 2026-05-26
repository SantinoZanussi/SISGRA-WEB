// ═══════════════════════════════════════════════════════════════════
//  SECTION REGISTRY — usa el HTML/CSS EXACTO del sitio actual.
//  Cada render genera markup idéntico al de index.html (clases reales:
//  .hero, .hero-grid, .max-w-7xl, .logos-section, .services-section, etc.)
//  Cargando css/base.css + css/layout_home.css + css/components.css
//  + css/pages/home.css el resultado se ve igual a la web actual.
// ═══════════════════════════════════════════════════════════════════

export const TIPOS_HTML = [
  { value: 'index',      label: 'Inicio',                file: 'index.html' },
  { value: 'blog',       label: 'Blog',                  file: 'html/blog.html' },
  { value: 'articulo',   label: 'Artículo',              file: 'html/articulo.html' },
  { value: 'cableado',   label: 'Cableado Estructurado', file: 'html/cableado_estructurado.html' },
  { value: 'fibra',      label: 'Fibra Óptica',          file: 'html/fibra_optica.html' },
  { value: 'seguridad',  label: 'Seguridad Electrónica', file: 'html/seguridad.html' },
  { value: 'soporte',    label: 'Soporte IT',            file: 'html/soporte_it.html' },
  { value: 'desarrollo', label: 'Desarrollo de Software',file: 'html/desarrollo.html' },
];

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ═══════════════════════════════════════════════════════════════════
export const SECTIONS = {
  nav: {
    label: 'Navbar',
    description: 'Barra superior con logo y enlaces',
    icon: '☰',
    validTipos: ['*'],
    defaultData: {
      logoSrc: '/img/logo sisgra.png',
      logoSrcHref: '../index.html',
      instalacionesLabel: 'Instalaciones',
      cableadoLabel: 'Cableado Estructurado', cableadoHref: '/html/cableado_estructurado.html',
      fibraLabel: 'Fibra Óptica',              fibraHref:    '/html/fibra_optica.html',
      seguridadLabel: 'Seguridad Electrónica', seguridadHref:'/html/seguridad.html',
      blogLabel: 'Blog',                       blogHref:     '/html/blog.html',
      soporteLabel: 'Soporte IT',              soporteHref:  '/html/soporte_it.html',
      desarrolloLabel: 'Desarrollo de Software',desarrolloHref:'/html/desarrollo.html',
      ctaLabel: 'Contáctese',                  ctaHref:      'https://wa.me/548101220065',
    },
    defaultDesign: {},
    dataFields: [
      { name: 'logoSrc',            label: 'Logo (URL)',         type: 'text' },
      { name: 'logoSrcHref',        label: 'Link Inicio',        type: 'text' },
      { name: 'instalacionesLabel', label: 'Menú: Instalaciones',type: 'text' },
      { name: 'cableadoLabel',      label: 'Cableado',           type: 'text' },
      { name: 'cableadoHref',       label: 'Link Cableado',      type: 'text' },
      { name: 'fibraLabel',         label: 'Fibra Óptica',       type: 'text' },
      { name: 'fibraHref',          label: 'Link Fibra',         type: 'text' },
      { name: 'seguridadLabel',     label: 'Seguridad',          type: 'text' },
      { name: 'seguridadHref',      label: 'Link Seguridad',     type: 'text' },
      { name: 'blogLabel',          label: 'Blog',               type: 'text' },
      { name: 'blogHref',           label: 'Link Blog',          type: 'text' },
      { name: 'soporteLabel',       label: 'Soporte IT',         type: 'text' },
      { name: 'soporteHref',        label: 'Link Soporte',       type: 'text' },
      { name: 'desarrolloLabel',    label: 'Desarrollo',         type: 'text' },
      { name: 'desarrolloHref',     label: 'Link Desarrollo',    type: 'text' },
      { name: 'ctaLabel',           label: 'Botón Contacto',     type: 'text' },
      { name: 'ctaHref',            label: 'Link Contacto',      type: 'text' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS.nav.defaultData, ...data };
      return `
<nav>
  <div class="max-w-1400">
    <div class="nav-inner">
      <a href="${esc(d.logoSrcHref)}" class="nav-logo">
        <div class="nav-logo-wrap"><div class="nav-logo-row">
          <img src="${esc(d.logoSrc)}" alt="SISGRA">
        </div></div>
      </a>
      <div class="nav-menu">
        <div class="nav-menu-list">
          <div class="nav-dropdown">
            <a href="#instalaciones" class="nav-dropdown-trigger">
              ${esc(d.instalacionesLabel)}
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"/></svg>
            </a>
            <div class="dropdown-content">
              <a href="${esc(d.cableadoHref)}">${esc(d.cableadoLabel)}</a>
              <a href="${esc(d.fibraHref)}">${esc(d.fibraLabel)}</a>
              <a href="${esc(d.seguridadHref)}">${esc(d.seguridadLabel)}</a>
            </div>
          </div>
          <a href="${esc(d.blogHref)}" class="nav-link">${esc(d.blogLabel)}</a>
          <a href="${esc(d.soporteHref)}" class="nav-link">${esc(d.soporteLabel)}</a>
          <a href="${esc(d.desarrolloHref)}" class="nav-link">${esc(d.desarrolloLabel)}</a>
        </div>
      </div>
      <div class="nav-contact-wrap">
        <a href="${esc(d.ctaHref)}" class="btn-contact">${esc(d.ctaLabel)}</a>
      </div>
    </div>
  </div>
</nav>`;
    },
  },

  // ─────────────────────────────────────────────────────────────────
  //  HERO — copia exacta de renderHeroP1 del index.html actual
  //  Campos idénticos a hero.json (titulo1, titulo2, stat1_numero, etc.)
  // ─────────────────────────────────────────────────────────────────
  hero: {
    label: 'Hero lateral',
    description: 'Hero con stats laterales (igual al index actual)',
    icon: '◫',
    validTipos: ['index'],
    defaultData: {
      badge: 'INFRAESTRUCTURA DE ELITE',
      titulo1: 'Título Principal',
      titulo2: 'Subtítulo en Acento',
      descripcion: 'Descripción del hero.',
      boton_primario: 'Ver Soluciones',
      boton_secundario: 'Conocer más',
      stat1_numero: '+25',  stat1_label: 'AÑOS DE EXPERIENCIA',
      stat2_numero: '+500', stat2_label: 'Clientes activos',
    },
    defaultDesign: {},
    dataFields: [
      { name: 'badge',            label: 'Badge',            type: 'text' },
      { name: 'titulo1',          label: 'Título línea 1',   type: 'text' },
      { name: 'titulo2',          label: 'Título línea 2',   type: 'text' },
      { name: 'descripcion',      label: 'Descripción',      type: 'textarea' },
      { name: 'boton_primario',   label: 'Botón primario',   type: 'text' },
      { name: 'boton_secundario', label: 'Botón secundario', type: 'text' },
      { name: 'stat1_numero',     label: 'Stat 1 número',    type: 'text' },
      { name: 'stat1_label',      label: 'Stat 1 label',     type: 'text' },
      { name: 'stat2_numero',     label: 'Stat 2 número',    type: 'text' },
      { name: 'stat2_label',      label: 'Stat 2 label',     type: 'text' },
    ],
    designFields: [],
    render: (data) => {
      const h = { ...SECTIONS.hero.defaultData, ...data };
      return `
<header class="hero">
  <div class="hero-dots"></div>
  <div class="max-w-7xl hero-inner">
    <div class="hero-grid">
      <div>
        <div class="hero-badge">${esc(h.badge)}</div>
        <h1 class="hero-title">
          ${esc(h.titulo1)} <span><i>${esc(h.titulo2)}</i></span>
        </h1>
        <p class="hero-desc">${esc(h.descripcion)}</p>
        <div class="hero-buttons">
          <a href="#servicios"><button class="btn-hero-primary">${esc(h.boton_primario)}</button></a>
          <a href="#nosotros"><button class="btn-hero-secondary">${esc(h.boton_secundario)}</button></a>
        </div>
      </div>
      <div class="hero-stats">
        <div class="stat-card-dark">
          <div class="stat-number-white">${esc(h.stat1_numero)}</div>
          <div class="stat-label-blue">${esc(h.stat1_label)}</div>
        </div>
        <div class="stat-card-light">
          <div class="stat-number-dark">${esc(h.stat2_numero)}</div>
          <div class="stat-label-gray">${esc(h.stat2_label)}</div>
        </div>
      </div>
    </div>
  </div>
</header>`;
    },
  },

  // ─────────────────────────────────────────────────────────────────
  //  HERO CENTRADO — copia exacta de renderHeroP2
  // ─────────────────────────────────────────────────────────────────
  'hero-centered': {
    label: 'Hero centrado',
    description: 'Hero centrado con métricas y tags',
    icon: '▣',
    validTipos: ['index'],
    defaultData: {
      p2_eyebrow: '25 años de confianza',
      p2_titulo: 'Infraestructura que no falla.',
      p2_subtitulo: 'Conectamos el futuro de tu empresa.',
      p2_descripcion: 'Diseñamos, instalamos y mantenemos la infraestructura tecnológica que impulsa a las empresas líderes.',
      p2_boton_primario: 'Solicitar presupuesto',
      p2_boton_secundario: 'Ver proyectos',
      p2_tag1: 'Certificación Cat8',
      p2_tag2: 'Fibra Óptica',
      p2_tag3: 'Soporte 24/7',
      p2_metric1_num: '+500',  p2_metric1_label: 'Clientes activos',
      p2_metric2_num: '99.9%', p2_metric2_label: 'Disponibilidad',
      p2_metric3_num: '25+',   p2_metric3_label: 'Años de experiencia',
    },
    defaultDesign: {},
    dataFields: [
      { name: 'p2_eyebrow',          label: 'Eyebrow',          type: 'text' },
      { name: 'p2_titulo',           label: 'Título',           type: 'text' },
      { name: 'p2_subtitulo',        label: 'Subtítulo',        type: 'text' },
      { name: 'p2_descripcion',      label: 'Descripción',      type: 'textarea' },
      { name: 'p2_boton_primario',   label: 'Botón primario',   type: 'text' },
      { name: 'p2_boton_secundario', label: 'Botón secundario', type: 'text' },
      { name: 'p2_tag1', label: 'Tag 1', type: 'text' },
      { name: 'p2_tag2', label: 'Tag 2', type: 'text' },
      { name: 'p2_tag3', label: 'Tag 3', type: 'text' },
      { name: 'p2_metric1_num',   label: 'Métrica 1 número', type: 'text' },
      { name: 'p2_metric1_label', label: 'Métrica 1 label',  type: 'text' },
      { name: 'p2_metric2_num',   label: 'Métrica 2 número', type: 'text' },
      { name: 'p2_metric2_label', label: 'Métrica 2 label',  type: 'text' },
      { name: 'p2_metric3_num',   label: 'Métrica 3 número', type: 'text' },
      { name: 'p2_metric3_label', label: 'Métrica 3 label',  type: 'text' },
    ],
    designFields: [],
    render: (data) => {
      const h = { ...SECTIONS['hero-centered'].defaultData, ...data };
      const tags = [h.p2_tag1, h.p2_tag2, h.p2_tag3].filter(Boolean);
      const metrics = [
        { num: h.p2_metric1_num, label: h.p2_metric1_label },
        { num: h.p2_metric2_num, label: h.p2_metric2_label },
        { num: h.p2_metric3_num, label: h.p2_metric3_label },
      ].filter(m => m.num);
      return `
<header class="hero-p2">
  <div class="hero-p2-inner">
    <div class="hero-p2-eyebrow">${esc(h.p2_eyebrow)}</div>
    <h1 class="hero-p2-title">${esc(h.p2_titulo)}</h1>
    <p class="hero-p2-subtitle">${esc(h.p2_subtitulo)}</p>
    <p class="hero-p2-desc">${esc(h.p2_descripcion)}</p>
    ${tags.length ? `<div class="hero-p2-tags">${tags.map(t => `<span class="hero-p2-tag">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="hero-p2-buttons">
      <a href="#servicios"><button class="btn-hero-primary">${esc(h.p2_boton_primario)}</button></a>
      <a href="#nosotros"><button class="btn-hero-secondary">${esc(h.p2_boton_secundario)}</button></a>
    </div>
    ${metrics.length ? `
      <div class="hero-p2-metrics">
        ${metrics.map(m => `
          <div class="hero-p2-metric">
            <span class="hero-p2-metric-num">${esc(m.num)}</span>
            <span class="hero-p2-metric-label">${esc(m.label)}</span>
          </div>`).join('')}
      </div>` : ''}
  </div>
</header>`;
    },
  },

  // ─────────────────────────────────────────────────────────────────
  //  CLIENTES — copia exacta de la sección clientes del index actual
  //  Estructura: <section class="logos-section">…<div class="logos-track">…
  // ─────────────────────────────────────────────────────────────────
  clientes: {
    label: 'Clientes / Logos',
    description: 'Carrusel de logos de clientes',
    icon: '◷',
    validTipos: ['index'],
    defaultData: {
      titulo_seccion: 'NUESTROS CLIENTES',
      carrusel_activo: true,
      auto_scroll: true,
      clientes: [
        { nombre: 'San Cristóbal', imagen: '/img/sancristobal.png', activo: true },
        { nombre: 'Syngenta',      imagen: '/img/syngenta.png',     activo: true },
      ],
    },
    defaultDesign: {},
    dataFields: [
      { name: 'titulo_seccion',  label: 'Título sección', type: 'text' },
      { name: 'carrusel_activo', label: 'Mostrar carrusel', type: 'toggle' },
      { name: 'auto_scroll',     label: 'Auto-scroll',      type: 'toggle' },
      { name: 'clientes',        label: 'Clientes',         type: 'clientes' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS.clientes.defaultData, ...data };
      if (d.carrusel_activo === false) return '';
      const clientes = (d.clientes || []).filter(c => c.activo !== false);
      const cells = [...clientes, ...clientes, ...clientes].map(c => `
        <div class="logos-cell">
          ${c.imagen ? `<img src="${esc(c.imagen)}" alt="${esc(c.nombre)}">` : `<div class="logos-cell-text">${esc(c.nombre)}</div>`}
        </div>`).join('');
      return `
<section class="logos-section" id="section-clientes">
  <div class="max-w-7xl">
    <div class="logos-header">
      <h2 class="logos-title">${esc(d.titulo_seccion)}</h2>
    </div>
    <div class="logos-track-wrapper">
      <div class="logos-track ${d.auto_scroll !== false ? 'is-animating' : ''}">${cells}</div>
    </div>
  </div>
</section>`;
    },
  },

  // ─────────────────────────────────────────────────────────────────
  //  BLOG — copia exacta de la sección blog del index actual
  // ─────────────────────────────────────────────────────────────────
  blog: {
    label: 'Blog / Noticias',
    description: 'Grid de tarjetas de artículos',
    icon: '◰',
    validTipos: ['index'],
    defaultData: {
      titulo_seccion: 'Novedades & Blog',
      posts: [
        { titulo: 'Título del artículo 1', extracto: 'Resumen del artículo...', categoria: 'Novedades', imagen: '' },
        { titulo: 'Título del artículo 2', extracto: 'Resumen del artículo...', categoria: 'Blog',      imagen: '' },
        { titulo: 'Título del artículo 3', extracto: 'Resumen del artículo...', categoria: 'Casos',     imagen: '' },
      ],
    },
    defaultDesign: {},
    dataFields: [
      { name: 'titulo_seccion', label: 'Título sección', type: 'text' },
      { name: 'posts',          label: 'Artículos',      type: 'posts' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS.blog.defaultData, ...data };
      const posts = d.posts || [];
      return `
<section class="blog-section">
  <div class="max-w-7xl">
    <div class="blog-header">
      <h2 class="blog-title">${esc(d.titulo_seccion)}</h2>
    </div>
    <div class="blog-grid">
      ${posts.map(p => `
        <article class="blog-card">
          <div class="blog-card-img">
            ${p.imagen
              ? `<img src="${esc(p.imagen)}" alt="${esc(p.titulo)}">`
              : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#0A1D37,#1e3a8a);display:flex;align-items:center;justify-content:center;"><span style="color:#60a5fa;font-size:.625rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;">${esc(p.categoria||'Blog')}</span></div>`}
          </div>
          <div class="blog-card-content">
            <span class="blog-tag">${esc(p.categoria||'')}</span>
            <h3 class="blog-card-title">${esc(p.titulo||'')}</h3>
            <p class="blog-card-desc">${esc(p.extracto||'')}</p>
            <a href="html/articulo.html" class="blog-card-link">Leer Artículo <span style="color: var(--blue-500);">→</span></a>
          </div>
        </article>`).join('')}
    </div>
  </div>
</section>`;
    },
  },

  // ─────────────────────────────────────────────────────────────────
  //  SERVICIOS — copia exacta de la sección servicios del index actual
  // ─────────────────────────────────────────────────────────────────
  services: {
    label: 'Servicios (cards)',
    description: 'Grid de tarjetas de servicios',
    icon: '◰',
    validTipos: ['index'],
    defaultData: {
      titulo_seccion: 'Portafolio de Soluciones',
      eyebrow: 'Lo que hacemos',
      cards: [
        { id: 'instalaciones', titulo: 'Instalaciones', descripcion: 'Certificación de cableado Categoría 8, Fibra Óptica y Seguridad Electrónica.', enlace: './html/cableado_estructurado.html' },
        { id: 'soporte',       titulo: 'Soporte IT',     descripcion: 'Mantenimiento integral de infraestructura y asistencia técnica corporativa.', enlace: './html/soporte_it.html' },
        { id: 'software',      titulo: 'Software',       descripcion: 'Soluciones a medida para optimizar procesos logísticos y gestión empresarial.', enlace: './html/desarrollo.html' },
      ],
    },
    defaultDesign: {},
    dataFields: [
      { name: 'titulo_seccion', label: 'Título sección', type: 'text' },
      { name: 'eyebrow',        label: 'Eyebrow',        type: 'text' },
      { name: 'cards',          label: 'Cards',          type: 'cards' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS.services.defaultData, ...data };
      return `
<section id="servicios" class="services-section">
  <div class="max-w-7xl">
    <div class="services-header">
      <h2 class="services-title">${esc(d.titulo_seccion)}</h2>
    </div>
    <div class="cards-grid">
      ${(d.cards||[]).map(c => `
        <div class="service-card">
          <div class="card-icon"></div>
          <h3 class="card-title">${esc(c.titulo)}</h3>
          <p class="card-desc">${esc(c.descripcion)}</p>
          <a href="${esc(c.enlace||'#')}" class="card-link">Ver Detalles <span>→</span></a>
        </div>`).join('')}
    </div>
  </div>
</section>`;
    },
  },

  // ─────────────────────────────────────────────────────────────────
  //  NOSOTROS — copia exacta de la sección about del index actual
  // ─────────────────────────────────────────────────────────────────
  about: {
    label: 'Nosotros',
    description: 'Sección "Sobre nosotros" con texto e imagen',
    icon: '◐',
    validTipos: ['index'],
    defaultData: {
      eyebrow: 'Excelencia Corporativa',
      titulo: 'Liderando la industria\ndesde el año 1999.',
      descripcion: 'En SISGRA, entendemos que la infraestructura crítica no permite errores.',
      imagen: '/img/img1.png',
    },
    defaultDesign: {},
    dataFields: [
      { name: 'eyebrow',     label: 'Eyebrow',           type: 'text' },
      { name: 'titulo',      label: 'Título (\\n = <br>)',type: 'textarea' },
      { name: 'descripcion', label: 'Descripción',       type: 'textarea' },
      { name: 'imagen',      label: 'URL imagen',        type: 'text' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS.about.defaultData, ...data };
      return `
<section id="nosotros" class="about-section">
  <div class="max-w-7xl">
    <div class="about-inner">
      <div class="about-img-wrap">
        <div class="about-img-frame">
          <img src="${esc(d.imagen)}" alt="Imagen Corporativa">
        </div>
      </div>
      <div class="about-content">
        <p class="about-eyebrow">${esc(d.eyebrow)}</p>
        <h3 class="about-title">${String(d.titulo||'').split('\n').map(esc).join('<br>')}</h3>
        <p class="about-desc">${esc(d.descripcion)}</p>
      </div>
    </div>
  </div>
</section>`;
    },
  },

  // ─────────────────────────────────────────────────────────────────
  //  CTA — copia de renderExtraSections cta del index actual
  // ─────────────────────────────────────────────────────────────────
  cta: {
    label: 'Call to Action',
    description: 'Banda con título y botón de contacto',
    icon: '►',
    validTipos: ['index'],
    defaultData: {
      title: '¿Listo para empezar?',
      desc: 'Contactanos sin compromiso.',
      btn: 'Contactar',
      href: 'https://wa.me/548101220065',
    },
    defaultDesign: {
      bg: '#0A1D37', btnBg: '#2563eb',
    },
    dataFields: [
      { name: 'title', label: 'Título',      type: 'text' },
      { name: 'desc',  label: 'Descripción', type: 'text' },
      { name: 'btn',   label: 'Texto botón', type: 'text' },
      { name: 'href',  label: 'Link botón',  type: 'text' },
    ],
    designFields: [
      { name: 'bg',    label: 'Color fondo', type: 'color' },
      { name: 'btnBg', label: 'Color botón', type: 'color' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS.cta.defaultData, ...data };
      const s = { ...SECTIONS.cta.defaultDesign, ...design };
      return `
<section style="background:${s.bg};padding:4rem;display:flex;align-items:center;justify-content:space-between;gap:2rem;flex-wrap:wrap;">
  <div>
    <h2 style="font-size:2rem;font-weight:900;color:#fff;letter-spacing:-.04em;font-style:italic;margin-bottom:.5rem;">${esc(d.title)}</h2>
    <p style="color:rgba(255,255,255,.6);font-size:.9375rem;">${esc(d.desc)}</p>
  </div>
  <a href="${esc(d.href)}" style="background:${s.btnBg};color:#fff;padding:.875rem 2rem;font-size:.75rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;white-space:nowrap;flex-shrink:0;">${esc(d.btn)}</a>
</section>`;
    },
  },

  // ─────────────────────────────────────────────────────────────────
  //  SPACER
  // ─────────────────────────────────────────────────────────────────
  spacer: {
    label: 'Espaciador',
    description: 'Espacio en blanco',
    icon: '⎯',
    validTipos: ['index'],
    defaultData: { height: 60 },
    defaultDesign: { bg: '#ffffff' },
    dataFields: [{ name: 'height', label: 'Alto (px)', type: 'number', min: 10, max: 400 }],
    designFields: [{ name: 'bg', label: 'Color de fondo', type: 'color' }],
    render: (data, design) => {
      const d = { ...SECTIONS.spacer.defaultData, ...data };
      const s = { ...SECTIONS.spacer.defaultDesign, ...design };
      return `<div style="height:${d.height}px;background:${s.bg};"></div>`;
    },
  },

  // ─────────────────────────────────────────────────────────────────
  //  FOOTER — copia exacta del <footer> del index actual
  // ─────────────────────────────────────────────────────────────────
  footer: {
    label: 'Footer (index)',
    description: 'Pie de página del index con formulario y links',
    icon: '⎽',
    validTipos: ['index'],
    defaultData: {
      formTitulo: 'Solicite un presupuesto',
      formDesc: 'Cuéntenos sobre su organización. Un asesor se comunicará para recomendarle la mejor solución.',
      whatsapp: '548101220065',
      whatsappText: 'Consultar por WhatsApp',
      formLabel: 'Complete el formulario',
      btnEnviar: 'Enviar consulta',
      brandImg: '/img/logo sisgra.png',
      copyright: '© 2026 SISGRA S.R.L. — Todos los derechos reservados',
    },
    defaultDesign: {},
    dataFields: [
      { name: 'formTitulo',   label: 'Título formulario',  type: 'text' },
      { name: 'formDesc',     label: 'Texto formulario',   type: 'textarea' },
      { name: 'whatsapp',     label: 'Número WhatsApp',    type: 'text' },
      { name: 'whatsappText', label: 'Texto botón WhatsApp', type: 'text' },
      { name: 'formLabel',    label: 'Label formulario',   type: 'text' },
      { name: 'btnEnviar',    label: 'Botón enviar',       type: 'text' },
      { name: 'brandImg',     label: 'Logo URL',           type: 'text' },
      { name: 'copyright',    label: 'Copyright',          type: 'text' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS.footer.defaultData, ...data };
      return `
<footer>
  <div class="footer-top">
    <div class="panel-left">
      <div>
        <p class="section-label">Contacto</p>
        <h2>${esc(d.formTitulo)}</h2>
        <p class="panel-desc">${esc(d.formDesc)}</p>
      </div>
      <div class="action-buttons">
        <a href="https://wa.me/${esc(d.whatsapp)}" class="btn btn-whatsapp">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.845L.057 23.882a.5.5 0 00.61.61l6.037-1.471A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.804 9.804 0 01-5.026-1.381l-.36-.214-3.733.909.925-3.733-.234-.374A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>
          ${esc(d.whatsappText)}
        </a>
      </div>
    </div>
    <div class="panel-right">
      <p class="form-title">${esc(d.formLabel)}</p>
      <div class="form-grid">
        <div class="field"><label>Nombre</label><input type="text" placeholder="Su nombre completo"/></div>
        <div class="field"><label>Empresa</label><input type="text" placeholder="Nombre de la organización"/></div>
        <div class="field"><label>Teléfono</label><input type="tel" placeholder="Ej.: 341 0000000"/></div>
        <div class="field"><label>Email</label><input type="email" placeholder="nombre@empresa.com"/></div>
        <div class="field full"><label>Mensaje</label><textarea placeholder="Cuéntenos qué necesita resolver"></textarea></div>
      </div>
      <button class="btn-submit">${esc(d.btnEnviar)}</button>
    </div>
  </div>
  <div class="footer-bottom">
    <div class="footer-brand"><img src="${esc(d.brandImg)}" alt="SISGRA"></div>
    <div class="footer-links">
      <a href="/html/cableado_estructurado.html">Cableado Estructurado</a>
      <a href="/html/fibra_optica.html">Fibra Óptica</a>
      <a href="/html/seguridad.html">Seguridad Electrónica</a>
      <a href="/html/soporte_it.html">Soporte IT</a>
      <a href="/html/desarrollo.html">Desarrollo de Software</a>
      <a href="/html/blog.html">Blog</a>
    </div>
  </div>
  <div class="footer-copy"><span>${esc(d.copyright)}</span></div>
</footer>`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  //  MÓDULOS ESPECÍFICOS DE CABLEADO ESTRUCTURADO
  //  Usan las clases reales de css/pages/cableado.css y css/layout.css
  // ═══════════════════════════════════════════════════════════════════

  'cableado-hero': {
    label: 'Hero Cableado',
    description: 'Hero principal de cableado: badge + título partido + grid (cards / dark-panel)',
    icon: '◫',
    validTipos: ['cableado'],
    defaultData: {
      badge: 'Infraestructura Crítica',
      titulo1: 'Cableado',
      accent: 'Estructurado.',
      descripcion: 'Implementamos sistemas de conectividad de alto rendimiento diseñados para soportar las demandas de datos del futuro. No solo conectamos cables; construimos el sistema nervioso de su empresa.',
      cards: [
        { badge: 'Cat 8', titulo: 'Certificación Categoría 8', desc: 'Garantizamos velocidades de hasta 40Gbps con certificaciones Fluke de última generación.' },
        { badge: 'TIA',   titulo: 'Normativa TIA/EIA 568',     desc: 'Planificación siguiendo estándares internacionales para garantizar escalabilidad definitiva.' },
      ],
      panelHeader: 'Especificaciones Técnicas',
      panelLabel: 'Certificación',
      panelValue: '100% Norma',
      progressPct: 100,
      stat1Label: 'Latencia',  stat1Value: '&lt; 1ms',
      stat2Label: 'Ancho B.',  stat2Value: '40 Gbps',
    },
    defaultDesign: {},
    dataFields: [
      { name: 'badge',        label: 'Badge superior',     type: 'text' },
      { name: 'titulo1',      label: 'Título línea 1',     type: 'text' },
      { name: 'accent',       label: 'Título línea 2 (accent)', type: 'text' },
      { name: 'descripcion',  label: 'Descripción',        type: 'textarea' },
      { name: 'cards',        label: 'Cards laterales',    type: 'spec-cards' },
      { name: 'panelHeader',  label: 'Header del panel',   type: 'text' },
      { name: 'panelLabel',   label: 'Panel — Label',      type: 'text' },
      { name: 'panelValue',   label: 'Panel — Valor',      type: 'text' },
      { name: 'progressPct',  label: 'Progress %',         type: 'number', min: 0, max: 100 },
      { name: 'stat1Label',   label: 'Stat 1 — Label',     type: 'text' },
      { name: 'stat1Value',   label: 'Stat 1 — Valor',     type: 'text' },
      { name: 'stat2Label',   label: 'Stat 2 — Label',     type: 'text' },
      { name: 'stat2Value',   label: 'Stat 2 — Valor',     type: 'text' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS['cableado-hero'].defaultData, ...data };
      const pct = Math.max(0, Math.min(100, Number(d.progressPct) || 0));
      return `
<section id="cableado-estructurado" class="section-cableado">
  <div class="container-7xl">
    <div class="section-header">
      <div class="badge-infra">${esc(d.badge)}</div>
      <h2 class="section-title">
        ${esc(d.titulo1)} <br>
        <span class="accent">${esc(d.accent)}</span>
      </h2>
      <div class="title-bar"></div>
    </div>
    <div class="cableado-grid">
      <div class="col-left">
        <p>${esc(d.descripcion)}</p>
        <div class="cards-stack">
          ${(d.cards||[]).map(c => `
            <div class="spec-card">
              <div class="spec-badge">${esc(c.badge)}</div>
              <div>
                <h4>${esc(c.titulo)}</h4>
                <p>${esc(c.desc)}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div class="col-right">
        <div class="dark-panel">
          <div class="panel-header">${esc(d.panelHeader)}</div>
          <div class="panel-body">
            <div class="panel-row">
              <div class="panel-row-top">
                <span class="panel-label">${esc(d.panelLabel)}</span>
                <span class="panel-value">${esc(d.panelValue)}</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width:${pct}%;"></div>
              </div>
            </div>
            <div class="panel-stats">
              <div>
                <div class="stat-label">${esc(d.stat1Label)}</div>
                <div class="stat-value">${d.stat1Value}</div>
              </div>
              <div>
                <div class="stat-label">${esc(d.stat2Label)}</div>
                <div class="stat-value">${d.stat2Value}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  //  MÓDULOS ESPECÍFICOS DE FIBRA ÓPTICA
  //  Usan las clases reales de css/pages/fibra_optica.css y css/layout.css
  // ═══════════════════════════════════════════════════════════════════

  'fibra-hero': {
    label: 'Hero Fibra Óptica',
    description: 'Hero de fibra: layout 2 cols (imagen+badge / texto+features)',
    icon: '◫',
    validTipos: ['fibra'],
    defaultData: {
      imagenUrl: 'https://images.unsplash.com/photo-1551703599-6b3e8379aa8c?q=80&w=2072&auto=format&fit=crop',
      badgeTitle: 'LIGHT',
      badgeSub: 'Speed Connectivity',
      sectionBadge: 'Transmisión Fotónica',
      titulo1: 'Fibra',
      accent: 'Óptica Pro.',
      descripcion: 'Llevamos la velocidad de la luz a su centro de datos. Nuestros enlaces de fibra óptica garantizan una inmunidad total a interferencias y un ancho de banda ilimitado.',
      features: [
        { iconType: 'location',  titulo: 'Enlaces Monomodo y Multimodo', desc: 'Backbones industriales de alta densidad OM4/OM5.' },
        { iconType: 'lightning', titulo: 'Fusión por Núcleo',             desc: 'Empalmes de alta precisión certificados.' },
      ],
    },
    defaultDesign: {},
    dataFields: [
      { name: 'imagenUrl',    label: 'Imagen (URL)',    type: 'text' },
      { name: 'badgeTitle',   label: 'Badge — Título',  type: 'text' },
      { name: 'badgeSub',     label: 'Badge — Subtítulo',type: 'text' },
      { name: 'sectionBadge', label: 'Section badge',   type: 'text' },
      { name: 'titulo1',      label: 'Título línea 1',  type: 'text' },
      { name: 'accent',       label: 'Título línea 2 (accent)', type: 'text' },
      { name: 'descripcion',  label: 'Descripción',     type: 'textarea' },
      { name: 'features',     label: 'Features (lista)',type: 'features-icon' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS['fibra-hero'].defaultData, ...data };
      const icon = (type) => {
        const i = {
          location:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
          lightning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
          shield:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12z"/></svg>',
          check:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        };
        return i[type] || i.check;
      };
      return `
<section id="fibra-optica" class="section-fibra">
  <div class="section-fibra-inner">
    <div class="fibra-layout">
      <div class="fibra-visual">
        <div class="fibra-image-frame">
          <img src="${esc(d.imagenUrl)}" alt="Fibra Óptica"/>
          <div class="fibra-image-overlay"></div>
        </div>
        <div class="fibra-badge">
          <div class="fibra-badge-title">${esc(d.badgeTitle)}</div>
          <div class="fibra-badge-sub">${esc(d.badgeSub)}</div>
        </div>
      </div>
      <div class="fibra-text">
        <span class="section-badge">${esc(d.sectionBadge)}</span>
        <h2 class="section-title">
          ${esc(d.titulo1)} <br/>
          <span class="accent">${esc(d.accent)}</span>
        </h2>
        <p class="section-description">${esc(d.descripcion)}</p>
        <ul class="feature-list">
          ${(d.features||[]).map(f => `
            <li class="feature-item">
              <div class="feature-icon">${icon(f.iconType)}</div>
              <div>
                <h4 class="feature-title">${esc(f.titulo)}</h4>
                <p class="feature-desc">${esc(f.desc)}</p>
              </div>
            </li>`).join('')}
        </ul>
      </div>
    </div>
  </div>
</section>`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  //  MÓDULOS ESPECÍFICOS DE SEGURIDAD ELECTRÓNICA
  // ═══════════════════════════════════════════════════════════════════

  'seguridad-hero': {
    label: 'Hero Seguridad',
    description: 'Hero seguridad: texto izq + imagen der con badge SECURE AREA',
    icon: '◫',
    validTipos: ['seguridad'],
    defaultData: {
      badge: 'Protección Perimetral',
      titulo1: 'Seguridad',
      titulo2: 'Electrónica.',
      descripcion: 'Blindamos su infraestructura con tecnología de monitoreo en tiempo real e inteligencia artificial aplicada a la vigilancia.',
      features: [
        { iconType: 'camera', titulo: 'Video Vigilancia IP (CCTV)', desc: 'Sistemas 4K con análisis de video inteligente.' },
      ],
      imagenUrl: '/img/seguridadelectronica.png',
      imgBadgeLabel: 'Status',
      imgBadgeText: 'SECURE AREA',
    },
    defaultDesign: {},
    dataFields: [
      { name: 'badge',         label: 'Badge superior',    type: 'text' },
      { name: 'titulo1',       label: 'Título línea 1',    type: 'text' },
      { name: 'titulo2',       label: 'Título línea 2',    type: 'text' },
      { name: 'descripcion',   label: 'Descripción',       type: 'textarea' },
      { name: 'features',      label: 'Feature cards',     type: 'features-icon' },
      { name: 'imagenUrl',     label: 'Imagen (URL)',      type: 'text' },
      { name: 'imgBadgeLabel', label: 'Badge sobre img — Label', type: 'text' },
      { name: 'imgBadgeText',  label: 'Badge sobre img — Texto', type: 'text' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS['seguridad-hero'].defaultData, ...data };
      const icon = (type) => {
        const i = {
          location:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
          lightning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
          shield:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12z"/></svg>',
          check:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
          camera:    '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>',
        };
        return i[type] || i.check;
      };
      return `
<section id="seguridad-electronica">
  <div class="section-bg-overlay"></div>
  <div class="section-inner">
    <div class="section-flex">
      <div class="section-content">
        <div class="badge">${esc(d.badge)}</div>
        <h2 class="section-title">
          <span><i>${esc(d.titulo1)}</i></span><br>
          <span><i>${esc(d.titulo2)}</i></span>
        </h2>
        <p class="section-desc">${esc(d.descripcion)}</p>
        <div class="features-list">
          ${(d.features||[]).map(f => `
            <div class="feature-card">
              <div class="feature-icon">${icon(f.iconType)}</div>
              <div>
                <h4 class="feature-title">${esc(f.titulo)}</h4>
                <p class="feature-desc">${esc(f.desc)}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div class="section-image">
        <div class="img-wrapper">
          <img src="${esc(d.imagenUrl)}" alt="Seguridad electrónica">
          <div class="img-badge">
            <div class="img-badge-label">${esc(d.imgBadgeLabel)}</div>
            <div class="img-badge-status">
              <div class="pulse-dot"></div>
              <span class="img-badge-text">${esc(d.imgBadgeText)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  //  MÓDULOS ESPECÍFICOS DE SOPORTE IT
  // ═══════════════════════════════════════════════════════════════════

  'soporte-hero': {
    label: 'Hero Soporte IT',
    description: 'Hero soporte: texto izq + dashboard mockup der',
    icon: '◫',
    validTipos: ['soporte'],
    defaultData: {
      badge: 'Continuidad Operativa Garantizada',
      titulo1: 'Soporte',
      accent: 'IT Integral.',
      descripcion: 'Minimizamos el tiempo de inactividad de su empresa. Actuamos como su departamento de sistemas externo, brindando soluciones rápidas y escalables.',
      features: [
        { iconType: 'gear',   titulo: 'Mantenimiento Preventivo', desc: 'Monitoreo constante de servidores y terminales.' },
        { iconType: 'shield', titulo: 'Seguridad Proactiva',      desc: 'Protección de datos y backups automatizados.' },
      ],
      dashLabel: 'Monitoreo de las actividades',
      dashMainValue: '99.9%',
      dashStat1Label: 'Tiempo de respuesta',
      dashStat1Value: '< 45 min',
      dashStat2Label: 'Vida del Sistema',
      dashStat2Value: 'OPTIMIZADO',
      dashStat2Highlight: true,
      btnRemote: 'Acceder al Soporte Remoto Inmediato 🎧',
    },
    defaultDesign: {},
    dataFields: [
      { name: 'badge',          label: 'Badge superior',     type: 'text' },
      { name: 'titulo1',        label: 'Título línea 1',     type: 'text' },
      { name: 'accent',         label: 'Título línea 2 (azul)', type: 'text' },
      { name: 'descripcion',    label: 'Descripción',        type: 'textarea' },
      { name: 'features',       label: 'Feature cards',      type: 'features-icon' },
      { name: 'dashLabel',      label: 'Dashboard — Label',  type: 'text' },
      { name: 'dashMainValue',  label: 'Dashboard — Valor',  type: 'text' },
      { name: 'dashStat1Label', label: 'Stat 1 — Label',     type: 'text' },
      { name: 'dashStat1Value', label: 'Stat 1 — Valor',     type: 'text' },
      { name: 'dashStat2Label', label: 'Stat 2 — Label',     type: 'text' },
      { name: 'dashStat2Value', label: 'Stat 2 — Valor',     type: 'text' },
      { name: 'dashStat2Highlight', label: 'Stat 2 — Verde (highlight)', type: 'toggle' },
      { name: 'btnRemote',      label: 'Botón Soporte Remoto', type: 'text' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS['soporte-hero'].defaultData, ...data };
      const icon = (type) => {
        const i = {
          location:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
          lightning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
          shield:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12z"/></svg>',
          check:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
          camera:    '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>',
          gear:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
          lock:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        };
        return i[type] || i.gear;
      };
      return `
<section id="soporte-it" class="hero-section">
  <div class="container hero-grid">
    <div class="hero-content">
      <div class="badge">${esc(d.badge)}</div>
      <h2 class="hero-title">
        ${esc(d.titulo1)} <br/>
        <span class="text-blue">${esc(d.accent)}</span>
      </h2>
      <p class="hero-description">${esc(d.descripcion)}</p>
      <div class="features-list">
        ${(d.features||[]).map(f => `
          <div class="feature-card">
            <div class="feature-icon">${icon(f.iconType)}</div>
            <div>
              <h4 class="feature-title">${esc(f.titulo)}</h4>
              <p class="feature-text">${esc(f.desc)}</p>
            </div>
          </div>`).join('')}
      </div>
    </div>
    <div class="hero-dashboard">
      <div class="dashboard-box">
        <div class="dash-header">
          <div class="dash-dots"><span></span><span></span><span></span></div>
          <div class="dash-pulse"></div>
        </div>
        <div class="dash-body">
          <div class="dash-stat-group">
            <span class="dash-label">${esc(d.dashLabel)}</span>
            <div class="dash-main-value">${esc(d.dashMainValue)}</div>
          </div>
          <div class="dash-grid">
            <div>
              <span class="dash-sublabel">${esc(d.dashStat1Label)}</span>
              <div class="dash-subvalue">${esc(d.dashStat1Value)}</div>
            </div>
            <div>
              <span class="dash-sublabel">${esc(d.dashStat2Label)}</span>
              <div class="dash-subvalue ${d.dashStat2Highlight ? 'text-green' : ''}">${esc(d.dashStat2Value)}</div>
            </div>
          </div>
          <button class="btn-remote">${esc(d.btnRemote)}</button>
        </div>
      </div>
      <div class="dash-decor"></div>
    </div>
  </div>
</section>`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  //  MÓDULOS ESPECÍFICOS DE DESARROLLO DE SOFTWARE
  // ═══════════════════════════════════════════════════════════════════

  'desarrollo-hero': {
    label: 'Hero Desarrollo Software',
    description: 'Hero desarrollo: texto + code editor mock',
    icon: '◫',
    validTipos: ['desarrollo'],
    defaultData: {
      badge: 'Intelligence Labs',
      titulo1: 'Desarrollo de',
      accent: 'Software.',
      descripcion: 'Transformamos la complejidad operativa en interfaces simplificadas. Desarrollamos código robusto, escalable y diseñado específicamente para los desafíos logísticos de la industria moderna.',
      solutions: [
        { iconType: 'chart',    titulo: 'Software Logístico a Medida', desc: 'Optimización de flujos de inventario, trazabilidad y gestión de depósitos inteligentes.' },
        { iconType: 'database', titulo: 'ERP / CRM',                    desc: 'Sistemas centralizados para el control total de operaciones comerciales.' },
        { iconType: 'gear',     titulo: 'IoT & Automatización',         desc: 'Integración entre hardware y software inteligente basado en datos.' },
      ],
      btnCta: 'Consultar Desarrollo',
      btnCtaHref: '#',
      editorLabel: 'SISGRA_CORE_V2.0 / LOGISTICS_MODULE',
      codeRows: [
        'class SecuritySystem {',
        'public function connectDevices() {',
        'return SUCCESS;',
        '}',
      ],
    },
    defaultDesign: {},
    dataFields: [
      { name: 'badge',         label: 'Badge superior',      type: 'text' },
      { name: 'titulo1',       label: 'Título línea 1',      type: 'text' },
      { name: 'accent',        label: 'Título línea 2 (azul)', type: 'text' },
      { name: 'descripcion',   label: 'Descripción',         type: 'textarea' },
      { name: 'solutions',     label: 'Solutions (icon list)', type: 'features-icon' },
      { name: 'btnCta',        label: 'Texto botón CTA',     type: 'text' },
      { name: 'btnCtaHref',    label: 'Link botón CTA',      type: 'text' },
      { name: 'editorLabel',   label: 'Editor — Label',      type: 'text' },
      { name: 'codeRows',      label: 'Líneas de código',    type: 'text-list' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS['desarrollo-hero'].defaultData, ...data };
      const icon = (type) => {
        const i = {
          location:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
          lightning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
          shield:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12z"/></svg>',
          gear:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
          chart:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
          database:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
          camera:    '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>',
          check:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
          lock:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        };
        return i[type] || i.gear;
      };
      return `
<section id="software">
  <div class="software-container">
    <div class="software-inner">
      <div class="software-text">
        <div class="badge">${esc(d.badge)}</div>
        <h2 class="software-title">
          ${esc(d.titulo1)} <br>
          <span>${esc(d.accent)}</span>
        </h2>
        <p class="software-desc">${esc(d.descripcion)}</p>
        <div class="solutions-list">
          ${(d.solutions||[]).map(s => `
            <div class="solution-item">
              <div class="solution-icon">${icon(s.iconType)}</div>
              <div>
                <h4 class="solution-title">${esc(s.titulo)}</h4>
                <p class="solution-desc">${esc(s.desc)}</p>
              </div>
            </div>`).join('')}
        </div>
        <a href="${esc(d.btnCtaHref)}" class="btn-cta">${esc(d.btnCta)}</a>
      </div>
      <div class="software-visual">
        <div class="code-editor">
          <div class="editor-topbar">
            <div class="dot dot-red"></div>
            <div class="dot dot-amber"></div>
            <div class="dot dot-green"></div>
            <span class="editor-label">${esc(d.editorLabel)}</span>
          </div>
          <div class="editor-body">
            ${(d.codeRows||[]).map(r => `<div class="code-row">${esc(r)}</div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  //  MÓDULOS BLOG (lista de artículos cargada dinámicamente)
  // ═══════════════════════════════════════════════════════════════════

  'blog-list': {
    label: 'Lista de artículos',
    description: 'Lista de artículos publicados (carga desde /api/data/blog)',
    icon: '◰',
    validTipos: ['blog'],
    defaultData: {
      loadingMessage: 'Cargando artículos…',
      emptyMessage: 'No hay artículos publicados aún.',
      errorMessage: 'No se pudieron cargar los artículos.',
    },
    defaultDesign: {},
    dataFields: [
      { name: 'loadingMessage', label: 'Mensaje cargando', type: 'text' },
      { name: 'emptyMessage',   label: 'Mensaje vacío',    type: 'text' },
      { name: 'errorMessage',   label: 'Mensaje error',    type: 'text' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS['blog-list'].defaultData, ...data };
      return `
<section class="blog-container">
  <div class="max-w-7xl" style="padding-top: 4rem;">
    <div class="blog-rows-list" data-blog-list data-loading-msg="${esc(d.loadingMessage)}" data-empty-msg="${esc(d.emptyMessage)}" data-error-msg="${esc(d.errorMessage)}">
      <div style="text-align:center;padding:3rem 0;color:#94a3b8;font-size:.875rem;">${esc(d.loadingMessage)}</div>
    </div>
  </div>
</section>`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  //  MÓDULOS ARTÍCULO (vista detalle)
  // ═══════════════════════════════════════════════════════════════════

  'articulo-header': {
    label: 'Header artículo',
    description: 'Header de artículo: back link + badge + título + lead',
    icon: '◫',
    validTipos: ['articulo'],
    defaultData: {
      backLabel: '← Volver al Blog',
      backHref: '/html/blog.html',
      badge: 'Infraestructura',
      titulo: 'Nuevos estándares de certificación Cat8 para plantas industriales',
      lead: 'Análisis detallado sobre cómo la infraestructura física determina el rendimiento de los sistemas de datos en entornos de alta demanda.',
    },
    defaultDesign: {},
    dataFields: [
      { name: 'backLabel', label: 'Link volver — Texto', type: 'text' },
      { name: 'backHref',  label: 'Link volver — URL',   type: 'text' },
      { name: 'badge',     label: 'Categoría (badge)',   type: 'text' },
      { name: 'titulo',    label: 'Título principal',    type: 'textarea' },
      { name: 'lead',      label: 'Subtítulo / lead',    type: 'textarea' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS['articulo-header'].defaultData, ...data };
      return `
<header class="article-header">
  <div class="max-w-7xl">
    <a href="${esc(d.backHref)}" class="back-link">${esc(d.backLabel)}</a>
    <div class="article-meta">
      <span class="badge-tech">${esc(d.badge)}</span>
    </div>
    <h1 class="article-main-title">${esc(d.titulo)}</h1>
    <p class="article-lead">${esc(d.lead)}</p>
  </div>
</header>`;
    },
  },

  'articulo-body': {
    label: 'Cuerpo del artículo',
    description: 'Cuerpo del artículo: imagen + contenido HTML libre + CTA + sidebar',
    icon: '¶',
    validTipos: ['articulo'],
    defaultData: {
      featuredImageUrl: '/img/chatgptfoto.png',
      featuredImageAlt: 'Infraestructura IT',
      contentHtml: `<h2>La evolución hacia la Categoría 8</h2>
<p>En el panorama actual de la industria 4.0, la velocidad de transmisión de datos no es solo una ventaja competitiva, sino un requisito operativo. El cableado <strong>Categoría 8 (Cat8)</strong> representa el salto más significativo en infraestructura de cobre de la última década.</p>
<p>A diferencia de sus predecesores, Cat8 permite frecuencias de hasta 2000 MHz y velocidades de 25Gbps a 40Gbps, lo que lo hace ideal para el backbone de centros de datos y plantas automatizadas en Rosario y la región.</p>
<blockquote>"La certificación no es un trámite, es el seguro de vida de su red de datos."</blockquote>
<h3>Beneficios clave de la certificación profesional:</h3>
<ul>
  <li><strong>Reducción de Latencia:</strong> Minimiza la retransmisión de paquetes perdidos por interferencias.</li>
  <li><strong>Escalabilidad:</strong> Prepara la planta para futuras actualizaciones de hardware sin cambiar el cableado.</li>
  <li><strong>Cumplimiento de Normas:</strong> Garantiza que la instalación respeta los estándares internacionales TIA/EIA.</li>
</ul>
<p>En <strong>SISGRA</strong>, utilizamos equipos de medición Fluke de última generación para entregar reportes detallados de cada nodo instalado, asegurando que cada centímetro de su red rinda al 100% de su capacidad nominal.</p>`,
      ctaTitle: '¿Necesita auditar su infraestructura actual?',
      ctaText: 'Nuestros asesores técnicos pueden realizar un relevamiento de su planta y proponer mejoras de conectividad.',
      ctaBtnLabel: 'Solicitar Asesoría Técnica',
      ctaBtnHref: 'https://wa.me/03418610863',
      sidebarTitle: 'SISGRA SRL',
      sidebarText: 'Expertos en integración tecnológica desde 1999. Soluciones certificadas para empresas que no pueden detenerse.',
    },
    defaultDesign: {},
    dataFields: [
      { name: 'featuredImageUrl', label: 'Imagen destacada — URL', type: 'text' },
      { name: 'featuredImageAlt', label: 'Imagen destacada — Alt', type: 'text' },
      { name: 'contentHtml',      label: 'Contenido (HTML libre — h2/h3/p/ul/blockquote/strong)', type: 'textarea' },
      { name: 'ctaTitle',         label: 'CTA — Título',           type: 'text' },
      { name: 'ctaText',          label: 'CTA — Texto',            type: 'textarea' },
      { name: 'ctaBtnLabel',      label: 'CTA — Botón texto',      type: 'text' },
      { name: 'ctaBtnHref',       label: 'CTA — Botón URL',        type: 'text' },
      { name: 'sidebarTitle',     label: 'Sidebar — Título',       type: 'text' },
      { name: 'sidebarText',      label: 'Sidebar — Texto',        type: 'textarea' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS['articulo-body'].defaultData, ...data };
      // contentHtml is INTENTIONALLY rendered as raw HTML (no escape) — editor users can paste rich content
      return `
<main class="article-container">
  <div class="max-w-7xl article-grid">
    <div class="article-body">
      <img src="${esc(d.featuredImageUrl)}" alt="${esc(d.featuredImageAlt)}" class="featured-image">
      ${d.contentHtml || ''}
      <div class="article-cta">
        <h3>${esc(d.ctaTitle)}</h3>
        <p>${esc(d.ctaText)}</p>
        <a href="${esc(d.ctaBtnHref)}" class="btn-hero-primary" style="background: var(--sisgra-blue); color: white;">${esc(d.ctaBtnLabel)}</a>
      </div>
    </div>
    <aside class="article-sidebar">
      <div class="sidebar-box dark">
        <h4>${esc(d.sidebarTitle)}</h4>
        <p>${esc(d.sidebarText)}</p>
      </div>
    </aside>
  </div>
</main>`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  //  FOOTER COMPLETO (compartido por todas las páginas secundarias:
  //  cableado, fibra, seguridad, soporte, desarrollo, blog, articulo)
  //  Usa las clases reales de css/layout.css
  // ═══════════════════════════════════════════════════════════════════

  'footer-full': {
    label: 'Footer completo',
    description: 'Footer con wordmark SISGRA + grid 3 cols (servicios / contacto / mapa) + copyright',
    icon: '⎽',
    validTipos: ['cableado','fibra','seguridad','soporte','desarrollo','blog','articulo'],
    defaultData: {
      wordmark: 'SISGRA',
      col1Label: 'Servicios',
      servicios: [
        { label: 'Cableado Estructurado', href: '/html/cableado_estructurado.html' },
        { label: 'Fibra Óptica',          href: '/html/fibra_optica.html' },
        { label: 'Seguridad Electrónica', href: '/html/seguridad.html' },
        { label: 'Soporte IT',            href: '/html/soporte_it.html' },
        { label: 'Desarrollo de Software',href: '/html/desarrollo.html' },
        { label: 'Blog',                  href: '/html/blog.html' },
      ],
      col2Label: 'Contacto',
      contactoOficina: { tipo: 'Oficina',  valor: 'Lamadrid 468<br>(ZONA I) NAVE 2 - Oficina 05 - NODO ROSARIO' },
      contactoTelefono:{ tipo: 'Teléfono', valor: '+54 341 322-0052', href: 'tel:+5403413220052' },
      contactoEmail:   { tipo: 'Email',    valor: 'info@sisgra.com.ar', href: 'mailto:info@sisgra.com.ar' },
      facebookUrl: 'https://www.facebook.com/sisgra.srl',
      mapaSrc: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3348.9!2d-60.6530!3d-32.9440!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95b652f52c9a5e3b%3A0x0!2sLamadrid+468%2C+Rosario%2C+Argentina!5e0!3m2!1ses!2sar!4v1680000000000',
      mapaLabel: 'Rosario · ARG',
      copyright: '© 2026 <span>SISGRA S.R.L.</span> — Todos los derechos reservados',
    },
    defaultDesign: {},
    dataFields: [
      { name: 'wordmark',         label: 'Marca grande',    type: 'text' },
      { name: 'col1Label',        label: 'Col 1 — Título',  type: 'text' },
      { name: 'servicios',        label: 'Col 1 — Servicios', type: 'link-list' },
      { name: 'col2Label',        label: 'Col 2 — Título',  type: 'text' },
      { name: 'contactoOficina',  label: 'Oficina (HTML permitido)', type: 'contact-item' },
      { name: 'contactoTelefono', label: 'Teléfono',        type: 'contact-item' },
      { name: 'contactoEmail',    label: 'Email',           type: 'contact-item' },
      { name: 'facebookUrl',      label: 'URL Facebook',    type: 'text' },
      { name: 'mapaSrc',          label: 'URL iframe mapa', type: 'textarea' },
      { name: 'mapaLabel',        label: 'Label sobre mapa',type: 'text' },
      { name: 'copyright',        label: 'Copyright (HTML)',type: 'text' },
    ],
    designFields: [],
    render: (data) => {
      const d = { ...SECTIONS['footer-full'].defaultData, ...data };
      const ofi = d.contactoOficina || {};
      const tel = d.contactoTelefono || {};
      const mail = d.contactoEmail || {};
      return `
<footer>
  <div class="wordmark-band">
    <h1>${esc(d.wordmark)}</h1>
  </div>
  <div class="footer-grid">
    <div class="footer-col">
      <div class="col-label">${esc(d.col1Label)}</div>
      <ul class="services-list">
        ${(d.servicios||[]).map(s => `<li><a href="${esc(s.href)}">${esc(s.label)}</a></li>`).join('')}
      </ul>
    </div>
    <div class="footer-col">
      <div class="col-label">${esc(d.col2Label)}</div>
      <div class="contact-stack">
        <div class="contact-item">
          <div class="ci-type">${esc(ofi.tipo||'Oficina')}</div>
          <div class="ci-value">${ofi.valor||''}</div>
        </div>
        <div class="contact-item">
          <div class="ci-type">${esc(tel.tipo||'Teléfono')}</div>
          <div class="ci-value"><a href="${esc(tel.href||'#')}">${esc(tel.valor||'')}</a></div>
        </div>
        <div class="contact-item">
          <div class="ci-type">${esc(mail.tipo||'Email')}</div>
          <div class="ci-value"><a href="${esc(mail.href||'#')}">${esc(mail.valor||'')}</a></div>
        </div>
        <div class="contact-item">
          <div class="ci-type">Redes</div>
          <div class="social-row">
            <a class="social-btn" href="${esc(d.facebookUrl||'#')}" aria-label="Facebook">FB</a>
          </div>
        </div>
      </div>
    </div>
    <div class="footer-col map-col" style="padding:0;">
      <div class="map-wrapper">
        <iframe src="${esc(d.mapaSrc)}" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Ubicación SISGRA"></iframe>
        <div class="map-overlay-label">${esc(d.mapaLabel)}</div>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <p class="copy">${d.copyright}</p>
  </div>
</footer>`;
    },
  },

};

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════

export function renderSection(sec) {
  const def = SECTIONS[sec.type];
  if (!def) return `<div style="padding:2rem;background:#fee;color:#900;text-align:center;">Sección desconocida: ${esc(sec.type)}</div>`;
  return def.render(sec.data || {}, sec.design || {});
}

export function renderPlantilla(plantilla) {
  if (!plantilla?.secciones?.length) return '<div style="padding:4rem;text-align:center;color:#94a3b8;">Esta plantilla aún no tiene secciones.</div>';
  return plantilla.secciones.map(renderSection).join('');
}

export function uid(prefix = 'sec') {
  return `${prefix}-${Math.random().toString(36).slice(2,10)}`;
}

export function createSection(type) {
  const def = SECTIONS[type];
  if (!def) return null;
  return {
    id: uid('sec'),
    type,
    data: JSON.parse(JSON.stringify(def.defaultData)),
    design: JSON.parse(JSON.stringify(def.defaultDesign)),
  };
}
