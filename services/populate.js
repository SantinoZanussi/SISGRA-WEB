// ── POPULATE ─────────────────────────────────────────────────────────────────
// Renderiza los datos del state en los formularios del panel
import { state } from './store.js';
import { setVal } from './ui.js';

// ─── Dispatcher principal ─────────────────────────────────────────────────────
export function populatePanel(id) {
  switch (id) {
    case 'home':      populateHome();      break;
    case 'nosotros':  populateNosotros();  break;
    case 'clientes':  populateClientes();  break;
    case 'blog':      populateBlog();      break;
    case 'contacto':  populateContacto();  break;
    case 'seo':       populateSEO();       break;
    default:
      if (id.startsWith('p-')) populateServiceEditor(id.replace('p-', ''));
  }
}

// ─── Home / Hero ─────────────────────────────────────────────────────────────
function populateHome() {
  const d = state.hero || {};
  const fields = [
    'badge','titulo1','titulo2','descripcion',
    'boton_primario','boton_secundario',
    'stat1_numero','stat1_label','stat2_numero','stat2_label',
    'plantilla',
    // Plantilla 2
    'p2_eyebrow','p2_titulo','p2_subtitulo','p2_descripcion',
    'p2_boton_primario','p2_boton_secundario',
    'p2_tag1','p2_tag2','p2_tag3',
    'p2_metric1_num','p2_metric1_label',
    'p2_metric2_num','p2_metric2_label',
    'p2_metric3_num','p2_metric3_label',
  ];
  fields.forEach(f => setVal(`hero-${f}`, d[f]));
}

// ─── Nosotros ─────────────────────────────────────────────────────────────────
function populateNosotros() {
  const d = state.nosotros || {};
  ['eyebrow','titulo','descripcion','anio_fundacion','empleados','ciudad','imagen']
    .forEach(f => setVal(`nosotros-${f}`, d[f]));
}

// ─── Clientes ─────────────────────────────────────────────────────────────────
export function populateClientes() {
  setVal('clientes-carrusel_activo', state.clientes?.carrusel_activo);
  setVal('clientes-auto_scroll',     state.clientes?.auto_scroll);
  setVal('clientes-titulo_seccion',  state.clientes?.titulo_seccion || '');

  const tbody    = document.getElementById('clientes-tbody');
  const clientes = state.clientes?.clientes || [];
  tbody.innerHTML = clientes.map(c => `
    <tr>
      <td>${c.nombre}</td>
      <td style="font-size:.6875rem;color:var(--slate-400);">${c.imagen || '—'}</td>
      <td style="font-size:.6875rem;color:var(--slate-400);">${c.url || '—'}</td>
      <td><span class="${c.activo ? 'badge-active' : 'badge-inactive'}">${c.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <button class="table-action table-edit"   onclick="window.__admin.editCliente('${c.id}')">Editar</button>
        <button class="table-action table-delete" onclick="window.__admin.deleteCliente('${c.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// ─── Blog ─────────────────────────────────────────────────────────────────────
export function populateBlog() {
  setVal('blog-visible',        state.blog?.visible);
  setVal('blog-titulo_seccion', state.blog?.titulo_seccion || '');

  const posts = state.blog?.posts || [];
  const list  = document.getElementById('blog-list');
  list.innerHTML = posts.map(p => `
    <div class="blog-item" data-id="${p.id}">
      <div class="blog-info">
        <div class="blog-title-text">${p.titulo}</div>
        <div class="blog-meta">
          ${p.fecha || ''} ·
          <span style="color:${p.estado === 'publicado' ? 'var(--green-500)' : 'var(--amber-400)'};font-weight:700;">
            ${p.estado === 'publicado' ? 'Publicado' : 'Borrador'}
          </span> · ${p.categoria}
        </div>
        <div class="blog-excerpt">${p.extracto || ''}</div>
      </div>
      <div class="blog-actions">
        <button class="btn-edit-small" onclick="window.__admin.editPost('${p.id}')">Editar</button>
        <button class="btn-edit-small" style="color:var(--red-400);border-color:var(--red-400);"
          onclick="window.__admin.deletePost('${p.id}')">Eliminar</button>
      </div>
    </div>
  `).join('');

  // Actualiza el stat del dashboard
  const countEl = document.getElementById('dash-blog-count');
  const subEl   = document.getElementById('dash-blog-sub');
  if (countEl) countEl.textContent = posts.length;
  if (subEl) {
    const borradores = posts.filter(p => p.estado === 'borrador').length;
    subEl.innerHTML = `<span class="stat-card-indicator ind-amber"></span>${borradores} en borrador`;
  }
}

// ─── Contacto ─────────────────────────────────────────────────────────────────
function populateContacto() {
  const d = state.contacto || {};
  [
    'direccion','telefono','email','whatsapp',
    'facebook','instagram','email_destino','asunto_defecto','formulario_descripcion',
  ].forEach(f => setVal(`contacto-${f}`, d[f]));
  setVal('contacto-formulario_activo', d.formulario_activo);
}

// ─── SEO ──────────────────────────────────────────────────────────────────────
function populateSEO() {
  const seo   = state.seo || {};
  const pages = ['home','cableado','fibra','seguridad','soporte','desarrollo'];
  const container = document.getElementById('seo-tabs-content');

  // Solo renderiza si está vacío
  if (!container.innerHTML.trim()) {
    container.innerHTML = pages.map((p, i) => {
      const d = seo[p] || {};
      return `
        <div id="seo-tab-${p}" ${i > 0 ? 'style="display:none;"' : ''}>
          <div class="section-card">
            <div class="section-card-header">
              <span class="section-card-title">${p.charAt(0).toUpperCase() + p.slice(1)} — SEO</span>
            </div>
            <div class="section-card-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">&lt;title&gt;</label>
                  <input class="form-input" id="seo-${p}-title" value="${escHtml(d.title || '')}">
                  <div class="form-hint">Máx. 60 caracteres</div>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Meta description</label>
                  <textarea class="form-textarea" style="min-height:60px;" id="seo-${p}-desc">${escHtml(d.description || '')}</textarea>
                  <div class="form-hint">Máx. 160 caracteres</div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  } else {
    // Si ya existe, solo actualiza los valores
    pages.forEach(p => {
      const d = seo[p] || {};
      setVal(`seo-${p}-title`, d.title || '');
      setVal(`seo-${p}-desc`,  d.description || '');
    });
  }
}

