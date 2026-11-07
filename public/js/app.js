const $ = selector => document.querySelector(selector);
const setClass = (selector, className, enabled) => { const el=$(selector); if(el) el.classList.toggle(className, !!enabled); return el; };
const params = new URLSearchParams(location.search);
const token = params.get("invite") || location.pathname.match(/\/unirse\/([^/]+)/)?.[1] || "";
let signedIn=false, currentUser=null, inviteValid=false, inviteEdition=null;
const api=async(path,options={})=>{const r=await fetch(path,{credentials:"same-origin",...options,headers:{"content-type":"application/json",...(options.headers||{})}});const d=await r.json();if(!r.ok)throw new Error(d.error||"Ocurrió un error.");return d;};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function setLoginView(){
  setClass("#hero","hidden",true);setClass("#features","hidden",true);setClass("#site-footer","hidden",true);
  const card=$("#join-card");if(!card)return;card.classList.remove("hidden");
  $("#join-card").innerHTML=`<div class="login-brand"><span>🎄</span><p class="kicker">CLIENTE 360 · NAVIDAD 2026</p><h1>Navidad Cliente 360</h1><p>Una Navidad, muchas sorpresas.</p></div><div id="login-context" class="login-context">${token?"Inicia sesión con Google para validar tu invitación y unirte a la celebración.":"Inicia sesión con tu cuenta de Google para continuar."}</div><div id="google-button" class="google-button"></div><div id="login-feedback" class="status hidden" role="status"></div><div class="privacy-note">🔒 Tu participación y tu asignación secreta estarán protegidas.</div>`;
}
function showFeedback(message,error=false){const el=$("#login-feedback");if(!el)return;el.textContent=message;el.classList.remove("hidden","error");if(error)el.classList.add("error");}
async function loadInvite(){if(!token)return;try{const r=await api("/api/invitations/"+encodeURIComponent(token));inviteValid=true;inviteEdition=r.edition;}catch{inviteValid=false;}}
function showProfileForm(profile=null){
 const card=$("#join-card");card.classList.remove("hidden");card.innerHTML=`<div class="card-heading"><div class="icon-bubble">👤</div><div><p class="kicker">TU PERFIL DE PARTICIPANTE</p><h2>¿Cómo te llamas?</h2></div></div><p class="muted">Escribe tus nombres y apellidos reales. Estos datos serán utilizados para identificarte durante el sorteo; no mostraremos tu correo como nombre.</p><form id="participant-profile-form" class="profile-form"><label>Nombres<input name="firstName" autocomplete="given-name" maxlength="80" required value="${esc(profile?.first_name||"")}"></label><label>Apellidos<input name="lastName" autocomplete="family-name" maxlength="100" required value="${esc(profile?.last_name||"")}"></label><button class="primary-button" type="submit">Guardar mi nombre <span>→</span></button></form><div id="profile-feedback" class="status hidden" role="status"></div>`;
 $("#participant-profile-form").addEventListener("submit",async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));const fb=$("#profile-feedback");try{await api("/api/profile/participant",{method:"POST",body:JSON.stringify(values)});currentUser=await api("/api/me");renderMemberApp();}catch(err){fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}});
}
function renderMemberApp(){
 setClass("#join-card","hidden",true);setClass("#admin-panel","hidden",true);
 let app=$("#member-app");app.classList.remove("hidden");
 const name=currentUser.participantProfile?.first_name||currentUser.user.display_name||"Participante";
 const homeMarkup=`<section class="member-welcome"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h1>¡Hola, ${esc(name)}! 🎄</h1><p>Tu espacio para compartir la magia de esta Navidad.</p><div class="member-countdown" id="member-countdown"></div></section><article class="member-feature"><span>🎁</span><div><b>Mi amigo secreto</b><p>Tu asignación estará disponible cuando el organizador realice el sorteo.</p></div><small>Próximamente</small></article><div class="member-shortcuts"><article><span>💝</span><b>Lista de deseos</b><small>Próximamente</small></article><article><span>💌</span><b>Mensajes y pistas</b><small>Próximamente</small></article></div>`;
 app.innerHTML=`<section class="member-home" id="member-tab-content">${homeMarkup}</section><nav class="bottom-nav" aria-label="Menú principal"><button class="active" data-tab="home"><span>⌂</span>Inicio</button><button data-tab="secret"><span>🎁</span>Mi secreto</button><button data-tab="community"><span>💬</span>Comunidad</button><button data-tab="wishes"><span>💝</span>Deseos</button><button data-tab="profile"><span>👤</span>Perfil</button>${currentUser.isPrimaryAdmin?'<button data-tab="admin-settings"><span>⚙️</span>Ajustes</button>':""}</nav>`;
 updateMemberCountdown(currentUser.membership?.event_date);
 app.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{app.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===btn));if(btn.dataset.tab==="profile"){showProfileSettings();return;}if(btn.dataset.tab==="admin-settings"){showAdminSettings();return;}const labels={home:"Inicio",secret:"Mi amigo secreto",community:"Comunidad",wishes:"Lista de deseos"};if(btn.dataset.tab!=="home"){const section=app.querySelector(".member-home");section.innerHTML=`<div class="member-section-heading"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h2>${labels[btn.dataset.tab]}</h2></div><article class="member-feature"><span>${btn.dataset.tab==="secret"?"🎁":btn.dataset.tab==="community"?"💬":"💝"}</span><div><b>${labels[btn.dataset.tab]}</b><p>Esta funcionalidad se habilitará en su fase correspondiente del proyecto.</p></div><small>Próximamente</small></article>`;}else{renderMemberApp();}}));
}
async function showAdminSettings(){
 const home=$("#member-app .member-home"); if(!currentUser?.isPrimaryAdmin||!home)return;
 home.innerHTML='<div class="admin-settings-view"><div class="settings-header"><span>⚙️</span><div><h2>Ajustes del intercambio</h2><p>Configuración general de la edición.</p></div></div><div id="edition-settings-feedback" class="status hidden"></div><form id="edition-settings-form" class="edition-settings-form"><label>Nombre del intercambio<input name="title" maxlength="100" required></label><label>Fecha del intercambio<input name="eventDate" type="date"></label><label>Presupuesto por persona (S/) <input name="budgetAmount" type="number" min="0" step="0.01" placeholder="Ej. 80"></label><button class="primary-button" type="submit">Guardar ajustes</button></form><p class="settings-note">Los ajustes se pueden modificar mientras el sorteo no se haya realizado.</p><div class="admin-tools-section"><div id="admin-tools-slot"></div></div></div>';
 const adminPanel=$("#admin-panel");$("#admin-tools-slot").append(adminPanel);adminPanel.classList.remove("hidden");await renderAdmin();
 try{
  const data=await api("/api/admin/status");const e=data.edition||{};const form=$("#edition-settings-form");
  form.elements.title.value=e.title||"";form.elements.eventDate.value=e.event_date||"";form.elements.budgetAmount.value=e.budget_amount??"";
  if(e.status!=="registration"){form.querySelector("button").disabled=true;form.querySelectorAll("input").forEach(x=>x.disabled=true);$("#edition-settings-feedback").textContent="Los ajustes están bloqueados porque el sorteo ya fue realizado o la edición terminó.";$("#edition-settings-feedback").classList.remove("hidden");}
  form.addEventListener("submit",async ev=>{ev.preventDefault();const values=Object.fromEntries(new FormData(form));const fb=$("#edition-settings-feedback");try{await api("/api/admin/edition",{method:"PATCH",body:JSON.stringify(values)});currentUser=await api("/api/me");updateMemberCountdown(currentUser.membership?.event_date);fb.textContent="Los ajustes del intercambio se guardaron correctamente.";fb.classList.remove("hidden","error");}catch(err){fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}});
 }catch(err){const fb=$("#edition-settings-feedback");fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}
}
function updateMemberCountdown(date){
 const el=$("#member-countdown"); if(!el)return;
 if(!date){el.textContent="Fecha del intercambio pendiente de configurar";return;}
 const target=new Date(date+"T00:00:00");const today=new Date();today.setHours(0,0,0,0);
 const days=Math.ceil((target-today)/86400000);
 el.innerHTML=days>0?"<small>CUENTA REGRESIVA PARA EL INTERCAMBIO</small><strong>"+days+" días</strong><span>"+esc(date)+"</span>":days===0?"<strong>¡Hoy es el intercambio! 🎁</strong>":"<small>El intercambio ya pasó</small>";
}
function showProfileSettings(){
 const app=$("#member-app"), profile=currentUser.participantProfile||{};
 app.querySelector(".member-home").innerHTML=`<article class="member-feature"><span>👤</span><div><b>Mi perfil</b><p>${esc([profile.first_name,profile.last_name].filter(Boolean).join(" ")||currentUser.user.email)}</p><p>${esc(currentUser.user.email)}</p></div><button class="profile-action" id="edit-profile">Editar</button></article><div class="profile-actions"><button id="withdraw-participation" class="secondary-action">Ya no deseo participar</button><button id="logout-button" class="secondary-action">Cerrar sesión</button></div><div id="profile-action-feedback" class="status hidden"></div>`;
 $("#edit-profile").addEventListener("click",()=>showProfileForm(currentUser.participantProfile));
 $("#logout-button").addEventListener("click",logout);
 $("#withdraw-participation").addEventListener("click",async()=>{if(!confirm("¿Seguro que deseas dejar de participar? Podrás volver a confirmar mientras la inscripción siga abierta."))return;try{await api("/api/participation/withdraw",{method:"POST"});currentUser=await api("/api/me");renderRejoinView();}catch(e){const fb=$("#profile-action-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
}
function renderRejoinView(){
 const app=$("#member-app");app.classList.remove("hidden");app.innerHTML=`<section class="member-welcome"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h1>Tu participación está pausada</h1><p>Puedes volver a confirmar mientras las inscripciones sigan abiertas.</p></section><section class="member-home"><button id="rejoin-button" class="primary-button">Volver a confirmar mi participación →</button><button id="logout-button" class="secondary-action">Cerrar sesión</button><div id="rejoin-feedback" class="status hidden"></div></section>`;
 $("#rejoin-button").addEventListener("click",async()=>{try{await api("/api/participation/rejoin",{method:"POST"});currentUser=await api("/api/me");if(!currentUser.participantProfile)showProfileForm();else renderMemberApp();}catch(e){const fb=$("#rejoin-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
 $("#logout-button").addEventListener("click",logout);
}
async function logout(){try{await api("/api/auth/logout",{method:"POST"});}finally{location.href=location.pathname+(token?"?invite="+encodeURIComponent(token):"");}}
async function renderAdmin(){
 const panel=$("#admin-panel");if(!panel)return;
 if(!currentUser?.isPrimaryAdmin){panel.classList.add("hidden");return;}
 if(!panel.parentElement?.matches("#admin-tools-slot")){panel.classList.add("hidden");return;}
 panel.classList.remove("hidden");
 try{
  panel.innerHTML=`<section class="invite-management">
   <div class="management-heading"><div><h3>Invitaciones</h3><p>Genera enlaces para incorporar participantes al intercambio.</p></div><span class="management-icon">✉️</span></div>
   <form id="invite-form" class="admin-form"><label>Usos permitidos del enlace<input name="maxUses" type="number" min="1" max="500" value="1"></label><button class="admin-action" id="new-invite" type="submit">Generar invitación</button></form>
   <div id="admin-result" aria-live="polite"></div>
  </section>`;
  $("#invite-form").addEventListener("submit",async ev=>{ev.preventDefault();try{const v=Object.fromEntries(new FormData(ev.currentTarget));const r=await api("/api/admin/invitations",{method:"POST",body:JSON.stringify(v)});$("#admin-result").innerHTML=`<div class="admin-result"><b>Invitación creada</b><a href="${esc(r.invitationUrl)}">${esc(r.invitationUrl)}</a></div>`;}catch(e){$("#admin-result").textContent=e.message;}});
  if(window.mountParticipantAdmin)await window.mountParticipantAdmin();
 }catch(e){panel.innerHTML=`<p class="admin-error">${esc(e.message)}</p>`;}
}
async function checkSession(){
 setClass("#hero","hidden",true);setClass("#features","hidden",true);setClass("#site-footer","hidden",true);
 currentUser=await api("/api/me");signedIn=!!currentUser.authenticated;
 if(!signedIn){setLoginView();await initGoogle();return;}
 setClass("#hero","hidden",true);setClass("#features","hidden",true);setClass("#site-footer","hidden",true);setClass("#google-area","hidden",true);
 if(token&&!currentUser.membership){$("#join-card").classList.remove("hidden");$("#join-card").innerHTML=`<div class="card-heading"><div class="icon-bubble">🎄</div><div><p class="kicker">INVITACIÓN</p><h2>${esc(inviteEdition?.title||"Navidad Cliente 360")}</h2></div></div><p class="muted">${inviteValid?"Tu invitación está lista. Confirma tu participación para continuar.":"La invitación no es válida o venció."}</p><button id="confirm-join" class="primary-button" ${inviteValid?"":"disabled"}>Confirmar mi participación →</button><div id="join-feedback" class="status hidden"></div>`;
 $("#confirm-join").addEventListener("click",async()=>{try{await api("/api/invitations/join",{method:"POST",body:JSON.stringify({token})});currentUser=await api("/api/me");showProfileForm();}catch(e){const fb=$("#join-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
 }else if(currentUser.membership?.status==="confirmed"&&!currentUser.participantProfile){$("#join-card").classList.add("hidden");showProfileForm();}
 else if(currentUser.membership?.status==="confirmed"){renderMemberApp();} else if(currentUser.membership?.status==="withdrawn"){renderRejoinView();}
 else {$("#join-card").classList.remove("hidden");$("#join-card").innerHTML="<h2>Tu cuenta está activa</h2><p>Solicita una invitación válida al organizador para participar.</p>";}
 await renderAdmin();
}
window.handleGoogleCredential=async response=>{try{if(!response?.credential)throw new Error("Google no devolvió una credencial válida. Intenta nuevamente.");await api("/api/auth/google",{method:"POST",body:JSON.stringify({credential:response.credential})});await loadInvite();await checkSession();}catch(e){console.error("Error al completar el inicio de sesión:",e);showFeedback("No se pudo completar el inicio de sesión. Recarga la página e inténtalo nuevamente.",true);}};
async function initGoogle(){const c=await fetch("/api/config").then(r=>r.json());if(!c.googleClientId)return;const deadline=Date.now()+10000;while(!window.google?.accounts?.id&&Date.now()<deadline)await new Promise(r=>setTimeout(r,150));if(!window.google?.accounts?.id){showFeedback("No se pudo cargar Google. Intenta nuevamente.",true);return;}window.google.accounts.id.initialize({client_id:c.googleClientId,callback:window.handleGoogleCredential});window.google.accounts.id.renderButton($("#google-button"),{theme:"outline",size:"large",shape:"pill",text:"continue_with",width:280});}
await loadInvite();await checkSession();
if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
