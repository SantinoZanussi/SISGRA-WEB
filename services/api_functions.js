import { initApp } from './api_service.js'; 
const API_BASE = "http://localhost:3000/api";
let authToken = sessionStorage.getItem("sisgra_token") || null;

export async function doLogin() {
  const usuario = document.getElementById("l-user").value.trim();
  const password = document.getElementById("l-pass").value.trim();
  const errEl = document.getElementById("login-error");
  const spinEl = document.getElementById("login-spinner");
  const btn = document.getElementById("login-btn");

  errEl.style.display = "none";
  btn.disabled = true;
  spinEl.style.display = "block";

  try {
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Error");

    authToken = data.token;
    sessionStorage.setItem("sisgra_token", authToken);
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app").style.display = "block";
    initApp();
  } catch (e) {
    errEl.textContent = e.message || "Usuario o contraseña incorrectos.";
    errEl.style.display = "block";
  } finally {
    btn.disabled = false;
    spinEl.style.display = "none";
  }
}

document.getElementById("l-pass").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});

export function doLogout() {
  authToken = null;
  sessionStorage.removeItem("sisgra_token");
  document.getElementById("app").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("l-pass").value = "";
}