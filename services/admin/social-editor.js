// Editor propio de los módulos tipo "social-post": diseña la portada de IG/FB en un
// canvas 1080×1350 (estructura fija) y al guardar la rasteriza a JPEG, la sube como
// asset y persiste el módulo. Se abre desde editor.js (openModEditor) para este tipo.
import { apiGet, apiPut } from '../api.js';
import { authToken, API_BASE } from '../store.js';
import { escAttr } from './asset-shared.js';

const W = 1080, H = 1350;
const LOGO_SRC = '/img/sisgra_blanco.png';
const CATS_FALLBACK = ['Infraestructura', 'Fibra Óptica', 'Seguridad', 'Soporte IT'];

const S = {
  mod: null,          // módulo en edición
  social: null,       // config de redes (hashtags por grupo)
  imgCache: {},       // url -> Image (o null si falló)
  ctx: null,
};

// categorías reales del select de blog, para alinear con los grupos de hashtags
function categorias() {
  const sel = document.getElementById('b-categoria');
  const opts = sel ? [...sel.options].map(o => (o.value || o.textContent).trim()).filter(Boolean) : [];
  return opts.length ? opts : CATS_FALLBACK;
}

function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (url in S.imgCache) return Promise.resolve(S.imgCache[url]);
  return new Promise(resolve => {
    const img = new Image();
    // solo pedir CORS a orígenes externos; las de /img son del mismo dominio
    if (/^https?:\/\//i.test(url) && !url.startsWith(location.origin)) img.crossOrigin = 'anonymous';
    img.onload  = () => { S.imgCache[url] = img; resolve(img); };
    img.onerror = () => { S.imgCache[url] = null; resolve(null); };
    img.src = url;
  });
}

// dibuja una imagen en modo 'cover' dentro de W×H
function drawCover(ctx, img) {
  const r = Math.max(W / img.width, H / img.height);
  const w = img.width * r, h = img.height * r;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function wrapLines(ctx, text, maxW) {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let ln = '';
  for (const w of words) {
    const test = ln ? ln + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && ln) { lines.push(ln); ln = w; }
    else ln = test;
  }
  if (ln) lines.push(ln);
  return lines;
}

// dibuja la portada con los valores actuales del formulario (usa imágenes ya cacheadas)
function draw() {
  const ctx = S.ctx;

  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, W, H);

  const titulo    = val('se-titulo');
  const categoria = val('se-categoria');
  const colorTit  = val('se-color-titulo') || '#ffffff';
  const colorAc   = val('se-color-acento') || '#38bdf8';
  const conLogo   = document.getElementById('se-logo')?.checked;
  const bg = S.imgCache[val('se-bg')] || null;

  // fondo
  if (bg) { drawCover(ctx, bg); }
  else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0b3a66'); g.addColorStop(1, '#0a7086');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.font = '700 40px Inter, system-ui';
    ctx.fillText('elegí una imagen de fondo', W / 2, H / 2); ctx.textAlign = 'left';
  }

  // degradados para legibilidad (arriba suave, abajo fuerte)
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.28);
  top.addColorStop(0, 'rgba(8,13,24,.55)'); top.addColorStop(1, 'rgba(8,13,24,0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, H * 0.28);
  const bot = ctx.createLinearGradient(0, H * 0.32, 0, H);
  bot.addColorStop(0, 'rgba(8,13,24,0)'); bot.addColorStop(1, 'rgba(8,13,24,.94)');
  ctx.fillStyle = bot; ctx.fillRect(0, 0, W, H);

  // eyebrow (categoría) arriba-izquierda
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colorAc; ctx.fillRect(84, 120, 58, 7);
  ctx.font = '700 34px Inter, system-ui';
  ctx.fillText((categoria || '').toUpperCase(), 162, 127);

  // logo arriba-derecha (imagen real; mismo dominio, no contamina el canvas)
  const logo = conLogo ? S.imgCache[LOGO_SRC] : null;
  if (logo) {
    const h = 62, w = logo.width * (h / logo.height);
    ctx.drawImage(logo, W - 84 - w, 92, w, h);
  }
  ctx.textBaseline = 'alphabetic';

  // título abajo, en Inter italic
  const font = 'italic 900 82px Inter, system-ui';
  ctx.font = font;
  const lines = wrapLines(ctx, titulo, W - 168);
  const lh = 94, footerY = H - 92;
  let y = footerY - 46 - (lines.length - 1) * lh;
  ctx.fillStyle = colorTit;
  for (const l of lines) { ctx.fillText(l, 84, y); y += lh; }

  // footer
  ctx.font = '500 30px Inter, system-ui';
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.fillText('sisgra.com', 84, footerY + 6);
}

