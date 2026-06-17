export const TIPOS_HTML = [];

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// Quita una flecha (←/→) inicial del texto de un enlace "volver", para
// reemplazarla por un icono de Font Awesome en el render.
const stripArrow = s => String(s ?? '').replace(/^\s*[←→]\s*/, '');
const css = (props) => {
  const p = Object.entries(props).filter(([,v]) => v).map(([k,v]) => `${k}:${v}`);
  return p.length ? ` style="${p.join(';')}"` : '';
};

// Modo edición visual + color por palabra
// fld() envuelve cada texto editable. En modo edición agrega data-field para
// que el modal le ponga un lápiz. Si el campo tiene un color asignado
// (FIELD_COLORS, que viene de data.__colores), se aplica ese color por palabra
// TAMBIÉN en el sitio público. Si un campo no tiene color y no es modo edición,
// fld devuelve el texto plano → markup idéntico al original.
let EDIT_MODE = false;
let FIELD_COLORS = {};
export function setEditMode(v) { EDIT_MODE = !!v; }
export function setFieldColors(map) { FIELD_COLORS = map || {}; }
const fld = (name, value) => {
  const c = FIELD_COLORS[name];
  if (EDIT_MODE) return `<span class="ed-f" data-field="${name}"${c ? ` style="color:${c}"` : ''}>${value}</span>`;
  return c ? `<span data-fc="${name}" style="color:${c}">${value}</span>` : value;
};
// fldImg(name) — atributo para marcar una <img> como editable en el preview del
// panel: en modo edición agrega data-imgfield para que al hacer click se abra el
// selector de imágenes. En el sitio público no agrega nada (markup idéntico).
const fldImg = (name) => EDIT_MODE ? ` data-imgfield="${esc(name)}"` : '';
// Marcadores extra del editor visual (solo en EDIT_MODE), manejados por ED_SCRIPT:
// - fldIcon: lápiz para elegir ícono + color de una tarjeta (name = path a la card).
// - fldLink: lápiz para editar la URL de destino (name = path al campo enlace).
// - fldDetalle: lápiz para abrir el modal de detalle (name = path a la card).
const fldIcon    = (name) => EDIT_MODE ? ` data-iconfield="${esc(name)}"` : '';
const fldLink    = (name) => EDIT_MODE ? ` data-linkfield="${esc(name)}"` : '';
const fldDetalle = (name) => EDIT_MODE ? ` data-detallefield="${esc(name)}"` : '';

export const SERVICE_ICON_CATALOG = [
  'fa-server', 'fa-headset', 'fa-code', 'fa-laptop-code', 'fa-network-wired', 'fa-ethernet',
  'fa-wifi', 'fa-tower-broadcast', 'fa-satellite-dish', 'fa-database', 'fa-hard-drive', 'fa-cloud',
  'fa-microchip', 'fa-shield-halved', 'fa-lock', 'fa-key', 'fa-user-shield', 'fa-fingerprint',
  'fa-camera', 'fa-video', 'fa-bolt', 'fa-plug', 'fa-gear', 'fa-gears',
  'fa-screwdriver-wrench', 'fa-toolbox', 'fa-wrench', 'fa-desktop', 'fa-mobile-screen', 'fa-tv',
  'fa-diagram-project', 'fa-sitemap', 'fa-circle-nodes', 'fa-chart-line', 'fa-chart-pie', 'fa-gauge-high',
  'fa-rocket', 'fa-lightbulb', 'fa-cubes', 'fa-boxes-stacked', 'fa-warehouse', 'fa-building',
  'fa-handshake', 'fa-headphones', 'fa-phone', 'fa-envelope', 'fa-globe', 'fa-location-dot',
];
// Iconos por defecto para tarjetas heredadas (sin `icono` propio): se mapean por
// su `id` original para no perder el ícono que ya mostraban en el sitio.
export const SERVICE_LEGACY_ICONS = { instalaciones: 'fa-server', soporte: 'fa-headset', software: 'fa-code' };
// Clase de ícono efectiva de una tarjeta de servicio.
export const serviceCardIcon = (c) => (c && c.icono) || SERVICE_LEGACY_ICONS[c && c.id] || 'fa-table-cells-large';

