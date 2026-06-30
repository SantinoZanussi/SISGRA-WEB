const fs = require('fs');
const path = require('path');
const { generateId } = require('../utils/id');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'assets.json');
// las imagenes se guardan en /img, servido estaticamente
const IMG_DIR = path.join(__dirname, '..', '..', 'img');

const MIME_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
};

// extensiones reconocidas al escanear /img
const EXT_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

// paleta con la que se siembran las etiquetas al iniciar
const DEFAULT_COLOR_LABELS = [
  { nombre: 'Rojo',     color: '#ef4444' },
  { nombre: 'Naranja',  color: '#f97316' },
  { nombre: 'Amarillo', color: '#eab308' },
  { nombre: 'Verde',    color: '#22c55e' },
  { nombre: 'Azul',     color: '#3b82f6' },
  { nombre: 'Violeta',  color: '#8b5cf6' },
  { nombre: 'Rosa',     color: '#ec4899' },
  { nombre: 'Gris',     color: '#64748b' },
];

const GRUPOS_VALIDOS = ['color', 'modulo', 'plantilla', 'menu'];

function read() {
  let data;
  if (!fs.existsSync(FILE)) data = { assets: [], labels: [] };
  else {
    try { data = JSON.parse(fs.readFileSync(FILE, 'utf-8')); }
    catch { data = { assets: [], labels: [] }; }
  }
  if (!Array.isArray(data.assets)) data.assets = [];
  if (!Array.isArray(data.labels)) data.labels = [];
  return data;
}

// siembra la paleta la primera vez, cuando no hay etiquetas
function seedLabels(data) {
  if (data.labels.length) return false;
  data.labels = DEFAULT_COLOR_LABELS.map(l => ({
    id: generateId('lbl'),
    nombre: l.nombre,
    color: l.color,
    grupo: 'color',
  }));
  return true;
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // saca acentos
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'imagen';
}

// nombre legible a partir de un filename
function nombreDesdeArchivo(rel) {
  const base = path.basename(rel, path.extname(rel));
  return base.replace(/[-_]+/g, ' ').trim() || base;
}

// filename unico relativo a IMG_DIR evitando colisiones en registro y disco
// excludeFilename ignora el archivo actual al renombrar
function uniqueFilename(dir, base, ext, assets, excludeFilename = null) {
  const prefix = dir ? `${dir}/` : '';
  const taken = new Set(
    assets.map(a => a.filename).filter(f => f && f !== excludeFilename)
  );
  const exists = (rel) =>
    taken.has(rel) || (rel !== excludeFilename && fs.existsSync(path.join(IMG_DIR, rel)));

  let candidate = `${prefix}${base}${ext}`;
  let n = 2;
  while (exists(candidate)) {
    candidate = `${prefix}${base}-${n}${ext}`;
    n++;
  }
  return candidate;
}