// carga fondo+logo y redibuja (para el preview en vivo)
async function refreshPreview() {
  await Promise.all([loadImage(val('se-bg')), loadImage(LOGO_SRC)]);
  draw();
}

// ---- hashtags: grupos (base + por categoría) + propios ----

function hashtagGrupos() {
  const cfg = S.social || {};
  const grupos = [{ key: 'base', label: 'Base', tags: cfg.hashtags_base || [] }];
  const porCat = cfg.hashtags_por_categoria || {};
  categorias().forEach(cat => grupos.push({ key: cat, label: cat, tags: porCat[cat] || [] }));
  return grupos.filter(g => g.tags.length);
}

function computeHashtags() {
  const seleccionados = [...document.querySelectorAll('.se-htag:checked')].map(c => c.dataset.key);
  const grupos = hashtagGrupos();
  const out = [];
  const push = t => { t = t.trim().replace(/^#+/, ''); if (t && !out.includes('#' + t)) out.push('#' + t); };
  grupos.forEach(g => { if (seleccionados.includes(g.key)) g.tags.forEach(push); });
  (val('se-htag-propios') || '').split(/[\s,]+/).forEach(push);
  return out;
}

function refreshHashtagsPreview() {
  const box = document.getElementById('se-htag-preview');
  if (box) box.textContent = computeHashtags().join(' ') || '—';
}

function renderHashtagGrupos(selectedKeys) {
  const cont = document.getElementById('se-htag-grupos');
  if (!cont) return;
  const grupos = hashtagGrupos();
  if (!grupos.length) { cont.innerHTML = '<span class="se-hint">No hay grupos definidos en Redes Sociales.</span>'; return; }
  cont.innerHTML = grupos.map(g => `
    <label class="se-chk">
      <input type="checkbox" class="se-htag" data-key="${escAttr(g.key)}" ${selectedKeys.includes(g.key) ? 'checked' : ''}/>
      <b>${escAttr(g.label)}</b> <span class="se-hint">${escAttr(g.tags.join(' '))}</span>
    </label>`).join('');
  cont.querySelectorAll('.se-htag').forEach(c => c.addEventListener('change', refreshHashtagsPreview));
}

// ---- helpers de formulario ----
const val = id => (document.getElementById(id)?.value || '');

// ---- modal ----

function ensureModal() {
  if (document.getElementById('se-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'se-overlay';
  ov.innerHTML = `
    <div class="se-panel">
      <div class="se-head">
        <span class="se-title"><i class="fa-solid fa-share-nodes"></i> Portada de redes sociales</span>
        <button type="button" class="se-x" id="se-cancel"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="se-body">
        <div class="se-stage">
          <canvas id="se-canvas" width="${W}" height="${H}"></canvas>
          <p class="se-hint" style="text-align:center;padding-top:20px;">Vista previa · <b>1080×1350</b>. Se exporta a JPEG al guardar.</p>
        </div>
        <div class="se-fields">
          <label class="se-lbl">Nombre del post<input class="se-in" id="se-nombre" placeholder="Ej: Nueva red de fibra"/></label>
          <label class="se-lbl">Título (va en la imagen)<textarea class="se-in" id="se-titulo" rows="2"></textarea></label>
          <label class="se-lbl">Categoría<select class="se-in" id="se-categoria"></select></label>
          <div class="se-lbl">Imagen de fondo
            <div class="se-bgrow">
              <input class="se-in" id="se-bg" placeholder="/img/..." style="flex:1;"/>
              <button type="button" class="se-btn2" id="se-bg-pick"><i class="fa-solid fa-image"></i> Elegir</button>
            </div>
            <span class="se-hint">Se recorta a 4:5 (vertical). Elegí desde el gestor de imágenes.</span>
          </div>
          <label class="se-lbl">Descripción (texto de la publicación)<textarea class="se-in" id="se-descripcion" rows="4" placeholder="Lo que va como caption en IG y Facebook…"></textarea></label>
          <div class="se-lbl">Hashtags
            <div id="se-htag-grupos" class="se-htag-grupos"></div>
            <input class="se-in" id="se-htag-propios" placeholder="Propios: #obra #industria"/>
            <div class="se-htag-out"><span class="se-hint">En la publicación:</span> <span id="se-htag-preview"></span></div>
          </div>
          <div class="se-row">
            <label class="se-lbl se-col">Color título<input type="color" class="se-color" id="se-color-titulo"/></label>
            <label class="se-lbl se-col">Color acento<input type="color" class="se-color" id="se-color-acento"/></label>
            <label class="se-chk se-col"><input type="checkbox" id="se-logo"/> Logo SISGRA</label>
          </div>
        </div>
      </div>
      <div class="se-foot">
        <button type="button" class="se-btn2" id="se-cancel2">Cancelar</button>
        <button type="button" class="se-btn" id="se-save">Guardar portada</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  injectStyles();

  S.ctx = document.getElementById('se-canvas').getContext('2d');

  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.getElementById('se-cancel').addEventListener('click', close);
  document.getElementById('se-cancel2').addEventListener('click', close);
  document.getElementById('se-save').addEventListener('click', save);
  document.getElementById('se-bg-pick').addEventListener('click', pickBg);

  // redibujar en vivo al cambiar campos que afectan la imagen
  ['se-titulo', 'se-categoria', 'se-bg', 'se-color-titulo', 'se-color-acento'].forEach(id =>
    document.getElementById(id).addEventListener('input', refreshPreview));
  document.getElementById('se-logo').addEventListener('change', refreshPreview);
  document.getElementById('se-htag-propios').addEventListener('input', refreshHashtagsPreview);
}

async function pickBg() {
  const path = await window.__imgPicker?.open({ current: val('se-bg') || '' });
  if (path) { document.getElementById('se-bg').value = path; refreshPreview(); }
}

async function open(mod) {
  ensureModal();
  S.mod = mod;
  S.imgCache = {};
  const d = mod.data || {};
  const des = mod.design || {};

  // categorías en el select
  const catSel = document.getElementById('se-categoria');
  catSel.innerHTML = categorias().map(c => `<option value="${escAttr(c)}">${escAttr(c)}</option>`).join('');

  document.getElementById('se-nombre').value      = mod.nombre || '';
  document.getElementById('se-titulo').value      = d.titulo || '';
  catSel.value                                    = d.categoria || categorias()[0] || '';
  document.getElementById('se-bg').value          = d.imagen_fondo || '';
  document.getElementById('se-descripcion').value = d.descripcion || '';
  document.getElementById('se-htag-propios').value= d.hashtags_propios || '';
  document.getElementById('se-color-titulo').value= des.colorTitulo || '#ffffff';
  document.getElementById('se-color-acento').value= des.colorAcento || '#38bdf8';
  document.getElementById('se-logo').checked      = des.mostrarLogo !== false;

  document.getElementById('se-overlay').style.display = 'flex';

  // config de hashtags (grupos)
  try { S.social = await apiGet('/data/social') || {}; } catch (_) { S.social = {}; }
  // por defecto: grupo base + el de la categoría del post
  const selKeys = Array.isArray(d.hashtags_grupos) && d.hashtags_grupos.length
    ? d.hashtags_grupos
    : ['base', d.categoria || catSel.value].filter(Boolean);
  renderHashtagGrupos(selKeys);
  refreshHashtagsPreview();

  refreshPreview();
}

function close() {
  const ov = document.getElementById('se-overlay');
  if (ov) ov.style.display = 'none';
  S.mod = null;
}

function canvasBlob() {
  return new Promise((resolve, reject) => {
    document.getElementById('se-canvas').toBlob(
      b => b ? resolve(b) : reject(new Error('No se pudo generar la imagen')),
      'image/jpeg', 0.9);
  });
}

async function uploadBlob(blob, nombre) {
  const fd = new FormData();
  fd.append('file', blob, (nombre || 'portada') + '.jpg');
  fd.append('nombre', (nombre || 'portada') + ' redes');
  const r = await fetch(`${API_BASE}/assets`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` }, body: fd,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Error ${r.status} al subir la imagen`);
  return data.asset.path;
}

async function save() {
  const btn = document.getElementById('se-save');
  const nombre = val('se-nombre').trim() || val('se-titulo').trim() || 'Post';
  if (!val('se-bg')) { window.__svc?.showNotif('Elegí una imagen de fondo', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Generando…';
  try {
    // asegurar fuente Inter + imágenes antes de rasterizar
    try { await document.fonts.load('italic 900 82px Inter'); await document.fonts.load('700 34px Inter'); await document.fonts.ready; } catch (_) {}
    await Promise.all([loadImage(val('se-bg')), loadImage(LOGO_SRC)]);
    draw();

    const blob = await canvasBlob();
    const path = await uploadBlob(blob, nombre);

    const data = {
      titulo: val('se-titulo').trim(),
      categoria: val('se-categoria'),
      imagen_fondo: val('se-bg').trim(),
      descripcion: val('se-descripcion').trim(),
      hashtags: computeHashtags(),
      hashtags_grupos: [...document.querySelectorAll('.se-htag:checked')].map(c => c.dataset.key),
      hashtags_propios: val('se-htag-propios').trim(),
      imagen_generada: path,
    };
    const design = {
      colorTitulo: val('se-color-titulo'),
      colorAcento: val('se-color-acento'),
      mostrarLogo: document.getElementById('se-logo').checked,
    };

    await apiPut(`/modulos/${S.mod.id_modulo}`, { nombre, data, design });
    window.__svc?.showNotif('✓ Portada guardada', 'success');
    close();
    if (typeof window.loadModulos === 'function') window.loadModulos();
  } catch (e) {
    window.__svc?.showNotif('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar portada';
  }
}

function injectStyles() {
  if (document.getElementById('se-styles')) return;
  const st = document.createElement('style');
  st.id = 'se-styles';
  st.textContent = `
  #se-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:1.5rem;background:rgba(15,23,42,.6);backdrop-filter:blur(6px);font-family:Inter,system-ui,sans-serif;}
  .se-panel{background:#fff;border-radius:.75rem;width:min(940px,96vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 70px rgba(0,0,0,.4);}
  .se-head{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid #e2e8f0;}
  .se-title{font-weight:800;color:#1e293b;}.se-title i{color:#2563eb;margin-right:.4rem;}
  .se-x{background:none;border:none;font-size:1.1rem;color:#64748b;cursor:pointer;}
  .se-body{display:flex;gap:1.25rem;padding:1.25rem;overflow:auto;}
  .se-stage{flex:0 0 auto;}
  #se-canvas{width:min(300px,42vw);height:auto;border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.25);display:block;}
  .se-fields{flex:1 1 320px;min-width:280px;display:flex;flex-direction:column;gap:.8rem;}
  .se-lbl{display:flex;flex-direction:column;gap:.3rem;font-size:.68rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#475569;}
  .se-in{font:inherit;font-size:.88rem;font-weight:400;text-transform:none;letter-spacing:0;padding:.5rem .6rem;border:1px solid #cbd5e1;border-radius:8px;color:#0f172a;background:#fff;resize:vertical;width:100%;box-sizing:border-box;}
  .se-bgrow{display:flex;gap:.5rem;}
  .se-hint{font-size:.72rem;font-weight:400;text-transform:none;letter-spacing:0;color:#94a3b8;}
  .se-htag-grupos{display:flex;flex-direction:column;gap:.35rem;margin:.2rem 0;}
  .se-chk{display:flex;align-items:center;gap:.45rem;font-size:.8rem;font-weight:600;text-transform:none;letter-spacing:0;color:#334155;}
  .se-chk b{font-weight:700;}
  .se-htag-out{margin-top:.4rem;font-size:.8rem;color:#2563eb;word-break:break-word;}
  .se-row{display:flex;gap:.75rem;align-items:center;}
  .se-col{flex:1;}
  .se-color{width:100%;height:38px;padding:2px;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;background:#fff;}
  .se-foot{display:flex;justify-content:flex-end;gap:.6rem;padding:.9rem 1.25rem;border-top:1px solid #e2e8f0;background:#f8fafc;}
  .se-btn{background:#2563eb;color:#fff;border:none;padding:.6rem 1.4rem;border-radius:8px;font-weight:700;cursor:pointer;}
  .se-btn2{background:#fff;color:#334155;border:1px solid #cbd5e1;padding:.6rem 1rem;border-radius:8px;font-weight:600;cursor:pointer;}
  @media(max-width:640px){.se-body{flex-direction:column;}#se-canvas{width:min(260px,70vw);margin:0 auto;}}
  `;
  document.head.appendChild(st);
}

window.__socialEditor = { open };
