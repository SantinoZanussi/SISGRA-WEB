/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
const state = {
  templates: [
    {
      id: 'tpl-index',
      name: 'Inicio — index.html',
      desc: 'Página de inicio principal',
      status: 'active',
      sections: [
        { id: 's-hero',     type: 'hero-centered', data: {} },
        { id: 's-logos',    type: 'logos',         data: {} },
        { id: 's-blog',     type: 'news',          data: {} },
        { id: 's-services', type: 'services',      data: {} },
        { id: 's-about',    type: 'about',         data: {} },
        { id: 's-footer',   type: 'footer',        locked: true, data: { brand: 'SISGRA', tagline: 'Infraestructura tecnológica para empresas líderes de Argentina.' } },
      ]
    }
  ],
  currentTplId: null,
  selectedSectionId: null,
  viewport: 'desktop',
  clientes: {},
  blog: {},
  servicios: {},
  contacto: {},
  seo: {},
  editingClienteId: null,
};
 
/* ══════════════════════════════════════════════
   SECTION TYPE REGISTRY
══════════════════════════════════════════════ */
const SECTION_TYPES = [
  {
    group: 'Navegación',
    items: [
      { type: 'nav', label: 'Barra de Navegación', desc: 'Logo + links + CTA', icon: `<i class="fa-solid fa-window-maximize"></i>` },
    ]
  },
  {
    group: 'Heroes',
    items: [
      { type: 'hero',          label: 'Hero Lateral',        desc: 'Texto izq. + stats der.', icon: `<i class="fa-solid fa-table-columns"></i>` },
      { type: 'hero-centered', label: 'Hero Centrado',       desc: 'Texto centrado + métricas', icon: `<i class="fa-solid fa-heading"></i>` },
    ]
  },
  {
    group: 'Secciones',
    items: [
      { type: 'services', label: 'Servicios / Cards',   desc: 'Grid de 3 tarjetas de servicios', icon: `<i class="fa-solid fa-table-cells-large"></i>` },
      { type: 'about',    label: 'Nosotros / About',    desc: 'Texto + imagen lateral', icon: `<i class="fa-solid fa-image"></i>` },
      { type: 'news',     label: 'Blog / Noticias',     desc: 'Grid de 3 artículos', icon: `<i class="fa-solid fa-newspaper"></i>` },
      { type: 'logos',    label: 'Carrusel de Logos',   desc: 'Logos de clientes', icon: `<i class="fa-solid fa-images"></i>` },
      { type: 'cta',      label: 'Banda CTA',           desc: 'Call to action horizontal', icon: `<i class="fa-solid fa-bullhorn"></i>` },
    ]
  },
  {
    group: 'Cierre',
    items: [
      { type: 'spacer',  label: 'Espacio',   desc: 'Separador en blanco', icon: `<i class="fa-solid fa-arrows-up-down"></i>` },
    ]
  },
];
 
 
const apiGet = (...args) => window.__svc?.apiGet(...args);
const apiPut = (...args) => window.__svc?.apiPut(...args);
const apiPost = (...args) => window.__svc?.apiPost(...args);
const apiPatch = (...args) => window.__svc?.apiPatch(...args);
const apiDelete = (...args) => window.__svc?.apiDelete(...args);

/* ── Preview de imágenes por path/URL ── */
function updateImgPreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!preview) return;
  const url = (input?.value || '').trim();
  if (url) { preview.src = url; preview.style.display = 'block'; }
  else { preview.src = ''; preview.style.display = 'none'; }
}

function bindImgPreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', () => updateImgPreview(inputId, previewId));
}

/* Inserta un botón "Elegir imagen" junto al input que abre el selector modal */
function attachImgPicker(inputId, previewId) {
  const input = document.getElementById(inputId);
  if (!input || input.dataset.pickerWired) return;
  input.dataset.pickerWired = '1';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-secondary';
  btn.style.cssText = 'margin-top:.4rem;font-size:.78rem;';
  btn.innerHTML = '<i class="fa-solid fa-image"></i> Elegir imagen';
  btn.addEventListener('click', async () => {
    const path = await window.__imgPicker?.open({ current: input.value || '' });
    if (path) { input.value = path; updateImgPreview(inputId, previewId); }
  });
  input.insertAdjacentElement('afterend', btn);
}
 
/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function uid(){ return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2,5); }

let _autoSaveTimer = null;
function scheduleAutoSave(){
  const tpl = state.templates.find(t=>t.id===state.currentTplId);
  if(!tpl || tpl.status!=='active') return;
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(()=>saveTpl(state.currentTplId), 1500);
}

function showNotif(msg, type='success'){ window.__svc?.showNotif(msg, type); }
function openModal(id){ window.__svc?.openModal(id); }
function closeModal(id){ window.__svc?.closeModal(id); }
 
/* ══════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════ */
function showPanel(id){
  try { sessionStorage.setItem('sisgra_panel', id); } catch(_){}
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i=>i.classList.remove('active'));
  document.querySelectorAll('.sidebar-tpl-item').forEach(i=>i.classList.remove('active'));
 
  const panel = document.getElementById('panel-' + id);
  if(panel) panel.classList.add('active');
 
  const sideEl = document.querySelector(`.sidebar-item[data-panel="${id}"]`);
  if(sideEl) sideEl.classList.add('active');
 
  const NAMES = {
    dashboard:'Dashboard', modulos:'Catálogo de Módulos', navbar:'Ítems del Navbar', clientes:'Clientes',
    blog:'Blog / Noticias', contacto:'Datos de Contacto', seo:'SEO & Meta',
    plantillas:'Plantillas', 'tpl-editor':'Editor de Plantilla', assets:'Imágenes',
  };
  document.getElementById('topbar-title').textContent = NAMES[id] || id;

  if (id === 'navbar'  && typeof loadNavbarItems  === 'function') loadNavbarItems();
  if (id === 'modulos' && typeof window.loadModulos === 'function') window.loadModulos();
  if (id === 'seo'     && typeof buildSeoTabs      === 'function') buildSeoTabs();
 
  // The editor panel has no padding so we override content-area
  const ca = document.querySelector('.content-area');
  if(id === 'tpl-editor'){
    ca.style.padding = '0';
    ca.style.overflow = 'hidden';
  } else {
    ca.style.padding = '2rem';
    ca.style.overflow = 'auto';
  }
}
 
/* ══════════════════════════════════════════════
   SIDEBAR TEMPLATES
══════════════════════════════════════════════ */
// function renderSidebarTemplates(){
//   const el = document.getElementById('sidebar-tpl-list');
//   el.innerHTML = state.templates.map(t => `
//     <div class="sidebar-tpl-item ${t.id === state.currentTplId ? 'active' : ''}" data-tpl-id="${t.id}">
//       <span class="sidebar-tpl-dot"></span>
//       <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.name}</span>
//       ${t.status==='active' ? '<span class="tpl-live-pill">LIVE</span>' : ''}
//     </div>
//   `).join('');
 
//   el.querySelectorAll('.sidebar-tpl-item').forEach(item => {
//     item.addEventListener('click', () => {
//       state.currentTplId = item.dataset.tplId;
//       renderSidebarTemplates();
//       openTemplateEditor(state.currentTplId);
//     });
//   });
// }
 
/* ══════════════════════════════════════════════
   TEMPLATE OVERVIEW
══════════════════════════════════════════════ */
function renderTemplateOverview(){
  const list = document.getElementById('tpl-overview-list');
  list.innerHTML = state.templates.map((t,i) => `
    <div class="tpl-list-item ${t.status==='active'?'active-tpl':''}" data-tpl-id="${t.id}">
      <div class="tpl-list-num">0${i+1}</div>
      <div class="tpl-list-info">
        <div class="tpl-list-name">${t.name}</div>
        <div class="tpl-list-desc">${t.desc} — <em>${t.sections.length} secciones</em></div>
      </div>
      <span class="tpl-list-status ${t.status==='active'?'tpl-status-active':'tpl-status-draft'}">${t.status==='active'?'Activa':'Borrador'}</span>
      <div class="tpl-list-actions">
        ${t.status!=='active'?`<button class="btn-edit-small" onclick="setActiveTpl('${t.id}')">Activar</button>`:''}
        <button class="btn-edit-small" onclick="openTemplateEditorFromList('${t.id}')">Editar</button>
        ${state.templates.length>1?`<button class="btn-edit-small" style="color:var(--red-400);border-color:var(--red-400);" onclick="deleteTpl('${t.id}')">Eliminar</button>`:''}
      </div>
    </div>
  `).join('');
  document.getElementById('dash-tpl-count').textContent = state.templates.length;
}
 
window.setActiveTpl = async function(id){
  state.templates.forEach(t => t.status = t.id===id ? 'active' : 'draft');
  renderTemplateOverview();
  renderSidebarTemplates();
  const tpl = state.templates.find(t=>t.id===id);
  if(tpl){
    const heroSec = tpl.sections.find(s=>s.type==='hero'||s.type==='hero-centered');
    if(heroSec){
      try {
        const cur = await apiGet('/data/hero').catch(()=>({}));
        await apiPut('/data/hero', heroSectionToHeroJson(heroSec, cur||{}));
        showNotif('✓ Plantilla activada — cambios publicados en index.html');
      } catch(e){ showNotif('✓ Plantilla activada'); }
      return;
    }
  }
  showNotif('✓ Plantilla activada');
};
 
window.deleteTpl = function(id){
  if(!confirm('¿Eliminar esta plantilla?')) return;
  state.templates = state.templates.filter(t=>t.id!==id);
  if(state.currentTplId===id) state.currentTplId = null;
  renderTemplateOverview();
  renderSidebarTemplates();
  showNotif('✓ Plantilla eliminada');
};
 
window.openTemplateEditorFromList = function(id){
  state.currentTplId = id;
  renderSidebarTemplates();
  openTemplateEditor(id);
};
 
