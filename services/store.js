export const state = {
  hero:     null,
  nosotros: null,
  clientes: null,
  blog:     null,
  contacto: null,
  seo:      null,
  paginas:  null,
};

export let authToken = sessionStorage.getItem('sisgra_token') || null;
export let currentPanel = 'dashboard';
export let editingPostId = null;
export let editingClienteId = null;

export function setAuthToken(t) { authToken = t; sessionStorage.setItem('sisgra_token', t); }
export function clearAuthToken() { authToken = null; sessionStorage.removeItem('sisgra_token'); }
export function setCurrentPanel(id) { currentPanel = id; }
export function setEditingPostId(id) { editingPostId = id; }
export function setEditingClienteId(id) { editingClienteId = id; }