export const SECTIONS = {
  nav: {
    label: 'Navbar',
    description: 'Barra superior con logo y enlaces. Los enlaces del menú se gestionan en "Items del navbar".',
    icon: `<i class="fa-solid fa-bars"></i>`,
    validTipos: ['*'],
    defaultData: {
      logoSrc: '/img/sisgra_blanco.png',
      logoSrcHref: '/',
      ctaLabel: 'Contáctese',
      // '#contacto' = abre el formulario de contacto en un modal (ver
      // bindNavContacto en page-bootstrap.js). Cualquier otra URL navega normal.
      ctaHref: '#contacto',
      // Los enlaces del menú vienen de "Items del navbar": el backend los
      // sincroniza en data.items desde navbar.json. Estos valores por defecto
      // solo se usan como vista previa en la librería de módulos.
      items: [
        { tipo: 'dropdown', titulo: 'Instalaciones', children: [
          { titulo: 'Cableado Estructurado', href: '/html/cableado_estructurado' },
          { titulo: 'Fibra Óptica',          href: '/html/fibra_optica' },
          { titulo: 'Seguridad Electrónica', href: '/html/seguridad' },
        ] },
        { tipo: 'link', titulo: 'Blog',                   href: '/html/blog' },
        { tipo: 'link', titulo: 'Soporte IT',             href: '/html/soporte_it' },
        { tipo: 'link', titulo: 'Desarrollo de Software', href: '/html/desarrollo' },
      ],
    },
    dataFields: [
      { name: 'logoSrc',     label: 'Logo (URL)',         type: 'image' },
      { name: 'logoSrcHref', label: 'Link Inicio (logo)', type: 'text' },
      { name: 'ctaLabel',    label: 'Botón Contacto',     type: 'text' },
      { name: 'ctaHref',     label: 'Link Contacto',      type: 'text' },
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

      // Los enlaces del menú provienen de "Items del navbar" (data.items),
      // que el backend sincroniza desde navbar.json. Es la única fuente.
      const items = Array.isArray(d.items) ? d.items : [];

      const linksHtml = items.map(item => {
        if (item.tipo === 'dropdown') {
          return `
          <div class="nav-dropdown">
            <a href="#" class="nav-dropdown-trigger">
              ${esc(item.titulo)}
              <i class="fa-solid fa-chevron-down fa-lg" aria-hidden="true"></i>
            </a>
            <div class="dropdown-content">
              ${(item.children || []).map(c => `<a href="${esc(c.href)}">${esc(c.titulo)}</a>`).join('')}
            </div>
          </div>`;
        }
        return `<a href="${esc(item.href || '#')}" class="nav-link">${esc(item.titulo)}</a>`;
      }).join('');

      // Mobile drawer links — dropdowns se despliegan como sección + hijos
      const mobileLinksHtml = items.map(item => {
        if (item.tipo === 'dropdown') {
          const children = (item.children || []).map(c => `<a href="${esc(c.href)}">${esc(c.titulo)}</a>`).join('');
          return `<div class="nav-mobile-section-title">${esc(item.titulo)}</div>${children}`;
        }
        return `<a href="${esc(item.href || '#')}">${esc(item.titulo)}</a>`;
      }).join('');

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
        <img src="${esc(d.logoSrc)}" alt="SISGRA"${fldImg('logoSrc')}>
      </a>
      <div class="nav-menu">
        <div class="nav-menu-list">
          ${linksHtml}
        </div>
      </div>
      <div class="nav-contact-wrap">
        <a href="${esc(d.ctaHref)}" class="btn-contact">${fld('ctaLabel', esc(d.ctaLabel))}</a>
      </div>
      <button class="nav-mobile-toggle" aria-label="Menú">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
  <div class="nav-mobile-drawer">
    ${mobileLinksHtml}
    <a href="${esc(d.ctaHref)}" class="nav-mobile-cta">${fld('ctaLabel', esc(d.ctaLabel))}</a>
  </div>
</nav>`;
    },
  },

  //  HERO — copia exacta de renderHeroP1 del index.html actual
  //  Campos idénticos a hero.json (titulo1, titulo2, stat1_numero, etc.)
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
        <div class="hero-badge">${fld('badge', esc(h.badge))}</div>
        <h1 class="hero-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>
          ${fld('titulo1', esc(h.titulo1))} <span${css({ color: s.accentColor })}><i>${fld('titulo2', esc(h.titulo2))}</i></span>
        </h1>
        <p class="hero-desc"${css({ 'font-size': s.descSize })}>${fld('descripcion', esc(h.descripcion))}</p>
        <div class="hero-buttons">
          <a href="#servicios"><button class="btn-hero-primary"${css({ background: s.btnBg, 'border-color': s.btnBg, 'border-radius': s.btnRadius })}>${fld('boton_primario', esc(h.boton_primario))}</button></a>
          <a href="#nosotros"><button class="btn-hero-secondary">${fld('boton_secundario', esc(h.boton_secundario))}</button></a>
        </div>
      </div>
      <div class="hero-stats">
        <div class="stat-card-dark">
          <div class="stat-number-white">${fld('stat1_numero', esc(h.stat1_numero))}</div>
          <div class="stat-label-blue">${fld('stat1_label', esc(h.stat1_label))}</div>
        </div>
        <div class="stat-card-light">
          <div class="stat-number-dark">${fld('stat2_numero', esc(h.stat2_numero))}</div>
          <div class="stat-label-gray">${fld('stat2_label', esc(h.stat2_label))}</div>
        </div>
      </div>
    </div>
  </div>
</header>`;
    },
  },

  //  HERO CENTRADO — copia exacta de renderHeroP2
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
      const tags = [
        { f: 'p2_tag1', v: h.p2_tag1 },
        { f: 'p2_tag2', v: h.p2_tag2 },
        { f: 'p2_tag3', v: h.p2_tag3 },
      ].filter(t => t.v);
      const metrics = [
        { nf: 'p2_metric1_num', num: h.p2_metric1_num, lf: 'p2_metric1_label', label: h.p2_metric1_label },
        { nf: 'p2_metric2_num', num: h.p2_metric2_num, lf: 'p2_metric2_label', label: h.p2_metric2_label },
        { nf: 'p2_metric3_num', num: h.p2_metric3_num, lf: 'p2_metric3_label', label: h.p2_metric3_label },
      ].filter(m => m.num);
      return `
<header class="hero-p2"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="hero-p2-inner">
    <div class="hero-p2-eyebrow"${css({ color: s.accentColor })}>${fld('p2_eyebrow', esc(h.p2_eyebrow))}</div>
    <h1 class="hero-p2-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>${fld('p2_titulo', esc(h.p2_titulo))}</h1>
    <p class="hero-p2-subtitle">${fld('p2_subtitulo', esc(h.p2_subtitulo))}</p>
    <p class="hero-p2-desc">${fld('p2_descripcion', esc(h.p2_descripcion))}</p>
    ${tags.length ? `<div class="hero-p2-tags">${tags.map(t => `<span class="hero-p2-tag">${fld(t.f, esc(t.v))}</span>`).join('')}</div>` : ''}
    <div class="hero-p2-buttons">
      <a href="#servicios"><button class="btn-hero-primary"${css({ background: s.btnBg, 'border-color': s.btnBg, 'border-radius': s.btnRadius })}>${fld('p2_boton_primario', esc(h.p2_boton_primario))}</button></a>
      <a href="#nosotros"><button class="btn-hero-secondary">${fld('p2_boton_secundario', esc(h.p2_boton_secundario))}</button></a>
    </div>
    ${metrics.length ? `
      <div class="hero-p2-metrics">
        ${metrics.map(m => `
          <div class="hero-p2-metric">
            <span class="hero-p2-metric-num"${css({ color: s.accentColor })}>${fld(m.nf, esc(m.num))}</span>
            <span class="hero-p2-metric-label">${fld(m.lf, esc(m.label))}</span>
          </div>`).join('')}
      </div>` : ''}
  </div>
</header>`;
    },
  },

  //  CLIENTES — copia exacta de la sección clientes del index actual
  //  Estructura: <section class="logos-section">…<div class="logos-track">…
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
      <h2 class="logos-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>${fld('titulo_seccion', esc(d.titulo_seccion))}</h2>
    </div>
    <div class="logos-track-wrapper">
      <div class="logos-track ${d.auto_scroll !== false ? 'is-animating' : ''}" data-clientes-track data-auto-scroll="${d.auto_scroll !== false}"${css({ background: s.trackBg, height: s.trackHeight })}>${cells}</div>
    </div>
  </div>
