const fs = require('fs');
const path = require('path');
const { generateId } = require('../utils/id');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'plantillas.json');

const TIPOS_VALIDOS = [
  'index', 'blog', 'articulo',
  'cableado', 'fibra', 'seguridad', 'soporte', 'desarrollo',
];

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
  if (!TIPOS_VALIDOS.includes(tipo)) {
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
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ error: `Tipo inválido. Valores: ${TIPOS_VALIDOS.join(', ')}` });
  }
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El campo "nombre" es obligatorio' });
  }

  const data = read();
  const now = new Date().toISOString();
  const nueva = {
    id_plantilla: generateId('plt'),
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
  if (tipo !== undefined && !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ error: `Tipo inválido. Valores: ${TIPOS_VALIDOS.join(', ')}` });
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
exports.activar = (req, res) => {
  const { id } = req.params;
  const data = read();
  const tpl = data.plantillas.find(p => p.id_plantilla === id);
  if (!tpl) return res.status(404).json({ error: 'Plantilla no encontrada' });

  data.plantillas.forEach(p => {
    if (p.tipo === tpl.tipo) p.activa = (p.id_plantilla === id);
  });
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
    promoted.editado_en = new Date().toISOString();
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
