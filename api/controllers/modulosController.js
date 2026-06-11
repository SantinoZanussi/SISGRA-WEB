const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE     = path.join(DATA_DIR, 'modulos.json');
const PLT_FILE = path.join(DATA_DIR, 'plantillas.json');

function read() {
  if (!fs.existsSync(FILE)) return { modulos: [] };
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    return { modulos: Array.isArray(d.modulos) ? d.modulos : [] };
  } catch { return { modulos: [] }; }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function nextId(modulos) {
  const nums = modulos.map(m => Number(m.id_modulo)).filter(n => !isNaN(n));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

// Normaliza la(s) página(s) asignada(s): '' / null / undefined → null.
// Acepta 'all', un array de ids (multi-página), un id numérico suelto
// (datos viejos) o, por compatibilidad, texto libre.
function normPagina(v) {
  if (v === undefined || v === null || v === '') return null;
  if (Array.isArray(v)) {
    const ids = [...new Set(v.map(Number).filter(n => !isNaN(n)))];
    return ids.length ? ids : null;
  }
  const n = Number(v);
  return isNaN(n) ? String(v) : n;
}

function plantillasQueUsan(id) {
  try {
    const plts = JSON.parse(fs.readFileSync(PLT_FILE, 'utf-8')).plantillas || [];
    return plts
      .filter(p => (p.id_modulos || []).includes(id))
      .map(p => ({ id_plantilla: p.id_plantilla, nombre: p.nombre, tipo: p.tipo }));
  } catch { return []; }
}

// GET /api/modulos
exports.listar = (_req, res) => res.json(read());

// GET /api/modulos/:id
exports.obtener = (req, res) => {
  const id = Number(req.params.id);
  const m = read().modulos.find(x => x.id_modulo === id);
  if (!m) return res.status(404).json({ error: 'Módulo no encontrado' });
  res.json({ modulo: m });
};

// GET /api/modulos/:id/usos  → plantillas que lo usan
exports.usos = (req, res) => {
  res.json({ usos: plantillasQueUsan(Number(req.params.id)) });
};

// POST /api/modulos  [auth]   Body: { tipo, nombre, data?, design?, alerta? }
exports.crear = (req, res) => {
  const { tipo, nombre, data, design, alerta, id_pagina } = req.body || {};
  if (!tipo)   return res.status(400).json({ error: 'El campo "tipo" es obligatorio' });
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'El campo "nombre" es obligatorio' });

  const state = read();
  const now = new Date().toISOString();
  const modulo = {
    id_modulo: nextId(state.modulos),
    tipo,
    nombre: String(nombre).trim(),
    id_pagina: normPagina(id_pagina),
    data:   data   || {},
    design: design || {},
    alerta: alerta === true,
    creado_en:  now,
    editado_en: now,
  };
  state.modulos.push(modulo);
  save(state);
  res.status(201).json({ ok: true, modulo });
};

// PUT /api/modulos/:id  [auth]
exports.actualizar = (req, res) => {
  const id = Number(req.params.id);
  const state = read();
  const m = state.modulos.find(x => x.id_modulo === id);
  if (!m) return res.status(404).json({ error: 'Módulo no encontrado' });

  const { tipo, nombre, data, design, alerta, id_pagina } = req.body || {};
  if (tipo      !== undefined) m.tipo      = tipo;
  if (nombre    !== undefined) m.nombre    = String(nombre).trim();
  if (id_pagina !== undefined) m.id_pagina = normPagina(id_pagina);
  if (data      !== undefined) m.data      = data;
  if (design    !== undefined) m.design    = design;
  if (alerta    !== undefined) m.alerta    = alerta === true;
  m.editado_en = new Date().toISOString();

  save(state);
  res.json({ ok: true, modulo: m });
};

// DELETE /api/modulos/:id  [auth]
exports.eliminar = (req, res) => {
  const id = Number(req.params.id);
  const state = read();
  const m = state.modulos.find(x => x.id_modulo === id);
  if (!m) return res.status(404).json({ error: 'Módulo no encontrado' });

  const usos = plantillasQueUsan(id);
  if (usos.length) {
    return res.status(400).json({
      error: `No se puede eliminar: lo usan ${usos.length} plantilla(s): ${usos.map(u => u.nombre).join(', ')}`,
      usos,
    });
  }

  state.modulos = state.modulos.filter(x => x.id_modulo !== id);
  save(state);
  res.json({ ok: true });
};
