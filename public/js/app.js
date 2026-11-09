const $ = selector => document.querySelector(selector);
const setClass = (selector, className, enabled) => { const el=$(selector); if(el) el.classList.toggle(className, !!enabled); return el; };
const params = new URLSearchParams(location.search);
const urlInvite = params.get("invite") || location.pathname.match(/\/unirse\/([^/]+)/)?.[1] || "";
if(urlInvite)sessionStorage.setItem("navidad_invite_token",urlInvite);
const token = urlInvite || sessionStorage.getItem("navidad_invite_token") || "";
const isWhatsAppInApp = /WhatsApp/i.test(navigator.userAgent) && !!token;

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
function formatExchangeDate(date){
 if(!date)return "Por definir";
 const parts=String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(!parts)return "Por definir";
 const value=new Date(Date.UTC(Number(parts[1]),Number(parts[2])-1,Number(parts[3]),12));
 const formatted=new Intl.DateTimeFormat("es-PE",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"}).format(value);
 return formatted.charAt(0).toLocaleUpperCase("es-PE")+formatted.slice(1);
}
function renderMemberApp(){
 setSnowfall(true);
 setClass("#join-card","hidden",true);setClass("#admin-panel","hidden",true);
 let app=$("#member-app");app.classList.remove("hidden");
 const name=currentUser.participantProfile?.first_name||currentUser.user.display_name||"Participante";
 const budgetAmount=currentUser.membership?.budget_amount;
 const budgetCurrency=currentUser.membership?.currency||"PEN";
 const exchangeDateLabel=formatExchangeDate(currentUser.membership?.event_date);
 const exchangeShareText="🎄 *NAVIDAD CLIENTE 360 · 2026*\n\n📅 *Fecha:* "+exchangeDateLabel+"\n🎁 *Montos del intercambio:*\n• Amigo Secreto: mínimo S/ 100\n• Dirty Santa: mínimo S/ 20\n\n📍 *Lugar:* Casa de Marcos\nAv. Oscar R. Benavides 611, Dpto. 701, Cercado de Lima\n🗺️ Google Maps: https://maps.app.goo.gl/rueCMQujUGvwxFoY9\n\n🥪 *Desayuno:* Chicharrón de El Chinito desde las 9:00 a. m.\n🍖 *Cuota para la parrilla:* Por definir.\n\n¡Nos vemos para compartir la magia de esta Navidad! 🎅";
 const budgetLabel=budgetAmount==null?"Por definir":new Intl.NumberFormat("es-PE",{style:"currency",currency:budgetCurrency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(budgetAmount));
 const homeMarkup=`<section class="member-welcome"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h1>¡Hola, ${esc(name)}! 🎄</h1><p>Tu espacio para compartir la magia de esta Navidad.</p><div class="member-countdown" id="member-countdown"></div></section><section class="exchange-budget-card" aria-label="Información importante del intercambio"><div class="exchange-budget-icon" aria-hidden="true">🎁</div><div class="exchange-budget-copy"><span class="exchange-budget-kicker">TEN PRESENTE</span><h2>Monto del intercambio</h2><div class="exchange-minimum-list"><div><span>Amigo Secreto</span><strong>Mínimo S/ 100</strong></div><div><span>Dirty Santa</span><strong>Mínimo S/ 20</strong></div></div></div><div class="exchange-location"><div class="exchange-detail-row"><span class="exchange-detail-icon">📅</span><div><b>Fecha: ${esc(exchangeDateLabel)}</b></div></div><div class="exchange-detail-row"><span class="exchange-detail-icon">📍</span><div><b>Lugar del intercambio</b><p>Av. Oscar R. Benavides 611, Dpto. 701, Cercado de Lima</p><small>Casa de Marcos</small></div></div><div class="exchange-detail-row"><span class="exchange-detail-icon">🍖</span><div><b>Cuota para la parrilla</b><p>Por definir</p></div></div><div class="exchange-detail-row"><span class="exchange-detail-icon">🕘</span><div><b>Horario</b><p>Desde las 9:00 a. m.</p></div></div><p class="exchange-breakfast">🥪 Llega temprano para desayunar su respectivo Chicharrón de El Chinito</p><a class="exchange-map-link" href="https://maps.app.goo.gl/rueCMQujUGvwxFoY9" target="_blank" rel="noopener noreferrer">Abrir ubicación en Google Maps ↗</a><div class="exchange-map-preview"><iframe title="Mapa de la ubicación del intercambio en Cercado de Lima" src="https://www.google.com/maps?q=Av.%20Oscar%20R.%20Benavides%20611%2C%20Cercado%20de%20Lima&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div><a class="exchange-whatsapp-share" href="https://wa.me/?text=${encodeURIComponent(exchangeShareText)}" target="_blank" rel="noopener noreferrer" aria-label="Compartir información del intercambio por WhatsApp"><span aria-hidden="true">◉</span> Compartir información por WhatsApp</a></div></section><figure class="home-team-photo-wrap"><img class="home-team-photo" src="/images/equipo-navidad-2026.webp" alt="Equipo Cliente 360 reunido para celebrar la Navidad" loading="eager" fetchpriority="high"></figure>`
 app.innerHTML=`<section class="member-home" id="member-tab-content">${homeMarkup}</section><nav class="bottom-nav" aria-label="Menú principal"><button class="active" data-tab="home"><span>⌂</span>Inicio</button><button data-tab="secret"><span>🎁</span>Mi secreto <span class="nav-unread-badge" id="secret-unread-badge" hidden></span></button><button data-tab="community" aria-label="Mensajes"><span>✉️</span>Mensajes <span class="nav-unread-badge" id="community-unread-badge" hidden></span></button><button data-tab="wishes"><span>💝</span>Deseos <span class="nav-unread-badge" id="wishes-unread-badge" hidden></span></button><button data-tab="spirit"><span>🎄</span>Espíritu <span class="nav-unread-badge" id="spirit-unread-badge" hidden></span></button><button data-tab="profile"><span>👥</span>Mi equipo</button>${currentUser.isPrimaryAdmin?'<button data-tab="admin-settings"><span>⚙️</span>Ajustes</button>':""}</nav>`;
 updateMemberCountdown(currentUser.membership?.event_date);

 prefetchMemberTabs();
 if(communityPollTimer)clearInterval(communityPollTimer);
 updateTabUnreadBadges();
 communityPollTimer=setInterval(updateTabUnreadBadges,45000);
 app.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{setSnowfall(btn.dataset.tab==="home");app.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===btn));if(btn.dataset.tab==="profile"){showProfileSettings();return;}if(btn.dataset.tab==="admin-settings"){showAdminSettings();return;}if(btn.dataset.tab==="secret"){renderSecretTab();return;}if(btn.dataset.tab==="wishes"){renderWishesTab();return;}if(btn.dataset.tab==="community"){renderCommunityTab();return;}if(btn.dataset.tab==="spirit"){renderSpiritTab();return;}const labels={home:"Inicio",secret:"Mi amigo secreto",community:"Mensajes",wishes:"Lista de deseos"};if(btn.dataset.tab!=="home"){const section=app.querySelector(".member-home");section.innerHTML=`<div class="member-section-heading"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h2>${labels[btn.dataset.tab]}</h2></div><article class="member-feature"><span>${btn.dataset.tab==="secret"?"🎁":btn.dataset.tab==="community"?"💬":"💝"}</span><div><b>${labels[btn.dataset.tab]}</b><p>Esta funcionalidad se habilitará en su fase correspondiente del proyecto.</p></div><small>Próximamente</small></article>`;}else{renderMemberApp();}}));
 const requestedTab=new URLSearchParams(location.search).get("tab");
 if(requestedTab==="community"){
  const cleanUrl=new URL(location.href);
  cleanUrl.searchParams.delete("tab");
  history.replaceState({}, "", cleanUrl.pathname+cleanUrl.search+cleanUrl.hash);
  app.querySelector('[data-tab="community"]')?.click();
 }
}

