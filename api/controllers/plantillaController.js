const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'plantillas.json');

const TIPOS_BASE = [
  'index', 'blog', 'articulo',
  'cableado', 'fibra', 'seguridad', 'soporte', 'desarrollo',
];

// Genera el siguiente ID numérico secuencial basado en los existentes
function nextId(plantillas) {
  const nums = plantillas.map(p => parseInt(p.id_plantilla, 10)).filter(n => !isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

// Los tipos btn-* son páginas personalizadas creadas desde el panel de navbar
function isTipoValido(tipo) {
  return TIPOS_BASE.includes(tipo) || /^btn-/.test(tipo);
}

// Mantener array exportado para compatibilidad
const TIPOS_VALIDOS = TIPOS_BASE;

function read() {
  if (!fs.existsSync(FILE)) return { plantillas: [] };
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')); }
  catch { return { plantillas: [] }; }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /api/plantillas?tipo=index   (lists all, optional filter)
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

// GET /api/plantillas/activa/:tipo   (public, no auth)
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
  const { id } = req.params;
  const { plantillas } = read();
  const tpl = plantillas.find(p => p.id_plantilla === id);
  if (!tpl) return res.status(404).json({ error: 'Plantilla no encontrada' });
  res.json({ plantilla: tpl });
};

// POST /api/plantillas   [auth]
exports.crear = (req, res) => {
  const { tipo, nombre, descripcion, secciones } = req.body || {};
  if (!tipo) return res.status(400).json({ error: 'El campo "tipo" es obligatorio' });
  if (!isTipoValido(tipo)) {
    return res.status(400).json({ error: `Tipo inválido. Valores base: ${TIPOS_BASE.join(', ')} (o btn-*)` });
  }
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El campo "nombre" es obligatorio' });
  }

  const data = read();
  const now = new Date().toISOString();
  const nueva = {
    id_plantilla: String(nextId(data.plantillas)),
    tipo,
    nombre: nombre.trim(),
    descripcion: descripcion || '',
    activa: false,
    secciones: Array.isArray(secciones) ? secciones : [],
    creado_en: now,
    editado_en: now,
  };
  data.plantillas.push(nueva);
  save(data);
  res.status(201).json({ ok: true, plantilla: nueva });
};

// PATCH /api/plantillas/:id   [auth]
exports.actualizar = (req, res) => {
  const { id } = req.params;
  const data = read();
  const idx = data.plantillas.findIndex(p => p.id_plantilla === id);
  if (idx === -1) return res.status(404).json({ error: 'Plantilla no encontrada' });

  const { tipo, nombre, descripcion, secciones } = req.body || {};
  if (tipo !== undefined && !isTipoValido(tipo)) {
    return res.status(400).json({ error: `Tipo inválido. Valores base: ${TIPOS_BASE.join(', ')} (o btn-*)` });
  }

  const tpl = data.plantillas[idx];
  if (tipo !== undefined)        tpl.tipo = tipo;
  if (nombre !== undefined)      tpl.nombre = String(nombre).trim();
  if (descripcion !== undefined) tpl.descripcion = descripcion;
  if (Array.isArray(secciones))  tpl.secciones = secciones;
  tpl.editado_en = new Date().toISOString();

  save(data);
  res.json({ ok: true, plantilla: tpl });
};

// POST /api/plantillas/:id/activar   [auth]
// Marca esta plantilla como activa; desactiva las demás del mismo tipo.
// Setea fecha_inicio (ahora) y fecha_fin (ahora + 7 días) en la activada.
exports.activar = (req, res) => {
  const { id } = req.params;
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

// POST /api/plantillas/:id/extender   [auth]
// Extiende fecha_fin 7 días desde fecha_fin actual (o desde ahora si ya venció).
exports.extender = (req, res) => {
  const { id } = req.params;
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

// DELETE /api/plantillas/:id   [auth]
// Si la plantilla a borrar es la activa:
//   - busca otra plantilla del mismo tipo y la activa automáticamente
//   - si no hay otra, RECHAZA el borrado (no se puede dejar un HTML sin plantilla activa)
exports.eliminar = (req, res) => {
  const { id } = req.params;
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
    // Activar la primera disponible (la más recientemente editada para preferir trabajo reciente)
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