/* ══════════════════════════════════════════════
   SECTION HTML RENDERERS
══════════════════════════════════════════════ */
function renderSectionHTML(sec){
  const d = sec.data || {};
  switch(sec.type){
    case 'nav': return `
      <div class="sec-nav">
        <div class="nav-logo" contenteditable="true" data-sec="${sec.id}" data-field="logo">${d.logo||'LOGO'}</div>
        <div class="nav-links">
          ${(d.links||'Link 1, Link 2, Link 3').split(',').map(l=>`<span class="nav-link">${l.trim()}</span>`).join('')}
        </div>
        <div class="nav-cta" contenteditable="true" data-sec="${sec.id}" data-field="cta">${d.cta||'Contactar'}</div>
      </div>`;
 
    case 'hero': return `
      <div class="sec-hero">
        <div class="hero-left">
          <div class="hero-badge" contenteditable="true" data-sec="${sec.id}" data-field="badge">${d.badge||'Badge'}</div>
          <div class="hero-h1" contenteditable="true" data-sec="${sec.id}" data-field="h1">${d.h1||'Título principal'}</div>
          <div class="hero-h2" contenteditable="true" data-sec="${sec.id}" data-field="h2">${d.h2||'Subtítulo'}</div>
          <div class="hero-desc" contenteditable="true" data-sec="${sec.id}" data-field="desc">${d.desc||'Descripción del hero...'}</div>
          <div class="hero-btns">
            <div class="hbtn-primary" contenteditable="true" data-sec="${sec.id}" data-field="btn1">${d.btn1||'Botón primario'}</div>
            <div class="hbtn-secondary" contenteditable="true" data-sec="${sec.id}" data-field="btn2">${d.btn2||'Botón secundario'}</div>
          </div>
        </div>
        <div class="hero-right">
          <div class="stat-box">
            <div class="stat-num" contenteditable="true" data-sec="${sec.id}" data-field="stat1_num">${d.stat1_num||'+25'}</div>
            <div class="stat-lbl" contenteditable="true" data-sec="${sec.id}" data-field="stat1_lbl">${d.stat1_lbl||'Label'}</div>
          </div>
          <div class="stat-box">
            <div class="stat-num" contenteditable="true" data-sec="${sec.id}" data-field="stat2_num">${d.stat2_num||'+500'}</div>
            <div class="stat-lbl" contenteditable="true" data-sec="${sec.id}" data-field="stat2_lbl">${d.stat2_lbl||'Label'}</div>
          </div>
        </div>
      </div>`;
 
    case 'hero-centered': return `
      <div class="sec-hero-centered">
        <div class="hero-badge" contenteditable="true" data-sec="${sec.id}" data-field="badge">${d.badge||'Badge'}</div>
        <div class="hero-h1" contenteditable="true" data-sec="${sec.id}" data-field="h1">${d.h1||'Título centrado.'}</div>
        <div class="hero-desc" contenteditable="true" data-sec="${sec.id}" data-field="desc">${d.desc||'Descripción...'}</div>
        <div class="hero-btns">
          <div class="hbtn-primary" contenteditable="true" data-sec="${sec.id}" data-field="btn1">${d.btn1||'Botón primario'}</div>
          <div class="hbtn-secondary" contenteditable="true" data-sec="${sec.id}" data-field="btn2">${d.btn2||'Botón secundario'}</div>
        </div>
        <div class="metric-row" style="width:100%;max-width:700px;">
          <div class="metric-box">
            <div class="metric-num" contenteditable="true" data-sec="${sec.id}" data-field="m1_num">${d.m1_num||'+500'}</div>
            <div class="metric-lbl" contenteditable="true" data-sec="${sec.id}" data-field="m1_lbl">${d.m1_lbl||'Label'}</div>
          </div>
          <div class="metric-box">
            <div class="metric-num" contenteditable="true" data-sec="${sec.id}" data-field="m2_num">${d.m2_num||'99.9%'}</div>
            <div class="metric-lbl" contenteditable="true" data-sec="${sec.id}" data-field="m2_lbl">${d.m2_lbl||'Label'}</div>
          </div>
          <div class="metric-box" style="border-right:none;">
            <div class="metric-num" contenteditable="true" data-sec="${sec.id}" data-field="m3_num">${d.m3_num||'25+'}</div>
            <div class="metric-lbl" contenteditable="true" data-sec="${sec.id}" data-field="m3_lbl">${d.m3_lbl||'Label'}</div>
          </div>
        </div>
      </div>`;
 
    case 'services': return `
      <div class="sec-services">
        <div class="sec-eyebrow" contenteditable="true" data-sec="${sec.id}" data-field="eyebrow">${d.eyebrow||'Lo que hacemos'}</div>
        <div class="sec-title" contenteditable="true" data-sec="${sec.id}" data-field="title">${d.title||'Nuestros Servicios'}</div>
        <div class="cards-grid">
          ${(state.servicios?.cards||[]).map(s=>`
            <div class="svc-card">
              <div class="svc-icon"><i class="fa-solid fa-bolt"></i></div>
              <div class="svc-name">${s.titulo||''}</div>
              <div class="svc-desc">${s.descripcion||''}</div>
            </div>`).join('') || '<div style="padding:1rem;color:#94a3b8;text-align:center;font-size:.75rem;">Cargando servicios...</div>'}
        </div>
      </div>`;
 
    case 'logos': return `
      <div class="sec-logos">
        <div class="logos-title" contenteditable="true" data-sec="${sec.id}" data-field="title">${d.title||'Nuestros Clientes'}</div>
        <div class="logos-track">
          ${(state.clientes?.clientes||[]).filter(c=>c.activo!==false).map(c=>`
            <div class="logo-pill">${c.imagen?`<img src="${c.imagen}" alt="${c.nombre}" style="max-height:28px;filter:grayscale(100%);opacity:.7;" onerror="this.style.display='none'">`:`<span>${c.nombre}</span>`}</div>
          `).join('') || '<div class="logo-pill">Sin clientes aún</div>'}
        </div>
      </div>`;
 
    case 'news': return `
      <div class="sec-news">
        <div class="sec-eyebrow" contenteditable="true" data-sec="${sec.id}" data-field="eyebrow">${d.eyebrow||'Blog'}</div>
        <div class="sec-title" contenteditable="true" data-sec="${sec.id}" data-field="title">${d.title||'Últimas Noticias'}</div>
        <div class="news-grid">
          ${(state.blog?.posts||[]).slice(0,3).map(p=>`
            <div class="news-card">
              <div class="news-img"><span class="news-cat">${p.categoria||''}</span></div>
              <div class="news-body">
                <div class="news-title">${p.titulo||''}</div>
                <div class="news-meta">${p.fecha||''} · ${p.estado==='publicado'?'Publicado':'Borrador'}</div>
              </div>
            </div>`).join('') || '<div style="padding:1rem;color:#94a3b8;text-align:center;font-size:.75rem;">Sin posts aún</div>'}
        </div>
      </div>`;
 
    case 'about': return `
      <div class="sec-about">
        <div>
          <div class="sec-eyebrow" contenteditable="true" data-sec="${sec.id}" data-field="eyebrow">${d.eyebrow||'Quiénes somos'}</div>
          <div class="sec-title" contenteditable="true" data-sec="${sec.id}" data-field="title">${d.title||'Nuestra Historia'}</div>
          <div class="sec-desc" contenteditable="true" data-sec="${sec.id}" data-field="desc">${d.desc||'Descripción de la empresa...'}</div>
        </div>
        <div class="about-img">Imagen corporativa</div>
      </div>`;
 
    case 'cta': return `
      <div class="sec-cta">
        <div class="cta-left">
          <div class="cta-title" contenteditable="true" data-sec="${sec.id}" data-field="title">${d.title||'¿Listo para empezar?'}</div>
          <div class="cta-desc" contenteditable="true" data-sec="${sec.id}" data-field="desc">${d.desc||'Contactanos sin compromiso.'}</div>
        </div>
        <div class="cta-btn" contenteditable="true" data-sec="${sec.id}" data-field="btn">${d.btn||'Contactar'}</div>
      </div>`;
 
    case 'contact': return `
      <div class="sec-contact">
        <div class="contact-left">
          <div class="sec-eyebrow" contenteditable="true" data-sec="${sec.id}" data-field="eyebrow">${d.eyebrow||'Contacto'}</div>
          <div class="sec-title" contenteditable="true" data-sec="${sec.id}" data-field="title">${d.title||'Hablemos'}</div>
          <div class="contact-info">📍 ${state.contacto?.direccion||'Rosario, Santa Fe'}<br>📞 ${state.contacto?.telefono||'+54 341 000-0000'}<br>✉ ${state.contacto?.email||'info@sisgra.com'}</div>
        </div>
        <div class="contact-form">
          <input class="cf-input" placeholder="Nombre completo" readonly/>
          <input class="cf-input" placeholder="Email corporativo" readonly/>
          <input class="cf-input" placeholder="Empresa" readonly/>
          <textarea class="cf-input" style="min-height:80px;resize:none;" placeholder="¿En qué podemos ayudarte?" readonly></textarea>
          <div class="cf-btn" contenteditable="true" data-sec="${sec.id}" data-field="cta_btn">${d.cta_btn||'Enviar mensaje'}</div>
        </div>
      </div>`;
 
    case 'footer': {
      const ct = state.contacto||{};
      return `
      <div class="sec-footer" style="pointer-events:none;user-select:none;">
        <div style="display:flex;gap:2rem;align-items:flex-start;padding:1.5rem 2rem;background:linear-gradient(135deg,#0A1D37,#1e3a8a);">
          <div style="flex:1;">
            <div style="font-size:.45rem;font-weight:900;letter-spacing:.3em;text-transform:uppercase;color:#60a5fa;margin-bottom:.4rem;">Contacto</div>
            <div style="font-size:.875rem;font-weight:900;color:#fff;margin-bottom:.4rem;">Solicite un presupuesto</div>
            <div style="font-size:.6rem;color:rgba(255,255,255,.5);margin-bottom:.75rem;line-height:1.4;">${ct.formulario_descripcion||'Cuéntenos sobre su organización.'}</div>
            <div style="background:#25d366;color:#fff;padding:.3rem .75rem;font-size:.5rem;font-weight:700;display:inline-block;letter-spacing:.1em;">💬 WhatsApp · ${ct.whatsapp||''}</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,.06);padding:.75rem;border:1px solid rgba(255,255,255,.1);">
            <div style="font-size:.6rem;color:#fff;font-weight:700;margin-bottom:.5rem;">Complete el formulario</div>
            ${['Nombre','Empresa','Teléfono','Email'].map(f=>`<div style="border:1px solid rgba(255,255,255,.15);padding:.3rem .5rem;font-size:.5rem;color:rgba(255,255,255,.3);margin-bottom:.3rem;">${f}</div>`).join('')}
            <div style="background:#2563eb;color:#fff;padding:.3rem;font-size:.5rem;font-weight:700;text-align:center;margin-top:.4rem;">Enviar consulta</div>
          </div>
        </div>
        <div style="background:#060e1c;padding:.75rem 2rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;">
          <div style="font-family:monospace;font-weight:900;letter-spacing:.1em;color:#fff;font-size:.75rem;">SISGRA</div>
          <div style="display:flex;gap:.75rem;flex-wrap:wrap;">
            ${['Cableado Estructurado','Fibra Óptica','Seguridad Electrónica','Soporte IT','Software','Blog'].map(l=>`<span style="font-size:.45rem;color:rgba(255,255,255,.4);">${l}</span>`).join('')}
          </div>
          <div style="font-size:.45rem;color:rgba(255,255,255,.2);white-space:nowrap;">FB</div>
        </div>
        <div style="background:#060e1c;border-top:1px solid rgba(255,255,255,.06);padding:.4rem 2rem;text-align:center;">
          <span style="font-size:.4rem;color:rgba(255,255,255,.2);letter-spacing:.15em;text-transform:uppercase;">© 2026 SISGRA S.R.L. — Footer gestionado desde panel de Contacto</span>
        </div>
      </div>`;}

 
    case 'spacer': return `<div class="sec-spacer" style="height:${d.height||60}px;display:flex;align-items:center;justify-content:center;"><span style="font-size:.6rem;color:#cbd5e1;letter-spacing:.15em;text-transform:uppercase;font-weight:700;">Espacio — ${d.height||60}px</span></div>`;
 
    default: return `<div style="padding:2rem;text-align:center;color:#94a3b8;">Sección: ${sec.type}</div>`;
  }
}
 
/* ══════════════════════════════════════════════
   DESIGN DEFAULTS PER SECTION TYPE
══════════════════════════════════════════════ */
const DESIGN_DEFAULTS = {
  hero: {
    bgFrom:'#0A1D37', bgTo:'#1e3a8a', bgAngle:'135',
    layout:'split', paddingV:'80', paddingH:'64',
    h1Color:'#ffffff', h2Color:'#60a5fa', descColor:'rgba(255,255,255,0.65)',
    badgeBg:'rgba(59,130,246,0.2)', badgeBorder:'rgba(59,130,246,0.4)', badgeColor:'#93c5fd',
    btn1Bg:'#2563eb', btn1Color:'#ffffff', btn1Radius:'0',
    btn2Bg:'transparent', btn2Border:'rgba(255,255,255,0.3)', btn2Color:'#ffffff',
    statBg:'rgba(255,255,255,0.06)', statBorder:'rgba(255,255,255,0.10)', statNumColor:'#ffffff', statLblColor:'#93c5fd',
    h1Size:'52', h1Italic:'1', descSize:'15', showBadge:'1', showStats:'1',
  },
  'hero-centered': {
    bgFrom:'#0A1D37', bgTo:'#1e3a8a', bgAngle:'160',
    paddingV:'96', paddingH:'64',
    h1Color:'#ffffff', descColor:'rgba(255,255,255,0.65)',
    badgeBg:'rgba(59,130,246,0.2)', badgeBorder:'rgba(59,130,246,0.4)', badgeColor:'#93c5fd',
    btn1Bg:'#2563eb', btn1Color:'#ffffff',
    btn2Bg:'transparent', btn2Border:'rgba(255,255,255,0.3)', btn2Color:'#ffffff',
    metricBg:'transparent', metricBorder:'rgba(255,255,255,0.10)', metricNumColor:'#ffffff', metricLblColor:'#93c5fd',
    h1Size:'48', h1Italic:'1', descSize:'15', showBadge:'1', showMetrics:'1',
  },
  nav: {
    bg:'#0A1D37', logoColor:'#ffffff', linkColor:'rgba(255,255,255,0.7)',
    ctaBg:'#2563eb', ctaColor:'#ffffff', paddingV:'12', paddingH:'32',
  },
  services: {
    bg:'#f8fafc', eyebrowColor:'#2563eb', titleColor:'#0A1D37',
    cardBg:'#ffffff', cardBorder:'#e2e8f0', cardIconBg:'#0A1D37',
    paddingV:'64', paddingH:'64', cols:'3',
  },
  cta: {
    bg:'#0A1D37', titleColor:'#ffffff', descColor:'rgba(255,255,255,0.7)',
    btnBg:'#2563eb', btnColor:'#ffffff', paddingV:'40', paddingH:'64',
  },
  about: {
    bg:'#ffffff', eyebrowColor:'#2563eb', titleColor:'#0A1D37', descColor:'#64748b',
    imageBg:'#e2e8f0', paddingV:'64', paddingH:'64',
  },
  footer: {
    bg:'#0A1D37', brandColor:'#ffffff', taglineColor:'rgba(255,255,255,0.5)',
    linkColor:'rgba(255,255,255,0.6)', titleColor:'rgba(255,255,255,0.9)',
    paddingV:'48', paddingH:'64',
  },
  logos: {
    bg:'#ffffff', titleColor:'#94a3b8', pillBg:'#f1f5f9', pillColor:'#64748b',
    paddingV:'40', paddingH:'64',
  },
};
 
function getDesign(sec){
  const defaults = DESIGN_DEFAULTS[sec.type] || {};
  return Object.assign({}, defaults, sec.design || {});
}
 
/* ══════════════════════════════════════════════
   DESIGN UPDATE (live apply to canvas)
══════════════════════════════════════════════ */
window.designUpdate = function(el, secId, tplId){
  const field = el.dataset.field;
  const val = el.value;
  const tpl = state.templates.find(t=>t.id===tplId);
  if(!tpl) return;
  const sec = tpl.sections.find(s=>s.id===secId);
  if(!sec) return;
  if(!sec.design) sec.design = {};
  sec.design[field] = val;
  scheduleAutoSave();

  // Sync paired color text/native inputs
  const pair = document.querySelector(`[data-field="${field}"][data-sec-design="${secId}"]`);
  if(pair && pair !== el) pair.value = val;
 
  // Re-render section
  const sectionEl = document.querySelector(`.section-slot[data-sec-id="${secId}"] .section-render`);
  if(sectionEl){
    sectionEl.innerHTML = renderSectionHTML(sec);
    attachInlineEdits(sec, sectionEl, tplId);
  }
 
  // Update range val display
  if(el.type === 'range'){
    const valEl = el.parentElement?.querySelector('.range-val');
    if(valEl) valEl.textContent = val + (el.dataset.unit||'');
  }
};
 