// escanea /img recursivo, rutas relativas a IMG_DIR
function escanearImagenes(dir = IMG_DIR, baseRel = '') {
  let out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const ent of entries) {
    const rel = baseRel ? `${baseRel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      out = out.concat(escanearImagenes(path.join(dir, ent.name), rel));
    } else if (EXT_MIME[path.extname(ent.name).toLowerCase()]) {
      out.push(rel);
    }
  }
  return out;
}

// sincroniza el registro con /img: importa las nuevas (bloqueadas) y borra huerfanas
function sincronizar(data) {
  const enDisco = escanearImagenes();
  const setDisco = new Set(enDisco);
  const setRegistro = new Set(data.assets.map(a => a.filename));
  let changed = false;

  for (const rel of enDisco) {
    if (setRegistro.has(rel)) continue;
    const now = new Date().toISOString();
    let size = 0;
    try { size = fs.statSync(path.join(IMG_DIR, rel)).size; } catch {}
    data.assets.push({
      id: generateId('img'),
      nombre: nombreDesdeArchivo(rel),
      filename: rel,
      path: `/img/${rel}`,
      locked: true,            // las pre-existentes se importan bloqueadas por seguridad
      mime: EXT_MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream',
      size,
      origen: 'existente',
      etiquetas: [],
      creado_en: now,
      editado_en: now,
    });
    changed = true;
  }

  const before = data.assets.length;
  data.assets = data.assets.filter(a => setDisco.has(a.filename));
  if (data.assets.length !== before) changed = true;

  return changed;
}

// GET /api/assets  lista imagenes (subidas + detectadas) y etiquetas
exports.listar = (_req, res) => {
  const data = read();
  const changed = [sincronizar(data), seedLabels(data)].some(Boolean);
  if (changed) save(data);
  // subidas primero, luego detectadas, ambas por fecha desc
  const orden = { subida: 0, existente: 1 };
  const assets = [...data.assets].sort((a, b) => {
    const oa = orden[a.origen] ?? 0, ob = orden[b.origen] ?? 0;
    if (oa !== ob) return oa - ob;
    return (b.creado_en || '').localeCompare(a.creado_en || '');
  }).map(a => ({ ...a, etiquetas: Array.isArray(a.etiquetas) ? a.etiquetas : [] }));
  res.json({ assets, labels: data.labels });
};

// POST /api/assets  [auth, multipart]  campo "file" + opcional "nombre"
exports.subir = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo (campo "file")' });

  const ext = MIME_EXT[req.file.mimetype];
  if (!ext) {
    return res.status(400).json({ error: `Tipo de archivo no permitido: ${req.file.mimetype}. Solo imágenes.` });
  }

  const data = read();
  const nombreBase = (req.body && req.body.nombre && req.body.nombre.trim())
    || path.parse(req.file.originalname).name;
  const slug = slugify(nombreBase);
  const filename = uniqueFilename('', slug, ext, data.assets);

  try {
    if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
    fs.writeFileSync(path.join(IMG_DIR, filename), req.file.buffer);
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo guardar el archivo', detail: e.message });
  }

  const now = new Date().toISOString();
  const asset = {
    id: generateId('img'),
    nombre: nombreBase,
    filename,
    path: `/img/${filename}`,
    locked: false,
    mime: req.file.mimetype,
    size: req.file.size,
    origen: 'subida',
    etiquetas: [],
    creado_en: now,
    editado_en: now,
  };
  data.assets.push(asset);
  save(data);
  res.status(201).json({ ok: true, asset });
};

// PATCH /api/assets/:id  [auth]  { nombre }  renombra archivo y ruta
exports.renombrar = (req, res) => {
  const { id } = req.params;
  const data = read();
  const asset = data.assets.find(a => a.id === id);
  if (!asset) return res.status(404).json({ error: 'Imagen no encontrada' });
  if (asset.locked) return res.status(403).json({ error: 'La imagen está bloqueada. Desbloqueala para renombrarla.' });

  const nuevoNombre = (req.body && req.body.nombre || '').trim();
  if (!nuevoNombre) return res.status(400).json({ error: 'El campo "nombre" es obligatorio' });

  const ext = path.extname(asset.filename);
  let dir = path.dirname(asset.filename);
  if (dir === '.') dir = '';
  const slug = slugify(nuevoNombre);
  const nuevoFilename = uniqueFilename(dir, slug, ext, data.assets, asset.filename);

  if (nuevoFilename !== asset.filename) {
    try {
      fs.renameSync(path.join(IMG_DIR, asset.filename), path.join(IMG_DIR, nuevoFilename));
    } catch (e) {
      return res.status(500).json({ error: 'No se pudo renombrar el archivo', detail: e.message });
    }
    asset.filename = nuevoFilename;
    asset.path = `/img/${nuevoFilename}`;
  }
  asset.nombre = nuevoNombre;
  asset.editado_en = new Date().toISOString();
  save(data);
  res.json({ ok: true, asset });
};

// PATCH /api/assets/:id/lock  [auth]  alterna bloqueo
exports.toggleLock = (req, res) => {
  const { id } = req.params;
  const data = read();
  const asset = data.assets.find(a => a.id === id);
  if (!asset) return res.status(404).json({ error: 'Imagen no encontrada' });

  asset.locked = !asset.locked;
  asset.editado_en = new Date().toISOString();
  save(data);
  res.json({ ok: true, asset });
};

// DELETE /api/assets/:id  [auth]  borra registro y archivo
exports.eliminar = (req, res) => {
  const { id } = req.params;
  const data = read();
  const asset = data.assets.find(a => a.id === id);
  if (!asset) return res.status(404).json({ error: 'Imagen no encontrada' });
  if (asset.locked) return res.status(403).json({ error: 'La imagen está bloqueada. Desbloqueala para eliminarla.' });

  try {
    const fp = path.join(IMG_DIR, asset.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo borrar el archivo', detail: e.message });
  }

  data.assets = data.assets.filter(a => a.id !== id);
  save(data);
  res.json({ ok: true });
};

// etiquetas: grupo color | modulo | plantilla | menu

// GET /api/assets/labels  publico
exports.listarLabels = (_req, res) => {
  const data = read();
  if (seedLabels(data)) save(data);
  res.json({ labels: data.labels });
};

// POST /api/assets/labels  [auth]  { nombre, color, grupo }
exports.crearLabel = (req, res) => {
  const { nombre, color, grupo } = req.body || {};
  const nom = (nombre || '').trim();
  if (!nom) return res.status(400).json({ error: 'El campo "nombre" es obligatorio' });
  const grp = GRUPOS_VALIDOS.includes(grupo) ? grupo : 'color';
  const col = (color || '').trim() || '#64748b';

  const data = read();
  const label = { id: generateId('lbl'), nombre: nom, color: col, grupo: grp };
  data.labels.push(label);
  save(data);
  res.status(201).json({ ok: true, label });
};

// PATCH /api/assets/labels/:id  [auth]  { nombre?, color?, grupo? }
exports.editarLabel = (req, res) => {
  const { id } = req.params;
  const data = read();
  const label = data.labels.find(l => l.id === id);
  if (!label) return res.status(404).json({ error: 'Etiqueta no encontrada' });

  const { nombre, color, grupo } = req.body || {};
  if (typeof nombre === 'string' && nombre.trim()) label.nombre = nombre.trim();
  if (typeof color === 'string' && color.trim()) label.color = color.trim();
  if (GRUPOS_VALIDOS.includes(grupo)) label.grupo = grupo;
  save(data);
  res.json({ ok: true, label });
};

// DELETE /api/assets/labels/:id  [auth]  borra la etiqueta y la quita de las imagenes
exports.eliminarLabel = (req, res) => {
  const { id } = req.params;
  const data = read();
  const existe = data.labels.some(l => l.id === id);
  if (!existe) return res.status(404).json({ error: 'Etiqueta no encontrada' });

  data.labels = data.labels.filter(l => l.id !== id);
  for (const a of data.assets) {
    if (Array.isArray(a.etiquetas) && a.etiquetas.includes(id)) {
      a.etiquetas = a.etiquetas.filter(e => e !== id);
    }
  }
  save(data);
  res.json({ ok: true });
};

// PATCH /api/assets/:id/tags  [auth]  { etiquetas: [labelId,...] }
exports.asignarTags = (req, res) => {
  const { id } = req.params;
  const data = read();
  const asset = data.assets.find(a => a.id === id);
  if (!asset) return res.status(404).json({ error: 'Imagen no encontrada' });

  const entrada = Array.isArray(req.body?.etiquetas) ? req.body.etiquetas : [];
  const validas = new Set(data.labels.map(l => l.id));
  asset.etiquetas = [...new Set(entrada.filter(e => validas.has(e)))];
  asset.editado_en = new Date().toISOString();
  save(data);
  res.json({ ok: true, asset });
};
