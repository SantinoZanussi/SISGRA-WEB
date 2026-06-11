const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NAV_FILE = path.join(DATA_DIR, 'navbar.json');
const PLT_FILE = path.join(DATA_DIR, 'plantillas.json');
const HTML_DIR = path.join(__dirname, '..', '..', 'html');

// Módulos globales que se inyectan en cada página nueva (compartidos).
const GLOBAL_NAV_ID    = 1;   // id_modulo del nav global
const GLOBAL_FOOTER_ID = 3;   // id_modulo del footer-full global

// URL pública de cada plantilla según su tipo. Los tipos del sistema tienen su
// página física en html/<tipo>/index.html; las plantillas custom (btn-*) también
// se materializan como html/<tipo>/index.html (ver crearPlantillaCustom), así
// andan en cualquier server estático (Live Server) sin depender de un route.
const TIPO_PATH = {
  index:      '/',
  blog:       '/html/blog',
  articulo:   '/html/articulo',
  cliente:    '/html/cliente',
  cableado:   '/html/cableado_estructurado',
  fibra:      '/html/fibra_optica',
  seguridad:  '/html/seguridad',
  soporte:    '/html/soporte_it',
  desarrollo: '/html/desarrollo',
};
const customHref = tipo => `/html/${tipo}`;
function plantillaHref(tipo) {
  return TIPO_PATH[tipo] || customHref(tipo);
}

