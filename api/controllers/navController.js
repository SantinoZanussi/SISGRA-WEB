const fs = require('fs');
const path = require('path');
const { generateId } = require('../utils/id');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NAV_FILE  = path.join(DATA_DIR, 'navbar.json');
const PLT_FILE  = path.join(DATA_DIR, 'plantillas.json');
const HTML_DIR  = path.join(__dirname, '..', '..', 'html');

// ── data helpers ────────────────────────────────────────────────────

function readNav() {
  if (!fs.existsSync(NAV_FILE)) return { botones: [] };
  return JSON.parse(fs.readFileSync(NAV_FILE, 'utf-8'));
}

function saveNav(data) {
  fs.writeFileSync(NAV_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function readPlantillas() {
  if (!fs.existsSync(PLT_FILE)) return { plantillas: [] };
  try { return JSON.parse(fs.readFileSync(PLT_FILE, 'utf-8')); }
  catch { return { plantillas: [] }; }
}

function savePlantillas(data) {
  fs.writeFileSync(PLT_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ── nav items sync ──────────────────────────────────────────────────

// Botones que van dentro del dropdown "Instalaciones"
const INSTALACIONES_IDS = ['btn-cableado', 'btn-fibra', 'btn-seguridad'];

function buildNavItems(botones) {
  const activos = botones.filter(b => b.activo !== false && b.id_boton !== 'btn-index');
  const instBtns  = activos.filter(b => INSTALACIONES_IDS.includes(b.id_boton));
  const otherBtns = activos.filter(b => !INSTALACIONES_IDS.includes(b.id_boton));

  const items = [];

  if (instBtns.length > 0) {
    items.push({
      tipo: 'dropdown',
      titulo: 'Instalaciones',
      children: instBtns
        .sort((a, b) => a.orden - b.orden)
        .map(b => ({ titulo: b.titulo, href: b.href || '#' })),
    });
  }

  otherBtns
    .sort((a, b) => a.orden - b.orden)
    .forEach(b => items.push({
      tipo: 'link',
      titulo: b.titulo,
      href: b.href || '#',
      id_boton: b.id_boton,
    }));

  return items;
}

// Actualiza la sección "nav" de TODAS las plantillas con los ítems actuales.
function syncNavEnPlantillas(botones) {
  const pltData = readPlantillas();
  if (!pltData.plantillas?.length) return;

  const items = buildNavItems(botones);
  let changed = false;

  for (const plt of pltData.plantillas) {
    for (const sec of (plt.secciones || [])) {
      if (sec.type === 'nav') {
        sec.data = { ...sec.data, items };
        changed = true;
      }
    }
  }

  if (changed) savePlantillas(pltData);
}

// ── controllers ─────────────────────────────────────────────────────

// POST /api/nav/page
exports.getPage = (req, res) => {
  const { id_boton } = req.body || {};
  if (!id_boton) return res.status(400).json({ error: 'Se requiere id_boton' });

  const { botones } = readNav();
  const boton = botones.find(b => b.id_boton === id_boton);
  if (!boton) return res.status(404).json({ error: 'Botón no encontrado' });
  if (!boton.activo) return res.status(403).json({ error: 'Botón inactivo' });

  let plantilla = null;
  if (boton.id_plantilla) {
    const { plantillas } = readPlantillas();
    plantilla = plantillas.find(p => p.id_plantilla === boton.id_plantilla) || null;
  }

  res.json({
    id_boton:     boton.id_boton,
    titulo:       boton.titulo,
    modulo:       boton.modulo,
    id_plantilla: boton.id_plantilla,
    plantilla,
  });
};

// GET /api/nav/botones
exports.listarBotones = (_req, res) => {
  const { botones } = readNav();
  res.json({ botones });
};

// POST /api/nav/botones  [auth]
// Body requerido: { titulo }
// Body opcional:  { href, tipoRedireccion ('url'|'custom'), orden, activo }
exports.crearBoton = (req, res) => {
  const { titulo, href, tipoRedireccion, orden, activo } = req.body || {};
  if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'El campo "titulo" es obligatorio' });

  const data = readNav();
  const id_boton = generateId('btn');
  let id_plantilla = null;
  let botonHref    = href || null;

  if (tipoRedireccion === 'custom') {
    // ── Crear plantilla automáticamente ──────────────────────────
    const pltData = readPlantillas();
    const now = new Date().toISOString();
    const nuevaPlt = {
      id_plantilla: generateId('plt'),
      tipo:         id_boton,           // tipo único = id del botón
      nombre:       titulo.trim() + ' — página personalizada',
      descripcion:  'Página personalizada generada automáticamente.',
      activa:       true,
      secciones: [
        { id: generateId('sec'), type: 'nav',         data: {}, design: {} },
        { id: generateId('sec'), type: 'footer-full', data: {}, design: {} },
      ],
      creado_en:  now,
      editado_en: now,
    };
    pltData.plantillas.push(nuevaPlt);
    savePlantillas(pltData);

    id_plantilla = nuevaPlt.id_plantilla;
    botonHref    = `/html/${id_boton}.html`;

    // ── Crear archivo HTML ────────────────────────────────────────
    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title id="meta-title">${titulo.trim()} — SISGRA S.R.L.</title>
  <meta name="description" id="meta-desc" content="">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
  <link rel="icon" href="/img/sdesigra.png">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/layout.css">
  <link rel="stylesheet" href="/css/components.css">
</head>
<body>
<div id="plantilla-root">
  <div style="padding:6rem 2rem;text-align:center;color:#94a3b8;font-family:'Inter',system-ui,sans-serif;letter-spacing:.15em;text-transform:uppercase;font-size:.75rem;">Cargando…</div>
</div>
<script type="module">
  import { bootstrapPage } from '/services/page-bootstrap.js';
  bootstrapPage('${id_boton}', 'plantilla-root');
</script>
</body>
</html>`;
    try {
      fs.writeFileSync(path.join(HTML_DIR, `${id_boton}.html`), htmlContent, 'utf-8');
    } catch (e) {
      console.warn('[navController] No se pudo crear el HTML:', e.message);
    }
  } else if (!botonHref) {
    return res.status(400).json({ error: 'Se requiere "href" para ítems de tipo URL' });
  }

  const nuevo = {
    id_boton,
    titulo:       titulo.trim(),
    modulo:       id_boton,
    href:         botonHref,
    id_plantilla,
    orden:        orden ?? data.botones.length + 1,
    activo:       activo !== undefined ? activo : true,
  };
  data.botones.push(nuevo);
  saveNav(data);

  syncNavEnPlantillas(data.botones);

  res.status(201).json({ ok: true, boton: nuevo });
};

// PATCH /api/nav/botones/:id  [auth]
exports.actualizarBoton = (req, res) => {
  const { id } = req.params;
  const data = readNav();
  const idx = data.botones.findIndex(b => b.id_boton === id);
  if (idx === -1) return res.status(404).json({ error: 'Botón no encontrado' });

  const campos = ['titulo', 'modulo', 'href', 'id_plantilla', 'orden', 'activo'];
  const b = data.botones[idx];
  campos.forEach(f => { if (req.body[f] !== undefined) b[f] = req.body[f]; });
  saveNav(data);

  syncNavEnPlantillas(data.botones);

  res.json({ ok: true, boton: b });
};

// DELETE /api/nav/botones/:id  [auth]
// Si el botón tiene plantilla vinculada, la elimina también junto con su HTML.
exports.eliminarBoton = (req, res) => {
  const { id } = req.params;
  const data = readNav();
  const boton = data.botones.find(b => b.id_boton === id);
  if (!boton) return res.status(404).json({ error: 'Botón no encontrado' });

  let plantillaEliminada = null;

  if (boton.id_plantilla) {
    const pltData = readPlantillas();
    const pltIdx = pltData.plantillas.findIndex(p => p.id_plantilla === boton.id_plantilla);
    if (pltIdx !== -1) {
      plantillaEliminada = pltData.plantillas[pltIdx].nombre;
      pltData.plantillas.splice(pltIdx, 1);
      savePlantillas(pltData);
    }
    const htmlPath = path.join(HTML_DIR, `${id}.html`);
    if (fs.existsSync(htmlPath)) {
      try { fs.unlinkSync(htmlPath); } catch(e) { console.warn('[navController] No se pudo eliminar el HTML:', e.message); }
    }
  }

  data.botones = data.botones.filter(b => b.id_boton !== id);
  saveNav(data);

  syncNavEnPlantillas(data.botones);

  res.json({ ok: true, plantillaEliminada });
};

// POST /api/nav/sync  [auth]  — sincronización manual
exports.syncPlantillas = (req, res) => {
  const { botones } = readNav();
  syncNavEnPlantillas(botones);
  res.json({ ok: true, message: `Nav sincronizado en todas las plantillas (${botones.length} botones)` });
};
