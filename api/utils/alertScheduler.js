const fs = require('fs');
const path = require('path');
const {
  dispararAlerta,
  leerConfig,
  leerLog,
  CATALOGO_ALERTAS,
} = require('../controllers/alertasController');

const PLT_FILE = path.join(__dirname, '..', 'data', 'plantillas.json');

const ID_VENCIMIENTO = 1;

function leerPlantillas() {
  if (!fs.existsSync(PLT_FILE)) return { plantillas: [] };
  try { return JSON.parse(fs.readFileSync(PLT_FILE, 'utf-8')); }
  catch { return { plantillas: [] }; }
}

function estaVencida(p) {
  return p.activa && p.fecha_fin && Date.now() > new Date(p.fecha_fin).getTime();
}

// La key incluye fecha_fin: al renovar/extender, la fecha cambia y por lo tanto
// se habilita una nueva alerta en el próximo vencimiento (sin spamear el actual).
function buildKey(plantilla, seccion) {
  return `venc|${plantilla.id_plantilla}|${seccion.id}|${plantilla.fecha_fin}`;
}

function yaAlertada(log, key, tieneUrl) {
  const previas = log.alertas.filter(a => a.key === key);
  if (!previas.length) return false;
  if (tieneUrl && previas.every(a => a.estado === 'sin_url')) return false;
  return true;
}

async function chequearVencimientos() {
  const { plantillas } = leerPlantillas();
  const tieneUrl = !!leerConfig().webhook_url;

  for (const p of plantillas) {
    if (!estaVencida(p)) continue;
    const seccionesAlerta = (p.secciones || []).filter(s => s.alerta === true);
    for (const sec of seccionesAlerta) {
      const key = buildKey(p, sec);
      if (yaAlertada(leerLog(), key, tieneUrl)) continue;
      const tipoLabel = sec.type || 'módulo';
      const texto = `${CATALOGO_ALERTAS[ID_VENCIMIENTO]}: módulo "${tipoLabel}" de la plantilla "${p.nombre}" (${p.tipo}) venció el ${p.fecha_fin}`;
      await dispararAlerta({
        id_alerta: ID_VENCIMIENTO,
        alerta: texto,
        key,
        meta: {
          id_plantilla: p.id_plantilla,
          id_seccion:   sec.id,
          tipo_seccion: sec.type,
          fecha_fin:    p.fecha_fin,
        },
      });
    }
  }
}

let _timer = null;
function iniciarSchedulerAlertas() {
  const cfg = leerConfig();
  if (cfg.habilitado === false) {
    console.log('[alertas] scheduler de vencimientos deshabilitado por config');
    return;
  }
  const intervalo = cfg.intervalo_check_ms || 60000;
  chequearVencimientos().catch(e => console.error('[alertas] error en chequeo:', e));
  _timer = setInterval(() => {
    chequearVencimientos().catch(e => console.error('[alertas] error en chequeo:', e));
  }, intervalo);
  //console.log(`[alertas] scheduler de vencimientos activo (cada ${intervalo}ms)`);
}

module.exports = { iniciarSchedulerAlertas, chequearVencimientos };
