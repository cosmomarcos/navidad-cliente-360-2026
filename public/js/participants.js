// Administración de participantes y restricciones de la edición.
const API = async (path, options = {}) => {
  const response = await fetch(path, { credentials: "same-origin", ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
};
const escapeText = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function mountParticipantAdmin() {
  const me = await API("/api/me");
  if (!me.authenticated || !me.isPrimaryAdmin) return;
  const panel = document.querySelector("#admin-panel");
  if (!panel || panel.classList.contains("hidden")) return;
  let root = document.querySelector("#participant-admin");
  if (!root) {
    root = document.createElement("section");
    root.id = "participant-admin";
    root.className = "participant-admin";
    root.innerHTML = `
      <h3>Participantes y exclusiones</h3>
      <p class="participant-help">Administra quién participa en el sorteo y configura parejas que no deben asignarse entre sí.</p>
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
          await API("/api/admin/participants/" + encodeURIComponent(toggle.dataset.user), { method: "PATCH", body: JSON.stringify({ active: toggle.dataset.active !== "1" }) });
          document.querySelector("#participant-feedback").textContent = "Estado del participante actualizado.";
          await refresh();
        } else if (remove) {
          await API("/api/admin/exclusions/" + encodeURIComponent(remove.dataset.exclusion), { method: "DELETE" });
          document.querySelector("#participant-feedback").textContent = "Exclusión eliminada.";
          await refresh();
        }
      } catch (error) { document.querySelector("#participant-feedback").textContent = error.message; }
    });
    panel.addEventListener("submit", async event => {
      if (event.target.id !== "exclusion-form") return;
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.target));
      if (!values.userA || !values.userB || values.userA === values.userB) {
        document.querySelector("#participant-feedback").textContent = "Selecciona dos participantes diferentes.";
        return;
      }
      try {
        await API("/api/admin/exclusions", { method: "POST", body: JSON.stringify(values) });
        document.querySelector("#participant-feedback").textContent = "Exclusión mutua guardada.";
        await refresh();
      } catch (error) { document.querySelector("#participant-feedback").textContent = error.message; }
    });
  }
  await refresh();
}
async function refresh() {
  const list = document.querySelector("#participant-list");
  if (!list) return;
  try {
    const data = await API("/api/admin/participants");
    const active = data.participants.filter(p => p.status === "confirmed");
    list.innerHTML = data.participants.length ? data.participants.map(p => `
      <article class="participant-row">
        <div class="participant-avatar">${p.avatar_url ? `<img src="${escapeText(p.avatar_url)}" alt="">` : "🎄"}</div>
        <div class="participant-info"><b>${escapeText(p.display_name)}</b><small>${escapeText(p.email)}</small></div>
        <span class="participant-state ${p.status === "confirmed" ? "is-active" : "is-inactive"}">${p.status === "confirmed" ? "Activo" : "Inactivo"}</span>
        <button class="participant-toggle" data-user="${escapeText(p.user_id)}" data-active="${p.status === "confirmed" ? "1" : "0"}">${p.status === "confirmed" ? "Desactivar" : "Reactivar"}</button>
      </article>`).join("") : "<p>Aún no hay participantes registrados.</p>";
    const options = active.map(p => `<option value="${escapeText(p.user_id)}">${escapeText(p.display_name)}</option>`).join("");
    document.querySelectorAll("#exclusion-form select").forEach(select => {
      const previous = select.value; select.innerHTML = options;
      if ([...select.options].some(o => o.value === previous)) select.value = previous;
    });
    const exclusions = await API("/api/admin/exclusions");
    document.querySelector("#exclusion-list").innerHTML = exclusions.exclusions.length
      ? exclusions.exclusions.map(x => `<div class="exclusion-row"><span>${escapeText(x.user_a_name)} ↔ ${escapeText(x.user_b_name)}</span><button class="participant-toggle danger" data-exclusion="${escapeText(x.id)}">Eliminar</button></div>`).join("")
      : "<p>No hay exclusiones configuradas.</p>";
  } catch (error) { list.textContent = error.message; }
}
window.mountParticipantAdmin = mountParticipantAdmin;
(async () => {
    if (panel.classList.contains("hidden") || panel.querySelector("#participant-admin")) return;
    const root = document.createElement("section");
    root.id = "participant-admin";
    root.className = "participant-admin";
    root.innerHTML = `
      <h3>Participantes y exclusiones</h3>
      <p class="participant-help">Administra quién participa en el sorteo y configura parejas que no deben asignarse entre sí.</p>
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
    await refresh();
  });
  observer.observe(panel, { childList: true });
  // Si el panel ya estaba dibujado al iniciar este módulo.
  if (!panel.classList.contains("hidden") && !panel.querySelector("#participant-admin")) {
    panel.append(document.createElement("div"));
  }

  async function refresh() {
    const list = document.querySelector("#participant-list");
    if (!list) return;
    try {
      const data = await API("/api/admin/participants");
      const active = data.participants.filter(p => p.status === "confirmed");
      list.innerHTML = data.participants.length ? data.participants.map(p => `
        <article class="participant-row">
          <div class="participant-avatar">${p.avatar_url ? `<img src="${escapeText(p.avatar_url)}" alt="">` : "🎄"}</div>
          <div class="participant-info"><b>${escapeText(p.display_name)}</b><small>${escapeText(p.email)}</small></div>
          <span class="participant-state ${p.status === "confirmed" ? "is-active" : "is-inactive"}">${p.status === "confirmed" ? "Activo" : "Inactivo"}</span>
          <button class="participant-toggle" data-user="${escapeText(p.user_id)}" data-active="${p.status === "confirmed" ? "1" : "0}">${p.status === "confirmed" ? "Desactivar" : "Reactivar"}</button>
        </article>`).join("") : "<p>Aún no hay participantes registrados.</p>";
      const options = active.map(p => `<option value="${escapeText(p.user_id)}">${escapeText(p.display_name)}</option>`).join("");
      const selects = document.querySelectorAll("#exclusion-form select");
      selects.forEach(select => { const previous = select.value; select.innerHTML = options; if ([...select.options].some(o => o.value === previous)) select.value = previous; });
      const exclusions = await API("/api/admin/exclusions");
      document.querySelector("#exclusion-list").innerHTML = exclusions.exclusions.length
        ? exclusions.exclusions.map(x => `<div class="exclusion-row"><span>${escapeText(x.user_a_name)} ↔ ${escapeText(x.user_b_name)}</span><button class="participant-toggle danger" data-exclusion="${escapeText(x.id)}">Eliminar</button></div>`).join("")
        : "<p>No hay exclusiones configuradas.</p>";
    } catch (error) { list.textContent = error.message; }
  }

  panel.addEventListener("click", async event => {
    const toggle = event.target.closest("[data-user]");
    const remove = event.target.closest("[data-exclusion]");
    try {
      if (toggle) {
        await API("/api/admin/participants/" + encodeURIComponent(toggle.dataset.user), { method: "PATCH", body: JSON.stringify({ active: toggle.dataset.active !== "1" }) });
        document.querySelector("#participant-feedback").textContent = "Estado del participante actualizado.";
        await refresh();
      } else if (remove) {
        await API("/api/admin/exclusions/" + encodeURIComponent(remove.dataset.exclusion), { method: "DELETE" });
        document.querySelector("#participant-feedback").textContent = "Exclusión eliminada.";
        await refresh();
      }
    } catch (error) { document.querySelector("#participant-feedback").textContent = error.message; }
  });
  panel.addEventListener("submit", async event => {
    if (event.target.id !== "exclusion-form") return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    if (!values.userA || !values.userB || values.userA === values.userB) {
      document.querySelector("#participant-feedback").textContent = "Selecciona dos participantes diferentes.";
      return;
    }
    try {
      await API("/api/admin/exclusions", { method: "POST", body: JSON.stringify(values) });
      document.querySelector("#participant-feedback").textContent = "Exclusión mutua guardada.";
      await refresh();
    } catch (error) { document.querySelector("#participant-feedback").textContent = error.message; }
  });
}
(async () => {
  try {
    await mountParticipantAdmin();
  } catch (error) { console.error("Administración de participantes:", error); }
})()