const fs = require('fs');
const path = require('path');
const { generateId } = require('../utils/id');

const DATA_DIR    = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'alertas_config.json');
const LOG_FILE    = path.join(DATA_DIR, 'alertas_log.json');
const PLT_FILE    = path.join(DATA_DIR, 'plantillas.json');

const ID_VENCIMIENTO = 1;
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

// arma el JSON { id_alerta, alerta, date_time_hour }
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

// POST /api/alertas/disparar [auth] Body: { id_alerta, alerta? }
exports.disparar = async (req, res) => {
  const { id_alerta, alerta } = req.body || {};
  if (id_alerta === undefined || id_alerta === null) {
    return res.status(400).json({ error: 'Se requiere id_alerta' });
  }
  const texto = alerta || CATALOGO_ALERTAS[id_alerta] || `Alerta ${id_alerta}`;
  const registro = await dispararAlerta({ id_alerta, alerta: texto });
  res.status(201).json({ ok: true, alerta: registro });
};

// GET /api/alertas/catalogo (público)
exports.catalogo = (_req, res) => res.json({ catalogo: CATALOGO_ALERTAS });

// GET /api/alertas/log [auth]
exports.listarLog = (_req, res) => res.json(leerLog());

// GET /api/alertas/config [auth]
exports.obtenerConfig = (_req, res) => {
  res.json({ config: leerConfig(), env_override: !!process.env.ALERTAS_WEBHOOK_URL });
};

function leerPlantillas() {
  if (!fs.existsSync(PLT_FILE)) return { plantillas: [] };
  try { return JSON.parse(fs.readFileSync(PLT_FILE, 'utf-8')); }
  catch { return { plantillas: [] }; }
}

function estaVencida(p) {
  return p.activa && p.fecha_fin && Date.now() > new Date(p.fecha_fin).getTime();
}

function detectarVencimientos() {
  const { plantillas } = leerPlantillas();
  const log = leerLog();
  const vencidos = [];
  let logChanged = false;

  for (const p of plantillas) {
    if (!estaVencida(p)) continue;
    for (const sec of (p.secciones || []).filter(s => s.alerta === true)) {
      const key = `venc|${p.id_plantilla}|${sec.id}|${p.fecha_fin}`;
      const alerta = `${CATALOGO_ALERTAS[ID_VENCIMIENTO]}: módulo "${sec.type || 'módulo'}" de la plantilla "${p.nombre}" (${p.tipo}) venció el ${p.fecha_fin}`;
      vencidos.push({
        id_alerta: ID_VENCIMIENTO,
        alerta,
        id_plantilla:     p.id_plantilla,
        nombre_plantilla: p.nombre,
        tipo_plantilla:   p.tipo,
        id_seccion:       sec.id,
        tipo_seccion:     sec.type || null,
        fecha_fin:        p.fecha_fin,
      });

      if (!log.alertas.some(a => a.key === key)) {
        log.alertas.push({
          id: generateId('alert'),
          key,
          id_alerta: ID_VENCIMIENTO,
          alerta,
          date_time_hour: new Date().toISOString(),
          estado: 'detectado',
          meta: { id_plantilla: p.id_plantilla, id_seccion: sec.id, tipo_seccion: sec.type, fecha_fin: p.fecha_fin },
        });
        logChanged = true;
      }
    }
  }

  if (logChanged) guardarLog(log);
  return vencidos;
}

// POST /api/alertas/check — la API PRES consulta si hay módulos/plantillas vencidos
exports.check = (_req, res) => {
  const vencidos = detectarVencimientos();
  res.json({ ok: true, total: vencidos.length, vencidos });
};
