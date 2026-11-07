const $ = (selector) => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const token = params.get("invite") || location.pathname.match(/\/unirse\/([^/]+)/)?.[1] || "";
const statusBox = $("#invite-status"), joinButton = $("#join-button");
let inviteValid = false, signedIn = false, currentUser = null;
function showStatus(message, error = false) {
  statusBox.textContent = message; statusBox.classList.remove("hidden", "error"); if (error) statusBox.classList.add("error");
}
function updateCountdown() {
  const target = new Date("2026-12-25T00:00:00-05:00"), days = Math.max(0, Math.ceil((target - new Date()) / 86400000));
  $("#countdown").textContent = days === 0 ? "¡Llegó Navidad!" : `${days} días`;
}
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "Ocurrió un error."); return data;
}
async function checkInvite() {
  if (!token) {
    showStatus("Para participar necesitas abrir un enlace de invitación del organizador.", true);
    $("#invite-description").textContent = "Esta página es pública. La participación está protegida mediante invitaciones personales."; return;
  }
  try {
    const result = await api(`/api/invitations/${encodeURIComponent(token)}`); inviteValid = result.valid;
    showStatus(`Invitación válida: ${result.edition.title} · ${result.edition.year}`);
    $("#invite-description").textContent = "Tu invitación está lista. Inicia sesión con Google para confirmar tu participación.";
    joinButton.classList.toggle("hidden", !signedIn);
  } catch { showStatus("Esta invitación no es válida, venció o ya alcanzó su límite de usos.", true); }
}
async function renderAdmin() {
  const panel = $("#admin-panel");
  if (!signedIn || !currentUser?.isPrimaryAdmin) { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  try {
    const state = await api("/api/admin/status");
    if (!state.initialized) {
      panel.innerHTML = `<h2>Panel del administrador principal</h2><p>Bienvenido, ${escapeHtml(currentUser.user.display_name || currentUser.user.email)}. Configura la edición para generar tu primera invitación.</p>
      <form id="bootstrap-form" class="admin-form">
        <label>Nombre de la edición<input name="title" value="Navidad Cliente 360 2026" maxlength="100" required></label>
        <label>Año<input name="year" type="number" min="2026" value="2026" required></label>
        <label>Presupuesto por persona (S/)<input name="budgetAmount" type="number" min="0" step="0.01" value="80"></label>
        <label>Fecha del evento<div class="date-control"><input id="event-date" name="eventDate" type="date" value="2026-12-18" min="2026-01-01" max="2027-12-31" required><button type="button" class="date-picker-button" id="open-event-calendar" aria-label="Abrir calendario">📅 Elegir fecha</button></div><small class="date-help">Selecciona el día del evento en el calendario o escribe la fecha.</small></label>
        <label>Usos de la invitación inicial<input name="maxUses" type="number" min="1" max="500" value="100"></label>
      </form><button class="admin-action" id="create-edition">Crear edición y generar invitación</button><div id="admin-result" aria-live="polite"></div>`;
      $("#open-event-calendar").addEventListener("click", () => {
        const dateInput = $("#event-date");
        try {
          if (typeof dateInput.showPicker === "function") dateInput.showPicker();
          else { dateInput.focus(); dateInput.click(); }
        } catch { dateInput.focus(); dateInput.click(); }
      });
      $("#create-edition").addEventListener("click", async () => {
        const form = $("#bootstrap-form");
        if (!form.reportValidity()) return;
        const values = Object.fromEntries(new FormData(form).entries());
        try { const result = await api("/api/admin/bootstrap", { method: "POST", body: JSON.stringify(values) });
          $("#admin-result").innerHTML = `<div class="admin-result"><b>Edición creada.</b><br>Invitación inicial: <a href="${escapeAttr(result.invitationUrl)}">${escapeHtml(result.invitationUrl)}</a></div>`;
          await renderAdmin();
        } catch (error) { $("#admin-result").textContent = error.message; }
      });
    } else {
      panel.innerHTML = `<h2>Panel del administrador principal</h2><p>Sesión administrativa: ${escapeHtml(state.email)}</p>
      <div class="admin-result"><b>${escapeHtml(state.edition.title)}</b> · ${state.edition.year}<br>Presupuesto: ${state.edition.budget_amount == null ? "No definido" : "S/ " + state.edition.budget_amount}<br>Evento: ${escapeHtml(state.edition.event_date || "Por definir")}<br>Participantes inscritos: ${state.participants}</div>
      <form id="invite-form" class="admin-form"><label>Usos del nuevo enlace<input name="maxUses" type="number" min="1" max="500" value="1"></label></form>
      <button class="admin-action" id="new-invite">Generar invitación</button><div id="admin-result" aria-live="polite"></div>`;
      $("#new-invite").addEventListener("click", async () => {
        try { const values = Object.fromEntries(new FormData($("#invite-form")).entries()); const result = await api("/api/admin/invitations", { method: "POST", body: JSON.stringify(values) });
          $("#admin-result").innerHTML = `<div class="admin-result">Enlace generado: <a href="${escapeAttr(result.invitationUrl)}">${escapeHtml(result.invitationUrl)}</a></div>`;
        } catch (error) { $("#admin-result").textContent = error.message; }
      });
    }
  } catch (error) { panel.classList.remove("hidden"); panel.innerHTML = `<h2>Error al cargar el panel</h2><p>${escapeHtml(error.message)}</p><button class="admin-action" id="retry-admin">Reintentar</button>`; $("#retry-admin").addEventListener("click", renderAdmin); console.error("Navidad Cliente 360: error al cargar panel", error); }
}
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function escapeAttr(value) { return escapeHtml(value); }
async function checkSession() {
  const panel = $("#admin-panel");
  try {
    currentUser = await api("/api/me");
    signedIn = Boolean(currentUser?.authenticated);
    window.__NC360_DIAGNOSTICS = {
      version: "0.3.0",
      authenticated: signedIn,
      isPrimaryAdmin: Boolean(currentUser?.isPrimaryAdmin),
      sessionChecked: true
    };
    if (!signedIn) {
      $("#google-area").classList.remove("hidden");
      panel.classList.add("hidden");
      return;
    }
    $("#google-area").classList.add("hidden");
    if (inviteValid) joinButton.classList.remove("hidden");
    showStatus(`Sesión iniciada: ${currentUser.user?.display_name || currentUser.user?.email || "usuario"}`);
    if (currentUser.isPrimaryAdmin) {
      panel.classList.remove("hidden");
      panel.innerHTML = "<h2>Panel del administrador principal</h2><p>Cargando configuración de la edición…</p>";
      await renderAdmin();
    } else {
      panel.classList.add("hidden");
    }
  } catch (error) {
    window.__NC360_DIAGNOSTICS = { version: "0.3.0", sessionChecked: false, error: error.message };
    panel.classList.remove("hidden");
    panel.innerHTML = `<h2>No se pudo cargar tu sesión</h2><p>${escapeHtml(error.message)}</p><button class="admin-action" id="retry-admin">Reintentar</button>`;
    $("#retry-admin").addEventListener("click", checkSession);
    console.error("Navidad Cliente 360: error al comprobar sesión", error);
  }
}
joinButton.addEventListener("click", async () => {
  try { await api("/api/invitations/join", { method: "POST", body: JSON.stringify({ token }) }); showStatus("¡Listo! Ya formas parte de Navidad Cliente 360 2026. 🎄"); joinButton.classList.add("hidden"); }
  catch (error) { showStatus(error.message, true); }
});
window.handleGoogleCredential = async (response) => {
  try {
    await api("/api/auth/google", { method: "POST", body: JSON.stringify({ credential: response.credential }) });
    signedIn = true; $("#google-area").classList.add("hidden");
    showStatus("Identidad verificada. Cargando tu espacio…");
    await checkInvite();
    currentUser = await api("/api/me");
    if (inviteValid) joinButton.classList.remove("hidden");
    await renderAdmin();
  } catch (error) { showStatus(error.message, true); }
};
async function initGoogle() {
  const config = await fetch("/api/config").then(r => r.ok ? r.json() : null).catch(() => null);
  if (!config?.googleClientId) return;
  const deadline = Date.now() + 10000;
  while (!window.google?.accounts?.id && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 150));
  if (!window.google?.accounts?.id) { showStatus("No se pudo cargar el acceso de Google. Comprueba tu conexión e inténtalo nuevamente.", true); return; }
  window.google.accounts.id.initialize({ client_id: config.googleClientId, callback: window.handleGoogleCredential });
  window.google.accounts.id.renderButton($("#google-button"), { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 280 });
}
updateCountdown(); setInterval(updateCountdown, 60 * 60 * 1000);
await checkInvite(); await checkSession(); initGoogle();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
