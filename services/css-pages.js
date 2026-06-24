// fuente única del css por página; la usan el editor y el runtime para no divergir
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

// tipo de módulo y la página cuyo css lo estiliza
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

// módulos globales: usan layouts compartidos o estilos inline, sin hoja de /css/pages/
export const GLOBAL_MODULE_TYPES = new Set(['nav', 'footer', 'footer-full', 'cta', 'spacer', 'formulario']);

// layout interno por defecto para páginas nuevas (btn-*) que no están en TIPO_CSS
export const INTERNAL_DEFAULT_CSS = ['/css/base.css', '/css/layout.css', '/css/components.css'];

// css del tipo como base + la hoja /css/pages/ de cada módulo de contenido presente
// solo page css, nunca layouts, para no chocar layout.css con layout_home.css
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
