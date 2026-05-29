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
  { value: 'cliente',    label: 'Perfil de Cliente',     file: 'html/cliente.html' },
];

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// Quita una flecha (←/→) inicial del texto de un enlace "volver", para
// reemplazarla por un icono de Font Awesome en el render.
const stripArrow = s => String(s ?? '').replace(/^\s*[←→]\s*/, '');
// css(props) — builds a style=" " attribute from an object, skipping falsy values
const css = (props) => {
  const p = Object.entries(props).filter(([,v]) => v).map(([k,v]) => `${k}:${v}`);
  return p.length ? ` style="${p.join(';')}"` : '';
};

// ═══════════════════════════════════════════════════════════════════
export const SECTIONS = {
  nav: {
    label: 'Navbar',
    description: 'Barra superior con logo y enlaces',
    icon: `<i class="fa-solid fa-bars"></i>`,
    validTipos: ['*'],
    defaultData: {
      logoSrc: '/img/sisgra_blanco.png',
      logoSrcHref: '../index.html',
      instalacionesLabel: 'Instalaciones',
      cableadoLabel: 'Cableado Estructurado', cableadoHref: '/html/cableado_estructurado',
      fibraLabel: 'Fibra Óptica',              fibraHref:    '/html/fibra_optica',
      seguridadLabel: 'Seguridad Electrónica', seguridadHref:'/html/seguridad',
      blogLabel: 'Blog',                       blogHref:     '/html/blog',
      soporteLabel: 'Soporte IT',              soporteHref:  '/html/soporte_it',
      desarrolloLabel: 'Desarrollo de Software',desarrolloHref:'/html/desarrollo',
      ctaLabel: 'Contáctese',                  ctaHref:      'https://wa.me/548101220065',
    },
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
    defaultDesign: { bg: '', linkColor: '', dropdownBg: '', dropdownLinkColor: '', ctaBg: '', ctaColor: '', mobileBg: '', mobileLinkColor: '' },
    designFields: [
      { name: 'bg',               label: 'Fondo navbar',           type: 'color' },
      { name: 'linkColor',        label: 'Color enlaces nav',      type: 'color' },
      { name: 'dropdownBg',       label: 'Fondo dropdown',         type: 'color' },
      { name: 'dropdownLinkColor',label: 'Color enlaces dropdown', type: 'color' },
      { name: 'ctaBg',            label: 'Botón CTA — fondo',      type: 'color' },
      { name: 'ctaColor',         label: 'Botón CTA — texto',      type: 'color' },
      { name: 'mobileBg',         label: 'Drawer móvil — fondo',   type: 'color' },
      { name: 'mobileLinkColor',  label: 'Drawer móvil — enlaces', type: 'color' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS.nav.defaultData, ...data };
      const s = { ...SECTIONS.nav.defaultDesign, ...design };

      // Formato nuevo: items array (sincronizado desde navbar.json)
      let linksHtml;
      if (Array.isArray(d.items) && d.items.length > 0) {
        linksHtml = d.items.map(item => {
          if (item.tipo === 'dropdown') {
            return `
          <div class="nav-dropdown">
            <a href="#" class="nav-dropdown-trigger">
              ${esc(item.titulo)}
              <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </a>
            <div class="dropdown-content">
              ${(item.children || []).map(c => `<a href="${esc(c.href)}">${esc(c.titulo)}</a>`).join('')}
            </div>
          </div>`;
          }
          return `<a href="${esc(item.href || '#')}" class="nav-link">${esc(item.titulo)}</a>`;
        }).join('');
      } else {
        // Formato viejo (compatibilidad hacia atrás)
        linksHtml = `
          <div class="nav-dropdown">
            <a href="#instalaciones" class="nav-dropdown-trigger">
              ${esc(d.instalacionesLabel)}
              <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </a>
            <div class="dropdown-content">
              <a href="${esc(d.cableadoHref)}">${esc(d.cableadoLabel)}</a>
              <a href="${esc(d.fibraHref)}">${esc(d.fibraLabel)}</a>
              <a href="${esc(d.seguridadHref)}">${esc(d.seguridadLabel)}</a>
            </div>
          </div>
          <a href="${esc(d.blogHref)}" class="nav-link">${esc(d.blogLabel)}</a>
          <a href="${esc(d.soporteHref)}" class="nav-link">${esc(d.soporteLabel)}</a>
          <a href="${esc(d.desarrolloHref)}" class="nav-link">${esc(d.desarrolloLabel)}</a>`;
      }

      // Mobile drawer links — dropdowns se despliegan como sección + hijos
      let mobileLinksHtml;
      if (Array.isArray(d.items) && d.items.length > 0) {
        mobileLinksHtml = d.items.map(item => {
          if (item.tipo === 'dropdown') {
            const children = (item.children || []).map(c => `<a href="${esc(c.href)}">${esc(c.titulo)}</a>`).join('');
            return `<div class="nav-mobile-section-title">${esc(item.titulo)}</div>${children}`;
          }
          return `<a href="${esc(item.href || '#')}">${esc(item.titulo)}</a>`;
        }).join('');
      } else {
        mobileLinksHtml = `
          <div class="nav-mobile-section-title">${esc(d.instalacionesLabel)}</div>
          <a href="${esc(d.cableadoHref)}">${esc(d.cableadoLabel)}</a>
          <a href="${esc(d.fibraHref)}">${esc(d.fibraLabel)}</a>
          <a href="${esc(d.seguridadHref)}">${esc(d.seguridadLabel)}</a>
          <a href="${esc(d.blogHref)}">${esc(d.blogLabel)}</a>
          <a href="${esc(d.soporteHref)}">${esc(d.soporteLabel)}</a>
          <a href="${esc(d.desarrolloHref)}">${esc(d.desarrolloLabel)}</a>`;
      }

      const navCss = [
        s.bg              ? `nav{background:${s.bg}}`                                           : '',
        s.linkColor       ? `.nav-link,.nav-dropdown-trigger{color:${s.linkColor}}`             : '',
        s.dropdownBg      ? `.dropdown-content{background:${s.dropdownBg}}`                    : '',
        s.dropdownLinkColor?`.dropdown-content a{color:${s.dropdownLinkColor}}`                : '',
        s.ctaBg           ? `.btn-contact,.nav-mobile-cta{background:${s.ctaBg}}`              : '',
        s.ctaColor        ? `.btn-contact,.nav-mobile-cta{color:${s.ctaColor}}`                : '',
        s.mobileBg        ? `.nav-mobile-drawer{background:${s.mobileBg}}`                     : '',
        s.mobileLinkColor ? `.nav-mobile-drawer a{color:${s.mobileLinkColor}}`                 : '',
      ].filter(Boolean).join('');
      return `
${navCss ? `<style>${navCss}</style>` : ''}
<nav>
  <div class="max-w-1400">
    <div class="nav-inner">
      <a href="${esc(d.logoSrcHref)}" class="nav-logo">
        <img src="${esc(d.logoSrc)}" alt="SISGRA">
      </a>
      <div class="nav-menu">
        <div class="nav-menu-list">
          ${linksHtml}
        </div>
      </div>
      <div class="nav-contact-wrap">
        <a href="${esc(d.ctaHref)}" class="btn-contact">${esc(d.ctaLabel)}</a>
      </div>
      <button class="nav-mobile-toggle" aria-label="Menú">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
  <div class="nav-mobile-drawer">
    ${mobileLinksHtml}
    <a href="${esc(d.ctaHref)}" class="nav-mobile-cta">${esc(d.ctaLabel)}</a>
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
    icon: `<i class="fa-solid fa-table-columns"></i>`,
    validTipos: ['index'],
    defaultData: {
      badge: 'INFRAESTRUCTURA DE ELITE',
      titulo1: 'Conectamos el futuro',
      titulo2: 'de su empresa.',
      descripcion: 'Diseñamos e implementamos infraestructura tecnológica para las empresas líderes de Argentina. 25 años de trayectoria y más de 500 clientes nos respaldan.',
      boton_primario: 'Ver Soluciones',
      boton_secundario: 'Conocer más',
      stat1_numero: '+25',  stat1_label: 'AÑOS DE EXPERIENCIA',
      stat2_numero: '+500', stat2_label: 'Clientes satisfechos',
    },
    defaultDesign: { bg: '', titleColor: '', accentColor: '', btnBg: '', paddingY: '', titleSize: '', descSize: '', btnRadius: '' },
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
    designFields: [
      { name: 'bg',          label: 'Fondo de sección',           type: 'color' },
      { name: 'titleColor',  label: 'Color título principal',      type: 'color' },
      { name: 'accentColor', label: 'Color acento (subtítulo)',    type: 'color' },
      { name: 'btnBg',       label: 'Botón primario — fondo',      type: 'color' },
      { name: 'paddingY',    label: 'Padding vertical (sección)',  type: 'text', placeholder: 'ej: 6rem' },
      { name: 'titleSize',   label: 'Tamaño título (h1)',          type: 'text', placeholder: 'ej: 3.5rem' },
      { name: 'descSize',    label: 'Tamaño descripción',          type: 'text', placeholder: 'ej: 1rem' },
      { name: 'btnRadius',   label: 'Redondeo botón',              type: 'text', placeholder: 'ej: 0px ó 8px' },
    ],
    render: (data, design) => {
      const h = { ...SECTIONS.hero.defaultData, ...data };
      const s = { ...SECTIONS.hero.defaultDesign, ...design };
      return `
<header class="hero"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="hero-dots"></div>
  <div class="max-w-7xl hero-inner">
    <div class="hero-grid">
      <div>
        <div class="hero-badge">${esc(h.badge)}</div>
        <h1 class="hero-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>
          ${esc(h.titulo1)} <span${css({ color: s.accentColor })}><i>${esc(h.titulo2)}</i></span>
        </h1>
        <p class="hero-desc"${css({ 'font-size': s.descSize })}>${esc(h.descripcion)}</p>
        <div class="hero-buttons">
          <a href="#servicios"><button class="btn-hero-primary"${css({ background: s.btnBg, 'border-color': s.btnBg, 'border-radius': s.btnRadius })}>${esc(h.boton_primario)}</button></a>
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
    icon: `<i class="fa-solid fa-heading"></i>`,
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
    defaultDesign: { bg: '', titleColor: '', accentColor: '', btnBg: '', paddingY: '', titleSize: '', btnRadius: '' },
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
    designFields: [
      { name: 'bg',          label: 'Fondo de sección',          type: 'color' },
      { name: 'titleColor',  label: 'Color título',               type: 'color' },
      { name: 'accentColor', label: 'Color eyebrow / métricas',   type: 'color' },
      { name: 'btnBg',       label: 'Botón primario — fondo',     type: 'color' },
      { name: 'paddingY',    label: 'Padding vertical (sección)', type: 'text', placeholder: 'ej: 6rem' },
      { name: 'titleSize',   label: 'Tamaño título',              type: 'text', placeholder: 'ej: 3rem' },
      { name: 'btnRadius',   label: 'Redondeo botón',             type: 'text', placeholder: 'ej: 0px ó 8px' },
    ],
    render: (data, design) => {
      const h = { ...SECTIONS['hero-centered'].defaultData, ...data };
      const s = { ...SECTIONS['hero-centered'].defaultDesign, ...design };
      const tags = [h.p2_tag1, h.p2_tag2, h.p2_tag3].filter(Boolean);
      const metrics = [
        { num: h.p2_metric1_num, label: h.p2_metric1_label },
        { num: h.p2_metric2_num, label: h.p2_metric2_label },
        { num: h.p2_metric3_num, label: h.p2_metric3_label },
      ].filter(m => m.num);
      return `
<header class="hero-p2"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="hero-p2-inner">
    <div class="hero-p2-eyebrow"${css({ color: s.accentColor })}>${esc(h.p2_eyebrow)}</div>
    <h1 class="hero-p2-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>${esc(h.p2_titulo)}</h1>
    <p class="hero-p2-subtitle">${esc(h.p2_subtitulo)}</p>
    <p class="hero-p2-desc">${esc(h.p2_descripcion)}</p>
    ${tags.length ? `<div class="hero-p2-tags">${tags.map(t => `<span class="hero-p2-tag">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="hero-p2-buttons">
      <a href="#servicios"><button class="btn-hero-primary"${css({ background: s.btnBg, 'border-color': s.btnBg, 'border-radius': s.btnRadius })}>${esc(h.p2_boton_primario)}</button></a>
      <a href="#nosotros"><button class="btn-hero-secondary">${esc(h.p2_boton_secundario)}</button></a>
    </div>
    ${metrics.length ? `
      <div class="hero-p2-metrics">
        ${metrics.map(m => `
          <div class="hero-p2-metric">
            <span class="hero-p2-metric-num"${css({ color: s.accentColor })}>${esc(m.num)}</span>
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
    label: 'Clientes',
    description: 'Carrusel de logos de clientes',
    icon: `<i class="fa-solid fa-images"></i>`,
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
    defaultDesign: { bg: '', paddingY: '', titleColor: '', titleSize: '', trackBg: '', cellBg: '', cellFilter: '', trackHeight: '' },
    dataFields: [
      { name: 'titulo_seccion',  label: 'Título sección', type: 'text' },
      { name: 'carrusel_activo', label: 'Mostrar carrusel', type: 'toggle' },
      { name: 'auto_scroll',     label: 'Auto-scroll',      type: 'toggle' },
      { name: 'clientes',        label: 'Clientes',         type: 'clientes' },
    ],
    designFields: [
      { name: 'bg',          label: 'Fondo de sección',      type: 'color' },
      { name: 'paddingY',    label: 'Padding vertical',      type: 'text', placeholder: 'ej: 3rem' },
      { name: 'titleColor',  label: 'Color título',          type: 'color' },
      { name: 'titleSize',   label: 'Tamaño título',         type: 'text', placeholder: 'ej: 1.5rem' },
      { name: 'trackBg',     label: 'Fondo del track',       type: 'color' },
      { name: 'cellBg',      label: 'Fondo celda logo',      type: 'color' },
      { name: 'cellFilter',  label: 'Filtro logos (CSS)',    type: 'text', placeholder: 'ej: grayscale(1) ó invert(1)' },
      { name: 'trackHeight', label: 'Altura del track',      type: 'text', placeholder: 'ej: 80px' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS.clientes.defaultData, ...data };
      const s = { ...SECTIONS.clientes.defaultDesign, ...design };
      if (d.carrusel_activo === false) return '';
      const clientes = (d.clientes || []).filter(c => c.activo !== false);
      const cells = [...clientes, ...clientes, ...clientes].map(c => `
        <div class="logos-cell"${css({ background: s.cellBg })}>
          ${c.imagen ? `<img src="${esc(c.imagen)}" alt="${esc(c.nombre)}"${css({ filter: s.cellFilter })}>` : `<div class="logos-cell-text">${esc(c.nombre)}</div>`}
        </div>`).join('');
      return `
<section class="logos-section" id="section-clientes"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="max-w-7xl">
    <div class="logos-header">
      <h2 class="logos-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>${esc(d.titulo_seccion)}</h2>
    </div>
    <div class="logos-track-wrapper">
      <div class="logos-track ${d.auto_scroll !== false ? 'is-animating' : ''}" data-clientes-track data-auto-scroll="${d.auto_scroll !== false}"${css({ background: s.trackBg, height: s.trackHeight })}>${cells}</div>
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
    icon: `<i class="fa-solid fa-newspaper"></i>`,
    validTipos: ['index'],
    defaultData: {
      titulo_seccion: 'Novedades & Blog',
      posts: [
        { titulo: 'Certificación Cat 8: el estándar que toda empresa necesita', extracto: 'Conocé por qué la Categoría 8 es la elección inteligente para infraestructuras de alta demanda de datos.', categoria: 'Novedades', imagen: '' },
        { titulo: 'Cómo reducir el tiempo de inactividad con soporte IT proactivo', extracto: 'Estrategias comprobadas para mantener tu infraestructura funcionando con 99.9% de disponibilidad.', categoria: 'Soporte IT', imagen: '' },
        { titulo: 'Fibra Óptica FTTH: conectividad sin límites para tu empresa', extracto: 'Ventajas de implementar fibra óptica en instalaciones corporativas de gran escala en Argentina.', categoria: 'Instalaciones', imagen: '' },
      ],
    },
    defaultDesign: { bg: '', paddingY: '', titleColor: '', titleSize: '', cardBg: '', cardBorderColor: '', cardRadius: '', cardTitleColor: '', cardTextColor: '', tagBg: '', tagColor: '', linkColor: '' },
    dataFields: [
      { name: 'titulo_seccion', label: 'Título sección', type: 'text' },
      { name: 'posts',          label: 'Artículos',      type: 'posts' },
    ],
    designFields: [
      { name: 'bg',              label: 'Fondo de sección',       type: 'color' },
      { name: 'paddingY',        label: 'Padding vertical',       type: 'text', placeholder: 'ej: 4rem' },
      { name: 'titleColor',      label: 'Color título sección',   type: 'color' },
      { name: 'titleSize',       label: 'Tamaño título sección',  type: 'text', placeholder: 'ej: 2.5rem' },
      { name: 'cardBg',          label: 'Fondo de cards',         type: 'color' },
      { name: 'cardBorderColor', label: 'Borde de cards',         type: 'color' },
      { name: 'cardRadius',      label: 'Redondeo de cards',      type: 'text', placeholder: 'ej: 12px' },
      { name: 'cardTitleColor',  label: 'Título de card',         type: 'color' },
      { name: 'cardTextColor',   label: 'Extracto de card',       type: 'color' },
      { name: 'tagBg',           label: 'Badge categoría — fondo',type: 'color' },
      { name: 'tagColor',        label: 'Badge categoría — texto',type: 'color' },
      { name: 'linkColor',       label: 'Color enlace "Leer más"',type: 'color' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS.blog.defaultData, ...data };
      const s = { ...SECTIONS.blog.defaultDesign, ...design };
      // El grid se hidrata en vivo desde /api/data/blog (posts publicados).
      // Los colores de diseño se pasan por data-* y los aplica hydrateBlogCards().
      const dataAttrs = [
        `data-blog-cards`,
        `data-limit="3"`,
        s.cardBg          ? `data-card-bg="${esc(s.cardBg)}"`            : '',
        s.cardBorderColor ? `data-card-border="${esc(s.cardBorderColor)}"` : '',
        s.cardRadius      ? `data-card-radius="${esc(s.cardRadius)}"`     : '',
        s.cardTitleColor  ? `data-card-title="${esc(s.cardTitleColor)}"`  : '',
        s.cardTextColor   ? `data-card-text="${esc(s.cardTextColor)}"`    : '',
        s.tagBg           ? `data-tag-bg="${esc(s.tagBg)}"`              : '',
        s.tagColor        ? `data-tag-color="${esc(s.tagColor)}"`        : '',
        s.linkColor       ? `data-link-color="${esc(s.linkColor)}"`      : '',
      ].filter(Boolean).join(' ');
      return `
<section class="blog-section"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="max-w-7xl">
    <div class="blog-header">
      <h2 class="blog-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>${esc(d.titulo_seccion)}</h2>
    </div>
    <div class="blog-grid" ${dataAttrs}>
      <div style="grid-column:1/-1;text-align:center;padding:3rem 0;color:#94a3b8;font-size:.875rem;">Cargando artículos…</div>
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
    icon: `<i class="fa-solid fa-table-cells-large"></i>`,
    validTipos: ['index'],
    defaultData: {
      titulo_seccion: 'Portafolio de Soluciones',
      eyebrow: 'Lo que hacemos',
      cards: [
        { id: 'instalaciones', titulo: 'Instalaciones', descripcion: 'Cableado Cat 8, Fibra Óptica FTTH/FTTX y Seguridad Electrónica certificada bajo normas TIA/EIA para entornos corporativos exigentes.', enlace: './html/cableado_estructurado' },
        { id: 'soporte',       titulo: 'Soporte IT',    descripcion: 'Mantenimiento integral de infraestructura tecnológica, asistencia técnica 24/7 y gestión proactiva para garantizar continuidad operativa.', enlace: './html/soporte_it' },
        { id: 'software',      titulo: 'Desarrollo de Software', descripcion: 'Soluciones digitales a medida: sistemas de gestión logística, control de inventario y procesos empresariales integrados.', enlace: './html/desarrollo' },
      ],
    },
    defaultDesign: { bg: '', sectionColor: '', cardBg: '', cardTitleColor: '', cardLinkColor: '', paddingY: '', titleSize: '', cardRadius: '', cardPadding: '', gap: '' },
    dataFields: [
      { name: 'titulo_seccion', label: 'Título sección', type: 'text' },
      { name: 'eyebrow',        label: 'Eyebrow',        type: 'text' },
      { name: 'cards',          label: 'Cards',          type: 'cards' },
    ],
    designFields: [
      { name: 'bg',             label: 'Fondo de sección',          type: 'color' },
      { name: 'sectionColor',   label: 'Color título sección',      type: 'color' },
      { name: 'cardBg',         label: 'Fondo de cards',            type: 'color' },
      { name: 'cardTitleColor', label: 'Título de cards',           type: 'color' },
      { name: 'cardLinkColor',  label: 'Color enlace cards',        type: 'color' },
      { name: 'paddingY',       label: 'Padding vertical sección',  type: 'text', placeholder: 'ej: 4rem' },
      { name: 'titleSize',      label: 'Tamaño título sección',     type: 'text', placeholder: 'ej: 2.5rem' },
      { name: 'cardRadius',     label: 'Redondeo de cards',         type: 'text', placeholder: 'ej: 0px ó 12px' },
      { name: 'cardPadding',    label: 'Padding interno cards',     type: 'text', placeholder: 'ej: 2rem' },
      { name: 'gap',            label: 'Espacio entre cards',       type: 'text', placeholder: 'ej: 1.5rem' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS.services.defaultData, ...data };
      const s = { ...SECTIONS.services.defaultDesign, ...design };
      const SERVICE_ICONS = {
        instalaciones: `<i class="fa-solid fa-server fa-2xl"></i>`,
        soporte:       `<i class="fa-solid fa-headset fa-2xl"></i>`,
        software:      `<i class="fa-solid fa-code fa-2xl"></i>`,
      };
      return `
<section id="servicios" class="services-section"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="max-w-7xl">
    <div class="services-header">
      <h2 class="services-title"${css({ color: s.sectionColor, 'font-size': s.titleSize })}>${esc(d.titulo_seccion)}</h2>
    </div>
    <div class="cards-grid"${css({ gap: s.gap })}>
      ${(d.cards||[]).map(c => `
        <div class="service-card"${css({ background: s.cardBg, 'border-radius': s.cardRadius, padding: s.cardPadding })}>
          <div class="card-icon">${SERVICE_ICONS[c.id] || ''}</div>
          <h3 class="card-title"${css({ color: s.cardTitleColor })}>${esc(c.titulo)}</h3>
          <p class="card-desc">${esc(c.descripcion)}</p>
          <a href="${esc(c.enlace||'#')}" class="card-link"${css({ color: s.cardLinkColor })}>Ver Detalles <i class="fa-solid fa-arrow-right fa-lg" aria-hidden="true"></i></a>
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
    icon: `<i class="fa-solid fa-image"></i>`,
    validTipos: ['index'],
    defaultData: {
      eyebrow: 'Excelencia Corporativa',
      titulo: 'Liderando la industria\ndesde el año 1999.',
      descripcion: 'En SISGRA, entendemos que la infraestructura crítica no permite errores. Cada proyecto atraviesa un riguroso proceso de planificación, ejecución certificada y soporte post-instalación que garantiza resultados duraderos para su organización.',
      imagen: '/img/img1.png',
    },
    defaultDesign: { bg: '', eyebrowColor: '', titleColor: '', textColor: '', paddingY: '', titleSize: '' },
    dataFields: [
      { name: 'eyebrow',     label: 'Eyebrow',           type: 'text' },
      { name: 'titulo',      label: 'Título (\\n = <br>)',type: 'textarea' },
      { name: 'descripcion', label: 'Descripción',       type: 'textarea' },
      { name: 'imagen',      label: 'URL imagen',        type: 'text' },
    ],
    designFields: [
      { name: 'bg',           label: 'Fondo de sección',          type: 'color' },
      { name: 'eyebrowColor', label: 'Color eyebrow',             type: 'color' },
      { name: 'titleColor',   label: 'Color título',              type: 'color' },
      { name: 'textColor',    label: 'Color texto',               type: 'color' },
      { name: 'paddingY',     label: 'Padding vertical sección',  type: 'text', placeholder: 'ej: 5rem' },
      { name: 'titleSize',    label: 'Tamaño título (h3)',         type: 'text', placeholder: 'ej: 2.5rem' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS.about.defaultData, ...data };
      const s = { ...SECTIONS.about.defaultDesign, ...design };
      return `
<section id="nosotros" class="about-section"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="max-w-7xl">
    <div class="about-inner">
      <div class="about-img-wrap">
        <div class="about-img-frame">
          <img src="${esc(d.imagen)}" alt="Imagen Corporativa">
        </div>
      </div>
      <div class="about-content">
        <p class="about-eyebrow"${css({ color: s.eyebrowColor })}>${esc(d.eyebrow)}</p>
        <h3 class="about-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>${String(d.titulo||'').split('\n').map(esc).join('<br>')}</h3>
        <p class="about-desc"${css({ color: s.textColor })}>${esc(d.descripcion)}</p>
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
    icon: `<i class="fa-solid fa-bullhorn"></i>`,
    validTipos: ['index'],
    defaultData: {
      title: '¿Listo para transformar su infraestructura?',
      desc: 'Hablemos sin compromiso. Analizamos su proyecto y le ofrecemos la mejor solución.',
      btn: 'Solicitar Presupuesto',
      href: 'https://wa.me/548101220065',
    },
    defaultDesign: {
      bg: '#0A1D37', btnBg: '#2563eb', paddingY: '', btnRadius: '',
    },
    dataFields: [
      { name: 'title', label: 'Título',      type: 'text' },
      { name: 'desc',  label: 'Descripción', type: 'text' },
      { name: 'btn',   label: 'Texto botón', type: 'text' },
      { name: 'href',  label: 'Link botón',  type: 'text' },
    ],
    designFields: [
      { name: 'bg',        label: 'Color fondo',             type: 'color' },
      { name: 'btnBg',     label: 'Color botón',             type: 'color' },
      { name: 'paddingY',  label: 'Padding vertical sección',type: 'text', placeholder: 'ej: 4rem' },
      { name: 'btnRadius', label: 'Redondeo botón',          type: 'text', placeholder: 'ej: 0px ó 8px' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS.cta.defaultData, ...data };
      const s = { ...SECTIONS.cta.defaultDesign, ...design };
      const py = s.paddingY || '4rem';
      return `
<section style="background:${s.bg};padding:${py};display:flex;align-items:center;justify-content:space-between;gap:2rem;flex-wrap:wrap;">
  <div>
    <h2 style="font-size:2rem;font-weight:900;color:#fff;letter-spacing:-.04em;font-style:italic;margin-bottom:.5rem;">${esc(d.title)}</h2>
    <p style="color:rgba(255,255,255,.6);font-size:.9375rem;">${esc(d.desc)}</p>
  </div>
  <a href="${esc(d.href)}" style="background:${s.btnBg};color:#fff;padding:.875rem 2rem;font-size:.75rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;white-space:nowrap;flex-shrink:0;${s.btnRadius ? `border-radius:${s.btnRadius};` : ''}">${esc(d.btn)}</a>
</section>`;
    },
  },

  // ─────────────────────────────────────────────────────────────────
  //  SPACER
  // ─────────────────────────────────────────────────────────────────
  spacer: {
    label: 'Espaciador',
    description: 'Espacio en blanco',
    icon: `<i class="fa-solid fa-arrows-up-down"></i>`,
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
    icon: `<i class="fa-solid fa-grip-lines"></i>`,
    validTipos: ['index'],
    defaultData: {
      formTitulo: 'Solicite un presupuesto',
      formDesc: 'Cuéntenos sobre su organización. Un asesor se comunicará para recomendarle la mejor solución.',
      whatsapp: '548101220065',
      whatsappText: 'Consultar por WhatsApp',
      formLabel: 'Complete el formulario',
      btnEnviar: 'Enviar consulta',
      brandImg: '/img/sisgra_blanco.png',
      copyright: '© 2026 SISGRA S.R.L. — Todos los derechos reservados',
    },
    defaultDesign: { topBg: '', panelLeftBg: '', panelRightBg: '', titleColor: '', descColor: '', btnWaBg: '', btnWaColor: '', submitBg: '', submitColor: '', bottomBg: '', linkColor: '', copyBg: '', copyColor: '' },
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
    designFields: [
      { name: 'topBg',        label: 'Fondo panel superior',     type: 'color' },
      { name: 'panelLeftBg',  label: 'Fondo panel izquierdo',    type: 'color' },
      { name: 'panelRightBg', label: 'Fondo panel formulario',   type: 'color' },
      { name: 'titleColor',   label: 'Color título',             type: 'color' },
      { name: 'descColor',    label: 'Color descripción',        type: 'color' },
      { name: 'btnWaBg',      label: 'Botón WhatsApp — fondo',   type: 'color' },
      { name: 'btnWaColor',   label: 'Botón WhatsApp — texto',   type: 'color' },
      { name: 'submitBg',     label: 'Botón enviar — fondo',     type: 'color' },
      { name: 'submitColor',  label: 'Botón enviar — texto',     type: 'color' },
      { name: 'bottomBg',     label: 'Franja inferior — fondo',  type: 'color' },
      { name: 'linkColor',    label: 'Color enlaces inferiores', type: 'color' },
      { name: 'copyBg',       label: 'Fondo copyright',         type: 'color' },
      { name: 'copyColor',    label: 'Color copyright',         type: 'color' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS.footer.defaultData, ...data };
      const s = { ...SECTIONS.footer.defaultDesign, ...design };
      return `
<footer>
  <div class="footer-top"${css({ background: s.topBg })}>
    <div class="panel-left"${css({ background: s.panelLeftBg })}>
      <div>
        <p class="section-label">Contacto</p>
        <h2${css({ color: s.titleColor })}>${esc(d.formTitulo)}</h2>
        <p class="panel-desc"${css({ color: s.descColor })}>${esc(d.formDesc)}</p>
      </div>
      <div class="action-buttons">
        <a href="https://wa.me/${esc(d.whatsapp)}" class="btn btn-whatsapp"${css({ background: s.btnWaBg, color: s.btnWaColor })}>
          <i class="fa-brands fa-whatsapp fa-xl" aria-hidden="true"></i>
          ${esc(d.whatsappText)}
        </a>
      </div>
    </div>
    <div class="panel-right"${css({ background: s.panelRightBg })}>
      <p class="form-title">${esc(d.formLabel)}</p>
      <div class="form-grid">
        <div class="field"><label>Nombre</label><input type="text" placeholder="Su nombre completo"/></div>
        <div class="field"><label>Empresa</label><input type="text" placeholder="Nombre de la organización"/></div>
        <div class="field"><label>Teléfono</label><input type="tel" placeholder="Ej.: 341 0000000"/></div>
        <div class="field"><label>Email</label><input type="email" placeholder="nombre@empresa.com"/></div>
        <div class="field full"><label>Mensaje</label><textarea placeholder="Cuéntenos qué necesita resolver"></textarea></div>
      </div>
      <button class="btn-submit"${css({ background: s.submitBg, color: s.submitColor })}>${esc(d.btnEnviar)}</button>
    </div>
  </div>
  <div class="footer-bottom"${css({ background: s.bottomBg })}>
    <div class="footer-brand"><img src="${esc(d.brandImg)}" alt="SISGRA"></div>
    <div class="footer-links">
      <a href="/html/cableado_estructurado"${css({ color: s.linkColor })}>Cableado Estructurado</a>
      <a href="/html/fibra_optica"${css({ color: s.linkColor })}>Fibra Óptica</a>
      <a href="/html/seguridad"${css({ color: s.linkColor })}>Seguridad Electrónica</a>
      <a href="/html/soporte_it"${css({ color: s.linkColor })}>Soporte IT</a>
      <a href="/html/desarrollo"${css({ color: s.linkColor })}>Desarrollo de Software</a>
      <a href="/html/blog"${css({ color: s.linkColor })}>Blog</a>
    </div>
  </div>
  <div class="footer-copy"${css({ background: s.copyBg })}><span${css({ color: s.copyColor })}>${esc(d.copyright)}</span></div>
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
    icon: `<i class="fa-solid fa-table-columns"></i>`,
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
    defaultDesign: { bg: '', titleColor: '', accentColor: '', paddingY: '', titleSize: '' },
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
    designFields: [
      { name: 'bg',          label: 'Fondo de sección',         type: 'color' },
      { name: 'titleColor',  label: 'Color título',             type: 'color' },
      { name: 'accentColor', label: 'Color acento',             type: 'color' },
      { name: 'paddingY',    label: 'Padding vertical sección', type: 'text', placeholder: 'ej: 5rem' },
      { name: 'titleSize',   label: 'Tamaño título (h2)',       type: 'text', placeholder: 'ej: 3rem' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS['cableado-hero'].defaultData, ...data };
      const s = { ...SECTIONS['cableado-hero'].defaultDesign, ...design };
      const pct = Math.max(0, Math.min(100, Number(d.progressPct) || 0));
      return `
<section id="cableado-estructurado" class="section-cableado"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="container-7xl">
    <div class="section-header">
      <div class="badge-infra">${esc(d.badge)}</div>
      <h2 class="section-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>
        ${esc(d.titulo1)} <br>
        <span class="accent"${css({ color: s.accentColor })}>${esc(d.accent)}</span>
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
    icon: `<i class="fa-solid fa-table-columns"></i>`,
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
    defaultDesign: { bg: '', titleColor: '', accentColor: '', paddingY: '', titleSize: '' },
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
    designFields: [
      { name: 'bg',          label: 'Fondo de sección',         type: 'color' },
      { name: 'titleColor',  label: 'Color título',             type: 'color' },
      { name: 'accentColor', label: 'Color acento',             type: 'color' },
      { name: 'paddingY',    label: 'Padding vertical sección', type: 'text', placeholder: 'ej: 5rem' },
      { name: 'titleSize',   label: 'Tamaño título (h2)',       type: 'text', placeholder: 'ej: 3rem' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS['fibra-hero'].defaultData, ...data };
      const s = { ...SECTIONS['fibra-hero'].defaultDesign, ...design };
      const icon = (type) => {
        const i = {
          location:  '<i class="fa-solid fa-location-dot" aria-hidden="true"></i>',
          lightning: '<i class="fa-solid fa-bolt" aria-hidden="true"></i>',
          shield:    '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>',
          check:     '<i class="fa-solid fa-check" aria-hidden="true"></i>',
        };
        return i[type] || i.check;
      };
      return `
<section id="fibra-optica" class="section-fibra"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
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
        <h2 class="section-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>
          ${esc(d.titulo1)} <br/>
          <span class="accent"${css({ color: s.accentColor })}>${esc(d.accent)}</span>
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
    icon: `<i class="fa-solid fa-table-columns"></i>`,
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
    defaultDesign: { bg: '', titleColor: '', accentColor: '', paddingY: '', titleSize: '' },
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
    designFields: [
      { name: 'bg',          label: 'Fondo de sección',         type: 'color' },
      { name: 'titleColor',  label: 'Color título',             type: 'color' },
      { name: 'accentColor', label: 'Color línea 2',            type: 'color' },
      { name: 'paddingY',    label: 'Padding vertical sección', type: 'text', placeholder: 'ej: 5rem' },
      { name: 'titleSize',   label: 'Tamaño título (h2)',       type: 'text', placeholder: 'ej: 3rem' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS['seguridad-hero'].defaultData, ...data };
      const s = { ...SECTIONS['seguridad-hero'].defaultDesign, ...design };
      const icon = (type) => {
        const i = {
          location:  '<i class="fa-solid fa-location-dot" aria-hidden="true"></i>',
          lightning: '<i class="fa-solid fa-bolt" aria-hidden="true"></i>',
          shield:    '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>',
          check:     '<i class="fa-solid fa-check" aria-hidden="true"></i>',
          camera:    '<i class="fa-solid fa-video" aria-hidden="true"></i>',
        };
        return i[type] || i.check;
      };
      return `
<section id="seguridad-electronica"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="section-bg-overlay"></div>
  <div class="section-inner">
    <div class="section-flex">
      <div class="section-content">
        <div class="badge">${esc(d.badge)}</div>
        <h2 class="section-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>
          <span><i>${esc(d.titulo1)}</i></span><br>
          <span${css({ color: s.accentColor })}><i>${esc(d.titulo2)}</i></span>
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
    icon: `<i class="fa-solid fa-table-columns"></i>`,
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
      btnRemote: 'Acceder al Soporte Remoto Inmediato',
    },
    defaultDesign: { bg: '', titleColor: '', accentColor: '', paddingY: '', titleSize: '' },
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
    designFields: [
      { name: 'bg',          label: 'Fondo de sección',         type: 'color' },
      { name: 'titleColor',  label: 'Color título',             type: 'color' },
      { name: 'accentColor', label: 'Color acento',             type: 'color' },
      { name: 'paddingY',    label: 'Padding vertical sección', type: 'text', placeholder: 'ej: 5rem' },
      { name: 'titleSize',   label: 'Tamaño título (h2)',       type: 'text', placeholder: 'ej: 3rem' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS['soporte-hero'].defaultData, ...data };
      const s = { ...SECTIONS['soporte-hero'].defaultDesign, ...design };
      const icon = (type) => {
        const i = {
          location:  '<i class="fa-solid fa-location-dot" aria-hidden="true"></i>',
          lightning: '<i class="fa-solid fa-bolt" aria-hidden="true"></i>',
          shield:    '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>',
          check:     '<i class="fa-solid fa-check" aria-hidden="true"></i>',
          camera:    '<i class="fa-solid fa-video" aria-hidden="true"></i>',
          gear:      '<i class="fa-solid fa-gear" aria-hidden="true"></i>',
          lock:      '<i class="fa-solid fa-lock" aria-hidden="true"></i>',
        };
        return i[type] || i.gear;
      };
      return `
<section id="soporte-it" class="hero-section"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="container hero-grid">
    <div class="hero-content">
      <div class="badge">${esc(d.badge)}</div>
      <h2 class="hero-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>
        ${esc(d.titulo1)} <br/>
        <span class="text-blue"${css({ color: s.accentColor })}>${esc(d.accent)}</span>
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
          <button class="btn-remote">${esc(String(d.btnRemote ?? '').replace(/\s*🎧\s*$/,''))} <i class="fa-solid fa-headset" aria-hidden="true"></i></button>
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
    icon: `<i class="fa-solid fa-table-columns"></i>`,
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
    defaultDesign: { bg: '', titleColor: '', accentColor: '', paddingY: '', titleSize: '' },
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
    designFields: [
      { name: 'bg',          label: 'Fondo de sección',         type: 'color' },
      { name: 'titleColor',  label: 'Color título',             type: 'color' },
      { name: 'accentColor', label: 'Color acento',             type: 'color' },
      { name: 'paddingY',    label: 'Padding vertical sección', type: 'text', placeholder: 'ej: 5rem' },
      { name: 'titleSize',   label: 'Tamaño título (h2)',       type: 'text', placeholder: 'ej: 3rem' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS['desarrollo-hero'].defaultData, ...data };
      const s = { ...SECTIONS['desarrollo-hero'].defaultDesign, ...design };
      const icon = (type) => {
        const i = {
          location:  '<i class="fa-solid fa-location-dot" aria-hidden="true"></i>',
          lightning: '<i class="fa-solid fa-bolt" aria-hidden="true"></i>',
          shield:    '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>',
          gear:      '<i class="fa-solid fa-gear" aria-hidden="true"></i>',
          chart:     '<i class="fa-solid fa-chart-column" aria-hidden="true"></i>',
          database:  '<i class="fa-solid fa-database" aria-hidden="true"></i>',
          camera:    '<i class="fa-solid fa-video" aria-hidden="true"></i>',
          check:     '<i class="fa-solid fa-check" aria-hidden="true"></i>',
          lock:      '<i class="fa-solid fa-lock" aria-hidden="true"></i>',
        };
        return i[type] || i.gear;
      };
      return `
<section id="software"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="software-container">
    <div class="software-inner">
      <div class="software-text">
        <div class="badge">${esc(d.badge)}</div>
        <h2 class="software-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>
          ${esc(d.titulo1)} <br>
          <span${css({ color: s.accentColor })}>${esc(d.accent)}</span>
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
    icon: `<i class="fa-solid fa-list"></i>`,
    validTipos: ['blog'],
    defaultData: {
      loadingMessage: 'Cargando artículos…',
      emptyMessage: 'No hay artículos publicados aún.',
      errorMessage: 'No se pudieron cargar los artículos.',
    },
    defaultDesign: { bg: '', paddingTop: '', paddingBottom: '', textColor: '', cardBg: '', cardBorderColor: '', cardRadius: '', cardTitleColor: '', cardTagBg: '', cardTagColor: '', cardLinkColor: '' },
    dataFields: [
      { name: 'loadingMessage', label: 'Mensaje cargando', type: 'text' },
      { name: 'emptyMessage',   label: 'Mensaje vacío',    type: 'text' },
      { name: 'errorMessage',   label: 'Mensaje error',    type: 'text' },
    ],
    designFields: [
      { name: 'bg',              label: 'Fondo de sección',        type: 'color' },
      { name: 'paddingTop',      label: 'Padding superior',        type: 'text', placeholder: 'ej: 4rem' },
      { name: 'paddingBottom',   label: 'Padding inferior',        type: 'text', placeholder: 'ej: 4rem' },
      { name: 'textColor',       label: 'Color texto base',        type: 'color' },
      { name: 'cardBg',          label: 'Fondo de cards',          type: 'color' },
      { name: 'cardBorderColor', label: 'Borde de cards',          type: 'color' },
      { name: 'cardRadius',      label: 'Redondeo de cards',       type: 'text', placeholder: 'ej: 12px' },
      { name: 'cardTitleColor',  label: 'Título de cards',         type: 'color' },
      { name: 'cardTagBg',       label: 'Tag categoría — fondo',   type: 'color' },
      { name: 'cardTagColor',    label: 'Tag categoría — texto',   type: 'color' },
      { name: 'cardLinkColor',   label: 'Color enlace cards',      type: 'color' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS['blog-list'].defaultData, ...data };
      const s = { ...SECTIONS['blog-list'].defaultDesign, ...design };
      const blCss = [
        s.bg              ? `.blog-container{background:${s.bg}}`                     : '',
        s.textColor       ? `.blog-container{color:${s.textColor}}`                   : '',
        s.cardBg          ? `.blog-row-card{background:${s.cardBg}}`                  : '',
        s.cardBorderColor ? `.blog-row-card{border-color:${s.cardBorderColor}}`       : '',
        s.cardRadius      ? `.blog-row-card{border-radius:${s.cardRadius}}`           : '',
        s.cardTitleColor  ? `.blog-row-card h2,.blog-row-card h3{color:${s.cardTitleColor}}` : '',
        s.cardTagBg       ? `.blog-tag,.blog-row-tag{background:${s.cardTagBg}}`      : '',
        s.cardTagColor    ? `.blog-tag,.blog-row-tag{color:${s.cardTagColor}}`        : '',
        s.cardLinkColor   ? `.blog-row-card a{color:${s.cardLinkColor}}`              : '',
      ].filter(Boolean).join('');
      return `
${blCss ? `<style>${blCss}</style>` : ''}
<section class="blog-container"${css({ background: s.bg, color: s.textColor })}>
  <div class="max-w-7xl"${css({ 'padding-top': s.paddingTop || '4rem', 'padding-bottom': s.paddingBottom })}>
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
    icon: `<i class="fa-solid fa-heading"></i>`,
    validTipos: ['articulo', 'cliente'],
    defaultData: {
      backLabel: '← Volver al Blog',
      backHref: '/html/blog',
      badge: 'Infraestructura',
      titulo: 'Nuevos estándares de certificación Cat8 para plantas industriales',
      lead: 'Análisis detallado sobre cómo la infraestructura física determina el rendimiento de los sistemas de datos en entornos de alta demanda.',
      fecha: '',
    },
    defaultDesign: { bg: '', paddingY: '', titleColor: '', titleSize: '', leadColor: '', leadSize: '', backLinkColor: '', badgeBg: '', badgeColor: '' },
    dataFields: [
      { name: 'backLabel', label: 'Link volver — Texto', type: 'text' },
      { name: 'backHref',  label: 'Link volver — URL',   type: 'text' },
      { name: 'badge',     label: 'Categoría (badge)',   type: 'text' },
      { name: 'titulo',    label: 'Título principal',    type: 'textarea' },
      { name: 'lead',      label: 'Subtítulo / lead',    type: 'textarea' },
    ],
    designFields: [
      { name: 'bg',            label: 'Fondo del header',      type: 'color' },
      { name: 'paddingY',      label: 'Padding vertical',      type: 'text', placeholder: 'ej: 4rem' },
      { name: 'titleColor',    label: 'Color título',          type: 'color' },
      { name: 'titleSize',     label: 'Tamaño título',         type: 'text', placeholder: 'ej: 2.5rem' },
      { name: 'leadColor',     label: 'Color lead / subtítulo',type: 'color' },
      { name: 'leadSize',      label: 'Tamaño lead',           type: 'text', placeholder: 'ej: 1.125rem' },
      { name: 'backLinkColor', label: 'Color enlace volver',   type: 'color' },
      { name: 'badgeBg',       label: 'Badge — fondo',         type: 'color' },
      { name: 'badgeColor',    label: 'Badge — texto',         type: 'color' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS['articulo-header'].defaultData, ...data };
      const s = { ...SECTIONS['articulo-header'].defaultDesign, ...design };
      return `
<header class="article-header"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="max-w-7xl">
    <a href="${esc(d.backHref)}" class="back-link"${css({ color: s.backLinkColor })}><i class="fa-solid fa-arrow-left fa-lg" aria-hidden="true"></i> ${esc(stripArrow(d.backLabel))}</a>
    <div class="article-meta">
      <span class="badge-tech"${css({ background: s.badgeBg, color: s.badgeColor })}>${esc(d.badge)}</span>
      ${d.fecha ? `<span style="font-size:.75rem;opacity:.7;font-weight:600;">${esc(d.fecha)}</span>` : ''}
    </div>
    <h1 class="article-main-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>${esc(d.titulo)}</h1>
    <p class="article-lead"${css({ color: s.leadColor, 'font-size': s.leadSize })}>${esc(d.lead)}</p>
  </div>
</header>`;
    },
  },

  'articulo-body': {
    label: 'Cuerpo del artículo',
    description: 'Cuerpo del artículo: imagen + contenido HTML libre + CTA + sidebar',
    icon: `<i class="fa-solid fa-paragraph"></i>`,
    validTipos: ['articulo', 'cliente'],
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
    defaultDesign: { bg: '', paddingY: '', bodyTextColor: '', ctaBg: '', ctaTitleColor: '', ctaTextColor: '', ctaBtnBg: '', ctaBtnColor: '', sidebarBg: '', sidebarTitleColor: '', sidebarTextColor: '', imgRadius: '' },
    dataFields: [
      // featuredImageUrl, featuredImageAlt y contentHtml vienen del post de blog (?id=)
      { name: 'featuredImageUrl', label: 'Imagen de respaldo (sin ?id=)', type: 'text' },
      { name: 'ctaTitle',         label: 'CTA — Título',           type: 'text' },
      { name: 'ctaText',          label: 'CTA — Texto',            type: 'textarea' },
      { name: 'ctaBtnLabel',      label: 'CTA — Botón texto',      type: 'text' },
      { name: 'ctaBtnHref',       label: 'CTA — Botón URL',        type: 'text' },
      { name: 'sidebarTitle',     label: 'Sidebar — Título',       type: 'text' },
      { name: 'sidebarText',      label: 'Sidebar — Texto',        type: 'textarea' },
    ],
    designFields: [
      { name: 'bg',               label: 'Fondo de sección',        type: 'color' },
      { name: 'paddingY',         label: 'Padding vertical',        type: 'text', placeholder: 'ej: 3rem' },
      { name: 'bodyTextColor',    label: 'Color texto cuerpo',      type: 'color' },
      { name: 'imgRadius',        label: 'Redondeo imagen',         type: 'text', placeholder: 'ej: 12px' },
      { name: 'ctaBg',            label: 'CTA — fondo',             type: 'color' },
      { name: 'ctaTitleColor',    label: 'CTA — color título',      type: 'color' },
      { name: 'ctaTextColor',     label: 'CTA — color texto',       type: 'color' },
      { name: 'ctaBtnBg',         label: 'CTA botón — fondo',       type: 'color' },
      { name: 'ctaBtnColor',      label: 'CTA botón — texto',       type: 'color' },
      { name: 'sidebarBg',        label: 'Sidebar — fondo',         type: 'color' },
      { name: 'sidebarTitleColor',label: 'Sidebar — color título',  type: 'color' },
      { name: 'sidebarTextColor', label: 'Sidebar — color texto',   type: 'color' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS['articulo-body'].defaultData, ...data };
      const s = { ...SECTIONS['articulo-body'].defaultDesign, ...design };
      // contentHtml is INTENTIONALLY rendered as raw HTML (no escape) — editor users can paste rich content
      return `
<main class="article-container"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="max-w-7xl article-grid">
    <div class="article-body"${css({ color: s.bodyTextColor })}>
      ${d.featuredImageUrl ? `<img src="${esc(d.featuredImageUrl)}" alt="${esc(d.featuredImageAlt)}" class="featured-image"${css({ 'border-radius': s.imgRadius })}>` : ''}
      ${d.contentHtml || ''}
      <div class="article-cta"${css({ background: s.ctaBg })}>
        <h3${css({ color: s.ctaTitleColor })}>${esc(d.ctaTitle)}</h3>
        <p${css({ color: s.ctaTextColor })}>${esc(d.ctaText)}</p>
        <a href="${esc(d.ctaBtnHref)}" class="btn-hero-primary"${css({ background: s.ctaBtnBg || 'var(--sisgra-blue)', color: s.ctaBtnColor || 'white' })}>${esc(d.ctaBtnLabel)}</a>
      </div>
    </div>
    <aside class="article-sidebar">
      <div class="sidebar-box dark"${css({ background: s.sidebarBg })}>
        <h4${css({ color: s.sidebarTitleColor })}>${esc(d.sidebarTitle)}</h4>
        <p${css({ color: s.sidebarTextColor })}>${esc(d.sidebarText)}</p>
      </div>
    </aside>
  </div>
</main>`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  //  MÓDULOS CLIENTE (caso de éxito / perfil de cliente)
  //  Diseño propio en css/pages/cliente.css (clases cl-*)
  // ═══════════════════════════════════════════════════════════════════

  'cliente-header': {
    label: 'Header de cliente',
    description: 'Cabecera de caso: logo empresa + nombre + título de proyecto + lead + meta',
    icon: `<i class="fa-solid fa-id-card"></i>`,
    validTipos: ['cliente'],
    defaultData: {
      backLabel: '← Volver al Inicio',
      backHref: '/index.html',
      empresaLogo: '/img/clients/syngenta.png',
      empresaNombre: 'Nombre de la empresa',
      titulo: 'Caso de éxito: infraestructura tecnológica a medida',
      lead: 'Resumen breve del proyecto que SISGRA realizó para este cliente.',
      sector: 'Industria',
      ubicacion: 'Rosario, Argentina',
      anio: '2025',
    },
    defaultDesign: { bg: '', paddingY: '', eyebrowColor: '', titleColor: '', titleSize: '', leadColor: '', metaColor: '', backLinkColor: '', logoMaxHeight: '' },
    dataFields: [
      { name: 'backLabel',     label: 'Link volver — Texto', type: 'text' },
      { name: 'backHref',      label: 'Link volver — URL',   type: 'text' },
      { name: 'empresaLogo',   label: 'Logo empresa (URL)',  type: 'text' },
      { name: 'empresaNombre', label: 'Nombre empresa',      type: 'text' },
      { name: 'titulo',        label: 'Título del proyecto', type: 'textarea' },
      { name: 'lead',          label: 'Subtítulo / lead',    type: 'textarea' },
      { name: 'sector',        label: 'Sector',              type: 'text' },
      { name: 'ubicacion',     label: 'Ubicación',           type: 'text' },
      { name: 'anio',          label: 'Año',                 type: 'text' },
    ],
    designFields: [
      { name: 'bg',            label: 'Fondo del header',      type: 'color' },
      { name: 'paddingY',      label: 'Padding vertical',      type: 'text', placeholder: 'ej: 4rem' },
      { name: 'eyebrowColor',  label: 'Color nombre empresa',  type: 'color' },
      { name: 'titleColor',    label: 'Color título',          type: 'color' },
      { name: 'titleSize',     label: 'Tamaño título',         type: 'text', placeholder: 'ej: 2.75rem' },
      { name: 'leadColor',     label: 'Color lead',            type: 'color' },
      { name: 'metaColor',     label: 'Color meta (sector/año)', type: 'color' },
      { name: 'backLinkColor', label: 'Color enlace volver',   type: 'color' },
      { name: 'logoMaxHeight', label: 'Altura máx. logo',      type: 'text', placeholder: 'ej: 64px' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS['cliente-header'].defaultData, ...data };
      const s = { ...SECTIONS['cliente-header'].defaultDesign, ...design };
      const meta = [d.sector, d.ubicacion, d.anio].filter(Boolean)
        .map(m => `<span class="cl-meta-item">${esc(m)}</span>`).join('<span class="cl-meta-sep">·</span>');
      return `
<header class="cl-header"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="max-w-7xl">
    <a href="${esc(d.backHref)}" class="cl-back"${css({ color: s.backLinkColor })}><i class="fa-solid fa-arrow-left fa-lg" aria-hidden="true"></i> ${esc(stripArrow(d.backLabel))}</a>
    <div class="cl-header-inner">
      ${d.empresaLogo ? `<div class="cl-logo-wrap"><img src="${esc(d.empresaLogo)}" alt="${esc(d.empresaNombre)}" class="cl-logo"${css({ 'max-height': s.logoMaxHeight })}></div>` : ''}
      <div class="cl-header-text">
        ${d.empresaNombre ? `<div class="cl-eyebrow"${css({ color: s.eyebrowColor })}>${esc(d.empresaNombre)}</div>` : ''}
        <h1 class="cl-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>${esc(d.titulo)}</h1>
        ${d.lead ? `<p class="cl-lead"${css({ color: s.leadColor })}>${esc(d.lead)}</p>` : ''}
        ${meta ? `<div class="cl-meta"${css({ color: s.metaColor })}>${meta}</div>` : ''}
      </div>
    </div>
  </div>
</header>`;
    },
  },

  'cliente-body': {
    label: 'Cuerpo de cliente',
    description: 'Imagen destacada + contenido (con galería) + ficha del proyecto + CTA',
    icon: `<i class="fa-solid fa-paragraph"></i>`,
    validTipos: ['cliente'],
    defaultData: {
      featuredImageUrl: '',
      featuredImageAlt: '',
      contentHtml: `<h2>El desafío</h2>
<p>Describí el contexto inicial del cliente y los objetivos del proyecto.</p>
<h2>La solución</h2>
<p>Contá qué implementó SISGRA y cómo se ejecutó. Podés intercalar imágenes del proceso usando el botón de imagen del editor.</p>
<h2>Resultados</h2>
<p>Resumí los resultados y beneficios obtenidos.</p>`,
      fichaTitle: 'Ficha del proyecto',
      empresa: 'Nombre de la empresa',
      sector: 'Industria',
      ubicacion: 'Rosario, Argentina',
      anio: '2025',
      servicios: 'Cableado estructurado, Fibra óptica',
      ctaTitle: '¿Tenés un proyecto similar?',
      ctaText: 'Conversemos sobre cómo SISGRA puede ayudar a tu empresa.',
      ctaBtnLabel: 'Contactar a SISGRA',
      ctaBtnHref: 'https://wa.me/548101220065',
    },
    defaultDesign: { bg: '', paddingY: '', bodyTextColor: '', imgRadius: '', fichaBg: '', fichaTitleColor: '', fichaLabelColor: '', fichaValueColor: '', ctaBg: '', ctaTitleColor: '', ctaTextColor: '', ctaBtnBg: '', ctaBtnColor: '' },
    dataFields: [
      { name: 'featuredImageUrl', label: 'Imagen destacada (URL)', type: 'text' },
      { name: 'fichaTitle',       label: 'Ficha — Título',       type: 'text' },
      { name: 'empresa',          label: 'Ficha — Empresa',      type: 'text' },
      { name: 'sector',           label: 'Ficha — Sector',       type: 'text' },
      { name: 'ubicacion',        label: 'Ficha — Ubicación',    type: 'text' },
      { name: 'anio',             label: 'Ficha — Año',          type: 'text' },
      { name: 'servicios',        label: 'Ficha — Servicios',    type: 'text' },
      { name: 'ctaTitle',         label: 'CTA — Título',         type: 'text' },
      { name: 'ctaText',          label: 'CTA — Texto',          type: 'textarea' },
      { name: 'ctaBtnLabel',      label: 'CTA — Botón texto',    type: 'text' },
      { name: 'ctaBtnHref',       label: 'CTA — Botón URL',      type: 'text' },
    ],
    designFields: [
      { name: 'bg',              label: 'Fondo de sección',       type: 'color' },
      { name: 'paddingY',        label: 'Padding vertical',       type: 'text', placeholder: 'ej: 3rem' },
      { name: 'bodyTextColor',   label: 'Color texto cuerpo',     type: 'color' },
      { name: 'imgRadius',       label: 'Redondeo imágenes',      type: 'text', placeholder: 'ej: 8px' },
      { name: 'fichaBg',         label: 'Ficha — fondo',          type: 'color' },
      { name: 'fichaTitleColor', label: 'Ficha — color título',   type: 'color' },
      { name: 'fichaLabelColor', label: 'Ficha — color etiquetas',type: 'color' },
      { name: 'fichaValueColor', label: 'Ficha — color valores',  type: 'color' },
      { name: 'ctaBg',           label: 'CTA — fondo',            type: 'color' },
      { name: 'ctaTitleColor',   label: 'CTA — color título',     type: 'color' },
      { name: 'ctaTextColor',    label: 'CTA — color texto',      type: 'color' },
      { name: 'ctaBtnBg',        label: 'CTA botón — fondo',      type: 'color' },
      { name: 'ctaBtnColor',     label: 'CTA botón — texto',      type: 'color' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS['cliente-body'].defaultData, ...data };
      const s = { ...SECTIONS['cliente-body'].defaultDesign, ...design };
      // contentHtml es HTML enriquecido (incluye imágenes) — se renderiza sin escapar
      const fichaRows = [
        ['Empresa',   d.empresa],
        ['Sector',    d.sector],
        ['Ubicación', d.ubicacion],
        ['Año',       d.anio],
        ['Servicios', d.servicios],
      ].filter(([, v]) => v).map(([k, v]) =>
        `<div class="cl-ficha-row"><dt class="cl-ficha-label"${css({ color: s.fichaLabelColor })}>${esc(k)}</dt><dd class="cl-ficha-value"${css({ color: s.fichaValueColor })}>${esc(v)}</dd></div>`
      ).join('');
      return `
<main class="cl-body"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="max-w-7xl cl-grid">
    <div class="cl-content"${css({ color: s.bodyTextColor })}>
      ${d.featuredImageUrl ? `<img src="${esc(d.featuredImageUrl)}" alt="${esc(d.featuredImageAlt)}" class="cl-featured"${css({ 'border-radius': s.imgRadius })}>` : ''}
      <div class="cl-richtext">${d.contentHtml || ''}</div>
      <div class="cl-cta"${css({ background: s.ctaBg })}>
        <h3${css({ color: s.ctaTitleColor })}>${esc(d.ctaTitle)}</h3>
        <p${css({ color: s.ctaTextColor })}>${esc(d.ctaText)}</p>
        <a href="${esc(d.ctaBtnHref)}" class="cl-cta-btn"${css({ background: s.ctaBtnBg, color: s.ctaBtnColor })}>${esc(d.ctaBtnLabel)}</a>
      </div>
    </div>
    <aside class="cl-sidebar">
      <div class="cl-ficha"${css({ background: s.fichaBg })}>
        <h4 class="cl-ficha-title"${css({ color: s.fichaTitleColor })}>${esc(d.fichaTitle)}</h4>
        <dl class="cl-ficha-list">${fichaRows}</dl>
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
    icon: `<i class="fa-solid fa-grip-lines"></i>`,
    validTipos: ['cableado','fibra','seguridad','soporte','desarrollo','blog','articulo','cliente'],
    defaultData: {
      wordmark: 'SISGRA',
      col1Label: 'Servicios',
      servicios: [
        { label: 'Cableado Estructurado', href: '/html/cableado_estructurado' },
        { label: 'Fibra Óptica',          href: '/html/fibra_optica' },
        { label: 'Seguridad Electrónica', href: '/html/seguridad' },
        { label: 'Soporte IT',            href: '/html/soporte_it' },
        { label: 'Desarrollo de Software',href: '/html/desarrollo' },
        { label: 'Blog',                  href: '/html/blog' },
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
    defaultDesign: { bg: '', wordmarkBg: '', wordmarkColor: '', gridBg: '', colLabelColor: '', textColor: '', linkColor: '', socialBtnBg: '', socialBtnColor: '', bottomBg: '', copyColor: '' },
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
    designFields: [
      { name: 'bg',            label: 'Fondo general footer',      type: 'color' },
      { name: 'wordmarkBg',    label: 'Banda wordmark — fondo',    type: 'color' },
      { name: 'wordmarkColor', label: 'Banda wordmark — texto',    type: 'color' },
      { name: 'gridBg',        label: 'Grid columnas — fondo',     type: 'color' },
      { name: 'colLabelColor', label: 'Etiquetas de columna',      type: 'color' },
      { name: 'textColor',     label: 'Color texto general',       type: 'color' },
      { name: 'linkColor',     label: 'Color enlaces',             type: 'color' },
      { name: 'socialBtnBg',   label: 'Botón social — fondo',      type: 'color' },
      { name: 'socialBtnColor',label: 'Botón social — texto',      type: 'color' },
      { name: 'bottomBg',      label: 'Franja inferior — fondo',   type: 'color' },
      { name: 'copyColor',     label: 'Color copyright',           type: 'color' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS['footer-full'].defaultData, ...data };
      const s = { ...SECTIONS['footer-full'].defaultDesign, ...design };
      const ofi = d.contactoOficina || {};
      const tel = d.contactoTelefono || {};
      const mail = d.contactoEmail || {};
      return `
<footer${css({ background: s.bg, color: s.textColor })}>
  <div class="wordmark-band"${css({ background: s.wordmarkBg })}>
    <h1${css({ color: s.wordmarkColor })}>${esc(d.wordmark)}</h1>
  </div>
  <div class="footer-grid"${css({ background: s.gridBg })}>
    <div class="footer-col">
      <div class="col-label"${css({ color: s.colLabelColor })}>${esc(d.col1Label)}</div>
      <ul class="services-list">
        ${(d.servicios||[]).map(sv => `<li><a href="${esc(sv.href)}"${css({ color: s.linkColor })}>${esc(sv.label)}</a></li>`).join('')}
      </ul>
    </div>
    <div class="footer-col">
      <div class="col-label"${css({ color: s.colLabelColor })}>${esc(d.col2Label)}</div>
      <div class="contact-stack">
        <div class="contact-item">
          <div class="ci-type">${esc(ofi.tipo||'Oficina')}</div>
          <div class="ci-value"${css({ color: s.textColor })}>${ofi.valor||''}</div>
        </div>
        <div class="contact-item">
          <div class="ci-type">${esc(tel.tipo||'Teléfono')}</div>
          <div class="ci-value"><a href="${esc(tel.href||'#')}"${css({ color: s.linkColor })}>${esc(tel.valor||'')}</a></div>
        </div>
        <div class="contact-item">
          <div class="ci-type">${esc(mail.tipo||'Email')}</div>
          <div class="ci-value"><a href="${esc(mail.href||'#')}"${css({ color: s.linkColor })}>${esc(mail.valor||'')}</a></div>
        </div>
        <div class="contact-item">
          <div class="ci-type">Redes</div>
          <div class="social-row">
            <a class="social-btn" href="${esc(d.facebookUrl||'#')}" aria-label="Facebook"${css({ background: s.socialBtnBg, color: s.socialBtnColor })}><i class="fa-brands fa-facebook-f" aria-hidden="true"></i></a>
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
  <div class="footer-bottom"${css({ background: s.bottomBg })}>
    <p class="copy"${css({ color: s.copyColor })}>${d.copyright}</p>
  </div>
</footer>`;
    },
  },

};

// ═══════════════════════════════════════════════════════════════════
//  CAMPOS COMUNES — se agregan a todos los módulos automáticamente
// ═══════════════════════════════════════════════════════════════════

Object.values(SECTIONS).forEach(sec => {
  sec.defaultDesign = sec.defaultDesign || {};
  Object.assign(sec.defaultDesign, { marginTop: '', marginBottom: '', display: '' });
  (sec.designFields = sec.designFields || []).push(
    { name: 'marginTop',    label: 'Margen superior',   type: 'text', placeholder: 'ej: 0 ó 2rem' },
    { name: 'marginBottom', label: 'Margen inferior',   type: 'text', placeholder: 'ej: 0 ó 2rem' },
    { name: 'display',      label: 'Display CSS',       type: 'text', placeholder: 'ej: none, flex, block' },
  );
});

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════

export function renderSection(sec) {
  const def = SECTIONS[sec.type];
  if (!def) return `<div style="padding:2rem;background:#fee;color:#900;text-align:center;">Sección desconocida: ${esc(sec.type)}</div>`;
  const html = def.render(sec.data || {}, sec.design || {});
  const d = sec.design || {};
  if (d.marginTop || d.marginBottom || d.display) {
    const s = [
      d.marginTop    ? `margin-top:${d.marginTop}`       : '',
      d.marginBottom ? `margin-bottom:${d.marginBottom}` : '',
      d.display      ? `display:${d.display}`            : '',
    ].filter(Boolean).join(';');
    return `<div style="${s}">${html}</div>`;
  }
  return html;
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
