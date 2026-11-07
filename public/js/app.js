const $ = (selector) => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const token = params.get("invite") || location.pathname.match(/\/unirse\/([^/]+)/)?.[1] || "";
const statusBox = $("#invite-status");
const joinButton = $("#join-button");
let inviteValid = false;
let signedIn = false;

function showStatus(message, error = false) {
  statusBox.textContent = message;
  statusBox.classList.remove("hidden", "error");
  if (error) statusBox.classList.add("error");
}
function updateCountdown() {
  const target = new Date("2026-12-25T00:00:00-05:00");
  const now = new Date();
  const days = Math.max(0, Math.ceil((target - now) / 86400000));
  $("#countdown").textContent = days === 0 ? "¡Llegó Navidad!" : `${days} días`;
}
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Ocurrió un error.");
  return data;
}
async function checkInvite() {
  if (!token) {
    showStatus("Para participar necesitas abrir un enlace de invitación del organizador.", true);
    $("#invite-description").textContent = "Esta página es pública. La participación está protegida mediante invitaciones personales.";
    return;
  }
  try {
    const result = await api(`/api/invitations/${encodeURIComponent(token)}`);
    inviteValid = result.valid;
    showStatus(`Invitación válida: ${result.edition.title} · ${result.edition.year}`);
    $("#invite-description").textContent = "Tu invitación está lista. Inicia sesión con Google para confirmar tu participación.";
    joinButton.classList.toggle("hidden", !signedIn);
  } catch {
    showStatus("Esta invitación no es válida, venció o ya alcanzó su límite de usos.", true);
  }
}
async function checkSession() {
  try {
    const result = await api("/api/me");
    signedIn = result.authenticated;
    if (signedIn) {
      $("#google-area").classList.add("hidden");
      if (inviteValid) joinButton.classList.remove("hidden");
      showStatus(`Sesión iniciada: ${result.user.display_name || result.user.email}`);
    }
  } catch {}
}
joinButton.addEventListener("click", async () => {
  try {
    await api("/api/invitations/join", { method: "POST", body: JSON.stringify({ token }) });
    showStatus("¡Listo! Ya formas parte de Navidad Cliente 360 2026. 🎄");
    joinButton.classList.add("hidden");
  } catch (error) { showStatus(error.message, true); }
});
window.handleGoogleCredential = async (response) => {
  try {
    await api("/api/auth/google", { method: "POST", body: JSON.stringify({ credential: response.credential }) });
    signedIn = true;
    $("#google-area").classList.add("hidden");
    showStatus("Identidad verificada. Comprobando tu invitación…");
    await checkInvite();
    if (inviteValid) joinButton.classList.remove("hidden");
  } catch (error) { showStatus(error.message, true); }
};
async function initGoogle() {
  const config = await fetch("/api/config").then(r => r.ok ? r.json() : null).catch(() => null);
  if (!config?.googleClientId) return;
  const deadline = Date.now() + 10000;
  while (!window.google?.accounts?.id && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  if (!window.google?.accounts?.id) {
    showStatus("No se pudo cargar el acceso de Google. Comprueba tu conexión e inténtalo nuevamente.", true);
    return;
  }
  window.google.accounts.id.initialize({ client_id: config.googleClientId, callback: window.handleGoogleCredential });
  window.google.accounts.id.renderButton($("#google-button"), { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 280 });
}
updateCountdown();
setInterval(updateCountdown, 60 * 60 * 1000);
await checkSession();
await checkInvite();
initGoogle();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
