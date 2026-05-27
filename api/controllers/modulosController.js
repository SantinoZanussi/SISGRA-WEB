const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'modulos.json');

function read() {
  if (!fs.existsSync(FILE)) return { modulos: {} };
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')); }
  catch { return { modulos: {} }; }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// GET /api/modulos
exports.listar = (_req, res) => res.json(read());

// GET /api/modulos/:type/variantes
exports.listarVariantes = (req, res) => {
  const { type } = req.params;
  const state = read();
  const mod = state.modulos[type];
  if (!mod) return res.json({ variantes: [] });
  res.json({ variantes: mod.variantes || [] });
};

// POST /api/modulos/:type/variantes  [auth]
exports.crearVariante = (req, res) => {
  const { type } = req.params;
  const { nombre, data, design } = req.body || {};
  if (!nombre) return res.status(400).json({ error: 'El campo nombre es obligatorio' });
  const state = read();
  if (!state.modulos[type]) state.modulos[type] = { variantes: [] };
  if (!Array.isArray(state.modulos[type].variantes)) state.modulos[type].variantes = [];
  const variante = {
    id: `${type}-${uid()}`,
    nombre,
    data:   data   || {},
    design: design || {},
    creada_en: new Date().toISOString(),
  };
  state.modulos[type].variantes.push(variante);
  save(state);
  res.json({ ok: true, variante });
};

// PUT /api/modulos/:type/variantes/:id  [auth]
exports.actualizarVariante = (req, res) => {
  const { type, id } = req.params;
  const { nombre, data, design } = req.body || {};
  const state = read();
  const mod = state.modulos[type];
  if (!mod) return res.status(404).json({ error: 'Módulo no encontrado' });
  const idx = (mod.variantes || []).findIndex(v => v.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Variante no encontrada' });
  if (nombre  !== undefined) mod.variantes[idx].nombre = nombre;
  if (data    !== undefined) mod.variantes[idx].data   = data;
  if (design  !== undefined) mod.variantes[idx].design = design;
  mod.variantes[idx].editada_en = new Date().toISOString();
  save(state);
  res.json({ ok: true, variante: mod.variantes[idx] });
};

// DELETE /api/modulos/:type/variantes/:id  [auth]
exports.eliminarVariante = (req, res) => {
  const { type, id } = req.params;
  const state = read();
  const mod = state.modulos[type];
  if (!mod) return res.status(404).json({ error: 'Módulo no encontrado' });
  const before = (mod.variantes || []).length;
  if (before <= 1) return res.status(400).json({ error: 'No se puede eliminar la única variante del módulo' });
  mod.variantes = mod.variantes.filter(v => v.id !== id);
  if (mod.variantes.length === before) return res.status(404).json({ error: 'Variante no encontrada' });
  save(state);
  res.json({ ok: true });
};
