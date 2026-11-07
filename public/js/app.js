const $ = selector => document.querySelector(selector);
const setClass = (selector, className, enabled) => { const el=$(selector); if(el) el.classList.toggle(className, !!enabled); return el; };
const params = new URLSearchParams(location.search);
const token = params.get("invite") || location.pathname.match(/\/unirse\/([^/]+)/)?.[1] || "";
let signedIn=false, currentUser=null, inviteValid=false, inviteEdition=null, communityPollTimer=null;
const apiMemoryCache=new Map();
const api=async(path,options={})=>{
 const method=(options.method||"GET").toUpperCase(),cacheable=method==="GET"&&!options.noMemoryCache;
 if(method!=="GET")apiMemoryCache.clear();
 if(cacheable){const cached=apiMemoryCache.get(path);if(cached&&Date.now()-cached.time<((path==="/api/community")?3500:8000))return cached.data;}
 const r=await fetch(path,{credentials:"same-origin",cache:"no-store",...options,headers:{"content-type":"application/json",...(options.headers||{})}});
 const raw=await r.text();let d;try{d=JSON.parse(raw);}catch{const html=raw.trimStart().startsWith("<!DOCTYPE")||raw.trimStart().startsWith("<html");throw new Error(html?"El servidor devolvió la página web en lugar de la API. Cloudflare aún no ha publicado la versión del servidor o la ruta no está disponible.":"El servidor devolvió una respuesta no válida.");}
 if(!r.ok)throw new Error(d.error||"Ocurrió un error.");
 if(cacheable)apiMemoryCache.set(path,{data:d,time:Date.now()});
 return d;
};
function prefetchMemberTabs(){
 const paths=["/api/secret/me","/api/community/clues","/api/wishes"];
 if(currentUser?.isPrimaryAdmin)paths.push("/api/admin/status","/api/admin/draw/status");
 const warm=()=>Promise.allSettled(paths.map(path=>api(path)));
 if("requestIdleCallback"in window)window.requestIdleCallback(warm,{timeout:1200});else setTimeout(warm,250);
}
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let snowFrame=0,snowflakes=[],snowCanvas=null,snowCtx=null,snowEnabled=false,snowWidth=0,snowHeight=0,snowLast=0;
function setSnowfall(enabled){
 snowCanvas ||= document.getElementById("seasonal-snow");
 if(!snowCanvas)return;
 snowEnabled=!!enabled;snowCanvas.classList.toggle("is-active",snowEnabled);
 if(snowEnabled&&!snowFrame){snowCtx=snowCanvas.getContext("2d",{alpha:true});resizeSnow();snowFrame=requestAnimationFrame(drawSnow);}
 if(!snowEnabled&&snowFrame){cancelAnimationFrame(snowFrame);snowFrame=0;if(snowCtx)snowCtx.clearRect(0,0,snowWidth,snowHeight);}
}
function resizeSnow(){
 if(!snowCanvas||!snowCtx)return;
 const dpr=Math.min(window.devicePixelRatio||1,1.5);snowWidth=window.innerWidth;snowHeight=window.innerHeight;
 snowCanvas.width=Math.round(snowWidth*dpr);snowCanvas.height=Math.round(snowHeight*dpr);snowCtx.setTransform(dpr,0,0,dpr,0,0);
 const count=Math.min(115,Math.max(55,Math.round(snowWidth*snowHeight/8500)));
 snowflakes=Array.from({length:count},()=>({x:Math.random()*snowWidth,y:Math.random()*snowHeight,r:1.6+Math.random()*3,v:.75+Math.random()*1.4,drift:-.35+Math.random()*.7,phase:Math.random()*Math.PI*2,alpha:.62+Math.random()*.35}));
}
function drawSnow(time){
 if(!snowEnabled||!snowCtx)return;snowFrame=requestAnimationFrame(drawSnow);
 if(time-snowLast<28)return;snowLast=time;snowCtx.clearRect(0,0,snowWidth,snowHeight);
 for(const f of snowflakes){f.y+=f.v;f.x+=f.drift+Math.sin(time*.0007+f.phase)*.28;if(f.y>snowHeight+5){f.y=-5;f.x=Math.random()*snowWidth;}if(f.x<-5)f.x=snowWidth+5;if(f.x>snowWidth+5)f.x=-5;snowCtx.beginPath();snowCtx.arc(f.x,f.y,f.r,0,Math.PI*2);snowCtx.fillStyle="rgba(255,255,255,"+f.alpha+")";snowCtx.fill();}
}
window.addEventListener("resize",()=>{if(snowEnabled)resizeSnow()},{passive:true});

