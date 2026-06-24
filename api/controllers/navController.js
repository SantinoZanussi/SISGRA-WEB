const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NAV_FILE = path.join(DATA_DIR, 'navbar.json');
const PLT_FILE = path.join(DATA_DIR, 'plantillas.json');
const HTML_DIR = path.join(__dirname, '..', '..', 'html');

function readNav() {
  if (!fs.existsSync(NAV_FILE)) return { botones: [] };
  try { return JSON.parse(fs.readFileSync(NAV_FILE, 'utf-8')); } catch { return { botones: [] }; }
}
function saveNav(data) { fs.writeFileSync(NAV_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8'); }

function readPlantillas() {
  if (!fs.existsSync(PLT_FILE)) return { plantillas: [] };
  try { return JSON.parse(fs.readFileSync(PLT_FILE, 'utf-8')); } catch { return { plantillas: [] }; }
}
function savePlantillas(data) { fs.writeFileSync(PLT_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8'); }

const nextMenuId = botones => (botones.length ? Math.max(...botones.map(b => Number(b.id_menu) || 0)) : 0) + 1;

// Plantilla vinculada a un id_menu (vía plantilla.id_menu[]).
function plantillaDeMenu(id_menu, plantillas) {
  return plantillas.find(p => (p.id_menu || []).includes(id_menu)) || null;
}
const esCustom = p => !!p && /^btn-/.test(p.tipo || '');

// el menú es un árbol: cada ítem tiene padre (id_menu de otro; 0 = nivel principal)
// un ítem con hijos se muestra como desplegable; cualquiera puede ser padre

// título del padre de un botón, o null si cuelga de la raíz

function padreTituloDe(boton, botones) {
  if (!boton.padre) return null;
  const p = botones.find(b => b.id_menu === boton.padre);
  return p ? p.titulo : null;
}

// Valida un valor de `padre` para un ítem: debe ser 0, o el id de otro ítem que
// no sea él mismo ni un descendiente suyo (evita ciclos). Devuelve el id
// normalizado o null si es inválido.
function validarPadre(botones, padre, idPropio) {
  const id = Number(padre) || 0;
  if (id === 0) return 0;
  if (id === idPropio) return null;
  if (!botones.some(b => b.id_menu === id)) return null;
  // Subir por la cadena de padres desde el candidato: si aparece idPropio, hay ciclo.
  let cur = id;
  const visitados = new Set();
  while (cur && !visitados.has(cur)) {
    visitados.add(cur);
    if (cur === idPropio) return null;
    cur = botones.find(b => b.id_menu === cur)?.padre || 0;
  }
  return id;
}

// Orden único: el `orden` de los ítems es único y contiguo (1..N). Al fijar un
// ítem en una posición se "inserta y corre" el resto (no se intercambia) y luego
// se reindexa todo a 1..N. Llamado sin (idMover, destino) solo normaliza.
function reordenarBotones(botones, idMover, destino) {
  const ordenados = botones.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
  if (idMover != null && destino != null) {
    const i = ordenados.findIndex(b => b.id_menu === idMover);
    if (i !== -1) {
      const [item] = ordenados.splice(i, 1);
      const pos = Math.min(Math.max(Number(destino) || 1, 1), ordenados.length + 1) - 1;
      ordenados.splice(pos, 0, item);
    }
  }
  ordenados.forEach((b, idx) => { b.orden = idx + 1; });
}

// al borrar un ítem que apunta a una página personalizada (btn-*) se borra
// también su shell físico html/<tipo>/index.html
function borrarShellCustom(tipo) {
  const dir = path.join(HTML_DIR, tipo);
  try { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); }
  catch (e) { console.warn('[navController] No se pudo borrar el shell custom:', e.message); }
}

// GET /api/nav/botones
// Devuelve todos los ítems con datos derivados para el panel: título del padre,
// si tiene hijos (desplegable) y la plantilla vinculada (si la hay).
exports.listarBotones = (_req, res) => {
  const { botones } = readNav();
  const { plantillas } = readPlantillas();
  const out = botones.map(b => {
    const p = plantillaDeMenu(b.id_menu, plantillas);
    return {
      ...b,
      padreTitulo: padreTituloDe(b, botones),
      tieneHijos:  botones.some(x => (x.padre || 0) === b.id_menu),
      esCustom:    esCustom(p),
      plantilla:   p ? { id: p.id_plantilla, nombre: p.nombre, tipo: p.tipo } : null,
    };
  });
  res.json({ botones: out });
};

// POST /api/nav/botones  [auth]
// Body: { titulo, padre?, orden?, activo? }. Crea SOLO el ítem de menú: ya no se
// genera una plantilla/página automáticamente (la página se vincula aparte desde
// el panel de Plantillas). El ítem nace sin href.
exports.crearBoton = (req, res) => {
  const { titulo, padre, orden, activo } = req.body || {};
  if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'El campo "titulo" es obligatorio' });

  const data = readNav();
  const padreId = validarPadre(data.botones, padre, -1);
  if (padreId === null) return res.status(400).json({ error: 'El "padre" indicado no existe' });

  const id_menu = nextMenuId(data.botones);
  const nuevo = {
    id_menu,
    titulo: titulo.trim(),
    padre:  padreId,
    menu:   'CE',
    href:   null,                      // sin página: ya no se auto-genera una plantilla
    orden:  data.botones.length + 1,   // por defecto al final; reordenarBotones lo normaliza
    activo: activo !== undefined ? activo : true,
  };
  data.botones.push(nuevo);
  // Si pidieron una posición puntual, insertar y correr; si no, queda al final.
  reordenarBotones(data.botones, id_menu, orden != null ? Number(orden) : null);
  saveNav(data);

  res.status(201).json({ ok: true, boton: { ...nuevo, padreTitulo: padreTituloDe(nuevo, data.botones) } });
};

// PATCH /api/nav/botones/:id   [auth]   (:id = id_menu)
// Body: { titulo?, padre?, orden?, activo? }
exports.actualizarBoton = (req, res) => {
  const id = Number(req.params.id);
  const data = readNav();
  const b = data.botones.find(x => x.id_menu === id);
  if (!b) return res.status(404).json({ error: 'Ítem no encontrado' });

  ['titulo', 'activo'].forEach(f => {
    if (req.body[f] !== undefined) b[f] = req.body[f];
  });

  if (req.body.padre !== undefined) {
    const padreId = validarPadre(data.botones, req.body.padre, id);
    if (padreId === null) return res.status(400).json({ error: 'Padre inválido: no existe o crea un ciclo' });
    b.padre = padreId;
  }

  // El orden es único: fijar la posición "inserta y corre" y reindexa 1..N.
  if (req.body.orden !== undefined) {
    reordenarBotones(data.botones, id, Number(req.body.orden));
  }

  saveNav(data);
  res.json({ ok: true, boton: { ...b, padreTitulo: padreTituloDe(b, data.botones) } });
};

// DELETE /api/nav/botones/:id   [auth]   (:id = id_menu)
// Si el ítem apunta a una página personalizada (btn-*), borra también la
// plantilla y su HTML. Si es una página del sistema, solo desvincula el id_menu.
exports.eliminarBoton = (req, res) => {
  const id = Number(req.params.id);
  const data = readNav();
  const boton = data.botones.find(x => x.id_menu === id);
  if (!boton) return res.status(404).json({ error: 'Ítem no encontrado' });

  const pltData = readPlantillas();
  const p = plantillaDeMenu(id, pltData.plantillas);
  let plantillaEliminada = null;

  if (esCustom(p)) {
    plantillaEliminada = p.nombre;
    pltData.plantillas = pltData.plantillas.filter(x => x.id_plantilla !== p.id_plantilla);
    savePlantillas(pltData);
    borrarShellCustom(p.tipo);
  } else if (p) {
    // Página del sistema: desvincular el id_menu, conservar la plantilla.
    p.id_menu = (p.id_menu || []).filter(m => m !== id);
    savePlantillas(pltData);
  }

  data.botones = data.botones.filter(x => x.id_menu !== id);
  // Subir los hijos del ítem borrado al nivel principal (no perderlos).
  data.botones.forEach(x => { if ((x.padre || 0) === id) x.padre = 0; });
  // Mantener el orden único y contiguo tras quitar el ítem.
  reordenarBotones(data.botones, null, null);
  saveNav(data);

  res.json({ ok: true, plantillaEliminada });
};

// POST /api/nav/page   — compat: datos de la página de un ítem (por id_menu)
exports.getPage = (req, res) => {
  const { id_menu } = req.body || {};
  if (id_menu === undefined) return res.status(400).json({ error: 'Se requiere id_menu' });
  const { botones } = readNav();
  const boton = botones.find(b => b.id_menu === Number(id_menu));
  if (!boton) return res.status(404).json({ error: 'Ítem no encontrado' });
  const { plantillas } = readPlantillas();
  const plantilla = plantillaDeMenu(boton.id_menu, plantillas);
  res.json({ id_menu: boton.id_menu, titulo: boton.titulo, href: boton.href, plantilla });
};

// POST /api/nav/sync  — obsoleto en v2 (el nav se resuelve desde navbar.json en runtime)
exports.syncPlantillas = (_req, res) =>
  res.json({ ok: true, message: 'Sync obsoleto en v2: el nav se resuelve desde navbar.json en tiempo de render.' });
