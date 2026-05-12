import { editCliente, deleteCliente } from './api_clientes.js';
import { editPost, saveBlog, deletePost } from './api_blog.js';
import { state } from './api_service.js';

// Carga de datos en formularios
export function populatePanel(id) {
  switch (id) {
    case "home":
      populateFlat("hero", [
        "badge",
        "titulo1",
        "titulo2",
        "descripcion",
        "boton_primario",
        "boton_secundario",
        "stat1_numero",
        "stat1_label",
        "stat2_numero",
        "stat2_label",
      ]);
      break;
    case "nosotros":
      populateFlat("nosotros", [
        "eyebrow",
        "titulo",
        "descripcion",
        "anio_fundacion",
        "empleados",
        "ciudad",
        "imagen",
      ]);
      break;
    case "clientes":
      populateClientes();
      break;
    case "blog":
      populateBlog();
      break;
    case "contacto":
      populateFlat("contacto", [
        "direccion",
        "telefono",
        "email",
        "whatsapp",
        "facebook",
        "instagram",
        "email_destino",
        "asunto_defecto",
        "formulario_descripcion",
      ]);
      populateCheckbox(
        "contacto-formulario_activo",
        state.contacto?.formulario_activo,
      );
      break;
    case "seo":
      populateSEO();
      break;
  }
  // Páginas de servicio
  if (id.startsWith("p-")) {
    const key = id.replace("p-", "");
    populateServiceEditor(key);
  }
  // Clientes toggles
  if (id === "clientes") {
    populateCheckbox(
      "clientes-carrusel_activo",
      state.clientes?.carrusel_activo,
    );
    populateCheckbox("clientes-auto_scroll", state.clientes?.auto_scroll);
    setVal("clientes-titulo_seccion", state.clientes?.titulo_seccion || "");
  }
  if (id === "blog") {
    populateCheckbox("blog-visible", state.blog?.visible);
    setVal("blog-titulo_seccion", state.blog?.titulo_seccion || "");
  }
}

export function setVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === "checkbox") el.checked = !!val;
  else el.value = val ?? "";
}

export function getVal(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  if (el.type === "checkbox") return el.checked;
  return el.value;
}

export function populateClientes() {
  const tbody = document.getElementById("clientes-tbody");
  const clientes = state.clientes?.clientes || [];
  tbody.innerHTML = clientes
    .map(
      (c) => `
    <tr>
      <td>${c.nombre}</td>
      <td style="font-size:.6875rem;color:var(--slate-400);">${c.imagen || "—"}</td>
      <td style="font-size:.6875rem;color:var(--slate-400);">${c.url || "—"}</td>
      <td><span class="${c.activo ? "badge-active" : "badge-inactive"}">${c.activo ? "Activo" : "Inactivo"}</span></td>
      <td>
        <button class="table-action table-edit" onclick="editCliente('${c.id}')">Editar</button>
        <button class="table-action table-delete" onclick="deleteCliente('${c.id}')">Eliminar</button>
      </td>
    </tr>
  `,
    )
    .join("");
}

export function populateBlog() {
  const posts = state.blog?.posts || [];
  const list = document.getElementById("blog-list");
  list.innerHTML = posts
    .map(
      (p) => `
    <div class="blog-item" data-id="${p.id}">
      <div class="blog-info">
        <div class="blog-title-text">${p.titulo}</div>
        <div class="blog-meta">${p.fecha || ""} · <span style="color:${p.estado === "publicado" ? "var(--green-500)" : "var(--amber-400)"};font-weight:700;">${p.estado === "publicado" ? "Publicado" : "Borrador"}</span> · ${p.categoria}</div>
        <div class="blog-excerpt">${p.extracto || ""}</div>
      </div>
      <div class="blog-actions">
        <button class="btn-edit-small" onclick="editPost('${p.id}')">Editar</button>
        <button class="btn-edit-small" style="color:var(--red-400);border-color:var(--red-400);" onclick="deletePost('${p.id}')">Eliminar</button>
      </div>
    </div>
  `,
    )
    .join("");
}

function populateCheckbox(id, val) {
  setVal(id, val);
}

function populateFlat(stateKey, fields) {
  const data = state[stateKey] || {};
  fields.forEach((f) => setVal(`${stateKey}-${f}`, data[f]));
}

function populateSEO() {
  const seo = state.seo || {};
  const pages = [
    "home",
    "cableado",
    "fibra",
    "seguridad",
    "soporte",
    "desarrollo",
  ];
  const container = document.getElementById("seo-tabs-content");
  container.innerHTML = pages
    .map((p, i) => {
      const d = seo[p] || {};
      return `
      <div id="seo-${p}" ${i > 0 ? 'style="display:none;"' : ""}>
        <div class="section-card">
          <div class="section-card-header"><span class="section-card-title">${p.charAt(0).toUpperCase() + p.slice(1)} — SEO</span></div>
          <div class="section-card-body">
            <div class="form-row"><div class="form-group"><label class="form-label">&lt;title&gt;</label><input class="form-input" id="seo-${p}-title" value="${d.title || ""}"><div class="form-hint">Máx. 60 caracteres</div></div></div>
            <div class="form-row"><div class="form-group"><label class="form-label">Meta description</label><textarea class="form-textarea" style="min-height:60px;" id="seo-${p}-desc">${d.description || ""}</textarea><div class="form-hint">Máx. 160 caracteres</div></div></div>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

function populateServiceEditor(key) {
  const data = state.paginas?.[key] || {};
  const container = document.getElementById("svc-editor-" + key);
  if (!container || container.innerHTML.trim()) return; // ya renderizado
  container.innerHTML = `
    <div class="section-card">
      <div class="section-card-header"><span class="section-card-title">Encabezado</span></div>
      <div class="section-card-body">
        <div class="form-row cols-2">
          <div class="form-group"><label class="form-label">Badge</label><input class="form-input" id="pag-${key}-badge" value="${data.badge || ""}"></div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group"><label class="form-label">Título línea 1</label><input class="form-input" id="pag-${key}-titulo1" value="${data.titulo1 || ""}"></div>
          <div class="form-group"><label class="form-label">Título línea 2 (acento)</label><input class="form-input" id="pag-${key}-titulo2" value="${data.titulo2 || ""}"></div>
        </div>
        <div class="form-row"><div class="form-group"><label class="form-label">Descripción</label><textarea class="form-textarea" id="pag-${key}-descripcion">${data.descripcion || ""}</textarea></div></div>
      </div>
    </div>
    ${(data.features || [])
      .map(
        (f, i) => `
      <div class="section-card">
        <div class="section-card-header"><span class="section-card-title">Feature ${i + 1}</span></div>
        <div class="section-card-body">
          <div class="form-row cols-3">
            <div class="form-group"><label class="form-label">Badge</label><input class="form-input" id="pag-${key}-f${i}-badge" value="${f.badge || ""}"></div>
            <div class="form-group" style="grid-column:span 2;"><label class="form-label">Título</label><input class="form-input" id="pag-${key}-f${i}-titulo" value="${f.titulo || ""}"></div>
          </div>
          <div class="form-row"><div class="form-group"><label class="form-label">Descripción</label><textarea class="form-textarea" style="min-height:60px;" id="pag-${key}-f${i}-descripcion">${f.descripcion || ""}</textarea></div></div>
        </div>
      </div>
    `,
      )
      .join("")}
  `;
}
