import { state, setCurrentPanel, currentPanel } from './store.js';
import { apiGet } from './api.js';
import { showNotif, openModal, closeModal } from './ui.js';
import { populatePanel, populateBlog } from './populate.js';
import { saveCurrentPanel } from './save.js';
import { doLogin, doLogout } from './auth.js';
import { saveCliente, editCliente, deleteCliente, nuevoCliente } from './clientes.js';
import { saveBlog, editPost, deletePost, nuevoBlog } from './blog.js';

// ─── Exponer funciones que se llaman desde innerHTML (onclick=) ───────────────
window.__admin = { editCliente, deleteCliente, editPost, deletePost };

// ─── Nombres de paneles ────────────────────────────────────────────────────────
const PANEL_NAMES = {
  dashboard:    'Dashboard',
  home:         'Inicio — Hero',
  nosotros:     'Nosotros',
  clientes:     'Clientes / Logos',
  blog:         'Blog / Noticias',
  'p-cableado':   'Cableado Estructurado',
  'p-fibra':      'Fibra Óptica',
  'p-seguridad':  'Seguridad Electrónica',
  'p-soporte':    'Soporte IT',
  'p-desarrollo': 'Desarrollo de Software',
  contacto:     'Datos de Contacto',
  seo:          'SEO & Meta',
};

// ─── Navegación ───────────────────────────────────────────────────────────────
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));

  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');

  // Marcar sidebar activo: busca el elemento con data-panel
  const sideEl = document.querySelector(`.sidebar-item[data-panel="${id}"]`);
  if (sideEl) sideEl.classList.add('active');

  document.getElementById('topbar-title').textContent = PANEL_NAMES[id] || id;
  setCurrentPanel(id);
  populatePanel(id);
}

// ─── Inicialización ──────────────────────────────────────────────────────────
export async function initApp() {
  setApiStatus('loading');
  document.getElementById('dash-date').textContent =
    new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  try {
    await loadAllData();
    setApiStatus('connected');
    renderDashboard();
  } catch (e) {
    setApiStatus('error');
    showNotif('No se pudo conectar con la API', 'error');
    console.error(e);
  }
}

async function loadAllData() {
  const files = ['hero','nosotros','clientes','blog','contacto','seo','paginas'];
  const results = await Promise.all(
    files.map(f =>
      apiGet(`/data/${f}`)
        .then(d => [f, d])
        .catch(() => [f, null])
    )
  );
  results.forEach(([f, d]) => { if (d) state[f] = d; });
}

function setApiStatus(status) {
  const dot   = document.getElementById('api-dot');
  const text  = document.getElementById('api-indicator-text');
  const label = document.getElementById('api-status-label');
  if (status === 'connected') {
    dot.className = 'api-dot connected';
    text.textContent  = 'API conectada';
    label.textContent = 'admin@sisgra.com.ar';
  } else if (status === 'error') {
    dot.className = 'api-dot';
    dot.style.background = '#ef4444';
    text.textContent  = 'API sin conexión';
    label.textContent = 'Error de conexión';
  } else {
    dot.className = 'api-dot';
    text.textContent = 'Conectando...';
  }
}

function renderDashboard() {
  const posts       = state.blog?.posts || [];
  const borradores  = posts.filter(p => p.estado === 'borrador').length;
  const countEl     = document.getElementById('dash-blog-count');
  const subEl       = document.getElementById('dash-blog-sub');
  const clientesEl  = document.getElementById('dash-clientes-count');

  if (countEl)    countEl.textContent = posts.length;
  if (subEl)      subEl.innerHTML = `<span class="stat-card-indicator ind-amber"></span>${borradores} en borrador`;
  if (clientesEl) clientesEl.textContent = state.clientes?.clientes?.length || 0;
}

// ─── Registrar eventos ────────────────────────────────────────────────────────
function bindEvents() {
  // ── Auth ──
  document.getElementById('login-btn').addEventListener('click', doLogin);
  document.getElementById('l-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('logout-btn').addEventListener('click', doLogout);

  // ── Guardar ──
  document.getElementById('btn-guardar').addEventListener('click', saveCurrentPanel);

  // ── Sidebar: todos los .sidebar-item ──
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => showPanel(item.dataset.panel));
  });

  // ── Clientes ──
  document.getElementById('abrir-modal-cliente').addEventListener('click', nuevoCliente);
  document.getElementById('guardar-cliente-btn').addEventListener('click', saveCliente);

  // Cerrar modal clientes (hay 2 botones con mismo id → usamos querySelectorAll)
  document.querySelectorAll('#cerrar-modal-cliente').forEach(b =>
    b.addEventListener('click', () => closeModal('modal-cliente'))
  );

  // ── Blog ──
  document.getElementById('abrir-modal-blog').addEventListener('click', nuevoBlog);
  document.getElementById('guardar-blog').addEventListener('click', saveBlog);
  document.querySelectorAll('#cerrar-modal-blog').forEach(b =>
    b.addEventListener('click', () => closeModal('modal-blog'))
  );

  // ── Accesos rápidos del dashboard ──
  document.getElementById('nuevo-post').addEventListener('click',    () => { showPanel('blog');     nuevoBlog(); });
  document.getElementById('nuevo-cliente').addEventListener('click', () => { showPanel('clientes'); nuevoCliente(); });
  document.getElementById('editar-hero').addEventListener('click',   () => showPanel('home'));

  // ── Rich editor ──
  const richCommands = ['bold','italic','underline','insertUnorderedList'];
  richCommands.forEach(cmd => {
    const btn = document.getElementById(cmd);
    if (btn) btn.addEventListener('click', () => {
      document.execCommand(cmd, false, null);
      document.getElementById('b-content').focus();
    });
  });
  const fmtH2 = document.getElementById('formatBlockh2');
  const fmtP  = document.getElementById('formatBlockp');
  if (fmtH2) fmtH2.addEventListener('click', () => document.execCommand('formatBlock', false, 'h2'));
  if (fmtP)  fmtP.addEventListener('click',  () => document.execCommand('formatBlock', false, 'p'));

  // ── SEO tabs ──
  const seoPages = ['home','cableado','fibra','seguridad','soporte','desarrollo'];
  seoPages.forEach(p => {
    const btn = document.getElementById(`boton-seo-${p}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('#seo-tabs .tab-item').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      seoPages.forEach(pp => {
        const el = document.getElementById(`seo-tab-${pp}`);
        if (el) el.style.display = `seo-tab-${pp}` === `seo-tab-${p}` ? 'block' : 'none';
      });
    });
  });

  // ── Panel hero: preview de plantilla ──
  document.addEventListener('change', e => {
    if (e.target.id === 'hero-plantilla') updateHeroPreviewHint(e.target.value);
  });

  // ── Click fuera de modal cierra ──
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });
}

// ─── Preview hint de plantilla hero ──────────────────────────────────────────
function updateHeroPreviewHint(val) {
  const p1 = document.getElementById('hero-plantilla-1-fields');
  const p2 = document.getElementById('hero-plantilla-2-fields');
  if (p1) p1.style.display = val === '2' ? 'none' : 'block';
  if (p2) p2.style.display = val === '2' ? 'block' : 'none';
}

// ─── Arranque ─────────────────────────────────────────────────────────────────
bindEvents();

// Auto-login si hay token guardado en sessionStorage
import { authToken } from './store.js';
if (authToken) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  initApp();
}