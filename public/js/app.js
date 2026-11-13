const $ = selector => document.querySelector(selector);
const setClass = (selector, className, enabled) => { const el=$(selector); if(el) el.classList.toggle(className, !!enabled); return el; };
const params = new URLSearchParams(location.search);
const urlInvite = params.get("invite") || location.pathname.match(/\/unirse\/([^/]+)/)?.[1] || "";
function extractInviteToken(value){
 const raw=String(value||"").trim();if(!raw)return "";
 try{const parsed=new URL(raw,location.origin);const fromQuery=new URLSearchParams(parsed.search).get("invite");if(fromQuery)return fromQuery;const fromPath=parsed.pathname.match(/\/unirse\/([^/]+)/);if(fromPath)return fromPath[1];}catch{}
 return /^[A-Za-z0-9_-]{20,}$/.test(raw)?raw:"";
}
function rememberInvite(value){
 const found=extractInviteToken(value);if(!found)return "";
 try{sessionStorage.setItem("navidad_invite_token",found);}catch{}
 try{localStorage.setItem("navidad_invite_token",found);}catch{}
 return found;
}
if(urlInvite)rememberInvite(urlInvite);
let token = urlInvite || (()=>{try{return sessionStorage.getItem("navidad_invite_token")||localStorage.getItem("navidad_invite_token")||"";}catch{return "";}})();
const isWhatsAppInApp = /WhatsApp/i.test(navigator.userAgent) && !!token;

let signedIn=false, currentUser=null, inviteValid=false, inviteEdition=null, communityPollTimer=null, communityChatPollTimer=null, selectedEditionId=new URLSearchParams(location.search).get("editionId")||localStorage.getItem("navidad_selected_edition")||"";
const apiMemoryCache=new Map();
const api=async(path,options={})=>{
 const method=(options.method||"GET").toUpperCase(),cacheable=method==="GET"&&!options.noMemoryCache;
 const {timeoutMs=18000,...fetchOptions}=options;
 let requestPath=path;
 if(selectedEditionId && path.startsWith("/api/") && path!=="/api/config" && path!=="/api/health" && path!=="/api/admin/editions" && !/[?&]editionId=/.test(path)){const separator=path.includes("?")?"&":"?";requestPath=path+separator+"editionId="+encodeURIComponent(selectedEditionId);}
 if(method!=="GET"){apiMemoryCache.clear();if(path.startsWith("/api/spirit/")){const key="spirit-board:"+selectedEditionId+":"+currentUser?.user?.id;try{sessionStorage.removeItem(key);localStorage.removeItem(key);}catch{}}}
 if(cacheable){const cached=apiMemoryCache.get(requestPath);if(cached&&Date.now()-cached.time<((path==="/api/community")?3500:(path==="/api/spirit/board"?12000:8000)))return cached.data;}
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
 let r,raw;
 try{
  r=await fetch(requestPath,{credentials:"same-origin",cache:"no-store",...fetchOptions,signal:controller.signal,headers:{"content-type":"application/json",...(options.headers||{})}});
  raw=await r.text();
 }catch(error){
  if(error.name==="AbortError")throw new Error("La solicitud tardó demasiado. Comprueba tu conexión e inténtalo nuevamente.");
  throw new Error("No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo nuevamente.");
 }finally{clearTimeout(timeout);}
 let d;try{d=JSON.parse(raw);}catch{const html=raw.trimStart().startsWith("<!DOCTYPE")||raw.trimStart().startsWith("<html");throw new Error(html?"El servidor devolvió la página web en lugar de la API. Cloudflare aún no ha publicado la versión del servidor o la ruta no está disponible.":"El servidor devolvió una respuesta no válida.");}
 if(!r.ok)throw new Error(d.error||"Ocurrió un error.");
 if(cacheable)apiMemoryCache.set(requestPath,{data:d,time:Date.now()});
 return d;
};
function prefetchMemberTabs(){ /* Las pestañas se consultan bajo demanda al abrirse. */ }
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function isAvatarSource(value){if(!value)return false;try{const url=new URL(value,location.origin);return url.protocol==="https:"||url.origin===location.origin&&url.pathname.startsWith("/api/profile/avatar/");}catch{return false;}}
function avatarUrl(value,size=64){if(!isAvatarSource(value))return "";try{const url=new URL(value,location.origin);if(url.hostname==="googleusercontent.com"||url.hostname.endsWith(".googleusercontent.com")){url.pathname=url.pathname.replace(/=s[0-9]+(-c)?$/i,"")+"=s"+size+"-c";}return url.href;}catch{return value;}}
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
 const dpr=Math.min(window.devicePixelRatio||1,1.25);snowWidth=window.innerWidth;snowHeight=window.innerHeight;
 snowCanvas.width=Math.round(snowWidth*dpr);snowCanvas.height=Math.round(snowHeight*dpr);snowCtx.setTransform(dpr,0,0,dpr,0,0);
 const count=Math.min(42,Math.max(22,Math.round(snowWidth*snowHeight/22000)));
 snowflakes=Array.from({length:count},()=>({x:Math.random()*snowWidth,y:Math.random()*snowHeight,r:1.6+Math.random()*3,v:.75+Math.random()*1.4,drift:-.35+Math.random()*.7,phase:Math.random()*Math.PI*2,alpha:.62+Math.random()*.35}));
}
function drawSnow(time){
 if(!snowEnabled||!snowCtx)return;snowFrame=requestAnimationFrame(drawSnow);
 if(time-snowLast<42)return;snowLast=time;snowCtx.clearRect(0,0,snowWidth,snowHeight);
 for(const f of snowflakes){f.y+=f.v;f.x+=f.drift+Math.sin(time*.0007+f.phase)*.28;if(f.y>snowHeight+5){f.y=-5;f.x=Math.random()*snowWidth;}if(f.x<-5)f.x=snowWidth+5;if(f.x>snowWidth+5)f.x=-5;snowCtx.beginPath();snowCtx.arc(f.x,f.y,f.r,0,Math.PI*2);snowCtx.fillStyle="rgba(255,255,255,"+f.alpha+")";snowCtx.fill();}
}
window.addEventListener("resize",()=>{if(snowEnabled)resizeSnow()},{passive:true});

