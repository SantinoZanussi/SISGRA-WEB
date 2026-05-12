import { state, currentPanel } from './store.js';
import { apiPut } from './api.js';
import { getVal } from './ui.js';
import { showNotif } from './ui.js';

export async function saveCurrentPanel() {
  const btn = document.getElementById('btn-guardar');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    await doSavePanel(currentPanel);
    showNotif('✓  Cambios guardados correctamente', 'success');
  } catch (e) {
    showNotif('Error al guardar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar cambios';
  }
}

async function doSavePanel(id) {
  switch (id) {
    case 'home': {
      const d = { ...(state.hero || {}) };
      [
        'badge','titulo1','titulo2','descripcion',
        'boton_primario','boton_secundario',
        'stat1_numero','stat1_label','stat2_numero','stat2_label',
        'plantilla',
        'p2_eyebrow','p2_titulo','p2_subtitulo','p2_descripcion',
        'p2_boton_primario','p2_boton_secundario',
        'p2_tag1','p2_tag2','p2_tag3',
        'p2_metric1_num','p2_metric1_label',
        'p2_metric2_num','p2_metric2_label',
        'p2_metric3_num','p2_metric3_label',
      ].forEach(f => (d[f] = getVal(`hero-${f}`)));
      const r = await apiPut('/data/hero', d);
      state.hero = r.data;
      break;
    }
    case 'nosotros': {
      const d = { ...(state.nosotros || {}) };
      ['eyebrow','titulo','descripcion','anio_fundacion','empleados','ciudad','imagen']
        .forEach(f => (d[f] = getVal(`nosotros-${f}`)));
      const r = await apiPut('/data/nosotros', d);
      state.nosotros = r.data;
      break;
    }
    case 'clientes': {
      const d = { ...(state.clientes || {}) };
      d.carrusel_activo = getVal('clientes-carrusel_activo');
      d.auto_scroll     = getVal('clientes-auto_scroll');
      d.titulo_seccion  = getVal('clientes-titulo_seccion');
      const r = await apiPut('/data/clientes', d);
      state.clientes = r.data;
      break;
    }
    case 'blog': {
      const d = { ...(state.blog || {}) };
      d.visible        = getVal('blog-visible');
      d.titulo_seccion = getVal('blog-titulo_seccion');
      const r = await apiPut('/data/blog', d);
      state.blog = r.data;
      break;
    }
    case 'contacto': {
      const d = { ...(state.contacto || {}) };
      [
        'direccion','telefono','email','whatsapp',
        'facebook','instagram','email_destino','asunto_defecto','formulario_descripcion',
      ].forEach(f => (d[f] = getVal(`contacto-${f}`)));
      d.formulario_activo = getVal('contacto-formulario_activo');
      const r = await apiPut('/data/contacto', d);
      state.contacto = r.data;
      break;
    }
    case 'seo': {
      const d = { ...(state.seo || {}) };
      ['home','cableado','fibra','seguridad','soporte','desarrollo'].forEach(p => {
        d[p] = {
          title:       getVal(`seo-${p}-title`),
          description: getVal(`seo-${p}-desc`),
        };
      });
      const r = await apiPut('/data/seo', d);
      state.seo = r.data;
      break;
    }
    default: {
      if (id.startsWith('p-')) {
        const key = id.replace('p-', '');
        const d   = { ...(state.paginas || {}) };
        const pg  = { ...(d[key] || {}) };
        pg.badge       = getVal(`pag-${key}-badge`);
        pg.titulo1     = getVal(`pag-${key}-titulo1`);
        pg.titulo2     = getVal(`pag-${key}-titulo2`);
        pg.descripcion = getVal(`pag-${key}-descripcion`);
        if (pg.features) {
          pg.features = pg.features.map((f, i) => ({
            ...f,
            badge:       getVal(`pag-${key}-f${i}-badge`),
            titulo:      getVal(`pag-${key}-f${i}-titulo`),
            descripcion: getVal(`pag-${key}-f${i}-descripcion`),
          }));
        }
        d[key] = pg;
        const r = await apiPut('/data/paginas', d);
        state.paginas = r.data;
      }
    }
  }
}