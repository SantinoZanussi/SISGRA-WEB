import { openModal } from './api_modals.js';
import { showNotif } from './api_service.js';

export function editPost(id) {
  editingPostId = id;
  const p = state.blog?.posts?.find((x) => x.id === id);
  if (!p) return;
  document.getElementById("modal-blog-title").textContent = "Editar artículo";
  document.getElementById("b-id").value = p.id;
  setVal("b-title", p.titulo);
  setVal("b-fecha", p.fecha);
  setVal("b-extracto", p.extracto);
  setVal("b-img", p.imagen || "");
  document.getElementById("b-content").innerHTML = p.contenido || "";
  document.getElementById("b-categoria").value = p.categoria;
  document.getElementById("b-estado").value = p.estado;
  openModal("modal-blog");
}

export async function saveBlog() {
  const titulo = document.getElementById("b-title").value.trim();
  if (!titulo) {
    showNotif("El título es requerido", "error");
    return;
  }

  const item = {
    titulo,
    categoria: document.getElementById("b-categoria").value,
    estado: document.getElementById("b-estado").value,
    fecha:
      document.getElementById("b-fecha").value ||
      new Date().toISOString().split("T")[0],
    extracto: document.getElementById("b-extracto").value.trim(),
    contenido: document.getElementById("b-content").innerHTML,
    imagen: document.getElementById("b-img").value.trim(),
  };

  try {
    if (editingPostId) {
      item.id = editingPostId;
      await apiPatch(`/data/blog/posts/${editingPostId}`, item);
      const idx = state.blog.posts.findIndex((x) => x.id === editingPostId);
      if (idx > -1)
        state.blog.posts[idx] = { ...state.blog.posts[idx], ...item };
    } else {
      const r = await apiPost("/data/blog/posts", item);
      state.blog.posts = state.blog.posts || [];
      state.blog.posts.unshift(r.item);
    }
    populateBlog();
    closeModal("modal-blog");
    editingPostId = null;
    showNotif("✓  Artículo guardado", "success");
  } catch (e) {
    showNotif("Error: " + e.message, "error");
  }
}

export async function deletePost(id) {
  if (!confirm("¿Eliminar este artículo?")) return;
  try {
    await apiDelete(`/data/blog/posts/${id}`);
    state.blog.posts = state.blog.posts.filter((x) => x.id !== id);
    populateBlog();
    showNotif("✓  Artículo eliminado", "success");
  } catch (e) {
    showNotif("Error: " + e.message, "error");
  }
}