import { openModal } from './api_modals.js';
import { showNotif } from './api_service.js';

export function editCliente(id) {
  editingClienteId = id;
  const c = state.clientes?.clientes?.find((x) => x.id === id);
  if (!c) return;
  document.getElementById("modal-cliente-title").textContent = "Editar Cliente";
  document.getElementById("c-id").value = c.id;
  setVal("c-name", c.nombre);
  setVal("c-img", c.imagen);
  setVal("c-url", c.url);
  setVal("c-active", c.activo);
  openModal("modal-cliente");
}

export async function saveCliente() {
  const nombre = document.getElementById("c-name").value.trim();
  if (!nombre) {
    showNotif("El nombre es requerido", "error");
    return;
  }

  const item = {
    nombre,
    imagen: document.getElementById("c-img").value.trim(),
    url: document.getElementById("c-url").value.trim(),
    activo: document.getElementById("c-active").checked,
  };

  try {
    if (editingClienteId) {
      item.id = editingClienteId;
      await apiPatch(`/data/clientes/clientes/${editingClienteId}`, item);
      const idx = state.clientes.clientes.findIndex(
        (x) => x.id === editingClienteId,
      );
      if (idx > -1)
        state.clientes.clientes[idx] = {
          ...state.clientes.clientes[idx],
          ...item,
        };
    } else {
      const r = await apiPost("/data/clientes/clientes", item);
      state.clientes.clientes = state.clientes.clientes || [];
      state.clientes.clientes.push(r.item);
    }
    populateClientes();
    closeModal("modal-cliente");
    editingClienteId = null;
    showNotif("✓  Cliente guardado", "success");
  } catch (e) {
    showNotif("Error: " + e.message, "error");
  }
}

export async function deleteCliente(id) {
  if (!confirm("¿Eliminar este cliente?")) return;
  try {
    await apiDelete(`/data/clientes/clientes/${id}`);
    state.clientes.clientes = state.clientes.clientes.filter(
      (x) => x.id !== id,
    );
    populateClientes();
    showNotif("✓  Cliente eliminado", "success");
  } catch (e) {
    showNotif("Error: " + e.message, "error");
  }
}