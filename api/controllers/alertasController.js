const fs = require('fs');
const path = require('path');
const { generateId } = require('../utils/id');

const DATA_DIR    = path.join(__dirname, '..', 'data');
const LOG_FILE    = path.join(DATA_DIR, 'alertas_log.json');
const PLT_FILE    = path.join(DATA_DIR, 'plantillas.json');
const MOD_FILE    = path.join(DATA_DIR, 'modulos.json');

const ID_VENCIMIENTO = 1;
const CATALOGO_ALERTAS = {
  1: 'Vencimiento de módulo',
};

function leerLog() {
  if (!fs.existsSync(LOG_FILE)) return { alertas: [] };
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8')); }
  catch { return { alertas: [] }; }
}

function guardarLog(data) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /api/alertas/catalogo  publico, tipos de alerta disponibles
exports.catalogo = (_req, res) => res.json({ catalogo: CATALOGO_ALERTAS });

// GET /api/alertas/log  [auth]  historial de vencimientos detectados
exports.listarLog = (_req, res) => res.json(leerLog());

function leerPlantillas() {
  if (!fs.existsSync(PLT_FILE)) return { plantillas: [] };
  try { return JSON.parse(fs.readFileSync(PLT_FILE, 'utf-8')); }
  catch { return { plantillas: [] }; }
}

function leerModulos() {
  if (!fs.existsSync(MOD_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(MOD_FILE, 'utf-8')).modulos || []; }
  catch { return []; }
}

function estaVencida(p) {
  return p.activa && p.fecha_fin && Date.now() > new Date(p.fecha_fin).getTime();
}

function detectarVencimientos() {
  const { plantillas } = leerPlantillas();
  const byId = new Map(leerModulos().map(m => [m.id_modulo, m]));
  const log = leerLog();
  const vencidos = [];
  let logChanged = false;

  for (const p of plantillas) {
    if (!estaVencida(p)) continue;
    const mods = (p.id_modulos || []).map(id => byId.get(id)).filter(Boolean);
    for (const m of mods.filter(mod => mod.alerta === true)) {
      const key = `venc|${p.id_plantilla}|${m.id_modulo}|${p.fecha_fin}`;
      const alerta = `${CATALOGO_ALERTAS[ID_VENCIMIENTO]}: módulo "${m.nombre || m.tipo}" de la plantilla "${p.nombre}" (${p.tipo}) venció el ${p.fecha_fin}`;
      // respuesta acotada a lo que consume la API PRES
      vencidos.push({
        id_plantilla:     p.id_plantilla,
        nombre_plantilla: p.nombre,
        fecha_fin:        p.fecha_fin,
        alerta,
      });

      if (!log.alertas.some(a => a.key === key)) {
        log.alertas.push({
          id: generateId('alert'),
          key,
          id_alerta: ID_VENCIMIENTO,
          alerta,
          date_time_hour: new Date().toISOString(),
          estado: 'detectado',
          meta: { id_plantilla: p.id_plantilla, id_modulo: m.id_modulo, tipo_modulo: m.tipo, fecha_fin: p.fecha_fin },
        });
        logChanged = true;
      }
    }
  }

  if (logChanged) guardarLog(log);
  return vencidos;
}

// POST /api/alertas/check  la API PRES consulta si hay vencimientos
exports.check = (_req, res) => {
  const vencidos = detectarVencimientos();
  res.json({ ok: true, total: vencidos.length, vencidos });
};