</section>`;
    },
  },

  //  BLOG — copia exacta de la sección blog del index actual
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
      <h2 class="blog-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>${fld('titulo_seccion', esc(d.titulo_seccion))}</h2>
    </div>
    <div class="blog-grid" ${dataAttrs}>
      <div style="grid-column:1/-1;text-align:center;padding:3rem 0;color:#94a3b8;font-size:.875rem;">Cargando artículos…</div>
    </div>
  </div>
</section>`;
    },
  },

  //  SERVICIOS — copia exacta de la sección servicios del index actual
  services: {
    label: 'Cards',
    description: 'Grid de tarjetas de servicios',
    icon: `<i class="fa-solid fa-table-cells-large"></i>`,
    validTipos: ['index'],
    defaultData: {
      titulo_seccion: 'Portafolio de Soluciones',
      eyebrow: 'Lo que hacemos',
      cards: [
        { id: 'instalaciones', icono: 'fa-server',  iconoColor: '', titulo: 'Instalaciones', descripcion: 'Cableado Cat 8, Fibra Óptica FTTH/FTTX y Seguridad Electrónica certificada bajo normas TIA/EIA para entornos corporativos exigentes.', linkText: 'Ver Detalles', enlace: '/html/cableado_estructurado', detalle: { titulo: '', descripcion: '', imagen: '' } },
        { id: 'soporte',       icono: 'fa-headset', iconoColor: '', titulo: 'Soporte IT',    descripcion: 'Mantenimiento integral de infraestructura tecnológica, asistencia técnica 24/7 y gestión proactiva para garantizar continuidad operativa.', linkText: 'Ver Detalles', enlace: '/html/soporte_it', detalle: { titulo: '', descripcion: '', imagen: '' } },
        { id: 'software',      icono: 'fa-code',    iconoColor: '', titulo: 'Desarrollo de Software', descripcion: 'Soluciones digitales a medida: sistemas de gestión logística, control de inventario y procesos empresariales integrados.', linkText: 'Ver Detalles', enlace: '/html/desarrollo', detalle: { titulo: '', descripcion: '', imagen: '' } },
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
      // `soloCard`: variante de una sola tarjeta insertada suelta en una plantilla
      // → se renderiza SOLO la card, sin el encabezado (título) de la sección.
      const header = d.soloCard ? '' : `
    <div class="services-header">
      <h2 class="services-title"${css({ color: s.sectionColor, 'font-size': s.titleSize })}>${fld('titulo_seccion', esc(d.titulo_seccion))}</h2>
    </div>`;
      // Columnas dinámicas = cantidad de tarjetas del módulo (tope 3, mín 1).
      // Así un módulo de 1 o 2 cards ocupa todo el ancho en vez de quedar fijo
      // en 3 columnas (con huecos vacíos). Lo consume home.css vía --cards-cols.
      const nCols = Math.min(3, Math.max(1, (d.cards || []).length));
      return `
<section id="servicios" class="services-section${d.soloCard ? ' services-section--solo' : ''}"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="max-w-7xl">${header}
    <div class="cards-grid"${css({ gap: s.gap, '--cards-cols': nCols })}>
      ${(d.cards||[]).map((c, i) => {
        const linkText = c.linkText || 'Ver Detalles';
        const det = c.detalle || {};
        const hasDetalle = !!(det.titulo || det.descripcion || det.imagen);
        const detAttr = (!EDIT_MODE && hasDetalle)
          ? ` data-svc-detalle="${esc(JSON.stringify({ titulo: det.titulo || '', descripcion: det.descripcion || '', imagen: det.imagen || '', enlace: c.enlace || '', linkText }))}"`
          : '';
        return `
        <div class="service-card"${css({ background: s.cardBg, 'border-radius': s.cardRadius, padding: s.cardPadding })}>
          <div class="card-icon"${css({ color: c.iconoColor })}><i class="fa-solid ${esc(serviceCardIcon(c))} fa-2xl"${fldIcon('cards.'+i)} aria-hidden="true"></i></div>
          <h3 class="card-title"${css({ color: s.cardTitleColor })}>${fld('cards.'+i+'.titulo', esc(c.titulo))}</h3>
          <p class="card-desc">${fld('cards.'+i+'.descripcion', esc(c.descripcion))}</p>
          <a href="${esc(c.enlace||'#')}" class="card-link"${css({ color: s.cardLinkColor })}${detAttr}${fldLink('cards.'+i+'.enlace')}${fldDetalle('cards.'+i)}>${fld('cards.'+i+'.linkText', esc(linkText))} <i class="fa-solid fa-arrow-right fa-lg" aria-hidden="true"></i></a>
        </div>`;
      }).join('')}
    </div>
  </div>
</section>`;
    },
  },

  //  NOSOTROS — copia exacta de la sección about del index actual
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
      { name: 'imagen',      label: 'URL imagen',        type: 'image' },
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
          <img src="${esc(d.imagen)}" alt="Imagen Corporativa"${fldImg('imagen')}>
        </div>
      </div>
      <div class="about-content">
        <p class="about-eyebrow"${css({ color: s.eyebrowColor })}>${fld('eyebrow', esc(d.eyebrow))}</p>
        <h3 class="about-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>${fld('titulo', String(d.titulo||'').split('\n').map(esc).join('<br>'))}</h3>
        <p class="about-desc"${css({ color: s.textColor })}>${fld('descripcion', esc(d.descripcion))}</p>
      </div>
    </div>
  </div>
</section>`;
    },
  },

  //  CTA — copia de renderExtraSections cta del index actual
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
    <h2 style="font-size:2rem;font-weight:900;color:#fff;letter-spacing:-.04em;font-style:italic;margin-bottom:.5rem;">${fld('title', esc(d.title))}</h2>
    <p style="color:rgba(255,255,255,.6);font-size:.9375rem;">${fld('desc', esc(d.desc))}</p>
  </div>
  <a href="${esc(d.href)}" style="background:${s.btnBg};color:#fff;padding:.875rem 2rem;font-size:.75rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;white-space:nowrap;flex-shrink:0;${s.btnRadius ? `border-radius:${s.btnRadius};` : ''}">${fld('btn', esc(d.btn))}</a>
</section>`;
    },
  },

  //  FORMULARIO — campos configurables desde el panel; los envíos se guardan
  //  en el backend (contactos) hasta que se defina el endpoint de destino.
  formulario: {
    label: 'Formulario',
    description: 'Formulario personalizable. Los envíos quedan guardados para mandarse al endpoint que se configure.',
    icon: `<i class="fa-solid fa-envelope-open-text"></i>`,
    defaultData: {
      titulo: 'Contáctese con nosotros',
      descripcion: 'Complete el formulario y le responderemos a la brevedad.',
      btn: 'Enviar consulta',
      successMsg: '✓ Recibimos su consulta. Le responderemos a la brevedad.',
      campos: [
        { etiqueta: 'Nombre',   tipo: 'text',     requerido: true  },
        { etiqueta: 'Empresa',  tipo: 'text',     requerido: false },
        { etiqueta: 'Email',    tipo: 'email',    requerido: true  },
        { etiqueta: 'Teléfono', tipo: 'tel',      requerido: false },
        { etiqueta: 'Mensaje',  tipo: 'textarea', requerido: false },
      ],
    },
    defaultDesign: {
      bg: '#f8fafc', cardBg: '#ffffff', titleColor: '#0A1D37', textColor: '#475569',
      labelColor: '#334155', btnBg: '#2563eb', btnColor: '#ffffff', paddingY: '',
    },
    dataFields: [
      { name: 'titulo',      label: 'Título',            type: 'text' },
      { name: 'descripcion', label: 'Descripción',       type: 'textarea' },
      { name: 'btn',         label: 'Texto del botón',   type: 'text' },
      { name: 'successMsg',  label: 'Mensaje de éxito',  type: 'text' },
    ],
    designFields: [
      { name: 'bg',         label: 'Fondo de la sección', type: 'color' },
      { name: 'cardBg',     label: 'Fondo del formulario',type: 'color' },
      { name: 'titleColor', label: 'Color del título',    type: 'color' },
      { name: 'textColor',  label: 'Color del texto',     type: 'color' },
      { name: 'labelColor', label: 'Color de etiquetas',  type: 'color' },
      { name: 'btnBg',      label: 'Botón — fondo',       type: 'color' },
      { name: 'btnColor',   label: 'Botón — texto',       type: 'color' },
      { name: 'paddingY',   label: 'Padding vertical',    type: 'text', placeholder: 'ej: 5rem' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS.formulario.defaultData, ...data };
      const s = { ...SECTIONS.formulario.defaultDesign, ...design };
      const py = s.paddingY || '5rem';
      const slug = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'campo';
      const inputStyle = 'width:100%;box-sizing:border-box;padding:.75rem .875rem;border:1px solid #cbd5e1;border-radius:6px;font-family:inherit;font-size:.9rem;color:#0f172a;background:#fff;outline:none;';
      const campos = (Array.isArray(d.campos) ? d.campos : []).map((c, i) => {
        const name = slug(c.etiqueta) || `campo_${i}`;
        const req  = c.requerido ? ' required' : '';
        const label = `<label for="fm-${name}" style="display:block;font-size:.75rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${s.labelColor};margin-bottom:.4rem;">${esc(c.etiqueta)}${c.requerido ? ' <span style="color:#ef4444;">*</span>' : ''}</label>`;
        const input = c.tipo === 'textarea'
          ? `<textarea id="fm-${name}" name="${name}" data-etiqueta="${esc(c.etiqueta)}" rows="5" style="${inputStyle}resize:vertical;"${req}></textarea>`
          : `<input id="fm-${name}" name="${name}" data-etiqueta="${esc(c.etiqueta)}" type="${esc(c.tipo || 'text')}" style="${inputStyle}"${req}>`;
        return `<div style="margin-bottom:1.1rem;">${label}${input}</div>`;
      }).join('');
      return `
<section style="background:${s.bg};padding:${py} 1.5rem;">
  <div style="max-width:640px;margin:0 auto;">
    <h2 style="font-size:2rem;font-weight:900;color:${s.titleColor};letter-spacing:-.03em;margin-bottom:.5rem;">${fld('titulo', esc(d.titulo))}</h2>
    <p style="color:${s.textColor};font-size:.9375rem;margin-bottom:2rem;">${fld('descripcion', esc(d.descripcion))}</p>
    <form data-form-modulo style="background:${s.cardBg};border:1px solid #e2e8f0;border-radius:10px;padding:2rem;">
      ${campos}
      <button type="submit" style="background:${s.btnBg};color:${s.btnColor};border:none;cursor:pointer;padding:.875rem 2rem;font-size:.75rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;border-radius:6px;font-family:inherit;">${fld('btn', esc(d.btn))}</button>
      <div data-form-ok style="display:none;margin-top:1rem;padding:.75rem 1rem;background:#dcfce7;color:#166534;border-radius:6px;font-size:.875rem;">${esc(d.successMsg)}</div>
      <div data-form-err style="display:none;margin-top:1rem;padding:.75rem 1rem;background:#fee2e2;color:#991b1b;border-radius:6px;font-size:.875rem;">No se pudo enviar el formulario. Intentá de nuevo en unos minutos.</div>
    </form>
  </div>
</section>`;
    },
  },

  //  SPACER
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

  //  FOOTER (index) — replica el look del footer-full de las otras páginas
  //  (wordmark "SISGRA" + grid Servicios/Contacto/Mapa + copyright), pero con el
  //  CTA "Solicite un presupuesto" + WhatsApp integrado en la banda del wordmark.
  //  Estilos en un <style> acotado (clases .sgf-*) porque el index carga
  //  layout_home.css y NO layout.css (donde viven las clases de footer-full).
  footer: {
    label: 'Footer (index)',
    description: 'Pie del index: wordmark + CTA presupuesto/WhatsApp, y grid Servicios / Contacto / Mapa',
    icon: `<i class="fa-solid fa-grip-lines"></i>`,
    validTipos: ['index'],
    defaultData: {
      wordmark: 'SISGRA',
      formTitulo: 'Solicite un presupuesto',
      formDesc: 'Cuéntenos sobre su organización. Un asesor se comunicará para recomendarle la mejor solución.',
      whatsapp: '548101220065',
      whatsappText: 'Consultar por WhatsApp',
      serviciosLabel: 'Servicios',
      servicios: [
        { label: 'Cableado Estructurado', href: '/html/cableado_estructurado' },
        { label: 'Fibra Óptica',          href: '/html/fibra_optica' },
        { label: 'Seguridad Electrónica', href: '/html/seguridad' },
        { label: 'Soporte IT',            href: '/html/soporte_it' },
        { label: 'Desarrollo de Software',href: '/html/desarrollo' },
        { label: 'Blog',                  href: '/html/blog' },
      ],
      contactoLabel: 'Contacto',
      contactoOficina: { tipo: 'Oficina',  valor: 'Lamadrid 468<br>(ZONA I) NAVE 2 - Oficina 05 - NODO ROSARIO' },
      contactoTelefono:{ tipo: 'Teléfono', valor: '8101220065', href: 'tel:8101220065' },
      contactoEmail:   { tipo: 'Email',    valor: 'info@sisgra.com.ar', href: 'mailto:info@sisgra.com.ar' },
      facebookUrl: 'https://www.facebook.com/sisgra.srl',
      mapaSrc: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3348.9!2d-60.6530!3d-32.9440!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95b652f52c9a5e3b%3A0x0!2sLamadrid+468%2C+Rosario%2C+Argentina!5e0!3m2!1ses!2sar!4v1680000000000',
      mapaLabel: 'Rosario · ARG',
      copyright: '© 2026 SISGRA S.R.L. — Todos los derechos reservados',
    },
    defaultDesign: { accentColor: '', wordmarkColor: '', textColor: '', mutedColor: '', btnWaBg: '', btnWaColor: '' },
    dataFields: [
      { name: 'wordmark',        label: 'Marca grande (wordmark)',type: 'text' },
      { name: 'formTitulo',      label: 'Título del CTA',         type: 'text' },
      { name: 'formDesc',        label: 'Texto del CTA',          type: 'textarea' },
      { name: 'whatsapp',        label: 'Número WhatsApp',        type: 'text' },
      { name: 'whatsappText',    label: 'Texto botón WhatsApp',   type: 'text' },
      { name: 'serviciosLabel',  label: 'Col 1 — Título',         type: 'text' },
      { name: 'servicios',       label: 'Col 1 — Servicios',      type: 'link-list' },
      { name: 'contactoLabel',   label: 'Col 2 — Título',         type: 'text' },
      { name: 'contactoOficina', label: 'Oficina (HTML permitido)', type: 'contact-item' },
      { name: 'contactoTelefono',label: 'Teléfono',               type: 'contact-item' },
      { name: 'contactoEmail',   label: 'Email',                  type: 'contact-item' },
      { name: 'facebookUrl',     label: 'URL Facebook',           type: 'text' },
      { name: 'mapaSrc',         label: 'Col 3 — URL iframe mapa',type: 'textarea' },
      { name: 'mapaLabel',       label: 'Label sobre el mapa',    type: 'text' },
      { name: 'copyright',       label: 'Copyright',              type: 'text' },
    ],
    designFields: [
      { name: 'accentColor',   label: 'Color acento (azul)',      type: 'color' },
      { name: 'wordmarkColor', label: 'Color marca grande',       type: 'color' },
      { name: 'textColor',     label: 'Color texto claro',        type: 'color' },
      { name: 'mutedColor',    label: 'Color texto apagado',      type: 'color' },
      { name: 'btnWaBg',       label: 'Botón WhatsApp — fondo',   type: 'color' },
      { name: 'btnWaColor',    label: 'Botón WhatsApp — texto',   type: 'color' },
    ],
    render: (data, design) => {
      const d = { ...SECTIONS.footer.defaultData, ...data };
      const s = { ...SECTIONS.footer.defaultDesign, ...design };
      const ofi = d.contactoOficina || {}, tel = d.contactoTelefono || {}, mail = d.contactoEmail || {};
      const accent = s.accentColor   || '#3b82f6';
      const paper  = s.textColor     || '#f8fafc';
      const fog    = s.mutedColor    || '#94a3b8';
      const wm     = s.wordmarkColor || '#0f1f35';
      const servicios = (d.servicios || []).map((sv, i) =>
        `<li><a href="${esc(sv.href)}">${fld('servicios.' + i + '.label', esc(sv.label))}</a></li>`).join('');
      return `
<style>
.sgf-foot .sgf-wm{position:relative;z-index:1;border-bottom:1px solid var(--rule);padding:42px 1.5rem 30px;display:flex;align-items:flex-end;justify-content:space-between;gap:28px;flex-wrap:wrap;}
.sgf-foot .sgf-wm h1{font-family:"Bebas Neue",sans-serif;font-size:clamp(72px,10vw,148px);letter-spacing:.03em;line-height:.88;color:${wm};-webkit-text-stroke:1.5px rgba(242,239,232,.18);margin:0;user-select:none;transition:-webkit-text-stroke .4s;}
.sgf-foot .sgf-wm h1:hover{-webkit-text-stroke:1.5px ${paper};}
.sgf-foot .sgf-ctabox{display:flex;flex-direction:column;align-items:flex-start;gap:.7rem;width:800px;}
.sgf-foot .sgf-ctabox .sgf-eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:${accent};font-weight:700;margin:0;}
.sgf-foot .sgf-ctabox h2{font-size:1.4rem;font-weight:900;letter-spacing:-.02em;color:${paper};margin:0;}
.sgf-foot .sgf-ctabox p{font-size:.82rem;color:${fog};line-height:1.5;margin:0;}
.sgf-foot .sgf-grid{position:relative;z-index:1;display:grid;grid-template-columns:1fr;border-bottom:1px solid var(--rule);}
.sgf-foot .sgf-col{padding:30px 1.5rem;border-bottom:1px solid var(--rule);}
.sgf-foot .sgf-collabel{font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:${accent};font-weight:700;margin:0 0 24px;display:flex;align-items:center;gap:10px;}
.sgf-foot .sgf-collabel::after{content:"";flex:1;height:1px;background:${accent};opacity:.35;}
.sgf-foot .sgf-services{list-style:none;margin:0;padding:0;}
.sgf-foot .sgf-services li a{display:flex;align-items:center;gap:12px;text-decoration:none;color:${fog};font-size:13px;letter-spacing:.04em;padding:10px 0;border-bottom:1px solid var(--rule);transition:color .25s,gap .25s;}
.sgf-foot .sgf-services li:last-child a{border-bottom:none;}
.sgf-foot .sgf-services li a::before{font-family:"Font Awesome 6 Free";font-weight:900;content:"\\f061";color:${accent};font-size:11px;opacity:0;transition:opacity .25s;}
.sgf-foot .sgf-services li a:hover{color:${paper};gap:16px;}
.sgf-foot .sgf-services li a:hover::before{opacity:1;}
.sgf-foot .sgf-cstack{display:flex;flex-direction:column;gap:26px;}
.sgf-foot .sgf-citype{font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:${fog};margin-bottom:6px;}
.sgf-foot .sgf-civalue{font-size:14px;color:${paper};line-height:1.5;}
.sgf-foot .sgf-civalue a{color:${paper};text-decoration:none;border-bottom:1px solid transparent;transition:border-color .2s,color .2s;}
.sgf-foot .sgf-civalue a:hover{color:${accent};border-color:${accent};}
.sgf-foot .sgf-social{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid var(--rule);color:${fog};text-decoration:none;transition:background .2s,color .2s,border-color .2s;}
.sgf-foot .sgf-social:hover{background:${accent};color:#fff;border-color:${accent};}
.sgf-foot .sgf-map{position:relative;overflow:hidden;height:100%;min-height:260px;border-radius:8px;}
.sgf-foot .sgf-map iframe{width:100%;height:100%;min-height:260px;border:none;display:block;filter:grayscale(.3);}
.sgf-foot .sgf-maplabel{position:absolute;top:16px;left:16px;background:${accent};color:#fff;font-size:10px;letter-spacing:.2em;text-transform:uppercase;font-weight:500;padding:6px 12px;pointer-events:none;}
.sgf-foot .sgf-copy{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;padding:22px 1.5rem;}
.sgf-foot .sgf-copy span{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${fog};text-align:center;}
@media(min-width:880px){.sgf-foot .sgf-grid{grid-template-columns:1.4fr 1fr 1.6fr;}.sgf-foot .sgf-col{border-bottom:none;border-right:1px solid var(--rule);}.sgf-foot .sgf-col:last-child{border-right:none;}}
</style>
<footer class="sgf-foot">
  <div class="sgf-wm">
    <h1>${fld('wordmark', esc(d.wordmark))}</h1>
    <div class="sgf-ctabox">
      <p class="sgf-eyebrow">${esc(d.contactoLabel || 'Contacto')}</p>
      <h2>${fld('formTitulo', esc(d.formTitulo))}</h2>
      <p>${fld('formDesc', esc(d.formDesc))}</p>
      <a href="https://wa.me/${esc(d.whatsapp)}" class="btn btn-whatsapp"${css({ background: s.btnWaBg, color: s.btnWaColor })}>
        <i class="fa-brands fa-whatsapp fa-xl" aria-hidden="true"></i>
        ${fld('whatsappText', esc(d.whatsappText))}
      </a>
    </div>
  </div>
  <div class="sgf-grid">
    <div class="sgf-col">
      <p class="sgf-collabel">${fld('serviciosLabel', esc(d.serviciosLabel))}</p>
      <ul class="sgf-services">${servicios}</ul>
    </div>
    <div class="sgf-col">
      <p class="sgf-collabel">${esc(d.contactoLabel || 'Contacto')}</p>
      <div class="sgf-cstack">
        <div><div class="sgf-citype">${esc(ofi.tipo || 'Oficina')}</div><div class="sgf-civalue">${fld('contactoOficina.valor', ofi.valor || '')}</div></div>
        <div><div class="sgf-citype">${esc(tel.tipo || 'Teléfono')}</div><div class="sgf-civalue"><a href="${esc(tel.href || '#')}">${fld('contactoTelefono.valor', esc(tel.valor || ''))}</a></div></div>
        <div><div class="sgf-citype">${esc(mail.tipo || 'Email')}</div><div class="sgf-civalue"><a href="${esc(mail.href || '#')}">${fld('contactoEmail.valor', esc(mail.valor || ''))}</a></div></div>
        <div><div class="sgf-citype">Redes</div><a class="sgf-social" href="${esc(d.facebookUrl || '#')}" aria-label="Facebook"><i class="fa-brands fa-facebook-f" aria-hidden="true"></i></a></div>
      </div>
    </div>
    <div class="sgf-col">
      <div class="sgf-map">
        <iframe src="${esc(d.mapaSrc)}" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Ubicación SISGRA"></iframe>
        <div class="sgf-maplabel">${fld('mapaLabel', esc(d.mapaLabel))}</div>
      </div>
    </div>
  </div>
  <div class="sgf-copy"><span>${fld('copyright', esc(d.copyright))}</span></div>
</footer>`;
    },
  },

  //  MÓDULOS ESPECÍFICOS DE CABLEADO ESTRUCTURADO
  //  Usan las clases reales de css/pages/cableado.css y css/layout.css

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
      <div class="badge-infra">${fld('badge', esc(d.badge))}</div>
      <h2 class="section-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>
        ${fld('titulo1', esc(d.titulo1))} <br>
        <span class="accent"${css({ color: s.accentColor })}>${fld('accent', esc(d.accent))}</span>
      </h2>
      <div class="title-bar"></div>
    </div>
    <div class="cableado-grid">
      <div class="col-left">
        <p>${fld('descripcion', esc(d.descripcion))}</p>
        <div class="cards-stack">
          ${(d.cards||[]).map((c, i) => `
            <div class="spec-card">
              <div class="spec-badge">${fld('cards.'+i+'.badge', esc(c.badge))}</div>
              <div>
                <h4>${fld('cards.'+i+'.titulo', esc(c.titulo))}</h4>
                <p>${fld('cards.'+i+'.desc', esc(c.desc))}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div class="col-right">
        <div class="dark-panel">
          <div class="panel-header">${fld('panelHeader', esc(d.panelHeader))}</div>
          <div class="panel-body">
            <div class="panel-row">
              <div class="panel-row-top">
                <span class="panel-label">${fld('panelLabel', esc(d.panelLabel))}</span>
                <span class="panel-value">${fld('panelValue', esc(d.panelValue))}</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width:${pct}%;"></div>
              </div>
            </div>
            <div class="panel-stats">
              <div>
                <div class="stat-label">${fld('stat1Label', esc(d.stat1Label))}</div>
                <div class="stat-value">${fld('stat1Value', esc(d.stat1Value))}</div>
              </div>
              <div>
                <div class="stat-label">${fld('stat2Label', esc(d.stat2Label))}</div>
                <div class="stat-value">${fld('stat2Value', esc(d.stat2Value))}</div>
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

  //  MÓDULOS ESPECÍFICOS DE FIBRA ÓPTICA
  //  Usan las clases reales de css/pages/fibra_optica.css y css/layout.css

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
      { name: 'imagenUrl',    label: 'Imagen (URL)',    type: 'image' },
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
          <img src="${esc(d.imagenUrl)}" alt="Fibra Óptica"${fldImg('imagenUrl')}/>
          <div class="fibra-image-overlay"></div>
        </div>
        <div class="fibra-badge">
          <div class="fibra-badge-title">${fld('badgeTitle', esc(d.badgeTitle))}</div>
          <div class="fibra-badge-sub">${fld('badgeSub', esc(d.badgeSub))}</div>
        </div>
      </div>
      <div class="fibra-text">
        <span class="section-badge">${fld('sectionBadge', esc(d.sectionBadge))}</span>
        <h2 class="section-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>
          ${fld('titulo1', esc(d.titulo1))} <br/>
          <span class="accent"${css({ color: s.accentColor })}>${fld('accent', esc(d.accent))}</span>
        </h2>
        <p class="section-description">${fld('descripcion', esc(d.descripcion))}</p>
        <ul class="feature-list">
          ${(d.features||[]).map((f, i) => `
            <li class="feature-item">
              <div class="feature-icon">${icon(f.iconType)}</div>
              <div>
                <h4 class="feature-title">${fld('features.'+i+'.titulo', esc(f.titulo))}</h4>
                <p class="feature-desc">${fld('features.'+i+'.desc', esc(f.desc))}</p>
              </div>
            </li>`).join('')}
        </ul>
      </div>
    </div>
  </div>
</section>`;
    },
  },

  //  MÓDULOS ESPECÍFICOS DE SEGURIDAD ELECTRÓNICA

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
      { name: 'imagenUrl',     label: 'Imagen (URL)',      type: 'image' },
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
        <div class="badge">${fld('badge', esc(d.badge))}</div>
        <h2 class="section-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>
          <span><i>${fld('titulo1', esc(d.titulo1))}</i></span><br>
          <span${css({ color: s.accentColor })}><i>${fld('titulo2', esc(d.titulo2))}</i></span>
        </h2>
        <p class="section-desc">${fld('descripcion', esc(d.descripcion))}</p>
        <div class="features-list">
          ${(d.features||[]).map((f, i) => `
            <div class="feature-card">
              <div class="feature-icon">${icon(f.iconType)}</div>
              <div>
                <h4 class="feature-title">${fld('features.'+i+'.titulo', esc(f.titulo))}</h4>
                <p class="feature-desc">${fld('features.'+i+'.desc', esc(f.desc))}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div class="section-image">
        <div class="img-wrapper">
          <img src="${esc(d.imagenUrl)}" alt="Seguridad electrónica"${fldImg('imagenUrl')}>
          <div class="img-badge">
            <div class="img-badge-label">${fld('imgBadgeLabel', esc(d.imgBadgeLabel))}</div>
            <div class="img-badge-status">
              <div class="pulse-dot"></div>
              <span class="img-badge-text">${fld('imgBadgeText', esc(d.imgBadgeText))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
    },
  },

  //  MÓDULOS ESPECÍFICOS DE SOPORTE IT

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
      <div class="badge">${fld('badge', esc(d.badge))}</div>
      <h2 class="hero-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>
        ${fld('titulo1', esc(d.titulo1))} <br/>
        <span class="text-blue"${css({ color: s.accentColor })}>${fld('accent', esc(d.accent))}</span>
      </h2>
      <p class="hero-description">${fld('descripcion', esc(d.descripcion))}</p>
      <div class="features-list">
        ${(d.features||[]).map((f, i) => `
          <div class="feature-card">
            <div class="feature-icon">${icon(f.iconType)}</div>
            <div>
              <h4 class="feature-title">${fld('features.'+i+'.titulo', esc(f.titulo))}</h4>
              <p class="feature-text">${fld('features.'+i+'.desc', esc(f.desc))}</p>
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
            <span class="dash-label">${fld('dashLabel', esc(d.dashLabel))}</span>
            <div class="dash-main-value">${fld('dashMainValue', esc(d.dashMainValue))}</div>
          </div>
          <div class="dash-grid">
            <div>
              <span class="dash-sublabel">${fld('dashStat1Label', esc(d.dashStat1Label))}</span>
              <div class="dash-subvalue">${fld('dashStat1Value', esc(d.dashStat1Value))}</div>
            </div>
            <div>
              <span class="dash-sublabel">${fld('dashStat2Label', esc(d.dashStat2Label))}</span>
              <div class="dash-subvalue ${d.dashStat2Highlight ? 'text-green' : ''}">${fld('dashStat2Value', esc(d.dashStat2Value))}</div>
            </div>
          </div>
          <button class="btn-remote">${fld('btnRemote', esc(String(d.btnRemote ?? '').replace(/\s*🎧\s*$/,'')))} <i class="fa-solid fa-headset" aria-hidden="true"></i></button>
        </div>
      </div>
      <div class="dash-decor"></div>
    </div>
  </div>
</section>`;
    },
  },

  //  MÓDULOS ESPECÍFICOS DE DESARROLLO DE SOFTWARE

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
        <div class="badge">${fld('badge', esc(d.badge))}</div>
        <h2 class="software-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>
          ${fld('titulo1', esc(d.titulo1))} <br>
          <span${css({ color: s.accentColor })}>${fld('accent', esc(d.accent))}</span>
        </h2>
        <p class="software-desc">${fld('descripcion', esc(d.descripcion))}</p>
        <div class="solutions-list">
          ${(d.solutions||[]).map((s, i) => `
            <div class="solution-item">
              <div class="solution-icon">${icon(s.iconType)}</div>
              <div>
                <h4 class="solution-title">${fld('solutions.'+i+'.titulo', esc(s.titulo))}</h4>
                <p class="solution-desc">${fld('solutions.'+i+'.desc', esc(s.desc))}</p>
              </div>
            </div>`).join('')}
        </div>
        <a href="${esc(d.btnCtaHref)}" class="btn-cta">${fld('btnCta', esc(d.btnCta))}</a>
      </div>
      <div class="software-visual">
        <div class="code-editor">
          <div class="editor-topbar">
            <div class="dot dot-red"></div>
            <div class="dot dot-amber"></div>
            <div class="dot dot-green"></div>
            <span class="editor-label">${fld('editorLabel', esc(d.editorLabel))}</span>
          </div>
          <div class="editor-body">
            ${(d.codeRows||[]).map((r, i) => `<div class="code-row">${fld('codeRows.'+i, esc(r))}</div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
    },
  },

  //  MÓDULOS BLOG (lista de artículos cargada dinámicamente)

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
      <div style="text-align:center;padding:3rem 0;color:#94a3b8;font-size:.875rem;">${fld('loadingMessage', esc(d.loadingMessage))}</div>
    </div>
  </div>
