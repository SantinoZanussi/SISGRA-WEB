import { state, editingClienteId, setEditingClienteId } from './store.js';
import { apiPost, apiPatch, apiDelete } from './api.js';
import { showNotif, openModal, closeModal, setVal, getVal } from './ui.js';
import { populateClientes } from './populate.js';

export function editCliente(id) {
  setEditingClienteId(id);
  const c = state.clientes?.clientes?.find(x => x.id === id);
  if (!c) return;
  document.getElementById('modal-cliente-title').textContent = 'Editar Cliente';
  setVal('c-id',     c.id);
  setVal('c-name',   c.nombre);
  setVal('c-img',    c.imagen);
  setVal('c-url',    c.url);
  setVal('c-active', c.activo);
  openModal('modal-cliente');
}

export function nuevoCliente() {
  setEditingClienteId(null);
  document.getElementById('modal-cliente-title').textContent = 'Agregar Cliente';
  setVal('c-id',     '');
  setVal('c-name',   '');
  setVal('c-img',    '');
  setVal('c-url',    '');
  document.getElementById('c-active').checked = true;
  openModal('modal-cliente');
}

export async function saveCliente() {
  const nombre = document.getElementById('c-name').value.trim();
  if (!nombre) { showNotif('El nombre es requerido', 'error'); return; }

  const item = {
    nombre,
    imagen: getVal('c-img'),
    url:    getVal('c-url'),
    activo: document.getElementById('c-active').checked,
  };

  try {
    if (editingClienteId) {
      await apiPatch(`/data/clientes/clientes/${editingClienteId}`, item);
      const idx = state.clientes.clientes.findIndex(x => x.id === editingClienteId);
      if (idx > -1) state.clientes.clientes[idx] = { ...state.clientes.clientes[idx], ...item };
    } else {
      const r = await apiPost('/data/clientes/clientes', item);
      state.clientes.clientes = state.clientes.clientes || [];
      state.clientes.clientes.push(r.item);
    }
    populateClientes();
    closeModal('modal-cliente');
    setEditingClienteId(null);
    showNotif('✓  Cliente guardado', 'success');
  } catch (e) {
    showNotif('Error: ' + e.message, 'error');
  }
}

export async function deleteCliente(id) {
  if (!confirm('¿Eliminar este cliente?')) return;
  try {
    await apiDelete(`/data/clientes/clientes/${id}`);
    state.clientes.clientes = state.clientes.clientes.filter(x => x.id !== id);
    populateClientes();
    showNotif('✓  Cliente eliminado', 'success');
  } catch (e) {
    showNotif('Error: ' + e.message, 'error');
  }
}