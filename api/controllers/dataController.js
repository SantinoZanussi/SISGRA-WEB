const fs = require('fs');
const path = require('path');

// Resuelve la carpeta /data relativa a la raíz del proyecto (un nivel arriba de /api)
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const ALLOWED_FILES = [
  'hero', 'nosotros', 'servicios', 'clientes', 'blog',
  'contacto', 'seo', 'paginas', 'categorias'
];

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readJSON(name) {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function writeJSON(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf-8');
}

// GET /api/data/:file  → devuelve el JSON completo
exports.getFile = (req, res) => {
  const { file } = req.params;
  if (!ALLOWED_FILES.includes(file)) return res.status(404).json({ error: 'Archivo no encontrado' });
  const data = readJSON(file);
  if (!data) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.json(data);
};

// PUT /api/data/:file  → reemplaza el JSON completo (requiere auth)
exports.updateFile = (req, res) => {
  const { file } = req.params;
  if (!ALLOWED_FILES.includes(file)) return res.status(404).json({ error: 'Archivo no encontrado' });
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Body inválido' });
  try {
    writeJSON(file, req.body);
    res.json({ ok: true, data: req.body });
  } catch (e) {
    res.status(500).json({ error: 'Error al guardar', detail: e.message });
  }
};

// POST /api/data/:file/:collection  → agrega un item a un array dentro del JSON
exports.createItem = (req, res) => {
  const { file, collection } = req.params;
  if (!ALLOWED_FILES.includes(file)) return res.status(404).json({ error: 'Archivo no encontrado' });
  const data = readJSON(file);
  if (!data) return res.status(404).json({ error: 'Archivo no encontrado' });
  if (!Array.isArray(data[collection])) return res.status(400).json({ error: `"${collection}" no es un array` });

  const newItem = { ...req.body, id: `${collection.slice(0,2)}-${Date.now()}` };
  data[collection].push(newItem);
  writeJSON(file, data);
  res.status(201).json({ ok: true, item: newItem });
};

// PATCH /api/data/:file/:collection/:id  → actualiza un item por id
exports.updateItem = (req, res) => {
  const { file, collection, id } = req.params;
  if (!ALLOWED_FILES.includes(file)) return res.status(404).json({ error: 'Archivo no encontrado' });
  const data = readJSON(file);
  if (!data || !Array.isArray(data[collection])) return res.status(404).json({ error: 'Colección no encontrada' });

  const idx = data[collection].findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Item no encontrado' });

  data[collection][idx] = { ...data[collection][idx], ...req.body };
  writeJSON(file, data);
  res.json({ ok: true, item: data[collection][idx] });
};

// DELETE /api/data/:file/:collection/:id  → elimina un item por id
exports.deleteItem = (req, res) => {
  const { file, collection, id } = req.params;
  if (!ALLOWED_FILES.includes(file)) return res.status(404).json({ error: 'Archivo no encontrado' });
  const data = readJSON(file);
  if (!data || !Array.isArray(data[collection])) return res.status(404).json({ error: 'Colección no encontrada' });

  const before = data[collection].length;
  data[collection] = data[collection].filter(i => i.id !== id);
  if (data[collection].length === before) return res.status(404).json({ error: 'Item no encontrado' });

  writeJSON(file, data);
  res.json({ ok: true });
};