</section>`;
    },
  },

  //  MÓDULOS ARTÍCULO (vista detalle)

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
    <a href="${esc(d.backHref)}" class="back-link"${css({ color: s.backLinkColor })}><i class="fa-solid fa-arrow-left fa-lg" aria-hidden="true"></i> ${fld('backLabel', esc(stripArrow(d.backLabel)))}</a>
    <div class="article-meta">
      <span class="badge-tech"${css({ background: s.badgeBg, color: s.badgeColor })}>${fld('badge', esc(d.badge))}</span>
      ${d.fecha ? `<span style="font-size:.75rem;opacity:.7;font-weight:600;">${esc(d.fecha)}</span>` : ''}
    </div>
    <h1 class="article-main-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>${fld('titulo', esc(d.titulo))}</h1>
    <p class="article-lead"${css({ color: s.leadColor, 'font-size': s.leadSize })}>${fld('lead', esc(d.lead))}</p>
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
      { name: 'featuredImageUrl', label: 'Imagen de respaldo (sin ?id=)', type: 'image' },
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
      ${d.featuredImageUrl ? `<img src="${esc(d.featuredImageUrl)}" alt="${esc(d.featuredImageAlt)}" class="featured-image"${css({ 'border-radius': s.imgRadius })}${fldImg('featuredImageUrl')}>` : ''}
      ${d.contentHtml || ''}
      <div class="article-cta"${css({ background: s.ctaBg })}>
        <h3${css({ color: s.ctaTitleColor })}>${fld('ctaTitle', esc(d.ctaTitle))}</h3>
        <p${css({ color: s.ctaTextColor })}>${fld('ctaText', esc(d.ctaText))}</p>
        <a href="${esc(d.ctaBtnHref)}" class="btn-hero-primary"${css({ background: s.ctaBtnBg || 'var(--sisgra-blue)', color: s.ctaBtnColor || 'white' })}>${fld('ctaBtnLabel', esc(d.ctaBtnLabel))}</a>
      </div>
    </div>
    <aside class="article-sidebar">
      <div class="sidebar-box dark"${css({ background: s.sidebarBg })}>
        <h4${css({ color: s.sidebarTitleColor })}>${fld('sidebarTitle', esc(d.sidebarTitle))}</h4>
        <p${css({ color: s.sidebarTextColor })}>${fld('sidebarText', esc(d.sidebarText))}</p>
      </div>
    </aside>
  </div>
</main>`;
    },
  },

  //  MÓDULOS CLIENTE (caso de éxito / perfil de cliente)
  //  Diseño propio en css/pages/cliente.css (clases cl-*)

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
      { name: 'empresaLogo',   label: 'Logo empresa (URL)',  type: 'image' },
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
      const meta = [
        ['sector', d.sector],
        ['ubicacion', d.ubicacion],
        ['anio', d.anio],
      ].filter(([, v]) => v)
        .map(([f, v]) => `<span class="cl-meta-item">${fld(f, esc(v))}</span>`).join('<span class="cl-meta-sep">·</span>');
      return `
<header class="cl-header"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="max-w-7xl">
    <a href="${esc(d.backHref)}" class="cl-back"${css({ color: s.backLinkColor })}><i class="fa-solid fa-arrow-left fa-lg" aria-hidden="true"></i> ${fld('backLabel', esc(stripArrow(d.backLabel)))}</a>
    <div class="cl-header-inner">
      ${d.empresaLogo ? `<div class="cl-logo-wrap"><img src="${esc(d.empresaLogo)}" alt="${esc(d.empresaNombre)}" class="cl-logo"${css({ 'max-height': s.logoMaxHeight })}></div>` : ''}
      <div class="cl-header-text">
        ${d.empresaNombre ? `<div class="cl-eyebrow"${css({ color: s.eyebrowColor })}>${fld('empresaNombre', esc(d.empresaNombre))}</div>` : ''}
        <h1 class="cl-title"${css({ color: s.titleColor, 'font-size': s.titleSize })}>${fld('titulo', esc(d.titulo))}</h1>
        ${d.lead ? `<p class="cl-lead"${css({ color: s.leadColor })}>${fld('lead', esc(d.lead))}</p>` : ''}
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
      { name: 'featuredImageUrl', label: 'Imagen destacada (URL)', type: 'image' },
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
        ['Empresa',   'empresa',   d.empresa],
        ['Sector',    'sector',    d.sector],
        ['Ubicación', 'ubicacion', d.ubicacion],
        ['Año',       'anio',      d.anio],
        ['Servicios', 'servicios', d.servicios],
      ].filter(([, , v]) => v).map(([k, f, v]) =>
        `<div class="cl-ficha-row"><dt class="cl-ficha-label"${css({ color: s.fichaLabelColor })}>${esc(k)}</dt><dd class="cl-ficha-value"${css({ color: s.fichaValueColor })}>${fld(f, esc(v))}</dd></div>`
      ).join('');
      return `
