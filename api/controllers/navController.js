const fs = require('fs');
const path = require('path');
const { generateId } = require('../utils/id');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NAV_FILE = path.join(DATA_DIR, 'navbar.json');
const PLT_FILE = path.join(DATA_DIR, 'plantillas.json');

function readNav() {
  if (!fs.existsSync(NAV_FILE)) return { botones: [] };
  return JSON.parse(fs.readFileSync(NAV_FILE, 'utf-8'));
}

function saveNav(data) {
  fs.writeFileSync(NAV_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function readPlantillas() {
  if (!fs.existsSync(PLT_FILE)) return { plantillas: [] };
  return JSON.parse(fs.readFileSync(PLT_FILE, 'utf-8'));
}

// POST /api/nav/page
// Body: { id_boton }
// Devuelve los datos de la página sin exponer nada en la URL
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
// Body requerido: { titulo, modulo }
// Body opcional:  { href, id_plantilla, orden, activo }
exports.crearBoton = (req, res) => {
  const { titulo, modulo, href, id_plantilla, orden, activo } = req.body || {};
  if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'El campo "titulo" es obligatorio' });
  if (!modulo || !modulo.trim()) return res.status(400).json({ error: 'El campo "modulo" es obligatorio' });

  const data = readNav();
  const nuevo = {
    id_boton:     generateId('btn'),
    titulo:       titulo.trim(),
    modulo:       modulo.trim(),
    href:         href || null,
    id_plantilla: id_plantilla || null,
    orden:        orden ?? data.botones.length + 1,
    activo:       activo !== undefined ? activo : true,
  };
  data.botones.push(nuevo);
  saveNav(data);
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
  campos.forEach(f => {
    if (req.body[f] !== undefined) b[f] = req.body[f];
  });
  saveNav(data);
  res.json({ ok: true, boton: b });
};

// DELETE /api/nav/botones/:id  [auth]
exports.eliminarBoton = (req, res) => {
  const { id } = req.params;
  const data = readNav();
  const before = data.botones.length;
  data.botones = data.botones.filter(b => b.id_boton !== id);
  if (data.botones.length === before) {
    return res.status(404).json({ error: 'Botón no encontrado' });
  }
  saveNav(data);
  res.json({ ok: true });
};
