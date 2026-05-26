const fs = require('fs');
const path = require('path');
const { generateId } = require('../utils/id');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'webhook_cache.json');
const PLT_FILE   = path.join(DATA_DIR, 'plantillas.json');

function readCache() {
  if (!fs.existsSync(CACHE_FILE)) return { entradas: [] };
  return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
}

function saveCache(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function readPlantillas() {
  if (!fs.existsSync(PLT_FILE)) return { plantillas: [] };
  return JSON.parse(fs.readFileSync(PLT_FILE, 'utf-8'));
}

function savePlantillas(data) {
  fs.writeFileSync(PLT_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// POST /api/webhook/pres  — público, recibe datos de API PRES
// Body: { id_pedido, contenido }
exports.recibirWebhook = (req, res) => {
  const { id_pedido, contenido } = req.body || {};
  if (!id_pedido) return res.status(400).json({ error: 'Se requiere id_pedido' });
  if (!contenido) return res.status(400).json({ error: 'Se requiere contenido' });

  const data = readCache();
  const entrada = {
    id_entrada:            generateId('wh'),
    id_pedido,
    contenido,
    contenido_editado:     null,
    editado:               false,
    procesado:             false,
    id_plantilla_asignada: null,
    id_seccion_asignada:   null,
    recibido_en:           new Date().toISOString(),
    procesado_en:          null,
  };
  data.entradas.push(entrada);
  saveCache(data);
  res.status(201).json({ ok: true, id_entrada: entrada.id_entrada });
};

// GET /api/webhook/cache  [auth]
// Query opcional: ?procesado=true|false
exports.listarCache = (req, res) => {
  const { procesado } = req.query;
  let { entradas } = readCache();
  if (procesado !== undefined) {
    const flag = procesado === 'true';
    entradas = entradas.filter(e => e.procesado === flag);
  }
  res.json({ entradas });
};

// GET /api/webhook/cache/:id  [auth]
exports.obtenerEntrada = (req, res) => {
  const { id } = req.params;
  const { entradas } = readCache();
  const entrada = entradas.find(e => e.id_entrada === id);
  if (!entrada) return res.status(404).json({ error: 'Entrada no encontrada' });
  res.json(entrada);
};

// PATCH /api/webhook/cache/:id  [auth]
// Edita el contenido antes de publicar en la plantilla
// Body: { contenido_editado }
exports.editarEntrada = (req, res) => {
  const { id } = req.params;
  const { contenido_editado } = req.body || {};
  if (contenido_editado === undefined) {
    return res.status(400).json({ error: 'Se requiere contenido_editado' });
  }

  const data = readCache();
  const idx = data.entradas.findIndex(e => e.id_entrada === id);
  if (idx === -1) return res.status(404).json({ error: 'Entrada no encontrada' });

  data.entradas[idx].contenido_editado = contenido_editado;
  data.entradas[idx].editado = true;
  saveCache(data);
  res.json({ ok: true, entrada: data.entradas[idx] });
};

// POST /api/webhook/cache/:id/publicar  [auth]
// Aplica el contenido (editado o crudo) a una sección de una plantilla
// Body: { id_plantilla, id_seccion }
exports.publicarEntrada = (req, res) => {
  const { id } = req.params;
  const { id_plantilla, id_seccion } = req.body || {};
  if (!id_plantilla) return res.status(400).json({ error: 'Se requiere id_plantilla' });
  if (!id_seccion)   return res.status(400).json({ error: 'Se requiere id_seccion' });

  const cacheData = readCache();
  const entradaIdx = cacheData.entradas.findIndex(e => e.id_entrada === id);
  if (entradaIdx === -1) return res.status(404).json({ error: 'Entrada no encontrada' });
  const entrada = cacheData.entradas[entradaIdx];

  const pltData = readPlantillas();
  const pltIdx  = pltData.plantillas.findIndex(p => p.id_plantilla === id_plantilla);
  if (pltIdx === -1) return res.status(404).json({ error: 'Plantilla no encontrada' });

  const plantilla = pltData.plantillas[pltIdx];
  const secciones = plantilla.contenido?.secciones || [];
  const secIdx    = secciones.findIndex(s => s.id_seccion === id_seccion);
  if (secIdx === -1) return res.status(404).json({ error: 'Sección no encontrada en la plantilla' });

  // Si el usuario editó el contenido se usa contenido_editado, si no el crudo de API PRES
  const contenidoFinal = entrada.editado ? entrada.contenido_editado : entrada.contenido;
  secciones[secIdx].datos_webhook = contenidoFinal;
  secciones[secIdx].editado       = entrada.editado;
  plantilla.contenido.secciones   = secciones;
  plantilla.editado_en            = new Date().toISOString();
  savePlantillas(pltData);

  // Marcar entrada como procesada
  cacheData.entradas[entradaIdx].procesado             = true;
  cacheData.entradas[entradaIdx].id_plantilla_asignada = id_plantilla;
  cacheData.entradas[entradaIdx].id_seccion_asignada   = id_seccion;
  cacheData.entradas[entradaIdx].procesado_en          = new Date().toISOString();
  saveCache(cacheData);

  res.json({ ok: true, seccion: secciones[secIdx] });
};

// DELETE /api/webhook/cache/:id  [auth]
exports.eliminarEntrada = (req, res) => {
  const { id } = req.params;
  const data = readCache();
  const before = data.entradas.length;
  data.entradas = data.entradas.filter(e => e.id_entrada !== id);
  if (data.entradas.length === before) {
    return res.status(404).json({ error: 'Entrada no encontrada' });
  }
  saveCache(data);
  res.json({ ok: true });
};