<main class="cl-body"${css({ background: s.bg, 'padding-top': s.paddingY, 'padding-bottom': s.paddingY })}>
  <div class="max-w-7xl cl-grid">
    <div class="cl-content"${css({ color: s.bodyTextColor })}>
      ${d.featuredImageUrl ? `<img src="${esc(d.featuredImageUrl)}" alt="${esc(d.featuredImageAlt)}" class="cl-featured"${css({ 'border-radius': s.imgRadius })}${fldImg('featuredImageUrl')}>` : ''}
      <div class="cl-richtext">${d.contentHtml || ''}</div>
      <div class="cl-cta"${css({ background: s.ctaBg })}>
        <h3${css({ color: s.ctaTitleColor })}>${fld('ctaTitle', esc(d.ctaTitle))}</h3>
        <p${css({ color: s.ctaTextColor })}>${fld('ctaText', esc(d.ctaText))}</p>
        <a href="${esc(d.ctaBtnHref)}" class="cl-cta-btn"${css({ background: s.ctaBtnBg, color: s.ctaBtnColor })}>${fld('ctaBtnLabel', esc(d.ctaBtnLabel))}</a>
      </div>
    </div>
    <aside class="cl-sidebar">
      <div class="cl-ficha"${css({ background: s.fichaBg })}>
        <h4 class="cl-ficha-title"${css({ color: s.fichaTitleColor })}>${fld('fichaTitle', esc(d.fichaTitle))}</h4>
        <dl class="cl-ficha-list">${fichaRows}</dl>
      </div>
    </aside>
  </div>