function setLoginView(){
 setSnowfall(true);
  setClass("#hero","hidden",true);setClass("#features","hidden",true);setClass("#site-footer","hidden",true);
  const card=$("#join-card");if(!card)return;card.classList.remove("hidden");
  $("#join-card").innerHTML=`<div class="login-brand"><span>🎄</span><p class="kicker">CLIENTE 360 · NAVIDAD 2026</p><h1>Navidad Pyme</h1><p>Una Navidad, muchas sorpresas.</p></div><div id="login-context" class="login-context">${token?"Inicia sesión con Google para validar tu invitación y unirte a la celebración.":"Inicia sesión con tu cuenta de Google para continuar."}</div><div id="google-button" class="google-button"></div><div id="login-feedback" class="status hidden" role="status"></div><div class="privacy-note">🔒 Tu participación y tu asignación secreta estarán protegidas.</div>`;
}
function showFeedback(message,error=false){const el=$("#login-feedback");if(!el)return;el.textContent=message;el.classList.remove("hidden","error");if(error)el.classList.add("error");}
async function loadInvite(){
 if(!token){try{token=sessionStorage.getItem("navidad_invite_token")||localStorage.getItem("navidad_invite_token")||"";}catch{}}
 if(!token)return;
 try{const r=await api("/api/invitations/"+encodeURIComponent(token),{noMemoryCache:true});inviteValid=true;inviteEdition=r.edition;}
 catch{inviteValid=false;}
}
async function loadProfileImage(file){
 if(!file||!file.type.startsWith("image/"))throw new Error("Selecciona una imagen JPG, PNG o WebP.");
 const objectUrl=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=objectUrl;
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error("No se pudo abrir la imagen. Prueba con una foto JPG o PNG."));});
  return {image,objectUrl};
 }catch(error){URL.revokeObjectURL(objectUrl);throw error;}
}
async function croppedProfileImageDataUrl(image,offsetX,offsetY,zoom){
 const viewport=240,output=512;
 const scale=Math.max(viewport/image.naturalWidth,viewport/image.naturalHeight);
 const drawWidth=image.naturalWidth*scale*zoom,drawHeight=image.naturalHeight*scale*zoom;
 const canvas=document.createElement("canvas");canvas.width=output;canvas.height=output;
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("No se pudo procesar la foto.");
 ctx.fillStyle="#ffffff";ctx.fillRect(0,0,output,output);
 const factor=output/viewport;
 ctx.drawImage(image,((viewport-drawWidth)/2+offsetX)*factor,((viewport-drawHeight)/2+offsetY)*factor,drawWidth*factor,drawHeight*factor);
 let blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.84));
 for(const quality of [.76,.68,.58]){if(blob&&blob.size<=160*1024)break;blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));}
 if(!blob||blob.size>180*1024)throw new Error("La foto pesa demasiado. Prueba con otra imagen.");
 return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("No se pudo leer la foto recortada."));reader.readAsDataURL(blob);});
}
function showProfileForm(profile=null){
 setSnowfall(false);
 setClass("#member-app","hidden",false);
 setClass("#member-tab-content","hidden",true);
 setClass("#admin-panel","hidden",true);
 const card=$("#join-card");card.classList.remove("hidden");
 const currentAvatar=currentUser?.user?.avatar_url||"";
 card.innerHTML=`<div class="card-heading"><div class="icon-bubble">👤</div><div><p class="kicker">TU PERFIL DE PARTICIPANTE</p><h2>Personaliza tu perfil</h2></div></div><p class="muted">Actualiza tu nombre y tu foto. Tu imagen aparecerá junto a tus publicaciones y en la lista de participantes.</p><form id="participant-profile-form" class="profile-form"><div class="profile-photo-editor"><div class="profile-photo-preview" id="profile-photo-preview">${currentAvatar&&isAvatarSource(currentAvatar)?'<img src="'+esc(avatarUrl(currentAvatar,160))+'" alt="Foto de perfil actual">':'<span>👤</span>'}</div><div class="profile-photo-controls"><label class="profile-photo-picker">Cambiar foto<input name="avatarFile" id="profile-avatar-file" type="file" accept="image/*"></label><small>JPG, PNG o WebP. Podrás centrarla y ajustar el zoom.</small></div></div><section class="profile-crop-editor hidden" id="profile-crop-editor" aria-label="Ajustar encuadre de foto"><div class="profile-crop-heading"><b>Ajusta tu foto</b><span>Arrastra para centrarla</span></div><div class="profile-crop-viewport" id="profile-crop-viewport"><img id="profile-crop-image" alt="Vista previa del encuadre"></div><label class="profile-crop-zoom">Zoom <input id="profile-crop-zoom" type="range" min="1" max="3" step="0.05" value="1"></label><div class="profile-crop-actions"><button class="secondary-action profile-crop-cancel" id="profile-crop-cancel" type="button">Cancelar</button><button class="secondary-action profile-crop-apply" id="profile-crop-apply" type="button">Aplicar encuadre</button></div></section><label>Nombres<input name="firstName" autocomplete="given-name" maxlength="80" required value="${esc(profile?.first_name||"")}"></label><label>Apellidos<input name="lastName" autocomplete="family-name" maxlength="100" required value="${esc(profile?.last_name||"")}"></label><button class="primary-button" id="save-profile-button" type="submit">Guardar cambios <span>→</span></button></form><div id="profile-feedback" class="status hidden" role="status"></div>`;
 const form=$("#participant-profile-form"),fileInput=$("#profile-avatar-file"),preview=$("#profile-photo-preview"),save=$("#save-profile-button"),feedback=$("#profile-feedback");
 const cropEditor=$("#profile-crop-editor"),cropViewport=$("#profile-crop-viewport"),cropImage=$("#profile-crop-image"),cropZoomInput=$("#profile-crop-zoom"),cropApply=$("#profile-crop-apply"),cropCancel=$("#profile-crop-cancel");
 let avatarData=null,cropImageSource=null,cropObjectUrl=null,cropZoom=1,cropX=0,cropY=0,dragState=null;
 function cropMetrics(){const scale=Math.max(240/cropImageSource.naturalWidth,240/cropImageSource.naturalHeight);return {width:cropImageSource.naturalWidth*scale*cropZoom,height:cropImageSource.naturalHeight*scale*cropZoom};}
 function clampCrop(){if(!cropImageSource)return;const size=cropMetrics();cropX=Math.max(-(size.width-240)/2,Math.min((size.width-240)/2,cropX));cropY=Math.max(-(size.height-240)/2,Math.min((size.height-240)/2,cropY));}
 function updateCropPreview(){if(!cropImageSource)return;clampCrop();const size=cropMetrics();cropImage.style.width=size.width+"px";cropImage.style.height=size.height+"px";cropImage.style.transform="translate(-50%,-50%) translate("+cropX+"px,"+cropY+"px)";cropZoomInput.value=String(cropZoom);}
 cropViewport.addEventListener("pointerdown",event=>{if(!cropImageSource)return;dragState={x:event.clientX,y:event.clientY,originX:cropX,originY:cropY};cropViewport.setPointerCapture(event.pointerId);});
 cropViewport.addEventListener("pointermove",event=>{if(!dragState)return;cropX=dragState.originX+event.clientX-dragState.x;cropY=dragState.originY+event.clientY-dragState.y;updateCropPreview();});
 const endCropDrag=()=>{dragState=null;};cropViewport.addEventListener("pointerup",endCropDrag);cropViewport.addEventListener("pointercancel",endCropDrag);
 cropZoomInput.addEventListener("input",()=>{cropZoom=Number(cropZoomInput.value)||1;updateCropPreview();});
 fileInput.addEventListener("change",async()=>{
  const file=fileInput.files?.[0];if(!file)return;
  feedback.classList.add("hidden");save.disabled=true;save.textContent="Abriendo foto…";
  try{
   const loaded=await loadProfileImage(file);
   if(cropObjectUrl)URL.revokeObjectURL(cropObjectUrl);
   cropImageSource=loaded.image;cropObjectUrl=loaded.objectUrl;cropZoom=1;cropX=0;cropY=0;avatarData=null;
   cropImage.src=cropObjectUrl;cropEditor.classList.remove("hidden");updateCropPreview();
   cropApply.disabled=false;
  }catch(error){fileInput.value="";cropImageSource=null;feedback.textContent=error.message;feedback.classList.remove("hidden");feedback.classList.add("error");}
  finally{save.disabled=!!cropImageSource;save.innerHTML="Guardar cambios <span>→</span>";}
 });
 cropCancel.addEventListener("click",()=>{cropEditor.classList.add("hidden");cropImageSource=null;if(cropObjectUrl){URL.revokeObjectURL(cropObjectUrl);cropObjectUrl=null;}cropImage.removeAttribute("src");fileInput.value="";save.disabled=false;});
 cropApply.addEventListener("click",async()=>{
  if(!cropImageSource)return;
  cropApply.disabled=true;cropApply.textContent="Aplicando…";
  try{
   avatarData=await croppedProfileImageDataUrl(cropImageSource,cropX,cropY,cropZoom);
   preview.innerHTML='<img src="'+avatarData+'" alt="Vista previa de tu foto centrada">';
   cropEditor.classList.add("hidden");
   if(cropObjectUrl){URL.revokeObjectURL(cropObjectUrl);cropObjectUrl=null;}cropImageSource=null;fileInput.value="";
  }catch(error){feedback.textContent=error.message;feedback.classList.remove("hidden");feedback.classList.add("error");}
  finally{cropApply.disabled=false;cropApply.textContent="Aplicar encuadre";save.disabled=!!cropImageSource;}
 });
 form.addEventListener("submit",async e=>{
  e.preventDefault();const values=Object.fromEntries(new FormData(form));delete values.avatarFile;
  if(avatarData)values.avatarData=avatarData;
  const fb=$("#profile-feedback");save.disabled=true;save.textContent="Guardando…";
  try{await api("/api/profile/participant",{method:"POST",body:JSON.stringify(values)});const spiritCacheKey="spirit-board:"+selectedEditionId+":"+currentUser.user.id;try{localStorage.removeItem(spiritCacheKey);sessionStorage.removeItem(spiritCacheKey);}catch{}apiMemoryCache.clear();currentUser=await api("/api/me"+(selectedEditionId?"?editionId="+encodeURIComponent(selectedEditionId):""));renderMemberApp();}
  catch(err){fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}
  finally{save.disabled=false;save.innerHTML="Guardar cambios <span>→</span>";}
 });
}
function renderEmptyEditionTab(title,icon="🎄"){const section=$("#member-app .member-home");if(!section)return;section.innerHTML=`<div class="member-section-heading"><p class="kicker">ONBOARDING DIGITAL · NAVIDAD PYME</p><h2>${title}</h2></div><section class="edition-empty-state"><span>${icon}</span><h3>Próximamente</h3><p>Este espacio está listo. La información de este intercambio se agregará cuando esté definida.</p></section>`;}
async function loadOnboardingHome(){
 const host=$("#onboarding-home-content");if(!host)return;
 try{
  const data=await api("/api/edition/home",{noMemoryCache:true}),c=data.config||{},e=data.edition||{};
  $("#onboarding-welcome-text").textContent=c.welcomeText||"Bienvenido a tu intercambio.";
  updateMemberCountdown(e.event_date);
  const rows=[["📅","Fecha",formatExchangeDate(e.event_date),"showDate"],["📍","Lugar",c.placeName||"Por definir","showPlace"],["🏠","Dirección",c.address||"Por definir","showAddress"],["🕘","Horario",c.schedule||"Por definir","showSchedule"],["🍽️","Desayuno",c.breakfast||"Por definir","showBreakfast"],["🍖","Cuota / aporte",c.grillFee||"Por definir","showGrillFee"]].filter(row=>c[row[3]]!==false);
  const details=rows.map(([icon,label,value])=>'<div class="exchange-detail-row"><span class="exchange-detail-icon">'+icon+'</span><div><b>'+label+'</b><p>'+esc(value)+'</p></div></div>').join("");
  const extra=c.showExtraInfo!==false&&c.extraInfo?'<p class="exchange-breakfast">'+esc(c.extraInfo)+'</p>':"";
  const map=c.showMap!==false&&c.mapUrl&&/^https:\/\//i.test(c.mapUrl)?'<a class="exchange-map-link" href="'+esc(c.mapUrl)+'" target="_blank" rel="noopener noreferrer">Abrir ubicación en Google Maps ↗</a><div class="exchange-map-preview"><iframe title="Mapa del intercambio" src="https://www.google.com/maps?q='+encodeURIComponent(c.address||c.placeName)+'&output=embed" loading="lazy"></iframe></div>':"";
  const share=c.shareMessage||("🎄 "+(e.title||"Intercambio navideño")+"\n📅 "+formatExchangeDate(e.event_date)+"\n📍 "+(c.placeName||"Por definir")+"\n"+(c.address||""));
  host.innerHTML='<section class="exchange-budget-card"><div class="exchange-budget-icon">🎁</div><div class="exchange-budget-copy"><span class="exchange-budget-kicker">TEN PRESENTE</span><h2>Monto del intercambio</h2><div class="exchange-minimum-list"><div><span>Presupuesto por persona</span><strong>'+(e.budget_amount==null?"Por definir":esc(new Intl.NumberFormat("es-PE",{style:"currency",currency:e.currency||"PEN"}).format(Number(e.budget_amount))))+'</strong></div></div></div><div class="exchange-location">'+details+extra+map+'<a class="exchange-whatsapp-share" href="https://wa.me/?text='+encodeURIComponent(share)+'" target="_blank" rel="noopener noreferrer">◉ Compartir información por WhatsApp</a></div></section>';
 }catch(error){host.innerHTML='<section class="edition-empty-state"><span>🎁</span><h2>Información del intercambio</h2><p>'+esc(error.message)+'</p></section>';}
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
 setSnowfall(false);
 setClass("#join-card","hidden",true);setClass("#admin-panel","hidden",true);
 let app=$("#member-app");app.classList.remove("hidden");
 const name=currentUser.participantProfile?.first_name||currentUser.user.display_name||"Participante";
 const isOnboarding=currentUser.membership?.team_name==="Onboarding Digital";
 const budgetAmount=currentUser.membership?.budget_amount;
 const budgetCurrency=currentUser.membership?.currency||"PEN";
 const exchangeDateLabel=formatExchangeDate(currentUser.membership?.event_date);
 const exchangeShareText="🎄 *NAVIDAD PYME · 2026*\n\n📅 *Fecha:* "+exchangeDateLabel+"\n🎁 *Montos del intercambio:*\n• Amigo Secreto: mínimo S/ 100\n• Dirty Santa: mínimo S/ 20\n\n📍 *Lugar:* Casa de Marcos\nAv. Oscar R. Benavides 611, Dpto. 701, Cercado de Lima\n🗺️ Google Maps: https://maps.app.goo.gl/rueCMQujUGvwxFoY9\n\n🥪 *Desayuno:* Chicharrón de El Chinito desde las 9:00 a. m.\n🍖 *Cuota para la parrilla:* Por definir.\n\n¡Nos vemos para compartir la magia de esta Navidad! 🎅";
 const budgetLabel=budgetAmount==null?"Por definir":new Intl.NumberFormat("es-PE",{style:"currency",currency:budgetCurrency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(budgetAmount));
 const homeMarkup=isOnboarding?`<section class="member-welcome"><p class="kicker">NAVIDAD PYME · ${esc(currentUser.membership?.year||2026)}</p><h1>¡Hola, ${esc(name)}! 🎄</h1><p id="onboarding-welcome-text">Bienvenido a tu intercambio.</p><div class="member-countdown" id="member-countdown"></div></section><div id="onboarding-home-content"><section class="edition-empty-state"><span>🎁</span><h2>Información del intercambio</h2><p>El organizador está completando los detalles de esta celebración.</p></section></div>`:`<section class="member-welcome"><p class="kicker">NAVIDAD PYME · 2026</p><h1>¡Hola, ${esc(name)}! 🎄</h1><p>Tu espacio para compartir la magia de esta Navidad.</p><div class="member-countdown" id="member-countdown"></div></section><section class="exchange-budget-card" aria-label="Información importante del intercambio"><div class="exchange-budget-icon" aria-hidden="true">🎁</div><div class="exchange-budget-copy"><span class="exchange-budget-kicker">TEN PRESENTE</span><h2>Monto del intercambio</h2><div class="exchange-minimum-list"><div><span>Amigo Secreto</span><strong>Mínimo S/ 100</strong></div><div><span>Dirty Santa</span><strong>Mínimo S/ 20</strong></div></div></div><div class="exchange-location"><div class="exchange-detail-row"><span class="exchange-detail-icon">📅</span><div><b>Fecha: ${esc(exchangeDateLabel)}</b></div></div><div class="exchange-detail-row"><span class="exchange-detail-icon">📍</span><div><b>Lugar del intercambio</b><p>Av. Oscar R. Benavides 611, Dpto. 701, Cercado de Lima</p><small>Casa de Marcos</small></div></div><div class="exchange-detail-row"><span class="exchange-detail-icon">🍖</span><div><b>Cuota para la parrilla</b><p>Por definir</p></div></div><div class="exchange-detail-row"><span class="exchange-detail-icon">🕘</span><div><b>Horario</b><p>Desde las 9:00 a. m.</p></div></div><p class="exchange-breakfast">🥪 Llega temprano para desayunar su respectivo Chicharrón de El Chinito</p><a class="exchange-map-link" href="https://maps.app.goo.gl/rueCMQujUGvwxFoY9" target="_blank" rel="noopener noreferrer">Abrir ubicación en Google Maps ↗</a><div class="exchange-map-preview"><iframe title="Mapa de la ubicación del intercambio en Cercado de Lima" src="https://www.google.com/maps?q=Av.%20Oscar%20R.%20Benavides%20611%2C%20Cercado%20de%20Lima&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div><a class="exchange-whatsapp-share" href="https://wa.me/?text=${encodeURIComponent(exchangeShareText)}" target="_blank" rel="noopener noreferrer" aria-label="Compartir información del intercambio por WhatsApp"><span aria-hidden="true">◉</span> Compartir información por WhatsApp</a></div></section><figure class="home-team-photo-wrap"><img class="home-team-photo" src="/images/equipo-navidad-2026.webp" alt="Equipo Cliente 360 reunido para celebrar la Navidad" loading="eager" fetchpriority="high"></figure>`
 app.innerHTML=`<section class="member-home" id="member-tab-content">${homeMarkup}</section><nav class="bottom-nav" aria-label="Menú principal"><button class="active" data-tab="home"><span>⌂</span>Inicio</button><button data-tab="secret"><span>🎁</span>Mi secreto <span class="nav-unread-badge" id="secret-unread-badge" hidden></span></button><button data-tab="community" aria-label="Mensajes"><span>✉️</span>Mensajes</button><button data-tab="wishes"><span>💝</span>Deseos <span class="nav-unread-badge" id="wishes-unread-badge" hidden></span></button><button data-tab="spirit"><span>🎄</span>Espíritu <span class="nav-unread-badge" id="spirit-unread-badge" hidden></span></button><button data-tab="profile"><span>👥</span>Mi equipo</button>${currentUser.isPrimaryAdmin?'<button data-tab="admin-settings"><span>⚙️</span>Ajustes</button>':""}</nav>`;
 if(isOnboarding)loadOnboardingHome();
 startActivityHeartbeat();
 updateMemberCountdown(currentUser.membership?.event_date);

 prefetchMemberTabs();
 if(communityPollTimer)clearInterval(communityPollTimer);
 updateTabUnreadBadges();
 communityPollTimer=setInterval(updateTabUnreadBadges,90000);
 app.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{setClass("#join-card","hidden",true);setClass("#member-tab-content","hidden",false);setSnowfall(btn.dataset.tab==="home");app.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===btn));if(btn.dataset.tab==="profile"){showProfileSettings();return;}if(btn.dataset.tab==="admin-settings"){showAdminSettings();return;}if(btn.dataset.tab==="secret"){renderSecretTab();return;}if(btn.dataset.tab==="wishes"){renderWishesTab();return;}if(btn.dataset.tab==="community"){renderCommunityTab();return;}if(btn.dataset.tab==="spirit"){renderSpiritTab();return;}const labels={home:"Inicio",secret:"Mi amigo secreto",community:"Mensajes",wishes:"Lista de deseos"};if(btn.dataset.tab!=="home"){const section=app.querySelector(".member-home");section.innerHTML=`<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>${labels[btn.dataset.tab]}</h2></div><article class="member-feature"><span>${btn.dataset.tab==="secret"?"🎁":btn.dataset.tab==="community"?"💬":"💝"}</span><div><b>${labels[btn.dataset.tab]}</b><p>Esta funcionalidad se habilitará en su fase correspondiente del proyecto.</p></div><small>Próximamente</small></article>`;}else{renderMemberApp();}}));
 const requestedTab=new URLSearchParams(location.search).get("tab");
 if(requestedTab==="community"){
  const cleanUrl=new URL(location.href);
  cleanUrl.searchParams.delete("tab");
  history.replaceState({}, "", cleanUrl.pathname+cleanUrl.search+cleanUrl.hash);
  app.querySelector('[data-tab="community"]')?.click();
 }
}

