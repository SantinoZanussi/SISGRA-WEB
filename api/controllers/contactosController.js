const fs = require('fs');
const path = require('path');
const { generateId } = require('../utils/id');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOG_FILE = path.join(DATA_DIR, 'contactos_log.json');

const ENDPOINT_DESTINO = null;

function leerLog() {
  if (!fs.existsSync(LOG_FILE)) return { envios: [] };
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8')); }
  catch { return { envios: [] }; }
}

function guardarLog(data) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Body: { campos: { Etiqueta: valor, ... }, pagina?, formulario? }
exports.crear = (req, res) => {
  const { campos, pagina, formulario } = req.body || {};
  if (!campos || typeof campos !== 'object' || !Object.keys(campos).length) {
    return res.status(400).json({ error: 'El envío no tiene campos' });
  }

  //solo pares clave→string, con límite de tamaño.
  const limpio = {};
  for (const [k, v] of Object.entries(campos)) {
    const key = String(k).slice(0, 120);
    limpio[key] = String(v ?? '').slice(0, 5000);
  }

  const log = leerLog();
  const envio = {
    id: generateId('contacto'),
    date_time_hour: new Date().toISOString(),
    estado: 'pendiente', // pendiente -> enviado, cuando exista el endpoint
    destino_url: ENDPOINT_DESTINO,
    pagina: pagina ? String(pagina).slice(0, 200) : null,
    formulario: formulario ? String(formulario).slice(0, 200) : null,
    campos: limpio,
  };
  log.envios.push(envio);
  guardarLog(log);

  res.status(201).json({ ok: true, id: envio.id });
};

// GET /api/contactos — historial de envíos
exports.listar = (_req, res) => res.json(leerLog());