</main>`;
    },
  },

  //  FOOTER COMPLETO (compartido por todas las páginas secundarias:
  //  cableado, fibra, seguridad, soporte, desarrollo, blog, articulo)
  //  Usa las clases reales de css/layout.css

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
      contactoTelefono:{ tipo: 'Teléfono', valor: '8101220065', href: 'tel:8101220065' },
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
    <h1${css({ color: s.wordmarkColor })}>${fld('wordmark', esc(d.wordmark))}</h1>
  </div>
  <div class="footer-grid"${css({ background: s.gridBg })}>
    <div class="footer-col">
      <div class="col-label"${css({ color: s.colLabelColor })}>${fld('col1Label', esc(d.col1Label))}</div>
      <ul class="services-list">
        ${(d.servicios||[]).map((sv, i) => `<li><a href="${esc(sv.href)}"${css({ color: s.linkColor })}>${fld('servicios.'+i+'.label', esc(sv.label))}</a></li>`).join('')}
      </ul>
    </div>
    <div class="footer-col">
      <div class="col-label"${css({ color: s.colLabelColor })}>${fld('col2Label', esc(d.col2Label))}</div>
      <div class="contact-stack">
        <div class="contact-item">
          <div class="ci-type">${esc(ofi.tipo||'Oficina')}</div>
          <div class="ci-value"${css({ color: s.textColor })}>${fld('contactoOficina.valor', ofi.valor||'')}</div>
        </div>
        <div class="contact-item">
          <div class="ci-type">${esc(tel.tipo||'Teléfono')}</div>
          <div class="ci-value"><a href="${esc(tel.href||'#')}"${css({ color: s.linkColor })}>${fld('contactoTelefono.valor', esc(tel.valor||''))}</a></div>
        </div>
        <div class="contact-item">
          <div class="ci-type">${esc(mail.tipo||'Email')}</div>
          <div class="ci-value"><a href="${esc(mail.href||'#')}"${css({ color: s.linkColor })}>${fld('contactoEmail.valor', esc(mail.valor||''))}</a></div>
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
        <div class="map-overlay-label">${fld('mapaLabel', esc(d.mapaLabel))}</div>
      </div>
    </div>
  </div>
  <div class="footer-bottom"${css({ background: s.bottomBg })}>
    <p class="copy"${css({ color: s.copyColor })}>${fld('copyright', d.copyright)}</p>
  </div>
</footer>`;
    },
  },

};