// data helpers
function readNav() {
  if (!fs.existsSync(NAV_FILE)) return { botones: [] };
  try { return JSON.parse(fs.readFileSync(NAV_FILE, 'utf-8')); } catch { return { botones: [] }; }
}
function saveNav(data) { fs.writeFileSync(NAV_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8'); }

function readPlantillas() {
  if (!fs.existsSync(PLT_FILE)) return { plantillas: [] };
  try { return JSON.parse(fs.readFileSync(PLT_FILE, 'utf-8')); } catch { return { plantillas: [] }; }
}
function savePlantillas(data) { fs.writeFileSync(PLT_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8'); }

const nextMenuId      = botones    => (botones.length    ? Math.max(...botones.map(b => Number(b.id_menu) || 0))      : 0) + 1;
const nextPlantillaId = plantillas => (plantillas.length ? Math.max(...plantillas.map(p => Number(p.id_plantilla) || 0)) : 0) + 1;

// Plantilla vinculada a un id_menu (vía plantilla.id_menu[]).
function plantillaDeMenu(id_menu, plantillas) {
  return plantillas.find(p => (p.id_menu || []).includes(id_menu)) || null;
}
const esCustom = p => !!p && /^btn-/.test(p.tipo || '');

// Menú jerárquico (padre/hijos)
// El menú se modela como árbol: cada ítem tiene `padre` (id_menu de otro ítem;
// 0 = nivel principal). Un ítem con hijos se muestra como desplegable. No hay
// ítems especiales: cualquier ítem puede ser padre de otros.

// Título del padre de un botón, o null si cuelga de la raíz.
function padreTituloDe(boton, botones) {
  if (!boton.padre) return null;
  const p = botones.find(b => b.id_menu === boton.padre);
  return p ? p.titulo : null;
}

// Valida un valor de `padre` para un ítem: debe ser 0, o el id de otro ítem que
// no sea él mismo ni un descendiente suyo (evita ciclos). Devuelve el id
// normalizado o null si es inválido.
function validarPadre(botones, padre, idPropio) {
  const id = Number(padre) || 0;
  if (id === 0) return 0;
  if (id === idPropio) return null;
  if (!botones.some(b => b.id_menu === id)) return null;
  // Subir por la cadena de padres desde el candidato: si aparece idPropio, hay ciclo.
  let cur = id;
  const visitados = new Set();
  while (cur && !visitados.has(cur)) {
    visitados.add(cur);
    if (cur === idPropio) return null;
    cur = botones.find(b => b.id_menu === cur)?.padre || 0;
  }
  return id;
}

// páginas personalizadas (btn-*)
// Shell físico html/<tipo>/index.html: un cascarón que hidrata la plantilla
// activa de ese tipo vía bootstrapPage (igual que las páginas del sistema).
function shellHtml(tipo, titulo) {
  const t = String(titulo || 'SISGRA S.R.L.').replace(/</g, '&lt;');
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t} — SISGRA S.R.L.</title>
  <meta name="description" content="">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800;900&display=swap" rel="stylesheet">
  <link rel="icon" href="/img/sdesigra.png">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/layout.css">
  <link rel="stylesheet" href="/css/components.css">
</head>
<body>
<!-- SHELL — página personalizada "${tipo}", controlada desde el admin -->
<div id="plantilla-root">
  <div style="padding:6rem 2rem;text-align:center;color:#94a3b8;font-family:'Inter',system-ui,sans-serif;letter-spacing:.15em;text-transform:uppercase;font-size:.75rem;">Cargando…</div>
</div>
<script type="module">
  import { bootstrapPage } from '/services/page-bootstrap.js';
  bootstrapPage('${tipo}', 'plantilla-root');
</script>
</body>
</html>
`;
}

function escribirShellCustom(tipo, titulo) {
  const dir = path.join(HTML_DIR, tipo);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), shellHtml(tipo, titulo), 'utf-8');
  } catch (e) { console.warn('[navController] No se pudo escribir el shell custom:', e.message); }
}

function borrarShellCustom(tipo) {
  const dir = path.join(HTML_DIR, tipo);
  try { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); }
  catch (e) { console.warn('[navController] No se pudo borrar el shell custom:', e.message); }
}

// Crea la plantilla custom (btn-N) + su shell físico. Devuelve el tipo.
function crearPlantillaCustom(pltData, id_menu, titulo) {
  const now  = new Date().toISOString();
  const tipo = `btn-${id_menu}`;
  pltData.plantillas.push({
    id_plantilla: nextPlantillaId(pltData.plantillas),
    tipo,
    nombre: (titulo || 'Página').trim() + ' — página personalizada',
    descripcion: 'Página personalizada generada automáticamente.',
    activa: true,
    id_menu: [id_menu],
    id_modulos: [GLOBAL_NAV_ID, GLOBAL_FOOTER_ID],
    contenedores: [[GLOBAL_NAV_ID], [GLOBAL_FOOTER_ID]],
    creado_en: now,
    editado_en: now,
  });
  escribirShellCustom(tipo, titulo);
  return tipo;
}

// controllers

// GET /api/nav/botones
// Devuelve todos los ítems con datos derivados para el panel: título del padre,
// si tiene hijos (desplegable) y la plantilla vinculada (si la hay).
exports.listarBotones = (_req, res) => {
  const { botones } = readNav();
  const { plantillas } = readPlantillas();
  const out = botones.map(b => {
    const p = plantillaDeMenu(b.id_menu, plantillas);
    return {
      ...b,
      padreTitulo: padreTituloDe(b, botones),
      tieneHijos:  botones.some(x => (x.padre || 0) === b.id_menu),
      esCustom:    esCustom(p),
      plantilla:   p ? { id: p.id_plantilla, nombre: p.nombre, tipo: p.tipo } : null,
    };
  });
  res.json({ botones: out });
};

// POST /api/nav/botones  [auth]
// Body: { titulo, padre?, orden?, activo? }. Crea siempre la página propia del
// ítem (plantilla btn-N + shell), que se edita desde el panel de Plantillas.
exports.crearBoton = (req, res) => {
  const { titulo, padre, orden, activo } = req.body || {};
  if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'El campo "titulo" es obligatorio' });

  const data = readNav();
  const padreId = validarPadre(data.botones, padre, -1);
  if (padreId === null) return res.status(400).json({ error: 'El "padre" indicado no existe' });

  const id_menu = nextMenuId(data.botones);
  const pltData = readPlantillas();
  const tipo = crearPlantillaCustom(pltData, id_menu, titulo.trim());
  savePlantillas(pltData);

  const nuevo = {
    id_menu,
    titulo: titulo.trim(),
    padre:  padreId,
    menu:   'CE',
    href:   customHref(tipo),
    orden:  orden ?? (data.botones.length + 1),
    activo: activo !== undefined ? activo : true,
  };
  data.botones.push(nuevo);
  saveNav(data);

  res.status(201).json({ ok: true, boton: { ...nuevo, padreTitulo: padreTituloDe(nuevo, data.botones) } });
};

// PATCH /api/nav/botones/:id   [auth]   (:id = id_menu)
// Body: { titulo?, padre?, orden?, activo? }
exports.actualizarBoton = (req, res) => {
  const id = Number(req.params.id);
  const data = readNav();
  const b = data.botones.find(x => x.id_menu === id);
  if (!b) return res.status(404).json({ error: 'Ítem no encontrado' });

  ['titulo', 'orden', 'activo'].forEach(f => {
    if (req.body[f] !== undefined) b[f] = req.body[f];
  });

  if (req.body.padre !== undefined) {
    const padreId = validarPadre(data.botones, req.body.padre, id);
    if (padreId === null) return res.status(400).json({ error: 'Padre inválido: no existe o crea un ciclo' });
    b.padre = padreId;
  }

  saveNav(data);
  res.json({ ok: true, boton: { ...b, padreTitulo: padreTituloDe(b, data.botones) } });
};

// DELETE /api/nav/botones/:id   [auth]   (:id = id_menu)
// Si el ítem apunta a una página personalizada (btn-*), borra también la
// plantilla y su HTML. Si es una página del sistema, solo desvincula el id_menu.
exports.eliminarBoton = (req, res) => {
  const id = Number(req.params.id);
  const data = readNav();
  const boton = data.botones.find(x => x.id_menu === id);
  if (!boton) return res.status(404).json({ error: 'Ítem no encontrado' });

  const pltData = readPlantillas();
  const p = plantillaDeMenu(id, pltData.plantillas);
  let plantillaEliminada = null;

  if (esCustom(p)) {
    plantillaEliminada = p.nombre;
    pltData.plantillas = pltData.plantillas.filter(x => x.id_plantilla !== p.id_plantilla);
    savePlantillas(pltData);
    borrarShellCustom(p.tipo);
  } else if (p) {
    // Página del sistema: desvincular el id_menu, conservar la plantilla.
    p.id_menu = (p.id_menu || []).filter(m => m !== id);
    savePlantillas(pltData);
  }

  data.botones = data.botones.filter(x => x.id_menu !== id);
  // Subir los hijos del ítem borrado al nivel principal (no perderlos).
  data.botones.forEach(x => { if ((x.padre || 0) === id) x.padre = 0; });
  saveNav(data);

  res.json({ ok: true, plantillaEliminada });
};

// POST /api/nav/page   — compat: datos de la página de un ítem (por id_menu)
exports.getPage = (req, res) => {
  const { id_menu } = req.body || {};
  if (id_menu === undefined) return res.status(400).json({ error: 'Se requiere id_menu' });
  const { botones } = readNav();
  const boton = botones.find(b => b.id_menu === Number(id_menu));
  if (!boton) return res.status(404).json({ error: 'Ítem no encontrado' });
  const { plantillas } = readPlantillas();
  const plantilla = plantillaDeMenu(boton.id_menu, plantillas);
  res.json({ id_menu: boton.id_menu, titulo: boton.titulo, href: boton.href, plantilla });
};

// POST /api/nav/sync  — obsoleto en v2 (el nav se resuelve desde navbar.json en runtime)
exports.syncPlantillas = (_req, res) =>
  res.json({ ok: true, message: 'Sync obsoleto en v2: el nav se resuelve desde navbar.json en tiempo de render.' });
