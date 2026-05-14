import { apiPut, apiGet, apiPost, apiPatch, apiDelete } from './api_helpers.js';
import { doLogin, doLogout } from './api_functions.js';
import { populateBlog, populateClientes, populatePanel, getVal, setVal } from './api_populates.js';
import { saveCurrentPanel } from './api_panel.js';
import { saveCliente, editCliente, deleteCliente } from './api_clientes.js';
import { openModal, closeModal } from './api_modals.js';
import { saveBlog } from './api_blog.js';

const API_BASE = "http://192.168.1.61:3000/api";
let authToken = sessionStorage.getItem("sisgra_token") || null;
let currentPanel = "dashboard";
let editingPostId = null;
let editingClienteId = null;

// Estado en memoria de los JSONs cargados
export const state = {};

// ================================================
// EVENTOS DE LOS BOTONES
// ================================================

document.getElementById("login-btn").addEventListener("click", (e) => {
    doLogin();
});

document.getElementById("l-pass").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
});

document.getElementById("logout-btn").addEventListener("click", (e) => {
    doLogout();
});

document.getElementById("btn-guardar").addEventListener("click", (e) => {
    saveCurrentPanel();
});

document.getElementById("guardar-cliente-btn").addEventListener("click", (e) => {
    saveCliente();
});

document.getElementById("abrir-modal-cliente").addEventListener("click", (e) => {
    openModal('modal-cliente');
});

document.getElementById("abrir-modal-blog").addEventListener("click", (e) => {
    openModal('modal-blog');
    editingPostId = null;
});

document.getElementById("cerrar-modal-cliente").addEventListener("click", (e) => {
    closeModal('modal-cliente');
});

document.getElementById("cerrar-modal-blog").addEventListener("click", (e) => {
    closeModal('modal-blog');
});

document.getElementById("guardar-blog").addEventListener("click", (e) => {
    saveBlog();
});

document.getElementById("nuevo-post").addEventListener("click", (e) => {
    showPanel('blog',document.querySelector('[data-panel=blog]'))
});

document.getElementById("nuevo-cliente").addEventListener("click", (e) => {
    showPanel('clientes',document.querySelector('[data-panel=clientes]'))
});

document.getElementById("editar-hero").addEventListener("click", (e) => {
    showPanel('home',document.querySelector('[data-panel=home]'))
});

// ================================================
/* FORMATEO */
// ================================================

document.getElementById("bold").addEventListener("click", (e) => {
    formatDoc("bold");
});

document.getElementById("italic").addEventListener("click", (e) => {
    formatDoc("italic");
});

document.getElementById("underline").addEventListener("click", (e) => {
    formatDoc("underline");
});

document.getElementById("insertUnorderedList").addEventListener("click", (e) => {
    formatDoc("insertUnorderedList");
});

document.getElementById("formatBlockh2").addEventListener("click", (e) => {
    formatDoc("formatBlockh2");
});

document.getElementById("formatBlockp").addEventListener("click", (e) => {
    formatDoc("formatBlockp");
});

// ================================================
/* PANEL */
// ================================================

document.getElementById("panel-dashboard").addEventListener("click", (e) => {
    showPanel('dashboard',this);
});

document.getElementById("panel-home").addEventListener("click", (e) => {
    showPanel('home',this);
});

document.getElementById("panel-nosotros").addEventListener("click", (e) => {
    showPanel('nosotros',this);
});

document.getElementById("panel-clientes").addEventListener("click", (e) => {
    showPanel('clientes',this);
});

document.getElementById("panel-p-cableado").addEventListener("click", (e) => {
    showPanel('p-cableado',this);
});

document.getElementById("panel-p-fibra").addEventListener("click", (e) => {
    showPanel('p-fibra',this);
});

document.getElementById("panel-p-seguridad").addEventListener("click", (e) => {
    showPanel('p-seguridad',this);
});

document.getElementById("panel-p-soporte").addEventListener("click", (e) => {
    showPanel('soporte',this);
});

document.getElementById("panel-p-desarrollo").addEventListener("click", (e) => {
    showPanel('p-desarrollo',this);
});

document.getElementById("panel-seo").addEventListener("click", (e) => {
    showPanel('seo',this);
});

// ================================================
/* SEO TABS */
// ================================================

document.getElementById("boton-seo-home").addEventListener("click", (e) => {
    seoTab(this, 'seo-home');
});

document.getElementById("boton-seo-cableado").addEventListener("click", (e) => {
    seoTab(this, 'seo-cableado');
});

document.getElementById("boton-seo-fibra").addEventListener("click", (e) => {
    seoTab(this, 'seo-fibra');
});

