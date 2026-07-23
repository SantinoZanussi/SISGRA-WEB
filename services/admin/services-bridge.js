// expone los servicios esm bajo window.__svc para el panel.js clásico
import { apiGet, apiPut, apiPost, apiPatch, apiDelete, sessionExpired } from '../api.js';
import { showNotif, openModal, closeModal } from '../ui.js';
import { setAuthToken } from '../store.js';
import { heroSectionToHeroJson, heroJsonToSectionData, saveTemplateToLive } from '../templates.js';

window.__svc = { apiGet, apiPut, apiPost, apiPatch, apiDelete, sessionExpired, showNotif, openModal, closeModal, setAuthToken, heroSectionToHeroJson, heroJsonToSectionData, saveTemplateToLive };

// restaura la sesion si hay token guardado (p.ej. tras un reload)
const _storedToken = sessionStorage.getItem('sisgra_token');
if(_storedToken){
  setAuthToken(_storedToken);
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  if(typeof initApp === 'function') initApp();
}