/* ══════════════════════════════════════════════
   BUILD DESIGN PANEL PER TYPE
══════════════════════════════════════════════ */
function buildDesignPanel(sec, tplId){
  const d = getDesign(sec);
  const sid = sec.id;
 
  // Helper generators
  const colorRow = (label, field, val) => `
    <div class="color-swatch-item">
      <span class="color-swatch-label">${label}</span>
      <div class="color-input-wrap">
        <input type="color" class="native-color" value="${toHexSafe(val)}" data-field="${field}" data-sec-design="${sid}" oninput="designUpdate(this,'${sid}','${tplId}')"/>
        <input type="text" class="color-text-input" value="${val}" data-field="${field}" data-sec-design="${sid}" oninput="designUpdate(this,'${sid}','${tplId}')"/>
      </div>
    </div>`;
 
  const rangeRow = (label, field, val, min, max, unit='px') => `
    <div class="range-row">
      <label>${label}</label>
      <input type="range" min="${min}" max="${max}" value="${val}" data-field="${field}" data-unit="${unit}" data-sec-design="${sid}" oninput="designUpdate(this,'${sid}','${tplId}')"/>
      <span class="range-val">${val}${unit}</span>
    </div>`;
 
  const pillRow = (label, field, options, current) => `
    <div style="margin-bottom:.5rem;">
      <div style="font-size:.5625rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--slate-500);margin-bottom:.35rem;">${label}</div>
      <div class="layout-pills">
        ${options.map(([val, icon, lbl]) => `
          <div class="layout-pill ${current===val?'selected':''}" onclick="designPill(this,'${field}','${val}','${sid}','${tplId}')">
            ${icon} ${lbl}
          </div>`).join('')}
      </div>
    </div>`;
 
  const toggleRow = (label, field, val) => `
    <div class="design-toggle-row">
      <span class="design-toggle-label">${label}</span>
      <label class="toggle-mini">
        <input type="checkbox" ${val==='1'?'checked':''} data-field="${field}" data-sec-design="${sid}" onchange="designUpdate({value:this.checked?'1':'0',dataset:{field:'${field}',unit:''},type:'checkbox',parentElement:this.parentElement},'${sid}','${tplId}')"/>
        <span class="toggle-mini-slider"></span>
      </label>
    </div>`;
 
  switch(sec.type){
    case 'hero': return `
      <div class="design-group">
        <div class="design-group-title">Layout</div>
        ${pillRow('Disposición','layout',[
          ['split','<i class="fa-solid fa-table-columns"></i>','Lateral'],
          ['centered','<i class="fa-solid fa-align-center"></i>','Centrado'],
          ['full','<i class="fa-solid fa-expand"></i>','Full'],
        ], d.layout)}
        ${rangeRow('Padding vertical','paddingV',d.paddingV,20,160)}
        ${rangeRow('Padding horizontal','paddingH',d.paddingH,20,120)}
        ${toggleRow('Mostrar badge','showBadge',d.showBadge)}
        ${toggleRow('Mostrar estadísticas','showStats',d.showStats)}
      </div>
      <div class="design-group">
        <div class="design-group-title">Fondo</div>
        <div class="color-swatch-row">
          ${colorRow('Color inicio','bgFrom',d.bgFrom)}
          ${colorRow('Color fin','bgTo',d.bgTo)}
        </div>
        ${rangeRow('Ángulo gradiente','bgAngle',d.bgAngle,0,360,'°')}
      </div>
      <div class="design-group">
        <div class="design-group-title">Tipografía</div>
        <div class="color-swatch-row">
          ${colorRow('Título línea 1','h1Color',d.h1Color)}
          ${colorRow('Título línea 2','h2Color',d.h2Color)}
          ${colorRow('Descripción','descColor',d.descColor)}
        </div>
        ${rangeRow('Tamaño título','h1Size',d.h1Size,24,96)}
        ${rangeRow('Tamaño descripción','descSize',d.descSize,12,22)}
        ${toggleRow('Título en cursiva','h1Italic',d.h1Italic)}
      </div>
      <div class="design-group">
        <div class="design-group-title">Badge</div>
        <div class="color-swatch-row">
          ${colorRow('Fondo badge','badgeBg',d.badgeBg)}
          ${colorRow('Borde badge','badgeBorder',d.badgeBorder)}
          ${colorRow('Texto badge','badgeColor',d.badgeColor)}
        </div>
      </div>
      <div class="design-group">
        <div class="design-group-title">Botón Primario</div>
        <div class="color-swatch-row">
          ${colorRow('Fondo','btn1Bg',d.btn1Bg)}
          ${colorRow('Texto','btn1Color',d.btn1Color)}
        </div>
        ${rangeRow('Border radius','btn1Radius',d.btn1Radius,0,24)}
      </div>
      <div class="design-group">
        <div class="design-group-title">Botón Secundario</div>
        <div class="color-swatch-row">
          ${colorRow('Borde','btn2Border',d.btn2Border)}
          ${colorRow('Texto','btn2Color',d.btn2Color)}
        </div>
      </div>
      <div class="design-group">
        <div class="design-group-title">Estadísticas</div>
        <div class="color-swatch-row">
          ${colorRow('Fondo card','statBg',d.statBg)}
          ${colorRow('Borde card','statBorder',d.statBorder)}
          ${colorRow('Número','statNumColor',d.statNumColor)}
          ${colorRow('Etiqueta','statLblColor',d.statLblColor)}
        </div>
      </div>`;
 
    case 'hero-centered': return `
      <div class="design-group">
        <div class="design-group-title">Espaciado</div>
        ${rangeRow('Padding vertical','paddingV',d.paddingV,20,160)}
        ${rangeRow('Padding horizontal','paddingH',d.paddingH,20,120)}
        ${toggleRow('Mostrar badge','showBadge',d.showBadge)}
        ${toggleRow('Mostrar métricas','showMetrics',d.showMetrics)}
      </div>
      <div class="design-group">
        <div class="design-group-title">Fondo</div>
        <div class="color-swatch-row">
          ${colorRow('Color inicio','bgFrom',d.bgFrom)}
          ${colorRow('Color fin','bgTo',d.bgTo)}
        </div>
        ${rangeRow('Ángulo gradiente','bgAngle',d.bgAngle,0,360,'°')}
      </div>
      <div class="design-group">
        <div class="design-group-title">Tipografía</div>
        <div class="color-swatch-row">
          ${colorRow('Título','h1Color',d.h1Color)}
          ${colorRow('Descripción','descColor',d.descColor)}
        </div>
        ${rangeRow('Tamaño título','h1Size',d.h1Size,24,96)}
        ${toggleRow('Título en cursiva','h1Italic',d.h1Italic)}
      </div>
      <div class="design-group">
        <div class="design-group-title">Badge</div>
        <div class="color-swatch-row">
          ${colorRow('Fondo badge','badgeBg',d.badgeBg)}
          ${colorRow('Texto badge','badgeColor',d.badgeColor)}
        </div>
      </div>
      <div class="design-group">
        <div class="design-group-title">Botones</div>
        <div class="color-swatch-row">
          ${colorRow('Btn primario fondo','btn1Bg',d.btn1Bg)}
          ${colorRow('Btn primario texto','btn1Color',d.btn1Color)}
          ${colorRow('Btn secundario borde','btn2Border',d.btn2Border)}
          ${colorRow('Btn secundario texto','btn2Color',d.btn2Color)}
        </div>
      </div>
      <div class="design-group">
        <div class="design-group-title">Métricas</div>
        <div class="color-swatch-row">
          ${colorRow('Borde','metricBorder',d.metricBorder)}
          ${colorRow('Número','metricNumColor',d.metricNumColor)}
          ${colorRow('Etiqueta','metricLblColor',d.metricLblColor)}
        </div>
      </div>`;
 
    case 'nav': return `
      <div class="design-group">
        <div class="design-group-title">Fondo & Espaciado</div>
        <div class="color-swatch-row">${colorRow('Fondo nav','bg',d.bg)}</div>
        ${rangeRow('Padding vertical','paddingV',d.paddingV,4,40)}
        ${rangeRow('Padding horizontal','paddingH',d.paddingH,16,80)}
      </div>
      <div class="design-group">
        <div class="design-group-title">Colores</div>
        <div class="color-swatch-row">
          ${colorRow('Logo','logoColor',d.logoColor)}
          ${colorRow('Links','linkColor',d.linkColor)}
          ${colorRow('CTA fondo','ctaBg',d.ctaBg)}
          ${colorRow('CTA texto','ctaColor',d.ctaColor)}
        </div>
      </div>`;
 
    case 'services': return `
      <div class="design-group">
        <div class="design-group-title">Layout</div>
        ${pillRow('Columnas','cols',[
          ['2','','2 cols'],['3','','3 cols'],['4','','4 cols'],
        ], d.cols)}
        ${rangeRow('Padding vertical','paddingV',d.paddingV,20,120)}
        ${rangeRow('Padding horizontal','paddingH',d.paddingH,20,120)}
      </div>
      <div class="design-group">
        <div class="design-group-title">Colores</div>
        <div class="color-swatch-row">
          ${colorRow('Fondo sección','bg',d.bg)}
          ${colorRow('Eyebrow','eyebrowColor',d.eyebrowColor)}
          ${colorRow('Título','titleColor',d.titleColor)}
          ${colorRow('Fondo card','cardBg',d.cardBg)}
          ${colorRow('Borde card','cardBorder',d.cardBorder)}
          ${colorRow('Icono fondo','cardIconBg',d.cardIconBg)}
        </div>
      </div>`;
 
    case 'cta': return `
      <div class="design-group">
        <div class="design-group-title">Espaciado</div>
        ${rangeRow('Padding vertical','paddingV',d.paddingV,20,120)}
        ${rangeRow('Padding horizontal','paddingH',d.paddingH,20,120)}
      </div>
      <div class="design-group">
        <div class="design-group-title">Colores</div>
        <div class="color-swatch-row">
          ${colorRow('Fondo','bg',d.bg)}
          ${colorRow('Título','titleColor',d.titleColor)}
          ${colorRow('Descripción','descColor',d.descColor)}
          ${colorRow('Botón fondo','btnBg',d.btnBg)}
          ${colorRow('Botón texto','btnColor',d.btnColor)}
        </div>
      </div>`;
 
    case 'about': return `
      <div class="design-group">
        <div class="design-group-title">Espaciado</div>
        ${rangeRow('Padding vertical','paddingV',d.paddingV,20,120)}
        ${rangeRow('Padding horizontal','paddingH',d.paddingH,20,120)}
      </div>
      <div class="design-group">
        <div class="design-group-title">Colores</div>
        <div class="color-swatch-row">
          ${colorRow('Fondo','bg',d.bg)}
          ${colorRow('Eyebrow','eyebrowColor',d.eyebrowColor)}
          ${colorRow('Título','titleColor',d.titleColor)}
          ${colorRow('Descripción','descColor',d.descColor)}
          ${colorRow('Placeholder imagen','imageBg',d.imageBg)}
        </div>
      </div>`;
 
    case 'footer': return `
      <div class="design-group">
        <div class="design-group-title">Espaciado</div>
        ${rangeRow('Padding vertical','paddingV',d.paddingV,20,120)}
        ${rangeRow('Padding horizontal','paddingH',d.paddingH,20,120)}
      </div>
      <div class="design-group">
        <div class="design-group-title">Colores</div>
        <div class="color-swatch-row">
          ${colorRow('Fondo','bg',d.bg)}
          ${colorRow('Marca','brandColor',d.brandColor)}
          ${colorRow('Tagline','taglineColor',d.taglineColor)}
          ${colorRow('Links','linkColor',d.linkColor)}
          ${colorRow('Títulos cols','titleColor',d.titleColor)}
        </div>
      </div>`;
 
    case 'logos': return `
      <div class="design-group">
        <div class="design-group-title">Espaciado</div>
        ${rangeRow('Padding vertical','paddingV',d.paddingV,10,80)}
        ${rangeRow('Padding horizontal','paddingH',d.paddingH,20,120)}
      </div>
      <div class="design-group">
        <div class="design-group-title">Colores</div>
        <div class="color-swatch-row">
          ${colorRow('Fondo','bg',d.bg)}
          ${colorRow('Título','titleColor',d.titleColor)}
          ${colorRow('Pill fondo','pillBg',d.pillBg)}
          ${colorRow('Pill texto','pillColor',d.pillColor)}
        </div>
      </div>`;
 
    default: return `<div class="props-empty">Sin opciones de diseño para este módulo.</div>`;
  }
}
 
