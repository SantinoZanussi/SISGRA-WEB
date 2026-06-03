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

// ── data helpers ────────────────────────────────────────────────────
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

// ── páginas personalizadas (btn-*) ──────────────────────────────────
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

// ── controllers ─────────────────────────────────────────────────────

// GET /api/nav/botones
exports.listarBotones = (_req, res) => {
  const { botones } = readNav();
  const { plantillas } = readPlantillas();
  const out = botones.map(b => {
    const p = plantillaDeMenu(b.id_menu, plantillas);
    return {
      ...b,
      esCustom: esCustom(p),
      plantilla: p ? { id: p.id_plantilla, nombre: p.nombre, tipo: p.tipo } : null,
    };
  });
  res.json({ botones: out });
};

// POST /api/nav/botones  [auth]
// Body: { titulo, tipoRedireccion ('url'|'custom'), href?, grupo?, orden?, activo? }
exports.crearBoton = (req, res) => {
  const { titulo, href, tipoRedireccion, id_plantilla, grupo, orden, activo } = req.body || {};
  if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'El campo "titulo" es obligatorio' });

  const data = readNav();
  const id_menu = nextMenuId(data.botones);
  let botonHref = null;

  if (id_plantilla != null) {
    // ── Vincular a una plantilla existente (sin escribir rutas a mano) ──
    const pltData = readPlantillas();
    const plt = pltData.plantillas.find(p => p.id_plantilla === Number(id_plantilla));
    if (!plt) return res.status(404).json({ error: 'Plantilla no encontrada' });
    botonHref = plantillaHref(plt.tipo);
  } else if (tipoRedireccion === 'custom') {
    // ── Crear plantilla v2 en blanco + su shell físico html/<tipo>/index.html,
    //    que se edita como cualquier plantilla y anda en cualquier server. ──
    const pltData = readPlantillas();
    const tipo = crearPlantillaCustom(pltData, id_menu, titulo.trim());
    savePlantillas(pltData);
    botonHref = customHref(tipo);
  } else {
    // ── URL externa libre ──
    botonHref = href || null;
    if (!botonHref) return res.status(400).json({ error: 'Se requiere "href" para ítems de tipo URL' });
  }

  const nuevo = {
    id_menu,
    titulo: titulo.trim(),
    href:   botonHref,
    grupo:  grupo || null,
    orden:  orden ?? (data.botones.length + 1),
    activo: activo !== undefined ? activo : true,
  };
  data.botones.push(nuevo);
  saveNav(data);

  res.status(201).json({ ok: true, boton: nuevo });
};

// PATCH /api/nav/botones/:id   [auth]   (:id = id_menu)
// Body: { titulo?, grupo?, orden?, activo?, + destino opcional }
// El destino se cambia con los mismos 3 modos que crearBoton:
//   · id_plantilla       → vincular a una plantilla existente
//   · tipoRedireccion:'custom' → asegurar/crear la página propia (btn-N)
//   · href               → URL externa
exports.actualizarBoton = (req, res) => {
  const id = Number(req.params.id);
  const data = readNav();
  const b = data.botones.find(x => x.id_menu === id);
  if (!b) return res.status(404).json({ error: 'Ítem no encontrado' });

  // Campos simples (href se maneja aparte cuando hay cambio de destino).
  ['titulo', 'grupo', 'orden', 'activo'].forEach(f => {
    if (req.body[f] !== undefined) b[f] = req.body[f];
  });

  const { id_plantilla, tipoRedireccion, href } = req.body || {};
  const cambiaDestino = id_plantilla !== undefined || tipoRedireccion !== undefined || href !== undefined;

  if (cambiaDestino) {
    const pltData = readPlantillas();
    const actual = plantillaDeMenu(id, pltData.plantillas);

    // Suelta el destino anterior: si era página propia (btn-*) la borra junto
    // a su shell físico; si era una página del sistema, solo desvincula el id_menu.
    const soltarDestinoPrevio = () => {
      if (esCustom(actual)) {
        pltData.plantillas = pltData.plantillas.filter(p => p.id_plantilla !== actual.id_plantilla);
        borrarShellCustom(actual.tipo);
      } else if (actual) {
        actual.id_menu = (actual.id_menu || []).filter(m => m !== id);
      }
    };

    if (id_plantilla != null) {
      // ── Vincular a una plantilla existente ──
      const plt = pltData.plantillas.find(p => p.id_plantilla === Number(id_plantilla));
      if (!plt) return res.status(404).json({ error: 'Plantilla no encontrada' });
      if (!actual || actual.id_plantilla !== plt.id_plantilla) soltarDestinoPrevio();
      b.href = plantillaHref(plt.tipo);
    } else if (tipoRedireccion === 'custom') {
      // ── Asegurar la página propia. Si ya es btn-*, se conserva su plantilla
      //    (y su contenido) y se re-asegura el shell; si no, se crea en blanco. ──
      if (esCustom(actual)) {
        escribirShellCustom(actual.tipo, b.titulo);
        b.href = customHref(actual.tipo);
      } else {
        soltarDestinoPrevio();
        const tipo = crearPlantillaCustom(pltData, id, b.titulo);
        b.href = customHref(tipo);
      }
    } else if (href !== undefined) {
      // ── URL externa libre ──
      soltarDestinoPrevio();
      b.href = href || null;
    }

    savePlantillas(pltData);
  }

  saveNav(data);
  res.json({ ok: true, boton: b });
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
