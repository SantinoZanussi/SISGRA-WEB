const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'plantillas.json');
const NAV_FILE = path.join(DATA_DIR, 'navbar.json');

// vincula una pagina btn-* sin href a su pestaña del navbar apuntando al shell /p/<tipo>
function vincularHrefNav(tipo, idMenuArr) {
  if (!/^btn-/.test(tipo || '') || !Array.isArray(idMenuArr) || !idMenuArr.length) return;
  let nav;
  try { nav = JSON.parse(fs.readFileSync(NAV_FILE, 'utf-8')); } catch { return; }
  let changed = false;
  idMenuArr.forEach(idm => {
    const b = (nav.botones || []).find(x => x.id_menu === Number(idm));
    if (b && !b.href) { b.href = `/p/${tipo}`; changed = true; }
  });
  if (changed) fs.writeFileSync(NAV_FILE, JSON.stringify(nav, null, 2) + '\n', 'utf-8');
}

const TIPOS_BASE = [
  'index', 'blog', 'articulo', 'cliente',
  'cableado', 'fibra', 'seguridad', 'soporte', 'desarrollo',
  'contacto', 'obras', 'sectores', 'pres',
  '404',   // la renderiza el catch-all del server, sin html fisico
];

function nextId(plantillas) {
  const nums = plantillas.map(p => parseInt(p.id_plantilla, 10)).filter(n => !isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

// los btn-* son paginas personalizadas creadas desde el panel de navbar
function isTipoValido(tipo) {
  return TIPOS_BASE.includes(tipo) || /^btn-/.test(tipo);
}

// se mantiene por compatibilidad
const TIPOS_VALIDOS = TIPOS_BASE;

// contenedores = [[id,id],[id],...] cada subarray es una fila de modulos en orden
// id_modulos se mantiene siempre como el aplanado de contenedores

// modulo inline: vive dentro de la plantilla, sin id de catalogo
function esInline(x) {
  return x && typeof x === 'object' && x.inline === true;
}

// aplana contenedores a ids numericos; los inline no tienen id
function flattenContenedores(conts) {
  return [].concat(...conts.map(c => (Array.isArray(c) ? c.filter(n => Number.isFinite(n)) : [])));
}

// normaliza cada contenedor a ids numericos o modulos inline, null si no es array
function sanitizeContenedores(conts) {
  if (!Array.isArray(conts)) return null;
  return conts.map(c => (Array.isArray(c)
    ? c.map(x => (esInline(x) ? x : Number(x))).filter(x => esInline(x) || (typeof x === 'number' && !isNaN(x)))
    : []));
}

// asegura contenedores valido e id_modulos en sync; migra datos viejos a 1x1 por modulo
function normalizarPlantilla(p) {
  let conts = sanitizeContenedores(p.contenedores);
  if (!conts) conts = (Array.isArray(p.id_modulos) ? p.id_modulos : []).map(id => [Number(id)]);
  p.contenedores = conts;
  p.id_modulos   = flattenContenedores(conts);
  return p;
}

function read() {
  if (!fs.existsSync(FILE)) return { plantillas: [] };
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    (data.plantillas || []).forEach(normalizarPlantilla);
    return data;
  } catch { return { plantillas: [] }; }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /api/plantillas?tipo=index
exports.listar = (req, res) => {
  const { tipo } = req.query;
  let { plantillas } = read();
  if (tipo) plantillas = plantillas.filter(p => p.tipo === tipo);
  res.json({ plantillas });
};

// GET /api/plantillas/tipos
exports.listarTipos = (_req, res) => {
  res.json({ tipos: TIPOS_VALIDOS });
};

// GET /api/plantillas/activa/:tipo  publico
exports.activaPorTipo = (req, res) => {
  const { tipo } = req.params;
  if (!isTipoValido(tipo)) {
    return res.status(400).json({ error: `Tipo inválido: ${tipo}` });
  }
  const { plantillas } = read();
  const activa = plantillas.find(p => p.tipo === tipo && p.activa);
  if (!activa) return res.status(404).json({ error: 'No hay plantilla activa para este tipo' });
  res.json({ plantilla: activa });
};

// GET /api/plantillas/:id
exports.obtener = (req, res) => {
  const id = Number(req.params.id);   // id_plantilla es numerico en v2
  const { plantillas } = read();
  const tpl = plantillas.find(p => p.id_plantilla === id);
  if (!tpl) return res.status(404).json({ error: 'Plantilla no encontrada' });
  res.json({ plantilla: tpl });
};

// POST /api/plantillas  [auth]
exports.crear = (req, res) => {
  const { tipo, nombre, descripcion, id_menu, id_modulos, contenedores } = req.body || {};
  if (!tipo) return res.status(400).json({ error: 'El campo "tipo" es obligatorio' });
  if (!isTipoValido(tipo)) {
    return res.status(400).json({ error: `Tipo inválido. Valores base: ${TIPOS_BASE.join(', ')} (o btn-*)` });
  }
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El campo "nombre" es obligatorio' });
  }

  const data = read();
  const ahora = new Date();
  const now = ahora.toISOString();
  // vencimiento automatico de 7 dias
  const fin = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  // contenedores manda; si solo llega id_modulos se deriva 1x1 por modulo
  const nueva = normalizarPlantilla({
    id_plantilla: nextId(data.plantillas),
    tipo,
    nombre: nombre.trim(),
    descripcion: descripcion || '',
    activa: false,
    fecha_inicio: now,
    fecha_fin:    fin,
    id_menu:      Array.isArray(id_menu)    ? id_menu    : [],
    id_modulos:   Array.isArray(id_modulos) ? id_modulos : [],
    contenedores: Array.isArray(contenedores) ? contenedores : undefined,
    creado_en: now,
    editado_en: now,
  });
  data.plantillas.push(nueva);
  save(data);
  vincularHrefNav(nueva.tipo, nueva.id_menu);
  res.status(201).json({ ok: true, plantilla: nueva });
};

// PATCH /api/plantillas/:id  [auth]
exports.actualizar = (req, res) => {
  const id = Number(req.params.id);
  const data = read();
  const idx = data.plantillas.findIndex(p => p.id_plantilla === id);
  if (idx === -1) return res.status(404).json({ error: 'Plantilla no encontrada' });

  const { tipo, nombre, descripcion, id_menu, id_modulos, contenedores } = req.body || {};
  if (tipo !== undefined && !isTipoValido(tipo)) {
    return res.status(400).json({ error: `Tipo inválido. Valores base: ${TIPOS_BASE.join(', ')} (o btn-*)` });
  }

  const tpl = data.plantillas[idx];
  if (tipo !== undefined)         tpl.tipo = tipo;
  if (nombre !== undefined)       tpl.nombre = String(nombre).trim();
  if (descripcion !== undefined)  tpl.descripcion = descripcion;
  if (Array.isArray(id_menu))     tpl.id_menu = id_menu;
  // contenedores manda; si solo llega id_modulos se deriva 1x1 por modulo
  if (Array.isArray(contenedores))   tpl.contenedores = contenedores;
  else if (Array.isArray(id_modulos)) tpl.contenedores = id_modulos.map(id => [id]);
  if (Array.isArray(contenedores) || Array.isArray(id_modulos)) normalizarPlantilla(tpl);
  tpl.editado_en = new Date().toISOString();

  save(data);
  res.json({ ok: true, plantilla: tpl });
};

// POST /api/plantillas/:id/activar  [auth]
// activa esta y desactiva las demas del mismo tipo; fecha_fin = ahora + 7 dias
exports.activar = (req, res) => {
  const id = Number(req.params.id);
  const data = read();
  const tpl = data.plantillas.find(p => p.id_plantilla === id);
  if (!tpl) return res.status(404).json({ error: 'Plantilla no encontrada' });

  const now = new Date();
  const fin = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  data.plantillas.forEach(p => {
    if (p.tipo === tpl.tipo) p.activa = (p.id_plantilla === id);
  });

  tpl.fecha_inicio = now.toISOString();
  tpl.fecha_fin    = fin.toISOString();
  tpl.editado_en   = now.toISOString();
  save(data);
  res.json({ ok: true, plantilla: tpl });
};

// POST /api/plantillas/:id/extender  [auth]
// extiende fecha_fin 7 dias desde el fin actual, o desde ahora si ya vencio
exports.extender = (req, res) => {
  const id = Number(req.params.id);
  const data = read();
  const tpl = data.plantillas.find(p => p.id_plantilla === id);
  if (!tpl) return res.status(404).json({ error: 'Plantilla no encontrada' });

  const base = tpl.fecha_fin
    ? Math.max(Date.now(), new Date(tpl.fecha_fin).getTime())
    : Date.now();
  const nuevaFin = new Date(base + 7 * 24 * 60 * 60 * 1000);
  tpl.fecha_fin  = nuevaFin.toISOString();
  tpl.editado_en = new Date().toISOString();
  save(data);
  res.json({ ok: true, plantilla: tpl });
};

// DELETE /api/plantillas/:id  [auth]
// si borras la activa, promueve otra del mismo tipo; si no hay otra, rechaza
exports.eliminar = (req, res) => {
  const id = Number(req.params.id);
  const data = read();
  const tpl = data.plantillas.find(p => p.id_plantilla === id);
  if (!tpl) return res.status(404).json({ error: 'Plantilla no encontrada' });

  let promoted = null;
  if (tpl.activa) {
    const otras = data.plantillas.filter(p => p.tipo === tpl.tipo && p.id_plantilla !== id);
    if (otras.length === 0) {
      return res.status(400).json({
        error: `No se puede eliminar: es la única plantilla para "${tpl.tipo}". Creá otra antes de borrar esta.`
      });
    }
    // activa la mas recientemente editada
    const sorted = [...otras].sort((a, b) => (b.editado_en || '').localeCompare(a.editado_en || ''));
    promoted = sorted[0];
    data.plantillas.forEach(p => {
      if (p.tipo === tpl.tipo) p.activa = (p.id_plantilla === promoted.id_plantilla);
    });
    const promNow = new Date();
    promoted.fecha_inicio = promNow.toISOString();
    promoted.fecha_fin    = new Date(promNow.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    promoted.editado_en   = promNow.toISOString();
  }

  data.plantillas = data.plantillas.filter(p => p.id_plantilla !== id);
  save(data);
  res.json({
    ok: true,
    wasActive: !!tpl.activa,
    tipoAffected: tpl.tipo,
    promoted: promoted ? { id_plantilla: promoted.id_plantilla, nombre: promoted.nombre } : null,
  });
};

exports.TIPOS_VALIDOS = TIPOS_VALIDOS;