document.getElementById("boton-seo-seguridad").addEventListener("click", (e) => {
    seoTab(this, 'seo-seguridad');
});

document.getElementById("boton-seo-soporte").addEventListener("click", (e) => {
    seoTab(this, 'seo-soporte');
});

document.getElementById("boton-seo-desarrollo").addEventListener("click", (e) => {
    seoTab(this, 'seo-desarrollo');
});

// Auto-login si hay token guardado
if (authToken) {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app").style.display = "block";
  initApp();
}

// ================================================
// INIT
// ================================================
export async function initApp() {
  setApiStatus("loading");
  document.getElementById("dash-date").textContent =
    new Date().toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    " · " +
    new Date().toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  try {
    await loadAllData();
    setApiStatus("connected");
    renderDashboard();
  } catch (e) {
    setApiStatus("error");
    console.log(e);
    showNotif("No se pudo conectar con la API", "error");
  }
}

function setApiStatus(status) {
  const dot = document.getElementById("api-dot");
  const text = document.getElementById("api-indicator-text");
  const label = document.getElementById("api-status-label");
  if (status === "connected") {
    dot.className = "api-dot connected";
    text.textContent = "API conectada";
    label.textContent = "admin@sisgra.com.ar";
  } else if (status === "error") {
    dot.className = "api-dot";
    dot.style.background = "#ef4444";
    text.textContent = "API sin conexión";
    label.textContent = "Error de conexión";
  } else {
    dot.className = "api-dot";
    text.textContent = "Conectando...";
  }
}

async function loadAllData() {
  const files = [
    "hero",
    "nosotros",
    "clientes",
    "blog",
    "contacto",
    "seo",
    "paginas",
  ];
  const results = await Promise.all(
    files.map((f) =>
      apiGet(`/data/${f}`)
        .then((d) => [f, d])
        .catch(() => [f, null]),
    ),
  );
  results.forEach(([f, d]) => {
    if (d) state[f] = d;
  });
}

// ================================================
// NAVEGACIÓN
// ================================================
const panelNames = {
  dashboard: "Dashboard",
  home: "Inicio — Hero",
  nosotros: "Nosotros",
  clientes: "Clientes / Logos",
  blog: "Blog / Noticias",
  "p-cableado": "Cableado Estructurado",
  "p-fibra": "Fibra Óptica",
  "p-seguridad": "Seguridad Electrónica",
  "p-soporte": "Soporte IT",
  "p-desarrollo": "Desarrollo de Software",
  contacto: "Datos de Contacto",
  seo: "SEO & Meta",
};

function showPanel(id, el) {
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".sidebar-item")
    .forEach((i) => i.classList.remove("active"));
  const panel = document.getElementById("panel-" + id);
  if (panel) panel.classList.add("active");
  if (el) el.classList.add("active");
  document.getElementById("topbar-title").textContent = panelNames[id] || id;
  currentPanel = id;
  populatePanel(id);
}

// ================================================
// DASHBOARD
// ================================================
function renderDashboard() {
  const posts = state.blog?.posts || [];
  const borradores = posts.filter((p) => p.estado === "borrador").length;
  document.getElementById("dash-blog-count").textContent = posts.length;
  document.getElementById("dash-blog-sub").innerHTML =
    `<span class="stat-card-indicator ind-amber"></span>${borradores} en borrador`;
  document.getElementById("dash-clientes-count").textContent =
    state.clientes?.clientes?.length || 0;
}

// ================================================
// SEO TABS
// ================================================
function seoTab(el, targetId) {
  document
    .querySelectorAll("#seo-tabs .tab-item")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  ["home", "cableado", "fibra", "seguridad", "soporte", "desarrollo"].forEach(
    (p) => {
      const el2 = document.getElementById("seo-" + p);
      if (el2) el2.style.display = "seo-" + p === targetId ? "block" : "none";
    },
  );
}

// ================================================
// MODALES
// ================================================

document.querySelectorAll(".modal-overlay").forEach((o) => {
  o.addEventListener("click", (e) => {
    if (e.target === o) o.classList.remove("open");
  });
});

// ================================================
// RICH EDITOR
// ================================================
function formatDoc(cmd, val) {
  document.execCommand(cmd, false, val || null);
  document.getElementById("b-content").focus();
}

// ================================================
// NOTIFICACIONES
// ================================================
export function showNotif(msg, type = "success") {
  const n = document.getElementById("save-notif");
  n.className = `save-notif ${type}`;
  n.textContent = msg;
  n.classList.add("show");
  clearTimeout(n._t);
  n._t = setTimeout(() => n.classList.remove("show"), 3000);
}