let spiritRecorder=null,spiritAudioChunks=[];
async function blobToDataUrl(blob){return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error("No se pudo procesar el audio."));r.readAsDataURL(blob);});}
async function renderSpiritTab(){
 const home=$("#member-app .member-home");if(!home)return;
 home.innerHTML='<div class="spirit-heading"><span>🎄</span><div><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h2>Espíritu Navideño</h2><p>Comparte, participa y contagia la alegría de estas fiestas. ¡El primer puesto se llevará un premio sorpresa!</p></div></div><div id="spirit-content"><div class="tab-skeleton"><span></span><span></span><span></span></div></div>';
 try{
  const data=await api("/api/spirit/board",{noMemoryCache:true}),host=$("#spirit-content"),challenge=data.challenge,ranking=data.ranking||[],submissions=data.submissions||[],medals=["🥇","🥈","🥉"];
  const rankMarkup=ranking.length?ranking.slice(0,3).map((p,i)=>'<article class="spirit-rank-row '+(p.user_id===currentUser.user.id?"is-me":"")+'"><span class="spirit-medal">'+medals[i]+'</span><span class="spirit-rank-name">'+esc(p.display_name)+(i===0&&Number(p.first_place_streak)>1?" 🔥 <small>"+Number(p.first_place_streak)+" días</small>":"")+(p.user_id===currentUser.user.id?'<small>¡Tú!</small>':"")+'</span><span class="spirit-rank-points">'+Number(p.points||0)+' pts</span></article>').join(""):'<p class="spirit-muted">Aún no hay puntos registrados. ¡Sé el primero en participar!</p>';
  const type=challenge?.challenge_type||"text",cfg=challenge?.config||{};
  const challengeMarkup=challenge?'<article class="spirit-challenge"><div class="spirit-challenge-top"><span>🎯 RETO ACTIVO</span><b>❤️ POR LIKES</b></div><h3>'+esc(challenge.title)+'</h3><p>'+esc(challenge.description)+'</p><small>Cada Me gusta de otro participante suma 1 punto (máximo 10 por publicación). La publicación más votada del día recibe 10 puntos extra; si hay empate, todos los primeros lugares reciben la bonificación.</small></article>':'<article class="spirit-challenge"><h3>¡Estamos preparando el próximo reto!</h3><p>El reto de hoy terminó a las 10:00 p. m. (hora Perú). Estamos en pausa hasta las 9:00 a. m., cuando se abrirá el siguiente reto. ¡Vuelve mañana para seguir sumando! 🎄</p></article>';
  let field=type==="photo"?'<label class="spirit-file-label">📷 Sube tu foto<input name="media" type="file" accept="image/jpeg,image/png,image/webp" required></label><label>Comentario (opcional)<textarea name="caption" maxlength="500"></textarea></label>':type==="voice"?'<div class="spirit-voice-recorder"><button type="button" class="admin-action" data-spirit-record>🎙️ Iniciar grabación</button><span id="spirit-record-status">Máximo 30 segundos</span><audio id="spirit-audio-preview" controls class="hidden"></audio></div><label>Comentario (opcional)<textarea name="caption" maxlength="300"></textarea></label>':type==="trivia"?'<fieldset class="spirit-trivia-options"><legend>'+esc(cfg.question||"Elige la respuesta correcta")+'</legend>'+(cfg.options||[]).map(o=>'<label><input type="radio" name="answer" value="'+esc(o)+'" required><span>'+esc(o)+'</span></label>').join("")+'</fieldset>':'<label>Tu participación<textarea name="caption" maxlength="500" minlength="2" required placeholder="Cuéntanos o comparte tu momento navideño…"></textarea></label>';
  const formMarkup=challenge?(data.mySubmission?'<div class="spirit-submitted">🎉 ¡Ya participaste en este reto! Tu publicación está en el carrusel de la comunidad.</div>':'<form id="spirit-submission-form" class="spirit-submit-form">'+field+'<button class="primary-button" type="submit">Enviar mi participación <span>→</span></button><div id="spirit-feedback" class="spirit-feedback" role="status"></div></form>'):"";
  const feed=submissions.length?'<div class="spirit-carousel" aria-label="Participaciones de la comunidad"><div class="spirit-carousel-track">'+submissions.map(p=>'<article class="spirit-post"><div class="spirit-post-head"><span class="spirit-post-avatar">'+(p.avatar_url&&/^https:\/\//i.test(p.avatar_url)?'<img src="'+esc(p.avatar_url)+'" alt="">':'🎄')+'</span><div><b>'+esc(p.display_name)+'</b><small>'+new Date(String(p.created_at).replace(" ","T")+"Z").toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"})+'</small></div></div><p>'+esc(p.caption)+'</p>'+((p.media_type||"").startsWith("audio/")&&p.media_data?'<audio class="spirit-post-audio" controls preload="none" src="'+p.media_data+'"></audio>':p.media_data&&String(p.media_type||"").startsWith("image/")?'<img class="spirit-post-image" src="'+p.media_data+'" alt="Foto compartida">':p.image_data?'<img class="spirit-post-image" src="'+p.image_data+'" alt="Foto compartida">':"")+'<div class="spirit-post-actions"><span>❤️ '+Number(p.votes)+' Me gusta · +'+Math.min(Number(p.votes),10)+' pts</span>'+(p.user_id===currentUser.user.id?'<button type="button" class="spirit-delete-button" data-spirit-delete="'+esc(p.id)+'">Eliminar mi participación</button>':p.eligibleForVoting===false?'<small class="spirit-trivia-wrong">Respuesta incorrecta</small>':'<button type="button" '+(p.voted?'data-spirit-unvote="'+esc(p.id)+'"':'data-spirit-vote="'+esc(p.id)+'"')+'>'+(p.voted?"Quitar Me gusta ✓":"Me gusta ❤️")+'</button>')+'</div></article>').join("")+'</div></div>':'<p class="spirit-muted">Todavía no hay publicaciones. ¡Anímate a inaugurar el reto!</p>';
  host.innerHTML='<section class="spirit-score-card"><div><small>TU PUNTUACIÓN</small><strong>'+Number(data.myPoints||0)+' pts</strong><span>'+(data.myRank?'Puesto #'+data.myRank:'Aún sin posición')+'</span></div><span class="spirit-score-icon">🏆</span></section>'+challengeMarkup+formMarkup+'<section class="spirit-section"><div class="spirit-section-title"><h3>✨ Comunidad navideña</h3><small>'+submissions.length+' participaciones · desliza para verlas</small></div>'+feed+'</section><section class="spirit-section"><div class="spirit-section-title"><h3>🏆 Podio</h3><small>Los 3 primeros</small></div><div class="spirit-ranking">'+rankMarkup+'</div></section>';
  if(!home.dataset.spiritHandlers){
   home.dataset.spiritHandlers="1";
   home.addEventListener("submit",async ev=>{if(ev.target.id!=="spirit-submission-form")return;ev.preventDefault();const form=ev.target,button=form.querySelector('button[type="submit"]'),fb=$("#spirit-feedback");button.disabled=true;button.textContent="Enviando…";try{let caption=String(form.elements.caption?.value||"").trim(),mediaData="",mediaType="";if(type==="photo"){const file=form.elements.media.files[0];if(!file)throw Error("Selecciona una foto.");mediaData=await compressWishImage(file);mediaType="image/jpeg";}if(type==="voice"){if(!window.__spiritAudioBlob)throw Error("Primero graba tu mensaje de voz.");mediaData=await blobToDataUrl(window.__spiritAudioBlob);mediaType=(window.__spiritAudioBlob.type||"audio/webm").split(";")[0].toLowerCase()||"audio/webm";}if(type==="trivia")caption=String(new FormData(form).get("answer")||"");const result=await api("/api/spirit/submissions",{method:"POST",body:JSON.stringify({caption,mediaData,mediaType})});await renderSpiritTab();const score=$("#spirit-content .spirit-score-card");if(score)score.insertAdjacentHTML("afterend",'<p class="spirit-success">'+(type==="trivia"?(result.correct?"¡Respuesta correcta! ":"Respuesta registrada. Sigue participando. "):"¡Participación enviada! ")+"Los puntos llegarán con los Me gusta que recibas. ❤️</p>");}catch(error){fb.textContent=error.message;button.disabled=false;button.textContent="Enviar mi participación →";}});
   home.addEventListener("click",async ev=>{
    const record=ev.target.closest("[data-spirit-record]");if(record){const status=$("#spirit-record-status"),preview=$("#spirit-audio-preview");try{if(!spiritRecorder||spiritRecorder.state==="inactive"){if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error("Tu navegador no permite grabar audio.");const stream=await navigator.mediaDevices.getUserMedia({audio:true});spiritAudioChunks=[];spiritRecorder=new MediaRecorder(stream);spiritRecorder.ondataavailable=e=>{if(e.data.size)spiritAudioChunks.push(e.data);};spiritRecorder.onstop=()=>{window.__spiritAudioBlob=new Blob(spiritAudioChunks,{type:spiritRecorder.mimeType||"audio/webm"});preview.src=URL.createObjectURL(window.__spiritAudioBlob);preview.classList.remove("hidden");stream.getTracks().forEach(t=>t.stop());status.textContent="Audio listo para enviar.";record.textContent="🎙️ Grabar nuevamente";};spiritRecorder.start();record.textContent="⏹ Detener grabación";status.textContent="Grabando… máximo 30 segundos.";window.__spiritVoiceLimit=setTimeout(()=>{if(spiritRecorder?.state==="recording")spiritRecorder.stop();},30000);}else if(spiritRecorder.state==="recording"){clearTimeout(window.__spiritVoiceLimit);spiritRecorder.stop();}}catch(error){status.textContent=error.message;}return;}
    const del=ev.target.closest("[data-spirit-delete]");if(del){if(!confirm("¿Eliminar tu participación y los puntos asociados?"))return;del.disabled=true;del.textContent="Eliminando…";try{await api("/api/spirit/submissions/"+encodeURIComponent(del.dataset.spiritDelete),{method:"DELETE"});await renderSpiritTab();}catch(error){del.disabled=false;del.textContent=error.message;}return;}
    const unvote=ev.target.closest("[data-spirit-unvote]");if(unvote){unvote.disabled=true;try{await api("/api/spirit/submissions/"+encodeURIComponent(unvote.dataset.spiritUnvote)+"/vote",{method:"DELETE"});await renderSpiritTab();}catch(error){unvote.disabled=false;unvote.textContent=error.message;}return;}const vote=ev.target.closest("[data-spirit-vote]");if(!vote)return;vote.disabled=true;vote.textContent="Enviando…";try{await api("/api/spirit/submissions/"+encodeURIComponent(vote.dataset.spiritVote)+"/vote",{method:"POST",body:JSON.stringify({})});await renderSpiritTab();}catch(error){vote.disabled=false;vote.textContent=error.message;}
   });
  }
 }catch(error){const host=$("#spirit-content");if(host)host.innerHTML='<p class="status error">'+esc(error.message)+'</p>';}
}
async function loadSpiritAdmin(){
 const host=$("#spirit-admin-controls");if(!host||!currentUser?.isPrimaryAdmin)return;
 const ideas=[
 {id:"photo-decor",title:"Foto navideña",description:"Comparte una foto de tu decoración o de un detalle que represente la Navidad.",type:"photo",icon:"📸",points:15,bonus:5},
 {id:"voice-santa",title:"Voz de Papá Noel",description:"Graba un saludo navideño divertido como si fueras Papá Noel. Máximo 30 segundos.",type:"voice",icon:"🎙️",points:20,bonus:5},
 {id:"trivia-tree",title:"Trivia navideña",description:"Responde correctamente una pregunta de cultura navideña.",type:"trivia",icon:"🧠",points:15,bonus:5,config:{question:"¿En qué país se originó la tradición moderna del árbol de Navidad?",options:["Alemania","Italia","México","Canadá"],correctAnswer:"Alemania"}},
 {id:"text-wish",title:"Un deseo para todos",description:"Comparte un deseo positivo para la comunidad en estas fiestas.",type:"text",icon:"💌",points:10,bonus:5},
 {id:"photo-memory",title:"Recuerdo navideño",description:"Sube una foto de un recuerdo navideño que siempre te haga sonreír.",type:"photo",icon:"🎄",points:15,bonus:5},
 {id:"voice-song",title:"Villancico relámpago",description:"Canta o tararea un villancico durante 30 segundos y compártelo en audio.",type:"voice",icon:"🎶",points:20,bonus:5},
 {id:"trivia-grinch",title:"El reto del Grinch",description:"Demuestra cuánto sabes sobre películas y tradiciones navideñas.",type:"trivia",icon:"💚",points:15,bonus:5,config:{question:"¿Cómo se llama el perro del Grinch?",options:["Max","Rudolph","Buddy","Jack"],correctAnswer:"Max"}},
 {id:"text-meme",title:"El meme navideño",description:"Escribe una frase o meme navideño que haga reír a la comunidad.",type:"text",icon:"😂",points:10,bonus:5}
 ];
 try{
  const data=await api("/api/admin/spirit/challenges",{noMemoryCache:true});
  host.innerHTML='<section class="spirit-admin"><div class="management-heading"><div><h3>🎄 Retos diarios</h3><p>Prepara los retos con anticipación. Cada uno abrirá a las 9:00 a. m. y cerrará a las 10:00 p. m. (hora Perú).</p></div></div><div class="spirit-suggestion-grid">'+ideas.map(x=>'<button type="button" class="spirit-suggestion-card" data-spirit-suggestion="'+x.id+'"><span>'+x.icon+'</span><b>'+esc(x.title)+'</b><small>'+({text:"Texto",photo:"Foto",voice:"Voz",trivia:"Trivia"}[x.type])+'</small></button>').join("")+'</div><div id="spirit-suggestion-editor" class="hidden"><form id="spirit-admin-form" class="spirit-admin-form"><input type="hidden" name="challengeType"><label>Nombre del reto<input name="title" maxlength="80" required></label><label>Instrucciones<textarea name="description" maxlength="300" required></textarea></label><label>Fecha de apertura<input name="scheduledDate" type="date" required></label><div id="spirit-trivia-config" class="hidden"><label>Pregunta<input name="question" maxlength="180"></label><div class="spirit-trivia-admin-options"><label>Opción A<input name="optionA"></label><label>Opción B<input name="optionB"></label><label>Opción C<input name="optionC"></label><label>Opción D<input name="optionD"></label></div><label>Respuesta correcta<select name="correctAnswer"><option value="">Selecciona</option></select></label></div><p class="spirit-admin-points">Los puntos se asignan automáticamente según los Me gusta recibidos. No se otorgan puntos por publicar.</p><div class="spirit-admin-editor-actions"><button class="admin-action" type="submit">📅 Programar reto</button><button class="spirit-admin-cancel" type="button" id="spirit-admin-cancel">Cancelar</button></div><div id="spirit-admin-feedback" role="status"></div></form></div><div class="spirit-active-challenge"><b>Reto actual</b><span>'+(data.active?esc(data.active.title)+' · '+({text:"Texto",photo:"Foto",voice:"Voz",trivia:"Trivia"}[data.active.challenge_type]||"Texto"):'No hay un reto activo')+'</span></div><button type="button" class="spirit-reset-points" id="spirit-reset-my-points">↺ Reiniciar mis puntos</button><small>Solo afecta tu puntuación en la edición actual.</small></section>';
  let chosen=null;const editor=$("#spirit-suggestion-editor"),form=$("#spirit-admin-form");const localToday=new Date(Date.now()-new Date().getTimezoneOffset()*60000);const minDate=localToday.toISOString().slice(0,10);localToday.setDate(localToday.getDate()+1);const defaultDate=localToday.toISOString().slice(0,10);form.elements.scheduledDate.min=minDate;form.elements.scheduledDate.value=defaultDate;
  host.querySelectorAll("[data-spirit-suggestion]").forEach(btn=>btn.addEventListener("click",()=>{chosen=ideas.find(x=>x.id===btn.dataset.spiritSuggestion);form.reset();form.elements.scheduledDate.min=minDate;form.elements.scheduledDate.value=defaultDate;form.elements.challengeType.value=chosen.type;form.elements.title.value=chosen.title;form.elements.description.value=chosen.description;const trivia=$("#spirit-trivia-config"),select=form.elements.correctAnswer;trivia.classList.toggle("hidden",chosen.type!=="trivia");if(chosen.type==="trivia"){form.elements.question.value=chosen.config.question;["optionA","optionB","optionC","optionD"].forEach((key,i)=>form.elements[key].value=chosen.config.options[i]||"");select.innerHTML='<option value="">Selecciona</option>'+chosen.config.options.map(o=>'<option value="'+esc(o)+'">'+esc(o)+'</option>').join("");select.value=chosen.config.correctAnswer;}editor.classList.remove("hidden");editor.scrollIntoView({behavior:"smooth",block:"start"});}));
  $("#spirit-admin-cancel").addEventListener("click",()=>editor.classList.add("hidden"));
  form.addEventListener("submit",async ev=>{ev.preventDefault();const button=form.querySelector('button[type="submit"]'),fb=$("#spirit-admin-feedback"),values=Object.fromEntries(new FormData(form)),config=chosen?.type==="trivia"?{question:values.question,options:[values.optionA,values.optionB,values.optionC,values.optionD].map(x=>String(x||"").trim()).filter(Boolean),correctAnswer:values.correctAnswer}:{};button.disabled=true;button.textContent="Programando…";try{await api("/api/admin/spirit/challenges",{method:"POST",body:JSON.stringify({...values,config})});await loadSpiritAdmin();$("#spirit-admin-controls").insertAdjacentHTML("afterbegin",'<p class="spirit-success">¡Reto programado! Se abrirá automáticamente a las 9:00 a. m. de la fecha elegida.</p>');}catch(error){fb.textContent=error.message;button.disabled=false;button.textContent="📅 Programar reto";}});
  $("#spirit-reset-my-points").addEventListener("click",async()=>{if(!confirm("¿Dejar tu puntuación en cero? Se eliminarán todos tus puntos de Espíritu en esta edición, pero no las publicaciones ni los puntos de los demás."))return;const button=$("#spirit-reset-my-points");button.disabled=true;button.textContent="Reiniciando…";try{const result=await api("/api/admin/spirit/reset-my-points",{method:"POST",body:JSON.stringify({})});button.textContent="Tus puntos fueron reiniciados ✓";button.insertAdjacentHTML("afterend",'<p class="spirit-success">Se eliminaron '+Number(result.deleted)+' registros. Tu puntuación ahora es cero.</p>');}catch(error){button.disabled=false;button.textContent=error.message;}});
 }catch(error){host.innerHTML='<p class="status error">'+esc(error.message)+'</p>';}
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
 const home=$("#member-app .member-home");if(!currentUser?.isPrimaryAdmin||!home)return;
 home.innerHTML='<div class="admin-settings-view"><div class="settings-header"><span>⚙️</span><div><h2>Administración</h2><p>Accede directamente a cada área, sin recorrer una pantalla interminable.</p></div></div><nav class="admin-settings-nav" aria-label="Secciones de administración"><button type="button" class="active" data-admin-section="general">⚙️ General</button><button type="button" data-admin-section="spirit">🎄 Espíritu</button><button type="button" data-admin-section="draw">🎁 Sorteo</button><button type="button" data-admin-section="tools">👥 Participantes</button></nav><section class="admin-settings-section" id="admin-section-general"><div id="edition-settings-feedback" class="status hidden"></div><form id="edition-settings-form" class="edition-settings-form"><label>Nombre del intercambio<input name="title" maxlength="100" required></label><label>Fecha del intercambio<input name="eventDate" type="date"></label><label>Presupuesto por persona (S/) <input name="budgetAmount" type="number" min="0" step="0.01" placeholder="Ej. 80"></label><button class="primary-button" type="submit">Guardar ajustes</button></form><p class="settings-note">Los ajustes se pueden modificar mientras el sorteo no se haya realizado.</p></section><section class="admin-settings-section hidden" id="admin-section-spirit"><div id="spirit-admin-controls"></div></section><section class="admin-settings-section hidden" id="admin-section-draw"><div id="draw-admin-controls"></div></section><section class="admin-settings-section hidden" id="admin-section-tools"><div class="admin-tools-section"><div id="admin-tools-slot"></div></div></section></div>';
 home.querySelectorAll("[data-admin-section]").forEach(btn=>btn.addEventListener("click",()=>{home.querySelectorAll("[data-admin-section]").forEach(x=>x.classList.toggle("active",x===btn));home.querySelectorAll(".admin-settings-section").forEach(x=>x.classList.toggle("hidden",x.id!=="admin-section-"+btn.dataset.adminSection));}));
 const panel=$("#admin-panel")||document.createElement("section");panel.id="admin-panel";panel.className="admin-panel";$("#admin-tools-slot").append(panel);panel.classList.remove("hidden");await renderAdmin();
 try{await loadAdminDrawControls();}catch(error){$("#draw-admin-controls").innerHTML='<div class="status error">'+esc(error.message)+'</div>';}
 try{const data=await api("/api/admin/status"),e=data.edition||{},form=$("#edition-settings-form");form.elements.title.value=e.title||"";form.elements.eventDate.value=e.event_date||"";form.elements.budgetAmount.value=e.budget_amount??"";if(e.status!=="registration"){form.querySelector("button").disabled=true;form.querySelectorAll("input").forEach(x=>x.disabled=true);$("#edition-settings-feedback").textContent="Los ajustes están bloqueados porque el sorteo ya fue realizado o la edición terminó.";$("#edition-settings-feedback").classList.remove("hidden");}form.addEventListener("submit",async ev=>{ev.preventDefault();const values=Object.fromEntries(new FormData(form)),fb=$("#edition-settings-feedback");try{await api("/api/admin/edition",{method:"PATCH",body:JSON.stringify(values)});currentUser=await api("/api/me");updateMemberCountdown(currentUser.membership?.event_date);fb.textContent="Los ajustes del intercambio se guardaron correctamente.";fb.classList.remove("hidden","error");}catch(err){fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}});}catch(err){const fb=$("#edition-settings-feedback");fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}
 try{await loadSpiritAdmin();}catch(error){$("#spirit-admin-controls").innerHTML='<div class="status error">'+esc(error.message)+'</div>';}
}
async function loadDrawRevelationTracker(){
 const host=$("#draw-revelation-tracker");if(!host)return;
 try{
  const data=await api("/api/admin/draw/revelations",{noMemoryCache:true}),people=data.participants||[];
  const total=Number(data.total||people.length),revealed=Number(data.revealed||0),pending=Math.max(0,total-revealed),percent=total?Math.round(revealed*100/total):0;
  host.innerHTML='<div class="draw-revelation-heading"><div><b>👁️ Estado de revelaciones</b><small>Seguimiento privado · sin mostrar las asignaciones</small></div><strong>'+percent+'%</strong></div><div class="draw-revelation-progress"><span style="width:'+percent+'%"></span></div><div class="draw-revelation-stats"><span><b>'+revealed+'</b> ya revelaron</span><span><b>'+pending+'</b> pendientes</span><span><b>'+total+'</b> participantes</span></div><div class="draw-revelation-list">'+people.map(p=>'<div><span>'+esc(p.displayName)+'</span><b class="'+(p.revealed?'is-revealed':'is-pending')+'">'+(p.revealed?'✓ Ya reveló':'Pendiente')+'</b></div>').join('')+'</div>';
 }catch(error){host.innerHTML='<p class="status error">'+esc(error.message)+'</p>';}
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
   actions.innerHTML='<p class="draw-success">El sorteo está activo. Cada participante puede consultar únicamente su asignación en Mi amigo secreto.</p><div id="draw-revelation-tracker" class="draw-revelation-tracker"><p>Consultando quiénes ya revelaron su amigo secreto…</p></div><button id="reveal-draw-results" class="admin-action">👁 Revelar resultados del sorteo</button><div id="draw-results-panel" class="draw-results-panel hidden"></div><button id="reset-draw-button" class="admin-action danger-action">Volver a sortear</button><small>Esto eliminará las asignaciones actuales y conservará los perfiles, exclusiones y el historial de las demás secciones.</small>';
   $("#reveal-draw-results").addEventListener("click",async()=>{
    const button=$("#reveal-draw-results"),panel=$("#draw-results-panel");
    if(!panel.classList.contains("hidden")){panel.classList.add("hidden");panel.innerHTML="";button.textContent="👁 Revelar resultados del sorteo";return;}
    button.disabled=true;button.textContent="Consultando resultados…";
    try{
     const result=await api("/api/admin/draw/results",{noMemoryCache:true});
     const checks=[["Participantes",result.integrity.participants],["Asignaciones",result.integrity.assignments],["Destinatarios únicos",result.integrity.uniqueRecipients],["Asignaciones faltantes",result.integrity.missingAssignments],["Destinatarios repetidos",result.integrity.duplicateRecipients],["Autoasignaciones",result.integrity.selfAssignments],["Exclusiones incumplidas",result.integrity.exclusionViolations]];
     panel.innerHTML='<div class="draw-results-heading"><b>Resultados del sorteo · Ejecución #'+result.runNumber+'</b><span class="'+(result.integrity.valid?"draw-success":"status error")+'">'+(result.integrity.valid?"✓ Sorteo válido":"⚠ Revisar sorteo")+'</span></div><div class="draw-results-checks">'+checks.map(([label,value])=>'<span><small>'+esc(label)+'</small><b>'+value+'</b></span>').join("")+'</div><h4>Asignaciones realizadas</h4><ol class="draw-results-list">'+result.assignments.map(a=>'<li><b>'+esc(a.giverName)+'</b><span>regala a</span><b>'+esc(a.recipientName)+'</b></li>').join("")+'</ol><small>Solo visible para el administrador. No se modifica ni se vuelve a ejecutar el sorteo.</small>';
     panel.classList.remove("hidden");button.textContent="Ocultar resultados";
    }catch(e){panel.innerHTML='<p class="status error">'+esc(e.message)+'</p>';panel.classList.remove("hidden");button.textContent="Reintentar consulta";}
    finally{button.disabled=false;}
   });
   $("#reset-draw-button").addEventListener("click",async()=>{if(!confirm("¿Estás seguro de volver a sortear? Se eliminarán las asignaciones actuales para todos los participantes, pero se conservarán los perfiles, exclusiones y el historial de las demás secciones."))return;const confirmation="VOLVER A SORTEAR";try{await api("/api/admin/draw/reset",{method:"POST",body:JSON.stringify({confirmation})});await loadAdminDrawControls();const fb=$("#draw-admin-feedback");fb.textContent="Asignaciones anteriores eliminadas. Ya puedes incorporar participantes y preparar un nuevo sorteo.";fb.classList.remove("hidden","error");}catch(e){const fb=$("#draw-admin-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
   loadDrawRevelationTracker();
  }else if(d.state==="ready"){
   actions.innerHTML='<p class="draw-ready">La lista fue validada. Solo el administrador puede ejecutar el sorteo.</p><button id="execute-draw-button" class="admin-action">Ejecutar sorteo</button>';
   $("#execute-draw-button").addEventListener("click",async()=>{if(!confirm("¿Confirmas ejecutar el sorteo? Las asignaciones serán privadas y no se podrán editar individualmente."))return;try{const result=await api("/api/admin/draw/execute",{method:"POST",body:JSON.stringify({})});const fb=$("#draw-admin-feedback");fb.textContent="Sorteo realizado correctamente para "+result.participants+" participantes.";fb.classList.remove("hidden","error");await loadAdminDrawControls();}catch(e){const fb=$("#draw-admin-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
  }else{
   actions.innerHTML='<button id="mark-ready-button" class="admin-action" '+(d.participants<2||d.missingProfiles>0?'disabled':'')+'>Confirmar que todos están listos</button><small>Se requiere al menos 2 participantes activos y todos deben tener nombres y apellidos completos.</small>';
   $("#mark-ready-button").addEventListener("click",()=>{
    const modal=document.createElement("div");modal.className="draw-confirm-overlay";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-labelledby","draw-confirm-title");
    modal.innerHTML='<div class="draw-confirm-dialog"><span class="draw-confirm-icon">🎁</span><h3 id="draw-confirm-title">¿Confirmar que todos están listos?</h3><p>Al aceptar, se bloqueará la preparación de participantes y el sorteo quedará habilitado para ejecutarse. Verifica que todos hayan confirmado su participación y que los datos estén correctos.</p><div class="draw-confirm-actions"><button type="button" class="draw-confirm-cancel">CANCELAR</button><button type="button" class="draw-confirm-accept">ACEPTAR</button></div></div>';
    const close=()=>{modal.remove();document.removeEventListener("keydown",onKey);};
    const onKey=event=>{if(event.key==="Escape")close();};
    modal.addEventListener("click",event=>{if(event.target===modal)close();});
    modal.querySelector(".draw-confirm-cancel").addEventListener("click",close);
    modal.querySelector(".draw-confirm-accept").addEventListener("click",async()=>{
     const accept=modal.querySelector(".draw-confirm-accept"),cancel=modal.querySelector(".draw-confirm-cancel");accept.disabled=true;cancel.disabled=true;accept.textContent="PROCESANDO…";
     try{await api("/api/admin/draw/ready",{method:"POST",body:JSON.stringify({})});close();await loadAdminDrawControls();const fb=$("#draw-admin-feedback");fb.textContent="Todos están listos. Ya puedes ejecutar el sorteo desde aquí.";fb.classList.remove("hidden","error");}
     catch(e){close();const fb=$("#draw-admin-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}
    });
    document.addEventListener("keydown",onKey);document.body.appendChild(modal);modal.querySelector(".draw-confirm-cancel").focus();
   });
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

function setUnreadBadge(id,count,label){const badge=$("#"+id);if(!badge)return;const n=Math.max(0,Number(count)||0);badge.textContent=n>9?"9+":String(n);badge.hidden=n===0;badge.setAttribute("aria-label",n+" "+label+" sin leer");}
async function updateTabUnreadBadges(){
 if(!currentUser?.authenticated)return;
 const checks=[["community-unread-badge","/api/community/unread","mensajes"],["wishes-unread-badge","/api/wishes/unread","deseos"],["spirit-unread-badge","/api/spirit/unread","participaciones"]];
 await Promise.allSettled(checks.map(async([id,path,label])=>{try{const data=await api(path,{noMemoryCache:true});setUnreadBadge(id,data.unread,label);}catch{setUnreadBadge(id,0,label);}}));
 try{const secret=await api("/api/secret/me",{noMemoryCache:true});setUnreadBadge("secret-unread-badge",secret.state==="drawn"&&!secret.hasRevealed?1:0,"asignación pendiente de revelar");}catch{setUnreadBadge("secret-unread-badge",0,"asignación pendiente de revelar");}
}
function urlBase64ToUint8Array(value){
 const padding="=".repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");
 const raw=atob(base64);return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function refreshPushButtonState(button){
 try{
  if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window))return;
  if(Notification.permission!=="granted")return;
  const registration=await navigator.serviceWorker.ready;
  const subscription=await registration.pushManager.getSubscription();
  if(!subscription)return;
  await api("/api/push/subscribe",{method:"POST",body:JSON.stringify(subscription)});
  button.textContent="Notificaciones activadas ✓";
  button.disabled=true;
  button.classList.add("push-enabled");
  const feedback=$("#push-feedback");
  if(feedback){feedback.textContent="Este dispositivo ya está registrado para recibir tus notificaciones.";feedback.classList.remove("hidden","error");}
 }catch(error){console.warn("No se pudo verificar la suscripción push",error);}
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
  else messageMarkup='<div class="clue-recieved-list">'+(clues.clues||[]).map(c=>'<article class="clue-received"><span>💌</span><div><b>Un mensaje para ti</b><p>'+esc(c.message)+'</p><time>'+formatCommunityTime(c.created_at)+'</time></div></article>').join('')+'</div>' + (!(clues.clues||[]).length?'<div class="community-empty clue-empty"><span>💌</span><b>Tu buzón está esperando</b><p>Aún no recibes mensajes. ¡Tu amigo secreto podría sorprenderte pronto!</p></div>':'')+'<div class="clue-compose"><div class="clue-compose-heading"><div><span class="wish-kicker">UN DETALLE EN SECRETO</span><h3>Dejar un mensaje</h3></div><span class="wish-count">'+clues.sentCount+' enviados</span></div><form id="clue-form"><label for="clue-message">Escribe algo para tu amigo secreto</label><textarea id="clue-message" name="message" maxlength="240" rows="3" placeholder="Ej. ¡Espero que tengas una Navidad increíble! 🎄" required></textarea><div class="clue-compose-footer"><small>Tu identidad permanecerá en secreto. Puedes enviar todos los mensajes que quieras.</small><button class="primary-button" type="submit">Enviar mensaje →</button></div><div id="clue-feedback" class="status hidden"></div></form></div>';
  section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h2>Buzón secreto ✉️</h2><p>Un espacio privado para dejarle mensajes anónimos a tu amigo secreto y recibir los suyos.</p></div><div class="push-settings"><div><b>Entérate al instante</b><p>Recibe avisos cuando tu amigo secreto te deje una pista o alguien reaccione a tu participación en Espíritu.</p></div><button type="button" id="enable-push-notifications" class="secondary-action">🔔 Activar notificaciones</button><div id="push-feedback" class="status hidden" role="status"></div></div><section class="community-clues">'+messageMarkup+'</section>';
  const pushButton=$("#enable-push-notifications");
  if(pushButton){
   pushButton.addEventListener("click",()=>enablePushNotifications(pushButton));
   refreshPushButtonState(pushButton);
  }
  updateTabUnreadBadges();
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
  const wishCarousel=(items,removable,id)=>'<div class="wish-carousel" data-wish-carousel="'+id+'" aria-label="'+(removable?'Tus deseos':'Deseos de tu amigo secreto')+'"><div class="wish-carousel-top"><span>'+items.length+' '+(items.length===1?'deseo':'deseos')+'</span><small>Desliza para descubrirlos <span aria-hidden="true">→</span></small></div><div class="wish-carousel-track">'+wishCards(items,removable)+'</div><div class="wish-carousel-dots" aria-hidden="true">'+items.map((_,i)=>'<span class="'+(i===0?'active':'')+'"></span>').join('')+'</div></div>';
  const recipient=data.canSeeRecipientWishes?'<section class="recipient-wishes"><div class="wish-section-heading"><div><span class="wish-kicker">INSPIRACIÓN PARA TU REGALO</span><h3>Los deseos de '+esc(data.recipientName)+'</h3></div><span class="wish-heading-icon">✨</span></div><p class="wish-section-description">Estas son algunas ideas que compartió tu amigo secreto. ¡La sorpresa sigue siendo tuya!</p>'+(data.recipientWishes.length?wishCarousel(data.recipientWishes,false,'recipient'):'<p class="wish-empty">Todavía no ha agregado deseos.</p>')+'</section>':'<div class="wish-privacy"><span>🔒</span><p><b>Tu lista es privada</b><small>Solo la persona que te tenga asignado podrá consultar tus deseos después del sorteo.</small></p></div>';
  section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD CLIENTE 360 · 2026</p><h2>Lista de deseos 💝</h2><p>Comparte lo que te gustaría recibir y ayuda a tu amigo secreto a encontrar el regalo ideal.</p></div><section class="wish-editor"><div class="wish-section-heading"><div><span class="wish-kicker">TU LISTA PERSONAL</span><h3>Agregar un deseo</h3></div><span class="wish-heading-icon">✍️</span></div><form id="wish-form"><label>Nombre del regalo<input name="title" maxlength="100" placeholder="Ej. Figura de colección de Seiya" required></label><label>Detalles o características <span>(opcional)</span><textarea name="note" maxlength="300" rows="2" placeholder="Color, modelo, tamaño o cualquier detalle útil…"></textarea></label><label>Enlace de referencia <span>(opcional)</span><input name="url" type="url" placeholder="https://…"></label><label>Imagen de referencia <span>(opcional · JPG, PNG o WEBP; máx. 2 MB)</span><input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="wish-image-preview hidden" id="wish-new-image-preview"></div><small class="wish-image-help">Si no tienes un enlace, puedes adjuntar una foto del producto.</small><div class="wish-form-footer"><small>'+mine.length+' de 10 deseos</small><button class="primary-button" type="submit" '+(mine.length>=10?'disabled':'')+'>＋ Agregar deseo</button></div><div id="wish-feedback" class="status hidden"></div></form></section><section class="wish-list"><div class="wish-section-heading"><div><span class="wish-kicker">TUS IDEAS FAVORITAS</span><h3>Mis deseos</h3></div><span class="wish-count">'+mine.length+' / 10</span></div>'+(mine.length?wishCarousel(mine,true,'mine'):'<div class="wish-empty-state"><span>🎁</span><b>Tu lista está esperando ideas</b><p>Agrega ese regalo que te haría ilusión recibir esta Navidad.</p></div>')+'</section>'+recipient;
  section.querySelectorAll(".wish-carousel").forEach(carousel=>{const track=carousel.querySelector(".wish-carousel-track"),dots=[...carousel.querySelectorAll(".wish-carousel-dots span")];if(!track)return;track.addEventListener("scroll",()=>{const cards=[...track.querySelectorAll(".wish-card")];if(!cards.length)return;const index=Math.max(0,Math.min(cards.length-1,Math.round(track.scrollLeft/(cards[0].offsetWidth+12))));dots.forEach((dot,i)=>dot.classList.toggle("active",i===index));},{passive:true});});
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
  const data=await api("/api/secret/me",{noMemoryCache:true});
  if(data.state==="drawn"){
   section.innerHTML='<div class="member-section-heading"><p class="kicker">TU ASIGNACIÓN SECRETA</p><h2>Tu amigo secreto 🎁</h2><p>Tu asignación estará protegida hasta que decidas revelarla.</p></div><article class="secret-reveal secret-reveal-private"><span class="secret-gift-icon">🎄</span><p>Este año te toca regalarle a</p><h2 id="secret-recipient-name" class="secret-recipient-hidden" aria-live="polite">••••••••••</h2><small id="secret-privacy-hint">🔒 Tu amigo secreto está oculto.</small><button type="button" id="secret-visibility-toggle" class="secret-visibility-button" aria-pressed="false"><span aria-hidden="true">👁️</span> Revelar mi amigo secreto</button><p class="secret-privacy-note">Puedes ocultarlo nuevamente en cualquier momento. Al revelarlo por primera vez, se registrará tu confirmación.</p></article>';
   const toggle=$("#secret-visibility-toggle"),name=$("#secret-recipient-name"),hint=$("#secret-privacy-hint");
   let visible=false,busy=false;
   toggle.addEventListener("click",async()=>{
    if(busy)return;
    if(visible){visible=false;name.textContent="••••••••••";name.classList.add("secret-recipient-hidden");toggle.innerHTML='<span aria-hidden="true">👁️</span> Revelar mi amigo secreto';toggle.setAttribute("aria-pressed","false");hint.textContent="🔒 Tu amigo secreto está oculto.";return;}
    busy=true;toggle.disabled=true;toggle.textContent="Registrando revelación…";
    try{
     if(!data.hasRevealed){await api("/api/secret/reveal",{method:"POST",body:JSON.stringify({})});data.hasRevealed=true;}
     visible=true;name.textContent=data.recipient.displayName;name.classList.remove("secret-recipient-hidden");setUnreadBadge("secret-unread-badge",0,"asignación pendiente de revelar");toggle.innerHTML='<span aria-hidden="true">🙈</span> Ocultar mi amigo secreto';toggle.setAttribute("aria-pressed","true");hint.textContent="🎁 ¡Ya puedes ver a quién te toca regalar!";
    }catch(error){hint.textContent=error.message;hint.classList.add("secret-privacy-error");}
    finally{busy=false;toggle.disabled=false;}
   });
  }
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
 if(token&&currentUser.membership?.status!=="confirmed"){$("#join-card").classList.remove("hidden");$("#join-card").innerHTML=`<div class="card-heading"><div class="icon-bubble">🎄</div><div><p class="kicker">INVITACIÓN</p><h2>${esc(inviteEdition?.title||"Navidad Cliente 360")}</h2></div></div><p class="muted">${inviteValid?"Tu invitación está lista. Confirma tu participación para continuar.":"La invitación no es válida o venció."}</p><button id="confirm-join" class="primary-button" ${inviteValid?"":"disabled"}>Confirmar mi participación →</button><div id="join-feedback" class="status hidden"></div>`;
 $("#confirm-join").addEventListener("click",async()=>{try{await api("/api/invitations/join",{method:"POST",body:JSON.stringify({token})});sessionStorage.removeItem("navidad_invite_token");currentUser=await api("/api/me");showProfileForm();}catch(e){const fb=$("#join-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
 }else if(currentUser.membership?.status==="confirmed"&&!currentUser.participantProfile){$("#join-card").classList.add("hidden");showProfileForm();}
 else if(currentUser.membership?.status==="confirmed"){renderMemberApp();} else if(currentUser.membership?.status==="withdrawn"){renderRejoinView();}
 else {$("#join-card").classList.remove("hidden");$("#join-card").innerHTML="<h2>Tu cuenta está activa</h2><p>Tu participación aún no está confirmada. Abre el enlace de invitación vigente para unirte.</p>";}
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
if(isWhatsAppInApp){
  document.body.classList.remove("app-booting");
  const loader=$("#app-loader");if(loader)loader.remove();
  const panel=document.createElement("main");
  panel.className="wa-invite-guide";
  panel.innerHTML='<div class="wa-guide-card"><div class="wa-guide-icon">🎄</div><p class="kicker">NAVIDAD CLIENTE 360 · INVITACIÓN</p><h1>Abre tu invitación en Safari</h1><p>Para confirmar tu participación correctamente, abre este enlace en Safari. El navegador interno de WhatsApp puede interferir con el acceso mediante Google.</p><ol><li>Toca el menú <b>⋯</b> de WhatsApp.</li><li>Selecciona <b>Abrir en Safari</b> o <b>Abrir en navegador</b>.</li><li>Inicia sesión con Google y confirma tu participación.</li></ol><button type="button" id="copy-invite-link" class="wa-copy-button">Copiar enlace de invitación</button><p id="wa-copy-feedback" class="wa-copy-feedback" role="status"></p><small>Tu invitación se conservará al continuar en Safari.</small></div>';
  document.body.append(panel);
  panel.querySelector("#copy-invite-link").addEventListener("click",async()=>{
    const feedback=panel.querySelector("#wa-copy-feedback");
    try{await navigator.clipboard.writeText(location.href);feedback.textContent="Enlace copiado. Pégalo en Safari.";}
    catch{feedback.textContent="Mantén pulsado el enlace original de WhatsApp y selecciona Copiar.";}
  });
}else{
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
}
if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