function setLoginView(){
 setSnowfall(true);
  setClass("#hero","hidden",true);setClass("#features","hidden",true);setClass("#site-footer","hidden",true);
  const card=$("#join-card");if(!card)return;card.classList.remove("hidden");
  $("#join-card").innerHTML=`<div class="login-brand"><span>🎄</span><p class="kicker">CLIENTE 360 · NAVIDAD 2026</p><h1>Navidad Cliente 360</h1><p>Una Navidad, muchas sorpresas.</p></div><div id="login-context" class="login-context">${token?"Inicia sesión con Google para validar tu invitación y unirte a la celebración.":"Inicia sesión con tu cuenta de Google para continuar."}</div><div id="google-button" class="google-button"></div><div id="login-feedback" class="status hidden" role="status"></div><div class="privacy-note">🔒 Tu participación y tu asignación secreta estarán protegidas.</div>`;
}
function showFeedback(message,error=false){const el=$("#login-feedback");if(!el)return;el.textContent=message;el.classList.remove("hidden","error");if(error)el.classList.add("error");}
async function loadInvite(){if(!token)return;try{const r=await api("/api/invitations/"+encodeURIComponent(token));inviteValid=true;inviteEdition=r.edition;}catch{inviteValid=false;}}
function showProfileForm(profile=null){
 setSnowfall(false);
 const card=$("#join-card");card.classList.remove("hidden");card.innerHTML=`<div class="card-heading"><div class="icon-bubble">👤</div><div><p class="kicker">TU PERFIL DE PARTICIPANTE</p><h2>¿Cómo te llamas?</h2></div></div><p class="muted">Escribe tus nombres y apellidos reales. Estos datos serán utilizados para identificarte durante el sorteo; no mostraremos tu correo como nombre.</p><form id="participant-profile-form" class="profile-form"><label>Nombres<input name="firstName" autocomplete="given-name" maxlength="80" required value="${esc(profile?.first_name||"")}"></label><label>Apellidos<input name="lastName" autocomplete="family-name" maxlength="100" required value="${esc(profile?.last_name||"")}"></label><button class="primary-button" type="submit">Guardar mi nombre <span>→</span></button></form><div id="profile-feedback" class="status hidden" role="status"></div>`;
 $("#participant-profile-form").addEventListener("submit",async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));const fb=$("#profile-feedback");try{await api("/api/profile/participant",{method:"POST",body:JSON.stringify(values)});currentUser=await api("/api/me");renderMemberApp();}catch(err){fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}});
}
function renderMemberApp(){
 setSnowfall(true);
 setClass("#join-card","hidden",true);setClass("#admin-panel","hidden",true);
 let app=$("#member-app");app.classList.remove("hidden");
 const name=currentUser.participantProfile?.first_name||currentUser.user.display_name||"Participante";
 const budgetAmount=currentUser.membership?.budget_amount;
 const budgetCurrency=currentUser.membership?.currency||"PEN";
 const budgetLabel=budgetAmount==null?"Por definir":new Intl.NumberFormat("es-PE",{style:"currency",currency:budgetCurrency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(budgetAmount));
 const homeMarkup=`<section class="member-welcome"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h1>¡Hola, ${esc(name)}! 🎄</h1><p>Tu espacio para compartir la magia de esta Navidad.</p><div class="member-countdown" id="member-countdown"></div></section><section class="exchange-budget-card" aria-label="Información importante del intercambio"><div class="exchange-budget-icon" aria-hidden="true">🎁</div><div class="exchange-budget-copy"><span class="exchange-budget-kicker">TEN PRESENTE</span><h2>Monto del intercambio</h2><p>Presupuesto acordado por participante</p></div><div class="exchange-budget-amount">${esc(budgetLabel)}</div><div class="exchange-location"><div class="exchange-detail-row"><span class="exchange-detail-icon">📍</span><div><b>Lugar del intercambio</b><p>Av. Oscar R. Benavides 611, Dpto. 701, Cercado de Lima</p><small>Casa de Marcos</small></div></div><div class="exchange-detail-row"><span class="exchange-detail-icon">🕘</span><div><b>Horario</b><p>Desde las 9:00 a. m.</p></div></div><p class="exchange-breakfast">🥪 Llega temprano para desayunar su respectivo Chicharrón de El Chinito</p><a class="exchange-map-link" href="https://maps.app.goo.gl/rueCMQujUGvwxFoY9" target="_blank" rel="noopener noreferrer">Abrir ubicación en Google Maps ↗</a><div class="exchange-map-preview"><iframe title="Mapa de la ubicación del intercambio en Cercado de Lima" src="https://www.google.com/maps?q=Av.%20Oscar%20R.%20Benavides%20611%2C%20Cercado%20de%20Lima&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div></div></section><figure class="home-team-photo-wrap"><img class="home-team-photo" src="/images/equipo-navidad-2026.webp" alt="Equipo Cliente 360 reunido para celebrar la Navidad" loading="eager" fetchpriority="high"></figure>`
 app.innerHTML=`<section class="member-home" id="member-tab-content">${homeMarkup}</section><nav class="bottom-nav" aria-label="Menú principal"><button class="active" data-tab="home"><span>⌂</span>Inicio</button><button data-tab="secret"><span>🎁</span>Mi secreto</button><button data-tab="community" aria-label="Mensajes"><span>✉️</span>Mensajes <span class="nav-unread-badge" id="community-unread-badge" hidden></span></button><button data-tab="wishes"><span>💝</span>Deseos</button><button data-tab="profile"><span>👥</span>Mi equipo</button>${currentUser.isPrimaryAdmin?'<button data-tab="admin-settings"><span>⚙️</span>Ajustes</button>':""}</nav>`;
 updateMemberCountdown(currentUser.membership?.event_date);

 prefetchMemberTabs();
 if(communityPollTimer)clearInterval(communityPollTimer);
 updateCommunityUnreadBadge();
 communityPollTimer=setInterval(updateCommunityUnreadBadge,45000);
 app.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{setSnowfall(btn.dataset.tab==="home");app.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===btn));if(btn.dataset.tab==="profile"){showProfileSettings();return;}if(btn.dataset.tab==="admin-settings"){showAdminSettings();return;}if(btn.dataset.tab==="secret"){renderSecretTab();return;}if(btn.dataset.tab==="wishes"){renderWishesTab();return;}if(btn.dataset.tab==="community"){renderCommunityTab();return;}const labels={home:"Inicio",secret:"Mi amigo secreto",community:"Mensajes",wishes:"Lista de deseos"};if(btn.dataset.tab!=="home"){const section=app.querySelector(".member-home");section.innerHTML=`<div class="member-section-heading"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h2>${labels[btn.dataset.tab]}</h2></div><article class="member-feature"><span>${btn.dataset.tab==="secret"?"🎁":btn.dataset.tab==="community"?"💬":"💝"}</span><div><b>${labels[btn.dataset.tab]}</b><p>Esta funcionalidad se habilitará en su fase correspondiente del proyecto.</p></div><small>Próximamente</small></article>`;}else{renderMemberApp();}}));
 const requestedTab=new URLSearchParams(location.search).get("tab");
 if(requestedTab==="community")app.querySelector('[data-tab="community"]')?.click();
}
async function loadProfileParticipants(){
 const list=$("#profile-participants-list"),count=$("#profile-participants-count");
 if(!list||!count)return;
 try{
  const data=await api(currentUser?.isPrimaryAdmin?"/api/admin/participants":"/api/participants",{noMemoryCache:true});
  const participants=data.participants||[];
  const active=participants.filter(p=>p.status==="confirmed"||!p.status);
  count.textContent="("+active.length+")";
  list.innerHTML=participants.length?participants.map((p,index)=>{
   const initials=String(p.display_name||"Participante").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase();
   const avatar=p.avatar_url&&/^https:\/\//i.test(p.avatar_url)?'<img src="'+esc(p.avatar_url)+'" alt="">':esc(initials||"🎄");
   const inactive=p.status&&p.status!=="confirmed";
   const action=currentUser?.isPrimaryAdmin?'<button class="home-participant-toggle" data-home-user="'+esc(p.user_id)+'" data-home-active="'+(inactive?"0":"1")+'">'+(inactive?"Reactivar":"Desactivar")+'</button>':"";
   return '<article class="home-participant-row'+(inactive?" is-inactive":"")+'"><span class="home-participant-avatar">'+avatar+'</span><span class="home-participant-name">'+esc(p.display_name||"Participante")+(inactive?'<small>Desactivado por el administrador</small>':"")+'</span><span class="home-participant-number">'+(inactive?"PAUSADO":String(index+1).padStart(2,"0"))+'</span>'+action+'</article>';
  }).join(""):'<p class="participants-empty">Todavía no hay participantes inscritos.</p>';
  if(currentUser?.isPrimaryAdmin&&!list.dataset.adminActions){
   list.dataset.adminActions="1";
   list.addEventListener("click",async event=>{
    const button=event.target.closest("[data-home-user]");if(!button)return;
    button.disabled=true;
    try{
     await api("/api/admin/participants/"+encodeURIComponent(button.dataset.homeUser),{method:"PATCH",body:JSON.stringify({active:button.dataset.homeActive!=="1"})});
     await loadProfileParticipants();
    }catch(error){button.disabled=false;button.textContent=error.message;}
   });
  }
 }catch(error){
  count.textContent="(—)";
  list.innerHTML='<p class="participants-empty">No se pudo cargar la lista. Vuelve a intentarlo más tarde.</p>';
 }
}
async function showAdminSettings(){
 const home=$("#member-app .member-home"); if(!currentUser?.isPrimaryAdmin||!home)return;
 home.innerHTML='<div class="admin-settings-view"><div class="settings-header"><span>⚙️</span><div><h2>Ajustes del intercambio</h2><p>Configuración general de la edición.</p></div></div><div id="edition-settings-feedback" class="status hidden"></div><form id="edition-settings-form" class="edition-settings-form"><label>Nombre del intercambio<input name="title" maxlength="100" required></label><label>Fecha del intercambio<input name="eventDate" type="date"></label><label>Presupuesto por persona (S/) <input name="budgetAmount" type="number" min="0" step="0.01" placeholder="Ej. 80"></label><button class="primary-button" type="submit">Guardar ajustes</button></form><p class="settings-note">Los ajustes se pueden modificar mientras el sorteo no se haya realizado.</p><div id="draw-admin-controls"></div><div class="admin-tools-section"><div id="admin-tools-slot"></div></div></div>';
 let adminPanel=$("#admin-panel");if(!adminPanel){adminPanel=document.createElement("section");adminPanel.id="admin-panel";adminPanel.className="admin-panel";}$("#admin-tools-slot").append(adminPanel);adminPanel.classList.remove("hidden");await renderAdmin();
 try{await loadAdminDrawControls();}catch(error){const slot=$("#draw-admin-controls");if(slot)slot.innerHTML=`<div class="status error">${esc(error.message)}</div>`;}
 try{
  const data=await api("/api/admin/status");const e=data.edition||{};const form=$("#edition-settings-form");
  form.elements.title.value=e.title||"";form.elements.eventDate.value=e.event_date||"";form.elements.budgetAmount.value=e.budget_amount??"";
  if(e.status!=="registration"){form.querySelector("button").disabled=true;form.querySelectorAll("input").forEach(x=>x.disabled=true);$("#edition-settings-feedback").textContent="Los ajustes están bloqueados porque el sorteo ya fue realizado o la edición terminó.";$("#edition-settings-feedback").classList.remove("hidden");}
  form.addEventListener("submit",async ev=>{ev.preventDefault();const values=Object.fromEntries(new FormData(form));const fb=$("#edition-settings-feedback");try{await api("/api/admin/edition",{method:"PATCH",body:JSON.stringify(values)});currentUser=await api("/api/me");updateMemberCountdown(currentUser.membership?.event_date);fb.textContent="Los ajustes del intercambio se guardaron correctamente.";fb.classList.remove("hidden","error");}catch(err){fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}});
 }catch(err){const fb=$("#edition-settings-feedback");fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}
}
async function loadAdminDrawControls(){
 const host=$("#draw-admin-controls");if(!host||!currentUser?.isPrimaryAdmin)return;
 host.innerHTML='<div class="draw-admin-card"><h3>Preparación y sorteo</h3><p>Valida a los participantes y ejecuta el sorteo cuando todos estén listos.</p><div id="draw-admin-status" class="draw-status">Consultando estado…</div><div id="draw-admin-actions"></div><div id="draw-admin-feedback" class="status hidden"></div></div>';
 try{
  const d=await api("/api/admin/draw/status");
  const status=$("#draw-admin-status"),actions=$("#draw-admin-actions");
  const readyText=d.state==="drawn"?"Sorteo realizado":d.state==="ready"?"Todos listos · pendiente de ejecutar":"Inscripción y preparación";
  status.innerHTML='<div class="draw-stats"><span><b>'+d.participants+'</b> participantes activos</span><span><b>'+d.missingProfiles+'</b> perfiles incompletos</span><span><b>'+d.exclusions+'</b> exclusiones</span></div><p class="draw-state-label">'+readyText+'</p>';
  if(d.state==="drawn"){
   actions.innerHTML='<p class="draw-success">El sorteo está activo. Cada participante puede consultar únicamente su asignación en Mi amigo secreto.</p><button id="reset-draw-button" class="admin-action danger-action">Volver a sortear</button><small>Esto eliminará las asignaciones actuales y conservará los perfiles, exclusiones y el historial de las demás secciones.</small>';
   $("#reset-draw-button").addEventListener("click",async()=>{if(!confirm("¿Estás seguro de volver a sortear? Se eliminarán las asignaciones actuales para todos los participantes, pero se conservarán los perfiles, exclusiones y el historial de las demás secciones."))return;const confirmation="VOLVER A SORTEAR";try{await api("/api/admin/draw/reset",{method:"POST",body:JSON.stringify({confirmation})});await loadAdminDrawControls();const fb=$("#draw-admin-feedback");fb.textContent="Asignaciones anteriores eliminadas. Ya puedes incorporar participantes y preparar un nuevo sorteo.";fb.classList.remove("hidden","error");}catch(e){const fb=$("#draw-admin-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
  }else if(d.state==="ready"){
   actions.innerHTML='<p class="draw-ready">La lista fue validada. Solo el administrador puede ejecutar el sorteo.</p><button id="execute-draw-button" class="admin-action">Ejecutar sorteo</button>';
   $("#execute-draw-button").addEventListener("click",async()=>{if(!confirm("¿Confirmas ejecutar el sorteo? Las asignaciones serán privadas y no se podrán editar individualmente."))return;try{const result=await api("/api/admin/draw/execute",{method:"POST",body:JSON.stringify({})});const fb=$("#draw-admin-feedback");fb.textContent="Sorteo realizado correctamente para "+result.participants+" participantes.";fb.classList.remove("hidden","error");await loadAdminDrawControls();}catch(e){const fb=$("#draw-admin-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
  }else{
   actions.innerHTML='<button id="mark-ready-button" class="admin-action" '+(d.participants<2||d.missingProfiles>0?'disabled':'')+'>Confirmar que todos están listos</button><small>Se requiere al menos 2 participantes activos y todos deben tener nombres y apellidos completos.</small>';
   $("#mark-ready-button").addEventListener("click",async()=>{try{await api("/api/admin/draw/ready",{method:"POST",body:JSON.stringify({})});await loadAdminDrawControls();const fb=$("#draw-admin-feedback");fb.textContent="Todos están listos. Ya puedes ejecutar el sorteo desde aquí.";fb.classList.remove("hidden","error");}catch(e){const fb=$("#draw-admin-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
  }
 }catch(e){const fb=$("#draw-admin-feedback");if(fb){fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}}
}
async function compressWishImage(file){
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Elige una imagen JPG, PNG o WEBP.");
 if(file.size>2*1024*1024)throw new Error("La imagen original no debe superar 2 MB.");
 const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("No se pudo leer la imagen."));img.src=reader.result;};reader.onerror=()=>reject(new Error("No se pudo leer el archivo."));reader.readAsDataURL(file);});
 const scale=Math.min(1,800/Math.max(image.width,image.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
 const data=canvas.toDataURL("image/jpeg",.72);if(data.length>280000)throw new Error("La imagen sigue siendo muy pesada. Prueba con otra imagen más pequeña.");return data;
}

async function updateCommunityUnreadBadge(){
 const badge=$("#community-unread-badge");if(!badge||!currentUser?.authenticated)return;
 try{const data=await api("/api/community/unread",{noMemoryCache:true});const count=Number(data.unread||0);badge.textContent=count>9?"9+":String(count);badge.hidden=count===0;badge.setAttribute("aria-label",count+" mensajes sin leer");}
 catch{badge.hidden=true;}
}
function urlBase64ToUint8Array(value){
 const padding="=".repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");
 const raw=atob(base64);return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function enablePushNotifications(button){
 const original=button.textContent;button.disabled=true;button.textContent="Activando…";
 try{
  if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window))throw new Error("Este navegador no admite notificaciones push.");
  const config=await api("/api/push/public-key");
  if(!config.publicKey)throw new Error("El servidor aún no tiene configuradas las claves de notificaciones.");
  const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
  if(permission!=="granted")throw new Error("No se concedió permiso para mostrar notificaciones.");
  const registration=await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(config.publicKey)});
  await api("/api/push/subscribe",{method:"POST",body:JSON.stringify(subscription)});
  button.textContent="Notificaciones activadas ✓";button.classList.add("push-enabled");
 }catch(error){
  button.disabled=false;button.textContent=original;
  const feedback=$("#push-feedback");if(feedback){feedback.textContent=error.message;feedback.classList.remove("hidden");feedback.classList.add("error");}
 }
}

function formatCommunityTime(value){
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return "";
 return new Intl.DateTimeFormat("es-PE",{dateStyle:"medium",timeStyle:"short"}).format(date);
}

async function renderCommunityTab(){
 const section=$("#member-app .member-home");if(!section)return;
 section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h2>Buzón secreto ✉️</h2><p>Deja un mensaje anónimo para tu amigo secreto y revisa las sorpresas que te envíe.</p></div><div class="tab-skeleton" aria-label="Preparando buzón"><span></span><span></span><span></span></div>';
 try{
  const clues=await api("/api/community/clues");
  let messageMarkup="";
  if(clues.state==="not_assigned")messageMarkup='<div class="clue-locked"><span>🎁</span><div><b>Tu buzón estará listo pronto</b><p>Cuando el organizador te asigne un amigo secreto, podrás enviarle mensajes anónimos.</p></div></div>';
  else if(clues.state!=="drawn")messageMarkup='<div class="clue-locked"><span>🔐</span><div><b>El buzón se abrirá después del sorteo</b><p>Una vez realizado el sorteo, podrás dejar mensajes anónimos a tu amigo secreto y recibir los suyos.</p></div></div>';
  else messageMarkup='<div class="clue-recieved-list">'+(clues.clues||[]).map(c=>'<article class="clue-received"><span>💌</span><div><b>Un mensaje para ti</b><p>'+esc(c.message)+'</p><time>'+formatCommunityTime(c.created_at)+'</time></div></article>').join('')+'</div>' + (!(clues.clues||[]).length?'<div class="community-empty clue-empty"><span>💌</span><b>Tu buzón está esperando</b><p>Aún no recibes mensajes. ¡Tu amigo secreto podría sorprenderte pronto!</p></div>':'')+'<div class="clue-compose"><div class="clue-compose-heading"><div><span class="wish-kicker">UN DETALLE EN SECRETO</span><h3>Dejar un mensaje</h3></div><span class="wish-count">'+clues.sentCount+' / '+clues.limit+'</span></div><form id="clue-form"><label for="clue-message">Escribe algo para tu amigo secreto</label><textarea id="clue-message" name="message" maxlength="240" rows="3" placeholder="Ej. ¡Espero que tengas una Navidad increíble! 🎄" required '+(clues.sentCount>=clues.limit?'disabled':'')+'></textarea><div class="clue-compose-footer"><small>Tu identidad permanecerá en secreto. Puedes enviar hasta 5 mensajes.</small><button class="primary-button" type="submit" '+(clues.sentCount>=clues.limit?'disabled':'')+'>Enviar mensaje →</button></div><div id="clue-feedback" class="status hidden"></div></form></div>';
  section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h2>Buzón secreto ✉️</h2><p>Un espacio privado para dejarle mensajes anónimos a tu amigo secreto y recibir los suyos.</p></div><div class="push-settings"><div><b>Entérate al instante</b><p>Recibe un aviso cuando tu amigo secreto te deje una pista.</p></div><button type="button" id="enable-push-notifications" class="secondary-action">🔔 Activar notificaciones</button><div id="push-feedback" class="status hidden" role="status"></div></div><section class="community-clues">'+messageMarkup+'</section>';
  const pushButton=$("#enable-push-notifications");if(pushButton)pushButton.addEventListener("click",()=>enablePushNotifications(pushButton));
  updateCommunityUnreadBadge();
  const clueForm=$("#clue-form");if(clueForm)clueForm.addEventListener("submit",async ev=>{ev.preventDefault();const form=ev.currentTarget;const fb=$("#clue-feedback");const send=form.querySelector('button[type="submit"]');send.disabled=true;try{await api("/api/community/clues",{method:"POST",body:JSON.stringify({message:form.elements.message.value})});await renderCommunityTab();}catch(e){fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");send.disabled=false;}});
 }catch(e){section.innerHTML='<div class="member-section-heading"><h2>Buzón secreto</h2></div><p class="status error">'+esc(e.message)+'</p>';}
}
async function renderWishesTab(){
 const section=$("#member-app .member-home");if(!section)return;
 section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h2>Lista de deseos 💝</h2><p>Pequeñas ideas para inspirar el regalo perfecto.</p></div><div class="tab-skeleton" aria-label="Preparando deseos"><span></span><span></span><span></span></div>';
 try{
  const data=await api("/api/wishes");
  const mine=data.wishes||[];
  const wishCards=(items,removable)=>items.map((w,index)=>'<article class="wish-card">'+(w.image_data?'<div class="wish-image-link"><img class="wish-image" src="'+w.image_data+'" alt="Imagen adjunta de '+esc(w.title)+'" loading="lazy"></div>':'<div class="wish-card-icon" aria-hidden="true">🎁</div>')+'<div class="wish-card-content"><span class="wish-number">DESEO '+String(index+1).padStart(2,"0")+'</span><h4>'+esc(w.title)+'</h4>'+(w.note?'<p>'+esc(w.note)+'</p>':'')+(w.url?'<a class="wish-link" href="'+esc(w.url)+'" target="_blank" rel="noopener noreferrer"><span>↗</span> Ver referencia</a>':'')+(w.image_data?'<button type="button" class="wish-view-image" data-view-image="'+esc(w.id)+'">⌕ Ver imagen</button>':'')+'</div>'+(removable?'<div class="wish-card-actions"><button class="wish-edit" data-edit-wish="'+esc(w.id)+'" aria-label="Editar '+esc(w.title)+'" title="Editar deseo">✎</button><button class="wish-delete" data-delete-wish="'+esc(w.id)+'" aria-label="Eliminar '+esc(w.title)+'" title="Eliminar deseo">×</button></div>':'')+'</article>').join('');
  const recipient=data.canSeeRecipientWishes?'<section class="recipient-wishes"><div class="wish-section-heading"><div><span class="wish-kicker">INSPIRACIÓN PARA TU REGALO</span><h3>Los deseos de '+esc(data.recipientName)+'</h3></div><span class="wish-heading-icon">✨</span></div><p class="wish-section-description">Estas son algunas ideas que compartió tu amigo secreto. ¡La sorpresa sigue siendo tuya!</p>'+(data.recipientWishes.length?'<div class="wish-card-list">'+wishCards(data.recipientWishes,false)+'</div>':'<p class="wish-empty">Todavía no ha agregado deseos.</p>')+'</section>':'<div class="wish-privacy"><span>🔒</span><p><b>Tu lista es privada</b><small>Solo la persona que te tenga asignado podrá consultar tus deseos después del sorteo.</small></p></div>';
  section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h2>Lista de deseos 💝</h2><p>Comparte lo que te gustaría recibir y ayuda a tu amigo secreto a encontrar el regalo ideal.</p></div><section class="wish-editor"><div class="wish-section-heading"><div><span class="wish-kicker">TU LISTA PERSONAL</span><h3>Agregar un deseo</h3></div><span class="wish-heading-icon">✍️</span></div><form id="wish-form"><label>Nombre del regalo<input name="title" maxlength="100" placeholder="Ej. Figura de colección de Seiya" required></label><label>Detalles o características <span>(opcional)</span><textarea name="note" maxlength="300" rows="2" placeholder="Color, modelo, tamaño o cualquier detalle útil…"></textarea></label><label>Enlace de referencia <span>(opcional)</span><input name="url" type="url" placeholder="https://…"></label><label>Imagen de referencia <span>(opcional · JPG, PNG o WEBP; máx. 2 MB)</span><input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="wish-image-preview hidden" id="wish-new-image-preview"></div><small class="wish-image-help">Si no tienes un enlace, puedes adjuntar una foto del producto.</small><div class="wish-form-footer"><small>'+mine.length+' de 10 deseos</small><button class="primary-button" type="submit" '+(mine.length>=10?'disabled':'')+'>＋ Agregar deseo</button></div><div id="wish-feedback" class="status hidden"></div></form></section><section class="wish-list"><div class="wish-section-heading"><div><span class="wish-kicker">TUS IDEAS FAVORITAS</span><h3>Mis deseos</h3></div><span class="wish-count">'+mine.length+' / 10</span></div>'+(mine.length?'<div class="wish-card-list">'+wishCards(mine,true)+'</div>':'<div class="wish-empty-state"><span>🎁</span><b>Tu lista está esperando ideas</b><p>Agrega ese regalo que te haría ilusión recibir esta Navidad.</p></div>')+'</section>'+recipient;
  $("#wish-form").elements.imageFile.addEventListener("change",async ev=>{const preview=$("#wish-new-image-preview");preview.classList.add("hidden");preview.innerHTML="";const file=ev.target.files[0];if(!file)return;try{const data=await compressWishImage(file);preview.innerHTML='<img src="'+data+'" alt="Vista previa de la imagen seleccionada"><button type="button" class="wish-image-remove">Quitar imagen</button>';preview.classList.remove("hidden");preview.querySelector("button").addEventListener("click",()=>{ev.target.value="";preview.classList.add("hidden");preview.innerHTML="";});}catch(e){const fb=$("#wish-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");ev.target.value="";}});
  $("#wish-form").addEventListener("submit",async ev=>{ev.preventDefault();const form=ev.currentTarget;const values=Object.fromEntries(new FormData(form));const file=form.elements.imageFile.files[0];const fb=$("#wish-feedback");try{if(file)values.imageData=await compressWishImage(file);delete values.imageFile;await api("/api/wishes",{method:"POST",body:JSON.stringify(values)});await renderWishesTab();}catch(e){fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
  section.querySelectorAll("[data-view-image]").forEach(btn=>btn.addEventListener("click",()=>{
   const wish=mine.find(item=>item.id===btn.dataset.viewImage)||((data.recipientWishes||[]).find(item=>item.id===btn.dataset.viewImage));
   if(!wish?.image_data)return;
   const modal=document.createElement("div");modal.className="wish-image-modal";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label","Imagen de referencia: "+wish.title);
   modal.innerHTML='<div class="wish-image-modal-panel"><div class="wish-image-modal-header"><div><span>IMAGEN DE REFERENCIA</span><h3>'+esc(wish.title)+'</h3></div><button type="button" class="wish-image-modal-close" aria-label="Cerrar">×</button></div><div class="wish-image-modal-stage"><img src="'+wish.image_data+'" alt="Imagen de referencia para '+esc(wish.title)+'"></div><p class="wish-image-modal-caption">Imagen compartida en la lista de deseos</p></div>';
   const close=()=>{modal.remove();document.removeEventListener("keydown",onKey);};
   const onKey=e=>{if(e.key==="Escape")close();};
   modal.addEventListener("click",e=>{if(e.target===modal)close();});
   modal.querySelector(".wish-image-modal-close").addEventListener("click",close);
   document.addEventListener("keydown",onKey);document.body.appendChild(modal);modal.querySelector(".wish-image-modal-close").focus();
  }));
  section.querySelectorAll("[data-edit-wish]").forEach(btn=>btn.addEventListener("click",()=>{
   const wish=mine.find(item=>item.id===btn.dataset.editWish);if(!wish)return;
   const card=btn.closest(".wish-card");if(!card)return;
   card.innerHTML='<form class="wish-inline-edit" data-wish-edit-form="'+esc(wish.id)+'"><div class="wish-edit-heading"><b>Editar deseo</b><button type="button" class="wish-edit-cancel">Cancelar</button></div><label>Nombre del regalo<input name="title" maxlength="100" required value="'+esc(wish.title)+'"></label><label>Detalles o características<textarea name="note" maxlength="300" rows="2">'+esc(wish.note||"")+'</textarea></label><label>Enlace de referencia<input name="url" type="url" value="'+esc(wish.url||"")+'" placeholder="https://…"></label><label>Imagen de referencia <span>(opcional · JPG, PNG o WEBP)</span><input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"></label>'+(wish.image_data?'<div class="wish-image-preview"><img src="'+wish.image_data+'" alt="Imagen actual"><label class="wish-remove-image-label"><input type="checkbox" name="removeImage" value="1"> Quitar imagen actual</label></div>':'<div class="wish-image-preview hidden"></div>')+'<div class="wish-edit-actions"><button type="button" class="wish-edit-cancel secondary">Cancelar</button><button type="submit" class="primary-button">Guardar cambios</button></div><div class="wish-edit-feedback status hidden"></div></form>';
   const form=card.querySelector("form");
   const editFile=form.elements.imageFile;editFile.addEventListener("change",async ev=>{const preview=form.querySelector(".wish-image-preview");const file=ev.target.files[0];if(!file)return;try{const data=await compressWishImage(file);preview.innerHTML='<img src="'+data+'" alt="Vista previa de la nueva imagen">';preview.classList.remove("hidden");}catch(e){const feedback=form.querySelector(".wish-edit-feedback");feedback.textContent=e.message;feedback.classList.remove("hidden");feedback.classList.add("error");ev.target.value="";}});
   form.querySelectorAll(".wish-edit-cancel").forEach(cancel=>cancel.addEventListener("click",()=>renderWishesTab()));
   form.addEventListener("submit",async ev=>{ev.preventDefault();const values=Object.fromEntries(new FormData(form));const file=form.elements.imageFile.files[0];values.removeImage=!!form.elements.removeImage?.checked;delete values.imageFile;const feedback=form.querySelector(".wish-edit-feedback");const save=form.querySelector('button[type="submit"]');save.disabled=true;save.textContent="Guardando…";try{if(file)values.imageData=await compressWishImage(file);await api("/api/wishes/"+encodeURIComponent(wish.id),{method:"PUT",body:JSON.stringify(values)});await renderWishesTab();}catch(e){feedback.textContent=e.message;feedback.classList.remove("hidden");feedback.classList.add("error");save.disabled=false;save.textContent="Guardar cambios";}});
  }));
  section.querySelectorAll("[data-delete-wish]").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm("¿Eliminar este deseo de tu lista?"))return;try{await api("/api/wishes/"+encodeURIComponent(btn.dataset.deleteWish),{method:"DELETE"});await renderWishesTab();}catch(e){const fb=$("#wish-feedback");if(fb){fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}}}));
 }catch(e){section.innerHTML='<div class="member-section-heading"><h2>Lista de deseos</h2></div><p class="status error">'+esc(e.message)+'</p>';}
}
async function renderSecretTab(){
 const section=$("#member-app .member-home");if(!section)return;
 section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h2>Mi amigo secreto</h2></div><div class="tab-skeleton tab-skeleton-compact" aria-label="Consultando tu asignación"><span></span><span></span></div>';
 try{
  const data=await api("/api/secret/me");
  if(data.state==="drawn")section.innerHTML='<div class="member-section-heading"><p class="kicker">TU ASIGNACIÓN SECRETA</p><h2>Tu amigo secreto 🎁</h2></div><article class="secret-reveal"><span>🎄</span><p>Este año te toca regalarle a</p><h2>'+esc(data.recipient.displayName)+'</h2><small>Recuerda mantenerlo en secreto 🤫</small></article>';
  else if(data.state==="ready")section.innerHTML='<div class="member-section-heading"><p class="kicker">MI AMIGO SECRETO</p><h2>¡Ya casi! 🎁</h2></div><article class="secret-waiting"><span>✨</span><h3>Todos están listos</h3><p>El administrador está por realizar el sorteo. Cuando termine, aquí descubrirás a quién debes regalar.</p></article>';
  else if(data.state==="not_participating")section.innerHTML='<div class="member-section-heading"><h2>Mi amigo secreto</h2></div><p>No tienes una participación activa en esta edición.</p>';
  else if(data.state==="not_assigned")section.innerHTML='<div class="member-section-heading"><h2>Mi amigo secreto</h2></div><p>Tu participación se registró después del último sorteo. El administrador deberá volver a sortear para incluirte.</p>';
  else section.innerHTML='<div class="member-section-heading"><p class="kicker">MI AMIGO SECRETO</p><h2>El sorteo todavía no está listo</h2></div><article class="secret-waiting"><span>🎁</span><h3>Estamos preparando la celebración</h3><p>Cuando el administrador confirme que todos están listos y realice el sorteo, podrás descubrir tu asignación aquí.</p></article>';
 }catch(e){section.innerHTML='<div class="member-section-heading"><h2>Mi amigo secreto</h2></div><p class="status error">'+esc(e.message)+'</p>';}
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
 app.querySelector(".member-home").innerHTML=`<div class="member-section-heading"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h2>Mi equipo</h2><p>Consulta quiénes forman parte del intercambio y administra tu participación.</p></div><article class="member-feature"><span>👤</span><div><b>Mi perfil</b><p>${esc([profile.first_name,profile.last_name].filter(Boolean).join(" ")||currentUser.user.email)}</p><p>${esc(currentUser.user.email)}</p></div><button class="profile-action" id="edit-profile">Editar</button></article><section class="home-participants-card profile-participants-card" aria-labelledby="profile-participants-title"><div class="home-participants-heading"><div><span class="exchange-budget-kicker">EL EQUIPO QUE CELEBRA</span><h2 id="profile-participants-title">Lista de participantes <span id="profile-participants-count">(—)</span></h2></div><span class="home-participants-icon">🎄</span></div><div id="profile-participants-list" class="home-participants-list" aria-live="polite"><p class="participants-loading">Cargando participantes…</p></div></section><div class="profile-actions"><button id="withdraw-participation" class="secondary-action">Ya no quiero participar</button><button id="logout-button" class="secondary-action">Cerrar sesión</button></div><div id="profile-action-feedback" class="status hidden"></div>`;
 loadProfileParticipants();
 $("#edit-profile").addEventListener("click",()=>showProfileForm(currentUser.participantProfile));
 $("#logout-button").addEventListener("click",logout);
 $("#withdraw-participation").addEventListener("click",async()=>{if(!confirm("¿Seguro que deseas retirarte? Tu inscripción se eliminará de esta edición. Si deseas regresar, necesitarás una nueva invitación del organizador."))return;try{await api("/api/participation/withdraw",{method:"POST"});currentUser=await api("/api/me");renderRejoinView();}catch(e){const fb=$("#profile-action-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
}
function renderRejoinView(){
 setSnowfall(false);
 const app=$("#member-app");app.classList.remove("hidden");
 app.innerHTML=`<section class="member-welcome"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h1>Tu participación ha sido retirada</h1><p>Ya no formas parte de esta edición. Si deseas regresar más adelante, solicita una nueva invitación al organizador.</p></section><section class="member-home"><button id="logout-button" class="secondary-action">Cerrar sesión</button></section>`;
 $("#logout-button").addEventListener("click",logout);
}
async function logout(){if(communityPollTimer)clearInterval(communityPollTimer);try{await api("/api/auth/logout",{method:"POST"});}finally{location.href=location.pathname+(token?"?invite="+encodeURIComponent(token):"");}}
async function renderAdmin(){
 const panel=$("#admin-panel");if(!panel)return;
 if(!currentUser?.isPrimaryAdmin){panel.classList.add("hidden");return;}
 if(!panel.parentElement?.matches("#admin-tools-slot")){panel.classList.add("hidden");return;}
 panel.classList.remove("hidden");
 try{
  panel.innerHTML=`<section class="invite-management">
   <div class="management-heading"><div><h3>Invitación para participantes</h3><p>Un enlace único, válido durante 24 horas. Al generar otro, el anterior se desactiva.</p></div><span class="management-icon">✉️</span></div>
   <form id="invite-form" class="admin-form"><button class="admin-action" id="new-invite" type="submit">＋ Generar invitación</button></form>
   <div id="admin-result" aria-live="polite"></div>
  </section>`;
  $("#invite-form").addEventListener("submit",async ev=>{
   ev.preventDefault();
   const button=$("#new-invite"),result=$("#admin-result");
   button.disabled=true;button.textContent="Generando…";
   try{
    const r=await api("/api/admin/invitations",{method:"POST",body:JSON.stringify({})});
    const shareText="¡Estás invitado a Navidad Cliente 360! Únete desde este enlace: "+r.invitationUrl;
    const whatsappUrl="https://wa.me/?text="+encodeURIComponent(shareText);
    const expiry=new Date(r.expiresAt).toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"});
    result.innerHTML=`<div class="admin-result invite-created"><div class="invite-created-heading"><span>✓</span><div><b>Invitación generada</b><small>Válida hasta ${esc(expiry)}</small></div></div><a class="invite-url" href="${esc(r.invitationUrl)}" target="_blank" rel="noopener noreferrer">${esc(r.invitationUrl)}</a><a class="invite-whatsapp" href="${esc(whatsappUrl)}" target="_blank" rel="noopener noreferrer"><span>◉</span> Compartir por WhatsApp</a><p class="invite-note">Este enlace puede ser utilizado por todos los participantes durante su vigencia. Si generas otro, este quedará invalidado.</p></div>`;
   }catch(e){result.innerHTML=`<p class="admin-invite-error">${esc(e.message)}</p>`;}
   finally{button.disabled=false;button.textContent="＋ Generar invitación";}
  });
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
window.handleGoogleCredential=async response=>{try{if(!response?.credential)throw new Error("Google no devolvió una credencial válida. Intenta nuevamente.");await api("/api/auth/google",{method:"POST",body:JSON.stringify({credential:response.credential})});try{try {
  await loadInvite();
  await checkSession();
} catch (error) {
  console.error("No se pudo inicializar la sesión:", error);
  try {
    setLoginView();
    await initGoogle();
  } catch (loginError) {
    console.error("No se pudo inicializar Google:", loginError);
    showFeedback("No se pudo conectar con el servicio. Recarga la página e inténtalo nuevamente.", true);
  }
} finally {
  document.body.classList.remove("app-booting");
  const loader = $("#app-loader");
  if (loader) loader.remove();
}}catch(error){console.error("No se pudo inicializar la sesión:",error);setLoginView();try{await initGoogle();}catch(loginError){showFeedback("No se pudo conectar con el servicio. Recarga la página e inténtalo nuevamente.",true);}}finally{document.body.classList.remove("app-booting");const loader=$("#app-loader");if(loader)loader.remove();}}catch(e){console.error("Error al completar el inicio de sesión:",e);showFeedback("No se pudo completar el inicio de sesión. Recarga la página e inténtalo nuevamente.",true);}};
async function initGoogle(){const c=await fetch("/api/config").then(r=>r.json());if(!c.googleClientId)return;const deadline=Date.now()+10000;while(!window.google?.accounts?.id&&Date.now()<deadline)await new Promise(r=>setTimeout(r,150));if(!window.google?.accounts?.id){showFeedback("No se pudo cargar Google. Intenta nuevamente.",true);return;}window.google.accounts.id.initialize({client_id:c.googleClientId,callback:window.handleGoogleCredential});window.google.accounts.id.renderButton($("#google-button"),{theme:"outline",size:"large",shape:"pill",text:"continue_with",width:280});}
try {
  await loadInvite();
  await checkSession();
} catch (error) {
  console.error("No se pudo inicializar la sesión:", error);
  try {
    setLoginView();
    await initGoogle();
  } catch (loginError) {
    console.error("No se pudo inicializar Google:", loginError);
    showFeedback("No se pudo conectar con el servicio. Recarga la página e inténtalo nuevamente.", true);
  }
} finally {
  document.body.classList.remove("app-booting");
  const loader = $("#app-loader");
  if (loader) loader.remove();
}
if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
