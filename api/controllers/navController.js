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
// página física; las plantillas custom (btn-*) se sirven por el shell genérico
// /p/:tipo (sin archivo .html propio).
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
function plantillaHref(tipo) {
  return TIPO_PATH[tipo] || `/p/${tipo}`;
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
    // ── Crear plantilla v2 en blanco (shell). NO se escribe un .html físico:
    //    la sirve el route genérico /p/:tipo y se edita como cualquier plantilla. ──
    const pltData = readPlantillas();
    const now  = new Date().toISOString();
    const tipo = `btn-${id_menu}`;
    const nuevaPlt = {
      id_plantilla: nextPlantillaId(pltData.plantillas),
      tipo,
      nombre: titulo.trim() + ' — página personalizada',
      descripcion: 'Página personalizada generada automáticamente.',
      activa: true,
      id_menu: [id_menu],
      id_modulos: [GLOBAL_NAV_ID, GLOBAL_FOOTER_ID],
      contenedores: [[GLOBAL_NAV_ID], [GLOBAL_FOOTER_ID]],
      creado_en: now,
      editado_en: now,
    };
    pltData.plantillas.push(nuevaPlt);
    savePlantillas(pltData);
    botonHref = `/p/${tipo}`;
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
exports.actualizarBoton = (req, res) => {
  const id = Number(req.params.id);
  const data = readNav();
  const b = data.botones.find(x => x.id_menu === id);
  if (!b) return res.status(404).json({ error: 'Ítem no encontrado' });

  ['titulo', 'href', 'grupo', 'orden', 'activo'].forEach(f => {
    if (req.body[f] !== undefined) b[f] = req.body[f];
  });
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
    const htmlPath = path.join(HTML_DIR, `${p.tipo}.html`);
    if (fs.existsSync(htmlPath)) {
      try { fs.unlinkSync(htmlPath); } catch (e) { console.warn('[navController] No se pudo eliminar el HTML:', e.message); }
    }
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