// ─── Páginas de servicio ──────────────────────────────────────────────────────
function populateServiceEditor(key) {
  const data      = state.paginas?.[key] || {};
  const container = document.getElementById('svc-editor-' + key);
  if (!container) return;

  container.innerHTML = `
    <div class="section-card">
      <div class="section-card-header"><span class="section-card-title">Encabezado</span></div>
      <div class="section-card-body">
        <div class="form-row cols-2">
          <div class="form-group"><label class="form-label">Badge</label>
            <input class="form-input" id="pag-${key}-badge" value="${escHtml(data.badge || '')}"></div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group"><label class="form-label">Título línea 1</label>
            <input class="form-input" id="pag-${key}-titulo1" value="${escHtml(data.titulo1 || '')}"></div>
          <div class="form-group"><label class="form-label">Título línea 2 (acento)</label>
            <input class="form-input" id="pag-${key}-titulo2" value="${escHtml(data.titulo2 || '')}"></div>
        </div>
        <div class="form-row"><div class="form-group"><label class="form-label">Descripción</label>
          <textarea class="form-textarea" id="pag-${key}-descripcion">${escHtml(data.descripcion || '')}</textarea>
        </div></div>
      </div>
    </div>
    ${(data.features || []).map((f, i) => `
      <div class="section-card">
        <div class="section-card-header"><span class="section-card-title">Feature ${i + 1}</span></div>
        <div class="section-card-body">
          <div class="form-row cols-3">
            <div class="form-group"><label class="form-label">Badge</label>
              <input class="form-input" id="pag-${key}-f${i}-badge" value="${escHtml(f.badge || '')}"></div>
            <div class="form-group" style="grid-column:span 2;"><label class="form-label">Título</label>
              <input class="form-input" id="pag-${key}-f${i}-titulo" value="${escHtml(f.titulo || '')}"></div>
          </div>
          <div class="form-row"><div class="form-group"><label class="form-label">Descripción</label>
            <textarea class="form-textarea" style="min-height:60px;" id="pag-${key}-f${i}-descripcion">${escHtml(f.descripcion || '')}</textarea>
          </div></div>
        </div>
      </div>
    `).join('')}
  `;
}

// ─── Utilidad ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}