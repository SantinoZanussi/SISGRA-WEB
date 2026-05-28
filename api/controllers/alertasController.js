const fs = require('fs');
const path = require('path');
const { generateId } = require('../utils/id');

const DATA_DIR    = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'alertas_config.json');
const LOG_FILE    = path.join(DATA_DIR, 'alertas_log.json');

// Catálogo de tipos de alerta. La lista completa la define el cliente más
// adelante; por ahora solo conocemos la 1 (vencimiento de módulo).
const CATALOGO_ALERTAS = {
  1: 'Vencimiento de módulo',
};

const DEFAULT_CONFIG = { webhook_url: '', intervalo_check_ms: 3600000, habilitado: true };

function leerConfig() {
  let cfg = { ...DEFAULT_CONFIG };
  if (fs.existsSync(CONFIG_FILE)) {
    try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) }; }
    catch { /* usa defaults */ }
  }
  // La env var pisa el archivo (sirve para producción sin commitear la URL)
  if (process.env.ALERTAS_WEBHOOK_URL) cfg.webhook_url = process.env.ALERTAS_WEBHOOK_URL;
  return cfg;
}

function leerLog() {
  if (!fs.existsSync(LOG_FILE)) return { alertas: [] };
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8')); }
  catch { return { alertas: [] }; }
}

function guardarLog(data) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Núcleo del sistema: arma el JSON { id_alerta, alerta, date_time_hour } y lo
// manda por POST a la URL configurada (node-red). Si todavía no hay URL, igual
// registra el intento en el log (estado "sin_url") para no perder el evento.
// `key` permite deduplicar disparos; `meta` guarda contexto extra en el log.
async function dispararAlerta({ id_alerta, alerta, key = null, meta = {} }) {
  const cfg = leerConfig();
  const date_time_hour = new Date().toISOString();
  const payload = { id_alerta, alerta, date_time_hour };

  let estado = 'sin_url';
  let http_status = null;
  let error = null;

  if (cfg.webhook_url) {
    try {
      const r = await fetch(cfg.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      http_status = r.status;
      estado = r.ok ? 'enviado' : 'error';
      if (!r.ok) error = `HTTP ${r.status}`;
    } catch (e) {
      estado = 'error';
      error = e.message;
    }
  }

  const registro = {
    id: generateId('alert'),
    key,
    id_alerta,
    alerta,
    date_time_hour,
    destino: cfg.webhook_url || null,
    estado,
    http_status,
    error,
    meta,
  };

  const log = leerLog();
  log.alertas.push(registro);
  guardarLog(log);

  if (estado === 'enviado') console.log(`[alertas] ✓ enviada id_alerta=${id_alerta} → ${cfg.webhook_url}`);
  else console.warn(`[alertas] id_alerta=${id_alerta} estado=${estado}${error ? ' · ' + error : ''}`);

  return registro;
}

// ─── HTTP handlers ──────────────────────────────────────────────────

// POST /api/alertas/disparar  [auth]   Body: { id_alerta, alerta? }
exports.disparar = async (req, res) => {
  const { id_alerta, alerta } = req.body || {};
  if (id_alerta === undefined || id_alerta === null) {
    return res.status(400).json({ error: 'Se requiere id_alerta' });
  }
  const texto = alerta || CATALOGO_ALERTAS[id_alerta] || `Alerta ${id_alerta}`;
  const registro = await dispararAlerta({ id_alerta, alerta: texto });
  res.status(201).json({ ok: true, alerta: registro });
};

// GET /api/alertas/catalogo   (público)
exports.catalogo = (_req, res) => res.json({ catalogo: CATALOGO_ALERTAS });

// GET /api/alertas/log   [auth]
exports.listarLog = (_req, res) => res.json(leerLog());

// GET /api/alertas/config   [auth]
exports.obtenerConfig = (_req, res) => {
  res.json({ config: leerConfig(), env_override: !!process.env.ALERTAS_WEBHOOK_URL });
};

// Reutilizables por el scheduler de vencimientos
exports.dispararAlerta   = dispararAlerta;
exports.leerConfig       = leerConfig;
exports.leerLog          = leerLog;
exports.CATALOGO_ALERTAS = CATALOGO_ALERTAS;
