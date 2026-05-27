// Bridge entre los servicios ESM (api/ui/store/templates) y el script clásico
// del panel: expone todo bajo window.__svc para que panel.js pueda usarlo.
// También hace auto-login si hay token guardado en sessionStorage.

import { apiGet, apiPut, apiPost, apiPatch, apiDelete } from '../api.js';
import { showNotif, openModal, closeModal } from '../ui.js';
import { setAuthToken } from '../store.js';
import { heroSectionToHeroJson, heroJsonToSectionData, saveTemplateToLive } from '../templates.js';

window.__svc = { apiGet, apiPut, apiPost, apiPatch, apiDelete, showNotif, openModal, closeModal, setAuthToken, heroSectionToHeroJson, heroJsonToSectionData, saveTemplateToLive };

// Auto-login: if a session token is stored (e.g. after a Live Server reload),
// restore the session without forcing the user to log in again.
const _storedToken = sessionStorage.getItem('sisgra_token');
if(_storedToken){
  setAuthToken(_storedToken);
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  if(typeof initApp === 'function') initApp();
}