async function createSpiritPodiumImage(ranking,challenge){
 const groups=[...new Set((ranking||[]).filter(p=>Number(p.rank)<=3).map(p=>Number(p.rank)))].map(rank=>({rank,people:ranking.filter(p=>Number(p.rank)===rank)}));
 const width=1080,top=520,rowH=174,footerSpace=470,height=Math.max(1580,top+groups.length*rowH+footerSpace);
 const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext("2d");
 const bg=ctx.createLinearGradient(0,0,width,height);bg.addColorStop(0,"#092b25");bg.addColorStop(.48,"#164638");bg.addColorStop(1,"#071e1a");ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
 const glow=ctx.createRadialGradient(width/2,260,30,width/2,260,650);glow.addColorStop(0,"rgba(232,194,111,.19)");glow.addColorStop(1,"rgba(232,194,111,0)");ctx.fillStyle=glow;ctx.fillRect(0,0,width,760);
 const rounded=(x,y,w,h,r,fill,stroke)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}};
 const star=(x,y,r,color)=>{ctx.save();ctx.translate(x,y);ctx.beginPath();for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,rr=k%2?r*.42:r;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.restore();};
 const snow=(x,y,r,a)=>{ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.strokeStyle="rgba(255,250,235,.58)";ctx.lineWidth=3;ctx.lineCap="round";for(let k=0;k<6;k++){ctx.rotate(Math.PI/3);ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(0,r);ctx.moveTo(0,-r*.58);ctx.lineTo(-r*.2,-r*.8);ctx.moveTo(0,-r*.58);ctx.lineTo(r*.2,-r*.8);ctx.stroke();}ctx.restore();};
 const tree=(x,y,scale=1)=>{ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle="#7b4b32";ctx.fillRect(-8,90,16,35);for(let k=0;k<3;k++){ctx.beginPath();ctx.moveTo(0,-55+k*42);ctx.lineTo(-46+k*10,35+k*38);ctx.lineTo(46-k*10,35+k*38);ctx.closePath();ctx.fillStyle=k===0?"#287052":k===1?"#1e6249":"#174b3a";ctx.fill();}ctx.fillStyle="#e8c675";star(0,-63,13,"#e8c675");for(let k=0;k<5;k++){ctx.beginPath();ctx.arc((k%2?1:-1)*(13+(k%3)*9),-4+k*21,4,0,Math.PI*2);ctx.fillStyle=k%2?"#c94f48":"#e8c675";ctx.fill();}ctx.restore();};
 const gift=(x,y,scale=1)=>{ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle="#a83d3b";ctx.fillRect(-30,-24,60,48);ctx.fillStyle="#e8c675";ctx.fillRect(-5,-24,10,48);ctx.fillRect(-30,-5,60,10);ctx.strokeStyle="#e8c675";ctx.lineWidth=6;ctx.beginPath();ctx.ellipse(-9,-30,12,8,-.5,0,Math.PI*2);ctx.ellipse(9,-30,12,8,.5,0,Math.PI*2);ctx.stroke();ctx.restore();};
 // Doble marco editorial y esquinas ornamentales.
 rounded(25,25,width-50,height-50,34,null,"rgba(232,198,117,.85)");
 rounded(39,39,width-78,height-78,27,null,"rgba(255,248,232,.18)");
 tree(92,150,.72);tree(width-92,150,.72);gift(104, height-125,.78);gift(width-104,height-125,.78);
 for(let n=0;n<28;n++){const x=(n*197+71)%width,y=(n*283+117)%height;ctx.beginPath();ctx.arc(x,y,2+(n%3),0,Math.PI*2);ctx.fillStyle=n%2?"rgba(232,198,117,.55)":"rgba(255,255,255,.35)";ctx.fill();}
 [[160,320,22,.2],[920,355,18,.6],[140,780,17,.4],[945,900,22,.1],[180,height-360,19,.8],[900,height-390,17,.3]].forEach(v=>snow(...v));
 // Guirnalda superior con luces.
 ctx.beginPath();ctx.moveTo(145,88);ctx.bezierCurveTo(330,160,750,160,935,88);ctx.strokeStyle="rgba(232,198,117,.75)";ctx.lineWidth=5;ctx.stroke();
 for(let n=0;n<13;n++){const x=155+n*64,y=94+Math.sin(n/12*Math.PI)*64;ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x,y+2);ctx.strokeStyle="rgba(255,248,232,.5)";ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(x,y+10,7,0,Math.PI*2);ctx.fillStyle=["#d85b50","#e8c675","#7bb58b"][n%3];ctx.fill();}
 ctx.textAlign="center";ctx.fillStyle="#e8c675";ctx.font="700 27px Arial";ctx.fillText("NAVIDAD PYME  ·  2026",width/2,220);
 ctx.fillStyle="#fff8e8";ctx.font="900 94px Georgia";ctx.fillText("EL PODIO",width/2,330);
 ctx.fillStyle="#e8c675";ctx.font="700 31px Arial";ctx.fillText("ESPÍRITU NAVIDEÑO",width/2,390);
 // Separador con estrella central.
 ctx.strokeStyle="rgba(232,198,117,.7)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(250,425);ctx.lineTo(830,425);ctx.stroke();star(width/2,425,15,"#e8c675");
 ctx.fillStyle="#fff8e8";ctx.font="700 30px Arial";ctx.fillText("RANKING GENERAL ACUMULADO",width/2,474);
 ctx.fillStyle="rgba(255,248,232,.72)";ctx.font="500 21px Arial";ctx.fillText("PUNTOS SUMADOS EN TODOS LOS RETOS",width/2,507);
 const palette={1:{main:"#e8c675",dark:"#9b702a",light:"#fff0bd"},2:{main:"#d9e0e1",dark:"#78878a",light:"#f4f7f5"},3:{main:"#cd8a5d",dark:"#824a32",light:"#f4c09a"}};
 groups.forEach((group,i)=>{
  const y=top+i*rowH,people=group.people,colors=palette[group.rank]||palette[1];
  const card=ctx.createLinearGradient(90,y,990,y+132);card.addColorStop(0,"rgba(255,248,232,.14)");card.addColorStop(1,"rgba(255,248,232,.055)");
  rounded(78,y,width-156,142,24,card,"rgba(232,198,117,.3)");
  rounded(94,y+15,9,112,5,colors.main,null);
  // Medallón ilustrado, con cinta y número.
  ctx.save();ctx.translate(165,y+70);ctx.fillStyle=colors.dark;ctx.beginPath();ctx.moveTo(-20,25);ctx.lineTo(-12,68);ctx.lineTo(0,54);ctx.lineTo(12,68);ctx.lineTo(20,25);ctx.closePath();ctx.fill();
  const medalGrad=ctx.createRadialGradient(-8,-10,2,0,0,43);medalGrad.addColorStop(0,colors.light);medalGrad.addColorStop(1,colors.main);
  ctx.beginPath();ctx.arc(0,0,39,0,Math.PI*2);ctx.fillStyle=medalGrad;ctx.fill();ctx.strokeStyle=colors.dark;ctx.lineWidth=4;ctx.stroke();
  ctx.fillStyle=colors.dark;ctx.font="900 38px Georgia";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(String(group.rank),0,1);ctx.restore();
  ctx.textBaseline="alphabetic";ctx.textAlign="left";ctx.fillStyle=colors.main;ctx.font="800 19px Arial";
  const place=group.rank===1?"PRIMER":group.rank===2?"SEGUNDO":"TERCER";
  ctx.fillText(people.length>1?"EMPATE EN EL "+place+" LUGAR":place+" LUGAR",235,y+42);
  const names=people.map(p=>String(p.display_name||"Participante")+(group.rank===1&&Number(p.first_place_streak)>=2?"  🔥 "+Number(p.first_place_streak):"")).join("  ·  ");
  ctx.fillStyle="#fff8e8";ctx.font="700 27px Arial";
  let display=names;while(ctx.measureText(display).width>590&&display.length>12)display=display.slice(0,-4)+"…";
  ctx.fillText(display,235,y+88);
  if(people.length>1){ctx.fillStyle="rgba(255,248,232,.65)";ctx.font="500 16px Arial";ctx.fillText(people.length+" PARTICIPANTES COMPARTEN ESTE PUESTO",235,y+116);}
  ctx.textAlign="right";ctx.fillStyle=colors.main;ctx.font="900 31px Arial";ctx.fillText(Number(people[0].points||0)+" PTS",width-118,y+88);
 });
 const footerY=top+groups.length*rowH+65;
 // Pequeño separador navideño y mensaje solicitado.
 ctx.strokeStyle="rgba(232,198,117,.55)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(230,footerY-28);ctx.lineTo(850,footerY-28);ctx.stroke();star(width/2,footerY-28,12,"#e8c675");
 ctx.textAlign="center";ctx.fillStyle="#e8c675";ctx.font="800 29px Arial";ctx.fillText("GRACIAS POR COMPARTIR LA MAGIA",width/2,footerY+28);
 ctx.fillStyle="rgba(255,248,232,.72)";ctx.font="italic 21px Georgia";ctx.fillText("Que la alegría de compartir nos siga uniendo",width/2,footerY+67);
 // Firmas conservadas, con presentación limpia y equilibrada.
 const signatureY=footerY+160,signatureWidth=390,gap=70,leftX=(width-(signatureWidth*2+gap))/2;
 const signatures=[
  {x:leftX,signature:"Marcos Torres",name:"Marcos Torres",role:"CL Backend Java",tilt:-2},
  {x:leftX+signatureWidth+gap,signature:"Rozvi Paredes",name:"Rozvi Paredes",role:"PO Squad Cliente 360 Pyme",tilt:1}
 ];
 signatures.forEach(item=>{
  const center=item.x+signatureWidth/2;
  ctx.save();ctx.translate(center,signatureY);ctx.rotate(item.tilt*Math.PI/180);
  ctx.textAlign="center";ctx.fillStyle="#fff8e8";ctx.font="italic 49px 'Segoe Script','Brush Script MT','Comic Sans MS',cursive";ctx.fillText(item.signature,0,0,signatureWidth-16);ctx.restore();
  ctx.strokeStyle="rgba(232,198,117,.85)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(item.x+18,signatureY+22);ctx.lineTo(item.x+signatureWidth-18,signatureY+22);ctx.stroke();
  ctx.textAlign="center";ctx.fillStyle="#fff8e8";ctx.font="700 23px Arial";ctx.fillText(item.name,center,signatureY+58);
  ctx.fillStyle="rgba(255,248,232,.72)";ctx.font="19px Arial";ctx.fillText(item.role,center,signatureY+91,signatureWidth);
 });
 ctx.fillStyle="rgba(232,198,117,.9)";ctx.font="700 19px Arial";ctx.textAlign="center";ctx.fillText("NAVIDAD PYME  ·  2026",width/2,height-64);
 return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("No se pudo generar la imagen del podio.")),"image/png"));
}
async function shareSpiritPodium(ranking,challenge){
 const button=$("#spirit-share-podium");if(button){button.disabled=true;button.textContent="Preparando imagen…";}
 try{
  const blob=await createSpiritPodiumImage(ranking,challenge),file=new File([blob],"podio-espiritu-navideno.png",{type:"image/png"});
  if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:"Podio · Espíritu Navideño",text:"🏆 ¡Así va nuestro podio navideño! 🎄"});}
  else{
   const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="podio-espiritu-navideno.png";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   const message=encodeURIComponent("🏆 ¡Así va nuestro podio de Espíritu Navideño! 🎄");window.open("https://wa.me/?text="+message,"_blank","noopener");
  }
 }catch(error){if(error.name!=="AbortError")alert(error.message||"No se pudo compartir el podio.");}
 finally{if(button){button.disabled=false;button.innerHTML="📲 Compartir podio como imagen";}}
}

