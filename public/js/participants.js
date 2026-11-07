// Fase 0.4: administración de participantes y exclusiones.
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
      <h3>Administración de participantes</h3>
      <p class="participant-help">La lista pública está disponible para todos en Inicio. Desde aquí puedes administrar inscripciones y exclusiones del sorteo.</p>
      <div id="participant-list" aria-live="polite">Cargando participantes…</div>
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
  if (!panel.dataset.participantHandlers) {
    panel.dataset.participantHandlers = "1";
    panel.addEventListener("click", async event => {
      const toggle = event.target.closest("[data-user]");
      const remove = event.target.closest("[data-exclusion]");
      try {
        if (toggle) {
          await participantApi("/api/admin/participants/" + encodeURIComponent(toggle.dataset.user), { method: "PATCH", body: JSON.stringify({ active: toggle.dataset.active !== "1" }) });
          document.querySelector("#participant-feedback").textContent = "Estado del participante actualizado.";
          await window.mountParticipantAdmin();
        } else if (remove) {
          await participantApi("/api/admin/exclusions/" + encodeURIComponent(remove.dataset.exclusion), { method: "DELETE" });
          document.querySelector("#participant-feedback").textContent = "Exclusión eliminada.";
          await window.mountParticipantAdmin();
        }
      } catch (error) { document.querySelector("#participant-feedback").textContent = error.message; }
    });
    panel.addEventListener("submit", async event => {
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
    const list = document.querySelector("#participant-list");
    const active = data.participants.filter(p => p.status === "confirmed");
    list.innerHTML = data.participants.length ? data.participants.map(p => `
      <article class="participant-row">
        <div class="participant-avatar">${p.avatar_url ? `<img src="${participantEscape(p.avatar_url)}" alt="">` : "🎄"}</div>
        <div class="participant-info"><b>${participantEscape(p.display_name)}</b><small>${participantEscape(p.email)}</small></div>
        <span class="participant-state ${p.status === "confirmed" ? "is-active" : "is-inactive"}">${p.status === "confirmed" ? "Activo" : "Inactivo"}</span>
        <button class="participant-toggle" data-user="${participantEscape(p.user_id)}" data-active="${p.status === "confirmed" ? "1" : "0"}">${p.status === "confirmed" ? "Desactivar" : "Reactivar"}</button>
      </article>`).join("") : "<p>Aún no hay participantes registrados.</p>";
    const options = active.map(p => `<option value="${participantEscape(p.user_id)}">${participantEscape(p.display_name)}</option>`).join("");
    document.querySelectorAll("#exclusion-form select").forEach(select => { const previous = select.value; select.innerHTML = options; if ([...select.options].some(o => o.value === previous)) select.value = previous; });
    const exclusions = await participantApi("/api/admin/exclusions");
    document.querySelector("#exclusion-list").innerHTML = exclusions.exclusions.length
      ? exclusions.exclusions.map(x => `<div class="exclusion-row"><span>${participantEscape(x.user_a_name)} ↔ ${participantEscape(x.user_b_name)}</span><button class="participant-toggle danger" data-exclusion="${participantEscape(x.id)}">Eliminar</button></div>`).join("")
      : "<p>No hay exclusiones configuradas.</p>";
  } catch (error) {
    document.querySelector("#participant-list").textContent = "No se pudo cargar la administración: " + error.message;
  }
};
