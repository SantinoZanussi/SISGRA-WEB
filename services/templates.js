import { apiGet, apiPut } from './api.js';

// ── Hero section (admin) → hero.json ─────────────────────────────────────────
export function heroSectionToHeroJson(sec, base = {}) {
  const d = sec.data || {};
  if (sec.type === 'hero') {
    return {
      ...base,
      plantilla: '1',
      badge: d.badge || '',
      titulo1: d.h1 || '',
      titulo2: d.h2 || '',
      descripcion: d.desc || '',
      boton_primario: d.btn1 || '',
      boton_secundario: d.btn2 || '',
      stat1_numero: d.stat1_num || '',
      stat1_label: d.stat1_lbl || '',
      stat2_numero: d.stat2_num || '',
      stat2_label: d.stat2_lbl || '',
    };
  }
  if (sec.type === 'hero-centered') {
    return {
      ...base,
      plantilla: '2',
      p2_eyebrow: d.badge || '',
      p2_titulo: d.h1 || '',
      p2_descripcion: d.desc || '',
      p2_boton_primario: d.btn1 || '',
      p2_boton_secundario: d.btn2 || '',
      p2_metric1_num: d.m1_num || '',
      p2_metric1_label: d.m1_lbl || '',
      p2_metric2_num: d.m2_num || '',
      p2_metric2_label: d.m2_lbl || '',
      p2_metric3_num: d.m3_num || '',
      p2_metric3_label: d.m3_lbl || '',
    };
  }
  return base;
}

// ── hero.json → admin section data objects ───────────────────────────────────
export function heroJsonToSectionData(h) {
  return {
    p1: {
      badge: h.badge || '',
      h1: h.titulo1 || '',
      h2: h.titulo2 || '',
      desc: h.descripcion || '',
      btn1: h.boton_primario || '',
      btn2: h.boton_secundario || '',
      stat1_num: h.stat1_numero || '',
      stat1_lbl: h.stat1_label || '',
      stat2_num: h.stat2_numero || '',
      stat2_lbl: h.stat2_label || '',
    },
    p2: {
      badge: h.p2_eyebrow || '',
      h1: h.p2_titulo || '',
      desc: h.p2_descripcion || '',
      btn1: h.p2_boton_primario || '',
      btn2: h.p2_boton_secundario || '',
      m1_num: h.p2_metric1_num || '',
      m1_lbl: h.p2_metric1_label || '',
      m2_num: h.p2_metric2_num || '',
      m2_lbl: h.p2_metric2_label || '',
      m3_num: h.p2_metric3_num || '',
      m3_lbl: h.p2_metric3_label || '',
    },
    plantilla: h.plantilla || '1',
  };
}

// ── About section (admin) → nosotros.json ────────────────────────────────────
export function aboutSectionToNosotrosJson(sec, base = {}) {
  const d = sec.data || {};
  return {
    ...base,
    eyebrow: d.eyebrow || '',
    titulo: d.title || '',
    descripcion: d.desc || '',
  };
}

// ── Save active template sections to live JSON files ─────────────────────────
export async function saveTemplateToLive(tpl) {
  const heroSec     = tpl.sections.find(s => s.type === 'hero' || s.type === 'hero-centered');
  const aboutSec    = tpl.sections.find(s => s.type === 'about');
  const logosSec    = tpl.sections.find(s => s.type === 'logos');
  const newsSec     = tpl.sections.find(s => s.type === 'news');
  const servicesSec = tpl.sections.find(s => s.type === 'services');
  const jobs = [];

  if (heroSec) {
    const cur = await apiGet('/data/hero').catch(() => ({}));
    jobs.push(apiPut('/data/hero', heroSectionToHeroJson(heroSec, cur || {})));
  }
  if (aboutSec) {
    const cur = await apiGet('/data/nosotros').catch(() => ({}));
    jobs.push(apiPut('/data/nosotros', aboutSectionToNosotrosJson(aboutSec, cur || {})));
  }
  if (logosSec) {
    const d = logosSec.data || {};
    const cur = await apiGet('/data/clientes').catch(() => ({}));
    jobs.push(apiPut('/data/clientes', { ...(cur || {}), titulo_seccion: d.title || '' }));
  }
  if (newsSec) {
    const d = newsSec.data || {};
    const cur = await apiGet('/data/blog').catch(() => ({}));
    jobs.push(apiPut('/data/blog', { ...(cur || {}), titulo_seccion: d.title || '' }));
  }
  if (servicesSec) {
    const d = servicesSec.data || {};
    const cur = await apiGet('/data/servicios').catch(() => ({}));
    jobs.push(apiPut('/data/servicios', { ...(cur || {}), titulo_seccion: d.title || '', eyebrow: d.eyebrow || '' }));
  }

  await Promise.all(jobs);
}
