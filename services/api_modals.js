export function openModal(id) {
  if (id === "modal-cliente") {
    // reset si es nuevo
    if (!editingClienteId) {
      document.getElementById("modal-cliente-title").textContent =
        "Agregar Cliente";
      document.getElementById("c-id").value = "";
      setVal("c-name", "");
      setVal("c-img", "");
      setVal("c-url", "");
      document.getElementById("c-active").checked = true;
    }
  }
  if (id === "modal-blog" && !editingPostId) {
    document.getElementById("modal-blog-title").textContent = "Nuevo artículo";
    document.getElementById("b-id").value = "";
    setVal("b-title", "");
    setVal("b-extracto", "");
    setVal("b-img", "");
    document.getElementById("b-fecha").value = new Date()
      .toISOString()
      .split("T")[0];
    document.getElementById("b-content").innerHTML = "";
    document.getElementById("b-estado").value = "borrador";
  }
  document.getElementById(id).classList.add("open");
}

export function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  if (id === "modal-cliente") editingClienteId = null;
  if (id === "modal-blog") editingPostId = null;
}