let spiritRecorder=null,spiritAudioChunks=[];
async function blobToDataUrl(blob){return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error("No se pudo procesar el audio."));r.readAsDataURL(blob);});}
async function refreshSpiritComments(postId){
 const panel=$("#member-app .member-home [data-spirit-comments-panel=\""+CSS.escape(postId)+"\"]");if(!panel)return;
 const list=panel.querySelector(".spirit-comments-list");list.innerHTML='<p class="spirit-comments-loading">Cargando comentarios…</p>';
 try{const data=await api("/api/spirit/submissions/"+encodeURIComponent(postId)+"/comments",{noMemoryCache:true});const comments=data.comments||[];list.innerHTML=comments.length?comments.map(c=>'<article class="spirit-comment"><span class="spirit-comment-avatar">'+(c.avatar_url&&isAvatarSource(c.avatar_url)?'<img src="'+esc(avatarUrl(c.avatar_url,48))+'" alt="">':'🎄')+'</span><div><div class="spirit-comment-meta"><b>'+esc(c.display_name)+'</b><time>'+new Date(String(c.created_at).replace(" ","T")+"Z").toLocaleString("es-PE",{dateStyle:"short",timeStyle:"short"})+'</time>'+(c.user_id===currentUser.user.id?'<button type="button" data-spirit-comment-delete="'+esc(c.id)+'" aria-label="Eliminar comentario">×</button>':'')+'</div><p>'+esc(c.comment)+'</p></div></article>').join(""):'<p class="spirit-comments-empty">Todavía no hay comentarios. ¡Sé el primero en conversar! 💬</p>';panel.dataset.loaded="1";}catch(error){list.innerHTML='<p class="spirit-comments-error">'+esc(error.message||"No se pudieron cargar los comentarios.")+'</p>';panel.dataset.loaded="";}
}
async function refreshSpiritLikes(postId){
 const panel=document.querySelector('#member-app .member-home [data-spirit-likes-panel="'+CSS.escape(postId)+'"]');if(!panel)return;
 panel.innerHTML='<p class="spirit-likes-loading">Consultando Me gusta…</p>';
 try{const data=await api("/api/spirit/submissions/"+encodeURIComponent(postId)+"/likes",{noMemoryCache:true});const likes=data.likes||[];panel.innerHTML=likes.length?'<div class="spirit-likes-list">'+likes.map(person=>'<div class="spirit-like-person"><span class="spirit-like-avatar">'+(person.avatar_url&&isAvatarSource(person.avatar_url)?'<img src="'+esc(avatarUrl(person.avatar_url,48))+'" alt="" loading="lazy" decoding="async">':'🎄')+'</span><span><b>'+esc(person.display_name)+'</b><small>'+new Date(String(person.created_at).replace(" ","T")+"Z").toLocaleString("es-PE",{dateStyle:"short",timeStyle:"short"})+'</small></span></div>').join("")+'</div>':'<p class="spirit-likes-empty">Todavía nadie ha dado Me gusta.</p>';panel.dataset.loaded="1";}catch(error){panel.innerHTML='<p class="spirit-likes-error">'+esc(error.message||"No se pudieron consultar los Me gusta.")+'</p>';panel.dataset.loaded="";}
}
async function notifySpiritShare(postId){try{await api("/api/spirit/submissions/"+encodeURIComponent(postId)+"/share",{method:"POST",body:JSON.stringify({})});}catch(error){console.warn("No se pudo notificar que compartieron la publicación:",error);}}
async function createSpiritPostImage(post,challenge,comments=[]){
 const width=1080,cardX=66,cardW=width-132,innerX=cardX+54,innerW=cardW-108;
 const caption=String(post.caption||"").trim()||"Una publicación llena de espíritu navideño.";
 const type=String(post.media_type||"").toLowerCase(),isAudio=type.startsWith("audio/"),isPhoto=!!post.has_media&&!isAudio;
 let mediaBitmap=null,avatarBitmap=null;
 if(isPhoto){
  try{
   const mediaUrl=(post.mediaUrl||"/api/spirit/media/"+encodeURIComponent(post.id))+(selectedEditionId?"?editionId="+encodeURIComponent(selectedEditionId):"");
   const response=await fetch(mediaUrl,{credentials:"same-origin",cache:"no-store"});
   if(response.ok){const blob=await response.blob();if(blob.type.startsWith("image/")&&window.createImageBitmap)mediaBitmap=await createImageBitmap(blob);}
  }catch(error){console.warn("No se pudo incluir la foto en la tarjeta compartida:",error);}
 }
 if(post.avatar_url&&isAvatarSource(post.avatar_url)){
  try{
   const response=await fetch(avatarUrl(post.avatar_url,160),{credentials:"same-origin",cache:"no-store"});
   if(response.ok){const blob=await response.blob();if(blob.type.startsWith("image/")&&window.createImageBitmap)avatarBitmap=await createImageBitmap(blob);}
  }catch(error){console.warn("No se pudo incluir la foto de perfil en la tarjeta compartida:",error);}
 }
 const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
 if(!ctx)throw new Error("Este dispositivo no permite generar la imagen para compartir.");
 const font="Arial, sans-serif";
 const wrap=(value,maxWidth,fontSpec)=>{ctx.font=fontSpec;const words=String(value).split(/\s+/);const lines=[];let line="";for(const word of words){const test=line?line+" "+word:word;if(line&&ctx.measureText(test).width>maxWidth){lines.push(line);line=word;}else line=test;}if(line)lines.push(line);return lines.length?lines:[""];};
 const captionFont="500 38px "+font,captionLines=wrap(caption,innerW,captionFont);
 const captionHeight=captionLines.length*55;
 let photoH=0,photoW=0;
 if(mediaBitmap){const scale=Math.min(innerW/mediaBitmap.width,610/mediaBitmap.height);photoW=Math.round(mediaBitmap.width*scale);photoH=Math.round(mediaBitmap.height*scale);}
 const contentTop=365,headerH=160,captionTop=contentTop+headerH+50;
 const mediaTop=captionTop+captionHeight+34;
 const mediaBlockH=mediaBitmap?photoH+34:isAudio?150:0;
 const dividerY=mediaTop+mediaBlockH+28;
 const actionsY=dividerY+82,toolsY=actionsY+110,toolsBottom=toolsY+88;
 const visibleComments=comments.slice(-8).map(comment=>({name:String(comment.display_name||"Participante").slice(0,42),lines:wrap(String(comment.comment||""),innerW-40,"500 22px "+font)}));
 const commentEntriesHeight=visibleComments.reduce((total,item)=>total+64+item.lines.length*31+12,0);
 const extraComments= Math.max(0,comments.length-visibleComments.length);
 const commentsTop=toolsBottom+36;
 const commentsHeight=comments.length?62+commentEntriesHeight+(extraComments?48:0)+24:0;
 const cardBottom=comments.length?commentsTop+commentsHeight+34:toolsY+94;
 const height=cardBottom+100;
 canvas.width=width;canvas.height=height;
 const rounded=(x,y,w,h,r,fill,stroke,lineWidth=2)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}};
 const drawText=(value,x,y,size,color,weight="500",align="left",family=font)=>{ctx.font=weight+" "+size+"px "+family;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(String(value),x,y);};
 const bg=ctx.createLinearGradient(0,0,width,height);bg.addColorStop(0,"#082a24");bg.addColorStop(.55,"#123f33");bg.addColorStop(1,"#071f1a");ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
 const glow=ctx.createRadialGradient(width/2,120,30,width/2,120,700);glow.addColorStop(0,"rgba(232,198,117,.18)");glow.addColorStop(1,"rgba(232,198,117,0)");ctx.fillStyle=glow;ctx.fillRect(0,0,width,520);
 rounded(24,24,width-48,height-48,42,null,"rgba(232,198,117,.7)",3);
 for(let i=0;i<26;i++){const x=(i*173+83)%width,y=(i*251+97)%height;ctx.beginPath();ctx.arc(x,y,2+(i%3),0,Math.PI*2);ctx.fillStyle=i%2?"rgba(255,248,232,.34)":"rgba(232,198,117,.52)";ctx.fill();}
 drawText("NAVIDAD PYME  ·  2026",width/2,112,27,"#e8c675","700","center");
 drawText("Comunidad",width/2,205,76,"#fff8e8","700","center","Georgia, serif");
 drawText("navideña",width/2,285,76,"#fff8e8","700","center","Georgia, serif");
 rounded(cardX,contentTop,cardW,cardBottom-contentTop,38,"#f6efdc","#d8cdb5",3);
 rounded(cardX+18,contentTop+18,cardW-36,cardBottom-contentTop-36,30,"#fffaf0","#eee4d1",2);
 const avatarX=innerX+45,avatarY=contentTop+78;
 ctx.save();ctx.beginPath();ctx.arc(avatarX,avatarY,47,0,Math.PI*2);ctx.clip();
 ctx.fillStyle="#075b4d";ctx.fillRect(avatarX-47,avatarY-47,94,94);
 if(avatarBitmap){
  const scale=Math.max(94/avatarBitmap.width,94/avatarBitmap.height),aw=avatarBitmap.width*scale,ah=avatarBitmap.height*scale;
  ctx.drawImage(avatarBitmap,avatarX-aw/2,avatarY-ah/2,aw,ah);
 }else{
  const initials=String(post.display_name||"P").trim().split(/\s+/).slice(0,2).map(s=>s[0]||"").join("").toLocaleUpperCase("es-PE").slice(0,2);
  ctx.font="700 43px "+font;ctx.fillStyle="#fffaf0";ctx.textAlign="center";ctx.fillText(initials,avatarX,avatarY+16);
 }
 ctx.restore();ctx.beginPath();ctx.arc(avatarX,avatarY,47,0,Math.PI*2);ctx.strokeStyle="#d8c675";ctx.lineWidth=4;ctx.stroke();
 drawText(String(post.display_name||"Participante").slice(0,38),innerX+112,contentTop+70,38,"#174536","700");
 const created=post.created_at?new Date(String(post.created_at).replace(" ","T")+"Z"):new Date();
 const dateText=Number.isNaN(created.getTime())?"":created.toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"});
 drawText(dateText,innerX+112,contentTop+119,25,"#8b8b7e","500");
 drawText(captionLines[0],innerX,captionTop+4,38,"#40574a","500");
 for(let i=1;i<captionLines.length;i++)drawText(captionLines[i],innerX,captionTop+4+i*55,38,"#40574a","500");
 if(mediaBitmap){
  const px=innerX+(innerW-photoW)/2,py=mediaTop;
  rounded(px-4,py-4,photoW+8,photoH+8,22,"#eee6d4","#e2d8c5",2);
  ctx.save();ctx.beginPath();ctx.roundRect(px,py,photoW,photoH,18);ctx.clip();ctx.drawImage(mediaBitmap,px,py,photoW,photoH);ctx.restore();
 }else if(isAudio){
  rounded(innerX,mediaTop,innerW,116,24,"#f3ead8","#e1d5bd",2);
  drawText("🎙️",innerX+54,mediaTop+76,56,"#174536","700");
  drawText("Mensaje de voz navideño",innerX+125,mediaTop+69,29,"#174536","700");
 }
 ctx.strokeStyle="#e8dfcf";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(innerX,dividerY);ctx.lineTo(innerX+innerW,dividerY);ctx.stroke();
 drawText("❤️ "+Number(post.votes||0)+" Me gusta",innerX,actionsY+8,29,"#8b7448","500");
 rounded(innerX+innerW-250,actionsY-42,250,82,41,"#f5ead2","#d9c9a5",2);
 drawText("Me gusta  ❤️",innerX+innerW-125,actionsY+9,28,"#714e26","700","center");
 ctx.strokeStyle="#e8dfcf";ctx.beginPath();ctx.moveTo(innerX,toolsY-22);ctx.lineTo(innerX+innerW,toolsY-22);ctx.stroke();
 const gap=24,toolW=(innerW-gap)/2;
 rounded(innerX,toolsY,toolW,88,24,"#fffaf0","#d9cfbb",2);
 rounded(innerX+toolW+gap,toolsY,toolW,88,24,"#fffaf0","#d9cfbb",2);
 drawText("💬  Comentarios  ·  "+Number(comments.length||post.comment_count||0),innerX+toolW/2,toolsY+55,25,"#285443","700","center");
 drawText("📲  Compartir",innerX+toolW+gap+toolW/2,toolsY+55,25,"#285443","700","center");
 if(comments.length){
  ctx.strokeStyle="#e8dfcf";ctx.beginPath();ctx.moveTo(innerX,commentsTop-14);ctx.lineTo(innerX+innerW,commentsTop-14);ctx.stroke();
  drawText("COMENTARIOS DE LA COMUNIDAD",innerX,commentsTop+24,24,"#8b7448","700");
  let y=commentsTop+42;
  for(const item of visibleComments){
   const entryHeight=64+item.lines.length*31;
   rounded(innerX,y,innerW,entryHeight,18,"#f8f3e8","#eee4d1",1);
   drawText(item.name,innerX+20,y+29,22,"#174536","700");
   item.lines.forEach((line,index)=>drawText(line,innerX+20,y+61+index*31,22,"#40574a","500"));
   y+=entryHeight+12;
  }
  if(extraComments)drawText("+ "+extraComments+" comentarios más en la aplicación",innerX,y+14,20,"#8b7448","700");
 }
 drawText("ESPÍRITU NAVIDEÑO  ·  "+String(challenge?.title||"COMUNIDAD").toLocaleUpperCase("es-PE").slice(0,48),width/2,height-54,19,"#e8c675","700","center");
 return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("No se pudo generar la imagen de la publicación.")),"image/png"));
}
async function shareSpiritPost(post,challenge){
 const button=document.querySelector('[data-spirit-share="'+CSS.escape(post.id)+'"]');
 if(button){button.disabled=true;button.textContent="Preparando imagen…";}
 try{
  let comments=[];
  if(Number(post.comment_count||0)>0){
   const data=await api("/api/spirit/submissions/"+encodeURIComponent(post.id)+"/comments",{noMemoryCache:true});
   comments=data.comments||[];
  }
  let currentPost=post;
  try{
   const latestBoard=await api("/api/spirit/board",{noMemoryCache:true,timeoutMs:12000});
   currentPost=(latestBoard.submissions||[]).find(item=>item.id===post.id)||post;
  }catch(error){console.warn("No se pudo actualizar el perfil para la imagen compartida:",error);}
  const blob=await createSpiritPostImage(currentPost,challenge,comments);
  const file=new File([blob],"espiritu-navideno-"+String(post.id).slice(0,8)+".png",{type:"image/png"});
  if(navigator.share&&navigator.canShare?.({files:[file]})){
   await navigator.share({files:[file]});
   await notifySpiritShare(post.id);
   return;
  }
  const url=URL.createObjectURL(blob),download=document.createElement("a");
  download.href=url;download.download=file.name;document.body.appendChild(download);download.click();download.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  alert("La imagen se descargó. Adjunta el PNG en WhatsApp para compartirla sin descripción.");
  await notifySpiritShare(post.id);
 }catch(error){
  if(error?.name==="AbortError")return;
  console.error("No se pudo compartir la tarjeta de Espíritu:",error);
  alert(error?.message||"No se pudo preparar la imagen para compartir.");
 }finally{
  if(button){button.disabled=false;button.innerHTML="📲 Compartir";}
 }
}
async function renderSpiritTab(dataOverride=null){
 const home=$("#member-app .member-home");if(!home)return;
 home.innerHTML='<div class="spirit-heading"><span>🎄</span><div><p class="kicker">NAVIDAD PYME · 2026</p><h2>Espíritu Navideño</h2><p>Comparte, participa y contagia la alegría de estas fiestas. ¡El primer puesto se llevará un premio sorpresa!</p></div></div><div id="spirit-content"><div class="tab-skeleton"><span></span><span></span><span></span></div></div>';
 try{
  const spiritCacheKey="spirit-board:"+selectedEditionId+":"+currentUser.user.id;
  let cachedBoard=null;
  if(!dataOverride){try{const saved=JSON.parse(localStorage.getItem(spiritCacheKey)||sessionStorage.getItem(spiritCacheKey)||"null");if(saved&&Date.now()-saved.savedAt<86400000)cachedBoard=saved.data;}catch{}}
  const data=dataOverride||await api("/api/spirit/board",{noMemoryCache:true,timeoutMs:12000});
  const bonusData=await api("/api/spirit/extra",{timeoutMs:10000}).catch(()=>({challenge:null,submission:null}));
  if(dataOverride||!cachedBoard){const snapshot=JSON.stringify({savedAt:Date.now(),data});try{localStorage.setItem(spiritCacheKey,snapshot);sessionStorage.setItem(spiritCacheKey,snapshot);}catch{}}
  const host=$("#spirit-content"),challenge=data.challenge,ranking=data.ranking||[],submissions=data.submissions||[],medals=["🥇","🥈","🥉"];
  const rankAvatar=person=>'<span class="spirit-rank-avatar">'+(person.avatar_url&&isAvatarSource(person.avatar_url)?'<img src="'+esc(avatarUrl(person.avatar_url,64))+'" alt="" loading="lazy" decoding="async" width="40" height="40">':'🎄')+'</span>';
  const rankName=person=>esc(person.display_name)+(Number(person.rank)===1&&Number(person.first_place_streak)>=2?' <b class="spirit-streak" title="Racha de primeros lugares consecutivos">🔥 '+Number(person.first_place_streak)+' '+(Number(person.first_place_streak)===1?'día':'días')+'</b>':'')+(person.user_id===currentUser.user.id?' <small>¡Tú!</small>':'');
  const podiumPeople=ranking.slice(0,3),restPeople=ranking.slice(3),myRankingIndex=ranking.findIndex(person=>person.user_id===currentUser.user.id);
  const podiumMarkup=podiumPeople.length?'<div class="spirit-ranking-podium">'+podiumPeople.map(person=>'<article class="spirit-podium-card spirit-podium-rank-'+Number(person.rank)+' '+(person.user_id===currentUser.user.id?'is-me':'')+'"><span class="spirit-podium-medal">'+(Number(person.rank)===1?'🥇':Number(person.rank)===2?'🥈':'🥉')+'</span>'+rankAvatar(person)+'<b class="spirit-podium-name">'+rankName(person)+'</b><strong>'+Number(person.points||0)+' <small>pts</small></strong></article>').join("")+'</div>':'';
  const rankRows=restPeople.length?restPeople.map((person,index)=>index>=7&&person.user_id===currentUser.user.id?'':'<article '+(index>=7?'hidden ':'')+'class="spirit-rank-row spirit-rank-group spirit-full-rank-row spirit-compact-rank-row '+(index>=7?'is-collapsed ':'')+(person.user_id===currentUser.user.id?'is-me':'')+'"><span class="spirit-rank-position">#'+Number(person.rank)+'</span>'+rankAvatar(person)+'<span class="spirit-rank-name"><span class="spirit-rank-names">'+rankName(person)+'</span></span><span class="spirit-rank-points">'+Number(person.points||0)+' pts</span></article>').join(""):'';
  const myPinnedMarkup=myRankingIndex>=10?'<div class="spirit-my-rank-label">TU POSICIÓN</div><article class="spirit-rank-row spirit-rank-group spirit-full-rank-row spirit-compact-rank-row is-me"><span class="spirit-rank-position">#'+Number(ranking[myRankingIndex].rank)+'</span>'+rankAvatar(ranking[myRankingIndex])+'<span class="spirit-rank-name"><span class="spirit-rank-names">'+rankName(ranking[myRankingIndex])+'</span></span><span class="spirit-rank-points">'+Number(ranking[myRankingIndex].points||0)+' pts</span></article>':'';
  const rankMarkup=ranking.length?podiumMarkup+rankRows:'<p class="spirit-muted">Aún no hay participantes confirmados en este intercambio.</p>';
  const type=challenge?.challenge_type||"text",cfg=challenge?.config||{};
  const bonus=bonusData.challenge,bonusSubmission=bonusData.submission,bonusType=bonus?.challenge_type||"text";
  const bonusField=bonusType==="photo"||bonusType==="voice"?'<label class="spirit-file-label">📎 Adjunta tu evidencia<input name="media" type="file" accept="'+(bonusType==="photo"?"image/jpeg,image/png,image/webp":"audio/*")+'" required></label><label>Comentario (opcional)<textarea name="caption" maxlength="500"></textarea></label>':'<label>Tu participación<textarea name="caption" maxlength="500" minlength="2" required placeholder="Escribe tu participación bonus…"></textarea></label>';
  const bonusMarkup=bonus?'<article class="spirit-challenge spirit-bonus-card"><div class="spirit-challenge-top"><span>🌟 RETO BONUS</span><b>+3 PUNTOS</b></div><h3>'+esc(bonus.title)+'</h3><p>'+esc(bonus.description)+'</p><small>Los puntos extra se entregan únicamente cuando el administrador apruebe tu evidencia.</small>'+(bonusSubmission?'<p class="spirit-submitted">'+(bonusSubmission.status==="approved"?'✅ Aprobado · +3 puntos':bonusSubmission.status==="rejected"?'Participación revisada.':'⏳ Evidencia enviada · pendiente de aprobación')+'</p>':'<form id="spirit-bonus-form" class="spirit-submit-form spirit-submit-form-embedded">'+bonusField+'<button class="primary-button" type="submit">Enviar evidencia bonus →</button><div id="spirit-bonus-feedback" class="spirit-feedback" role="status"></div></form>')+'</article>':'';

  const challengeMarkup=challenge?'<article class="spirit-challenge"><div class="spirit-challenge-top"><span>🎯 RETO ACTIVO</span><b>❤️ POR LIKES</b></div><h3>'+esc(challenge.title)+'</h3><p>'+esc(challenge.description)+'</p><small>Cada Me gusta de otro participante suma 1 punto (máximo 10 por publicación). La publicación más votada del día recibe 2 puntos extra; si hay empate, todos los primeros lugares reciben la bonificación.</small></article>':'<article class="spirit-challenge"><h3>¡Estamos preparando el próximo reto!</h3><p>El reto de hoy terminó a las 6:00 a. m. (hora Perú). Estamos en pausa hasta las 6:00 p. m., cuando se abrirá el siguiente reto. ¡Vuelve más tarde para seguir sumando! 🎄</p></article>';
  let field=type==="photo"?'<label class="spirit-file-label">📷 Sube tu foto<input name="media" type="file" accept="image/jpeg,image/png,image/webp" required></label><label>Comentario (opcional)<textarea name="caption" maxlength="500"></textarea></label>':type==="voice"?'<div class="spirit-voice-recorder"><button type="button" class="admin-action" data-spirit-record>🎙️ Iniciar grabación</button><span id="spirit-record-status">Máximo 30 segundos</span><audio id="spirit-audio-preview" controls class="hidden"></audio></div><label>Comentario (opcional)<textarea name="caption" maxlength="300"></textarea></label>':type==="trivia"?'<fieldset class="spirit-trivia-options"><legend>'+esc(cfg.question||"Elige la respuesta correcta")+'</legend>'+(cfg.options||[]).map(o=>'<label><input type="radio" name="answer" value="'+esc(o)+'" required><span>'+esc(o)+'</span></label>').join("")+'</fieldset>':'<label>Tu participación<textarea name="caption" maxlength="500" minlength="2" required placeholder="Cuéntanos o comparte tu momento navideño…"></textarea></label>';
  const formMarkup=challenge?((Number(data.mySubmissionCount||0)>0?'<div class="spirit-submitted">🎉 Ya compartiste '+Number(data.mySubmissionCount)+' '+(Number(data.mySubmissionCount)===1?'participación':'participaciones')+' en este reto. ¡Puedes publicar más!</div>':"")+'<form id="spirit-submission-form" class="spirit-submit-form spirit-submit-form-embedded">'+field+'<button class="primary-button" type="submit">Enviar mi participación <span>→</span></button><div id="spirit-feedback" class="spirit-feedback" role="status"></div></form>'):"";
  const feed=submissions.length?'<div class="spirit-carousel" aria-label="Participaciones de la comunidad"><div class="spirit-carousel-track">'+submissions.map(p=>'<article class="spirit-post" data-spirit-post="'+esc(p.id)+'"><div class="spirit-post-head"><span class="spirit-post-avatar">'+(p.avatar_url&&isAvatarSource(p.avatar_url)?'<img src="'+esc(avatarUrl(p.avatar_url,64))+'" alt="" loading="lazy" decoding="async" width="44" height="44">':'🎄')+'</span><div><b>'+esc(p.display_name)+'</b><small>'+new Date(String(p.created_at).replace(" ","T")+"Z").toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"})+'</small></div></div><p>'+esc(p.caption)+'</p>'+(p.has_media&&String(p.media_type||"").startsWith("audio/")?'<audio class="spirit-post-audio" controls preload="none" src="'+esc((p.mediaUrl||"")+(selectedEditionId?"?editionId="+encodeURIComponent(selectedEditionId):""))+'"></audio>':p.has_media?'<img class="spirit-post-image" loading="lazy" decoding="async" src="'+esc((p.mediaUrl||"")+(selectedEditionId?"?editionId="+encodeURIComponent(selectedEditionId):""))+'" alt="Foto compartida">':"")+'<div class="spirit-post-actions"><button type="button" class="spirit-likes-toggle" data-spirit-likes="'+esc(p.id)+'">❤️ '+Number(p.votes)+' Me gusta · Ver quiénes</button>'+(currentUser?.isPrimaryAdmin?'<button type="button" class="spirit-delete-button" data-admin-spirit-delete="'+esc(p.id)+'">🛡️ Moderar publicación</button>':'')+(p.user_id===currentUser.user.id?'<button type="button" class="spirit-delete-button" data-spirit-delete="'+esc(p.id)+'">Eliminar mi participación</button>':!data.activitiesEnabled?'<small class="spirit-muted">Votaciones cerradas fuera del horario</small>':p.eligibleForVoting===false?'<small class="spirit-trivia-wrong">Respuesta incorrecta</small>':'<button type="button" '+(p.voted?(p.my_vote_submission_id===p.id?'data-spirit-unvote="'+esc(p.id)+'"':'disabled aria-label="Ya diste Me gusta a este participante"'):'data-spirit-vote="'+esc(p.id)+'"')+'>'+(p.voted?(p.my_vote_submission_id===p.id?"Quitar Me gusta ✓":"Ya diste Me gusta ✓"):"Me gusta ❤️")+'</button>')+'</div><div class="spirit-likes-panel" data-spirit-likes-panel="'+esc(p.id)+'" hidden><p class="spirit-likes-loading">Abre para consultar quiénes reaccionaron.</p></div><div class="spirit-post-tools"><button type="button" data-spirit-comments="'+esc(p.id)+'">💬 Comentarios <span>'+Number(p.comment_count||0)+'</span></button><button type="button" data-spirit-share="'+esc(p.id)+'">📲 Compartir</button></div><section class="spirit-comments-panel" data-spirit-comments-panel="'+esc(p.id)+'" hidden><div class="spirit-comments-list"><p class="spirit-comments-loading">Abre los comentarios para ver la conversación.</p></div><form data-spirit-comment-form="'+esc(p.id)+'" class="spirit-comment-form"><textarea name="comment" maxlength="500" rows="2" placeholder="Escribe un comentario respetuoso…" required></textarea><div><small>Máximo 500 caracteres</small><button type="submit">Publicar</button></div><p class="spirit-comment-feedback" role="status"></p></form></section></article>').join("")+'</div></div>':'<p class="spirit-muted">Todavía no hay publicaciones. ¡Anímate a inaugurar el reto!</p>';
   host.innerHTML='<section class="spirit-score-card"><div><small>TU PUNTUACIÓN</small><strong>'+Number(data.myPoints||0)+' pts</strong><span>'+(data.myRank?'Puesto #'+data.myRank:'Aún sin posición')+'</span></div><span class="spirit-score-icon">🏆</span></section>'+challengeMarkup.replace('</article>',formMarkup+'</article>')+bonusMarkup+((challenge||submissions.length)?'<section class="spirit-section"><div class="spirit-section-title"><h3>✨ Comunidad navideña</h3><small>'+submissions.length+' publicaciones · desliza para verlas</small></div>'+feed+'</section>':'')+'<section class="spirit-section spirit-complete-ranking"><div class="spirit-section-title"><div><h3>🏆 Ranking Espíritu</h3><small>'+ranking.length+' participantes · clasificación general</small></div><span class="spirit-ranking-total">'+ranking.length+'</span></div><div class="spirit-ranking">'+rankMarkup+'</div>'+((restPeople.length>7)?'<button type="button" id="spirit-ranking-toggle" class="spirit-ranking-toggle" aria-expanded="false">Ver todos los participantes <span>⌄</span></button>':'')+myPinnedMarkup+'<button type="button" id="spirit-share-podium" class="spirit-share-podium">📲 Compartir podio como imagen</button></section>';
  if(!home.dataset.spiritHandlers){
   home.dataset.spiritHandlers="1";
   home.addEventListener("submit",async ev=>{const commentForm=ev.target.closest("[data-spirit-comment-form]");if(commentForm){ev.preventDefault();const postId=commentForm.dataset.spiritCommentForm,button=commentForm.querySelector('button[type="submit"]'),feedback=commentForm.querySelector(".spirit-comment-feedback"),textarea=commentForm.elements.comment,comment=String(textarea.value||"").trim();if(!comment)return;button.disabled=true;button.textContent="Publicando…";try{await api("/api/spirit/submissions/"+encodeURIComponent(postId)+"/comments",{method:"POST",body:JSON.stringify({comment})});textarea.value="";await refreshSpiritComments(postId);const countButton=home.querySelector('[data-spirit-comments="'+CSS.escape(postId)+'"] span');if(countButton)countButton.textContent=String(Number(countButton.textContent||0)+1);}catch(error){feedback.textContent=error.message;}finally{button.disabled=false;button.textContent="Publicar";}return;}if(ev.target.id==="spirit-bonus-form"){ev.preventDefault();const form=ev.target,button=form.querySelector('button[type="submit"]'),fb=$("#spirit-bonus-feedback");button.disabled=true;button.textContent="Enviando…";try{let caption=String(form.elements.caption?.value||"").trim(),mediaData="",mediaType="";if(bonusType==="photo"||bonusType==="voice"){const file=form.elements.media.files[0];if(!file)throw Error("Selecciona la evidencia.");mediaData=await blobToDataUrl(file);mediaType=file.type||"";}await api("/api/spirit/extra/submissions",{method:"POST",body:JSON.stringify({caption,mediaData,mediaType})});await renderSpiritTab();}catch(error){fb.textContent=error.message;button.disabled=false;button.textContent="Enviar evidencia bonus →";}return;}if(ev.target.id!=="spirit-submission-form")return;ev.preventDefault();const form=ev.target,button=form.querySelector('button[type="submit"]'),fb=$("#spirit-feedback");button.disabled=true;button.textContent="Enviando…";try{let caption=String(form.elements.caption?.value||"").trim(),mediaData="",mediaType="";if(type==="photo"){const file=form.elements.media.files[0];if(!file)throw Error("Selecciona una foto.");mediaData=await compressWishImage(file);mediaType="image/jpeg";}if(type==="voice"){if(!window.__spiritAudioBlob)throw Error("Primero graba tu mensaje de voz.");mediaData=await blobToDataUrl(window.__spiritAudioBlob);mediaType=(window.__spiritAudioBlob.type||"audio/webm").split(";")[0].toLowerCase()||"audio/webm";}if(type==="trivia")caption=String(new FormData(form).get("answer")||"");const result=await api("/api/spirit/submissions",{method:"POST",body:JSON.stringify({caption,mediaData,mediaType})});await renderSpiritTab();const score=$("#spirit-content .spirit-score-card");if(score)score.insertAdjacentHTML("afterend",'<p class="spirit-success">'+(type==="trivia"?(result.correct?"¡Respuesta correcta! ":"Respuesta registrada. Sigue participando. "):"¡Participación enviada! ")+"Los puntos llegarán con los Me gusta que recibas. ❤️</p>");}catch(error){fb.textContent=error.message;button.disabled=false;button.textContent="Enviar mi participación →";}});
   home.addEventListener("click",async ev=>{
    const likesToggle=ev.target.closest("[data-spirit-likes]");if(likesToggle){const postId=likesToggle.dataset.spiritLikes,panel=home.querySelector('[data-spirit-likes-panel="'+CSS.escape(postId)+'"]');if(panel){panel.hidden=!panel.hidden;if(!panel.hidden)await refreshSpiritLikes(postId);}return;}
    const commentToggle=ev.target.closest("[data-spirit-comments]");if(commentToggle){const postId=commentToggle.dataset.spiritComments,panel=home.querySelector('[data-spirit-comments-panel="'+CSS.escape(postId)+'"]');if(panel){panel.hidden=!panel.hidden;if(!panel.hidden&&!panel.dataset.loaded)await refreshSpiritComments(postId);}return;}const rankingToggle=ev.target.closest("#spirit-ranking-toggle");if(rankingToggle){const expanded=rankingToggle.getAttribute("aria-expanded")==="true";home.querySelectorAll(".spirit-compact-rank-row.is-collapsed").forEach(row=>{row.hidden=expanded;});rankingToggle.setAttribute("aria-expanded",String(!expanded));rankingToggle.innerHTML=expanded?'Ver todos los participantes <span>⌄</span>':'Mostrar menos <span>⌃</span>';return;}const sharePost=ev.target.closest("[data-spirit-share]");if(sharePost){const post=submissions.find(item=>item.id===sharePost.dataset.spiritShare);if(post)await shareSpiritPost(post,challenge);return;}const sharePodium=ev.target.closest("#spirit-share-podium");if(sharePodium){await shareSpiritPodium(ranking,challenge);return;}
    const record=ev.target.closest("[data-spirit-record]");if(record){const status=$("#spirit-record-status"),preview=$("#spirit-audio-preview");try{if(!spiritRecorder||spiritRecorder.state==="inactive"){if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error("La grabación necesita abrirse desde el enlace seguro de la aplicación (https://) en Chrome o Safari.");if(!window.MediaRecorder)throw Error("Este navegador no es compatible con la grabación de audio. Abre la aplicación en Chrome actualizado.");let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}catch(firstError){if(firstError?.name==="OverconstrainedError"||firstError?.name==="ConstraintNotSatisfiedError")stream=await navigator.mediaDevices.getUserMedia({audio:true});else throw firstError;}spiritAudioChunks=[];spiritRecorder=new MediaRecorder(stream);spiritRecorder.ondataavailable=e=>{if(e.data.size)spiritAudioChunks.push(e.data);};spiritRecorder.onstop=()=>{window.__spiritAudioBlob=new Blob(spiritAudioChunks,{type:spiritRecorder.mimeType||"audio/webm"});preview.src=URL.createObjectURL(window.__spiritAudioBlob);preview.classList.remove("hidden");stream.getTracks().forEach(t=>t.stop());status.textContent="Audio listo para enviar.";record.textContent="🎙️ Grabar nuevamente";};spiritRecorder.start();record.textContent="⏹ Detener grabación";status.textContent="Grabando… máximo 30 segundos.";window.__spiritVoiceLimit=setTimeout(()=>{if(spiritRecorder?.state==="recording")spiritRecorder.stop();},30000);}else if(spiritRecorder.state==="recording"){clearTimeout(window.__spiritVoiceLimit);spiritRecorder.stop();}}catch(error){const name=error?.name||"";if(name==="NotAllowedError"||name==="PermissionDeniedError"||/permission denied|not allowed/i.test(error?.message||"")){status.textContent="No se concedió acceso al micrófono. En Android: abre los ajustes del sitio desde el candado junto a la dirección, entra en Permisos y activa Micrófono. Si está bloqueado en el teléfono, ve a Ajustes > Aplicaciones > Chrome > Permisos > Micrófono. Después vuelve a cargar esta página e inténtalo otra vez.";}else if(name==="NotFoundError"||name==="DevicesNotFoundError"){status.textContent="No encontramos un micrófono disponible en este dispositivo.";}else if(name==="NotReadableError"||name==="TrackStartError"){status.textContent="El micrófono está siendo usado por otra aplicación. Ciérrala e inténtalo nuevamente.";}else if(name==="SecurityError"){status.textContent="El navegador bloqueó el micrófono. Abre la aplicación directamente en Chrome y permite el acceso al micrófono.";}else{status.textContent=error?.message||"No se pudo iniciar la grabación. Revisa el permiso del micrófono.";}console.warn("Error de grabación de Espíritu:",name,error?.message||error);}return;}
    const adminPostDel=ev.target.closest("[data-admin-spirit-delete]");if(adminPostDel){if(!confirm("¿Eliminar esta publicación por contenido potencialmente peligroso? También se eliminarán sus comentarios, votos y puntos asociados."))return;adminPostDel.disabled=true;adminPostDel.textContent="Eliminando…";try{await api("/api/admin/spirit/submissions/"+encodeURIComponent(adminPostDel.dataset.adminSpiritDelete),{method:"DELETE"});await renderSpiritTab();}catch(error){adminPostDel.disabled=false;adminPostDel.textContent=error.message;}return;}
    const commentDel=ev.target.closest("[data-spirit-comment-delete]");if(commentDel){const commentId=commentDel.dataset.spiritCommentDelete;commentDel.disabled=true;try{await api("/api/spirit/comments/"+encodeURIComponent(commentId),{method:"DELETE"});const panel=commentDel.closest(".spirit-comments-panel"),postId=panel?.dataset.spiritCommentsPanel;await refreshSpiritComments(postId);const countButton=home.querySelector('[data-spirit-comments="'+CSS.escape(postId)+'"] span');if(countButton)countButton.textContent=String(Math.max(0,Number(countButton.textContent||0)-1));}catch(error){commentDel.disabled=false;alert(error.message);}return;}const del=ev.target.closest("[data-spirit-delete]");if(del){if(!confirm("¿Eliminar tu participación y los puntos asociados?"))return;del.disabled=true;del.textContent="Eliminando…";try{await api("/api/spirit/submissions/"+encodeURIComponent(del.dataset.spiritDelete),{method:"DELETE"});await renderSpiritTab();}catch(error){del.disabled=false;del.textContent=error.message;}return;}
    const unvote=ev.target.closest("[data-spirit-unvote]");if(unvote){unvote.disabled=true;try{await api("/api/spirit/submissions/"+encodeURIComponent(unvote.dataset.spiritUnvote)+"/vote",{method:"DELETE"});await renderSpiritTab();}catch(error){unvote.disabled=false;unvote.textContent=error.message;}return;}const vote=ev.target.closest("[data-spirit-vote]");if(!vote)return;vote.disabled=true;vote.textContent="Enviando…";try{await api("/api/spirit/submissions/"+encodeURIComponent(vote.dataset.spiritVote)+"/vote",{method:"POST",body:JSON.stringify({})});await renderSpiritTab();}catch(error){vote.disabled=false;vote.textContent=error.message;}
   });
  }
  if(cachedBoard&&!dataOverride){
   api("/api/spirit/board",{noMemoryCache:true,timeoutMs:12000}).then(fresh=>{
    const snapshot=JSON.stringify({savedAt:Date.now(),data:fresh});try{localStorage.setItem(spiritCacheKey,snapshot);sessionStorage.setItem(spiritCacheKey,snapshot);}catch{}
    if(home.querySelector("#spirit-content"))renderSpiritTab(fresh);
   }).catch(error=>console.warn("No se pudo actualizar Espíritu en segundo plano; se conserva el tablero guardado:",error));
  }
 }catch(error){const host=$("#spirit-content");if(host){host.innerHTML='<div class="status error" role="alert"><b>No pudimos cargar Espíritu Navideño.</b><p>'+esc(error.message||"Comprueba tu conexión.")+'</p><small>La pantalla volverá a intentarlo cuando regreses a esta pestaña.</small></div><button type="button" class="primary-button" id="spirit-retry-button">Intentar nuevamente</button>';host.querySelector("#spirit-retry-button")?.addEventListener("click",()=>renderSpiritTab());}}
}
async function loadSpiritAdmin(){
 const host=$("#spirit-admin-controls");if(!host||!currentUser?.isPrimaryAdmin)return;
 try{
  const [daily,activity,bonus]=await Promise.all([api("/api/admin/spirit/challenges",{noMemoryCache:true}),api("/api/admin/spirit/activities",{noMemoryCache:true}),api("/api/admin/spirit/bonus",{noMemoryCache:true})]);
  const active=bonus.active;
  host.innerHTML='<section class="spirit-admin"><div class="management-heading"><div><h3>🌟 Reto bonus</h3><p>Activa un reto sorpresa autogenerado. Cada reto se utiliza una sola vez por edición y nunca se repetirá.</p></div></div><div class="spirit-activity-switch"><div><b>'+(active?'Bonus activo: '+esc(active.title):'No hay reto bonus activo')+'</b><small>'+(active?'Duración: 24 horas · Cada aprobación entrega +3 puntos.':'Pulsa el botón para publicar un reto aleatorio nuevo.')+'</small></div><button type="button" class="admin-action" id="spirit-bonus-activate" '+(active?'disabled':'')+'>'+(active?'🌟 Reto bonus activo':'🎁 Activar reto bonus')+'</button></div><div class="spirit-active-challenge"><b>Evidencias recibidas</b><div id="spirit-bonus-reviews">'+(bonus.submissions.length?bonus.submissions.map(x=>'<div class="spirit-bonus-review"><b>'+esc(x.display_name)+'</b><small>'+esc(x.caption||'Evidencia adjunta')+' · '+(x.status==='pending'?'Pendiente':x.status==='approved'?'Aprobada':'Rechazada')+'</small>'+(x.media_type?'<small>'+esc(x.media_type)+'</small>':'')+(x.status==='pending'?'<button type="button" class="admin-action" data-bonus-review="'+esc(x.id)+'" data-review-status="approved">Aprobar +3 pts</button><button type="button" class="spirit-admin-cancel" data-bonus-review="'+esc(x.id)+'" data-review-status="rejected">Rechazar</button>':'')+'</div>').join(''):'Aún no hay evidencias.')+'</div></div><div class="spirit-activity-switch"><div><b>Actividades de Espíritu</b><small>'+(activity.manualOverride?'Activadas manualmente':'Funcionamiento automático según horario')+'</small></div><button type="button" class="admin-action" id="spirit-activity-toggle">'+(activity.manualOverride?'↻ Volver al horario automático':'▶ Activar ahora')+'</button></div><div class="spirit-active-challenge"><b>Reto diario actual</b><span>'+(daily.active?esc(daily.active.title):'No hay un reto diario activo')+'</span></div><button type="button" class="spirit-reset-points" id="spirit-reset-my-points">↺ Reiniciar mis puntos</button><small>Solo afecta tu puntuación en la edición actual.</small><div id="spirit-admin-feedback" role="status"></div></section>';
  $("#spirit-bonus-activate").addEventListener("click",async ev=>{const b=ev.currentTarget;if(!confirm("¿Activar un reto bonus aleatorio? No se repetirá en esta edición."))return;b.disabled=true;b.textContent="Generando…";try{const result=await api("/api/admin/spirit/bonus/activate",{method:"POST",body:JSON.stringify({})});await loadSpiritAdmin();$("#spirit-admin-controls").insertAdjacentHTML("afterbegin",'<p class="spirit-success">¡Reto bonus activado: '+esc(result.title)+'! Vale +3 puntos tras tu aprobación.</p>');}catch(error){b.disabled=false;b.textContent="🎁 Activar reto bonus";$("#spirit-admin-feedback").textContent=error.message;}});
  $("#spirit-bonus-reviews").addEventListener("click",async ev=>{const b=ev.target.closest("[data-bonus-review]");if(!b)return;const status=b.dataset.reviewStatus;if(!confirm(status==="approved"?"¿Aprobar esta evidencia y otorgar 3 puntos?":"¿Rechazar esta evidencia? No recibirá puntos."))return;b.disabled=true;try{await api("/api/admin/spirit/bonus/submissions/"+encodeURIComponent(b.dataset.bonusReview),{method:"PATCH",body:JSON.stringify({status})});await loadSpiritAdmin();}catch(error){b.disabled=false;$("#spirit-admin-feedback").textContent=error.message;}});
  $("#spirit-activity-toggle").addEventListener("click",async ev=>{const b=ev.currentTarget,next=!activity.manualOverride;if(!confirm(next?"¿Activar manualmente las actividades de Espíritu?":"¿Volver al horario automático?"))return;b.disabled=true;try{await api("/api/admin/spirit/activities",{method:"PATCH",body:JSON.stringify({manualOverride:next})});await loadSpiritAdmin();}catch(error){b.disabled=false;b.textContent=error.message;}});
  $("#spirit-reset-my-points").addEventListener("click",async()=>{if(!confirm("¿Dejar tu puntuación en cero? Se eliminarán todos tus puntos de Espíritu en esta edición."))return;const b=$("#spirit-reset-my-points");b.disabled=true;try{const result=await api("/api/admin/spirit/reset-my-points",{method:"POST",body:JSON.stringify({})});b.textContent="Tus puntos fueron reiniciados ✓";b.insertAdjacentHTML("afterend",'<p class="spirit-success">Se eliminaron '+Number(result.deleted)+' registros.</p>');}catch(error){b.disabled=false;b.textContent=error.message;}});
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
   const avatar=p.avatar_url&&isAvatarSource(p.avatar_url)?'<img src="'+esc(avatarUrl(p.avatar_url,64))+'" alt="" loading="lazy" decoding="async" width="44" height="44">':esc(initials||"🎄");
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
 home.innerHTML='<div class="admin-settings-view"><div class="settings-header"><span>⚙️</span><div><h2>Administración</h2><p>Accede directamente a cada área, sin recorrer una pantalla interminable.</p></div></div><nav class="admin-settings-nav" aria-label="Secciones de administración"><button type="button" class="active" data-admin-section="general">⚙️ General</button><button type="button" data-admin-section="activity">📊 Actividad</button><button type="button" data-admin-section="spirit">🎄 Espíritu</button><button type="button" data-admin-section="draw">🎁 Sorteo</button><button type="button" data-admin-section="tools">👥 Participantes</button></nav><section class="admin-settings-section" id="admin-section-general"><div id="edition-settings-feedback" class="status hidden"></div><form id="edition-settings-form" class="edition-settings-form"><label>Nombre del intercambio<input name="title" maxlength="100" required></label><label>Fecha del intercambio<input name="eventDate" type="date"></label><label>Presupuesto por persona (S/) <input name="budgetAmount" type="number" min="0" step="0.01" placeholder="Ej. 80"></label><button class="primary-button" type="submit">Guardar ajustes</button></form><div id="onboarding-home-editor" class="onboarding-home-editor hidden"><h3>Plantilla de Inicio · Onboarding Digital</h3><p>Solo el administrador puede editar estos datos y decidir qué secciones se muestran.</p><form id="onboarding-home-form"><label>Mensaje de bienvenida<input name="welcomeText" maxlength="300"></label><label><input type="checkbox" name="showDate" checked> Mostrar fecha</label><label><input type="checkbox" name="showPlace" checked> Mostrar lugar</label><label>Nombre del lugar<input name="placeName" maxlength="300"></label><label><input type="checkbox" name="showAddress" checked> Mostrar dirección</label><label>Dirección<textarea name="address" rows="2" maxlength="300"></textarea></label><label><input type="checkbox" name="showSchedule" checked> Mostrar horario</label><label>Horario<input name="schedule" maxlength="300"></label><label><input type="checkbox" name="showBreakfast" checked> Mostrar desayuno</label><label>Desayuno<input name="breakfast" maxlength="300"></label><label><input type="checkbox" name="showGrillFee" checked> Mostrar cuota / aporte</label><label>Cuota / aporte<input name="grillFee" maxlength="300"></label><label><input type="checkbox" name="showExtraInfo" checked> Mostrar indicaciones adicionales</label><label>Indicaciones adicionales<textarea name="extraInfo" rows="3" maxlength="1500"></textarea></label><label><input type="checkbox" name="showMap" checked> Mostrar enlace y mapa</label><label>Enlace de Google Maps<input name="mapUrl" type="url" placeholder="https://maps.app.goo.gl/..."></label><label>Texto para compartir por WhatsApp<textarea name="shareMessage" rows="4" maxlength="1500"></textarea></label><button class="primary-button" type="submit">Guardar información de Inicio</button><div id="onboarding-home-feedback" class="status hidden"></div></form></div></form><p class="settings-note">Los ajustes se pueden modificar mientras el sorteo no se haya realizado.</p></section><section class="admin-settings-section hidden" id="admin-section-activity"><div id="admin-activity-panel"><p class="muted">Consultando actividad…</p></div></section><section class="admin-settings-section hidden" id="admin-section-spirit"><div id="spirit-admin-controls"></div></section><section class="admin-settings-section hidden" id="admin-section-draw"><div id="draw-admin-controls"></div></section><section class="admin-settings-section hidden" id="admin-section-tools"><div class="admin-tools-section"><div id="admin-tools-slot"></div></div></section></div>';
 const loadSection=async key=>{
  const target=home.querySelector("#admin-section-"+key);if(!target||target.dataset.loaded==="1"||target.dataset.loading==="1")return;
  target.dataset.loading="1";
  try{
   if(key==="activity"){
    await loadAdminActivity();
   }else if(key==="tools"){
    const panel=$("#admin-panel")||document.createElement("section");panel.id="admin-panel";panel.className="admin-panel";$("#admin-tools-slot").append(panel);panel.classList.remove("hidden");await renderAdmin();
   }else if(key==="draw")await loadAdminDrawControls();
   else if(key==="spirit")await loadSpiritAdmin();
   else if(key==="general"){
    const data=await api("/api/admin/status"),e=data.edition||{},form=$("#edition-settings-form"); const selectedTeam=currentUser?.membership?.team_name||""; const homeEditor=$("#onboarding-home-editor"); if(selectedTeam==="Onboarding Digital"&&homeEditor){homeEditor.classList.remove("hidden");const homeData=await api("/api/admin/edition/home",{noMemoryCache:true});const hf=$("#onboarding-home-form");for(const [key,value] of Object.entries(homeData.config||{})){if(hf.elements[key]){if(hf.elements[key].type==="checkbox")hf.elements[key].checked=value!==false;else hf.elements[key].value=value||"";}}hf.addEventListener("submit",async ev=>{ev.preventDefault();const fb=$("#onboarding-home-feedback");try{await api("/api/admin/edition/home",{method:"PATCH",body:JSON.stringify({...Object.fromEntries(new FormData(hf)),...Object.fromEntries([...hf.querySelectorAll('input[type="checkbox"]')].map(el=>[el.name,el.checked]))})});fb.textContent="La plantilla de Inicio se guardó correctamente.";fb.classList.remove("hidden","error");}catch(err){fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}});}
    form.elements.title.value=e.title||"";form.elements.eventDate.value=e.event_date||"";form.elements.budgetAmount.value=e.budget_amount??"";
    if(e.status!=="registration"){form.querySelector("button").disabled=true;form.querySelectorAll("input").forEach(x=>x.disabled=true);$("#edition-settings-feedback").textContent="Los ajustes están bloqueados porque el sorteo ya fue realizado o la edición terminó.";$("#edition-settings-feedback").classList.remove("hidden");}
    form.addEventListener("submit",async ev=>{ev.preventDefault();const values=Object.fromEntries(new FormData(form)),fb=$("#edition-settings-feedback");try{await api("/api/admin/edition",{method:"PATCH",body:JSON.stringify(values)});currentUser=await api("/api/me");updateMemberCountdown(currentUser.membership?.event_date);fb.textContent="Los ajustes del intercambio se guardaron correctamente.";fb.classList.remove("hidden","error");}catch(err){fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}});
   }
   target.dataset.loaded="1";
  }catch(error){target.innerHTML='<div class="status error">'+esc(error.message)+'</div>';delete target.dataset.loading;return;}
  delete target.dataset.loading;
 };
 home.querySelectorAll("[data-admin-section]").forEach(btn=>btn.addEventListener("click",async()=>{home.querySelectorAll("[data-admin-section]").forEach(x=>x.classList.toggle("active",x===btn));home.querySelectorAll(".admin-settings-section").forEach(x=>x.classList.toggle("hidden",x.id!=="admin-section-"+btn.dataset.adminSection));await loadSection(btn.dataset.adminSection);}));
 await loadSection("general");
}
let activityRefreshTimer=null;
async function loadAdminActivity(){
 const host=$("#admin-activity-panel");if(!host||!currentUser?.isPrimaryAdmin)return;
 const refresh=async()=>{
  try{
   const data=await api("/api/admin/activity",{noMemoryCache:true});
   const metric=(label,value,detail)=>'<article class="admin-activity-metric"><small>'+label+'</small><strong>'+Number(value||0)+'</strong><span>'+detail+'</span></article>';
   const formatPeruTime=value=>{if(!value)return "Sin registros";const date=new Date(String(value).replace(" ","T")+"Z");if(Number.isNaN(date.getTime()))return "Sin registros";return new Intl.DateTimeFormat("es-PE",{timeZone:"America/Lima",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false}).format(date);};
   const participation=data.participation||[];
   const wishTotal=participation.filter(p=>Number(p.wish_count)>0).length;
   const messageTotal=participation.filter(p=>Number(p.message_count)>0).length;
   const avatar=p=>'<span class="admin-activity-avatar">'+(p.avatar_url&&isAvatarSource(p.avatar_url)?'<img src="'+esc(avatarUrl(p.avatar_url,64))+'" alt="">':'🎄')+'</span>';
   const onlineRows=(data.recent||[]).map(p=>'<div class="admin-activity-person">'+avatar(p)+'<span class="admin-activity-person-copy"><b>'+esc(p.display_name)+'</b><small>'+(p.is_active?'<span class="admin-online-label">● Activo ahora</span>':'Última actividad: '+esc(formatPeruTime(p.last_seen_label)))+'</small></span><span class="admin-activity-presence '+(p.is_active?'is-online':'')+'">'+(p.is_active?'En línea':'Reciente')+'</span></div>').join("")||'<p class="admin-activity-empty">Todavía no hay actividad registrada.</p>';
   const wishRows=participation.map(p=>'<div class="admin-participation-person">'+avatar(p)+'<span class="admin-participation-name"><b>'+esc(p.display_name)+'</b><small>'+(Number(p.wish_count)>0?Number(p.wish_count)+' deseo(s) · actualizado '+esc(formatPeruTime(p.last_wish_at)):'Todavía no registra deseos')+'</small></span><span class="admin-participation-status '+(Number(p.wish_count)>0?'is-done':'is-pending')+'">'+(Number(p.wish_count)>0?'Registrado':'Pendiente')+'</span></div>').join("")||'<p class="admin-activity-empty">No hay participantes confirmados.</p>';
   const messageRows=participation.map(p=>'<div class="admin-participation-person">'+avatar(p)+'<span class="admin-participation-name"><b>'+esc(p.display_name)+'</b><small>'+(Number(p.message_count)>0?'Último envío: '+esc(formatPeruTime(p.last_message_at)):'Aún no envía mensajes')+'</small></span><span class="admin-participation-messages"><b>'+Number(p.message_count)+'</b><small>enviados</small></span></div>').join("")||'<p class="admin-activity-empty">No hay participantes confirmados.</p>';
   host.innerHTML='<div class="admin-activity-heading"><div><h3>Actividad de participantes</h3><p>Consulta por separado la conexión, los deseos y los mensajes de cada participante.</p></div><button type="button" class="admin-action" id="admin-activity-refresh">↻ Actualizar</button></div>'+
    '<nav class="admin-activity-tabs" aria-label="Seguimiento de actividad">'+
     '<button type="button" class="active" data-activity-view="online">🟢 Usuarios activos</button>'+
     '<button type="button" data-activity-view="wishes">💝 Deseos <span>'+wishTotal+'/'+participation.length+'</span></button>'+
     '<button type="button" data-activity-view="messages">✉️ Mensajes <span>'+messageTotal+'/'+participation.length+'</span></button>'+
    '</nav>'+
    '<section class="admin-activity-view" data-activity-panel="online"><div class="admin-activity-grid">'+metric("Activos ahora",data.activeNow,"Últimos 5 minutos")+metric("Activos hoy",data.activeToday,"Usuarios únicos")+metric("Activos esta semana",data.activeWeek,"Últimos 7 días")+metric("Participantes",data.participants,"Inscripciones confirmadas")+'</div><div class="admin-activity-list"><div class="admin-activity-section-heading"><div><h4>Conexiones recientes</h4><p>Personas que han ingresado a la aplicación, ordenadas por última actividad.</p></div><span class="admin-activity-count">'+(data.recent||[]).length+'</span></div><div class="admin-activity-list-inner">'+onlineRows+'</div></div><p class="settings-note">Se considera activo a quien haya interactuado durante los últimos 5 minutos. La lista se actualiza automáticamente cada 30 segundos.</p></section>'+
    '<section class="admin-activity-view hidden" data-activity-panel="wishes"><div class="admin-activity-list"><div class="admin-activity-section-heading"><div><h4>Registro de deseos</h4><p>'+wishTotal+' de '+participation.length+' participantes ya registraron al menos un deseo.</p></div><span class="admin-activity-count">'+wishTotal+'/'+participation.length+'</span></div><div class="admin-activity-list-inner">'+wishRows+'</div></div></section>'+
    '<section class="admin-activity-view hidden" data-activity-panel="messages"><div class="admin-activity-list"><div class="admin-activity-section-heading"><div><h4>Mensajes enviados</h4><p>'+messageTotal+' de '+participation.length+' participantes han enviado mensajes desde la pestaña Mensajes.</p></div><span class="admin-activity-count">'+messageTotal+'/'+participation.length+'</span></div><div class="admin-activity-list-inner">'+messageRows+'</div></div></section>';
   host.querySelectorAll("[data-activity-view]").forEach(button=>button.addEventListener("click",()=>{
    host.querySelectorAll("[data-activity-view]").forEach(tab=>tab.classList.toggle("active",tab===button));
    host.querySelectorAll("[data-activity-panel]").forEach(panel=>panel.classList.toggle("hidden",panel.dataset.activityPanel!==button.dataset.activityView));
   }));
   $("#admin-activity-refresh")?.addEventListener("click",refresh);
  }catch(error){host.innerHTML='<p class="status error">'+esc(error.message)+'</p>';}
 };
 await refresh();
 if(activityRefreshTimer)clearInterval(activityRefreshTimer);
 activityRefreshTimer=setInterval(()=>{if($("#admin-section-activity")&&!$("#admin-section-activity").classList.contains("hidden"))refresh();},30000);
}
async function sendActivityHeartbeat(){
 if(!signedIn||document.visibilityState==="hidden")return;
 try{await api("/api/activity/heartbeat",{method:"POST",body:JSON.stringify({})});}catch{}
}
let activityHeartbeatTimer=null;
function startActivityHeartbeat(){
 if(activityHeartbeatTimer)clearInterval(activityHeartbeatTimer);
 sendActivityHeartbeat();
 activityHeartbeatTimer=setInterval(sendActivityHeartbeat,60000);
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")sendActivityHeartbeat();});
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
async function loadWishImage(img,wishId,editionId=selectedEditionId){
 if(!img||!wishId)return;
 img.classList.remove("wish-image-unavailable");
 img.setAttribute("aria-busy","true");
 const params=new URLSearchParams();if(editionId)params.set("editionId",editionId);
 const query=params.toString();
 const url="/api/wishes/image/"+encodeURIComponent(wishId)+(query?"?"+query:"");
 try{
  const response=await fetch(url,{method:"GET",credentials:"same-origin",cache:"no-store",headers:{Accept:"image/*"}});
  if(!response.ok)throw new Error(response.status===403?"No tienes permiso para ver esta imagen.":response.status===404?"La imagen ya no está disponible.":"No se pudo cargar la imagen.");
  const contentType=response.headers.get("content-type")||"";
  if(!contentType.startsWith("image/"))throw new Error("La respuesta no contiene una imagen.");
  const blob=await response.blob(),objectUrl=URL.createObjectURL(blob);
  img.onload=()=>URL.revokeObjectURL(objectUrl);
  img.onerror=()=>{URL.revokeObjectURL(objectUrl);img.classList.add("wish-image-unavailable");};
  img.src=objectUrl;
 }catch(error){
  img.classList.add("wish-image-unavailable");
  img.alt=(img.alt||"Imagen de deseo")+" · "+error.message;
 }finally{img.removeAttribute("aria-busy");}
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
 const checks=[["wishes-unread-badge","/api/wishes/unread","deseos"],["spirit-unread-badge","/api/spirit/unread","participaciones"]];
 const requests=checks.map(async([id,path,label])=>{try{const data=await api(path,{noMemoryCache:true});setUnreadBadge(id,data.unread,label);}catch{setUnreadBadge(id,0,label);}});
 requests.push((async()=>{try{const secret=await api("/api/secret/me",{noMemoryCache:true});setUnreadBadge("secret-unread-badge",secret.state==="drawn"&&!secret.hasRevealed?1:0,"asignación pendiente de revelar");}catch{setUnreadBadge("secret-unread-badge",0,"asignación pendiente de revelar");}})());
 await Promise.allSettled(requests);
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
 // D1 datetime('now') devuelve UTC sin sufijo. Construirlo como UTC explícitamente;
 // no usar new Date("YYYY-MM-DD HH:mm:ss"), porque el navegador lo interpreta localmente.
 const raw=String(value??"").trim();
 const sqlUtc=raw.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})[ T]([0-9]{2}):([0-9]{2}):([0-9]{2})$/);
 let date;
 if(sqlUtc){
  const [,y,mo,d,h,mi,se,ms="0"]=sqlUtc;
  date=new Date(Date.UTC(Number(y),Number(mo)-1,Number(d),Number(h),Number(mi),Number(se),Number((ms+"000").slice(0,3))));
 }else{
  date=new Date(raw);
 }
 if(Number.isNaN(date.getTime()))return "";
 return new Intl.DateTimeFormat("es-PE",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Lima",hour12:true}).format(date);
}

