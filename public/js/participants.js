// Administración de exclusiones del sorteo. La lista de participantes se consulta desde Inicio.
const participantApi = async (path, options = {}) => {
  const response = await fetch(path, { credentials: "same-origin", ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
};
const participantEscape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

window.mountParticipantAdmin = async function () {
  const me = await participantApi("/api/me");
  if (!me.authenticated || !me.isPrimaryAdmin) return;
  const panel = document.querySelector("#admin-panel");
  if (!panel || panel.classList.contains("hidden")) return;
  let root = document.querySelector("#participant-admin");
  if (!root) {
    root = document.createElement("section");
    root.id = "participant-admin";
    root.className = "participant-admin";
    root.innerHTML = `
      <h3>Exclusiones del sorteo</h3>
      <p class="participant-help">La lista de participantes está disponible para todos en Inicio. Configura aquí las parejas que no deben asignarse entre sí.</p>
      <div class="exclusion-box">
        <h4>Agregar exclusión mutua</h4>
        <p>Las dos personas seleccionadas no podrán regalarse entre sí.</p>
        <form id="exclusion-form" class="exclusion-form">
          <label>Participante 1<select name="userA" required></select></label>
          <label>Participante 2<select name="userB" required></select></label>
          <button class="admin-action" type="submit">Agregar exclusión</button>
        </form>
        <div id="exclusion-list" aria-live="polite"></div>
      </div>
      <div id="participant-feedback" role="status" aria-live="polite"></div>`;
    panel.append(root);
  }
  if (!root.dataset.handlers) {
    root.dataset.handlers = "1";
    root.addEventListener("click", async event => {
      const remove = event.target.closest("[data-exclusion]");
      if (!remove) return;
      try {
        await participantApi("/api/admin/exclusions/" + encodeURIComponent(remove.dataset.exclusion), { method: "DELETE" });
        document.querySelector("#participant-feedback").textContent = "Exclusión eliminada.";
        await window.mountParticipantAdmin();
      } catch (error) { document.querySelector("#participant-feedback").textContent = error.message; }
    });
    root.addEventListener("submit", async event => {
      if (event.target.id !== "exclusion-form") return;
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.target));
      if (!values.userA || !values.userB || values.userA === values.userB) {
        document.querySelector("#participant-feedback").textContent = "Selecciona dos participantes diferentes."; return;
      }
      try {
        await participantApi("/api/admin/exclusions", { method: "POST", body: JSON.stringify(values) });
        document.querySelector("#participant-feedback").textContent = "Exclusión mutua guardada.";
        await window.mountParticipantAdmin();
      } catch (error) { document.querySelector("#participant-feedback").textContent = error.message; }
    });
  }
  try {
    const data = await participantApi("/api/admin/participants");
    const active = data.participants.filter(p => p.status === "confirmed");
    const options = active.map(p => `<option value="${participantEscape(p.user_id)}">${participantEscape(p.display_name)}</option>`).join("");
    root.querySelectorAll("#exclusion-form select").forEach(select => {
      const previous = select.value;
      select.innerHTML = options;
      if ([...select.options].some(o => o.value === previous)) select.value = previous;
    });
    const exclusions = await participantApi("/api/admin/exclusions");
    root.querySelector("#exclusion-list").innerHTML = exclusions.exclusions.length
      ? exclusions.exclusions.map(x => `<div class="exclusion-row"><span>${participantEscape(x.user_a_name)} ↔ ${participantEscape(x.user_b_name)}</span><button class="participant-toggle danger" data-exclusion="${participantEscape(x.id)}">Eliminar</button></div>`).join("")
      : "<p>No hay exclusiones configuradas.</p>";
  } catch (error) {
    root.querySelector("#exclusion-list").textContent = "No se pudo cargar la configuración: " + error.message;
  }
};