//  CAMPOS COMUNES — se agregan a todos los módulos automáticamente

Object.values(SECTIONS).forEach(sec => {
  sec.defaultDesign = sec.defaultDesign || {};
  Object.assign(sec.defaultDesign, { maxWidth: '', scale: '', marginTop: '', marginBottom: '', display: '' });
  (sec.designFields = sec.designFields || []).push(
    { name: 'maxWidth',     label: 'Ancho máximo (tamaño)', type: 'text', placeholder: 'ej: 1200px ó 80%' },
    { name: 'scale',        label: 'Escala',                type: 'text', placeholder: 'ej: 1 · 0.9 · 1.1' },
    { name: 'marginTop',    label: 'Margen superior',       type: 'text', placeholder: 'ej: 0 ó 2rem' },
    { name: 'marginBottom', label: 'Margen inferior',       type: 'text', placeholder: 'ej: 0 ó 2rem' },
    { name: 'display',      label: 'Display CSS',           type: 'text', placeholder: 'ej: none, flex, block' },
  );
});

//  HELPERS

// Envuelve el HTML de un módulo en un <div> con márgenes/display si el design lo pide.
function wrapDesign(html, design) {
  const d = design || {};
  const s = [
    d.marginTop    ? `margin-top:${d.marginTop}`       : '',
    d.marginBottom ? `margin-bottom:${d.marginBottom}` : '',
    d.display      ? `display:${d.display}`            : '',
    d.maxWidth     ? `max-width:${d.maxWidth};margin-left:auto;margin-right:auto` : '',
    d.scale        ? `transform:scale(${d.scale});transform-origin:top center`   : '',
  ].filter(Boolean).join(';');
  return s ? `<div style="${s}">${html}</div>` : html;
}

