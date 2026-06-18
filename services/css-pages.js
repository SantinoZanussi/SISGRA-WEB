// Fuente única de verdad para el CSS por página y el mapeo módulo→página.
// La usan tanto el editor de plantillas (preview en iframe) como el runtime
// (page-bootstrap.js, páginas en vivo), así ambos cargan exactamente el mismo
// CSS y no vuelven a divergir.

// CSS que carga cada tipo de página.
export const TIPO_CSS = {
  index:      ['/css/base.css', '/css/layout_home.css', '/css/components.css', '/css/pages/home.css', '/css/pages/blog_inicio.css'],
  blog:       ['/css/base.css', '/css/layout.css', '/css/components.css', '/css/pages/blog.css'],
  articulo:   ['/css/base.css', '/css/layout.css', '/css/components.css', '/css/pages/articulo.css'],
  cliente:    ['/css/base.css', '/css/layout.css', '/css/components.css', '/css/pages/cliente.css'],
  cableado:   ['/css/base.css', '/css/layout.css', '/css/components.css', '/css/pages/cableado.css'],
  fibra:      ['/css/base.css', '/css/layout.css', '/css/components.css', '/css/pages/fibra_optica.css'],
  seguridad:  ['/css/base.css', '/css/layout.css', '/css/components.css', '/css/pages/seguridad.css'],
  soporte:    ['/css/base.css', '/css/layout.css', '/css/components.css', '/css/pages/soporte_it.css'],
  desarrollo: ['/css/base.css', '/css/layout.css', '/css/components.css', '/css/pages/desarrollo.css'],
  '404':      ['/css/base.css', '/css/layout.css', '/css/components.css', '/css/pages/404.css'],
};

// Cada tipo de módulo → la página cuyo CSS lo estiliza.
export const TYPE_TO_PAGE = {
  nav: 'index', hero: 'index', 'hero-centered': 'index',
  clientes: 'index', blog: 'index', services: 'index',
  about: 'index', cta: 'index', spacer: 'index', footer: 'index',
  'cableado-hero': 'cableado',
  'fibra-hero': 'fibra',
  'seguridad-hero': 'seguridad',
  'soporte-hero': 'soporte',
  'desarrollo-hero': 'desarrollo',
  'blog-list': 'blog',
  'articulo-header': 'articulo', 'articulo-body': 'articulo', 'cliente-header': 'cliente', 'cliente-body': 'cliente',
  'footer-full': 'cableado',
  'error-404': '404',
};

// Módulos globales: se estilan con los layouts compartidos (nav/footer) o con
// estilos inline (cta/spacer), así que no necesitan ninguna hoja de /css/pages/.
export const GLOBAL_MODULE_TYPES = new Set(['nav', 'footer', 'footer-full', 'cta', 'spacer', 'formulario']);

// Layout por defecto para páginas nuevas (btn-*) que no están en TIPO_CSS: usan
// el layout interno (no el de home), igual que el resto de páginas internas.
export const INTERNAL_DEFAULT_CSS = ['/css/base.css', '/css/layout.css', '/css/components.css'];

// Devuelve la lista de CSS que necesita una plantilla: el del tipo como base,
// MÁS la hoja de /css/pages/ de cada módulo de contenido presente. Así un módulo
// de otra página (o una página nueva btn-*) carga su CSS propio. Solo se suma
// page CSS — nunca layouts extra — para no chocar layout.css con layout_home.css.
// Para tipos conocidos sin módulos cruzados, el resultado es idéntico al base.
export function cssFilesFor(tipo, sections) {
  const base = TIPO_CSS[tipo] || INTERNAL_DEFAULT_CSS;
  const files = [...base];
  (sections || []).forEach(s => {
    const t = s.type || s.tipo;   // v1 usa `type`, v2 (módulos) usa `tipo`
    if (GLOBAL_MODULE_TYPES.has(t)) return;
    const pg = TYPE_TO_PAGE[t];
    if (!pg) return;
    (TIPO_CSS[pg] || []).forEach(f => {
      if (f.includes('/css/pages/') && !files.includes(f)) files.push(f);
    });
  });
  return files;
}