/* helper: convert any color string to #rrggbb for color input */
function toHexSafe(val){
  if(!val) return '#000000';
  if(/^#[0-9a-fA-F]{6}$/.test(val)) return val;
  if(/^#[0-9a-fA-F]{3}$/.test(val)){
    const [,r,g,b] = val.match(/#(.)(.)(.)/);
    return '#'+r+r+g+g+b+b;
  }
  // fallback for rgba / named
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = val;
  return ctx.fillStyle; // browser resolves to #rrggbb
}
 
window.designPill = function(el, field, val, secId, tplId){
  el.closest('.layout-pills').querySelectorAll('.layout-pill').forEach(p=>p.classList.remove('selected'));
  el.classList.add('selected');
  const tpl = state.templates.find(t=>t.id===tplId);
  if(!tpl) return;
  const sec = tpl.sections.find(s=>s.id===secId);
  if(!sec) return;
  if(!sec.design) sec.design = {};
  sec.design[field] = val;
  const sectionEl = document.querySelector(`.section-slot[data-sec-id="${secId}"] .section-render`);
  if(sectionEl){
    sectionEl.innerHTML = renderSectionHTML(sec);
    attachInlineEdits(sec, sectionEl, tplId);
  }
};
 
/* ══════════════════════════════════════════════
   PROPS PANEL (tabbed: Contenido + Diseño)
══════════════════════════════════════════════ */
function buildPropsPanel(secId, tpl){
  const panel = document.getElementById('props-panel-body');
  if(!panel) return;
  if(!secId){ panel.innerHTML = `<div class="props-empty">Hacé clic en una sección para editar sus propiedades</div>`; return; }
 
  const sec = tpl.sections.find(s=>s.id===secId);
  if(!sec){ panel.innerHTML = `<div class="props-empty">Sección no encontrada</div>`; return; }
 
  const d = sec.data || {};
  const typeInfo = SECTION_TYPES.flatMap(g=>g.items).find(i=>i.type===sec.type);
 
  // ── Content fields
  const fieldMap = {
    nav: [['logo','Logo/Marca',''],['links','Links (separados por coma)','textarea'],['cta','Texto botón CTA','']],
    hero: [['badge','Badge superior',''],['h1','Título línea 1',''],['h2','Título línea 2 (acento)',''],['desc','Descripción','textarea'],['btn1','Botón primario',''],['btn2','Botón secundario',''],['stat1_num','Estadística 1 — número',''],['stat1_lbl','Estadística 1 — etiqueta',''],['stat2_num','Estadística 2 — número',''],['stat2_lbl','Estadística 2 — etiqueta','']],
    'hero-centered': [['badge','Badge',''],['h1','Título','textarea'],['desc','Descripción','textarea'],['btn1','Botón primario',''],['btn2','Botón secundario',''],['m1_num','Métrica 1 — num',''],['m1_lbl','Métrica 1 — label',''],['m2_num','Métrica 2 — num',''],['m2_lbl','Métrica 2 — label',''],['m3_num','Métrica 3 — num',''],['m3_lbl','Métrica 3 — label','']],
    services: [['eyebrow','Eyebrow',''],['title','Título sección','']],
    logos: [['title','Título','']],
    news: [['eyebrow','Eyebrow',''],['title','Título sección','']],
    about: [['eyebrow','Eyebrow',''],['title','Título',''],['desc','Descripción','textarea']],
    cta: [['title','Título',''],['desc','Descripción',''],['btn','Texto botón','']],
    contact: [['eyebrow','Eyebrow',''],['title','Título',''],['cta_btn','Texto botón form','']],
    footer: [['brand','Nombre/Logo',''],['tagline','Tagline','']],
    spacer: [['height','Altura (px)','']],
  };
 
  const flds = fieldMap[sec.type] || [];
  const contentFields = flds.map(([key, label, inputType]) => {
    const val = (d[key]||'').replace(/"/g,'&quot;');
    if(inputType==='textarea'){
      return `<div class="props-field"><label class="props-label">${label}</label><textarea class="props-textarea" data-sec="${secId}" data-field="${key}" oninput="propsUpdate(this)">${d[key]||''}</textarea></div>`;
    }
    return `<div class="props-field"><label class="props-label">${label}</label><input class="props-input" value="${val}" data-sec="${secId}" data-field="${key}" oninput="propsUpdate(this)"/></div>`;
  }).join('');
 
  const designFields = buildDesignPanel(sec, tpl.id);
 
  // Remember active tab
  const activeTab = panel.dataset.activeTab || 'content';
 
  panel.innerHTML = `
    <div class="props-tabs">
      <button class="props-tab ${activeTab==='content'?'active':''}" onclick="switchPropsTab(this,'content')">Contenido</button>
      <button class="props-tab ${activeTab==='design'?'active':''}" onclick="switchPropsTab(this,'design')">Diseño</button>
    </div>
    <div style="padding:.75rem;">
      <div class="props-tab-content ${activeTab==='content'?'active':''}" id="props-tab-content">
        <div class="props-section">
          <div class="props-section-title" style="margin-bottom:.75rem;">${typeInfo?.label||sec.type}</div>
          ${contentFields||'<div style="font-size:.75rem;color:var(--slate-400);">Editá el contenido directamente en el canvas haciendo clic.</div>'}
        </div>
      </div>
      <div class="props-tab-content ${activeTab==='design'?'active':''}" id="props-tab-design">
        ${designFields}
      </div>
    </div>
  `;
}
 
window.switchPropsTab = function(btn, tab){
  const panel = document.getElementById('props-panel-body');
  if(panel) panel.dataset.activeTab = tab;
  btn.closest('.props-tabs').querySelectorAll('.props-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('props-tab-content')?.classList.toggle('active', tab==='content');
  document.getElementById('props-tab-design')?.classList.toggle('active', tab==='design');
};
 
window.propsUpdate = function(el){
  const secId = el.dataset.sec;
  const field = el.dataset.field;
  const tpl = state.templates.find(t=>t.id===state.currentTplId);
  if(!tpl) return;
  const sec = tpl.sections.find(s=>s.id===secId);
  if(!sec) return;
  sec.data[field] = el.value;
  scheduleAutoSave();
  // Re-render just this section's inner HTML
  const sectionEl = document.querySelector(`.section-slot[data-sec-id="${secId}"] .section-render`);
  if(sectionEl){
    const active = document.activeElement;
    sectionEl.innerHTML = renderSectionHTML(sec);
    attachInlineEdits(sec, sectionEl, tpl.id);
  }
};
 
/* ══════════════════════════════════════════════
   INLINE EDITING (contenteditable → state)
══════════════════════════════════════════════ */
function attachInlineEdits(sec, container, tplId){
  container.querySelectorAll('[contenteditable="true"]').forEach(el=>{
    el.addEventListener('focus', ()=>{
      // Suppress section click while editing
      el.dataset.editing = '1';
    });
    el.addEventListener('blur', ()=>{
      delete el.dataset.editing;
      const field = el.dataset.field;
      const sid = el.dataset.sec;
      const tpl = state.templates.find(t=>t.id===tplId);
      if(!tpl) return;
      const s = tpl.sections.find(s=>s.id===sid);
      if(!s) return;
      s.data[field] = el.innerText.trim();
      scheduleAutoSave();
      // Sync props panel
      const propEl = document.querySelector(`.props-input[data-sec="${sid}"][data-field="${field}"], .props-textarea[data-sec="${sid}"][data-field="${field}"]`);
      if(propEl) propEl.value = s.data[field];
    });
    // Prevent Enter creating block elements
    el.addEventListener('keydown', e=>{
      if(e.key==='Enter'){ e.preventDefault(); el.blur(); }
    });
  });
}
 
/* ══════════════════════════════════════════════
   OPEN TEMPLATE EDITOR
══════════════════════════════════════════════ */
function openTemplateEditor(tplId){
  const tpl = state.templates.find(t=>t.id===tplId);
  if(!tpl) return;
  try { sessionStorage.setItem('sisgra_panel', 'tpl-editor'); sessionStorage.setItem('sisgra_tpl', tplId); } catch(_){}
  state.selectedSectionId = null;
 
  showPanel('tpl-editor');
 
  document.querySelectorAll('.sidebar-tpl-item').forEach(i=>{
    i.classList.toggle('active', i.dataset.tplId===tplId);
  });
  document.getElementById('topbar-title').textContent = `Plantilla — ${tpl.name}`;
 
  const inner = document.getElementById('tpl-editor-inner');
  inner.innerHTML = `
    <!-- TOP BAR -->
    <div style="background:var(--white);border-bottom:1px solid var(--slate-200);padding:.75rem 1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:.75rem;">
        <span style="font-size:.5rem;font-weight:900;letter-spacing:.3em;text-transform:uppercase;background:var(--sisgra-blue);color:#fff;padding:.2rem .6rem;">Plantilla</span>
        <span id="tpl-editor-name" style="font-size:1rem;font-weight:900;color:var(--sisgra-blue);letter-spacing:-.03em;font-style:italic;">${tpl.name}</span>
        <button type="button" title="Renombrar plantilla" onclick="renameTpl('${tpl.id}')" style="background:none;border:1px solid var(--slate-200);color:var(--slate-400);padding:.25rem .5rem;font-size:.6rem;cursor:pointer;line-height:1;" onmouseover="this.style.color='var(--slate-700)'" onmouseout="this.style.color='var(--slate-400)'">✎ Renombrar</button>
        <span style="font-size:.5rem;font-weight:900;letter-spacing:.2em;text-transform:uppercase;padding:.2rem .6rem;${tpl.status==='active'?'background:#dcfce7;color:#166534;':'background:#fef3c7;color:#92400e;'}">${tpl.status==='active'?'Activa':'Borrador'}</span>
      </div>
      <div style="display:flex;align-items:center;gap:.75rem;">
        <!-- Viewport toggle -->
        <div class="viewport-switch">
          <button class="vp-btn ${state.viewport==='desktop'?'active':''}" onclick="setViewport('desktop')">🖥 Escritorio</button>
          <button class="vp-btn ${state.viewport==='tablet'?'active':''}" onclick="setViewport('tablet')">⬜ Tablet</button>
          <button class="vp-btn ${state.viewport==='mobile'?'active':''}" onclick="setViewport('mobile')">📱 Móvil</button>
        </div>
        ${tpl.status!=='active'?`<button class="btn-secondary" style="font-size:.5625rem;" onclick="setActiveTpl('${tpl.id}')">Activar</button>`:''}
        <button class="btn-save" onclick="saveTpl('${tpl.id}')">Guardar plantilla</button>
      </div>
    </div>
 
    <!-- EDITOR SHELL -->
    <div class="editor-shell" id="editor-shell">
 
      <!-- LEFT: section tray -->
      <div class="section-tray">
        <div class="tray-header">Módulos</div>
        <input class="tray-search" id="tray-search" placeholder="Buscar sección..."/>
        <div class="tray-body" id="tray-body">
          ${SECTION_TYPES.map(group=>`
            <div class="tray-group-label">${group.group}</div>
            ${group.items.map(item=>`
              <div class="tray-chip" draggable="true" data-stype="${item.type}" id="chip-${item.type}">
                <div class="tray-chip-thumb">${item.icon}</div>
                <div class="tray-chip-info">
                  <div class="tray-chip-name">${item.label}</div>
                  <div class="tray-chip-desc">${item.desc}</div>
                </div>
              </div>
            `).join('')}
          `).join('')}
        </div>
      </div>
 
      <!-- CENTER: page canvas -->
      <div class="page-canvas-wrap">
        <div class="canvas-ruler">
          <span class="ruler-label">Vista previa de página</span>
          <span class="ruler-px" id="vp-label">1200px — Escritorio</span>
          <span class="ruler-label">· Hacé clic en una sección para seleccionarla · Arrastrá para reordenar</span>
        </div>
        <div class="canvas-scroll">
          <div class="page-frame ${state.viewport}" id="page-frame">
            <div class="page-sections" id="page-sections">
              <!-- Sections rendered here -->
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
 
  renderPageSections(tplId);
  initTrayDragDrop(tplId);
  initTraySearch();
}
 
/* ══════════════════════════════════════════════
   RENDER PAGE SECTIONS
══════════════════════════════════════════════ */
function renderPageSections(tplId){
  const tpl = state.templates.find(t=>t.id===tplId);
  const container = document.getElementById('page-sections');
  if(!container||!tpl) return;
 
  if(tpl.sections.length===0){
    container.innerHTML = `
      <div class="canvas-empty-state">
        <i class="fa-solid fa-plus"></i>
        <p>Arrastrá secciones desde el panel izquierdo<br>para construir tu página</p>
      </div>`;
    return;
  }
 
  container.innerHTML = tpl.sections.map((sec, idx) => `
    <div class="section-slot ${state.selectedSectionId===sec.id?'selected-section':''} ${sec.locked?'locked-section':''}" data-sec-id="${sec.id}" data-index="${idx}">
      ${sec.locked ? `<div style="position:absolute;top:.3rem;left:.3rem;z-index:10;font-size:.45rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase;background:rgba(100,116,139,.7);color:#fff;padding:.15rem .4rem;">FIJO — gestionado desde Contacto</div>` : `
      <div class="section-controls">
        <button class="sc-btn drag-handle" title="Mover sección" data-sec-id="${sec.id}">⠿</button>
        <button class="sc-btn" title="Subir" onclick="moveSectionUp('${tplId}','${sec.id}')">↑</button>
        <button class="sc-btn" title="Bajar" onclick="moveSectionDown('${tplId}','${sec.id}')">↓</button>
        <button class="sc-btn" title="Duplicar" onclick="duplicateSection('${tplId}','${sec.id}')">⧉</button>
        <button class="sc-btn del" title="Eliminar sección" onclick="removeSection('${tplId}','${sec.id}')">✕</button>
      </div>`}
      <div class="section-render">${renderSectionHTML(sec)}</div>
    </div>
  `).join('');
 
  // Attach inline editing and section selection
  tpl.sections.forEach(sec=>{
    const slot = container.querySelector(`.section-slot[data-sec-id="${sec.id}"]`);
    if(!slot) return;
    const render = slot.querySelector('.section-render');
    attachInlineEdits(sec, render, tplId);
 
    // Click to select section
    slot.addEventListener('click', e=>{
      // Don't trigger if locked, clicking controls or editing
      if(sec.locked) return;
      if(e.target.closest('.section-controls')) return;
      if(e.target.dataset.editing) return;
 
      state.selectedSectionId = sec.id;
      // Highlight
      document.querySelectorAll('.section-slot').forEach(s=>s.classList.remove('selected-section'));
      slot.classList.add('selected-section');
      // Load props
      const typeLabel = SECTION_TYPES.flatMap(g=>g.items).find(i=>i.type===sec.type)?.label||sec.type;
      const ptEl = document.getElementById('props-section-type');
      if(ptEl) ptEl.textContent = typeLabel;
      buildPropsPanel(sec.id, tpl);
    });
  });
 
  // Init drag-reorder on section handles
  initSectionReorder(tplId);
}
 
/* ══════════════════════════════════════════════
   SECTION REORDER (drag handle)
══════════════════════════════════════════════ */
let dragReorderSrcId = null;
 
function initSectionReorder(tplId){
  const container = document.getElementById('page-sections');
  if(!container) return;
  const tpl = state.templates.find(t=>t.id===tplId);
 
  container.querySelectorAll('.sc-btn.drag-handle').forEach(handle=>{
    const slot = handle.closest('.section-slot');
    slot.setAttribute('draggable','true');
 
    slot.addEventListener('dragstart', e=>{
      if(!e.target.closest('.drag-handle')) { e.preventDefault(); return; }
      dragReorderSrcId = slot.dataset.secId;
      slot.classList.add('being-dragged');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'reorder');
    });
 
    slot.addEventListener('dragend', ()=>{
      slot.classList.remove('being-dragged');
      document.querySelectorAll('.section-slot').forEach(s=>{
        s.classList.remove('drag-target');
      });
      dragReorderSrcId = null;
    });
 
    slot.addEventListener('dragover', e=>{
      e.preventDefault();
      if(!dragReorderSrcId || dragReorderSrcId===slot.dataset.secId) return;
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.section-slot').forEach(s=>s.classList.remove('drag-target'));
      slot.classList.add('drag-target');
    });
 
    slot.addEventListener('dragleave', ()=>{ slot.classList.remove('drag-target'); });
 
    slot.addEventListener('drop', e=>{
      e.preventDefault();
      slot.classList.remove('drag-target');
      const toId = slot.dataset.secId;
      if(!dragReorderSrcId || dragReorderSrcId===toId) return;
      const fromIdx = tpl.sections.findIndex(s=>s.id===dragReorderSrcId);
      const toIdx   = tpl.sections.findIndex(s=>s.id===toId);
      const [moved] = tpl.sections.splice(fromIdx,1);
      tpl.sections.splice(toIdx,0,moved);
      renderPageSections(tplId);
      if(state.selectedSectionId) buildPropsPanel(state.selectedSectionId, tpl);
    });
  });
}
 
/* ══════════════════════════════════════════════
   SECTION OPERATIONS
══════════════════════════════════════════════ */
window.moveSectionUp = function(tplId, secId){
  const tpl = state.templates.find(t=>t.id===tplId);
  const idx = tpl.sections.findIndex(s=>s.id===secId);
  if(idx<=0) return;
  [tpl.sections[idx-1], tpl.sections[idx]] = [tpl.sections[idx], tpl.sections[idx-1]];
  renderPageSections(tplId);
};
 
window.moveSectionDown = function(tplId, secId){
  const tpl = state.templates.find(t=>t.id===tplId);
  const idx = tpl.sections.findIndex(s=>s.id===secId);
  if(idx>=tpl.sections.length-1) return;
  [tpl.sections[idx], tpl.sections[idx+1]] = [tpl.sections[idx+1], tpl.sections[idx]];
  renderPageSections(tplId);
};
 
window.duplicateSection = function(tplId, secId){
  const tpl = state.templates.find(t=>t.id===tplId);
  const idx = tpl.sections.findIndex(s=>s.id===secId);
  const original = tpl.sections[idx];
  const copy = { ...original, id: uid(), data: { ...original.data } };
  tpl.sections.splice(idx+1, 0, copy);
  renderPageSections(tplId);
  showNotif('✓ Sección duplicada');
};
 
window.removeSection = function(tplId, secId){
  const tpl = state.templates.find(t=>t.id===tplId);
  tpl.sections = tpl.sections.filter(s=>s.id!==secId);
  if(state.selectedSectionId===secId) state.selectedSectionId=null;
  renderPageSections(tplId);
  buildPropsPanel(null, tpl);
  showNotif('✓ Sección eliminada');
};
 
// Returns val if defined and non-empty, otherwise falls back to fallback
function _sv(val, fallback){ return (val !== undefined && val !== '') ? val : (fallback || ''); }

window.saveTpl = async function(id){
  const tpl = state.templates.find(t=>t.id===id);
  if(!tpl){ showNotif('Plantilla no encontrada','error'); return; }
  try {
    const heroSec     = tpl.sections.find(s=>s.type==='hero'||s.type==='hero-centered');
    const aboutSec    = tpl.sections.find(s=>s.type==='about');
    const logosSec    = tpl.sections.find(s=>s.type==='logos');
    const newsSec     = tpl.sections.find(s=>s.type==='news');
    const servicesSec = tpl.sections.find(s=>s.type==='services');
    const jobs = [];

    if(heroSec){
      const cur = await apiGet('/data/hero').catch(()=>({}));
      jobs.push(apiPut('/data/hero', heroSectionToHeroJson(heroSec, cur||{})));
    }
    if(aboutSec){
      const d = aboutSec.data||{};
      const cur = await apiGet('/data/nosotros').catch(()=>({}));
      const c = cur||{};
      // Only override fields that have been explicitly set in the editor
      jobs.push(apiPut('/data/nosotros', {
        ...c,
        eyebrow:     _sv(d.eyebrow,     c.eyebrow),
        titulo:      _sv(d.title,        c.titulo),
        descripcion: _sv(d.desc,         c.descripcion),
      }));
    }
    if(logosSec){
      const d = logosSec.data||{};
      const base = state.clientes||{};
      jobs.push(apiPut('/data/clientes', { ...base, titulo_seccion: _sv(d.title, base.titulo_seccion) }));
    }
    if(newsSec){
      const d = newsSec.data||{};
      const base = state.blog||{};
      jobs.push(apiPut('/data/blog', { ...base, titulo_seccion: _sv(d.title, base.titulo_seccion) }));
    }
    if(servicesSec){
      const d = servicesSec.data||{};
      const base = state.servicios||{};
      jobs.push(apiPut('/data/servicios', {
        ...base,
        titulo_seccion: _sv(d.title,   base.titulo_seccion),
        eyebrow:        _sv(d.eyebrow, base.eyebrow),
      }));
    }

    // Save extra sections (cta, spacer, etc.) not covered by dedicated JSON files
    const CORE_TYPES = new Set(['hero','hero-centered','about','logos','news','services','contact','footer','nav']);
    const extraSecs = tpl.sections.filter(s => !CORE_TYPES.has(s.type) && !s.locked);
    jobs.push(apiPut('/data/extra_sections', { sections: extraSecs.map(s=>({type:s.type,data:s.data||{}})) }));

    await Promise.all(jobs);
    showNotif('✓ Guardado — cambios reflejados en index.html');
  } catch(e){
    showNotif('Error al guardar: '+(e.message||'error'),'error');
  }
};
 
/* ══════════════════════════════════════════════
   VIEWPORT SWITCH
══════════════════════════════════════════════ */
window.setViewport = function(vp){
  state.viewport = vp;
  const frame = document.getElementById('page-frame');
  if(!frame) return;
  frame.className = `page-frame ${vp}`;
  // Update buttons
  document.querySelectorAll('.vp-btn').forEach(b=>{
    b.classList.toggle('active', b.textContent.toLowerCase().includes(vp==='desktop'?'escr':vp==='tablet'?'tab':'móv'));
  });
  const labels = { desktop:'1200px — Escritorio', tablet:'768px — Tablet', mobile:'375px — Móvil' };
  const lbl = document.getElementById('vp-label');
  if(lbl) lbl.textContent = labels[vp]||'';
};
 
/* ══════════════════════════════════════════════
   TRAY DRAG DROP (add new section to page)
══════════════════════════════════════════════ */
let dragNewType = null;
 
function initTrayDragDrop(tplId){
  const trayBody = document.getElementById('tray-body');
  const pageFrame = document.getElementById('page-frame');
  const tpl = state.templates.find(t=>t.id===tplId);
 
  // Also allow double-click to append
  trayBody.querySelectorAll('.tray-chip').forEach(chip=>{
    chip.addEventListener('dragstart', e=>{
      dragNewType = chip.dataset.stype;
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', 'new-section');
    });
    chip.addEventListener('dragend', ()=>{
      chip.classList.remove('dragging');
      dragNewType = null;
    });
    chip.addEventListener('dblclick', ()=>{
      addSectionToTemplate(tplId, chip.dataset.stype, null);
    });
  });
 
  // Page sections as drop target
  const pageSecContainer = document.getElementById('page-sections');
  if(!pageSecContainer) return;
 
  pageSecContainer.addEventListener('dragover', e=>{
    if(!dragNewType) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    pageSecContainer.style.outline = '3px dashed #60a5fa';
  });
  pageSecContainer.addEventListener('dragleave', e=>{
    if(!pageSecContainer.contains(e.relatedTarget)) pageSecContainer.style.outline='';
  });
  pageSecContainer.addEventListener('drop', e=>{
    e.preventDefault();
    pageSecContainer.style.outline='';
    if(!dragNewType) return;
    // Determine insertion point
    const target = e.target.closest('.section-slot');
    const insertBeforeId = target ? target.dataset.secId : null;
    addSectionToTemplate(tplId, dragNewType, insertBeforeId);
    dragNewType = null;
  });
}
 
function addSectionToTemplate(tplId, type, insertBeforeId){
  const tpl = state.templates.find(t=>t.id===tplId);
  const newSec = {
    id: uid(),
    type,
    data: getDefaultData(type),
  };
  if(insertBeforeId){
    const idx = tpl.sections.findIndex(s=>s.id===insertBeforeId);
    tpl.sections.splice(idx,0,newSec);
  } else {
    tpl.sections.push(newSec);
  }
  renderPageSections(tplId);
  // Auto-select new section
  state.selectedSectionId = newSec.id;
  const tplRef = state.templates.find(t=>t.id===tplId);
  buildPropsPanel(newSec.id, tplRef);
  showNotif('✓ Sección agregada');
}
 
function getDefaultData(type){
  const defaults = {
    nav: { logo:'SISGRA', links:'Servicios, Nosotros, Blog, Contacto', cta:'Contactar' },
    hero: { badge:'Infraestructura de Elite', h1:'Título Principal', h2:'Subtítulo en Acento', desc:'Descripción del hero. Editá este texto haciendo clic directamente sobre él.', btn1:'Ver Soluciones', btn2:'Conocer más', stat1_num:'+25', stat1_lbl:'Años de experiencia', stat2_num:'+500', stat2_lbl:'Clientes activos' },
    'hero-centered': { badge:'25 años de confianza', h1:'Título centrado del hero.', desc:'Descripción del hero centrado. Editá haciendo clic.', btn1:'Solicitar presupuesto', btn2:'Ver proyectos', m1_num:'+500', m1_lbl:'Clientes activos', m2_num:'99.9%', m2_lbl:'Disponibilidad', m3_num:'25+', m3_lbl:'Años experiencia' },
    services: { eyebrow:'Lo que hacemos', title:'Nuestros Servicios' },
    logos: { title:'Empresas que confían en nosotros' },
    news: { eyebrow:'Blog corporativo', title:'Últimas Noticias' },
    about: { eyebrow:'Quiénes somos', title:'Más de 25 años de trayectoria', desc:'Descripción de la empresa...' },
    cta: { title:'¿Listo para optimizar tu infraestructura?', desc:'Contactanos hoy y recibí una consulta sin costo.', btn:'Solicitar presupuesto' },
    contact: { eyebrow:'Contacto', title:'Hablemos de tu proyecto', cta_btn:'Enviar mensaje' },
    footer: { brand:'SISGRA', tagline:'Infraestructura tecnológica para empresas líderes.' },
    spacer: { height:60 },
  };
  return defaults[type] || {};
}
 
/* ══════════════════════════════════════════════
   TRAY SEARCH
══════════════════════════════════════════════ */
function initTraySearch(){
  const input = document.getElementById('tray-search');
  if(!input) return;
  input.addEventListener('input', ()=>{
    const q = input.value.toLowerCase();
    document.querySelectorAll('.tray-chip').forEach(chip=>{
      const name = chip.querySelector('.tray-chip-name')?.textContent.toLowerCase()||'';
      const desc = chip.querySelector('.tray-chip-desc')?.textContent.toLowerCase()||'';
      chip.style.display = (name+desc).includes(q)?'':'none';
    });
    document.querySelectorAll('.tray-group-label').forEach(lbl=>{
      // Hide label if all chips in group are hidden
      let next = lbl.nextElementSibling;
      let anyVisible = false;
      while(next && !next.classList.contains('tray-group-label')){
        if(next.style.display!=='none') anyVisible=true;
        next = next.nextElementSibling;
      }
      lbl.style.display = anyVisible?'':'none';
    });
  });
}
 
/* ══════════════════════════════════════════════
   SELECTED SECTION HIGHLIGHT STYLE
══════════════════════════════════════════════ */
const selectedStyle = document.createElement('style');
selectedStyle.textContent = `
  .section-slot { outline: 2px solid transparent; outline-offset: 0; transition: outline-color .15s; position: relative; }
  .section-slot:hover { outline: 2px dashed #cbd5e1; }
  .section-slot.selected-section { outline: 2px solid #3b82f6 !important; }
`;
document.head.appendChild(selectedStyle);
 
/* ══════════════════════════════════════════════
   CREATE TEMPLATE
══════════════════════════════════════════════ */
function handleCreateTemplate(){
  const name   = document.getElementById('np-name').value.trim();
  const desc   = document.getElementById('np-desc').value.trim();
  const status = document.getElementById('np-status').value;
  if(!name){ showNotif('El nombre es requerido','error'); return; }
  if(status==='active') state.templates.forEach(t=>t.status='draft');
  const newTpl = {
    id: 'tpl-' + uid(),
    name, desc: desc||'Plantilla personalizada', status,
    sections: [
      { id: uid(), type: 'nav', data: getDefaultData('nav') },
    ]
  };
  state.templates.push(newTpl);
  closeModal('modal-nueva-plantilla');
  document.getElementById('np-name').value='';
  document.getElementById('np-desc').value='';
  renderSidebarTemplates();
  renderTemplateOverview();
  showNotif('✓ Plantilla creada');
  state.currentTplId = newTpl.id;
  renderSidebarTemplates();
  openTemplateEditor(newTpl.id);
}
 
 
async function saveCurrentPanel(){
  const active = document.querySelector('.panel.active')?.id?.replace('panel-','');
  if(active==='clientes'){
    const d = { ...(state.clientes||{}) };
    d.carrusel_activo = document.getElementById('clientes-carrusel')?.checked ?? !!d.carrusel_activo;
    const r = await apiPut('/data/clientes', d);
    if(r?.data) state.clientes = r.data;
    return showNotif('✓ Clientes guardado');
  }
  if(active==='contacto'){
    const d = { ...(state.contacto||{}) };
    d.direccion = document.getElementById('contacto-direccion')?.value || d.direccion || '';
    d.telefono  = document.getElementById('contacto-telefono')?.value  || d.telefono  || '';
    d.email     = document.getElementById('contacto-email')?.value     || d.email     || '';
    d.whatsapp  = document.getElementById('contacto-whatsapp')?.value  || d.whatsapp  || '';
    const r = await apiPut('/data/contacto', d);
    if(r?.data) state.contacto = r.data;
    return showNotif('✓ Contacto guardado');
  }
  if(active==='seo'){
    const d = { ...(state.seo||{}) };
    SEO_PAGES.forEach(page=>{
      const t = document.getElementById(`seo-title-${page}`);
      const s = document.getElementById(`seo-desc-${page}`);
      if(t) seoData[page] = {...(seoData[page]||{}), title:t.value};
      if(s) seoData[page] = {...(seoData[page]||{}), description:s.value};
      d[page] = { ...(d[page]||{}), ...(seoData[page]||{}) };
    });
    const r = await apiPut('/data/seo', d);
    if(r?.data) state.seo = r.data;
    return showNotif('✓ SEO guardado');
  }
  showNotif('Sin cambios para guardar en este panel');
}
 
function renderBlogList(){
  const list = document.getElementById('blog-list');
  if(!list) return;
  const posts = state.blog?.posts || [];
  list.innerHTML = posts.map(p=>`
    <div class="blog-item">
      <div class="blog-info">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem;">
          <div class="blog-title-text">${p.titulo||''}</div>
          <span style="font-size:.45rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase;padding:.15rem .4rem;${p.estado==='publicado'?'background:#dcfce7;color:#166534;':'background:#fef3c7;color:#92400e;'}">${p.estado==='publicado'?'Publicado':'Borrador'}</span>
        </div>
        <div class="blog-meta">${p.fecha||''} · ${p.categoria||''}</div>
        <div class="blog-excerpt">${p.extracto||''}</div>
      </div>
      <div class="blog-actions">
        <button type="button" class="btn-edit-small" onclick="editPost('${p.id}')">Editar</button>
        <button type="button" class="btn-edit-small" style="color:var(--red-400);border-color:var(--red-400);" onclick="deletePost('${p.id}')">Eliminar</button>
      </div>
    </div>`).join('');
}
 
function openNewPost(){
  state.editingPostId = null;
  const mt = document.getElementById('modal-blog')?.querySelector('.modal-title'); if(mt) mt.textContent = 'Nuevo artículo';
  const t = document.getElementById('b-title'); if(t) t.value='';
  const f = document.getElementById('b-fecha'); if(f) f.value = new Date().toISOString().split('T')[0];
  const ex = document.getElementById('b-extracto'); if(ex) ex.value='';
  const img = document.getElementById('b-img'); if(img) img.value='';
  const c = document.getElementById('b-content'); if(c) c.innerHTML='';
  const e = document.getElementById('b-estado'); if(e) e.value='borrador';
  updateImgPreview('b-img','b-img-preview');
  openModal('modal-blog');
}
window.openNewPost = openNewPost;
window.renderBlogList = renderBlogList;
window.editPost = function(id){
  const p = (state.blog?.posts||[]).find(x=>x.id===id); if(!p) return;
  state.editingPostId = id;
  const mt = document.getElementById('modal-blog')?.querySelector('.modal-title'); if(mt) mt.textContent = 'Editar artículo';
  const t = document.getElementById('b-title'); if(t) t.value=p.titulo||'';
  const f = document.getElementById('b-fecha'); if(f) f.value=p.fecha||'';
  const ex = document.getElementById('b-extracto'); if(ex) ex.value=p.extracto||'';
  const img = document.getElementById('b-img'); if(img) img.value=p.imagen||'';
  const c = document.getElementById('b-content'); if(c) c.innerHTML=p.contenido||'';
  const cat = document.getElementById('b-categoria'); if(cat) cat.value=p.categoria||'Infraestructura';
  const e = document.getElementById('b-estado'); if(e) e.value=p.estado||'borrador';
  updateImgPreview('b-img','b-img-preview');
  openModal('modal-blog');
}
window.deletePost = async function(id){
  if(!confirm('¿Eliminar este artículo?')) return;
  await apiDelete('/data/blog/posts/'+id);
  state.blog.posts = (state.blog.posts||[]).filter(x=>x.id!==id);
  renderBlogList();
  showNotif('✓ Artículo eliminado');
}
async function saveBlogPost(){
  const item={titulo:document.getElementById('b-title').value.trim(),categoria:document.getElementById('b-categoria').value,estado:document.getElementById('b-estado').value,fecha:document.getElementById('b-fecha').value,extracto:document.getElementById('b-extracto').value.trim(),contenido:document.getElementById('b-content').innerHTML,imagen:document.getElementById('b-img').value.trim()};
  if(!item.titulo) return showNotif('El título es requerido','error');
  if(!item.imagen) return showNotif('La imagen de portada es obligatoria','error');
  if(state.editingPostId){ await apiPatch('/data/blog/posts/'+state.editingPostId,item); const i=state.blog.posts.findIndex(x=>x.id===state.editingPostId); if(i>-1) state.blog.posts[i]={...state.blog.posts[i],...item}; }
  else { const r=await apiPost('/data/blog/posts',item); state.blog.posts = state.blog.posts||[]; state.blog.posts.unshift(r.item); }
  closeModal('modal-blog'); renderBlogList(); showNotif('✓ Artículo guardado');
}
 
/* ══════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════ */
function doLogin(){
  const u = document.getElementById('l-user').value.trim();
  const p = document.getElementById('l-pass').value.trim();
  const err = document.getElementById('login-error');
  fetch(`http://${window.location.hostname}:3000/api/auth/login`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({usuario:u,password:p})
  }).then(async r=>{
    const data = await r.json().catch(()=>({}));
    if(!r.ok || !data.token) throw new Error(data.error||'Usuario o contraseña incorrectos.');
    window.__svc?.setAuthToken(data.token);
    err.style.display='none';
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app').style.display='block';
    initApp();
  }).catch(()=>{
    err.style.display='block';
  });
}
 
/* ══════════════════════════════════════════════
   HERO ↔ HERO.JSON MAPPERS
══════════════════════════════════════════════ */
function heroSectionToHeroJson(sec, base){
  const d=sec.data||{};
  if(sec.type==='hero') return {...base,plantilla:'1',badge:d.badge||'',titulo1:d.h1||'',titulo2:d.h2||'',descripcion:d.desc||'',boton_primario:d.btn1||'',boton_secundario:d.btn2||'',stat1_numero:d.stat1_num||'',stat1_label:d.stat1_lbl||'',stat2_numero:d.stat2_num||'',stat2_label:d.stat2_lbl||''};
  if(sec.type==='hero-centered') return {...base,plantilla:'2',p2_eyebrow:d.badge||'',p2_titulo:d.h1||'',p2_descripcion:d.desc||'',p2_boton_primario:d.btn1||'',p2_boton_secundario:d.btn2||'',p2_metric1_num:d.m1_num||'',p2_metric1_label:d.m1_lbl||'',p2_metric2_num:d.m2_num||'',p2_metric2_label:d.m2_lbl||'',p2_metric3_num:d.m3_num||'',p2_metric3_label:d.m3_lbl||''};
  return base;
}
function heroJsonToSectionData(h){
  return {
    p1:{badge:h.badge||'',h1:h.titulo1||'',h2:h.titulo2||'',desc:h.descripcion||'',btn1:h.boton_primario||'',btn2:h.boton_secundario||'',stat1_num:h.stat1_numero||'',stat1_lbl:h.stat1_label||'',stat2_num:h.stat2_numero||'',stat2_lbl:h.stat2_label||''},
    p2:{badge:h.p2_eyebrow||'',h1:h.p2_titulo||'',desc:h.p2_descripcion||'',btn1:h.p2_boton_primario||'',btn2:h.p2_boton_secundario||'',m1_num:h.p2_metric1_num||'',m1_lbl:h.p2_metric1_label||'',m2_num:h.p2_metric2_num||'',m2_lbl:h.p2_metric2_label||'',m3_num:h.p2_metric3_num||'',m3_lbl:h.p2_metric3_label||''},
    plantilla:h.plantilla||'1',
  };
}

/* ══════════════════════════════════════════════
   SEO
══════════════════════════════════════════════ */
// Las pestañas de SEO se generan dinámicamente desde las plantillas existentes
// (ver buildSeoTabs). La clave SEO de cada página = su `tipo` de plantilla, con
// index→home (igual que el resolutor del sitio público en page-bootstrap.js).
const SEO_LABELS = { home:'Inicio', blog:'Blog', articulo:'Artículo', cableado:'Cableado', fibra:'Fibra Óptica', seguridad:'Seguridad', soporte:'Soporte IT', desarrollo:'Desarrollo', cliente:'Clientes' };
const SEO_ORDER  = ['home','cableado','fibra','seguridad','soporte','desarrollo','blog','articulo','cliente'];
const seoKeyForTipo = (tipo) => tipo === 'index' ? 'home' : tipo;
let SEO_PAGES = ['home'];   // se completa en buildSeoTabs() desde /plantillas
const seoData = {};
SEO_PAGES.forEach(p=>{ seoData[p]={title:'',description:''}; });
 
// Genera las pestañas de SEO a partir de las plantillas que existen ahora mismo:
// una pestaña por página (tipo de plantilla, deduplicado). Así aparece la pestaña
// de una plantilla nueva y desaparece la de una que se borró. Se llama al cargar y
// cada vez que se entra al panel SEO (showPanel('seo')).
async function buildSeoTabs(){
  const tabsEl = document.getElementById('seo-tabs');
  if(!tabsEl) return;
  const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  let plantillas = [];
  try { const r = await apiGet('/plantillas'); plantillas = r?.plantillas || []; } catch(_){}

  const keys = [];
  const labels = {};
  plantillas.forEach(p => {
    const key = seoKeyForTipo(p.tipo);
    if(!key || keys.includes(key)) return;
    keys.push(key);
    labels[key] = SEO_LABELS[key] || p.nombre || key;
  });
  // La home existe siempre, aunque por algún motivo no viniera en la lista.
  if(!keys.includes('home')){ keys.unshift('home'); labels.home = SEO_LABELS.home; }
  // Orden: páginas conocidas primero (SEO_ORDER), luego las custom alfabéticas.
  keys.sort((a,b)=>{
    const ia = SEO_ORDER.indexOf(a), ib = SEO_ORDER.indexOf(b);
    if(ia!==-1 && ib!==-1) return ia-ib;
    if(ia!==-1) return -1;
    if(ib!==-1) return 1;
    return a.localeCompare(b);
  });

  SEO_PAGES = keys;
  // Sembrar seoData de cada clave con los valores guardados (state.seo).
  keys.forEach(k => { seoData[k] = { title: state.seo?.[k]?.title || seoData[k]?.title || '', description: state.seo?.[k]?.description || seoData[k]?.description || '' }; });

  // Conservar la pestaña activa si sigue existiendo; si no, la primera.
  const prev = document.querySelector('#seo-tabs .tab-item.active')?.dataset.seo;
  const active = keys.includes(prev) ? prev : keys[0];

  tabsEl.innerHTML = keys.map(k => `<div class="tab-item ${k===active?'active':''}" data-seo="${esc(k)}">${esc(labels[k])}</div>`).join('');
  tabsEl.querySelectorAll('.tab-item').forEach(tab=>{
    tab.addEventListener('click',()=>{
      tabsEl.querySelectorAll('.tab-item').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      renderSEOTab(tab.dataset.seo);
    });
  });
  renderSEOTab(active);
}

function renderSEOTab(page){
  const c = document.getElementById('seo-tabs-content');
  const d = seoData[page]||{};
  // Encabezado = etiqueta amigable de la pestaña (ej. "Plantilla TEST", "Fibra Óptica")
  // en vez de la clave cruda capitalizada ("Btn-8", "Fibra").
  const escH = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const label = document.querySelector(`#seo-tabs .tab-item[data-seo="${page}"]`)?.textContent?.trim() || (page.charAt(0).toUpperCase()+page.slice(1));
  c.innerHTML = `
    <div class="section-card">
      <div class="section-card-header"><span class="section-card-title">${escH(label)} — SEO</span></div>
      <div class="section-card-body">
        <div class="form-row"><div class="form-group">
          <label class="form-label">&lt;title&gt;</label>
          <input class="form-input" id="seo-title-${page}" value="${d.title||''}" placeholder="Título de la página"/>
          <div class="form-hint">Máx. 60 caracteres</div>
        </div></div>
        <div class="form-row"><div class="form-group">
          <label class="form-label">Meta description</label>
          <textarea class="form-textarea" id="seo-desc-${page}" style="min-height:60px;" placeholder="Descripción para buscadores...">${d.description||''}</textarea>
          <div class="form-hint">Máx. 160 caracteres</div>
        </div></div>
      </div>
    </div>`;
}
 
/* ══════════════════════════════════════════════
   CANVAS REFRESH
══════════════════════════════════════════════ */
function refreshCanvas(){
  if(document.getElementById('panel-tpl-editor')?.classList.contains('active') && state.currentTplId){
    renderPageSections(state.currentTplId);
  }
}

/* ══════════════════════════════════════════════
   CLIENTS LIST + SAVE
══════════════════════════════════════════════ */
function renderClientesList(){
  const tbody = document.getElementById('clientes-tbody');
  if(!tbody) return;
  const list = state.clientes?.clientes || [];
  tbody.innerHTML = list.map(c=>{
    const carruselBadge = c.activo!==false
      ? 'background:#dcfce7;color:#166534;'
      : 'background:#fee2e2;color:#991b1b;';
    const perfilBadge = c.estado_perfil==='publicado'
      ? 'background:#dbeafe;color:#1e40af;'
      : 'background:#fef3c7;color:#92400e;';
    const perfilLabel = c.estado_perfil==='publicado' ? 'Publicado' : 'Borrador';
    const verLink = c.estado_perfil==='publicado'
      ? `<a href="/html/cliente?id=${c.id}" target="_blank" class="btn-edit-small" style="text-decoration:none;">Ver ↗</a>`
      : '';
    return `<tr>
      <td>${c.nombre||''}</td>
      <td>${c.imagen ? `<img src="${c.imagen}" style="max-height:28px;" onerror="this.style.display='none'">` : '—'}</td>
      <td><span style="font-size:.5rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:.15rem .4rem;${carruselBadge}">${c.activo!==false?'Activo':'Inactivo'}</span></td>
      <td><span style="font-size:.5rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:.15rem .4rem;${perfilBadge}">${perfilLabel}</span></td>
      <td style="display:flex;gap:.375rem;flex-wrap:wrap;">
        <button type="button" class="btn-edit-small" onclick="editCliente('${c.id}')">Editar</button>
        ${verLink}
        <button type="button" class="btn-edit-small" style="color:var(--red-400);border-color:var(--red-400);" onclick="deleteCliente('${c.id}')">Eliminar</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--slate-400);padding:1rem;font-size:.75rem;">Sin clientes</td></tr>';
}
window.renderClientesList = renderClientesList;

function openNewCliente(){
  state.editingClienteId = null;
  const mt = document.getElementById('modal-cliente')?.querySelector('.modal-title');
  if(mt) mt.textContent = 'Agregar Cliente';
  ['c-name','c-img','c-titulo-proyecto','c-subtitulo','c-sector','c-ubicacion','c-anio','c-servicios','c-imagen-dest']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const ep=document.getElementById('c-estado-perfil'); if(ep) ep.value='borrador';
  const ca=document.getElementById('c-activo'); if(ca) ca.value='si';
  const cc=document.getElementById('c-content-cliente'); if(cc) cc.innerHTML='';
  updateImgPreview('c-img','c-img-preview');
  updateImgPreview('c-imagen-dest','c-imagen-dest-preview');
  openModal('modal-cliente');
}
window.openNewCliente = openNewCliente;

window.editCliente = function(id){
  const c = (state.clientes?.clientes||[]).find(x=>x.id===id);
  if(!c) return;
  state.editingClienteId = id;
  const mt = document.getElementById('modal-cliente')?.querySelector('.modal-title');
  if(mt) mt.textContent = 'Editar Cliente';
  document.getElementById('c-name').value            = c.nombre||'';
  document.getElementById('c-img').value             = c.imagen||'';
  document.getElementById('c-estado-perfil').value   = c.estado_perfil||'borrador';
  document.getElementById('c-activo').value          = c.activo!==false ? 'si' : 'no';
  document.getElementById('c-titulo-proyecto').value = c.titulo_proyecto||'';
  document.getElementById('c-subtitulo').value       = c.subtitulo||'';
  document.getElementById('c-sector').value          = c.sector||'';
  document.getElementById('c-ubicacion').value       = c.ubicacion||'';
  document.getElementById('c-anio').value            = c.anio||'';
  document.getElementById('c-servicios').value       = c.servicios||'';
  document.getElementById('c-imagen-dest').value     = c.imagen_destacada||'';
  document.getElementById('c-content-cliente').innerHTML = c.contenido||'';
  updateImgPreview('c-img','c-img-preview');
  updateImgPreview('c-imagen-dest','c-imagen-dest-preview');
  openModal('modal-cliente');
};

async function saveCliente(){
  const name         = document.getElementById('c-name')?.value.trim();
  const img          = document.getElementById('c-img')?.value.trim();
  const estadoPerfil = document.getElementById('c-estado-perfil')?.value || 'borrador';
  const activo       = document.getElementById('c-activo')?.value !== 'no';
  const tituloProy   = document.getElementById('c-titulo-proyecto')?.value.trim() || '';
  const subtitulo    = document.getElementById('c-subtitulo')?.value.trim() || '';
  const sector       = document.getElementById('c-sector')?.value.trim() || '';
  const ubicacion    = document.getElementById('c-ubicacion')?.value.trim() || '';
  const anio         = document.getElementById('c-anio')?.value.trim() || '';
  const servicios    = document.getElementById('c-servicios')?.value.trim() || '';
  const imagenDest   = document.getElementById('c-imagen-dest')?.value.trim() || '';
  const contenido    = document.getElementById('c-content-cliente')?.innerHTML || '';
  if(!name) return showNotif('El nombre es requerido','error');
  let updated;
  if(state.editingClienteId){
    const list = (state.clientes?.clientes||[]).map(c =>
      c.id===state.editingClienteId ? {
        ...c, nombre:name, imagen:img||c.imagen, activo,
        estado_perfil:estadoPerfil, titulo_proyecto:tituloProy,
        subtitulo, sector, ubicacion, anio, servicios, imagen_destacada:imagenDest, contenido,
      } : c
    );
    updated = { ...(state.clientes||{}), clientes:list };
  } else {
    const newCliente = {
      id:'c'+Date.now(), nombre:name, imagen:img||'', url:'', activo,
      estado_perfil:estadoPerfil, titulo_proyecto:tituloProy,
      subtitulo, sector, ubicacion, anio, servicios, imagen_destacada:imagenDest, contenido,
    };
    updated = { ...(state.clientes||{}), clientes:[...(state.clientes?.clientes||[]), newCliente] };
  }
  try {
    const r = await apiPut('/data/clientes', updated);
    state.clientes = r?.data || updated;
    renderClientesList();
    closeModal('modal-cliente');
    document.getElementById('c-name').value='';
    document.getElementById('c-img').value='';
    showNotif(state.editingClienteId ? '✓ Cliente actualizado' : '✓ Cliente agregado');
    state.editingClienteId = null;
    const cc=document.getElementById('dash-clientes-count'); if(cc) cc.textContent=(state.clientes.clientes||[]).length;
  } catch(e){ showNotif('Error al guardar: '+(e.message||'error'),'error'); }
}

window.deleteCliente = async function(id){
  if(!confirm('¿Eliminar este cliente?')) return;
  const updated = { ...(state.clientes||{}), clientes:(state.clientes?.clientes||[]).filter(c=>c.id!==id) };
  try {
    const r = await apiPut('/data/clientes', updated);
    state.clientes = r?.data || updated;
    renderClientesList();
    const cc=document.getElementById('dash-clientes-count'); if(cc) cc.textContent=(state.clientes.clientes||[]).length;
    showNotif('✓ Cliente eliminado');
  } catch(e){ showNotif('Error al eliminar','error'); }
};

/* ══════════════════════════════════════════════
   TEMPLATE RENAME
══════════════════════════════════════════════ */
window.renameTpl = function(id){
  const tpl = state.templates.find(t=>t.id===id);
  if(!tpl) return;
  const newName = prompt('Nombre de la plantilla:', tpl.name);
  if(newName && newName.trim()){
    tpl.name = newName.trim();
    renderSidebarTemplates();
    renderTemplateOverview();
    const nameEl = document.getElementById('tpl-editor-name');
    if(nameEl) nameEl.textContent = tpl.name;
    showNotif('✓ Nombre actualizado');
  }
};

/* ══════════════════════════════════════════════
   NAVBAR ITEMS
══════════════════════════════════════════════ */
let navbarItems = [];

async function loadNavbarItems() {
  try {
    const res = await window.__svc.apiGet('/nav/botones');
    navbarItems = res.botones || [];
    renderNavbarTable();
  } catch(e) {
    window.__svc.showNotif('Error cargando navbar: ' + e.message, 'error');
  }
}

function renderNavbarTable() {
  const tbody = document.getElementById('navbar-tbody');
  if (!tbody) return;
  if (!navbarItems.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#64748b;">No hay ítems</td></tr>';
    return;
  }
  tbody.innerHTML = navbarItems
    .slice()
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .map(b => {
      const esHome = b.href === '/';
      const plantillaCell = b.plantilla
        ? `<span style="font-size:.75rem;color:#475569;">${b.plantilla.nombre} <span style="color:#94a3b8;">#${b.plantilla.id}</span></span>`
        : `<span style="font-size:.75rem;color:#94a3b8;">${b.href || 'Sin plantilla'}</span>`;
      const estado = b.activo !== false
        ? '<span class="badge-active">Activo</span>'
        : '<span class="badge-inactive">Inactivo</span>';
      let acciones;
      if (esHome) {
        acciones = `<span style="font-size:.7rem;color:#475569;font-style:italic;">🔒 bloqueado</span>`;
      } else {
        const editBtn = `<button class="btn-edit-small" onclick="editarNavItem(${b.id_menu})">Editar</button>`;
        const delBtn = `<button class="btn-edit-small" style="color:var(--red-400);border-color:var(--red-400);" onclick="eliminarNavItem(${b.id_menu})">Eliminar</button>`;
        acciones = editBtn + ' ' + delBtn;
      }
      const grupoTag = b.grupo
        ? ` <span style="font-size:.5rem;background:#e0e7ff;color:#4338ca;padding:.1rem .35rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-radius:2px;">${b.grupo}</span>`
        : '';
      return `<tr>
        <td>${b.titulo}${grupoTag}</td>
        <td>${b.orden}</td>
        <td>${plantillaCell}</td>
        <td>${estado}</td>
        <td style="display:flex;gap:.4rem;flex-wrap:wrap;">${acciones}</td>
      </tr>`;
    }).join('');
}

window.eliminarNavItem = function(id_menu) {
  const b = navbarItems.find(x => x.id_menu === Number(id_menu));
  if (!b) return;
  if (b.esCustom) {
    document.getElementById('nav-delete-warning-name').textContent = `"${b.titulo}"`;
    document.getElementById('nav-delete-confirm-btn').onclick = () => doEliminarNavItem(b.id_menu);
    window.__svc.openModal('modal-confirm-nav-delete');
  } else {
    if (!confirm(`¿Eliminar "${b.titulo}" del navbar?`)) return;
    doEliminarNavItem(b.id_menu);
  }
};

async function doEliminarNavItem(id_menu) {
  window.__svc.closeModal('modal-confirm-nav-delete');
  try {
    await window.__svc.apiDelete(`/nav/botones/${id_menu}`);
    window.__svc.showNotif('Ítem eliminado', 'success');
    loadNavbarItems();
  } catch(e) {
    window.__svc.showNotif(e.message, 'error');
  }
}

// Muestra/oculta los campos del modal de edición según el destino elegido.
function updateNavEditModalFields() {
  const mode = document.querySelector('input[name="nav-edit-tipo-red"]:checked')?.value || 'url';
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('nav-edit-plantilla-field', mode === 'link');
  show('nav-edit-href-field',      mode === 'url');
  show('nav-edit-custom-info',     mode === 'custom');
}

// Opciones del <select> de grupo: "sin grupo" + grupos existentes + "crear nuevo".
// `selected` preselecciona un grupo existente (si lo hay).
function fillNavGrupoSelect(sel, selected) {
  if (!sel) return;
  const grupos = [...new Set(navbarItems.map(b => b.grupo).filter(Boolean))];
  const sel0 = selected || '';
  const opts = ['<option value="">— Sin grupo —</option>'];
  grupos.forEach(g => {
    const v = String(g).replace(/"/g, '&quot;');
    opts.push(`<option value="${v}"${g === sel0 ? ' selected' : ''}>${v}</option>`);
  });
  opts.push('<option value="__new__">＋ Crear grupo nuevo…</option>');
  sel.innerHTML = opts.join('');
}

// Muestra/oculta el input de "grupo nuevo" según el select.
function toggleNavGrupoNuevo(selectId, nuevoId) {
  const sel = document.getElementById(selectId);
  const nuevo = document.getElementById(nuevoId);
  if (!sel || !nuevo) return;
  const on = sel.value === '__new__';
  nuevo.style.display = on ? '' : 'none';
  nuevo.value = '';
  if (on) nuevo.focus();
}

// Grupo elegido: '' (sin grupo), un grupo existente, o el nombre nuevo tipeado.
function readNavGrupo(selectId, nuevoId) {
  const sel = document.getElementById(selectId);
  if (!sel) return '';
  if (sel.value === '__new__') return (document.getElementById(nuevoId)?.value || '').trim();
  return sel.value;
}

// Llena un <select> de plantillas y preselecciona selectedId (si se pasa).
async function fillNavPlantillaSelect(sel, selectedId) {
  if (!sel) return;
  sel.innerHTML = '<option value="">Cargando…</option>';
  try {
    const { plantillas } = await window.__svc.apiGet('/plantillas');
    const list = plantillas || [];
    sel.innerHTML = list.length
      ? list.map(p => `<option value="${p.id_plantilla}"${Number(selectedId) === p.id_plantilla ? ' selected' : ''}>${p.nombre} · ${p.tipo}</option>`).join('')
      : '<option value="">No hay plantillas</option>';
  } catch (e) {
    sel.innerHTML = '<option value="">Error cargando plantillas</option>';
  }
}

window.editarNavItem = function(id_menu) {
  const b = navbarItems.find(x => x.id_menu === Number(id_menu));
  if (!b) return;
  document.getElementById('nav-edit-id').value = b.id_menu;
  document.getElementById('nav-edit-titulo').value = b.titulo || '';
  document.getElementById('nav-edit-orden').value = b.orden || '';
  document.getElementById('nav-edit-activo').value = b.activo !== false ? 'visible' : 'oculto';
  fillNavGrupoSelect(document.getElementById('nav-edit-grupo-select'), b.grupo || '');
  toggleNavGrupoNuevo('nav-edit-grupo-select', 'nav-edit-grupo-nuevo');

  // Modo actual del ítem: página propia / plantilla vinculada / URL externa.
  const mode = b.esCustom ? 'custom' : (b.plantilla ? 'link' : 'url');
  const radio = document.getElementById(`nav-edit-red-${mode}`);
  if (radio) radio.checked = true;

  document.getElementById('nav-edit-href').value = (mode === 'url') ? (b.href || '') : '';
  fillNavPlantillaSelect(document.getElementById('nav-edit-plantilla-select'), b.plantilla ? b.plantilla.id : null);
  updateNavEditModalFields();

  window.__svc.openModal('modal-editar-navbar');
};

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
function initApp(){
  document.getElementById('dash-date').textContent =
    new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'}) + ' · ' +
    new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
 
  //renderSidebarTemplates();
  renderTemplateOverview();
  Promise.all([
    apiGet('/data/blog').catch(()=>null),
    apiGet('/data/clientes').catch(()=>null),
    apiGet('/data/seo').catch(()=>null),
    apiGet('/data/contacto').catch(()=>null),
    apiGet('/data/servicios').catch(()=>null),
  ]).then(([blog,clientes,seo,contacto,servicios])=>{
    const tpl = state.templates.find(t=>t.id==='tpl-index');
    if(blog){
      state.blog=blog;
      const posts=blog.posts||[];
      const bc=document.getElementById('dash-blog-count'); if(bc) bc.textContent=posts.length;
      const bs=document.getElementById('dash-blog-sub'); if(bs) bs.innerHTML=`<span class="stat-card-indicator ind-amber"></span>${posts.filter(p=>p.estado==='publicado').length} publicados`;
      if(tpl){ const ns=tpl.sections.find(s=>s.id==='s-blog'); if(ns) ns.data={...ns.data,title:blog.titulo_seccion||''}; }
    }
    if(clientes){
      state.clientes=clientes;
      const cc=document.getElementById('dash-clientes-count'); if(cc) cc.textContent=(clientes.clientes||[]).length;
      const tog=document.getElementById('clientes-carrusel'); if(tog) tog.checked=!!clientes.carrusel_activo;
      if(tpl){ const ls=tpl.sections.find(s=>s.id==='s-logos'); if(ls) ls.data={...ls.data,title:clientes.titulo_seccion||''}; }
    }
    if(seo){
      state.seo=seo;
      buildSeoTabs();   // tabs dinámicas desde las plantillas + valores guardados
    }
    if(contacto){
      state.contacto=contacto;
      const flds={direccion:'contacto-direccion',telefono:'contacto-telefono',email:'contacto-email',whatsapp:'contacto-whatsapp'};
      Object.entries(flds).forEach(([k,id])=>{ const el=document.getElementById(id); if(el) el.value=contacto[k]||''; });
    }
    if(servicios){
      state.servicios=servicios;
      if(tpl){ const ss=tpl.sections.find(s=>s.id==='s-services'); if(ss) ss.data={...ss.data,eyebrow:servicios.eyebrow||'',title:servicios.titulo_seccion||''}; }
    }
    renderBlogList();
    renderClientesList();
    refreshCanvas();
  });

  // Cargar hero.json y nosotros.json para poblar el editor de plantillas
  apiGet('/data/hero').then(heroJson=>{
    if(!heroJson) return;
    const mapped=heroJsonToSectionData(heroJson);
    const tpl=state.templates.find(t=>t.id==='tpl-index');
    if(!tpl) return;
    const heroSec=tpl.sections.find(s=>s.id==='s-hero');
    if(heroSec){
      heroSec.type = heroJson.plantilla==='1' ? 'hero' : 'hero-centered';
      heroSec.data = heroJson.plantilla==='1' ? {...heroSec.data,...mapped.p1} : {...heroSec.data,...mapped.p2};
    }
    renderSidebarTemplates();
    renderTemplateOverview();
    refreshCanvas();
  }).catch(()=>{});

  apiGet('/data/nosotros').then(nos=>{
    if(!nos) return;
    const tpl=state.templates.find(t=>t.id==='tpl-index');
    if(!tpl) return;
    const as=tpl.sections.find(s=>s.id==='s-about');
    if(as) as.data={...as.data,eyebrow:nos.eyebrow||'',title:nos.titulo||'',desc:nos.descripcion||''};
    refreshCanvas();
  }).catch(()=>{});
 
  document.querySelectorAll('.sidebar-item[data-panel]').forEach(item=>{
    item.addEventListener('click',()=>{
      const p = item.dataset.panel;
      if(p==='plantillas'){
        if(!state.currentTplId) state.currentTplId = state.templates[0]?.id;
        renderSidebarTemplates();
        openTemplateEditor(state.currentTplId);
        return;
      }
      showPanel(p);
    });
  });
 
  document.getElementById('btn-nueva-plantilla')?.addEventListener('click', ()=>openModal('modal-nueva-plantilla'));
  document.getElementById('btn-nueva-plantilla-main')?.addEventListener('click', ()=>openModal('modal-nueva-plantilla'));
  document.getElementById('crear-plantilla-btn')?.addEventListener('click', handleCreateTemplate);
 
  document.getElementById('dash-nuevo-cliente')?.addEventListener('click',()=>{ showPanel('modulos'); openNewCliente(); });
  document.getElementById('dash-editar-home')?.addEventListener('click',()=>{
    if(!state.currentTplId) state.currentTplId = state.templates[0]?.id;
    renderSidebarTemplates();
    openTemplateEditor(state.currentTplId);
  });
 
  // ── Editor de texto enriquecido ──
  // El prompt() del navegador colapsa la selección del contenteditable, por eso
  // antes fallaban "enlace" e "insertar imagen". Guardamos el rango y lo
  // restauramos antes de ejecutar el comando.
  let savedRange = null;
  function saveSelection(){
    const sel = window.getSelection();
    if (sel && sel.rangeCount && document.activeElement?.classList.contains('rich-editor-content')) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelection(){
    if (!savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
  function refreshToolbarState(){
    document.querySelectorAll('.rich-btn[data-cmd]').forEach(b=>{
      const c = b.dataset.cmd;
      let active = false;
      try {
        if (['bold','italic','underline','insertUnorderedList','insertOrderedList'].includes(c)) active = document.queryCommandState(c);
        else if (['h2','h3','p','blockquote'].includes(c)) active = (document.queryCommandValue('formatBlock')||'').toLowerCase() === c;
      } catch(_){}
      b.classList.toggle('active', active);
    });
  }
  document.querySelectorAll('.rich-editor-content').forEach(ed=>{
    ['keyup','mouseup','focus'].forEach(evt=>{
      ed.addEventListener(evt, ()=>{ saveSelection(); refreshToolbarState(); });
    });
  });
  document.querySelectorAll('.rich-btn[data-cmd]').forEach(btn=>{
    btn.addEventListener('mousedown', ev => ev.preventDefault()); // mantiene la selección del editor
    btn.addEventListener('click',()=>{
      const cmd = btn.dataset.cmd;
      const exec = (c,v=null)=>document.execCommand(c,false,v);
      if      (cmd==='h2')                   exec('formatBlock','h2');
      else if (cmd==='h3')                   exec('formatBlock','h3');
      else if (cmd==='p')                    exec('formatBlock','p');
      else if (cmd==='blockquote')           exec('formatBlock','blockquote');
      else if (cmd==='insertUnorderedList')  exec('insertUnorderedList');
      else if (cmd==='insertOrderedList')    exec('insertOrderedList');
      else if (cmd==='createLink') {
        const url = prompt('URL del enlace (ej: https://sisgra.com.ar):');
        restoreSelection();
        if (url) exec('createLink', url);
      }
      else if (cmd==='insertImage') {
        window.__imgPicker?.open({ current: '' }).then(url=>{
          restoreSelection();
          if (url) exec('insertImage', url);
          saveSelection();
          refreshToolbarState();
        });
        return;
      }
      else exec(cmd);
      saveSelection();
      refreshToolbarState();
    });
  });
 
  // Las pestañas de SEO se generan dinámicamente en buildSeoTabs() (desde las
  // plantillas), llamada al cargar los datos y al entrar al panel SEO.
  buildSeoTabs();
 
  document.querySelectorAll('[data-close]').forEach(btn=>{
    btn.addEventListener('click',()=>closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay=>{
    // Solo cerrar si el click empieza Y termina sobre el overlay (no al arrastrar
    // selección de texto desde dentro del modal, ni por un click accidental al borde).
    let downOnOverlay = false;
    overlay.addEventListener('mousedown', e=>{ downOnOverlay = (e.target===overlay); });
    overlay.addEventListener('click', e=>{ if(e.target===overlay && downOnOverlay) overlay.classList.remove('open'); });
  });
 
  document.getElementById('logout-btn')?.addEventListener('click',()=>{
    document.getElementById('app').style.display='none';
    document.getElementById('login-screen').style.display='flex';
  });
 
  document.getElementById('btn-guardar')?.addEventListener('click',saveCurrentPanel);
 
  // ── Modal Navbar: 3 modos (vincular plantilla / página nueva / URL externa) ──
  function updateNavModalFields() {
    const mode = document.querySelector('input[name="nav-tipo-red"]:checked')?.value || 'link';
    const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
    show('nav-plantilla-field', mode === 'link');
    show('nav-href-field',      mode === 'url');
    show('nav-custom-info',     mode === 'custom');
  }
  async function populateNavPlantillaSelect() {
    const sel = document.getElementById('nav-plantilla-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">Cargando…</option>';
    try {
      const { plantillas } = await window.__svc.apiGet('/plantillas');
      const list = plantillas || [];
      sel.innerHTML = list.length
        ? list.map(p => `<option value="${p.id_plantilla}">${p.nombre} · ${p.tipo}</option>`).join('')
        : '<option value="">No hay plantillas</option>';
    } catch (e) {
      sel.innerHTML = '<option value="">Error cargando plantillas</option>';
    }
  }

  document.getElementById('abrir-modal-navbar')?.addEventListener('click', () => {
    document.getElementById('nav-titulo').value = '';
    document.getElementById('nav-href').value = '';
    fillNavGrupoSelect(document.getElementById('nav-grupo-select'), '');
    toggleNavGrupoNuevo('nav-grupo-select', 'nav-grupo-nuevo');
    const linkRadio = document.getElementById('nav-red-link');
    if (linkRadio) linkRadio.checked = true;
    updateNavModalFields();
    populateNavPlantillaSelect();
    window.__svc.openModal('modal-navbar');
  });

  document.querySelectorAll('input[name="nav-tipo-red"]').forEach(r => {
    r.addEventListener('change', updateNavModalFields);
  });
  document.querySelectorAll('input[name="nav-edit-tipo-red"]').forEach(r => {
    r.addEventListener('change', updateNavEditModalFields);
  });
  document.getElementById('nav-grupo-select')?.addEventListener('change', () => toggleNavGrupoNuevo('nav-grupo-select', 'nav-grupo-nuevo'));
  document.getElementById('nav-edit-grupo-select')?.addEventListener('change', () => toggleNavGrupoNuevo('nav-edit-grupo-select', 'nav-edit-grupo-nuevo'));

  document.getElementById('guardar-nav-item-btn')?.addEventListener('click', async () => {
    const titulo = document.getElementById('nav-titulo').value.trim();
    if (!titulo) { window.__svc.showNotif('El título es obligatorio', 'error'); return; }
    const mode = document.querySelector('input[name="nav-tipo-red"]:checked')?.value || 'link';
    const grupo = readNavGrupo('nav-grupo-select', 'nav-grupo-nuevo');
    const body = { titulo };
    if (grupo) body.grupo = grupo;
    if (mode === 'link') {
      const id_plantilla = Number(document.getElementById('nav-plantilla-select').value);
      if (!id_plantilla) { window.__svc.showNotif('Elegí una plantilla de la lista', 'error'); return; }
      body.id_plantilla = id_plantilla;
    } else if (mode === 'custom') {
      body.tipoRedireccion = 'custom';
    } else {
      const href = document.getElementById('nav-href').value.trim();
      if (!href) { window.__svc.showNotif('La URL externa es obligatoria', 'error'); return; }
      body.href = href;
    }
    try {
      await window.__svc.apiPost('/nav/botones', body);
      window.__svc.closeModal('modal-navbar');
      loadNavbarItems();
      if (mode === 'custom') {
        // Página nueva = plantilla en blanco (sin archivo HTML). Refrescar la lista
        // del editor para que aparezca al instante, sin recargar.
        window.reloadPlantillas?.();
        window.__svc.showNotif('✓ Página nueva creada — editala en Plantillas', 'success');
      } else {
        window.__svc.showNotif('Ítem agregado al navbar', 'success');
      }
    } catch(e) {
      window.__svc.showNotif(e.message, 'error');
    }
  });

  document.getElementById('guardar-nav-edit-btn')?.addEventListener('click', async () => {
    const id_boton = document.getElementById('nav-edit-id').value;
    const titulo = document.getElementById('nav-edit-titulo').value.trim();
    if (!titulo) { window.__svc.showNotif('El título es obligatorio', 'error'); return; }
    const orden = parseInt(document.getElementById('nav-edit-orden').value) || undefined;
    const grupo = readNavGrupo('nav-edit-grupo-select', 'nav-edit-grupo-nuevo');
    const body = {
      titulo,
      grupo: grupo || null,
      activo: document.getElementById('nav-edit-activo').value === 'visible',
    };
    if (orden) body.orden = orden;

    // Destino: mismos 3 modos que al crear. El backend crea la plantilla btn-N
    // automáticamente si se pasa a "página propia" y aún no la tiene.
    const mode = document.querySelector('input[name="nav-edit-tipo-red"]:checked')?.value || 'url';
    if (mode === 'link') {
      const id_plantilla = Number(document.getElementById('nav-edit-plantilla-select').value);
      if (!id_plantilla) { window.__svc.showNotif('Elegí una plantilla de la lista', 'error'); return; }
      body.id_plantilla = id_plantilla;
    } else if (mode === 'custom') {
      body.tipoRedireccion = 'custom';
    } else {
      const href = document.getElementById('nav-edit-href').value.trim();
      if (!href) { window.__svc.showNotif('La URL externa es obligatoria', 'error'); return; }
      body.href = href;
    }

    try {
      await window.__svc.apiPatch(`/nav/botones/${id_boton}`, body);
      window.__svc.closeModal('modal-editar-navbar');
      window.__svc.showNotif('✓ Ítem actualizado', 'success');
      loadNavbarItems();
      if (mode === 'custom') window.reloadPlantillas?.();
    } catch(e) {
      window.__svc.showNotif(e.message, 'error');
    }
  });

  document.getElementById('abrir-modal-cliente')?.addEventListener('click', openNewCliente);
  bindImgPreview('b-img','b-img-preview');
  bindImgPreview('c-img','c-img-preview');
  bindImgPreview('c-imagen-dest','c-imagen-dest-preview');
  attachImgPicker('b-img','b-img-preview');
  attachImgPicker('c-img','c-img-preview');
  attachImgPicker('c-imagen-dest','c-imagen-dest-preview');
  document.getElementById('guardar-cliente-btn')?.addEventListener('click', saveCliente);
  document.getElementById('abrir-modal-blog')?.addEventListener('click',openNewPost);
  document.getElementById('dash-nuevo-post')?.addEventListener('click',()=>{ showPanel('modulos'); openNewPost(); });
  document.getElementById('guardar-blog')?.addEventListener('click',saveBlogPost);

  // Restaurar panel activo tras recarga (Live Server / hot-reload)
  try {
    const savedPanel = sessionStorage.getItem('sisgra_panel');
    if (savedPanel && savedPanel !== 'dashboard') {
      if (savedPanel === 'tpl-editor') {
        const savedTpl = sessionStorage.getItem('sisgra_tpl');
        const tplId = savedTpl || state.templates[0]?.id;
        if (tplId) { state.currentTplId = tplId; renderSidebarTemplates(); openTemplateEditor(tplId); }
      } else {
        showPanel(savedPanel);
      }
    }
  } catch(_){}
}
 
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('l-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });

/* ── Sidebar responsive del admin ── */
(function(){
  const toggle  = document.getElementById('admin-sidebar-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  const overlay = document.getElementById('admin-sidebar-overlay');
  if(!toggle || !sidebar || !overlay) return;

  function closeSidebar(){
    sidebar.classList.remove('sidebar-open');
    overlay.classList.remove('active');
    toggle.classList.remove('open');
  }

  toggle.addEventListener('click', ()=>{
    const isOpen = sidebar.classList.toggle('sidebar-open');
    overlay.classList.toggle('active', isOpen);
    toggle.classList.toggle('open', isOpen);
  });

  overlay.addEventListener('click', closeSidebar);

  // Cerrar el sidebar al hacer clic en cualquier ítem (en móvil)
  sidebar.addEventListener('click', e=>{
    if(window.innerWidth < 1024 && e.target.closest('.sidebar-item, .sidebar-tpl-item')){
      closeSidebar();
    }
  });
})();

/* ── Sidebar collapse (desktop) ── */
(function(){
  const btn = document.getElementById('sidebar-collapse-btn');
  if(!btn) return;

  // Restaurar preferencia persistida
  try {
    if(localStorage.getItem('sisgra_sidebar_collapsed') === '1'){
      document.body.classList.add('sidebar-collapsed');
      btn.setAttribute('aria-label','Mostrar barra lateral');
      btn.setAttribute('title','Mostrar barra lateral');
    }
  } catch(_){}

  btn.addEventListener('click', ()=>{
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    btn.setAttribute('aria-label', collapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral');
    btn.setAttribute('title',     collapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral');
    try { localStorage.setItem('sisgra_sidebar_collapsed', collapsed ? '1' : '0'); } catch(_){}
  });
})();