async function renderCommunityTab(options={}){
 const section=$("#member-app .member-home");if(!section)return;
 if(communityChatPollTimer){clearInterval(communityChatPollTimer);communityChatPollTimer=null;}
 if(!options.silent)section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Mensajes 💌</h2><p>Una conversación privada y anónima con tu amigo secreto.</p></div><div class="tab-skeleton"><span></span><span></span><span></span></div>';
 try{
  const data=await api("/api/community/chats",{noMemoryCache:true});
  if(data.state!=="drawn"){section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Mensajes 💌</h2></div><div class="clue-locked"><span>🎁</span><div><b>Tu chat estará listo después del sorteo</b><p>Cuando se realice la asignación, podrás conversar con tu amigo secreto.</p></div></div>';return;}
  const thread=(key,title,subtitle,item)=>{if(!item)return '';const msgs=item.messages||[];return '<article class="secret-chat-card"><header><div><span class="wish-kicker">'+subtitle+'</span><h3>'+title+'</h3></div><span class="secret-chat-icon">💌</span></header><div class="secret-chat-messages" data-chat-messages="'+key+'">'+(msgs.length?msgs.map(m=>'<div class="secret-chat-bubble '+(m.mine?'mine':'theirs')+'"><p>'+esc(m.message)+'</p><time>'+(m.mine?'Tú':'Tu amigo secreto')+' · '+formatCommunityTime(m.created_at)+'</time></div>').join(''):'<p class="secret-chat-empty">Aún no hay mensajes. ¡Rompe el hielo! 🎄</p>')+'</div><form class="secret-chat-form" data-chat-form="'+key+'"><textarea name="message" maxlength="500" rows="2" placeholder="Escribe un mensaje…" required></textarea><button type="submit" aria-label="Enviar mensaje">➤</button></form></article>';};
  section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Mensajes 💌</h2><p>Conversaciones privadas y anónimas con tu amigo secreto.</p></div><div class="secret-chat-retention">Los mensajes se eliminan automáticamente después de 7 días para mantener el chat ligero.</div><div class="secret-chat-list">'+thread("outgoing","A quien te tocó regalar","TU AMIGO SECRETO",data.outgoing)+thread("incoming","Quien te está sorprendiendo","QUIEN TE REGALA A TI",data.incoming)+'</div><div class="push-settings"><div><b>Notificaciones del chat</b><p>Recibe un aviso cuando llegue una respuesta.</p></div><button type="button" id="enable-push-notifications" class="secondary-action">🔔 Activar notificaciones</button><div id="push-feedback" class="status hidden" role="status"></div></div>';
  const push=$("#enable-push-notifications");if(push){push.addEventListener("click",()=>enablePushNotifications(push));refreshPushButtonState(push);}
  section.querySelectorAll("[data-chat-messages]").forEach(el=>el.scrollTop=el.scrollHeight);
  section.querySelectorAll("[data-chat-form]").forEach(form=>form.addEventListener("submit",async ev=>{ev.preventDefault();const target=ev.currentTarget,button=target.querySelector("button"),field=target.elements.message,message=String(field.value||"").trim();if(!message)return;button.disabled=true;try{await api("/api/community/chats",{method:"POST",body:JSON.stringify({thread:target.dataset.chatForm,message})});field.value="";await renderCommunityTab();}catch(error){alert(error.message);}finally{button.disabled=false;}}));
  updateTabUnreadBadges();
  communityChatPollTimer=setInterval(()=>{const home=$("#member-app .member-home");if(document.visibilityState==="visible"&&home?.querySelector(".secret-chat-list")&&!home.contains(document.activeElement))renderCommunityTab({silent:true});},15000);
 }catch(e){section.innerHTML='<div class="member-section-heading"><h2>Mensajes</h2></div><p class="status error">'+esc(e.message)+'</p>';}
}
async function renderWishesTab(){
 const section=$("#member-app .member-home");if(!section)return;
 section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Lista de deseos 💝</h2><p>Pequeñas ideas para inspirar el regalo perfecto.</p></div><div class="tab-skeleton" aria-label="Preparando deseos"><span></span><span></span><span></span></div>';
 try{
  const data=await api("/api/wishes");
  const mine=data.wishes||[];
  const wishCards=(items,removable)=>items.map((w,index)=>'<article class="wish-card">'+(w.has_image?'<div class="wish-image-link"><img class="wish-image" data-wish-image="'+esc(w.id)+'" alt="Imagen adjunta de '+esc(w.title)+'" loading="lazy"></div>':'<div class="wish-card-icon" aria-hidden="true">🎁</div>')+'<div class="wish-card-content"><span class="wish-number">DESEO '+String(index+1).padStart(2,"0")+'</span><h4>'+esc(w.title)+'</h4>'+(w.note?'<p>'+esc(w.note)+'</p>':'')+(w.url?'<a class="wish-link" href="'+esc(w.url)+'" target="_blank" rel="noopener noreferrer"><span>↗</span> Ver referencia</a>':'')+(w.has_image?'<button type="button" class="wish-view-image" data-view-image="'+esc(w.id)+'">⌕ Ver imagen</button>':'')+'</div>'+(removable?'<div class="wish-card-actions"><button class="wish-edit" data-edit-wish="'+esc(w.id)+'" aria-label="Editar '+esc(w.title)+'" title="Editar deseo">✎</button><button class="wish-delete" data-delete-wish="'+esc(w.id)+'" aria-label="Eliminar '+esc(w.title)+'" title="Eliminar deseo">×</button></div>':'')+'</article>').join('');
  const wishCarousel=(items,removable,id)=>'<div class="wish-carousel" data-wish-carousel="'+id+'" aria-label="'+(removable?'Tus deseos':'Deseos de tu amigo secreto')+'"><div class="wish-carousel-top"><span>'+items.length+' '+(items.length===1?'deseo':'deseos')+'</span><small>Desliza para descubrirlos <span aria-hidden="true">→</span></small></div><div class="wish-carousel-track">'+wishCards(items,removable)+'</div><div class="wish-carousel-dots" aria-hidden="true">'+items.map((_,i)=>'<span class="'+(i===0?'active':'')+'"></span>').join('')+'</div></div>';
  const recipient=data.canSeeRecipientWishes?'<section class="recipient-wishes"><div class="wish-section-heading"><div><span class="wish-kicker">INSPIRACIÓN PARA TU REGALO</span><h3>Los deseos de '+esc(data.recipientName)+'</h3></div><span class="wish-heading-icon">✨</span></div><p class="wish-section-description">Estas son algunas ideas que compartió tu amigo secreto. ¡La sorpresa sigue siendo tuya!</p>'+(data.recipientWishes.length?wishCarousel(data.recipientWishes,false,'recipient'):'<p class="wish-empty">Todavía no ha agregado deseos.</p>')+'</section>':'<div class="wish-privacy"><span>🔒</span><p><b>Tu lista es privada</b><small>Solo la persona que te tenga asignado podrá consultar tus deseos después del sorteo.</small></p></div>';
  section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Lista de deseos 💝</h2><p>Comparte lo que te gustaría recibir y ayuda a tu amigo secreto a encontrar el regalo ideal.</p></div><section class="wish-editor"><div class="wish-section-heading"><div><span class="wish-kicker">TU LISTA PERSONAL</span><h3>Agregar un deseo</h3></div><span class="wish-heading-icon">✍️</span></div><form id="wish-form"><label>Nombre del regalo<input name="title" maxlength="100" placeholder="Ej. Figura de colección de Seiya" required></label><label>Detalles o características <span>(opcional)</span><textarea name="note" maxlength="300" rows="2" placeholder="Color, modelo, tamaño o cualquier detalle útil…"></textarea></label><label>Enlace de referencia <span>(opcional)</span><input name="url" type="url" placeholder="https://…"></label><label>Imagen de referencia <span>(opcional · JPG, PNG o WEBP; máx. 2 MB)</span><input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="wish-image-preview hidden" id="wish-new-image-preview"></div><small class="wish-image-help">Si no tienes un enlace, puedes adjuntar una foto del producto.</small><div class="wish-form-footer"><small>'+mine.length+' de 10 deseos</small><button class="primary-button" type="submit" '+(mine.length>=10?'disabled':'')+'>＋ Agregar deseo</button></div><div id="wish-feedback" class="status hidden"></div></form></section><section class="wish-list"><div class="wish-section-heading"><div><span class="wish-kicker">TUS IDEAS FAVORITAS</span><h3>Mis deseos</h3></div><span class="wish-count">'+mine.length+' / 10</span></div>'+(mine.length?wishCarousel(mine,true,'mine'):'<div class="wish-empty-state"><span>🎁</span><b>Tu lista está esperando ideas</b><p>Agrega ese regalo que te haría ilusión recibir esta Navidad.</p></div>')+'</section>'+recipient;
  section.querySelectorAll("img[data-wish-image]").forEach(img=>{
   const wishId=img.dataset.wishImage;img.removeAttribute("data-wish-image");
   loadWishImage(img,wishId,selectedEditionId);
  });
  section.querySelectorAll(".wish-carousel").forEach(carousel=>{const track=carousel.querySelector(".wish-carousel-track"),dots=[...carousel.querySelectorAll(".wish-carousel-dots span")];if(!track)return;track.addEventListener("scroll",()=>{const cards=[...track.querySelectorAll(".wish-card")];if(!cards.length)return;const index=Math.max(0,Math.min(cards.length-1,Math.round(track.scrollLeft/(cards[0].offsetWidth+12))));dots.forEach((dot,i)=>dot.classList.toggle("active",i===index));},{passive:true});});
  $("#wish-form").elements.imageFile.addEventListener("change",async ev=>{const preview=$("#wish-new-image-preview");preview.classList.add("hidden");preview.innerHTML="";const file=ev.target.files[0];if(!file)return;try{const data=await compressWishImage(file);preview.innerHTML='<img src="'+data+'" alt="Vista previa de la imagen seleccionada"><button type="button" class="wish-image-remove">Quitar imagen</button>';preview.classList.remove("hidden");preview.querySelector("button").addEventListener("click",()=>{ev.target.value="";preview.classList.add("hidden");preview.innerHTML="";});}catch(e){const fb=$("#wish-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");ev.target.value="";}});
  $("#wish-form").addEventListener("submit",async ev=>{ev.preventDefault();const form=ev.currentTarget;const values=Object.fromEntries(new FormData(form));const file=form.elements.imageFile.files[0];const fb=$("#wish-feedback");try{if(file)values.imageData=await compressWishImage(file);delete values.imageFile;await api("/api/wishes",{method:"POST",body:JSON.stringify(values)});await renderWishesTab();}catch(e){fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
  section.querySelectorAll("[data-view-image]").forEach(btn=>btn.addEventListener("click",()=>{
   const wish=mine.find(item=>item.id===btn.dataset.viewImage)||((data.recipientWishes||[]).find(item=>item.id===btn.dataset.viewImage));
   if(!wish?.has_image)return;
   const modal=document.createElement("div");modal.className="wish-image-modal";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label","Imagen de referencia: "+wish.title);
   modal.innerHTML='<div class="wish-image-modal-panel"><div class="wish-image-modal-header"><div><span>IMAGEN DE REFERENCIA</span><h3>'+esc(wish.title)+'</h3></div><button type="button" class="wish-image-modal-close" aria-label="Cerrar">×</button></div><div class="wish-image-modal-stage"><img alt="Imagen de referencia para '+esc(wish.title)+'"></div><p class="wish-image-modal-caption">Imagen compartida en la lista de deseos</p></div>';
   const close=()=>{modal.remove();document.removeEventListener("keydown",onKey);};
   const onKey=e=>{if(e.key==="Escape")close();};
   modal.addEventListener("click",e=>{if(e.target===modal)close();});
   modal.querySelector(".wish-image-modal-close").addEventListener("click",close);
   document.addEventListener("keydown",onKey);document.body.appendChild(modal);modal.querySelector(".wish-image-modal-close").focus();
  loadWishImage(modal.querySelector(".wish-image-modal-stage img"),wish.id,selectedEditionId);
  }));
  section.querySelectorAll("[data-edit-wish]").forEach(btn=>btn.addEventListener("click",()=>{
   const wish=mine.find(item=>item.id===btn.dataset.editWish);if(!wish)return;
   const card=btn.closest(".wish-card");if(!card)return;
   card.innerHTML='<form class="wish-inline-edit" data-wish-edit-form="'+esc(wish.id)+'"><div class="wish-edit-heading"><b>Editar deseo</b><button type="button" class="wish-edit-cancel">Cancelar</button></div><label>Nombre del regalo<input name="title" maxlength="100" required value="'+esc(wish.title)+'"></label><label>Detalles o características<textarea name="note" maxlength="300" rows="2">'+esc(wish.note||"")+'</textarea></label><label>Enlace de referencia<input name="url" type="url" value="'+esc(wish.url||"")+'" placeholder="https://…"></label><label>Imagen de referencia <span>(opcional · JPG, PNG o WEBP)</span><input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"></label>'+(wish.has_image?'<div class="wish-image-preview"><img alt="Imagen actual"><label class="wish-remove-image-label"><input type="checkbox" name="removeImage" value="1"> Quitar imagen actual</label></div>':'<div class="wish-image-preview hidden"></div>')+'<div class="wish-edit-actions"><button type="button" class="wish-edit-cancel secondary">Cancelar</button><button type="submit" class="primary-button">Guardar cambios</button></div><div class="wish-edit-feedback status hidden"></div></form>';
   const form=card.querySelector("form");
   const currentImage=form.querySelector(".wish-image-preview img");if(currentImage)loadWishImage(currentImage,wish.id,selectedEditionId);
   const editFile=form.elements.imageFile;editFile.addEventListener("change",async ev=>{const preview=form.querySelector(".wish-image-preview");const file=ev.target.files[0];if(!file)return;try{const data=await compressWishImage(file);preview.innerHTML='<img src="'+data+'" alt="Vista previa de la nueva imagen">';preview.classList.remove("hidden");}catch(e){const feedback=form.querySelector(".wish-edit-feedback");feedback.textContent=e.message;feedback.classList.remove("hidden");feedback.classList.add("error");ev.target.value="";}});
   form.querySelectorAll(".wish-edit-cancel").forEach(cancel=>cancel.addEventListener("click",()=>renderWishesTab()));
   form.addEventListener("submit",async ev=>{ev.preventDefault();const values=Object.fromEntries(new FormData(form));const file=form.elements.imageFile.files[0];values.removeImage=!!form.elements.removeImage?.checked;delete values.imageFile;const feedback=form.querySelector(".wish-edit-feedback");const save=form.querySelector('button[type="submit"]');save.disabled=true;save.textContent="Guardando…";try{if(file)values.imageData=await compressWishImage(file);await api("/api/wishes/"+encodeURIComponent(wish.id),{method:"PUT",body:JSON.stringify(values)});await renderWishesTab();}catch(e){feedback.textContent=e.message;feedback.classList.remove("hidden");feedback.classList.add("error");save.disabled=false;save.textContent="Guardar cambios";}});
  }));
  section.querySelectorAll("[data-delete-wish]").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm("¿Eliminar este deseo de tu lista?"))return;try{await api("/api/wishes/"+encodeURIComponent(btn.dataset.deleteWish),{method:"DELETE"});await renderWishesTab();}catch(e){const fb=$("#wish-feedback");if(fb){fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}}}));
 }catch(e){section.innerHTML='<div class="member-section-heading"><h2>Lista de deseos</h2></div><p class="status error">'+esc(e.message)+'</p>';}
}
async function renderSecretTab(){
 const section=$("#member-app .member-home");if(!section)return;
 section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Mi amigo secreto</h2></div><div class="tab-skeleton tab-skeleton-compact" aria-label="Consultando tu asignación"><span></span><span></span></div>';
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
 setClass("#join-card","hidden",true);
 setClass("#member-tab-content","hidden",false);
 const app=$("#member-app"), profile=currentUser.participantProfile||{};
 app.querySelector(".member-home").innerHTML=`<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Mi equipo</h2><p>Consulta quiénes forman parte del intercambio y administra tu participación.</p></div><article class="member-feature"><span class="profile-settings-avatar">${currentUser.user.avatar_url&&isAvatarSource(currentUser.user.avatar_url)?'<img src="'+esc(avatarUrl(currentUser.user.avatar_url,96))+'" alt="Foto de perfil">':'👤'}</span><div><b>Mi perfil</b><p>${esc([profile.first_name,profile.last_name].filter(Boolean).join(" ")||currentUser.user.email)}</p><p>${esc(currentUser.user.email)}</p></div><button class="profile-action" id="edit-profile">Editar</button></article><section class="home-participants-card profile-participants-card" aria-labelledby="profile-participants-title"><div class="home-participants-heading"><div><span class="exchange-budget-kicker">EL EQUIPO QUE CELEBRA</span><h2 id="profile-participants-title">Lista de participantes <span id="profile-participants-count">(—)</span></h2></div><span class="home-participants-icon">🎄</span></div><div id="profile-participants-list" class="home-participants-list" aria-live="polite"><p class="participants-loading">Cargando participantes…</p></div></section><div class="profile-actions"><button id="withdraw-participation" class="secondary-action">Ya no quiero participar</button><button id="logout-button" class="secondary-action">Cerrar sesión</button></div><div id="profile-action-feedback" class="status hidden"></div>`;
 loadProfileParticipants();
 $("#edit-profile").addEventListener("click",()=>showProfileForm(currentUser.participantProfile));
 $("#logout-button").addEventListener("click",logout);
 $("#withdraw-participation").addEventListener("click",async()=>{if(!confirm("¿Seguro que deseas retirarte? Tu inscripción se eliminará de esta edición. Si deseas regresar, necesitarás una nueva invitación del organizador."))return;try{await api("/api/participation/withdraw",{method:"POST"});currentUser=await api("/api/me");renderRejoinView();}catch(e){const fb=$("#profile-action-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
}
function renderRejoinView(){
 setSnowfall(false);
 const app=$("#member-app");app.classList.remove("hidden");
 app.innerHTML=`<section class="member-welcome"><p class="kicker">NAVIDAD PYME · 2026</p><h1>Tu participación ha sido retirada</h1><p>Ya no formas parte de esta edición. Si deseas regresar más adelante, solicita una nueva invitación al organizador.</p></section><section class="member-home"><button id="logout-button" class="secondary-action">Cerrar sesión</button></section>`;
 $("#logout-button").addEventListener("click",logout);
}
async function logout(){if(communityPollTimer)clearInterval(communityPollTimer);if(communityChatPollTimer)clearInterval(communityChatPollTimer);try{await api("/api/auth/logout",{method:"POST"});}finally{location.href=location.pathname+(token?"?invite="+encodeURIComponent(token):"");}}
async function renderAdmin(){
 const panel=$("#admin-panel");if(!panel)return;
 if(!currentUser?.isPrimaryAdmin){panel.classList.add("hidden");return;}
 if(!panel.parentElement?.matches("#admin-tools-slot")){panel.classList.add("hidden");return;}
 panel.classList.remove("hidden");
 try{
  const data=await api("/api/admin/editions",{noMemoryCache:true});
  const editions=data.editions||[];
  if(!selectedEditionId||!editions.some(item=>item.id===selectedEditionId))selectedEditionId=editions[0]?.id||"";
  const selected=editions.find(item=>item.id===selectedEditionId);
  panel.innerHTML=`<section class="invite-management">
   <div class="management-heading"><div><h3>Navidad Pyme · Intercambios</h3><p>Administra cada equipo por separado. Los participantes solo acceden mediante la invitación de su edición.</p></div><span class="management-icon">🎄</span></div>
   <label class="admin-edition-label" for="admin-edition-select">Intercambio seleccionado</label>
   <select id="admin-edition-select" class="admin-edition-select">${editions.map(item=>`<option value="${esc(item.id)}" ${item.id===selectedEditionId?"selected":""}>${esc(item.team_name)} · ${esc(item.year)} · ${esc(item.participants)} participantes</option>`).join("")}</select>
   <div class="admin-team-actions">${editions.some(item=>item.team_name==="Onboarding Digital")?"":'<button class="admin-action" id="create-onboarding-edition" type="button">＋ Crear intercambio Onboarding Digital</button>'}</div>
   <div class="admin-invite-actions"><button class="admin-action" id="new-invite" type="button" ${selected?"":"disabled"}>＋ Generar invitación para ${esc(selected?.team_name||"el equipo")}</button></div>
   <div id="admin-result" aria-live="polite"></div>
   <p class="invite-note">Cada equipo tiene su propia edición y enlace. Crear una invitación en un equipo no revoca la del otro.</p>
  </section>`;
  $("#admin-edition-select")?.addEventListener("change",ev=>{selectedEditionId=ev.target.value;localStorage.setItem("navidad_selected_edition",selectedEditionId);const next=new URL(location.href);next.searchParams.set("editionId",selectedEditionId);location.assign(next.pathname+next.search+next.hash);});
  $("#create-onboarding-edition")?.addEventListener("click",async ev=>{
   const button=ev.currentTarget;button.disabled=true;button.textContent="Creando intercambio…";
   try{const created=await api("/api/admin/editions",{method:"POST",body:JSON.stringify({teamName:"Onboarding Digital",title:"Navidad Onboarding Digital 2026",year:2026})});selectedEditionId=created.edition.id;apiMemoryCache.clear();await renderAdmin();}
   catch(error){const result=$("#admin-result");if(result)result.innerHTML='<p class="admin-invite-error">'+esc(error.message)+'</p>';button.disabled=false;button.textContent="＋ Crear intercambio Onboarding Digital";}
  });
  $("#new-invite")?.addEventListener("click",async ev=>{
   const button=ev.currentTarget,result=$("#admin-result");button.disabled=true;button.textContent="Generando…";
   try{
    const r=await api("/api/admin/invitations",{method:"POST",body:JSON.stringify({editionId:selectedEditionId})});
    const shareText="¡Estás invitado a "+(selected?.team_name||"Navidad Pyme")+"! Únete desde este enlace: "+r.invitationUrl;
    const whatsappUrl="https://wa.me/?text="+encodeURIComponent(shareText);
    const expiry=new Date(r.expiresAt).toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"});
    result.innerHTML='<div class="admin-result invite-created"><div class="invite-created-heading"><span>✓</span><div><b>Invitación de '+esc(selected?.team_name||"tu equipo")+' generada</b><small>Válida hasta '+esc(expiry)+'</small></div></div><a class="invite-url" href="'+esc(r.invitationUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(r.invitationUrl)+'</a><button type="button" class="invite-copy-button" id="copy-team-invite">Copiar enlace</button><a class="invite-whatsapp" href="'+esc(whatsappUrl)+'" target="_blank" rel="noopener noreferrer"><span>◉</span> Compartir por WhatsApp</a><p class="invite-note">Este enlace pertenece únicamente a '+esc(selected?.team_name||"esta edición")+'.</p></div>';
    $("#copy-team-invite")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(r.invitationUrl);$("#copy-team-invite").textContent="✓ Copiado";}catch{$("#copy-team-invite").textContent="No se pudo copiar";}});
   }catch(error){result.innerHTML='<p class="admin-invite-error">'+esc(error.message)+'</p>';}
   finally{button.disabled=false;button.textContent="＋ Generar invitación para "+(selected?.team_name||"el equipo");}
  });
  if(window.mountParticipantAdmin)await window.mountParticipantAdmin();
 }catch(error){panel.innerHTML='<p class="admin-error">'+esc(error.message)+'</p>';}
}
async function checkSession(){
 setClass("#hero","hidden",true);setClass("#features","hidden",true);setClass("#site-footer","hidden",true);
 currentUser=await api("/api/me"+(selectedEditionId?"?editionId="+encodeURIComponent(selectedEditionId):""));signedIn=!!currentUser.authenticated;
 if(currentUser.membership?.edition_id){selectedEditionId=currentUser.membership.edition_id;localStorage.setItem("navidad_selected_edition",selectedEditionId);}
 if(!signedIn){setLoginView();await initGoogle();return;}
 setClass("#hero","hidden",true);setClass("#features","hidden",true);setClass("#site-footer","hidden",true);setClass("#google-area","hidden",true);
 if(token&&!currentUser.isPrimaryAdmin&&currentUser.membership?.status!=="confirmed"){$("#join-card").classList.remove("hidden");$("#join-card").innerHTML=`<div class="card-heading"><div class="icon-bubble">🎄</div><div><p class="kicker">INVITACIÓN</p><h2>${esc(inviteEdition?.title||"Navidad Pyme")}</h2></div></div><p class="muted">${inviteValid?"Tu invitación está lista. Confirma tu participación para continuar.":"La invitación no es válida o venció."}</p><button id="confirm-join" class="primary-button" ${inviteValid?"":"disabled"}>Confirmar mi participación →</button><div id="join-feedback" class="status hidden"></div>`;
 $("#confirm-join").addEventListener("click",async()=>{try{await api("/api/invitations/join",{method:"POST",body:JSON.stringify({token})});try{sessionStorage.removeItem("navidad_invite_token");localStorage.removeItem("navidad_invite_token");}catch{}token="";currentUser=await api("/api/me");showProfileForm();}catch(e){const fb=$("#join-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
 }else if(currentUser.membership?.status==="confirmed"&&!currentUser.participantProfile){$("#join-card").classList.add("hidden");showProfileForm();}
 else if(currentUser.membership?.status==="confirmed"){renderMemberApp();} else if(currentUser.membership?.status==="withdrawn"&&!currentUser.isPrimaryAdmin){renderRejoinView();}
 else if(currentUser.isPrimaryAdmin){$("#join-card").classList.add("hidden");setClass("#admin-panel","hidden",false);}
 else {
  const card=$("#join-card");card.classList.remove("hidden");
  card.innerHTML='<div class="card-heading"><div class="icon-bubble">🎄</div><div><p class="kicker">ONBOARDING DIGITAL · INVITACIÓN</p><h2>Tu cuenta está activa</h2></div></div><p class="muted">Tu participación aún no está confirmada. Pega aquí el enlace de invitación que te compartieron para continuar.</p><form id="recover-invite-form" class="profile-form"><label>Enlace de invitación<input name="inviteUrl" type="url" inputmode="url" autocomplete="url" placeholder="https://…?invite=…" required></label><button class="primary-button" type="submit">Validar invitación →</button></form><div id="recover-invite-feedback" class="status hidden" role="status"></div>';
  $("#recover-invite-form").addEventListener("submit",async event=>{
   event.preventDefault();const input=event.currentTarget.elements.inviteUrl;const recovered=rememberInvite(input.value);const feedback=$("#recover-invite-feedback");
   if(!recovered){feedback.textContent="El enlace no parece ser una invitación válida. Pega el enlace completo que recibiste.";feedback.classList.remove("hidden");feedback.classList.add("error");return;}
   token=recovered;await loadInvite();
   if(!inviteValid){feedback.textContent="Esta invitación no es válida o ya venció. Solicita al organizador un enlace vigente.";feedback.classList.remove("hidden");feedback.classList.add("error");return;}
   const query=new URLSearchParams(location.search);query.set("invite",token);location.replace(location.pathname+"?"+query.toString());
  });
 }
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
  panel.innerHTML='<div class="wa-guide-card"><div class="wa-guide-icon">🎄</div><p class="kicker">NAVIDAD PYME · INVITACIÓN</p><h1>Abre tu invitación en Safari</h1><p>Para confirmar tu participación correctamente, abre este enlace en Safari. El navegador interno de WhatsApp puede interferir con el acceso mediante Google.</p><ol><li>Toca el menú <b>⋯</b> de WhatsApp.</li><li>Selecciona <b>Abrir en Safari</b> o <b>Abrir en navegador</b>.</li><li>Inicia sesión con Google y confirma tu participación.</li></ol><button type="button" id="copy-invite-link" class="wa-copy-button">Copiar enlace de invitación</button><p id="wa-copy-feedback" class="wa-copy-feedback" role="status"></p><small>Tu invitación se conservará al continuar en Safari.</small></div>';
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
if("serviceWorker"in navigator){
 let refreshing=false;
 navigator.serviceWorker.addEventListener("controllerchange",()=>{
  if(refreshing)return;
  refreshing=true;
  location.reload();
 });
 window.addEventListener("load",async()=>{
  try{
   const registration=await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});
   await registration.update();
  }catch(error){console.warn("No se pudo comprobar la actualización de la aplicación:",error);}
 });
}