// Render de un módulo v2: { tipo, data, design }. Tolera el viejo `type` (v1).
export function renderModulo(mod) {
  const tipo = mod.tipo || mod.type;
  const def = SECTIONS[tipo];
  if (!def) return `<div style="padding:2rem;background:#fee;color:#900;text-align:center;">Módulo desconocido: ${esc(tipo)}</div>`;
  setFieldColors((mod.data && mod.data.__colores) || {});   // colores por palabra
  const out = wrapDesign(def.render(mod.data || {}, mod.design || {}), mod.design);
  setFieldColors({});
  return out;
}

// Compat: render de una "sección" v1 ({ type, data, design }). Lo usa el editor actual.
export function renderSection(sec) {
  return renderModulo({ tipo: sec.type, data: sec.data, design: sec.design });
}

// Indexa el catálogo de módulos por id_modulo (acepta array o { modulos: [...] }).
function indexarModulos(modulos) {
  const arr = Array.isArray(modulos) ? modulos : (modulos?.modulos || []);
  const map = new Map();
  for (const m of arr) map.set(m.id_modulo, m);
  return map;
}

// Resuelve plantilla.id_modulos contra el catálogo → array ordenado de módulos,
// CLONADOS para poder inyectarles datos dinámicos por instancia (cliente/artículo)
// sin mutar el catálogo. El orden y los repetidos de id_modulos se respetan.
export function resolverModulos(plantilla, modulos) {
  const byId = indexarModulos(modulos);
  return (plantilla?.id_modulos || [])
    .map(id => byId.get(id))
    .filter(Boolean)
    .map(m => JSON.parse(JSON.stringify(m)));
}

export function renderModulos(mods) {
  if (!mods?.length) return '<div style="padding:4rem;text-align:center;color:#94a3b8;">Esta plantilla aún no tiene módulos.</div>';
  return mods.map(renderModulo).join('');
}

// Contenedores (filas de módulos)
// Un contenedor es una fila con 1 a 3 módulos lado a lado. La plantilla guarda
// `contenedores: [[id,id],[id],...]`. Acá reagrupamos la lista YA resuelta y
// mutada (nav/cliente/artículo) en sus filas, casando por id_modulo y
// consumiendo en orden — así toleramos módulos faltantes o ids repetidos.
export function agruparEnContenedores(secciones, contenedores) {
  if (!Array.isArray(contenedores) || !contenedores.length) {
    // Sin contenedores (datos viejos): cada módulo en su propia fila 1x1.
    return (secciones || []).map(s => [s]);
  }
  const pool = (secciones || []).slice();
  const grupos = [];
  for (const cont of contenedores) {
    const grupo = [];
    for (const entry of (cont || [])) {
      // Módulo INLINE (ej: una card suelta guardada dentro de la plantilla): se
      // renderiza directo, sin buscarlo en el catálogo.
      if (entry && typeof entry === 'object' && entry.inline) { grupo.push(entry); continue; }
      const idx = pool.findIndex(s => s && s.id_modulo === entry);
      if (idx !== -1) { grupo.push(pool[idx]); pool.splice(idx, 1); }
    }
    if (grupo.length) grupos.push(grupo);
  }
  // Defensa: módulos que quedaron sin contenedor → filas 1x1 al final.
  pool.forEach(s => grupos.push([s]));
  return grupos;
}

// Render de un contenedor: 1 módulo = ancho completo (idéntico a antes);
// 2 o 3 módulos = grid de columnas iguales (.cont-row colapsa a 1 col en mobile).
function renderContenedor(grupo) {
  if (!grupo.length) return '';
  if (grupo.length === 1) return renderModulo(grupo[0]);
  const n = Math.min(grupo.length, 3);
  const celdas = grupo.map(m => `<div class="cont-cell">${renderModulo(m)}</div>`).join('');
  return `<div class="cont-row cont-row-${n}" style="grid-template-columns:repeat(${n},minmax(0,1fr));">${celdas}</div>`;
}

// Render de una plantilla respetando sus contenedores. `secciones` es la lista
// plana ya resuelta; `contenedores` define el agrupado en filas.
export function renderModulosAgrupados(secciones, contenedores) {
  // No cortamos por `secciones` vacío: un contenedor puede tener SOLO módulos
  // inline (cards sueltas guardadas en la plantilla, que no están en secciones).
  const grupos = agruparEnContenedores(secciones, contenedores);
  if (!grupos.length) return '<div style="padding:4rem;text-align:center;color:#94a3b8;">Esta plantilla aún no tiene módulos.</div>';
  return grupos.map(renderContenedor).join('');
}

// Render completo de una plantilla v2: resuelve por id_modulos y arma el HTML.
export function renderPlantilla(plantilla, modulos) {
  return renderModulos(resolverModulos(plantilla, modulos));
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
