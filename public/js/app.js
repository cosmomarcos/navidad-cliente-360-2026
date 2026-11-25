
/* Reproductor musical global: vive fuera de las vistas e intercambios. */

function initGlobalBackgroundMusic(){
 if(document.getElementById("global-background-music"))return;
 const audio=document.createElement("audio");
 audio.id="global-background-music";audio.src="/api/music/current";audio.loop=true;audio.preload="auto";audio.volume=.42;
 audio.setAttribute("playsinline","");
 const saved=(()=>{try{return JSON.parse(localStorage.getItem("navidad_global_music")||"{}");}catch{return {};}})();
 let enabled=saved.enabled!==false,restored=false,saveTimer=0,resumeBackgroundAfterContentAudio=false;
 const wrap=document.createElement("div");wrap.id="global-music-control";wrap.className="global-music-control";
 wrap.innerHTML='<button type="button" id="global-music-toggle" aria-label="Activar música navideña" title="Música navideña"><span aria-hidden="true">🎵</span><span id="global-music-label">Activar música</span></button><label class="global-music-volume" title="Volumen">🔉 <input id="global-music-volume" type="range" min="0" max="1" step="0.05" value="0.42" aria-label="Volumen de la música"></label>';
 document.body.append(audio,wrap);
 // El control visual antiguo nunca debe mostrarse: los controles viven en Mi perfil.
 wrap.hidden=true;
 wrap.style.setProperty("display","none","important");
 window.setNavidadMusicEnabled=async value=>{
  enabled=!!value;
  if(enabled){await play();}else{resumeBackgroundAfterContentAudio=false;audio.pause();}
  persist();paint();return !audio.paused;
 };
 window.setNavidadMusicVolume=value=>{
  const next=Math.max(0,Math.min(1,Number(value)||0));
  audio.volume=next;persist();return audio.volume;
 };
 const activeContentAudios=new Set();
 const toggle=wrap.querySelector("#global-music-toggle"),label=wrap.querySelector("#global-music-label"),volume=wrap.querySelector("#global-music-volume");
 const persist=()=>{try{localStorage.setItem("navidad_global_music",JSON.stringify({enabled,time:Number.isFinite(audio.currentTime)?audio.currentTime:0,volume:audio.volume}));}catch{}};
 const paint=()=>{const playing=!audio.paused&&!audio.ended;toggle.classList.toggle("is-playing",playing);toggle.setAttribute("aria-label",playing?"Pausar música navideña":"Reproducir música navideña");label.textContent=playing?"Pausar música":"Activar música";};
 const play=async()=>{
  if(!enabled||activeContentAudios.size)return;
  try{
   if(!restored){
    const t=Number(saved.time);
    if(Number.isFinite(t)&&t>0){
     const restore=()=>{if(restored)return;try{audio.currentTime=Math.min(t,Math.max(0,(audio.duration||t)-.5));}catch{}restored=true;};
     if(audio.readyState>=1)restore();else audio.addEventListener("loadedmetadata",restore,{once:true});
    }else restored=true;
   }
   await audio.play();paint();persist();
  }catch(error){paint();}
 };
 const resumeIfReady=()=>{
  for(const media of [...activeContentAudios]){
   if(!media.isConnected||media.paused||media.ended)activeContentAudios.delete(media);
  }
  if(activeContentAudios.size===0&&resumeBackgroundAfterContentAudio){
   resumeBackgroundAfterContentAudio=false;
   if(enabled)play();
  }
 };
 const onContentPlay=event=>{
  const media=event.target;
  if(media?.tagName!=="AUDIO"||media.id==="global-background-music")return;
  const wasEmpty=activeContentAudios.size===0;
  activeContentAudios.add(media);
  if(wasEmpty){resumeBackgroundAfterContentAudio=enabled;if(!audio.paused)audio.pause();}
 };
 document.addEventListener("play",onContentPlay,true);
 ["pause","ended","error"].forEach(type=>document.addEventListener(type,event=>{
  const media=event.target;
  if(media?.tagName!=="AUDIO"||media.id==="global-background-music")return;
  Promise.resolve().then(()=>{
   if(type==="error"||!media.isConnected||media.paused||media.ended)activeContentAudios.delete(media);
   resumeIfReady();
  });
 },true));
 if(window.MutationObserver){
  const observer=new MutationObserver(()=>resumeIfReady());
  observer.observe(document.body,{childList:true,subtree:true});
 }
 const stopUnlock=()=>{document.removeEventListener("pointerdown",unlock,true);document.removeEventListener("keydown",unlock,true);};
 const unlock=()=>{if(enabled&&!activeContentAudios.size&&audio.paused)play();};
 audio.addEventListener("playing",()=>{paint();stopUnlock();});
 audio.addEventListener("timeupdate",()=>{if(!saveTimer){saveTimer=window.setTimeout(()=>{saveTimer=0;persist();},1500);}});
 audio.addEventListener("play",paint);audio.addEventListener("pause",()=>{persist();paint();});audio.addEventListener("volumechange",persist);
 toggle.addEventListener("click",async()=>{if(audio.paused){enabled=true;await play();}else{enabled=false;resumeBackgroundAfterContentAudio=false;audio.pause();}persist();paint();});
 volume.value=String(saved.volume??.42);audio.volume=Number(volume.value);
 volume.addEventListener("input",()=>{audio.volume=Number(volume.value);persist();});
 document.addEventListener("pointerdown",unlock,true);
 document.addEventListener("keydown",unlock,true);
 window.addEventListener("pagehide",persist);
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&enabled&&audio.paused&&!activeContentAudios.size)play();});
 audio.addEventListener("error",()=>{paint();});
 if(enabled)play();
 paint();
}
initGlobalBackgroundMusic();

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
  r=await fetch(requestPath,{credentials:"same-origin",cache:"no-store",...fetchOptions,signal:controller.signal,headers:{...(!(fetchOptions.body instanceof FormData)?{"content-type":"application/json"}:{}),...(options.headers||{})}});
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
async function compressWishImage(file){
 if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Selecciona una imagen JPG, PNG o WebP.");
 if(file.size>8*1024*1024)throw new Error("La imagen supera los 8 MB. Selecciona una foto más ligera.");
 const loaded=await loadProfileImage(file);
 try{
  const image=loaded.image;
  if(!image.naturalWidth||!image.naturalHeight)throw new Error("No se pudo leer la imagen seleccionada.");
  let scale=Math.min(1,1280/Math.max(image.naturalWidth,image.naturalHeight));
  for(let attempt=0;attempt<7;attempt++){
   const width=Math.max(1,Math.round(image.naturalWidth*scale));
   const height=Math.max(1,Math.round(image.naturalHeight*scale));
   const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
   const context=canvas.getContext("2d");
   if(!context)throw new Error("No se pudo preparar la imagen. Inténtalo con otra foto.");
   context.fillStyle="#ffffff";context.fillRect(0,0,width,height);
   context.drawImage(image,0,0,width,height);
   for(const quality of [.84,.76,.68,.60,.52]){
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
    if(!blob)continue;
    if(blob.size<=190*1024){
     const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("No se pudo preparar la imagen."));reader.readAsDataURL(blob);});
     if(typeof dataUrl==="string"&&dataUrl.length<=260000)return dataUrl;
    }
   }
   scale*=.78;
  }
  throw new Error("No se pudo reducir la imagen al tamaño permitido. Prueba con otra foto.");
 }finally{URL.revokeObjectURL(loaded.objectUrl);}
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
async function loadClient360HomePhoto(){try{const d=await api("/api/edition/home",{noMemoryCache:true}),c=d.config||{},im=$("#member-app .home-team-photo"),figure=im?.closest(".home-team-photo-wrap");if(!im||!figure)return;if(c.showHomePhoto===false){figure.classList.add("hidden");return;}if(String(c.homePhotoData||"").startsWith("data:image/webp;base64,")){im.src=c.homePhotoData;im.alt="Foto del intercambio";figure.classList.remove("hidden");}}catch(error){console.warn("No se pudo cargar la foto del Inicio",error?.message||error);}}
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
  const homePhoto=c.showHomePhoto!==false&&/^data:image\/webp;base64,/.test(c.homePhotoData||"")?'<figure class="home-team-photo-wrap home-team-photo-wrap-custom"><img class="home-team-photo" src="'+c.homePhotoData+'" alt="Foto del intercambio" loading="lazy"></figure>':"";
  host.innerHTML=homePhoto+'<section class="exchange-budget-card"><div class="exchange-budget-icon">🎁</div><div class="exchange-budget-copy"><span class="exchange-budget-kicker">TEN PRESENTE</span><h2>Monto del intercambio</h2><div class="exchange-minimum-list"><div><span>Presupuesto por persona</span><strong>'+(e.budget_amount==null?"Por definir":esc(new Intl.NumberFormat("es-PE",{style:"currency",currency:e.currency||"PEN"}).format(Number(e.budget_amount))))+'</strong></div></div></div><div class="exchange-location">'+details+extra+map+'<a class="exchange-whatsapp-share" href="https://wa.me/?text='+encodeURIComponent(share)+'" target="_blank" rel="noopener noreferrer">◉ Compartir información por WhatsApp</a></div></section>';
 }catch(error){host.innerHTML='<section class="edition-empty-state"><span>🎁</span><h2>Información del intercambio</h2><p>'+esc(error.message)+'</p></section>';}
}
function formatSpiritScheduleDate(value){
 if(!value)return "Fecha por definir";
 const raw=String(value).trim();
 const iso=/Z$|[+-]\\d{2}:?\\d{2}$/.test(raw)?raw:raw.replace(" ","T")+"Z";
 const date=new Date(iso);
 if(Number.isNaN(date.getTime()))return "Fecha por definir";
 return new Intl.DateTimeFormat("es-PE",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Lima"}).format(date);
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
 if(currentUser.membership?.edition_id&&selectedEditionId!==currentUser.membership.edition_id){selectedEditionId=currentUser.membership.edition_id;try{localStorage.setItem("navidad_selected_edition",selectedEditionId);}catch{}apiMemoryCache.clear();}
 const budgetAmount=currentUser.membership?.budget_amount;
 const budgetCurrency=currentUser.membership?.currency||"PEN";
 const exchangeDateLabel=formatExchangeDate(currentUser.membership?.event_date);
 const exchangeShareText="🎄 *NAVIDAD PYME · 2026*\n\n📅 *Fecha:* "+exchangeDateLabel+"\n🎁 *Montos del intercambio:*\n• Amigo Secreto: mínimo S/ 100\n• Dirty Santa: mínimo S/ 20\n\n📍 *Lugar:* Casa de Marcos\nAv. Oscar R. Benavides 611, Dpto. 701, Cercado de Lima\n🗺️ Google Maps: https://maps.app.goo.gl/rueCMQujUGvwxFoY9\n\n🥪 *Desayuno:* Chicharrón de El Chinito desde las 9:00 a. m.\n🍖 *Cuota para la parrilla:* Por definir.\n\n¡Nos vemos para compartir la magia de esta Navidad! 🎅";
 const budgetLabel=budgetAmount==null?"Por definir":new Intl.NumberFormat("es-PE",{style:"currency",currency:budgetCurrency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(budgetAmount));
 const homeMarkup=isOnboarding?`<section class="member-welcome"><p class="kicker">NAVIDAD PYME · ${esc(currentUser.membership?.year||2026)}</p><h1>¡Hola, ${esc(name)}! 🎄</h1><p id="onboarding-welcome-text">Bienvenido a tu intercambio.</p><div class="member-countdown" id="member-countdown"></div></section><div id="onboarding-home-content"><section class="edition-empty-state"><span>🎁</span><h2>Información del intercambio</h2><p>El organizador está completando los detalles de esta celebración.</p></section></div>`:`<section class="member-welcome"><p class="kicker">NAVIDAD PYME · 2026</p><h1>¡Hola, ${esc(name)}! 🎄</h1><p>Tu espacio para compartir la magia de esta Navidad.</p><div class="member-countdown" id="member-countdown"></div></section><section class="exchange-budget-card" aria-label="Información importante del intercambio"><div class="exchange-budget-icon" aria-hidden="true">🎁</div><div class="exchange-budget-copy"><span class="exchange-budget-kicker">TEN PRESENTE</span><h2>Monto del intercambio</h2><div class="exchange-minimum-list"><div><span>Amigo Secreto</span><strong>Mínimo S/ 100</strong></div><div><span>Dirty Santa</span><strong>Mínimo S/ 20</strong></div></div></div><div class="exchange-location"><div class="exchange-detail-row"><span class="exchange-detail-icon">📅</span><div><b>Fecha: ${esc(exchangeDateLabel)}</b></div></div><div class="exchange-detail-row"><span class="exchange-detail-icon">📍</span><div><b>Lugar del intercambio</b><p>Av. Oscar R. Benavides 611, Dpto. 701, Cercado de Lima</p><small>Casa de Marcos</small></div></div><div class="exchange-detail-row"><span class="exchange-detail-icon">🍖</span><div><b>Cuota para la parrilla</b><p>Por definir</p></div></div><div class="exchange-detail-row"><span class="exchange-detail-icon">🕘</span><div><b>Horario</b><p>Desde las 9:00 a. m.</p></div></div><p class="exchange-breakfast">🥪 Llega temprano para desayunar su respectivo Chicharrón de El Chinito</p><a class="exchange-map-link" href="https://maps.app.goo.gl/rueCMQujUGvwxFoY9" target="_blank" rel="noopener noreferrer">Abrir ubicación en Google Maps ↗</a><div class="exchange-map-preview"><iframe title="Mapa de la ubicación del intercambio en Cercado de Lima" src="https://www.google.com/maps?q=Av.%20Oscar%20R.%20Benavides%20611%2C%20Cercado%20de%20Lima&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div><a class="exchange-whatsapp-share" href="https://wa.me/?text=${encodeURIComponent(exchangeShareText)}" target="_blank" rel="noopener noreferrer" aria-label="Compartir información del intercambio por WhatsApp"><span aria-hidden="true">◉</span> Compartir información por WhatsApp</a></div></section><figure class="home-team-photo-wrap"><img class="home-team-photo" src="/images/equipo-navidad-2026.webp" alt="Equipo Cliente 360 reunido para celebrar la Navidad" loading="eager" fetchpriority="high"></figure>`
 const rozviAnnouncement=currentUser.membership?.team_name==="Cliente 360"?'<section class="rozvi-announcement" aria-label="Nuevo juego disponible"><div class="rozvi-announcement-copy"><span class="rozvi-kicker">NUEVO JUEGO DISPONIBLE</span><h2>¡VAMOS ROZVI!</h2><p>JUEGA AHORA Y GANA PUNTOS ESPÍRITU.</p><button type="button" id="rozvi-open-game" class="rozvi-play-button">Jugar ahora <span>→</span></button></div></section>':"";
 const divorzhinhaAnnouncement=currentUser.isPrimaryAdmin&&currentUser.membership?.team_name==="Cliente 360"?'<section class="rozvi-announcement divorzhinha-announcement" aria-label="Nuevo juego disponible"><div class="rozvi-announcement-copy divorzhinha-copy"><span class="rozvi-kicker">NUEVO JUEGO DISPONIBLE</span><h2>DIVORZINHA</h2><p>¡PATEA AL ARQUERO Y SUMA PUNTOS ESPÍRITU!</p><button type="button" id="divorzhinha-open-game" class="rozvi-play-button divorzhinha-play-button">Jugar ahora <span>→</span></button></div></section>':"";
 const duckHuntAnnouncement=currentUser.membership?.team_name==="Cliente 360"?'<section class="rozvi-announcement nikehunt-announcement" aria-label="Nuevo juego disponible"><div class="rozvi-announcement-copy nikehunt-copy"><span class="rozvi-kicker">NUEVO JUEGO DISPONIBLE</span><h2>NIKE HUNT</h2><p>¡CAZA LOS PATOS Y SUMA PUNTOS ESPÍRITU!</p><button type="button" id="duckhunt-open-game" class="rozvi-play-button nikehunt-play-button">Jugar ahora <span>→</span></button></div></section>':"";

 app.innerHTML=`<section class="member-home" id="member-tab-content">${homeMarkup}${rozviAnnouncement}${divorzhinhaAnnouncement}${duckHuntAnnouncement}</section><nav class="bottom-nav" aria-label="Menú principal"><button class="active" data-tab="home"><span>⌂</span>Inicio</button><button data-tab="secret"><span>🎁</span>Mi secreto <span class="nav-unread-badge" id="secret-unread-badge" hidden></span></button><button data-tab="community" aria-label="Mensajes"><span>✉️</span>Mensajes</button><button data-tab="wishes"><span>💝</span>Deseos <span class="nav-unread-badge" id="wishes-unread-badge" hidden></span></button><button data-tab="spirit"><span>🎄</span>Espíritu <span class="nav-unread-badge" id="spirit-unread-badge" hidden></span></button><button data-tab="achievements"><span>🏆</span>Logros</button><button data-tab="profile"><span>👥</span>Mi equipo</button>${currentUser.isPrimaryAdmin?'<button data-tab="admin-settings"><span>⚙️</span>Ajustes</button>':""}</nav>`;
 if(currentUser.membership?.team_name==="Cliente 360") initRozviGame();
 if(currentUser.membership?.team_name==="Cliente 360"){initDivorzhinhaGame();loadDivorzhinhaHomeArt();initDuckHuntGame();loadNikeHuntHomeArt();}
 if(isOnboarding)loadOnboardingHome();else loadClient360HomePhoto();
 startActivityHeartbeat();
 updateMemberCountdown(currentUser.membership?.event_date);

 prefetchMemberTabs();
 if(communityPollTimer)clearInterval(communityPollTimer);
 updateTabUnreadBadges();
 communityPollTimer=setInterval(updateTabUnreadBadges,90000);
 app.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{setClass("#join-card","hidden",true);setClass("#member-tab-content","hidden",false);setSnowfall(btn.dataset.tab==="home");app.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===btn));if(btn.dataset.tab==="profile"){showProfileSettings();return;}if(btn.dataset.tab==="admin-settings"){showAdminSettings();return;}if(btn.dataset.tab==="secret"){renderSecretTab();return;}if(btn.dataset.tab==="wishes"){renderWishesTab();return;}if(btn.dataset.tab==="community"){renderCommunityTab();return;}if(btn.dataset.tab==="spirit"){renderSpiritTab();return;}if(btn.dataset.tab==="achievements"){renderAchievementsTab();return;}const labels={home:"Inicio",secret:"Mi amigo secreto",community:"Mensajes",wishes:"Lista de deseos"};if(btn.dataset.tab!=="home"){const section=app.querySelector(".member-home");section.innerHTML=`<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>${labels[btn.dataset.tab]}</h2></div><article class="member-feature"><span>${btn.dataset.tab==="secret"?"🎁":btn.dataset.tab==="community"?"💬":"💝"}</span><div><b>${labels[btn.dataset.tab]}</b><p>Esta funcionalidad se habilitará en su fase correspondiente del proyecto.</p></div><small>Próximamente</small></article>`;}else{renderMemberApp();}}));
 const requestedTab=new URLSearchParams(location.search).get("tab");
 if(requestedTab==="community"||requestedTab==="achievements"){
  const cleanUrl=new URL(location.href);
  cleanUrl.searchParams.delete("tab");
  history.replaceState({}, "", cleanUrl.pathname+cleanUrl.search+cleanUrl.hash);
  app.querySelector('[data-tab="'+requestedTab+'"]')?.click();
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
 try{const data=await api("/api/spirit/submissions/"+encodeURIComponent(postId)+"/comments",{noMemoryCache:true});const comments=data.comments||[];list.innerHTML=comments.length?comments.map(c=>'<article class="spirit-comment"><span class="spirit-comment-avatar">'+(c.avatar_url&&isAvatarSource(c.avatar_url)?'<img src="'+esc(avatarUrl(c.avatar_url,48))+'" alt="">':'🎄')+'</span><div><div class="spirit-comment-meta"><b>'+esc(c.display_name)+'</b><time>'+new Date(String(c.created_at).replace(" ","T")+"Z").toLocaleString("es-PE",{dateStyle:"short",timeStyle:"short"})+'</time>'+(c.edited_at?'<small class="spirit-edited-label">· Editado</small>':'')+(c.user_id===currentUser.user.id?'<span class="spirit-comment-actions"><button type="button" class="spirit-comment-edit-button" data-spirit-comment-edit="'+esc(c.id)+'">Editar</button><span aria-hidden="true">·</span><button type="button" class="spirit-comment-delete-button" data-spirit-comment-delete="'+esc(c.id)+'">Eliminar</button></span>':'')+'</div><p>'+esc(c.comment)+'</p></div></article>').join(""):'<p class="spirit-comments-empty">Todavía no hay comentarios. ¡Sé el primero en conversar! 💬</p>';panel.dataset.loaded="1";}catch(error){list.innerHTML='<p class="spirit-comments-error">'+esc(error.message||"No se pudieron cargar los comentarios.")+'</p>';panel.dataset.loaded="";}
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
async function shareSpiritPost(post,challenge,isBonus=false){
 const button=document.querySelector('[data-spirit-share="'+CSS.escape(post.id)+'"]');
 if(button){button.disabled=true;button.textContent="Preparando imagen…";}
 try{
  let comments=[];
  if(!isBonus&&Number(post.comment_count||0)>0){
   const data=await api("/api/spirit/submissions/"+encodeURIComponent(post.id)+"/comments",{noMemoryCache:true});
   comments=data.comments||[];
  }
  let currentPost=post;
  try{
   if(!isBonus){
    const latestBoard=await api("/api/spirit/board",{noMemoryCache:true,timeoutMs:12000});
    currentPost=(latestBoard.submissions||[]).find(item=>item.id===post.id)||post;
   }
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
async function renderAchievementsTab(){
 const home=$("#member-app .member-home");if(!home)return;
 home.innerHTML='<div class="achievements-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>🏆 MIS LOGROS</h2><p>Completa desafíos, desbloquea insignias y suma puntos a tu ranking.</p></div><div id="achievements-content"><div class="tab-skeleton"><span></span><span></span><span></span></div></div>';
 const host=$("#achievements-content");
 try{
  const data=await api("/api/spirit/achievements",{noMemoryCache:true,timeoutMs:12000});
  if(data.editionId&&currentUser.membership?.edition_id&&data.editionId!==currentUser.membership.edition_id)throw new Error("Los logros recibidos no corresponden a este intercambio. Actualiza la pantalla.");
  const items=data.achievements||[],unlocked=Number(data.unlockedCount||0),total=Number(data.totalCount||items.length),points=Number(data.earnedPoints||0),percent=total?Math.round(unlocked/total*100):0;
  const daily=data.dailyAchievements||[];
  const dailyMarkup='<section class="daily-achievements-section"><div class="daily-achievements-heading"><div><span>🎯 RETOS DIARIOS</span><h3>¡Suma puntos cada día!</h3><p>Se renuevan al comenzar el nuevo reto.</p></div><strong>+'+Number(data.dailyPoints||0)+' <small>pts hoy</small></strong></div><div class="daily-achievements-grid">'+daily.map(item=>'<article class="daily-achievement-card '+(item.unlocked?'is-done':'')+'"><div class="daily-achievement-icon">'+item.icon+'</div><div class="daily-achievement-copy"><b>'+esc(item.title)+'</b><p>'+esc(item.description)+'</p><small>'+(item.unlocked?'✓ COMPLETADO HOY':'Disponible hoy')+'</small></div><strong>+'+item.reward+' pts</strong></article>').join('')+'</div></section>';
  host.innerHTML=dailyMarkup+'<section class="achievements-summary"><div><span>LOGROS DESBLOQUEADOS</span><strong>'+unlocked+' <small>/ '+total+'</small></strong></div><div><span>PUNTOS GANADOS POR LOGROS</span><strong>+'+points+' <small>pts</small></strong></div><div class="achievements-progress"><div><span>Tu colección</span><b>'+percent+'%</b></div><i><b style="width:'+percent+'%"></b></i></div></section><div class="achievements-grid">'+items.map(item=>'<article class="achievement-card '+(item.unlocked?'is-unlocked':'is-locked')+'"><div class="achievement-card-top"><span class="achievement-icon">'+item.icon+'</span><span class="achievement-status">'+(item.unlocked?'✓ CONSEGUIDO':'🔒 BLOQUEADO')+'</span></div><h3>'+esc(item.title)+'</h3><p>'+esc(item.description)+'</p>'+(item.detail?'<small class="achievement-detail">'+esc(item.detail)+'</small>':'')+'<div class="achievement-card-bottom"><span class="achievement-progress">'+(item.unlocked?'Logro completado':Math.min(item.progress,item.target)+' / '+item.target+' completado(s)')+'</span><b class="achievement-reward">+'+item.reward+' pts</b></div><div class="achievement-mini-track"><i style="width:'+(item.unlocked?100:(item.target>0?Math.min(100,Math.round((item.progress/item.target)*100)):0))+'%"></i></div></article>').join('')+'</div><p class="achievements-footnote">Los puntos se acreditan automáticamente al desbloquear cada logro y cada premio se entrega una sola vez.</p>';
 }catch(error){host.innerHTML='<section class="edition-empty-state"><span>🏆</span><h3>No pudimos cargar tus logros</h3><p>'+esc(error.message||"Intenta nuevamente.")+'</p><button class="primary-button" id="achievements-retry">Reintentar</button></section>';host.querySelector("#achievements-retry")?.addEventListener("click",renderAchievementsTab);}
}
async function renderSpiritTab(dataOverride=null){
 const home=$("#member-app .member-home");if(!home)return;
 home.innerHTML='<div class="spirit-heading"><span>🎄</span><div><p class="kicker">NAVIDAD PYME · 2026</p><h2>Espíritu Navideño</h2><p>Comparte, participa y contagia la alegría de estas fiestas. ¡El primer puesto se llevará un premio sorpresa!</p></div></div>'+'<div id="spirit-content"><div class="tab-skeleton"><span></span><span></span><span></span></div></div>';
 try{
  const spiritCacheKey="spirit-board:"+selectedEditionId+":"+currentUser.user.id;
  await api("/api/spirit/achievements",{noMemoryCache:true,timeoutMs:10000}).catch(()=>null);
  try{localStorage.removeItem(spiritCacheKey);sessionStorage.removeItem(spiritCacheKey);}catch{}
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
  const currentRankEntry=ranking.find(person=>String(person.user_id)===String(currentUser.user.id));
  const isCurrentUserFirst=Number(currentRankEntry?.rank??bonusData.rank??data.myRank)===1;
  const bonusField=bonusType==="photo"||bonusType==="voice"?'<label class="spirit-file-label">📎 Adjunta tu evidencia<input name="media" type="file" accept="'+(bonusType==="photo"?"image/jpeg,image/png,image/webp":"audio/*")+'" required></label><label>Comentario (opcional)<textarea name="caption" maxlength="500"></textarea></label>':'<label>Tu participación<textarea name="caption" maxlength="500" minlength="2" required placeholder="Escribe tu participación bonus…"></textarea></label>';
  const bonusMarkup=bonusData.active&&isCurrentUserFirst?'<article class="spirit-challenge spirit-bonus-card spirit-bonus-leader-message"><div class="spirit-challenge-top"><span>🏆 PRIMER PUESTO</span><b>🥇</b></div><h3>¡YA VAS EN PRIMER PUESTO!</h3><p>¿QUÉ, QUIERES MÁS PUNTOS? 😏</p><small>Disfruta tu liderazgo navideño. El reto bonus está disponible para los demás participantes.</small></article>':bonus&&bonusData.eligible?'<article class="spirit-challenge spirit-bonus-card"><div class="spirit-challenge-top"><span>🌟 RETO BONUS</span><b>+10 PUNTOS</b></div><h3>'+esc(bonus.title)+'</h3><p>'+esc(bonus.description)+'</p><small>Los puntos extra se entregan únicamente cuando el administrador apruebe tu evidencia.</small>'+(bonusSubmission?'<p class="spirit-submitted">'+(bonusSubmission.status==="approved"?'✅ Aprobado · +10 puntos':bonusSubmission.status==="rejected"?'Participación revisada.':'⏳ Evidencia enviada · pendiente de aprobación')+'</p>':'<form id="spirit-bonus-form" class="spirit-submit-form spirit-submit-form-embedded">'+bonusField+'<button class="primary-button" type="submit">Enviar evidencia bonus →</button><div id="spirit-bonus-feedback" class="spirit-feedback" role="status"></div></form>')+'</article>':'';

  const challengeMarkup=challenge?'<article class="spirit-challenge"><div class="spirit-challenge-top"><span>🎯 RETO ACTIVO</span><b>❤️ POR LIKES</b></div><h3>'+esc(challenge.title)+'</h3><p>'+esc(challenge.description)+'</p><small>Cada Me gusta de otro participante suma 1 punto (máximo 10 por publicación). La publicación más votada del día recibe '+Number(challenge.bonus_points||0)+' puntos de bonificación configurados; si hay empate, todos los primeros lugares reciben la bonificación.</small></article>':'<article class="spirit-challenge"><h3>¡Estamos preparando el próximo reto!</h3><p>El reto de hoy terminó a las 6:00 a. m. (hora Perú). Estamos en pausa hasta las 6:00 p. m., cuando se abrirá el siguiente reto. ¡Vuelve más tarde para seguir sumando! 🎄</p></article>';
  let field=type==="photo"?'<label class="spirit-file-label">📷 Sube tu foto<input name="media" type="file" accept="image/*" required></label><label>Comentario (opcional)<textarea name="caption" maxlength="500"></textarea></label>':type==="voice"?'<div class="spirit-voice-recorder"><button type="button" class="admin-action" data-spirit-record>🎙️ Iniciar grabación</button><span id="spirit-record-status">Máximo 30 segundos</span><audio id="spirit-audio-preview" controls class="hidden"></audio></div><label>Comentario (opcional)<textarea name="caption" maxlength="300"></textarea></label>':type==="trivia"?'<fieldset class="spirit-trivia-options"><legend>'+esc(cfg.question||"Elige la respuesta correcta")+'</legend>'+(cfg.options||[]).map(o=>'<label><input type="radio" name="answer" value="'+esc(o)+'" required><span>'+esc(o)+'</span></label>').join("")+'</fieldset>':'<label>Tu participación<textarea name="caption" maxlength="500" minlength="2" required placeholder="Cuéntanos o comparte tu momento navideño…"></textarea></label>';
  const formMarkup=challenge?((Number(data.mySubmissionCount||0)>0?'<div class="spirit-submitted">🎉 Ya compartiste '+Number(data.mySubmissionCount)+' '+(Number(data.mySubmissionCount)===1?'participación':'participaciones')+' en este reto. ¡Puedes publicar más!</div>':"")+'<form id="spirit-submission-form" class="spirit-submit-form spirit-submit-form-embedded">'+field+'<button class="primary-button" type="submit">Enviar mi participación <span>→</span></button><div id="spirit-feedback" class="spirit-feedback" role="status"></div></form>'):"";
  const bonusPosts=data.bonusSubmissions||[];
  const bonusFeed=bonusPosts.length?'<div class="spirit-carousel spirit-bonus-carousel" aria-label="Publicaciones de retos bonus"><div class="spirit-carousel-track">'+bonusPosts.map(p=>'<article class="spirit-post spirit-bonus-post" data-created-at="'+esc(p.created_at)+'"><div class="spirit-post-head"><span class="spirit-post-avatar">'+(p.avatar_url&&isAvatarSource(p.avatar_url)?'<img src="'+esc(avatarUrl(p.avatar_url,64))+'" alt="" loading="lazy" decoding="async" width="44" height="44">':'🎁')+'</span><div><b>'+esc(p.display_name)+'</b><small>🌟 Reto bonus · '+new Date(String(p.created_at).replace(" ","T")+"Z").toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"})+(p.edited_at?' · Editado':'')+'</small></div><span class="spirit-bonus-status">'+(p.status==="approved"?"✅ Aprobado":"⏳ En revisión")+'</span></div><h4>'+esc(p.challenge_title||"Reto bonus")+'</h4><p>'+esc(p.caption||"¡Participación bonus!")+'</p>'+(p.has_media&&String(p.media_type||"").startsWith("audio/")?'<audio class="spirit-post-audio" controls preload="none" src="'+esc((p.mediaUrl||"")+(selectedEditionId?"?editionId="+encodeURIComponent(selectedEditionId):""))+'"></audio>':p.has_media?'<img class="spirit-post-image" loading="lazy" decoding="async" src="'+esc((p.mediaUrl||"")+(selectedEditionId?"?editionId="+encodeURIComponent(selectedEditionId):""))+'" alt="Evidencia del reto bonus">':"")+'<div class="spirit-post-tools"><button type="button" data-spirit-bonus-share="'+esc(p.id)+'">📲 Compartir por WhatsApp</button></div>'+'</article>').join("")+'</div></div>':"";
  const regularFeed=submissions.length?'<div class="spirit-carousel" aria-label="Participaciones de la comunidad"><div class="spirit-carousel-track">'+submissions.map(p=>'<article class="spirit-post" data-spirit-post="'+esc(p.id)+'" data-created-at="'+esc(p.created_at)+'"><div class="spirit-post-head"><span class="spirit-post-avatar">'+(p.avatar_url&&isAvatarSource(p.avatar_url)?'<img src="'+esc(avatarUrl(p.avatar_url,64))+'" alt="" loading="lazy" decoding="async" width="44" height="44">':'🎄')+'</span><div><b>'+esc(p.display_name)+'</b><small>'+new Date(String(p.created_at).replace(" ","T")+"Z").toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"})+(p.edited_at?' · Editado':'')+'</small></div></div><p>'+esc(p.caption)+'</p>'+(p.has_media&&String(p.media_type||"").startsWith("audio/")?'<audio class="spirit-post-audio" controls preload="none" src="'+esc((p.mediaUrl||"")+(selectedEditionId?"?editionId="+encodeURIComponent(selectedEditionId):""))+'"></audio>':p.has_media?'<img class="spirit-post-image" loading="lazy" decoding="async" src="'+esc((p.mediaUrl||"")+(selectedEditionId?"?editionId="+encodeURIComponent(selectedEditionId):""))+'" alt="Foto compartida">':"")+'<div class="spirit-post-actions"><button type="button" class="spirit-likes-toggle" data-spirit-likes="'+esc(p.id)+'">❤️ '+Number(p.votes)+' Me gusta · Ver quiénes</button>'+(currentUser?.isPrimaryAdmin?'<button type="button" class="spirit-delete-button" data-admin-spirit-delete="'+esc(p.id)+'">🛡️ Moderar publicación</button>':'')+(p.user_id===currentUser.user.id?'<button type="button" class="spirit-delete-button" data-spirit-post-edit="'+esc(p.id)+'">Editar publicación</button><button type="button" class="spirit-delete-button" data-spirit-delete="'+esc(p.id)+'">Eliminar mi participación</button>':!data.activitiesEnabled?'<small class="spirit-muted">Votaciones cerradas fuera del horario</small>':p.eligibleForVoting===false?'<small class="spirit-trivia-wrong">Respuesta incorrecta</small>':'<button type="button" '+(p.voted?(p.my_vote_submission_id===p.id?'data-spirit-unvote="'+esc(p.id)+'"':'disabled aria-label="Ya diste Me gusta a este participante"'):'data-spirit-vote="'+esc(p.id)+'"')+'>'+(p.voted?(p.my_vote_submission_id===p.id?"Quitar Me gusta ✓":"Ya diste Me gusta ✓"):"Me gusta ❤️")+'</button>')+'</div><div class="spirit-likes-panel" data-spirit-likes-panel="'+esc(p.id)+'" hidden><p class="spirit-likes-loading">Abre para consultar quiénes reaccionaron.</p></div><div class="spirit-post-tools"><button type="button" data-spirit-comments="'+esc(p.id)+'">💬 Comentarios <span>'+Number(p.comment_count||0)+'</span></button><button type="button" data-spirit-share="'+esc(p.id)+'">📲 Compartir</button></div><section class="spirit-comments-panel" data-spirit-comments-panel="'+esc(p.id)+'" hidden><div class="spirit-comments-list"><p class="spirit-comments-loading">Abre los comentarios para ver la conversación.</p></div><form data-spirit-comment-form="'+esc(p.id)+'" class="spirit-comment-form"><textarea name="comment" maxlength="500" rows="2" placeholder="Escribe un comentario respetuoso…" required></textarea><div><small>Máximo 500 caracteres</small><button type="submit">Publicar</button></div><p class="spirit-comment-feedback" role="status"></p></form></section></article>').join("")+'</div></div>':'<p class="spirit-muted">Todavía no hay publicaciones. ¡Anímate a inaugurar el reto!</p>';
  const bonusSection=bonusPosts.length?'<section class="spirit-section spirit-feed-lane spirit-feed-bonus"><div class="spirit-section-title"><div><h3>🌟 Publicaciones Bonus</h3><small>Estas participaciones pertenecen a los retos bonus</small></div><span class="spirit-feed-count">'+bonusPosts.length+'</span></div>'+bonusFeed+'</section>':'';
  const dailySection=submissions.length?'<section class="spirit-section spirit-feed-lane spirit-feed-daily"><div class="spirit-section-title"><div><h3>🎯 Publicaciones del Reto diario</h3><small>Participaciones del reto diario de la comunidad</small></div><span class="spirit-feed-count">'+submissions.length+'</span></div>'+regularFeed+'</section>':(challenge?'<section class="spirit-section spirit-feed-lane spirit-feed-daily"><div class="spirit-section-title"><div><h3>🎯 Publicaciones del Reto diario</h3><small>Participaciones del reto diario de la comunidad</small></div></div><p class="spirit-muted">Todavía no hay publicaciones. ¡Anímate a inaugurar el reto!</p></section>':'');
   host.innerHTML='<section class="spirit-score-card"><div><small>TU PUNTUACIÓN</small><strong>'+Number(data.myPoints||0)+' pts</strong><span>'+(data.myRank?'Puesto #'+data.myRank:'Aún sin posición')+'</span></div><span class="spirit-score-icon">🏆</span></section>'+challengeMarkup.replace('</article>',formMarkup+'</article>')+bonusMarkup+bonusSection+dailySection+'<section class="spirit-section spirit-complete-ranking"><div class="spirit-section-title"><div><h3>🏆 Ranking Espíritu</h3><small>'+ranking.length+' participantes · clasificación general</small></div><span class="spirit-ranking-total">'+ranking.length+'</span></div><div class="spirit-ranking">'+rankMarkup+'</div>'+((restPeople.length>7)?'<button type="button" id="spirit-ranking-toggle" class="spirit-ranking-toggle" aria-expanded="false">Ver todos los participantes <span>⌄</span></button>':'')+myPinnedMarkup+'<button type="button" id="spirit-share-podium" class="spirit-share-podium">📲 Compartir podio como imagen</button></section>';
  if(!home.dataset.spiritHandlers){
   home.dataset.spiritHandlers="1";
   home.addEventListener("submit",async ev=>{const commentForm=ev.target.closest("[data-spirit-comment-form]");if(commentForm){ev.preventDefault();const postId=commentForm.dataset.spiritCommentForm,button=commentForm.querySelector('button[type="submit"]'),feedback=commentForm.querySelector(".spirit-comment-feedback"),textarea=commentForm.elements.comment,comment=String(textarea.value||"").trim();if(!comment)return;button.disabled=true;button.textContent="Publicando…";try{await api("/api/spirit/submissions/"+encodeURIComponent(postId)+"/comments",{method:"POST",body:JSON.stringify({comment})});textarea.value="";await refreshSpiritComments(postId);const countButton=home.querySelector('[data-spirit-comments="'+CSS.escape(postId)+'"] span');if(countButton)countButton.textContent=String(Number(countButton.textContent||0)+1);}catch(error){feedback.textContent=error.message;}finally{button.disabled=false;button.textContent="Publicar";}return;}if(ev.target.id==="spirit-bonus-form"){ev.preventDefault();const form=ev.target,button=form.querySelector('button[type="submit"]'),fb=$("#spirit-bonus-feedback");button.disabled=true;button.textContent="Enviando…";try{let caption=String(form.elements.caption?.value||"").trim(),mediaData="",mediaType="";if(bonusType==="photo"||bonusType==="voice"){const file=form.elements.media.files[0];if(!file)throw Error("Selecciona la evidencia.");mediaData=await blobToDataUrl(file);mediaType=file.type||"";}await api("/api/spirit/extra/submissions",{method:"POST",body:JSON.stringify({caption,mediaData,mediaType})});await renderSpiritTab();}catch(error){fb.textContent=error.message;button.disabled=false;button.textContent="Enviar evidencia bonus →";}return;}if(ev.target.id!=="spirit-submission-form")return;ev.preventDefault();const form=ev.target,button=form.querySelector('button[type="submit"]'),fb=$("#spirit-feedback");button.disabled=true;button.textContent="Enviando…";try{let caption=String(form.elements.caption?.value||"").trim(),mediaData="",mediaType="";if(type==="photo"){const file=form.elements.media.files[0];if(!file)throw Error("Selecciona una foto.");mediaData=await compressSpiritPhoto(file);mediaType="image/jpeg";}if(type==="voice"){const audioBlob=window.__spiritAudioBlob;if(!(audioBlob instanceof Blob)||audioBlob.size===0)throw Error("No encontramos una grabación válida. Espera a que aparezca «Audio listo para enviar» y vuelve a intentarlo.");if(audioBlob.size>370000)throw Error("El audio pesa demasiado. Graba nuevamente con un máximo de 30 segundos.");const rawAudioData=await blobToDataUrl(audioBlob),comma=rawAudioData.indexOf(",");if(comma<0||!rawAudioData.slice(comma+1))throw Error("No se pudo preparar el audio. Graba nuevamente.");const rawAudioMime=(audioBlob.type||rawAudioData.slice(5,rawAudioData.indexOf(";")>0?rawAudioData.indexOf(";"):rawAudioData.indexOf(","))).split(";")[0].trim().toLowerCase();mediaType=rawAudioMime==="audio/x-m4a"||rawAudioMime==="audio/m4a"?"audio/mp4":rawAudioMime;if(!/^audio\/(webm|ogg|mp4)$/.test(mediaType))throw Error("El formato de audio no es compatible ("+(rawAudioMime||"desconocido")+"). Graba nuevamente desde la aplicación.");mediaData="data:"+mediaType+";base64,"+rawAudioData.slice(comma+1);}if(type==="trivia")caption=String(new FormData(form).get("answer")||"");const result=await api("/api/spirit/submissions",{method:"POST",body:JSON.stringify({caption,mediaData,mediaType})});await renderSpiritTab();const score=$("#spirit-content .spirit-score-card");if(score){const triviaResult=type==="trivia";const feedback=triviaResult?(result.correct?'<div class="spirit-trivia-result is-correct" role="status"><strong>¡Correcto! 🎉</strong><span>¡Muy bien! Tu respuesta es acertada y has sumado los puntos correspondientes.</span></div>':'<div class="spirit-trivia-result is-incorrect" role="status"><strong>¡Ups! Esta vez no acertaste 😅</strong><span>La respuesta correcta era: <b>'+esc(result.correctAnswer||"No disponible")+"</b>. No obtienes puntos por esta respuesta. ¡Sigue participando!</span></div>"):'<p class="spirit-success">¡Participación enviada! Los puntos llegarán con los Me gusta que recibas. ❤️</p>';score.insertAdjacentHTML("afterend",feedback);}}catch(error){fb.textContent=error.message;button.disabled=false;button.textContent="Enviar mi participación →";}});
   home.addEventListener("click",async ev=>{
    const likesToggle=ev.target.closest("[data-spirit-likes]");if(likesToggle){const postId=likesToggle.dataset.spiritLikes,panel=home.querySelector('[data-spirit-likes-panel="'+CSS.escape(postId)+'"]');if(panel){panel.hidden=!panel.hidden;if(!panel.hidden)await refreshSpiritLikes(postId);}return;}
    const commentToggle=ev.target.closest("[data-spirit-comments]");if(commentToggle){const postId=commentToggle.dataset.spiritComments,panel=home.querySelector('[data-spirit-comments-panel="'+CSS.escape(postId)+'"]');if(panel){panel.hidden=!panel.hidden;if(!panel.hidden&&!panel.dataset.loaded)await refreshSpiritComments(postId);}return;}const rankingToggle=ev.target.closest("#spirit-ranking-toggle");if(rankingToggle){const expanded=rankingToggle.getAttribute("aria-expanded")==="true";home.querySelectorAll(".spirit-compact-rank-row.is-collapsed").forEach(row=>{row.hidden=expanded;});rankingToggle.setAttribute("aria-expanded",String(!expanded));rankingToggle.innerHTML=expanded?'Ver todos los participantes <span>⌄</span>':'Mostrar menos <span>⌃</span>';return;}const sharePost=ev.target.closest("[data-spirit-share]");if(sharePost){const post=submissions.find(item=>item.id===sharePost.dataset.spiritShare);if(post)await shareSpiritPost(post,challenge);return;}const shareBonus=ev.target.closest("[data-spirit-bonus-share]");if(shareBonus){const post=bonusPosts.find(item=>item.id===shareBonus.dataset.spiritBonusShare);if(post)await shareSpiritPost(post,challenge,true);return;}const sharePodium=ev.target.closest("#spirit-share-podium");if(sharePodium){await shareSpiritPodium(ranking,challenge);return;}
    const record=ev.target.closest("[data-spirit-record]");if(record){const status=$("#spirit-record-status"),preview=$("#spirit-audio-preview");try{if(!spiritRecorder||spiritRecorder.state==="inactive"){if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error("La grabación necesita abrirse desde el enlace seguro de la aplicación (https://) en Chrome o Safari.");if(!window.MediaRecorder)throw Error("Este navegador no es compatible con la grabación de audio. Abre la aplicación en Chrome actualizado.");let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}catch(firstError){if(firstError?.name==="OverconstrainedError"||firstError?.name==="ConstraintNotSatisfiedError")stream=await navigator.mediaDevices.getUserMedia({audio:true});else throw firstError;}window.__spiritAudioBlob=null;preview.pause();preview.removeAttribute("src");preview.classList.add("hidden");spiritAudioChunks=[];const supportedAudioType=["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/mp4"].find(type=>window.MediaRecorder.isTypeSupported?.(type));const recorderOptions={audioBitsPerSecond:32000};if(supportedAudioType)recorderOptions.mimeType=supportedAudioType;const recorder=new MediaRecorder(stream,recorderOptions);spiritRecorder=recorder;recorder.ondataavailable=e=>{if(e.data&&e.data.size)spiritAudioChunks.push(e.data);};recorder.onerror=()=>{window.__spiritAudioBlob=null;status.textContent="No se pudo procesar la grabación. Inténtalo nuevamente.";stream.getTracks().forEach(t=>t.stop());};recorder.onstop=()=>{const mimeType=recorder.mimeType||spiritAudioChunks.find(chunk=>chunk.type)?.type||"audio/webm";const audioBlob=new Blob(spiritAudioChunks,{type:mimeType});if(audioBlob.size>0){window.__spiritAudioBlob=audioBlob;preview.src=URL.createObjectURL(audioBlob);preview.classList.remove("hidden");status.textContent="Audio listo para enviar ("+Math.round(audioBlob.size/1024)+" KB).";}else{window.__spiritAudioBlob=null;status.textContent="No se capturó audio. Graba nuevamente.";preview.classList.add("hidden");}stream.getTracks().forEach(t=>t.stop());record.textContent="🎙️ Grabar nuevamente";};recorder.start(1000);record.textContent="⏹ Detener grabación";status.textContent="Grabando… máximo 30 segundos.";window.__spiritVoiceLimit=setTimeout(()=>{if(spiritRecorder?.state==="recording")spiritRecorder.stop();},30000);}else if(spiritRecorder.state==="recording"){clearTimeout(window.__spiritVoiceLimit);spiritRecorder.stop();}}catch(error){const name=error?.name||"";if(name==="NotAllowedError"||name==="PermissionDeniedError"||/permission denied|not allowed/i.test(error?.message||"")){status.textContent="No se concedió acceso al micrófono. En Android: abre los ajustes del sitio desde el candado junto a la dirección, entra en Permisos y activa Micrófono. Si está bloqueado en el teléfono, ve a Ajustes > Aplicaciones > Chrome > Permisos > Micrófono. Después vuelve a cargar esta página e inténtalo otra vez.";}else if(name==="NotFoundError"||name==="DevicesNotFoundError"){status.textContent="No encontramos un micrófono disponible en este dispositivo.";}else if(name==="NotReadableError"||name==="TrackStartError"){status.textContent="El micrófono está siendo usado por otra aplicación. Ciérrala e inténtalo nuevamente.";}else if(name==="SecurityError"){status.textContent="El navegador bloqueó el micrófono. Abre la aplicación directamente en Chrome y permite el acceso al micrófono.";}else{status.textContent=error?.message||"No se pudo iniciar la grabación. Revisa el permiso del micrófono.";}console.warn("Error de grabación de Espíritu:",name,error?.message||error);}return;}
    const adminPostDel=ev.target.closest("[data-admin-spirit-delete]");if(adminPostDel){if(!confirm("¿Eliminar esta publicación por contenido potencialmente peligroso? También se eliminarán sus comentarios, votos y puntos asociados."))return;adminPostDel.disabled=true;adminPostDel.textContent="Eliminando…";try{await api("/api/admin/spirit/submissions/"+encodeURIComponent(adminPostDel.dataset.adminSpiritDelete),{method:"DELETE"});await renderSpiritTab();}catch(error){adminPostDel.disabled=false;adminPostDel.textContent=error.message;}return;}
    const cancelInline=ev.target.closest("[data-spirit-edit-cancel]");if(cancelInline){cancelInline.closest(".spirit-inline-editor")?.remove();return;}
    const saveInline=ev.target.closest("[data-spirit-edit-save]");if(saveInline){const editor=saveInline.closest(".spirit-inline-editor"),kind=saveInline.dataset.spiritEditSave,field=editor?.querySelector("textarea"),value=field?.value.trim()||"",id=editor?.dataset.editId;if(!editor||!id)return;if((kind==="post"&&value.length<2)||!value||value.length>500){editor.querySelector(".spirit-inline-feedback").textContent=kind==="post"?"Escribe entre 2 y 500 caracteres.":"Escribe entre 1 y 500 caracteres.";return;}saveInline.disabled=true;saveInline.textContent="Guardando…";try{await api((kind==="post"?"/api/spirit/submissions/":"/api/spirit/comments/")+encodeURIComponent(id),{method:"PUT",body:JSON.stringify(kind==="post"?{caption:value}:{comment:value})});if(kind==="post")await renderSpiritTab();else await refreshSpiritComments(editor.closest(".spirit-comments-panel")?.dataset.spiritCommentsPanel);}catch(error){editor.querySelector(".spirit-inline-feedback").textContent=error.message;saveInline.disabled=false;saveInline.textContent="Guardar cambios";}return;}
    const commentEdit=ev.target.closest("[data-spirit-comment-edit]");if(commentEdit){const item=commentEdit.closest(".spirit-comment"),oldText=item?.querySelector("p")?.textContent||"";if(!item||item.querySelector(".spirit-inline-editor"))return;item.insertAdjacentHTML("beforeend",'<div class="spirit-inline-editor" data-edit-id="'+esc(commentEdit.dataset.spiritCommentEdit)+'"><label>Editar comentario</label><textarea maxlength="500" rows="3">'+esc(oldText)+'</textarea><div class="spirit-inline-footer"><small>Hasta 500 caracteres</small><span><button type="button" data-spirit-edit-cancel>Cancelar</button><button type="button" class="is-primary" data-spirit-edit-save="comment">Guardar cambios</button></span></div><small class="spirit-inline-feedback" role="status"></small></div>');item.querySelector(".spirit-inline-editor textarea")?.focus();return;}const postEdit=ev.target.closest("[data-spirit-post-edit]");if(postEdit){const post=postEdit.closest("[data-spirit-post]"),paragraph=post?.querySelector(":scope > p"),oldText=paragraph?.textContent||"";if(!post||post.querySelector(".spirit-inline-editor"))return;post.insertAdjacentHTML("beforeend",'<div class="spirit-inline-editor" data-edit-id="'+esc(postEdit.dataset.spiritPostEdit)+'"><label>Editar publicación</label><textarea maxlength="500" rows="4">'+esc(oldText)+'</textarea><div class="spirit-inline-footer"><small>De 2 a 500 caracteres</small><span><button type="button" data-spirit-edit-cancel>Cancelar</button><button type="button" class="is-primary" data-spirit-edit-save="post">Guardar cambios</button></span></div><small class="spirit-inline-feedback" role="status"></small></div>');post.querySelector(".spirit-inline-editor textarea")?.focus();return;}const commentDel=ev.target.closest("[data-spirit-comment-delete]");if(commentDel){const commentId=commentDel.dataset.spiritCommentDelete;commentDel.disabled=true;try{await api("/api/spirit/comments/"+encodeURIComponent(commentId),{method:"DELETE"});const panel=commentDel.closest(".spirit-comments-panel"),postId=panel?.dataset.spiritCommentsPanel;await refreshSpiritComments(postId);const countButton=home.querySelector('[data-spirit-comments="'+CSS.escape(postId)+'"] span');if(countButton)countButton.textContent=String(Math.max(0,Number(countButton.textContent||0)-1));}catch(error){commentDel.disabled=false;alert(error.message);}return;}const del=ev.target.closest("[data-spirit-delete]");if(del){if(!confirm("¿Eliminar tu participación y los puntos asociados?"))return;del.disabled=true;del.textContent="Eliminando…";try{await api("/api/spirit/submissions/"+encodeURIComponent(del.dataset.spiritDelete),{method:"DELETE"});await renderSpiritTab();}catch(error){del.disabled=false;del.textContent=error.message;}return;}
    const unvote=ev.target.closest("[data-spirit-unvote]");if(unvote){const postId=unvote.dataset.spiritUnvote;unvote.disabled=true;const oldText=unvote.textContent;try{const result=await api("/api/spirit/submissions/"+encodeURIComponent(postId)+"/vote",{method:"DELETE"});unvote.removeAttribute("data-spirit-unvote");unvote.setAttribute("data-spirit-vote",postId);unvote.textContent="Me gusta ❤️";unvote.disabled=false;const post=home.querySelector('[data-spirit-post="'+CSS.escape(postId)+'"]');const countButton=post?.querySelector("[data-spirit-likes]");if(countButton)countButton.textContent="❤️ "+Number(result.votes||0)+" Me gusta · Ver quiénes";const item=submissions.find(x=>x.id===postId);if(item){item.voted=false;item.my_vote_submission_id=null;item.votes=Number(result.votes||0);}}catch(error){unvote.disabled=false;unvote.textContent=error.message||oldText;}return;}const vote=ev.target.closest("[data-spirit-vote]");if(!vote)return;const postId=vote.dataset.spiritVote;vote.disabled=true;const oldText=vote.textContent;vote.textContent="Enviando…";try{const result=await api("/api/spirit/submissions/"+encodeURIComponent(postId)+"/vote",{method:"POST",body:JSON.stringify({})});vote.removeAttribute("data-spirit-vote");vote.setAttribute("data-spirit-unvote",postId);vote.textContent="Quitar Me gusta ✓";vote.disabled=false;const post=home.querySelector('[data-spirit-post="'+CSS.escape(postId)+'"]');const countButton=post?.querySelector("[data-spirit-likes]");if(countButton)countButton.textContent="❤️ "+Number(result.votes||0)+" Me gusta · Ver quiénes";const item=submissions.find(x=>x.id===postId);if(item){item.voted=true;item.my_vote_submission_id=postId;item.votes=Number(result.votes||0);}if(result.dailyActionAwarded){const score=home.querySelector(".spirit-score-card strong");if(score){const current=Number(String(score.textContent||"").replace(/[^0-9.-]/g,""))||0;score.textContent=(current+5)+" pts";}}}catch(error){vote.disabled=false;vote.textContent=error.message||oldText;}
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
 host.innerHTML='<p class="muted">Cargando administración de Espíritu…</p>';
 const [dr,ar,br]=await Promise.allSettled([api("/api/admin/spirit/challenges",{noMemoryCache:true}),api("/api/admin/spirit/activities",{noMemoryCache:true}),api("/api/admin/spirit/bonus",{noMemoryCache:true})]);
 const daily=dr.status==="fulfilled"?dr.value:{active:null,scheduled:[]},activity=ar.status==="fulfilled"?ar.value:{manualOverride:false},bonus=br.status==="fulfilled"?br.value:{active:null,submissions:[]};
 const active=bonus.active,subs=bonus.submissions||[],pending=subs.filter(x=>x.status==="pending").length;
 const err=(r,t)=>r.status==="rejected"?'<p class="status error">'+esc(t+': '+(r.reason?.message||"No disponible"))+'</p>':"";
 host.innerHTML='<section class="spirit-admin"><h3>🌟 Reto bonus</h3>'+err(br,"No se pudieron cargar evidencias")+'<div class="spirit-activity-switch"><div><b>'+(active?'Bonus activo: '+esc(active.title):'No hay reto bonus activo')+'</b><small>'+(active?'Duración: 24 horas · '+pending+' evidencia(s) pendiente(s).':'No hay un bonus activo.')+'</small></div><button type="button" class="admin-action" id="spirit-bonus-activate">'+(active?'⏸ Desactivar bonus':'🎁 Activar bonus')+'</button></div><div class="spirit-active-challenge"><b>Evidencias del bonus activo · '+pending+' pendiente(s)</b><div id="spirit-bonus-reviews">'+(active&&subs.length?subs.map(x=>'<article class="spirit-bonus-review"><b>'+esc(x.display_name)+'</b><small>'+esc(x.challenge_title||"Reto bonus")+' · '+esc(x.created_at)+'</small><p>'+esc(x.caption||"Evidencia adjunta")+'</p>'+(x.media_type?(x.media_type.startsWith("image/")?'<img style="max-width:100%;max-height:300px" src="/api/admin/spirit/bonus/media/'+encodeURIComponent(x.id)+'" alt="Evidencia">':x.media_type.startsWith("audio/")?'<audio controls src="/api/admin/spirit/bonus/media/'+encodeURIComponent(x.id)+'"></audio>':''):'')+(x.status==="pending"?'<button type="button" data-bonus-review="'+esc(x.id)+'" data-review-status="approved">Aprobar +10 pts</button> <button type="button" data-bonus-review="'+esc(x.id)+'" data-review-status="rejected">Rechazar</button>':'')+'</article>').join(""):"No hay evidencias para mostrar.")+'</div></div>'+err(ar,"No se pudo consultar la configuración")+'<div class="spirit-activity-switch"><b>Actividades de Espíritu</b><button type="button" class="admin-action" id="spirit-activity-toggle">'+(activity.manualOverride?'↻ Volver al horario automático':'▶ Activar ahora')+'</button></div>'+err(dr,"No se pudo consultar el reto diario")+'<div class="spirit-active-challenge"><b>Reto diario actual</b><span>'+(daily.active?esc(daily.active.title):"No hay un reto diario activo")+'</span></div><button type="button" class="admin-action" id="spirit-daily-activate" '+(daily.active?'disabled':'')+'>⚡ Activar reto diario ahora</button><small>Si no programas uno, el sistema activará un reto automáticamente a las 6:00 p. m. (hora Perú).</small><section class="spirit-active-challenge"><h4>📅 Programar reto con anticipación</h4><p>Abre a las 6:00 p. m. y cierra a las 6:00 a. m. (hora Perú).</p><b>💡 Sugerencias por tipo</b><div class="spirit-suggestion-grid"><button type="button" class="spirit-suggestion-card" data-idea-type="trivia">🧠 Encuesta / Trivia</button><button type="button" class="spirit-suggestion-card" data-idea-type="voice">🎙️ Audio</button><button type="button" class="spirit-suggestion-card" data-idea-type="photo">📸 Imagen</button><button type="button" class="spirit-suggestion-card" data-idea-type="text">💌 Texto</button></div><p id="spirit-suggestion-preview">Elige un tipo para recibir una sugerencia editable.</p><form id="spirit-schedule-form" class="profile-form"><label>Título<input name="title" minlength="3" maxlength="80" required></label><label>Descripción<textarea name="description" minlength="5" maxlength="300" required></textarea></label><label>Tipo<select name="challengeType"><option value="text">Texto</option><option value="photo">Imagen</option><option value="voice">Audio</option><option value="trivia">Encuesta / Trivia</option></select></label><div id="spirit-trivia-config" hidden><label>Pregunta<input name="question"></label><label>Alternativa A<input name="optionA"></label><label>Alternativa B<input name="optionB"></label><label>Alternativa C<input name="optionC"></label><label>Alternativa D<input name="optionD"></label><label>Respuesta correcta<select name="correctAnswer"><option value="">Selecciona</option></select></label></div><label>Fecha de apertura<input type="date" name="scheduledDate" required></label><label>Puntos<input name="points" type="number" min="1" max="100" value="10" required></label><label>Bonus al ganador<input name="bonusPoints" type="number" min="1" max="50" value="5" required></label><button class="admin-action" type="submit">📅 Guardar reto programado</button><p id="spirit-schedule-feedback" role="status"></p></form><b>Próximos retos programados</b>'+(daily.scheduled||[]).map(x=>'<p>'+esc(x.title)+' · '+esc(formatSpiritScheduleDate(x.starts_at))+'</p>').join("")+'</section><button type="button" class="spirit-reset-points" id="spirit-reset-my-points">↺ Reiniciar mis puntos</button><small>Solo afecta tu puntuación en la edición actual.</small><div id="spirit-admin-feedback" role="status"></div></section>';
 const ideas={
  trivia:[
   {title:"Trivia del árbol navideño",description:"Responde una pregunta sobre tradiciones navideñas.",question:"¿En qué país se originó la tradición moderna del árbol de Navidad?",options:["Alemania","Italia","México","Canadá"],correctAnswer:"Alemania"},
   {title:"El reto del Grinch",description:"Demuestra cuánto sabes sobre películas navideñas.",question:"¿Cómo se llama el perro del Grinch?",options:["Max","Rudolph","Buddy","Jack"],correctAnswer:"Max"},
   {title:"Renos en acción",description:"Pon a prueba tu memoria sobre los ayudantes de Santa.",question:"¿Cuál de estos renos tiene la nariz roja?",options:["Rudolph","Comet","Dasher","Blitzen"],correctAnswer:"Rudolph"},
   {title:"Cine bajo el árbol",description:"Una pregunta rápida sobre un clásico de Navidad.",question:"¿Cómo se llama el niño protagonista de Mi pobre angelito?",options:["Kevin","Charlie","Buddy","George"],correctAnswer:"Kevin"},
   {title:"Sabores navideños",description:"Adivina una tradición gastronómica de Navidad.",question:"¿Qué dulce es típico de la Navidad en Perú?",options:["Panetón","Turrón de Doña Pepa","King Kong","Mazamorra"],correctAnswer:"Panetón"},
   {title:"Cultura pop navideña",description:"Responde esta curiosidad de temporada.",question:"¿Qué personaje intenta robar la Navidad?",options:["El Grinch","Shrek","Stitch","Garfield"],correctAnswer:"El Grinch"}
  ],
  voice:[
   {title:"Voz de Papá Noel",description:"Graba un saludo navideño divertido como si fueras Papá Noel. Máximo 30 segundos."},
   {title:"Doblaje imposible",description:"Graba una frase navideña como villano, narrador deportivo o presentador de noticias."},
   {title:"Risa de duende",description:"Graba tu mejor risa de duende navideño durante 15 segundos."},
   {title:"Comercial del Polo Norte",description:"Vende un producto navideño inventado en un anuncio de radio de hasta 30 segundos."},
   {title:"Reno reportero",description:"Informa desde el taller de Santa como corresponsal de televisión."},
   {title:"Trabalenguas festivo",description:"Di un trabalenguas navideño tres veces seguidas sin equivocarte."},
   {title:"Villancico remix",description:"Tararea un villancico como si fuera rock, salsa o reguetón."}
  ],
  photo:[
   {title:"Postal navideña viviente",description:"Recrea una postal navideña con objetos que tengas a mano y comparte una foto."},
   {title:"El árbol inesperado",description:"Fotografía un árbol navideño hecho con materiales poco comunes."},
   {title:"Navidad en miniatura",description:"Crea una escena navideña pequeña y fotografíala."},
   {title:"Caza del detalle festivo",description:"Encuentra un detalle navideño que los demás podrían pasar por alto y fotografíalo."},
   {title:"Tres colores de Navidad",description:"Fotografía juntos un objeto rojo, uno verde y uno dorado."},
   {title:"Decoración improvisada",description:"Crea una decoración navideña con tres objetos cotidianos y comparte el resultado."},
   {title:"Mi rincón favorito",description:"Comparte una foto del rincón que más espíritu navideño transmite."}
  ],
  text:[
   {title:"Un deseo para todos",description:"Comparte un deseo positivo para la comunidad en estas fiestas."},
   {title:"Titular de última hora",description:"Escribe un titular gracioso sobre la llegada de la Navidad al equipo."},
   {title:"Manual del duende",description:"Inventa una regla absurda que todo duende debería cumplir."},
   {title:"Navidad en seis palabras",description:"Comparte un deseo navideño usando exactamente seis palabras."},
   {title:"El regalo imposible",description:"Describe el regalo más absurdo que podría recibir Santa."},
   {title:"Tradición inventada",description:"Inventa una nueva tradición navideña que debería adoptar todo el equipo."},
   {title:"Premios del equipo",description:"Crea una categoría divertida y amable para premiar a un compañero."},
   {title:"Confesión de reno",description:"Completa: «Casi me despiden del trineo porque…»."},
   {title:"Mi Navidad ideal",description:"Describe en tres frases cómo sería tu Navidad ideal."},
   {title:"Cinco emojis",description:"Cuenta cómo va tu semana usando exactamente cinco emojis y explica uno."},
   {title:"Cadena de gratitud",description:"Agradece algo concreto que haya hecho un compañero este año."}
  ]
};
 const f=$("#spirit-schedule-form"),trivia=$("#spirit-trivia-config"),sync=()=>{const yes=f.elements.challengeType.value==="trivia";trivia.hidden=!yes;["question","optionA","optionB","optionC","optionD","correctAnswer"].forEach(k=>f.elements[k].required=yes);};
 f.elements.challengeType.addEventListener("change",sync);sync();
 host.querySelectorAll("[data-idea-type]").forEach(btn=>btn.addEventListener("click",()=>{const type=btn.dataset.ideaType,idea=ideas[type][Math.floor(Math.random()*ideas[type].length)];f.elements.title.value=idea.title;f.elements.description.value=idea.description;f.elements.challengeType.value=type;sync();if(type==="trivia"){f.elements.question.value=idea.question;["optionA","optionB","optionC","optionD"].forEach((k,i)=>f.elements[k].value=idea.options[i]||"");f.elements.correctAnswer.innerHTML='<option value="">Selecciona</option>'+idea.options.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");f.elements.correctAnswer.value=idea.correctAnswer;}$("#spirit-suggestion-preview").textContent="Sugerencia cargada. Puedes editarla antes de programar.";}));
 f.addEventListener("submit",async ev=>{ev.preventDefault();const b=f.querySelector('button[type="submit"]'),v=Object.fromEntries(new FormData(f));v.points=Number(v.points);v.bonusPoints=Number(v.bonusPoints);v.config=v.challengeType==="trivia"?{question:v.question,options:[v.optionA,v.optionB,v.optionC,v.optionD].map(x=>String(x||"").trim()).filter(Boolean),correctAnswer:v.correctAnswer}:{};b.disabled=true;try{await api("/api/admin/spirit/challenges",{method:"POST",body:JSON.stringify(v)});await loadSpiritAdmin();}catch(e){$("#spirit-schedule-feedback").textContent=e.message;}finally{b.disabled=false;}});
 $("#spirit-daily-activate")?.addEventListener("click",async ev=>{
  const b=ev.currentTarget;if(!confirm("¿Activar ahora un reto diario aleatorio? Se notificará a todos los participantes."))return;
  b.disabled=true;b.textContent="Activando…";
  try{const result=await api("/api/admin/spirit/challenges/activate",{method:"POST",body:JSON.stringify({})});$("#spirit-admin-feedback").textContent="Reto diario activado: "+result.challenge.title;await loadSpiritAdmin();}
  catch(error){b.disabled=false;b.textContent="⚡ Activar reto diario ahora";$("#spirit-admin-feedback").textContent=error.message;}
 });
 $("#spirit-bonus-activate")?.addEventListener("click",async ev=>{const b=ev.currentTarget;if(!confirm(active?"¿Desactivar el reto bonus actual? Las evidencias se conservarán.":"¿Activar un reto bonus aleatorio?"))return;b.disabled=true;try{const result=await api("/api/admin/spirit/bonus/activate",{method:"POST",body:JSON.stringify({})});await loadSpiritAdmin();$("#spirit-admin-feedback").textContent=result.active===false?"Bonus desactivado.":"Bonus activado: "+result.title;}catch(e){b.disabled=false;$("#spirit-admin-feedback").textContent=e.message;}});
 $("#spirit-bonus-reviews")?.addEventListener("click",async ev=>{const b=ev.target.closest("[data-bonus-review]");if(!b)return;const status=b.dataset.reviewStatus;if(!confirm(status==="approved"?"¿Aprobar esta evidencia y otorgar 10 puntos?":"¿Rechazar esta evidencia?"))return;b.disabled=true;try{await api("/api/admin/spirit/bonus/submissions/"+encodeURIComponent(b.dataset.bonusReview),{method:"PATCH",body:JSON.stringify({status})});await loadSpiritAdmin();}catch(e){b.disabled=false;$("#spirit-admin-feedback").textContent=e.message;}});
 $("#spirit-activity-toggle")?.addEventListener("click",async ev=>{const b=ev.currentTarget,next=!activity.manualOverride;if(!confirm(next?"¿Activar manualmente las actividades de Espíritu?":"¿Volver al horario automático?"))return;b.disabled=true;try{await api("/api/admin/spirit/activities",{method:"PATCH",body:JSON.stringify({manualOverride:next})});await loadSpiritAdmin();}catch(e){b.disabled=false;b.textContent=e.message;}});
 $("#spirit-reset-my-points")?.addEventListener("click",async()=>{if(!confirm("¿Dejar tu puntuación en cero?"))return;const b=$("#spirit-reset-my-points");b.disabled=true;try{const r=await api("/api/admin/spirit/reset-my-points",{method:"POST",body:JSON.stringify({})});b.textContent="Tus puntos fueron reiniciados ✓";b.insertAdjacentHTML("afterend",'<p class="spirit-success">Se eliminaron '+Number(r.deleted)+' registros.</p>');}catch(e){b.disabled=false;b.textContent=e.message;}});
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

async function loadAdminPointsAnalysis(){
 const host=$("#admin-points-analysis-panel");if(!host||!currentUser?.isPrimaryAdmin)return;
 host.innerHTML='<div class="admin-points-audit"><div class="admin-points-audit-heading"><span>🧮</span><div><h3>Análisis de puntajes</h3><p>Consulta el origen de los puntos y revierte movimientos individuales cuando sea necesario.</p></div></div><form id="admin-points-audit-form"><label for="admin-points-participant">Participante</label><select id="admin-points-participant" name="userId" required><option value="">Cargando participantes…</option></select><button class="primary-button" type="submit">Analizar puntaje</button></form><div id="admin-points-audit-result" aria-live="polite"></div></div>';
 const select=$("#admin-points-participant"),form=$("#admin-points-audit-form"),result=$("#admin-points-audit-result");
 try{
  const data=await api("/api/admin/participants",{noMemoryCache:true}),people=data.participants||[];
  const options=people.map(person=>'<option value="'+esc(person.user_id)+'">'+esc(person.display_name)+(person.status==="inactive"?" · Inactivo":"")+'</option>').join("");
  select.innerHTML='<option value="">Selecciona un participante</option>'+options;
  if(!people.length)select.innerHTML='<option value="">No hay participantes en esta edición</option>';
 }catch(error){select.innerHTML='<option value="">No se pudieron cargar los participantes</option>';result.innerHTML='<p class="status error">'+esc(error.message)+'</p>';return;}
 result.addEventListener("click",async event=>{
  const button=event.target.closest("[data-delete-point]");if(!button)return;
  const pointId=button.dataset.deletePoint,userId=select.value;
  if(!pointId||!userId)return;
  if(!window.confirm("¿Eliminar estos puntos y reiniciar la acción que los generó para este participante?"))return;
  button.disabled=true;button.textContent="Eliminando…";
  try{
   await api("/api/admin/spirit/points/"+encodeURIComponent(pointId),{method:"DELETE",body:JSON.stringify({userId})});
   form.requestSubmit();
  }catch(error){button.disabled=false;button.textContent="Eliminar";window.alert(error.message||"No se pudo revertir el movimiento.");}
 });
 form.addEventListener("submit",async event=>{
  event.preventDefault();const userId=select.value;if(!userId)return;
  const button=form.querySelector("button");button.disabled=true;button.textContent="Analizando…";result.innerHTML='<p class="muted">Calculando el detalle del puntaje…</p>';
  try{
   const data=await api("/api/admin/spirit/points-analysis?userId="+encodeURIComponent(userId),{noMemoryCache:true});
   const entries=data.entries||[],groups=new Map();
   for(const entry of entries){const key=entry.source_type+"|"+entry.description;const group=groups.get(key)||{sourceType:entry.source_type,description:entry.description,points:0,count:0};group.points+=Number(entry.points||0);group.count++;groups.set(key,group);}
   const items=[...groups.values()].sort((x,y)=>y.points-x.points);
   const typeLabel={like:"Me gusta recibidos",submission:"Participación",achievement:"Logros",daily_action:"Acciones diarias",daily_winner:"Reto diario ganador",bonus_approved:"Bonus aprobado",community_bonus:"Bonus de comunidad",admin_adjustment:"Ajuste manual"};
   result.innerHTML='<section class="admin-points-audit-summary"><div><span>PARTICIPANTE</span><b>'+esc(data.participant.displayName)+'</b></div><div><span>PUNTAJE TOTAL</span><strong>'+Number(data.totalPoints||0)+' <small>pts</small></strong></div></section>'+(items.length?'<div class="admin-points-audit-list"><h4>Desglose de puntos</h4>'+items.map(item=>'<article class="admin-points-audit-row"><div><b>'+esc(item.description||typeLabel[item.sourceType]||item.sourceType)+'</b><small>'+esc(typeLabel[item.sourceType]||item.sourceType)+(item.count>1?' · '+item.count+' registros':'')+'</small></div><strong>'+(item.points>0?'+':'')+item.points+' pts</strong></article>').join("")+'</div><details class="admin-points-audit-history" open><summary>Historial individual ('+entries.length+')</summary>'+entries.map(entry=>'<div class="admin-points-history-row"><span>'+esc(entry.description||typeLabel[entry.source_type]||entry.source_type)+'<small>'+esc(typeLabel[entry.source_type]||entry.source_type)+' · '+esc(entry.created_at||"")+'</small></span><div class="admin-points-history-actions"><b>'+(Number(entry.points)>0?'+':'')+Number(entry.points)+' pts</b><button type="button" class="admin-points-history-delete" data-delete-point="'+esc(entry.id)+'">Eliminar</button></div></div>').join("")+'</details>':'<p class="muted">Este participante todavía no tiene movimientos de puntaje registrados.</p>');
  }catch(error){result.innerHTML='<p class="status error">'+esc(error.message||"No se pudo analizar el puntaje.")+'</p>';}
  finally{button.disabled=false;button.textContent="Analizar puntaje";}
 });
}
async function showAdminSettings(){
 const home=$("#member-app .member-home");if(!currentUser?.isPrimaryAdmin||!home)return;
 home.innerHTML='<div class="admin-settings-view"><div class="settings-header"><span>⚙️</span><div><h2>Administración</h2><p>Accede directamente a cada área, sin recorrer una pantalla interminable.</p></div></div><nav class="admin-settings-nav" aria-label="Secciones de administración"><button type="button" class="active" data-admin-section="general">⚙️ General</button><button type="button" data-admin-section="game">🎮 Juego</button><button type="button" data-admin-section="messages">💌 Mensajes</button><button type="button" data-admin-section="activity">📊 Actividad</button><button type="button" data-admin-section="points">🧮 Puntajes</button><button type="button" data-admin-section="spirit">🎄 Espíritu</button><button type="button" data-admin-section="draw">🎁 Sorteo</button><button type="button" data-admin-section="tools">👥 Participantes</button></nav><section class="admin-settings-section" id="admin-section-general"><div id="edition-settings-feedback" class="status hidden"></div><form id="edition-settings-form" class="edition-settings-form"><label>Nombre del intercambio<input name="title" maxlength="100" required></label><label>Fecha del intercambio<input name="eventDate" type="date"></label><label>Presupuesto por persona (S/) <input name="budgetAmount" type="number" min="0" step="0.01" placeholder="Ej. 80"></label><button class="primary-button" type="submit">Guardar ajustes</button></form><div id="onboarding-home-editor" class="onboarding-home-editor hidden"><h3>Plantilla de Inicio · Onboarding Digital</h3><p>Solo el administrador puede editar estos datos y decidir qué secciones se muestran.</p><form id="onboarding-home-form"><label>Mensaje de bienvenida<input name="welcomeText" maxlength="300"></label><label><input type="checkbox" name="showDate" checked> Mostrar fecha</label><label><input type="checkbox" name="showPlace" checked> Mostrar lugar</label><label>Nombre del lugar<input name="placeName" maxlength="300"></label><label><input type="checkbox" name="showAddress" checked> Mostrar dirección</label><label>Dirección<textarea name="address" rows="2" maxlength="300"></textarea></label><label><input type="checkbox" name="showSchedule" checked> Mostrar horario</label><label>Horario<input name="schedule" maxlength="300"></label><label><input type="checkbox" name="showBreakfast" checked> Mostrar desayuno</label><label>Desayuno<input name="breakfast" maxlength="300"></label><label><input type="checkbox" name="showGrillFee" checked> Mostrar cuota / aporte</label><label>Cuota / aporte<input name="grillFee" maxlength="300"></label><label><input type="checkbox" name="showExtraInfo" checked> Mostrar indicaciones adicionales</label><label>Indicaciones adicionales<textarea name="extraInfo" rows="3" maxlength="1500"></textarea></label><label><input type="checkbox" name="showMap" checked> Mostrar enlace y mapa</label><label>Enlace de Google Maps<input name="mapUrl" type="url" placeholder="https://maps.app.goo.gl/..."></label><label>Texto para compartir por WhatsApp<textarea name="shareMessage" rows="4" maxlength="1500"></textarea></label><button class="primary-button" type="submit">Guardar información de Inicio</button><div id="onboarding-home-feedback" class="status hidden"></div></form></div><form id="home-photo-form" class="home-photo-admin-form"><h3>Foto para Inicio</h3><p>Sube una imagen cuando quieras que aparezca en el Inicio del intercambio. Puedes reemplazarla u ocultarla cuando lo necesites.</p><label>Seleccionar foto<input id="home-photo-file" type="file" accept="image/*"></label><label class="home-photo-toggle"><input id="home-photo-visible" type="checkbox" checked> Mostrar foto en Inicio</label><img id="home-photo-preview" class="home-photo-preview hidden" alt="Vista previa de la foto de Inicio"><div class="home-photo-actions"><button class="primary-button" type="submit">Guardar foto</button><button class="secondary-action" type="button" id="home-photo-remove">Quitar foto</button></div><div id="home-photo-feedback" class="status hidden"></div></form><form id="global-music-admin-form" class="home-photo-admin-form"><h3>🎵 Música de fondo global</h3><p>La misma música sonará en Cliente 360 y Onboarding Digital. Puedes reemplazarla desde tu teléfono. Formatos MP3, M4A, AAC, OGG, WAV o WEBM · máximo 15 MB.</p><label>Seleccionar archivo de audio<input id="global-music-file" type="file" accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav,audio/webm" required></label><div id="global-music-current" class="settings-note">Consultando música configurada…</div><div class="home-photo-actions"><button class="primary-button" type="submit">Guardar música</button></div><div id="global-music-feedback" class="status hidden"></div></form><p class="settings-note">Los datos del intercambio pueden actualizarse desde esta sección.</p></section><section class="admin-settings-section hidden" id="admin-section-game"><div class="rozvi-admin-settings"><div class="admin-activity-section-heading"><div><h3>🎮 Configuración de ¡Vamos Rozvi!</h3><p>Personaliza las vidas diarias, puntuación, música y la imagen promocional del juego.</p></div></div><form id="rozvi-settings-form" class="edition-settings-form"><label>Vidas disponibles por día<input name="lives" type="number" min="1" max="10" step="1" required></label><label>Puntos por botella de Pilsen<input name="beerPoints" type="number" min="1" max="20" step="1" required></label><label>Penalización por agua mineral (puntos)<input name="waterPenalty" type="number" min="0" max="20" step="1" required></label><button class="primary-button" type="submit">Guardar configuración del juego</button><div id="rozvi-settings-feedback" class="status hidden"></div></form><form id="rozvi-music-form" class="home-photo-admin-form"><h3>🎵 Música exclusiva del minijuego</h3><p>Esta canción sonará únicamente mientras se juega ¡Vamos Rozvi!. Se detendrá al pausar, terminar o salir. Formatos MP3, M4A, AAC, OGG, WAV o WEBM · máximo 15 MB.</p><label>Seleccionar canción<input id="rozvi-music-file" type="file" accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav,audio/webm" required></label><div id="rozvi-music-current" class="settings-note">Consultando canción configurada…</div><div class="home-photo-actions"><button class="primary-button" type="submit">Subir canción</button></div><div id="rozvi-music-feedback" class="status hidden"></div></form><form id="rozvi-art-form" class="home-photo-admin-form"><h3>🖼️ Imagen de portada de ¡Vamos Rozvi!</h3><p>Sube la ilustración que aparecerá como fondo en Inicio, detrás del anuncio «Nuevo juego disponible». Puedes reemplazarla o quitarla cuando quieras. Formatos JPG, PNG o WEBP · máximo 5 MB.</p><label>Seleccionar imagen<input id="rozvi-art-file" type="file" accept="image/jpeg,image/png,image/webp" required></label><img id="rozvi-art-preview" class="home-photo-preview hidden" alt="Vista previa de la portada de ¡Vamos Rozvi!"><div id="rozvi-art-current" class="settings-note">Consultando imagen configurada…</div><div class="home-photo-actions"><button class="primary-button" type="submit">Guardar imagen para Inicio</button><button class="secondary-action" type="button" id="rozvi-art-remove">Quitar imagen</button></div><div id="rozvi-art-feedback" class="status hidden"></div></form></div><section class="divorzhinha-admin-settings-section" id="divorzhinha-admin-settings"><div class="divorzhinha-admin-settings"><div class="admin-activity-section-heading"><div><h3>⚽ Configuración de DIVORZINHA</h3><p>Personaliza la imagen de portada y la música exclusiva del juego. No afecta a ¡Vamos Rozvi!</p></div></div><form id="divorzhinha-art-form" class="home-photo-admin-form"><h3>🖼️ Imagen del juego</h3><p>JPG, PNG o WEBP · máximo 5 MB.</p><label>Seleccionar imagen<input id="divorzhinha-art-file" type="file" accept="image/jpeg,image/png,image/webp" required></label><img id="divorzhinha-art-preview" class="home-photo-preview hidden" alt="Vista previa de DIVORZINHA"><div id="divorzhinha-art-current" class="settings-note">Consultando imagen configurada…</div><div class="home-photo-actions"><button class="primary-button" type="submit">Guardar imagen</button><button class="secondary-action" type="button" id="divorzhinha-art-remove">Quitar imagen</button></div><div id="divorzhinha-art-feedback" class="status hidden"></div></form><form id="divorzhinha-music-form" class="home-photo-admin-form"><h3>🎵 Música del minijuego</h3><p>Se reproduce durante la partida y se detiene al pausar, terminar o salir. MP3, M4A, AAC, OGG, WAV o WEBM · máximo 15 MB.</p><label>Seleccionar canción<input id="divorzhinha-music-file" type="file" accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav,audio/webm" required></label><div id="divorzhinha-music-current" class="settings-note">Consultando canción configurada…</div><div class="home-photo-actions"><button class="primary-button" type="submit">Guardar canción</button></div><div id="divorzhinha-music-feedback" class="status hidden"></div></form></div></section><form id="nikehunt-art-form" class="home-photo-admin-form"><h3>🖼️ Imagen de fondo de la tarjeta NIKE HUNT</h3><p>Esta imagen se mostrará detrás del anuncio del juego en Inicio. JPG, PNG o WEBP · máximo 5 MB.</p><label>Seleccionar imagen<input id="nikehunt-art-file" type="file" accept="image/jpeg,image/png,image/webp" required></label><img id="nikehunt-art-preview" class="home-photo-preview hidden" alt="Vista previa de NIKE HUNT"><div id="nikehunt-art-current" class="settings-note">Consultando imagen configurada…</div><div class="home-photo-actions"><button class="primary-button" type="submit">Guardar imagen</button><button class="secondary-action" type="button" id="nikehunt-art-remove">Quitar imagen</button></div><div id="nikehunt-art-feedback" class="status hidden"></div></form><form id="nikehunt-music-form" class="home-photo-admin-form"><h3>🎵 Música de NIKE HUNT</h3><p>Se reproducirá durante la partida y se detendrá al salir o terminar. MP3, M4A, AAC, OGG, WAV o WEBM · máximo 15 MB.</p><label>Seleccionar canción<input id="nikehunt-music-file" type="file" accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav,audio/webm" required></label><div id="nikehunt-music-current" class="settings-note">Consultando canción configurada…</div><div class="home-photo-actions"><button class="primary-button" type="submit">Guardar canción</button></div><div id="nikehunt-music-feedback" class="status hidden"></div></form></section><section class="admin-settings-section hidden" id="admin-section-messages"><div id="admin-secret-messages-panel"><p class="muted">Consulta los mensajes enviados entre amigos secretos.</p></div></section><section class="admin-settings-section hidden" id="admin-section-activity"><div id="admin-activity-panel"><p class="muted">Consultando actividad…</p></div></section><section class="admin-settings-section hidden" id="admin-section-points"><div id="admin-points-analysis-panel"><p class="muted">Selecciona un participante para revisar el detalle de su puntaje.</p></div></section><section class="admin-settings-section hidden" id="admin-section-spirit"><div id="spirit-admin-controls"></div></section><section class="admin-settings-section hidden" id="admin-section-draw"><div id="draw-admin-controls"></div></section><section class="admin-settings-section hidden" id="admin-section-tools"><div class="admin-tools-section"><div id="admin-tools-slot"></div></div></section></div>';
 const loadSection=async key=>{
  const target=home.querySelector("#admin-section-"+key);if(!target||target.dataset.loaded==="1"||target.dataset.loading==="1")return;
  target.dataset.loading="1";
  try{
   if(key==="game"){
    const config=await api("/api/rozvi/settings",{noMemoryCache:true}),form=$("#rozvi-settings-form");form.elements.lives.value=config.lives??3;form.elements.beerPoints.value=config.beerPoints??1;form.elements.waterPenalty.value=config.waterPenalty??2;
    form.addEventListener("submit",async ev=>{ev.preventDefault();const b=form.querySelector("button[type=submit]"),fb=$("#rozvi-settings-feedback");b.disabled=true;try{const values=Object.fromEntries(new FormData(form));await api("/api/rozvi/settings",{method:"PUT",body:JSON.stringify({lives:Number(values.lives),beerPoints:Number(values.beerPoints),waterPenalty:Number(values.waterPenalty)})});fb.textContent="Configuración del juego guardada.";fb.classList.remove("hidden","error");}catch(err){fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}finally{b.disabled=false;}});
    const mf=$("#rozvi-music-form"),file=$("#rozvi-music-file"),current=$("#rozvi-music-current"),feedback=$("#rozvi-music-feedback");const refresh=async()=>{try{const d=await api("/api/admin/rozvi/music",{noMemoryCache:true});current.textContent=d.configured?"Canción actual: "+(d.fileName||"Audio")+" · "+(d.size/1024/1024).toFixed(2)+" MB":"No has subido una canción para el minijuego.";}catch(err){current.textContent=err.message;}};await refresh();mf.addEventListener("submit",async ev=>{ev.preventDefault();const f=file.files?.[0];if(!f)return;const b=mf.querySelector("button[type=submit]");b.disabled=true;b.textContent="Subiendo canción…";try{const data=new FormData();data.append("file",f);await api("/api/admin/rozvi/music",{method:"POST",body:data});feedback.textContent="Canción del minijuego actualizada.";feedback.classList.remove("hidden","error");file.value="";await refresh();}catch(err){feedback.textContent=err.message;feedback.classList.remove("hidden");feedback.classList.add("error");}finally{b.disabled=false;b.textContent="Subir canción";}});
    const af=$("#rozvi-art-form"),artFile=$("#rozvi-art-file"),artPreview=$("#rozvi-art-preview"),artCurrent=$("#rozvi-art-current"),artFeedback=$("#rozvi-art-feedback"),artSave=af.querySelector('button[type="submit"]'),artRemove=$("#rozvi-art-remove");
    const refreshArt=async()=>{try{const d=await api("/api/admin/rozvi/art",{noMemoryCache:true});artCurrent.textContent=d.configured?"Imagen actual: "+(d.fileName||"Portada")+" · "+(d.size/1024/1024).toFixed(2)+" MB":"No has subido una imagen de portada. Se mostrará el diseño predeterminado.";if(d.configured){artPreview.src="/api/rozvi/home-background?t="+Date.now();artPreview.classList.remove("hidden");}else{artPreview.removeAttribute("src");artPreview.classList.add("hidden");}}catch(err){artCurrent.textContent=err.message;}};
    artFile.addEventListener("change",()=>{const f=artFile.files?.[0];if(!f){artPreview.classList.add("hidden");return;}if(f.size>5*1024*1024){artFeedback.textContent="La imagen supera el límite de 5 MB.";artFeedback.classList.remove("hidden");artFeedback.classList.add("error");artFile.value="";return;}artPreview.src=URL.createObjectURL(f);artPreview.classList.remove("hidden");});
    await refreshArt();af.addEventListener("submit",async ev=>{ev.preventDefault();const f=artFile.files?.[0];if(!f){artFeedback.textContent="Selecciona una imagen primero.";artFeedback.classList.remove("hidden");artFeedback.classList.add("error");return;}const b=artSave;b.disabled=true;b.textContent="Subiendo imagen…";try{const data=new FormData();data.append("file",f);await api("/api/admin/rozvi/art",{method:"POST",body:data});artFeedback.textContent="Imagen de portada guardada. Ya se mostrará en Inicio.";artFeedback.classList.remove("hidden","error");artFile.value="";await refreshArt();}catch(err){artFeedback.textContent=err.message;artFeedback.classList.remove("hidden");artFeedback.classList.add("error");}finally{b.disabled=false;b.textContent="Guardar imagen para Inicio";}});
    artRemove.addEventListener("click",async()=>{if(!confirm("¿Quitar la imagen personalizada de ¡Vamos Rozvi!?"))return;artRemove.disabled=true;try{await api("/api/admin/rozvi/art",{method:"DELETE"});artFeedback.textContent="Imagen quitada. Se usará el diseño predeterminado.";artFeedback.classList.remove("hidden","error");await refreshArt();}catch(err){artFeedback.textContent=err.message;artFeedback.classList.remove("hidden");artFeedback.classList.add("error");}finally{artRemove.disabled=false;}});
    const df=$("#divorzhinha-art-form"),di=$("#divorzhinha-art-file"),dp=$("#divorzhinha-art-preview"),dc=$("#divorzhinha-art-current"),dfb=$("#divorzhinha-art-feedback"),dr=$("#divorzhinha-art-remove");
    const refreshDivArt=async()=>{try{const d=await api("/api/admin/divorzhinha/art",{noMemoryCache:true});dc.textContent=d.configured?"Imagen actual: "+(d.fileName||"Portada")+" · "+(d.size/1024/1024).toFixed(2)+" MB":"No hay imagen personalizada. Se usa el diseño predeterminado.";if(d.configured){dp.src="/api/divorzhinha/home-background?t="+Date.now();dp.classList.remove("hidden");}else{dp.removeAttribute("src");dp.classList.add("hidden");}}catch(err){dc.textContent=err.message;}};
    di.addEventListener("change",()=>{const f=di.files?.[0];if(!f)return;if(f.size>5*1024*1024){dfb.textContent="La imagen supera el límite de 5 MB.";dfb.classList.remove("hidden");dfb.classList.add("error");di.value="";return;}dp.src=URL.createObjectURL(f);dp.classList.remove("hidden");});
    await refreshDivArt();df.addEventListener("submit",async ev=>{ev.preventDefault();const f=di.files?.[0];if(!f)return;const b=df.querySelector('button[type="submit"]');b.disabled=true;try{const fd=new FormData();fd.append("file",f);await api("/api/admin/divorzhinha/art",{method:"POST",body:fd});dfb.textContent="Imagen de DIVORZINHA guardada.";dfb.classList.remove("hidden","error");di.value="";await refreshDivArt();}catch(err){dfb.textContent=err.message;dfb.classList.remove("hidden");dfb.classList.add("error");}finally{b.disabled=false;}});
    dr.addEventListener("click",async()=>{if(!confirm("¿Quitar la imagen personalizada de DIVORZINHA?"))return;dr.disabled=true;try{await api("/api/admin/divorzhinha/art",{method:"DELETE"});dfb.textContent="Imagen quitada.";dfb.classList.remove("hidden","error");await refreshDivArt();}catch(err){dfb.textContent=err.message;dfb.classList.remove("hidden");dfb.classList.add("error");}finally{dr.disabled=false;}});
    const dmf=$("#divorzhinha-music-form"),dmfFile=$("#divorzhinha-music-file"),dmfCurrent=$("#divorzhinha-music-current"),dmfFeedback=$("#divorzhinha-music-feedback");
    const refreshDivMusic=async()=>{try{const d=await api("/api/admin/divorzhinha/music",{noMemoryCache:true});dmfCurrent.textContent=d.configured?"Canción actual: "+(d.fileName||"Audio")+" · "+(d.size/1024/1024).toFixed(2)+" MB":"No hay canción personalizada.";}catch(err){dmfCurrent.textContent=err.message;}};
    await refreshDivMusic();dmf.addEventListener("submit",async ev=>{ev.preventDefault();const f=dmfFile.files?.[0];if(!f)return;const b=dmf.querySelector('button[type="submit"]');b.disabled=true;try{const fd=new FormData();fd.append("file",f);await api("/api/admin/divorzhinha/music",{method:"POST",body:fd});dmfFeedback.textContent="Música de DIVORZINHA guardada.";dmfFeedback.classList.remove("hidden","error");dmfFile.value="";await refreshDivMusic();}catch(err){dmfFeedback.textContent=err.message;dmfFeedback.classList.remove("hidden");dmfFeedback.classList.add("error");}finally{b.disabled=false;}});
    const naf=$("#nikehunt-art-form"),nai=$("#nikehunt-art-file"),nap=$("#nikehunt-art-preview"),nac=$("#nikehunt-art-current"),nafFeedback=$("#nikehunt-art-feedback"),nar=$("#nikehunt-art-remove");
    const refreshNikeArt=async()=>{try{const d=await api("/api/admin/duckhunt/art",{noMemoryCache:true});nac.textContent=d.configured?"Imagen actual: "+(d.fileName||"Portada")+" · "+(d.size/1024/1024).toFixed(2)+" MB":"No hay imagen personalizada.";if(d.configured){nap.src="/api/duckhunt/home-background?t="+Date.now();nap.classList.remove("hidden");}else{nap.removeAttribute("src");nap.classList.add("hidden");}}catch(err){nac.textContent=err.message;}};
    nai.addEventListener("change",()=>{const f=nai.files?.[0];if(!f)return;if(f.size>5*1024*1024){nafFeedback.textContent="La imagen supera el límite de 5 MB.";nafFeedback.classList.remove("hidden");nafFeedback.classList.add("error");nai.value="";return;}nap.src=URL.createObjectURL(f);nap.classList.remove("hidden");});
    await refreshNikeArt();naf.addEventListener("submit",async ev=>{ev.preventDefault();const f=nai.files?.[0];if(!f)return;const btn=naf.querySelector('button[type="submit"]');btn.disabled=true;try{const fd=new FormData();fd.append("file",f);await api("/api/admin/duckhunt/art",{method:"POST",body:fd});nafFeedback.textContent="Imagen de NIKE HUNT guardada.";nafFeedback.classList.remove("hidden","error");nai.value="";await refreshNikeArt();}catch(err){nafFeedback.textContent=err.message;nafFeedback.classList.remove("hidden");nafFeedback.classList.add("error");}finally{btn.disabled=false;}});
    nar.addEventListener("click",async()=>{if(!confirm("¿Quitar la imagen de fondo de NIKE HUNT?"))return;nar.disabled=true;try{await api("/api/admin/duckhunt/art",{method:"DELETE"});nafFeedback.textContent="Imagen quitada.";nafFeedback.classList.remove("hidden","error");await refreshNikeArt();}catch(err){nafFeedback.textContent=err.message;nafFeedback.classList.remove("hidden");nafFeedback.classList.add("error");}finally{nar.disabled=false;}});
    const nmf=$("#nikehunt-music-form"),nmi=$("#nikehunt-music-file"),nmc=$("#nikehunt-music-current"),nmfb=$("#nikehunt-music-feedback");
    const refreshNikeMusic=async()=>{try{const d=await api("/api/admin/duckhunt/music",{noMemoryCache:true});nmc.textContent=d.configured?"Canción actual: "+(d.fileName||"Audio")+" · "+(d.size/1024/1024).toFixed(2)+" MB":"No hay canción personalizada."; }catch(err){nmc.textContent=err.message;}};
    await refreshNikeMusic();nmf.addEventListener("submit",async ev=>{ev.preventDefault();const f=nmi.files?.[0];if(!f)return;const btn=nmf.querySelector('button[type="submit"]');btn.disabled=true;try{const fd=new FormData();fd.append("file",f);await api("/api/admin/duckhunt/music",{method:"POST",body:fd});nmfb.textContent="Música de NIKE HUNT guardada.";nmfb.classList.remove("hidden","error");nmi.value="";await refreshNikeMusic();}catch(err){nmfb.textContent=err.message;nmfb.classList.remove("hidden");nmfb.classList.add("error");}finally{btn.disabled=false;}});
   }else if(key==="messages"){
    await loadAdminSecretMessages();
   }else if(key==="activity"){
    await loadAdminActivity();
   }else if(key==="points"){
    await loadAdminPointsAnalysis();
   }else if(key==="tools"){
    const panel=$("#admin-panel")||document.createElement("section");panel.id="admin-panel";panel.className="admin-panel";$("#admin-tools-slot").append(panel);panel.classList.remove("hidden");await renderAdmin();
   }else if(key==="draw")await loadAdminDrawControls();
   else if(key==="spirit")await loadSpiritAdmin();
   else if(key==="general"){
    const data=await api("/api/admin/status"),e=data.edition||{},form=$("#edition-settings-form"); const selectedTeam=currentUser?.membership?.team_name||""; const homeEditor=$("#onboarding-home-editor"); if(selectedTeam==="Onboarding Digital"&&homeEditor){homeEditor.classList.remove("hidden");const homeData=await api("/api/admin/edition/home",{noMemoryCache:true});const hf=$("#onboarding-home-form");for(const [key,value] of Object.entries(homeData.config||{})){if(hf.elements[key]){if(hf.elements[key].type==="checkbox")hf.elements[key].checked=value!==false;else hf.elements[key].value=value||"";}}hf.addEventListener("submit",async ev=>{ev.preventDefault();const fb=$("#onboarding-home-feedback");try{await api("/api/admin/edition/home",{method:"PATCH",body:JSON.stringify({...Object.fromEntries(new FormData(hf)),...Object.fromEntries([...hf.querySelectorAll('input[type="checkbox"]')].map(el=>[el.name,el.checked]))})});fb.textContent="La plantilla de Inicio se guardó correctamente.";fb.classList.remove("hidden","error");}catch(err){fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}});}
    form.elements.title.value=e.title||"";form.elements.eventDate.value=e.event_date||"";form.elements.budgetAmount.value=e.budget_amount??"";
    
    form.addEventListener("submit",async ev=>{ev.preventDefault();const values=Object.fromEntries(new FormData(form)),fb=$("#edition-settings-feedback");try{await api("/api/admin/edition",{method:"PATCH",body:JSON.stringify(values)});currentUser=await api("/api/me");updateMemberCountdown(currentUser.membership?.event_date);fb.textContent="Los ajustes del intercambio se guardaron correctamente.";fb.classList.remove("hidden","error");}catch(err){fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}});
    const musicForm=$("#global-music-admin-form"),musicFile=$("#global-music-file"),musicFeedback=$("#global-music-feedback"),musicCurrent=$("#global-music-current");
    const refreshMusicStatus=async()=>{try{const m=await api("/api/admin/music",{noMemoryCache:true});musicCurrent.textContent=m.configured?"Música actual: "+(m.fileName||"Archivo de audio")+" · "+(m.size/1024/1024).toFixed(2)+" MB":"Todavía no has configurado una canción."; }catch(err){musicCurrent.textContent=err.message;}};
    await refreshMusicStatus();
    musicForm?.addEventListener("submit",async ev=>{ev.preventDefault();const file=musicFile.files?.[0];if(!file)return;const button=musicForm.querySelector('button[type="submit"]');button.disabled=true;button.textContent="Subiendo a R2…";musicFeedback.classList.add("hidden");try{const data=new FormData();data.append("file",file);await api("/api/admin/music",{method:"POST",body:data});musicFeedback.textContent="Música actualizada. Se aplicará a todos los intercambios.";musicFeedback.classList.remove("hidden","error");const audio=$("#global-background-music");if(audio){audio.pause();audio.src="/api/music/current?v="+Date.now();audio.load();const toggle=$("#global-music-toggle");if(toggle)toggle.disabled=false;const control=$("#global-music-control");control?.classList.remove("music-unavailable");try{await audio.play();}catch{}}await refreshMusicStatus();musicFile.value="";}catch(err){musicFeedback.textContent=err.message;musicFeedback.classList.remove("hidden");musicFeedback.classList.add("error");}finally{button.disabled=false;button.textContent="Guardar música";}});
    const pf=$("#home-photo-form"),pi=$("#home-photo-file"),pv=$("#home-photo-preview"),ps=$("#home-photo-visible"),pm=$("#home-photo-feedback");let photo="";
    try{const d=await api("/api/admin/edition/home",{noMemoryCache:true});photo=d.config?.homePhotoData||"";ps.checked=d.config?.showHomePhoto!==false;if(photo&&ps.checked){pv.src=photo;pv.classList.remove("hidden");}}catch{}
    pi?.addEventListener("change",()=>{const f=pi.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{pv.src=String(rd.result);pv.classList.remove("hidden");};rd.readAsDataURL(f);});
    pf?.addEventListener("submit",async ev=>{ev.preventDefault();const b=pf.querySelector('button[type="submit"]');b.disabled=true;try{const f=pi.files?.[0];if(f){const u=URL.createObjectURL(f);try{const im=await new Promise((ok,no)=>{const x=new Image();x.onload=()=>ok(x);x.onerror=no;x.src=u;});const z=Math.min(1,1400/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.round(im.width*z);c.height=Math.round(im.height*z);c.getContext("2d").drawImage(im,0,0,c.width,c.height);photo=c.toDataURL("image/webp",.78);}finally{URL.revokeObjectURL(u);}}await api("/api/admin/edition/home",{method:"PATCH",body:JSON.stringify({homePhotoData:photo,showHomePhoto:ps.checked})});pm.textContent="Foto guardada correctamente.";pm.classList.remove("hidden","error");if(photo&&ps.checked){pv.src=photo;pv.classList.remove("hidden");}else pv.classList.add("hidden");if(currentUser?.membership?.team_name==="Onboarding Digital")await loadOnboardingHome();else await loadClient360HomePhoto();}catch(e){pm.textContent=e.message;pm.classList.remove("hidden");pm.classList.add("error");}finally{b.disabled=false;}});
    $("#home-photo-remove")?.addEventListener("click",async()=>{try{photo="";pi.value="";ps.checked=false;await api("/api/admin/edition/home",{method:"PATCH",body:JSON.stringify({homePhotoData:"",showHomePhoto:false})});pv.classList.add("hidden");pm.textContent="Foto retirada del Inicio.";pm.classList.remove("hidden","error");if(currentUser?.membership?.team_name==="Onboarding Digital")await loadOnboardingHome();else await loadClient360HomePhoto();}catch(e){pm.textContent=e.message;pm.classList.remove("hidden");pm.classList.add("error");}});

   }
   target.dataset.loaded="1";
  }catch(error){target.innerHTML='<div class="status error">'+esc(error.message)+'</div>';delete target.dataset.loading;return;}
  delete target.dataset.loading;
 };
 home.querySelectorAll("[data-admin-section]").forEach(btn=>btn.addEventListener("click",async()=>{home.querySelectorAll("[data-admin-section]").forEach(x=>x.classList.toggle("active",x===btn));home.querySelectorAll(".admin-settings-section").forEach(x=>x.classList.toggle("hidden",x.id!=="admin-section-"+btn.dataset.adminSection));await loadSection(btn.dataset.adminSection);}));
 await loadSection("general");
}
async function loadAdminSecretMessages(){
 const host=$("#admin-secret-messages-panel");if(!host||!currentUser?.isPrimaryAdmin)return;
 host.innerHTML='<div class="admin-activity-section-heading"><div><h3>Mensajes de amigos secretos</h3><p>Vista privada de administración: puedes consultar quién escribió, a quién y el contenido del mensaje.</p></div><button type="button" class="secondary-action" id="refresh-secret-messages">↻ Actualizar</button></div><p class="muted">Cargando mensajes…</p>';
 const load=async()=>{
  const data=await api("/api/admin/secret-messages",{noMemoryCache:true});
  const rows=data.messages||[];
  const escHtml=value=>esc(String(value??""));
  host.innerHTML='<div class="admin-activity-section-heading"><div><h3>Mensajes enviados</h3><p>'+rows.length+' mensajes recientes · '+escHtml(data.edition?.title||"Edición actual")+'</p></div><button type="button" class="secondary-action" id="refresh-secret-messages">↻ Actualizar</button></div>'+
   (rows.length?'<div class="admin-secret-messages-list">'+rows.map(item=>'<article class="admin-secret-message"><div class="admin-secret-message-top"><span class="admin-secret-message-kind">'+(item.message_type==="clue"?"🎁 Pista":"💬 Chat")+'</span><time>'+escHtml(new Intl.DateTimeFormat('es-PE',{dateStyle:'short',timeStyle:'short',timeZone:'America/Lima'}).format(new Date(String(item.created_at).replace(' ','T')+'Z')))+'</time></div><div class="admin-secret-message-route"><b>'+escHtml(item.sender_name)+'</b><span>→</span><b>'+escHtml(item.recipient_name)+'</b></div><p>'+escHtml(item.message)+'</p><small>Ronda '+escHtml(item.run_number)+'</small></article>').join("")+'</div>':'<div class="participants-empty">Todavía no hay mensajes enviados en esta edición.</div>');
  $("#refresh-secret-messages")?.addEventListener("click",async()=>{try{await load();}catch(error){host.insertAdjacentHTML("beforeend",'<div class="status error">'+escHtml(error.message)+'</div>');}});
 };
 try{await load();}catch(error){host.innerHTML='<div class="status error">'+escHtml(error.message)+'</div><button type="button" class="secondary-action" id="refresh-secret-messages">↻ Reintentar</button>';$("#refresh-secret-messages")?.addEventListener("click",load);}
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

async function compressSpiritPhoto(file){
 if(!file||(!String(file.type||"").startsWith("image/")&&!/\\.(jpe?g|png|webp|heic|heif)$/i.test(file.name||"")))throw new Error("Selecciona una foto válida de tu cámara o galería.");
 if(file.size>20*1024*1024)throw new Error("La foto original supera 20 MB. Elige una imagen más pequeña.");
 const objectUrl=URL.createObjectURL(file);
 let source=null,bitmap=null;
 try{
  if(window.createImageBitmap){try{bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});if(bitmap.width&&bitmap.height)source=bitmap;}catch{}}
  if(!source)source=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("Este navegador no pudo abrir la foto. Guarda una copia como JPG o PNG desde tu galería e inténtalo nuevamente."));img.src=objectUrl;});
  const sw=source.width||source.naturalWidth,sh=source.height||source.naturalHeight;
  if(!sw||!sh)throw new Error("La foto no contiene dimensiones válidas.");
  let blob=null;
  for(const maxSide of [1280,1120,960,820,700]){
   const scale=Math.min(1,maxSide/Math.max(sw,sh)),canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(sw*scale));canvas.height=Math.max(1,Math.round(sh*scale));
   const ctx=canvas.getContext("2d",{alpha:false});if(!ctx)throw new Error("No se pudo preparar la foto en este dispositivo.");
   ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);
   for(const quality of [.78,.66,.54,.42]){
    blob=await new Promise(resolve=>{try{canvas.toBlob(result=>resolve(result||null),"image/jpeg",quality);}catch{resolve(null);}});
    if(!blob){try{const dataUrl=canvas.toDataURL("image/jpeg",quality);blob=await (await fetch(dataUrl)).blob();}catch{blob=null;}}
    if(blob&&blob.size<=205*1024)break;
   }
   if(blob&&blob.size<=205*1024)break;
  }
  if(!blob||blob.size>205*1024)throw new Error("No se pudo reducir esta foto al tamaño permitido. Prueba recortarla desde tu galería e inténtalo nuevamente.");
  const data=await blobToDataUrl(blob);
  if(!data.startsWith("data:image/jpeg;base64,")||data.length>300000)throw new Error("La foto procesada supera el límite permitido. Prueba con una imagen más pequeña.");
  return data;
 }finally{URL.revokeObjectURL(objectUrl);bitmap?.close?.();}
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
  section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Mensajes 💌</h2><p>Conversaciones privadas y anónimas con tu amigo secreto.</p></div><div class="secret-chat-retention">Los mensajes se eliminan automáticamente después de 7 días para mantener el chat ligero.</div><div class="secret-chat-list">'+thread("outgoing","A quien te tocó regalar","TU AMIGO SECRETO",data.outgoing)+thread("incoming","Quien te está sorprendiendo","QUIEN TE REGALA A TI",data.incoming)+'</div><div class="push-settings"><div><b>Notificaciones de Navidad Pyme</b><p>Recibe avisos de mensajes y novedades importantes, incluidas las evidencias Bonus pendientes de aprobación para el administrador.</p></div><button type="button" id="enable-push-notifications" class="secondary-action">🔔 Activar notificaciones</button><div id="push-feedback" class="status hidden" role="status"></div></div>';
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
 app.querySelector(".member-home").innerHTML=`<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Mi equipo</h2><p>Consulta quiénes forman parte del intercambio y administra tu participación.</p></div><article class="member-feature"><span class="profile-settings-avatar">${currentUser.user.avatar_url&&isAvatarSource(currentUser.user.avatar_url)?'<img src="'+esc(avatarUrl(currentUser.user.avatar_url,96))+'" alt="Foto de perfil">':'👤'}</span><div><b>Mi perfil</b><p>${esc([profile.first_name,profile.last_name].filter(Boolean).join(" ")||currentUser.user.email)}</p><p>${esc(currentUser.user.email)}</p></div><button class="profile-action" id="edit-profile">Editar</button></article><section class="profile-music-settings" aria-labelledby="profile-music-title"><div class="profile-music-heading"><span aria-hidden="true">🎵</span><div><h3 id="profile-music-title">Música de fondo</h3><p>Controla la música navideña mientras usas la aplicación.</p></div></div><div class="profile-music-controls"><button type="button" id="profile-music-toggle" class="secondary-action" aria-pressed="false">▶ Activar música</button><label for="profile-music-volume">Volumen <span id="profile-music-volume-value">42%</span></label><input id="profile-music-volume" type="range" min="0" max="100" step="5" value="42"></div></section><section class="home-participants-card profile-participants-card" aria-labelledby="profile-participants-title"><div class="home-participants-heading"><div><span class="exchange-budget-kicker">EL EQUIPO QUE CELEBRA</span><h2 id="profile-participants-title">Lista de participantes <span id="profile-participants-count">(—)</span></h2></div><span class="home-participants-icon">🎄</span></div><div id="profile-participants-list" class="home-participants-list" aria-live="polite"><p class="participants-loading">Cargando participantes…</p></div></section><div class="profile-actions"><button id="withdraw-participation" class="secondary-action">Ya no quiero participar</button><button id="logout-button" class="secondary-action">Cerrar sesión</button></div><div id="profile-action-feedback" class="status hidden"></div>`;
 loadProfileParticipants();
 const musicAudio=$("#global-background-music"),musicToggle=$("#profile-music-toggle"),musicVolume=$("#profile-music-volume"),musicVolumeValue=$("#profile-music-volume-value"),globalToggle=$("#global-music-toggle"),globalVolume=$("#global-music-volume");
 const syncProfileMusic=()=>{if(!musicAudio||!musicToggle)return;const active=!musicAudio.paused&&!musicAudio.ended;musicToggle.textContent=active?"⏸ Desactivar música":"▶ Activar música";musicToggle.setAttribute("aria-pressed",String(active));const vol=Math.round(musicAudio.volume*100);musicVolume.value=String(vol);musicVolumeValue.textContent=vol+"%";};
 musicToggle?.addEventListener("click",async()=>{await window.setNavidadMusicEnabled?.(musicAudio?.paused??true);syncProfileMusic();});
 musicVolume?.addEventListener("input",()=>{const value=Number(musicVolume.value)/100;window.setNavidadMusicVolume?.(value);musicVolumeValue.textContent=Math.round(value*100)+"%";});
 if(musicAudio){["play","pause","ended","volumechange"].forEach(event=>musicAudio.addEventListener(event,syncProfileMusic));}
 syncProfileMusic();
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
 let updateCheckRunning=false;
 const reloadForUpdatedWorker=()=>{
  if(refreshing)return;
  refreshing=true;
  location.reload();
 };
 navigator.serviceWorker.addEventListener("controllerchange",reloadForUpdatedWorker);
 const checkForAppUpdate=async(registration)=>{
  if(updateCheckRunning||!navigator.onLine)return;
  updateCheckRunning=true;
  try{await registration.update();}
  catch(error){console.warn("No se pudo comprobar la actualización de Navidad Pyme:",error);}
  finally{updateCheckRunning=false;}
 };
 window.addEventListener("load",async()=>{
  try{
   const registration=await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});
   await checkForAppUpdate(registration);
   // Revisa periódicamente mientras la aplicación permanece abierta.
   window.setInterval(()=>checkForAppUpdate(registration),30000);
   window.addEventListener("focus",()=>checkForAppUpdate(registration));
   document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible")checkForAppUpdate(registration);
   });
   window.addEventListener("online",()=>checkForAppUpdate(registration));
  }catch(error){console.warn("No se pudo iniciar la actualización automática de Navidad Pyme:",error);}
 });
}


/* v2.5.0 · Rozvi Pixel Arcade · dificultad progresiva y pausa */
function initRozviGame(){const b=document.getElementById("rozvi-open-game");if(b&&!b.dataset.ready){b.dataset.ready="1";b.addEventListener("click",openRozviGame);}}
async function openRozviGame(){
 if(document.getElementById("rozvi-game-modal")||openRozviGame.loading)return;
 openRozviGame.loading=true;const launchButton=document.getElementById("rozvi-open-game");if(launchButton){launchButton.disabled=true;launchButton.setAttribute("aria-busy","true");launchButton.dataset.originalLabel=launchButton.innerHTML;launchButton.innerHTML="Cargando juego…";}
 let gameConfig={lives:5,beerPoints:1,waterPenalty:2,musicConfigured:false,livesRemaining:5};try{const settings=await api("/api/rozvi/settings",{noMemoryCache:true,timeoutMs:7000});const resetKey="rozvi_personal_lives_reset_20261123_v3_"+String(currentUser?.user?.id||"");if(currentUser?.isPrimaryAdmin&&!localStorage.getItem(resetKey)){await api("/api/rozvi/lives",{method:"POST",body:JSON.stringify({action:"admin-reset-lives"}),noMemoryCache:true,timeoutMs:7000});localStorage.setItem(resetKey,"1");}const daily=await api("/api/rozvi/lives",{noMemoryCache:true,timeoutMs:7000});gameConfig={...gameConfig,...settings,livesRemaining:Number(daily.livesRemaining??settings.lives??3)};}catch(error){openRozviGame.loading=false;if(launchButton){launchButton.disabled=false;launchButton.removeAttribute("aria-busy");launchButton.innerHTML=launchButton.dataset.originalLabel||"Jugar ahora";}alert("No se pudo cargar el juego. Comprueba tu conexión e inténtalo nuevamente.");return;}
 const m=document.createElement("section");m.id="rozvi-game-modal";m.className="rozvi-game-modal";
 m.innerHTML='<div class="rozvi-game-shell" role="dialog" aria-modal="true" aria-label="¡Vamos Rozvi!"><header class="rozvi-game-top"><div class="rozvi-game-brand"><span class="rozvi-pixel-mark">★</span><div><span class="rozvi-overline">NAVIDAD PYME ARCADE</span><h2>¡VAMOS ROZVI!</h2></div></div><button class="rozvi-close" aria-label="Cerrar">×</button></header><div class="rozvi-game-stage"><div class="rozvi-stage-topline"><span>❄ OPERACIÓN: LLUVIA DE PILSEN</span></div><div class="rozvi-hud"><div class="rozvi-hud-score"><small>PUNTOS</small><strong id="rozvi-score">000</strong></div><div class="rozvi-hud-time rozvi-lives-hud"><span>VIDAS</span><strong id="rozvi-lives" aria-label="Vidas disponibles">❤️❤️❤️</strong></div><button id="rozvi-pause" class="rozvi-pause" type="button" disabled>Ⅱ PAUSAR</button></div><div class="rozvi-canvas-frame"><canvas id="rozvi-canvas" width="960" height="540" aria-label="Juego pixel art: atrapa botellas de Pilsen y evita el agua mineral"></canvas><div class="rozvi-stage-overlay" id="rozvi-overlay"><div class="rozvi-overlay-card is-intro"><span class="rozvi-overlay-eyebrow">✦ MISIÓN NAVIDEÑA ✦</span><h3>RECOLECTA LAS PILSEN</h3><p>Recolecta las Pilsen, evita el agua mineral y las bombas.</p><div class="rozvi-overlay-actions"><button id="rozvi-start" class="rozvi-start">▶ COMENZAR PARTIDA</button><button id="rozvi-exit" class="rozvi-exit" hidden>✕ SALIR</button></div><div class="rozvi-score-feedback" role="status"></div></div></div></div><div class="rozvi-game-instructions"><span><b>TOCA IZQ./DER.</b> MOVER</span><span><b>DESLIZA ↑</b> SALTAR</span><span><b>PILSEN +1</b></span><span><b>AGUA −2</b></span></div></div><section class="rozvi-leaderboard rozvi-leaderboard-bottom"><h4>🏆 TOP 5 · MEJORES PUNTAJES</h4><ol id="rozvi-leaderboard-list"><li>Cargando ranking…</li></ol></section><footer class="rozvi-game-footer"><span>✦ ATRAPA TODO LO QUE PUEDAS</span><span>LOS PUNTOS DE PILSEN SE SUMAN A ESPÍRITU</span></footer></div>';
 document.body.append(m);openRozviGame.loading=false;
 m.addEventListener("selectstart",e=>e.preventDefault());m.addEventListener("contextmenu",e=>e.preventDefault());m.addEventListener("dblclick",e=>{e.preventDefault();e.stopPropagation();});
 m.querySelector(".rozvi-game-instructions span:nth-child(3) b").textContent="PILSEN +"+Number(gameConfig.beerPoints??1);m.querySelector(".rozvi-game-instructions span:nth-child(4) b").textContent="AGUA −"+Number(gameConfig.waterPenalty??2);m.querySelector(".rozvi-game-footer span:first-child").textContent="✦ SUPERVIVENCIA · USA TUS VIDAS";
 const c=m.querySelector("canvas"),x=c.getContext("2d"),gameAudio=new Audio("/api/rozvi/music/current?v="+Date.now()),overlayCard=m.querySelector(".rozvi-overlay-card"),scoreEl=m.querySelector("#rozvi-score"),livesEl=m.querySelector("#rozvi-lives"),overlay=m.querySelector("#rozvi-overlay"),startBtn=m.querySelector("#rozvi-start"),exitBtn=m.querySelector("#rozvi-exit"),pauseBtn=m.querySelector("#rozvi-pause"),W=960,H=540,floor=466,keys={left:false,right:false};
 gameAudio.loop=true;gameAudio.preload="auto";const touchPointers=new Map();function clearTouchInputs(){touchPointers.clear();keys.left=false;keys.right=false;}let active=false,paused=false,dead=false,score=0,beerCaught=0,maxLives=Math.max(1,Number(gameConfig.lives)||3),lives=Math.min(maxLives,Math.max(0,Number(gameConfig.livesRemaining??maxLives))),last=0,elapsed=0,spawn=0,raf=0,items=[],snow=[],p={x:480,y:392,vy:0,ground:true,walk:0};
 const rnd=(a,b)=>a+Math.random()*(b-a),rect=(a,b,w,h,col)=>{x.fillStyle=col;x.fillRect(Math.round(a),Math.round(b),Math.round(w),Math.round(h));};
 function scenery(dt){
 // Escenario retro de posada navideña, dibujado a baja resolución y ampliado sin suavizado.
 if(!scenery.bg){const bg=document.createElement("canvas");bg.width=240;bg.height=135;const q=bg.getContext("2d");q.imageSmoothingEnabled=false;const R=(a,b,w,h,col)=>{q.fillStyle=col;q.fillRect(a,b,w,h);};
 R(0,0,240,135,"#302b4b");R(0,0,240,8,"#9d5545");R(0,8,240,3,"#d88a60");R(0,11,240,57,"#70453f");
 // ventanales nevados y cielo nocturno
 R(5,14,83,44,"#3c6680");R(9,18,75,36,"#9ccbd0");R(9,18,75,8,"#567e9b");R(9,37,75,17,"#dce8dc");R(12,39,18,9,"#f4e7c9");R(35,36,22,18,"#718c91");R(61,40,18,12,"#dce4d2");R(45,14,3,44,"#6e3e35");R(5,35,83,3,"#6e3e35");R(7,56,80,4,"#e9c18c");
 // tejados, abetos y nieve exterior
 R(12,29,18,3,"#3e5364");R(15,25,12,4,"#536d7c");R(65,27,16,4,"#536d7c");R(68,23,10,4,"#6b7f87");R(16,50,5,2,"#fff3d7");R(55,49,8,2,"#fff3d7");
 // pared de madera, vigas y lámparas
 R(91,11,149,57,"#995a43");R(91,11,149,4,"#d18a5a");R(92,12,3,56,"#5a3438");R(151,12,4,56,"#633b3b");R(194,12,3,56,"#633b3b");
 R(103,0,3,16,"#432b36");R(102,14,8,2,"#54313a");R(103,16,6,11,"#f6c56e");R(101,18,10,7,"#ffe6a4");R(103,27,6,2,"#54313a");
 R(169,0,3,16,"#432b36");R(168,14,8,2,"#54313a");R(169,16,6,11,"#f6c56e");R(167,18,10,7,"#ffe6a4");R(169,27,6,2,"#54313a");
 // estantería de botellas y tarros
 R(199,14,37,43,"#5b3534");R(199,14,37,3,"#c17a4b");R(199,30,37,3,"#c17a4b");R(199,46,37,3,"#c17a4b");
 for(let i=0;i<5;i++){const xx=202+i*6;R(xx,18,3,9,i%2?"#2b7551":"#426b91");R(xx,16,3,3,"#d6bd8a");R(xx,21,3,2,"#e3c36e");R(xx,34,3,9,i%2?"#b34d3d":"#3b7759");R(xx,32,3,3,"#d6bd8a");R(xx,37,3,2,"#e3c36e");}
 // guirnalda con luces
 R(91,10,149,2,"#315c49");for(let i=0;i<12;i++){R(96+i*12,12+(i%2)*2,2,2,i%3===0?"#f6d06e":i%3===1?"#e98b67":"#9ed5a5");}
 // barra de madera, mostrador y taburetes
 R(0,69,240,7,"#d28a56");R(0,76,240,3,"#6b3d3b");R(0,79,240,30,"#9b5841");for(let i=0;i<12;i++){R(i*22,80,2,28,"#713d38");R(i*22+3,83,14,2,"#bd7550");}
 R(0,108,240,5,"#5c3b3a");R(0,113,240,22,"#b77a55");for(let i=0;i<15;i++){R(i*17,115,2,20,"#8d5544");R(i*17+4,119,9,2,"#d39a69");}
 // árbol decorado y regalos a la izquierda
 R(16,65,3,5,"#704638");R(12,59,11,8,"#17614a");R(14,54,7,7,"#247452");R(16,50,3,6,"#36835a");R(17,48,2,3,"#f3d477");R(10,66,4,3,"#b44a46");R(22,67,4,3,"#d7b65e");
 // mesas, jarras y platos
 R(117,67,55,3,"#d99b63");R(122,70,4,9,"#65403a");R(163,70,4,9,"#65403a");R(128,62,8,5,"#e7d5ad");R(130,60,4,2,"#d7a65d");R(145,63,7,4,"#f0dfbf");R(147,61,3,2,"#c1d9d5");
 // nieve y luces de ambiente
 for(let i=0;i<32;i++){const xx=(i*37+13)%240,yy=(i*19+7)%54;if(xx<88)R(xx,yy,1,1,"#fff6dc");}
 scenery.bg=bg;
 }
 x.imageSmoothingEnabled=false;x.clearRect(0,0,W,H);x.drawImage(scenery.bg,0,0,W,H);
 // pixel snowflakes drifting in front of the tavern windows
 snow.forEach(s=>{s.y+=s.v*dt;if(s.y>H){s.y=-4;s.x=rnd(0,W);}const z=Math.max(3,Math.round(s.z*2/4)*4);rect(Math.round(s.x/4)*4,Math.round(s.y/4)*4,z,z,"#fff3d4");});
 // wooden floorboards
 rect(0,432,W,4,"#593b3a");for(let i=0;i<12;i++){rect(i*84,436,3,104,"#8c5747");rect(i*84+7,464,54,3,"#d49a6c");}
 rect(0,524,W,16,"#553b3a");rect(0,524,W,4,"#d9a36f");
 // falling collectible bottles, rendered with hard pixel edges
 items.forEach(b=>{x.save();x.translate(Math.round(b.x/4)*4,Math.round(b.y/4)*4);if(b.type==="bomb"){rect(-8,-34,16,28,"#20242a");rect(-12,-30,24,20,"#343a40");rect(-4,-42,8,8,"#b8a078");rect(0,-48,12,4,"#e8b95d");rect(8,-52,4,4,"#f5df91");rect(-4,-26,8,8,"#15191e");}else if(b.type==="beer"){
 rect(-8,-36,16,8,"#a77937");rect(-4,-48,8,12,"#d5b65d");rect(-12,-32,24,36,"#075b36");rect(-12,-24,24,4,"#2c9654");rect(-12,-12,24,12,"#d9b45c");rect(-8,-8,16,4,"#fff0c5");rect(-4,-20,8,4,"#f1d48a");
 }else{rect(-4,-48,8,8,"#e8f6ef");rect(-8,-40,16,8,"#9acbd4");rect(-12,-32,24,36,"#c5e9e9");rect(-8,-28,16,28,"#78b9ca");rect(-12,-12,24,12,"#f3f5e8");rect(-8,-8,16,4,"#4a9db0");}x.restore();});
 // Rozvi, as a larger 16-bit pixel character with crate held in front
 const bob=p.ground?Math.sin(p.walk)*2:0;x.save();x.translate(Math.round(p.x/4)*4,Math.round((p.y+bob)/4)*4);
 // ground shadow
 rect(-36,68,72,8,"#4a333c");rect(-28,68,56,4,"#765147");
 // white sneakers with sole highlights
 rect(-28,48,20,20,"#17294a");rect(8,48,20,20,"#17294a");rect(-36,64,32,12,"#f4f1df");rect(4,64,32,12,"#f4f1df");rect(-36,72,32,4,"#b8c8d0");rect(4,72,32,4,"#b8c8d0");rect(-32,64,24,4,"#fff");
 // navy trousers and blue jacket
 rect(-28,28,24,24,"#17294a");rect(4,28,24,24,"#17294a");rect(-24,32,16,16,"#233e69");rect(8,32,16,16,"#233e69");
 rect(-32,-12,64,48,"#2468a9");rect(-36,-8,8,32,"#2468a9");rect(28,-8,8,32,"#2468a9");rect(-28,-8,56,8,"#3988c6");rect(-8,-8,16,44,"#174e86");rect(-28,28,56,8,"#1a4b7b");
 // warm tan hands holding the red beer crate
 rect(-40,0,12,24,"#b97952");rect(28,0,12,24,"#b97952");rect(-44,16,12,8,"#d29366");rect(32,16,12,8,"#d29366");
 rect(-36,8,72,28,"#9d2631");rect(-32,12,64,8,"#d84c48");rect(-32,20,64,12,"#e8c982");rect(-28,24,56,4,"#fff0c5");rect(-36,36,72,8,"#6d1e2b");rect(-28,16,8,4,"#f5d98e");rect(20,16,8,4,"#f5d98e");
 // face, ears, black hair and festive beanie
 rect(-24,-52,48,40,"#c4875d");rect(-28,-44,8,24,"#a96849");rect(20,-44,8,24,"#a96849");rect(-16,-36,8,8,"#18242c");rect(8,-36,8,8,"#18242c");rect(-8,-20,16,4,"#81453d");
 rect(-28,-60,56,12,"#101820");rect(-24,-72,48,16,"#101820");rect(-16,-80,32,12,"#101820");rect(-24,-76,48,12,"#101820");rect(-16,-84,32,12,"#101820");rect(-8,-88,16,8,"#101820");
 x.restore();
 // pixel-style arcade sign
 rect(16,16,264,40,"#302d43");rect(20,20,256,32,"#70453f");rect(24,24,248,24,"#263d50");x.fillStyle="#f9e4a7";x.font="bold 16px monospace";x.textBaseline="middle";x.fillText("ROZVI'S WINTER INN",36,36);
 } function addItem(){const bombChance=Math.min(.42,.025+elapsed*.0025);const roll=Math.random();const type=roll<bombChance?"bomb":roll<bombChance+.70?"beer":"water";items.push({type,x:rnd(35,W-35),y:-42,baseV:type==="bomb"?185:type==="beer"?145:155,phase:rnd(0,6)});}
 function reset(){scoreSubmitted=false;beerCaught=0;score=0;elapsed=0;spawn=0;items=[];paused=false;active=false;dead=false;overlayCard.className="rozvi-overlay-card is-intro";p={x:480,y:392,vy:0,ground:true,walk:0};scoreEl.textContent="000";paintLives();pauseBtn.disabled=true;pauseBtn.textContent="Ⅱ PAUSAR";overlay.hidden=false;overlay.querySelector(".rozvi-overlay-eyebrow").textContent="✦ MISIÓN NAVIDEÑA ✦";overlay.querySelector("h3").textContent="RECOLECTA LAS PILSEN";overlay.querySelector("p").textContent="Recolecta las Pilsen, evita el agua mineral y las bombas.";startBtn.textContent="▶ COMENZAR PARTIDA";startBtn.disabled=lives<=0;exitBtn.hidden=true;snow=Array.from({length:95},()=>({x:rnd(0,W),y:rnd(0,H),z:rnd(1,3),v:rnd(20,85),a:rnd(.3,.9)}));for(let i=0;i<4;i++)addItem();}
 let scoreSubmitted=false;async function submitGameScore(){if(scoreSubmitted)return;scoreSubmitted=true;try{const result=await api("/api/rozvi/score",{method:"POST",body:JSON.stringify({score,beers:beerCaught,spiritPoints:Math.max(0,score)})});renderRozviLeaderboard(result.ranking||[]);m.querySelector(".rozvi-score-feedback").textContent="RECOLECTASTE "+beerCaught+" PILSEN · +"+Number(result.awardedPoints||0)+" PUNTOS A ESPÍRITU";}catch(error){scoreSubmitted=false;m.querySelector(".rozvi-score-feedback").textContent="No se pudo guardar el puntaje. Comprueba tu conexión.";}}function finish(){gameAudio.pause();gameAudio.currentTime=0;overlayCard.className="rozvi-overlay-card is-result";active=false;paused=false;dead=true;clearTouchInputs();cancelAnimationFrame(raf);pauseBtn.disabled=true;pauseBtn.textContent="Ⅱ PAUSAR";overlay.hidden=false;overlay.querySelector(".rozvi-overlay-eyebrow").textContent="✦ PARTIDA TERMINADA ✦";overlay.querySelector("h3").textContent="PILSEN RECOLECTADAS";overlay.querySelector("p").textContent=String(beerCaught).padStart(3,"0")+" · PUNTAJE "+score;startBtn.textContent=lives>0?"↻ JUGAR OTRA VEZ":"VIDAS AGOTADAS";startBtn.disabled=lives<=0;exitBtn.hidden=false;void submitGameScore();}
 function renderRozviLeaderboard(rows){const list=m.querySelector("#rozvi-leaderboard-list");if(!list)return;list.replaceChildren();if(!rows.length){const li=document.createElement("li");li.textContent="Aún no hay puntajes registrados.";list.append(li);return;}rows.forEach((row,i)=>{const li=document.createElement("li"),name=document.createElement("span"),points=document.createElement("b");name.textContent=(i+1)+". "+(row.display_name||"Participante");points.textContent=Number(row.best_score||0)+" pts";li.append(name,points);list.append(li);});} function paintLives(){if(livesEl)livesEl.textContent="❤️".repeat(Math.max(0,lives))+"🖤".repeat(Math.max(0,maxLives-lives));}
 function loseLife(){if(dead||!active)return;dead=true;active=false;clearTouchInputs();gameAudio.pause();cancelAnimationFrame(raf);lives=Math.max(0,lives-1);paintLives();void submitGameScore();if(lives<=0){finish();}else{overlayCard.className="rozvi-overlay-card is-paused";overlay.hidden=false;overlay.querySelector(".rozvi-overlay-eyebrow").textContent="💥 ¡BOMBA!";overlay.querySelector("h3").textContent="¡PERDISTE UNA VIDA!";overlay.querySelector("p").textContent="Te quedan "+lives+" vidas. Continúa la partida.";startBtn.disabled=false;startBtn.textContent="▶ CONTINUAR";exitBtn.hidden=false;pauseBtn.disabled=true;}api("/api/rozvi/lives",{method:"POST",body:JSON.stringify({action:"lose-life"})}).then(result=>{lives=Number(result.livesRemaining??lives);paintLives();if(lives<=0&&dead){startBtn.disabled=true;startBtn.textContent="VIDAS AGOTADAS";}}).catch(error=>console.warn("No se pudo sincronizar la vida:",error));}
 function update(dt){elapsed+=dt;let d=(keys.right?1:0)-(keys.left?1:0);p.x=Math.max(28,Math.min(W-28,p.x+d*350*dt));if(d)p.walk+=dt*13;if(!p.ground){p.vy+=1050*dt;p.y+=p.vy*dt;if(p.y>=392){p.y=392;p.vy=0;p.ground=true;}}spawn+=dt;const difficulty=Math.min(3.4,1+elapsed*.022);const interval=Math.max(.19,.82/difficulty);if(spawn>interval){spawn=0;addItem();if(elapsed>30&&Math.random()<Math.min(.55,elapsed*.007))addItem();}items.forEach(b=>{b.y+=b.baseV*difficulty*dt;b.x+=Math.sin(elapsed*2+b.phase)*18*dt;});for(const b of items){if(Math.abs(b.x-p.x)<38&&b.y>p.y-12&&b.y<p.y+70){if(b.type==="bomb"){void loseLife();return;}if(!b.caught){if(b.type==="beer"){score+=Number(gameConfig.beerPoints??1);beerCaught++;}else score=Math.max(0,score-Number(gameConfig.waterPenalty??2));scoreEl.textContent=String(score).padStart(3,"0");b.caught=true;}}}items=items.filter(b=>!b.caught&&b.y<H+45);}
 function tick(now){if(!active||paused)return;const dt=Math.min(.033,(now-last)/1000||.016);last=now;update(dt);scenery(dt);if(active)raf=requestAnimationFrame(tick);}
 function begin(){if(active||lives<=0)return;overlayCard.className="rozvi-overlay-card";if(dead){dead=false;scoreSubmitted=false;beerCaught=0;score=0;scoreEl.textContent="000";elapsed=0;spawn=0;items=[];for(let i=0;i<4;i++)addItem();p={x:480,y:392,vy:0,ground:true,walk:0};}else reset();overlay.hidden=true;active=true;pauseBtn.disabled=false;last=performance.now();if(gameConfig.musicConfigured)gameAudio.play().catch(()=>{});raf=requestAnimationFrame(tick);}
 function togglePause(){if(!active&&!paused)return;paused=!paused;clearTouchInputs();if(paused){gameAudio.pause();overlayCard.className="rozvi-overlay-card is-paused";cancelAnimationFrame(raf);pauseBtn.textContent="▶ CONTINUAR";overlay.hidden=false;overlay.querySelector(".rozvi-overlay-eyebrow").textContent="✦ PARTIDA EN PAUSA ✦";overlay.querySelector("h3").textContent="JUEGO EN PAUSA";overlay.querySelector("p").textContent="Tu partida está en pausa.";startBtn.textContent="▶ REANUDAR";exitBtn.hidden=false;}else{overlay.hidden=true;pauseBtn.textContent="Ⅱ PAUSAR";last=performance.now();if(gameConfig.musicConfigured)gameAudio.play().catch(()=>{});raf=requestAnimationFrame(tick);}}
 function jump(){if(active&&!paused&&p.ground){p.vy=-510;p.ground=false;}}
 function refreshTouchDirection(){keys.left=[...touchPointers.values()].some(v=>v.side==="left");keys.right=[...touchPointers.values()].some(v=>v.side==="right");}function touchPosition(e){const r=c.getBoundingClientRect();return (e.clientX-r.left)/r.width*W;}function touchStart(e){if(e.pointerType==="mouse"||!active||paused)return;e.preventDefault();const side=touchPosition(e)<W/2?"left":"right";touchPointers.set(e.pointerId,{side,startY:e.clientY,jumped:false});refreshTouchDirection();try{c.setPointerCapture(e.pointerId);}catch{}}function touchMove(e){const state=touchPointers.get(e.pointerId);if(!state)return;e.preventDefault();state.side=touchPosition(e)<W/2?"left":"right";if(!state.jumped&&state.startY-e.clientY>36){state.jumped=true;jump();}refreshTouchDirection();}function touchEnd(e){if(!touchPointers.has(e.pointerId))return;e.preventDefault();touchPointers.delete(e.pointerId);refreshTouchDirection();}c.addEventListener("pointerdown",touchStart,{passive:false});c.addEventListener("pointermove",touchMove,{passive:false});["pointerup","pointercancel","lostpointercapture"].forEach(type=>c.addEventListener(type,touchEnd,{passive:false}));pauseBtn.addEventListener("click",togglePause);
 const kd=e=>{if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")keys.left=true;if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")keys.right=true;if(e.code==="Space"||e.key==="ArrowUp"){e.preventDefault();jump();}},ku=e=>{if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")keys.left=false;if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")keys.right=false;};
 function close(){const abandoned=active&&!dead;active=false;paused=false;gameAudio.pause();gameAudio.currentTime=0;cancelAnimationFrame(raf);if(abandoned){api("/api/rozvi/lives",{method:"POST",body:JSON.stringify({action:"lose-life"})}).catch(()=>{});void submitGameScore();}window.removeEventListener("keydown",kd);window.removeEventListener("keyup",ku);m.remove();openRozviGame.loading=false;if(launchButton){launchButton.disabled=false;launchButton.removeAttribute("aria-busy");launchButton.innerHTML=launchButton.dataset.originalLabel||"Jugar ahora";}}
 window.addEventListener("keydown",kd);window.addEventListener("keyup",ku);m.querySelector(".rozvi-close").addEventListener("click",close);m.addEventListener("click",e=>{if(e.target===m)close();});let lastStartActivation=0;function activateStart(){const now=performance.now();if(now-lastStartActivation<350)return;lastStartActivation=now;if(paused){togglePause();return;}begin();}startBtn.addEventListener("pointerup",e=>{if(e.pointerType==="touch"||e.pointerType==="pen"||e.pointerType==="mouse"){e.preventDefault();activateStart();}},{passive:false});startBtn.addEventListener("click",activateStart);exitBtn.addEventListener("click",close);try{paintLives();reset();c.width=W;c.height=H;x.imageSmoothingEnabled=false;scenery(0);requestAnimationFrame(()=>{if(c.isConnected){c.width=W;c.height=H;x.imageSmoothingEnabled=false;scenery(0);}});}catch(error){console.error("No se pudo pintar el escenario de ¡Vamos Rozvi!:",error);overlay.querySelector("h3").textContent="NO SE PUDO DIBUJAR EL JUEGO";overlay.querySelector("p").textContent="Recarga la aplicación para volver a intentarlo.";}api("/api/rozvi/leaderboard",{noMemoryCache:true}).then(d=>renderRozviLeaderboard(d.ranking||[])).catch(()=>renderRozviLeaderboard([]));
}


/* v2.9.2 · DIVORZINHA · penal arcade exclusivo del administrador */
async function loadDivorzhinhaHomeArt(){const el=document.querySelector(".divorzhinha-announcement");if(!el)return;try{const r=await fetch("/api/divorzhinha/home-background?t="+Date.now(),{cache:"no-store"});if(!r.ok)return;const imageUrl=URL.createObjectURL(await r.blob());el.style.backgroundImage="linear-gradient(90deg,rgba(12,37,31,.96),rgba(12,37,31,.78) 62%,rgba(12,37,31,.48)),url('"+imageUrl+"')";el.style.backgroundSize="cover";el.style.backgroundPosition="center";}catch(error){console.warn("No se pudo cargar la imagen de DIVORZINHA",error);}}
async function loadNikeHuntHomeArt(){const el=document.querySelector(".nikehunt-announcement");if(!el)return;const imageUrl="/api/duckhunt/home-background?v=2.11.28";try{const probe=new Image();probe.onload=()=>{el.style.backgroundImage="linear-gradient(90deg,rgba(5,20,29,.82),rgba(5,20,29,.48)),url('"+imageUrl+"')";el.style.backgroundSize="cover";el.style.backgroundPosition="center";};probe.onerror=()=>console.warn("La portada de NIKE HUNT no está disponible para este participante.");probe.src=imageUrl;}catch(error){console.warn("No se pudo cargar la imagen de NIKE HUNT",error);}}

/* NIKE HUNT · 8-bit Christmas Arcade */
function initDuckHuntGame(){const b=document.getElementById("duckhunt-open-game");if(b&&!b.dataset.ready){b.dataset.ready="1";b.addEventListener("click",openDuckHuntGame);}}
async function openDuckHuntGame(){
 if(currentUser?.membership?.team_name!=="Cliente 360"||document.getElementById("duckhunt-modal")||openDuckHuntGame.loading)return;
 openDuckHuntGame.loading=true;
 const launch=document.getElementById("duckhunt-open-game"),launchLabel=launch?.innerHTML||"Jugar ahora →";
 if(launch){launch.disabled=true;launch.innerHTML="CARGANDO…";}
 const restoreLaunch=()=>{openDuckHuntGame.loading=false;if(launch?.isConnected){launch.disabled=false;launch.innerHTML=launchLabel;}};
 let state;
 try{state=await api("/api/duckhunt/state",{noMemoryCache:true,timeoutMs:8000});}
 catch(e){restoreLaunch();alert(e.message||"No se pudo cargar NIKE HUNT.");return;}
 const modal=document.createElement("section");modal.id="duckhunt-modal";modal.className="duckhunt-modal";
 modal.innerHTML='<div class="duckhunt-shell" role="dialog" aria-modal="true" aria-label="NIKE HUNT"><header class="duckhunt-head"><div><small>NAVIDAD PYME ARCADE · 8-BIT</small><h2>NIKE HUNT <span>🖤</span></h2></div><button type="button" class="duckhunt-close" aria-label="Cerrar">×</button></header><div class="duckhunt-hud"><div><small>NIKES CAZADOS</small><b id="duckhunt-score">0000</b></div><div><small>VIDAS</small><b id="duckhunt-lives">5</b></div><div><small>MUNICIÓN</small><b id="duckhunt-ammo"><span class="nikehunt-bullet"></span><span class="nikehunt-bullet"></span><span class="nikehunt-bullet"></span></b></div><div><small>RÉCORD</small><b id="duckhunt-best">0</b></div></div><div class="duckhunt-screen"><canvas id="duckhunt-canvas" width="960" height="540" aria-label="Toca directamente a los NIKES para disparar"></canvas><div class="duckhunt-overlay" id="duckhunt-overlay"><div><small id="duckhunt-kicker">✦ TEMPORADA DE CAZA NAVIDEÑA ✦</small><h3 id="duckhunt-title">¡CAZA LOS NIKES!</h3><p id="duckhunt-copy">Toca directamente a los NIKES para disparar. Tienes 3 balas por recarga. Cada 10 NIKES cazados duplican su velocidad. ¡Evita que escapen 10!</p><button id="duckhunt-start" type="button">▶ COMENZAR</button><button id="duckhunt-exit" type="button">SALIR</button></div></div></div><div class="duckhunt-foot"><span>🖤 CADA NIKE = +1 ESPÍRITU</span><span>🔫 3 BALAS POR RECARGA</span><span id="duckhunt-escaped">NIKES ESCAPADOS 0/10</span></div><p class="duckhunt-feedback" id="duckhunt-feedback">TOCA UN NIKE PARA DISPARAR</p><section class="duckhunt-ranking"><b>🏆 TOP 5 · CAZADORES</b><ol id="duckhunt-ranking-list"><li>Cargando…</li></ol></section></div>';
 const best=Number(state.stats?.best_score||0),unlimited=state.unlimitedLives===true;
 modal.querySelector("#duckhunt-best").textContent=String(best);
 modal.querySelector("#duckhunt-lives").textContent=unlimited?"∞":String(state.livesRemaining??0);
 modal.querySelector("#duckhunt-copy").textContent=unlimited?"Toca directamente a los NIKES. Cada 10 NIKES cazados duplican su velocidad. Como administrador tienes vidas ilimitadas. La partida termina cuando escapan 10.":"Toca directamente a los NIKES. Tienes 3 balas por recarga y 5 vidas diarias. Cada 10 NIKES cazados duplican su velocidad. La partida termina cuando escapan 10.";
 document.body.append(modal);restoreLaunch();
 const canvas=modal.querySelector("#duckhunt-canvas"),ctx=canvas.getContext("2d"),overlay=modal.querySelector("#duckhunt-overlay"),scoreEl=modal.querySelector("#duckhunt-score"),ammoEl=modal.querySelector("#duckhunt-ammo"),livesEl=modal.querySelector("#duckhunt-lives"),feedback=modal.querySelector("#duckhunt-feedback");
 ctx.setTransform(2,0,0,2,0,0);
 const gameAudio=new Audio("/api/duckhunt/music/current?v="+Date.now());gameAudio.loop=true;gameAudio.volume=.5;gameAudio.addEventListener("error",()=>gameAudio.removeAttribute("src"));modal.append(gameAudio);
 let score=0,ducksShot=0,ammo=3,active=false,ended=false,raf=0,last=0,spawn=0,ducks=[],shots=[],explosions=[],escaped=0,speedTier=0,elapsed=0,planeNext=9,gameId=crypto.randomUUID().replace(/-/g,""),lifeConsumed=false,reloadTimer=0,audioCtx=null;
 const rnd=(a,b)=>a+Math.random()*(b-a);
 function playArcadeSound(kind){
  try{
   const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
   audioCtx=audioCtx||new AC();if(audioCtx.state==="suspended")void audioCtx.resume();
   const t=audioCtx.currentTime,g=audioCtx.createGain(),osc=audioCtx.createOscillator(),filter=audioCtx.createBiquadFilter();
   filter.type=kind==="shot"?"lowpass":"bandpass";filter.frequency.setValueAtTime(kind==="shot"?1100:1500,t);
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(kind==="shot"?.24:.16,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+(kind==="shot"?.16:.24));
   osc.connect(filter);filter.connect(g);g.connect(audioCtx.destination);
   if(kind==="shot"){osc.type="sawtooth";osc.frequency.setValueAtTime(180,t);osc.frequency.exponentialRampToValueAtTime(42,t+.14);}
   else{osc.type="triangle";osc.frequency.setValueAtTime(850,t);osc.frequency.exponentialRampToValueAtTime(390,t+.12);osc.frequency.exponentialRampToValueAtTime(260,t+.23);filter.frequency.exponentialRampToValueAtTime(650,t+.22);}
   osc.start(t);osc.stop(t+(kind==="shot"?.17:.25));
   if(kind==="shot"){const length=Math.floor(audioCtx.sampleRate*.07),buffer=audioCtx.createBuffer(1,length,audioCtx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);const noise=audioCtx.createBufferSource(),ng=audioCtx.createGain();noise.buffer=buffer;ng.gain.setValueAtTime(.18,t);ng.gain.exponentialRampToValueAtTime(.001,t+.07);noise.connect(ng);ng.connect(audioCtx.destination);noise.start(t);noise.stop(t+.07);}
  }catch(error){}
 }
 function pixel(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
 function drawDuck(d){
  ctx.save();ctx.translate(Math.round(d.x),Math.round(d.y));ctx.scale(d.vx<0?-1:1,1);
  pixel(-16,-3,25,13,"#111820");pixel(-10,-8,14,8,"#202a32");pixel(5,-10,10,9,"#111820");pixel(11,-13,8,8,"#202a32");pixel(18,-11,4,3,"#ffd43b");pixel(21,-10,3,2,"#080b0e");
  pixel(3,-3,7,7,"#f4f1e8");pixel(-3,1,9,5,"#f4f1e8");pixel(-13,4,7,3,"#101820");
  if(d.wing>0)pixel(-7,d.wing>0.5?-13:4,15,8,"#303943");else pixel(-7,-1,15,7,"#252e37");
  ctx.restore();
 }
 let carNext=0;
 function drawNikeCar(){
  const cycle=elapsed-carNext;if(cycle<0||cycle>6)return;
  const x=-145+cycle*105,y=237;
  // Cartel de despedida elevado sobre el auto para que se lea durante el recorrido.
  pixel(x+5,y-27,166,19,"#f8f0d5");pixel(x+5,y-27,166,2,"#263746");pixel(x+5,y-10,166,2,"#263746");
  pixel(x+2,y-25,3,15,"#263746");pixel(x+171,y-25,3,15,"#263746");
  ctx.save();ctx.fillStyle="#193b4c";ctx.font="bold 9px monospace";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("¡TE EXTRAÑAREMOS NIKE!",x+88,y-18);ctx.restore();
  // Auto festivo estilo 8-bit circulando por la pista.
  pixel(x+27,y-8,76,12,"#c83235");pixel(x+43,y-17,43,10,"#e8edf0");pixel(x+48,y-15,13,7,"#75b9d3");pixel(x+65,y-15,16,7,"#75b9d3");
  pixel(x+19,y-5,9,6,"#f6d36e");pixel(x+101,y-5,8,6,"#f6d36e");
  pixel(x+37,y+2,17,7,"#18232b");pixel(x+81,y+2,17,7,"#18232b");
  pixel(x+40,y+4,8,3,"#aebbc1");pixel(x+84,y+4,8,3,"#aebbc1");
 }
 function drawPlane(){
  const cycle=elapsed-planeNext;if(cycle<0||cycle>7)return;
  const x=-90+cycle*115,y=18+Math.sin(cycle*1.7)*5;
  // Avión claramente visible y bandera arcoíris grande, con seis franjas horizontales.
  pixel(x+8,y+10,76,7,"#f4f6f7");pixel(x+34,y+2,25,8,"#f4f6f7");pixel(x+43,y-4,13,7,"#dce6eb");
  pixel(x+20,y+8,27,5,"#c9d6dd");pixel(x+61,y+9,14,4,"#aebdc7");
  // Mástil de cola y bandera rectangular: rojo, naranja, amarillo, verde, azul y violeta.
  pixel(x+9,y-22,3,35,"#374957");
  const rainbow=["#e5243b","#f18b2b","#f6d43b","#38a65a","#2777cf","#8c48a8"];
  rainbow.forEach((color,index)=>pixel(x-20,y-21+index*5,29,5,color));
  pixel(x-20,y-21,29,2,"#ffffff");
  pixel(x-20,y+7,29,2,"#ffffff");
 }
 function drawScene(){
  ctx.imageSmoothingEnabled=false;
  const sky=ctx.createLinearGradient(0,0,0,270);sky.addColorStop(0,"#1671bb");sky.addColorStop(.62,"#8ec4df");sky.addColorStop(1,"#e5d9b6");ctx.fillStyle=sky;ctx.fillRect(0,0,480,270);
  for(let i=0;i<22;i++){const x=(i*97)%480,y=(i*31)%82;pixel(x,y,2+(i%3),2,"#c3e4f2");}
  drawPlane();
  for(let i=0;i<19;i++){const x=365+(i*17)%125,y=15+(i*29)%92;pixel(x,y,15,13,i%2?"#2d673e":"#3d7b48");pixel(x+3,y-4,9,7,"#4f9254");}
  pixel(0,86,480,117,"#a9b0ad");pixel(0,86,480,8,"#687d87");pixel(0,98,480,7,"#d2d4cb");pixel(18,106,444,86,"#c4c9c2");pixel(18,106,444,5,"#e2e2d8");
  for(let row=0;row<3;row++)for(let col=0;col<26;col++){const x=24+col*17,y=117+row*22;pixel(x,y,12,14,(row+col)%4===0?"#244f70":"#315e7b");pixel(x+2,y+2,8,10,(row+col)%3===0?"#79a9bd":"#568aa6");pixel(x,y+14,12,2,"#b5c4c1");}
  pixel(0,103,480,5,"#2787bb");pixel(0,151,480,7,"#2385b9");pixel(0,190,480,8,"#1d6797");
  for(let x=0;x<480;x+=24){pixel(x,156,12,2,"#80c5df");pixel(x+8,192,8,2,"#6ab0d0");}
  pixel(165,50,151,41,"#8f9a9b");pixel(176,42,130,9,"#c5c9c2");pixel(182,35,118,8,"#aab4b3");pixel(176,58,130,28,"#6b7d83");pixel(189,62,105,17,"#e7e7df");
  ctx.fillStyle="#173d63";ctx.font="bold 13px monospace";ctx.textAlign="center";ctx.fillText("BCP",241,75);ctx.textAlign="left";
  pixel(111,17,2,92,"#6d7372");pixel(286,12,2,95,"#6d7372");pixel(114,20,25,28,"#e22f37");pixel(139,20,22,28,"#f6f0df");pixel(114,48,47,6,"#e22f37");pixel(289,16,22,28,"#174b9a");pixel(311,16,18,28,"#f5f1e6");pixel(329,16,18,28,"#ed703b");pixel(289,44,58,5,"#174b9a");
  pixel(0,202,480,68,"#427c3e");pixel(0,202,480,7,"#75a94d");
  for(let i=0;i<13;i++){const x=i*41+4;pixel(x,190,3,21,"#765538");pixel(x-7,187,17,5,"#2c6c3a");pixel(x-4,181,12,8,"#438c48");}
  pixel(0,233,480,9,"#d9d0ba");pixel(0,242,480,6,"#aaa797");pixel(0,248,480,22,"#8c8a7c");pixel(116,210,248,37,"#192b39");pixel(123,215,234,26,"#e9e8dc");
  ctx.fillStyle="#17436b";ctx.font="bold 25px monospace";ctx.textAlign="center";ctx.fillText("BCP",240,236);ctx.textAlign="left";
  for(let i=0;i<9;i++)pixel(i*55+4,255,26,2,"#d5cdb7");
  drawNikeCar();
  for(let i=0;i<36;i++){const x=(i*61)%480,y=108+(i*19)%78;pixel(x,y,2,2,"#c2d2d1");}
  ducks.forEach(drawDuck);
  explosions.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/.42);pixel(p.x,p.y,2.5,2.5,p.color);ctx.globalAlpha=1;});
  shots.forEach(s=>{pixel(s.x-2,s.y-7,4,12,"#f7d36a");pixel(s.x-1,s.y-5,2,8,"#fff2b0");});
  ctx.fillStyle="#fff6d9";ctx.font="bold 10px monospace";ctx.fillText("NIKE HUNT · BCP",8,13);
 }
 function hud(){
  scoreEl.textContent=String(score).padStart(4,"0");
  ammoEl.innerHTML=Array.from({length:3},(_,i)=>'<span class="nikehunt-bullet'+(i>=ammo?' is-empty':'')+'" aria-label="'+(i<ammo?"Bala disponible":"Bala gastada")+'"></span>').join("");
  if(livesEl)livesEl.textContent=unlimited?"∞":String(state.livesRemaining??0);
  const escapedEl=modal.querySelector("#duckhunt-escaped");if(escapedEl)escapedEl.textContent="NIKES ESCAPADOS "+escaped+"/10";
 }
 function endGame(){
  if(ended)return;ended=true;active=false;cancelAnimationFrame(raf);clearTimeout(reloadTimer);gameAudio.pause();overlay.classList.remove("hidden");
  modal.querySelector("#duckhunt-kicker").textContent="✦ PARTIDA TERMINADA ✦";
  modal.querySelector("#duckhunt-title").textContent="¡10 NIKES ESCAPARON!";
  modal.querySelector("#duckhunt-copy").textContent="Se escaparon 10 NIKES. Cazaste "+ducksShot+" NIKES y sumaste "+ducksShot+" puntos Espíritu. Tu resultado se guardará en el ranking.";
  modal.querySelector("#duckhunt-start").textContent="JUGAR OTRA PARTIDA";modal.querySelector("#duckhunt-exit").textContent="CERRAR";
  api("/api/duckhunt/score",{method:"POST",body:JSON.stringify({gameId,score:ducksShot,ducks:ducksShot}),noMemoryCache:true,timeoutMs:8000}).then(result=>{feedback.textContent="¡"+result.awardedPoints+" PUNTOS ESPÍRITU CONSEGUIDOS!";modal.querySelector("#duckhunt-best").textContent=String(result.stats?.best_score||ducksShot);loadRanking();}).catch(e=>{feedback.textContent="No se pudo guardar el puntaje: "+(e.message||"intenta de nuevo");});
 }
 function loop(now){
  if(!active)return;const dt=Math.min(.035,(now-last)/1000||0);last=now;elapsed+=dt;spawn-=dt;
  const speedMultiplier=1+(speedTier*0.2);
  if(spawn<=0&&ducks.length<4){
   const side=Math.random()<.5?-1:1,edge=side<0?-25:505,baseSpeed=rnd(58,76)*speedMultiplier,angle=rnd(-.58,.58);
   const duck={x:edge,y:rnd(42,225),vx:-side*Math.cos(angle)*baseSpeed,vy:Math.sin(angle)*baseSpeed,wing:0};
   ducks.push(duck);spawn=Math.max(.18,rnd(.85,1.3)/(1+(speedTier*0.1)));
  }
  ducks.forEach(d=>{d.x+=d.vx*dt;d.y+=d.vy*dt;if(d.y<34){d.y=34;d.vy=Math.abs(d.vy);}if(d.y>235){d.y=235;d.vy=-Math.abs(d.vy);}d.wing=Math.sin(now/65);});
  ducks=ducks.filter(d=>{if(d.x<-35||d.x>515){escaped++;return false;}return true;});
  explosions.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=35*dt;p.life-=dt;});explosions=explosions.filter(p=>p.life>0);
  shots=shots.filter(s=>now-s.t<150);drawScene();hud();
  if(escaped>=10){endGame();return;}
  if(elapsed>=planeNext+7)planeNext=elapsed+rnd(8,15);
  if(elapsed>=carNext+6)carNext=elapsed+rnd(10,18);
  raf=requestAnimationFrame(loop);
 }
 async function start(){
  if(active)return;const startButton=modal.querySelector("#duckhunt-start");startButton.disabled=true;
  if(!unlimited&&!lifeConsumed){
   try{const res=await api("/api/duckhunt/lives",{method:"POST",body:JSON.stringify({action:"consume-life"}),noMemoryCache:true});lifeConsumed=true;state.livesRemaining=res.livesRemaining;hud();feedback.textContent="VIDAS RESTANTES HOY: "+res.livesRemaining;}
   catch(e){feedback.textContent=e.message||"No tienes vidas disponibles.";startButton.disabled=false;return;}
  }
  if(!unlimited&&Number(state.livesRemaining)<=0&&!lifeConsumed){feedback.textContent="¡Vuelve mañana! Ya usaste tus 5 vidas.";startButton.disabled=false;return;}
  score=0;ducksShot=0;ammo=3;escaped=0;speedTier=0;elapsed=0;planeNext=rnd(7,12);carNext=rnd(10,18);ducks=[];shots=[];explosions=[];spawn=.2;ended=false;active=true;startButton.disabled=false;last=performance.now();overlay.classList.add("hidden");void gameAudio.play().catch(()=>{});hud();raf=requestAnimationFrame(loop);
 }
 canvas.addEventListener("pointerdown",e=>{
  if(!active||ammo<=0)return;e.preventDefault();const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*480/r.width,y=(e.clientY-r.top)*270/r.height;
  ammo--;shots.push({x,y,t:performance.now()});playArcadeSound("shot");
  let hit=-1;for(let i=ducks.length-1;i>=0;i--){const d=ducks[i];if(Math.abs(x-d.x)<25&&Math.abs(y-d.y)<21){hit=i;break;}}
  if(hit>=0){
   const d=ducks.splice(hit,1)[0];score++;ducksShot++;playArcadeSound("quack");
   for(let k=0;k<18;k++){const angle=Math.PI*2*k/18,speed=rnd(25,100);explosions.push({x:d.x,y:d.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:rnd(.22,.48),color:["#ffdf70","#ff8a36","#f7f0d5","#f04d36"][k%4]});}
   const nextTier=Math.floor(ducksShot/10);
   if(nextTier>speedTier){speedTier=nextTier;feedback.textContent="¡NIVEL "+speedTier+"! VELOCIDAD x"+(1+(speedTier*0.2)).toFixed(1)+" · SALEN MÁS NIKES";}
   else feedback.textContent="¡NIKE CAZADO! +1 ESPÍRITU";
  }else feedback.textContent="¡FALLASTE!";
  if(ammo===0){feedback.textContent+=" · RECARGANDO";clearTimeout(reloadTimer);reloadTimer=setTimeout(()=>{if(active){ammo=3;hud();}},650);}hud();
 });
 modal.querySelector("#duckhunt-start").addEventListener("click",()=>{if(ended){lifeConsumed=false;gameId=crypto.randomUUID().replace(/-/g,"");}void start();});
 modal.querySelector("#duckhunt-exit").addEventListener("click",close);modal.querySelector(".duckhunt-close").addEventListener("click",close);
 function close(){active=false;cancelAnimationFrame(raf);clearTimeout(reloadTimer);gameAudio.pause();gameAudio.removeAttribute("src");try{audioCtx?.close();}catch{}modal.remove();restoreLaunch();}
 async function loadRanking(){try{const r=await api("/api/duckhunt/leaderboard",{noMemoryCache:true});const list=modal.querySelector("#duckhunt-ranking-list");if(list)list.innerHTML=(r.ranking||[]).map((p,i)=>"<li><span>"+(i+1)+". "+esc(p.display_name)+"</span><b>"+Number(p.best_score||0)+"</b></li>").join("")||"<li>Aún no hay puntajes</li>";}catch{}}
 loadRanking();drawScene();hud();
 if(!unlimited&&Number(state.livesRemaining)<=0){modal.querySelector("#duckhunt-start").disabled=true;feedback.textContent="¡Vuelve mañana! Ya usaste tus 5 vidas.";}
}
function initDivorzhinhaGame(){
 const button=document.getElementById("divorzhinha-open-game");
 if(button&&!button.dataset.ready){button.dataset.ready="1";button.addEventListener("click",openDivorzhinhaGame);}
}
async function openDivorzhinhaGame(){
 if(!currentUser?.isPrimaryAdmin||currentUser?.membership?.team_name!=="Cliente 360"||document.getElementById("divorzhinha-game-modal")||openDivorzhinhaGame.loading)return;
 openDivorzhinhaGame.loading=true;
 const launch=document.getElementById("divorzhinha-open-game");
 if(launch){launch.disabled=true;launch.dataset.label=launch.innerHTML;launch.innerHTML="CARGANDO…";}
 let state;
 try{state=await api("/api/divorzhinha/state",{noMemoryCache:true,timeoutMs:8000});}
 catch(error){openDivorzhinhaGame.loading=false;if(launch){launch.disabled=false;launch.innerHTML=launch.dataset.label||"JUGAR AHORA →";}alert(error.message||"No se pudo cargar DIVORZINHA.");return;}
 const modal=document.createElement("section");modal.id="divorzhinha-game-modal";modal.className="divorzhinha-game-modal";
 modal.innerHTML='<div class="rozvi-game-shell divorzhinha-shell" role="dialog" aria-modal="true" aria-label="DIVORZINHA"><header class="divorzhinha-header"><div><span class="divorzhinha-overline">NAVIDAD PYME ARCADE · PENAL CHALLENGE</span><h2>DIVORZINHA</h2></div><button type="button" class="divorzhinha-close" aria-label="Cerrar">×</button></header><div class="divorzhinha-hud"><div><small>GOLES</small><strong id="divorzhinha-score">0</strong></div><div><small>VIDAS</small><strong id="divorzhinha-lives">❤️❤️❤️❤️❤️</strong></div><div><small>RÉCORD</small><strong id="divorzhinha-best">0</strong></div><button type="button" id="divorzhinha-pause" disabled>Ⅱ</button></div><div class="divorzhinha-stage-wrap"><canvas id="divorzhinha-canvas" width="960" height="540" aria-label="Patea al arco e intenta marcarle al arquero"></canvas><div class="divorzhinha-overlay" id="divorzhinha-overlay"><div class="divorzhinha-overlay-card"><span id="divorzhinha-overlay-kicker">✦ RETO DE PENALES ✦</span><h3 id="divorzhinha-overlay-title">¡SUPERA A DIVORZINHA!</h3><p id="divorzhinha-overlay-copy">Arrastra el dedo desde el balón hacia el espacio del arco donde quieras apuntar y suelta para patear. Cada gol suma 1 punto de Espíritu. Si el arquero ataja, termina la partida. </p><button type="button" id="divorzhinha-start">▶ COMENZAR</button><button type="button" id="divorzhinha-exit">SALIR</button></div></div></div><div class="divorzhinha-controls"><span>👆 ARRASTRA EL BALÓN Y SUELTA PARA PATEAR</span><span>⚽ CADA GOL = +1 ESPÍRITU</span><span>🧤 ATAJADA = FIN DE PARTIDA Y −1 VIDA</span></div><section class="divorzhinha-history"><div><h3>🏆 TU RÉCORD</h3><p id="divorzhinha-stats">Cargando estadísticas…</p></div></section><section class="rozvi-leaderboard rozvi-leaderboard-bottom divorzhinha-leaderboard"><h4>🏆 TOP 5 · MEJORES JUGADORES</h4><ol id="divorzhinha-leaderboard-list"><li>Cargando ranking…</li></ol></section><footer class="divorzhinha-footer">PARTICIPANTES · 5 VIDAS DIARIAS</footer></div>';
 const intro=modal.querySelector("#divorzhinha-overlay-copy");if(intro)intro.textContent=state.unlimitedLives?"Arrastra desde el balón hacia donde quieras disparar y suelta. ¡Marca goles y esquiva al arquero! Cada gol suma 1 punto de Espíritu. Si el arquero ataja, termina la partida. Como administrador tienes vidas infinitas.":"Arrastra desde el balón hacia donde quieras disparar y suelta. ¡Marca goles y esquiva al arquero! Cada gol suma 1 punto de Espíritu. Tienes 5 vidas por día, que se renuevan a las 18:00, hora de Lima, junto con ¡Vamos Rozvi! y las actividades diarias.";const footer=modal.querySelector(".divorzhinha-footer");if(footer)footer.textContent=state.unlimitedLives?"ADMINISTRADOR · VIDAS INFINITAS":"PARTICIPANTE · 5 VIDAS DIARIAS";
 document.body.append(modal);openDivorzhinhaGame.loading=false;
 modal.addEventListener("selectstart",e=>e.preventDefault());modal.addEventListener("contextmenu",e=>e.preventDefault());modal.addEventListener("dblclick",e=>{e.preventDefault();e.stopPropagation();});
 const canvas=modal.querySelector("#divorzhinha-canvas"),ctx=canvas.getContext("2d"),gameAudio=new Audio("/api/divorzhinha/music/current?v="+Date.now()),scoreEl=modal.querySelector("#divorzhinha-score"),livesEl=modal.querySelector("#divorzhinha-lives"),bestEl=modal.querySelector("#divorzhinha-best"),pauseBtn=modal.querySelector("#divorzhinha-pause"),overlay=modal.querySelector("#divorzhinha-overlay"),startBtn=modal.querySelector("#divorzhinha-start"),exitBtn=modal.querySelector("#divorzhinha-exit");
 gameAudio.loop=true;gameAudio.preload="auto";const W=960,H=540,unlimitedLives=state.unlimitedLives===true;let lives=Math.max(0,Math.min(5,Number(state.livesRemaining??5))),score=0,saves=0,best=Number(state.stats?.best_score||0),gamesPlayed=Number(state.stats?.games_played||0),active=false,paused=false,shooting=false,finished=false,submitted=false,raf=0,last=0,shot=null,aim=null,pointerId=null,message="",messageUntil=0,angryUntil=0,goalParticles=[],keeperX=480,keeperY=0,keeperDirection=1,keeperSpeed=220,keeperTargetX=480,keeperTargetY=0,keeperReactAt=0,keeperDive=null,catchFeedback=false,shotSaveTargetX=null,crowdCheerUntil=0,audioCtx=null,gameId=crypto.randomUUID().replace(/-/g,"");
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function playCrowdSound(kind){
  try{
   const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
   audioCtx=audioCtx||new AC();if(audioCtx.state==="suspended")void audioCtx.resume();
   const now=audioCtx.currentTime,duration=kind==="goal"?1.35:.75;
   const master=audioCtx.createGain();master.gain.setValueAtTime(.0001,now);master.gain.exponentialRampToValueAtTime(kind==="goal"?.16:.11,now+.08);master.gain.exponentialRampToValueAtTime(.0001,now+duration);master.connect(audioCtx.destination);
   const freqs=kind==="goal"?[392,494,587,784,988]:[330,392,440];
   freqs.forEach((freq,i)=>{const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type=i%2?"triangle":"sawtooth";osc.frequency.setValueAtTime(freq*(.98+Math.random()*.04),now);osc.frequency.exponentialRampToValueAtTime(freq*(kind==="goal"?1.25:.8),now+duration*.8);gain.gain.value=1/freqs.length;osc.connect(gain);gain.connect(master);osc.start(now);osc.stop(now+duration);});
   crowdCheerUntil=performance.now()+duration*1000;
  }catch(_){}
 }
 function paintHud(){scoreEl.textContent=String(score);livesEl.textContent=unlimitedLives?"∞":"❤️".repeat(lives)+"🖤".repeat(5-lives);bestEl.textContent=String(Math.max(best,score));pauseBtn.disabled=!active&&!paused;}
 function pixel(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
 function drawGoal(){
  const wall=ctx.createLinearGradient(0,35,0,430);wall.addColorStop(0,"#d8e9e8");wall.addColorStop(.45,"#8fbab2");wall.addColorStop(1,"#477c6a");ctx.fillStyle=wall;ctx.fillRect(120,45,720,390);
  for(let row=0;row<5;row++){for(let i=0;i<48;i++){const x=130+i*15,y=58+row*25;ctx.fillStyle=["#f8d77b","#f7f5e9","#e98565","#73b9a7","#324f66"][(i*7+row*3)%5];ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(x,y,4.3,0,Math.PI*2);ctx.fill();}}ctx.globalAlpha=1;
  ctx.save();ctx.beginPath();ctx.moveTo(155,75);ctx.lineTo(805,75);ctx.lineTo(790,395);ctx.lineTo(170,395);ctx.closePath();ctx.clip();
  const net=ctx.createLinearGradient(0,70,0,405);net.addColorStop(0,"#f5fcf5");net.addColorStop(1,"#a8c8c4");ctx.fillStyle=net;ctx.fillRect(150,70,660,335);
  ctx.strokeStyle="rgba(32,75,77,.22)";ctx.lineWidth=1.5;for(let x=155;x<=805;x+=22){ctx.beginPath();ctx.moveTo(x,75);ctx.lineTo(170+(x-155)*.95,395);ctx.stroke();}for(let y=88;y<=395;y+=21){const p=(y-75)/320;ctx.beginPath();ctx.moveTo(155+15*p,y);ctx.lineTo(805-15*p,y);ctx.stroke();}ctx.restore();
  ctx.save();ctx.shadowColor="#0a292c99";ctx.shadowBlur=18;ctx.strokeStyle="#f9ffff";ctx.lineWidth=22;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(154,397);ctx.lineTo(154,78);ctx.quadraticCurveTo(154,62,172,62);ctx.lineTo(788,62);ctx.quadraticCurveTo(806,62,806,80);ctx.lineTo(806,397);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle="#a8c4c7";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(164,391);ctx.lineTo(164,82);ctx.lineTo(796,82);ctx.lineTo(796,391);ctx.stroke();ctx.restore();
  const turf=ctx.createLinearGradient(0,395,0,540);turf.addColorStop(0,"#2c9c5d");turf.addColorStop(1,"#0b5839");ctx.fillStyle=turf;ctx.fillRect(0,395,960,145);
  ctx.strokeStyle="rgba(255,255,255,.38)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,397);ctx.lineTo(960,397);ctx.stroke();ctx.strokeStyle="rgba(255,255,255,.28)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(220,540);ctx.lineTo(315,398);ctx.moveTo(740,540);ctx.lineTo(645,398);ctx.stroke();ctx.fillStyle="#f8f4dc";ctx.beginPath();ctx.ellipse(480,493,5,3,0,0,Math.PI*2);ctx.fill();
 } function roundedRect(x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();}
 const keeperPixelCanvas=document.createElement("canvas");keeperPixelCanvas.width=1920;keeperPixelCanvas.height=1280;const keeperCtx=keeperPixelCanvas.getContext("2d");
 function keeperRoundedRect(x,y,w,h,r,fill){keeperCtx.beginPath();keeperCtx.roundRect(x,y,w,h,r);keeperCtx.fillStyle=fill;keeperCtx.fill();}
 function drawPixelKeeperFrame(now){
  const t=keeperDive?clamp((now-keeperDive.start)/560,0,1):0,e=t*t*(3-2*t),x=keeperDive?keeperDive.fromX+(keeperDive.toX-keeperDive.fromX)*e:keeperX;
  const idle=Math.sin(now/230),breath=Math.sin(now/390)*2.5,pose=keeperDive?.pose||(shooting&&shot?(shot.targetY<165?(shot.targetX<390?"high-left":shot.targetX>570?"high-right":"high"):shot.targetY>300?(shot.targetX<390?"low-left":shot.targetX>570?"low-right":"low"):shot.targetX<390?"left":shot.targetX>570?"right":"center"):"idle"),divePower=keeperDive?Math.sin(e*Math.PI):0,actionActive=shooting&&shot&&now>=keeperReactAt,actionT=actionActive?clamp((now-keeperReactAt)/190,0,1):0,aimLean=actionActive?clamp((shot.targetX-480)/310,-1,1):0,aimLow=actionActive&&shot.targetY>285,lean=keeperDive?(pose==="left"?.72:pose==="right"?-.72:pose==="high-left"?.52:pose==="high-right"?-.52:0):aimLean*.48*actionT+Math.sin(now/310)*.012,vertical=keeperDive?keeperDive.fromY+(keeperDive.toY-keeperDive.fromY)*e:keeperY,ground=382+vertical+(aimLow?14*actionT:0)+Math.sin(now/175)*1.2; const step=Math.sin(now/145)*3+aimLean*16*actionT,saved=catchFeedback&&finished,scored=now<angryUntil,crouch=aimLow||pose==="low"||pose==="low-left"||pose==="low-right",stretch=Math.abs(aimLean)>.25||pose==="left"||pose==="right"||pose==="high-left"||pose==="high-right";
  const skin=keeperCtx.createLinearGradient(-55,-220,55,-90);skin.addColorStop(0,"#d99a70");skin.addColorStop(.55,"#b97952");skin.addColorStop(1,"#875139");
  const shirt=keeperCtx.createLinearGradient(-55,-285,55,-105);shirt.addColorStop(0,"#fff06b");shirt.addColorStop(.35,"#f8d52d");shirt.addColorStop(1,"#d79d13");
  const glove=keeperCtx.createLinearGradient(-18,-20,18,22);glove.addColorStop(0,"#fff");glove.addColorStop(.55,"#f4f7f3");glove.addColorStop(1,"#b7c7c1");
  keeperCtx.save();keeperCtx.translate(x,ground+(crouch?18*divePower:0));keeperCtx.rotate(lean);keeperCtx.scale(stretch?1.12:1,crouch?1-.22*divePower:pose.startsWith("high")?1+.12*divePower:1);keeperCtx.shadowColor="#061b1780";keeperCtx.shadowBlur=20;keeperCtx.shadowOffsetY=12;
  keeperCtx.lineCap="round";keeperCtx.lineJoin="round";keeperCtx.strokeStyle=skin;keeperCtx.lineWidth=25;keeperCtx.beginPath();keeperCtx.moveTo(-19,-91);keeperCtx.quadraticCurveTo(-26+step*.3,-55,-31+step,-30);keeperCtx.moveTo(19,-91);keeperCtx.quadraticCurveTo(27-step*.3,-55,31-step,-30);keeperCtx.stroke();
  keeperCtx.shadowBlur=0;keeperCtx.shadowOffsetY=0;
  const shorts=keeperCtx.createLinearGradient(-42,-115,42,-70);shorts.addColorStop(0,"#ffea48");shorts.addColorStop(1,"#c99012");keeperRoundedRect(-43,-119,86,39,13,shorts);
  keeperRoundedRect(-57+step,-32,48,24,9,"#f47725");keeperRoundedRect(9-step,-32,48,24,9,"#f47725");keeperRoundedRect(-58+step,-16,49,8,4,"#ffb15b");keeperRoundedRect(9-step,-16,49,8,4,"#ffb15b");
  keeperRoundedRect(-53,-279,106,168,25,shirt);keeperRoundedRect(-42,-265,84,12,6,"#fff4a1");keeperCtx.save();keeperCtx.fillStyle="#101010";keeperCtx.font="1000 72px Arial,sans-serif";keeperCtx.textAlign="center";keeperCtx.textBaseline="middle";keeperCtx.fillText("1",0,-194);keeperCtx.restore();
  const side=keeperCtx.createLinearGradient(-53,0,53,0);side.addColorStop(0,"#d49a12");side.addColorStop(.5,"#ffed69");side.addColorStop(1,"#d49a12");keeperCtx.fillStyle=side;keeperCtx.fillRect(-53,-171,106,9);
  keeperCtx.fillStyle="#fff7b4";keeperCtx.beginPath();keeperCtx.moveTo(-17,-278);keeperCtx.lineTo(0,-260);keeperCtx.lineTo(17,-278);keeperCtx.lineTo(10,-286);keeperCtx.lineTo(-10,-286);keeperCtx.closePath();keeperCtx.fill();
  const armActionActive=shooting&&shot&&now>=keeperReactAt,reachT=armActionActive?clamp((now-keeperReactAt)/190,0,1):keeperDive?divePower:0,reachEase=reachT*reachT*(3-2*reachT);
  const aimDX=armActionActive?clamp((shot.targetX-480)/310,-1,1):0,aimDY=armActionActive?clamp((shot.targetY-220)/170,-1,1):0;
  const reachX=aimDX*108*reachEase,reachY=(-62+aimDY*112)*reachEase;
  function drawReachArm(side){
   const sx=side*43,spread=side*17,ex=sx+reachX+spread,ey=-251+reachY+side*10;
   keeperCtx.strokeStyle=skin;keeperCtx.lineWidth=23;keeperCtx.lineCap="round";keeperCtx.beginPath();keeperCtx.moveTo(sx,-251);keeperCtx.quadraticCurveTo(sx+(ex-sx)*.52+side*8,-226+(ey+251)*.42,ex,ey);keeperCtx.stroke();
   keeperCtx.save();keeperCtx.translate(ex,ey);keeperCtx.rotate(Math.atan2(ey+251,ex-sx));keeperRoundedRect(-15,-17,34,34,11,glove);keeperCtx.strokeStyle="#aabbb5";keeperCtx.lineWidth=2.5;for(let j=0;j<3;j++){keeperCtx.beginPath();keeperCtx.moveTo(-7+j*7,-12);keeperCtx.lineTo(-7+j*7,8);keeperCtx.stroke();}keeperCtx.restore();
  }
  drawReachArm(-1);drawReachArm(1);
  keeperRoundedRect(-16,-310,32,39,9,skin);keeperCtx.beginPath();keeperCtx.ellipse(0,-337+breath*.25,39,47,0,0,Math.PI*2);keeperCtx.fillStyle=skin;keeperCtx.fill();
  keeperCtx.fillStyle="#a96343";keeperCtx.beginPath();keeperCtx.ellipse(-39,-337,8,13,0,0,Math.PI*2);keeperCtx.ellipse(39,-337,8,13,0,0,Math.PI*2);keeperCtx.fill();
  keeperCtx.fillStyle="#201b1a";keeperCtx.beginPath();keeperCtx.moveTo(-39,-346);keeperCtx.quadraticCurveTo(-43,-385,-8,-389);keeperCtx.quadraticCurveTo(29,-395,42,-360);keeperCtx.lineTo(34,-354);keeperCtx.quadraticCurveTo(12,-370,-4,-362);keeperCtx.quadraticCurveTo(-21,-350,-39,-346);keeperCtx.fill();
  keeperCtx.fillStyle="#251c19";keeperCtx.beginPath();keeperCtx.arc(-13,-337,4.2,0,Math.PI*2);keeperCtx.arc(13,-337,4.2,0,Math.PI*2);keeperCtx.fill();
  keeperCtx.strokeStyle="#3b241d";keeperCtx.lineWidth=3.5;keeperCtx.lineCap="round";keeperCtx.beginPath();if(scored){keeperCtx.moveTo(-24,-351);keeperCtx.lineTo(-8,-345);keeperCtx.moveTo(24,-351);keeperCtx.lineTo(8,-345);keeperCtx.moveTo(-10,-317);keeperCtx.quadraticCurveTo(0,-331,10,-317);}else if(saved){keeperCtx.moveTo(-24,-350);keeperCtx.quadraticCurveTo(-16,-362,-8,-350);keeperCtx.moveTo(8,-350);keeperCtx.quadraticCurveTo(16,-362,24,-350);keeperCtx.moveTo(-14,-320);keeperCtx.quadraticCurveTo(0,-298,14,-320);}else{keeperCtx.moveTo(-24,-351);keeperCtx.lineTo(-8,-353);keeperCtx.moveTo(24,-351);keeperCtx.lineTo(8,-353);keeperCtx.moveTo(-11,-318);keeperCtx.quadraticCurveTo(0,-307,11,-318);}keeperCtx.stroke();
  keeperCtx.fillStyle="#fff";keeperCtx.beginPath();keeperCtx.arc(-14,-338,1.5,0,Math.PI*2);keeperCtx.arc(12,-338,1.5,0,Math.PI*2);keeperCtx.fill();
  
  keeperCtx.globalAlpha=.22;keeperCtx.strokeStyle="#fff";keeperCtx.lineWidth=3;keeperCtx.beginPath();keeperCtx.moveTo(-33,-258);keeperCtx.lineTo(-26,-125);keeperCtx.moveTo(33,-258);keeperCtx.lineTo(26,-125);keeperCtx.stroke();keeperCtx.globalAlpha=1;keeperCtx.restore();
  if(keeperDive&&t>=1){keeperX=keeperDive.toX;keeperY=keeperDive.toY;keeperDirection=keeperX>480?-1:1;keeperDive=null;}
 }
 function drawKeeper(now){
  keeperCtx.clearRect(0,0,1920,1280);keeperCtx.save();keeperCtx.setTransform(2,0,0,2,0,0);
  drawPixelKeeperFrame(now);
  keeperCtx.restore();
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(keeperPixelCanvas,0,0,960,640);ctx.restore();
 } function drawBall(x,y,r=34,rotation=0){
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.shadowColor="#071b1b99";ctx.shadowBlur=16;ctx.shadowOffsetY=8;
  const grad=ctx.createRadialGradient(-r*.35,-r*.4,2,0,0,r);grad.addColorStop(0,"#fff");grad.addColorStop(.72,"#f1f5f1");grad.addColorStop(1,"#9da9a5");
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=grad;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle="#25353a";ctx.lineWidth=Math.max(2,r*.09);ctx.stroke();
  ctx.fillStyle="#25353a";ctx.beginPath();for(let i=0;i<5;i++){const q=-Math.PI/2+i*Math.PI*2/5,px=Math.cos(q)*r*.38,py=Math.sin(q)*r*.38;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();
  for(let i=0;i<5;i++){const q=-Math.PI/2+i*Math.PI*2/5;ctx.beginPath();ctx.arc(Math.cos(q)*r*.76,Math.sin(q)*r*.76,r*.14,0,Math.PI*2);ctx.fill();}ctx.restore();
 }
 function render(now){
  ctx.clearRect(0,0,W,H);const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#102d48");sky.addColorStop(.48,"#286c66");sky.addColorStop(1,"#15432f");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  for(let i=0;i<24;i++){ctx.fillStyle=i%2?"#f6d77a":"#eaf4ec";ctx.globalAlpha=.55+.2*Math.sin(now/500+i);ctx.beginPath();ctx.arc(i*42+12,24+(i%3)*5,6,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
  ctx.fillStyle="#1c4650";ctx.fillRect(0,65,W,150);for(let row=0;row<4;row++)for(let i=0;i<48;i++){ctx.fillStyle=["#f5d36d","#f2f4ee","#e96c53","#78c6b3"][(i+row*3)%4];ctx.globalAlpha=.75;ctx.beginPath();ctx.arc(i*21+8,85+row*29+(i%2)*5+Math.sin(now/115+i*1.7+row)*((crowdCheerUntil>now)?9:2),5+((crowdCheerUntil>now)?Math.sin(now/90+i)*1.5:0),0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
  const field=ctx.createLinearGradient(0,215,0,H);field.addColorStop(0,"#2d965d");field.addColorStop(1,"#12633f");ctx.fillStyle=field;ctx.fillRect(0,215,W,H-215);
  for(let i=0;i<12;i++){ctx.fillStyle=i%2?"rgba(255,255,255,.035)":"rgba(0,0,0,.035)";ctx.fillRect(i*80,215,80,325);}
  // Stadium atmosphere: soft floodlights, animated beams and a richer pitch.
  ctx.save();
  for(let i=0;i<6;i++){const lx=80+i*160,glow=ctx.createRadialGradient(lx,65,3,lx,65,125);glow.addColorStop(0,"rgba(255,244,190,.34)");glow.addColorStop(1,"rgba(255,244,190,0)");ctx.fillStyle=glow;ctx.fillRect(lx-125,0,250,220);}
  for(let i=0;i<4;i++){const x=115+i*245+Math.sin(now/900+i)*24;ctx.globalAlpha=.045;ctx.fillStyle="#fff3b0";ctx.beginPath();ctx.moveTo(x-8,55);ctx.lineTo(x-92,215);ctx.lineTo(x+92,215);ctx.closePath();ctx.fill();}
  ctx.globalAlpha=1;
  const vignette=ctx.createRadialGradient(480,330,140,480,330,610);vignette.addColorStop(0,"rgba(0,0,0,0)");vignette.addColorStop(1,"rgba(0,20,15,.24)");ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
  ctx.restore();
  drawGoal();ctx.fillStyle="#fff5d6";ctx.font="1000 19px system-ui";ctx.textAlign="center";ctx.fillText("DIVORZINHA · ¡PENAL NAVIDEÑO!",480,32);
  for(const x of [300,480,660]){ctx.strokeStyle="rgba(255,255,255,.22)";ctx.lineWidth=2;ctx.setLineDash([8,9]);ctx.beginPath();ctx.moveTo(x,90);ctx.lineTo(x,402);ctx.stroke();}ctx.setLineDash([]);
  drawKeeper(now);
  if(shot){const t=clamp((now-shot.started)/shot.duration,0,1),e=t*t*(3-2*t),x=shot.x+(shot.targetX-shot.x)*e,y=shot.y+(shot.targetY-shot.y)*e,r=shot.radiusStart+(shot.radiusEnd-shot.radiusStart)*e;ctx.save();ctx.globalAlpha=.3;ctx.strokeStyle="#fff";ctx.lineWidth=r*.7;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(x,y+24);ctx.lineTo(x+(shot.x-shot.targetX)*.16,y+80);ctx.stroke();ctx.restore();drawBall(x,y,r,now/90);}
  else{drawBall(480,475,44,now/160);}
  const dtFx=1/60;for(let i=goalParticles.length-1;i>=0;i--){const p=goalParticles[i];p.x+=p.vx*dtFx;p.y+=p.vy*dtFx;p.vy+=420*dtFx;p.life-=dtFx*.75;ctx.save();ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle="hsl("+p.hue+" 88% 62%)";ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=10;ctx.translate(p.x,p.y);ctx.rotate((1-p.life)*8);ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*1.8);ctx.restore();if(p.life<=0)goalParticles.splice(i,1);}
  if(message&&performance.now()<messageUntil){const pulse=1+Math.sin(now/75)*.045;ctx.save();ctx.translate(480,465);ctx.scale(pulse,pulse);ctx.fillStyle="#fff7d7";ctx.font="1000 38px system-ui";ctx.textAlign="center";ctx.shadowColor="#123b31";ctx.shadowBlur=18;ctx.strokeStyle="#174b36";ctx.lineWidth=5;ctx.strokeText(message,0,0);ctx.fillText(message,0,0);ctx.restore();}
 }
 async function loadDivorzhinhaLeaderboard(){
  const list=modal.querySelector("#divorzhinha-leaderboard-list");if(!list)return;
  try{const data=await api("/api/divorzhinha/leaderboard",{noMemoryCache:true,timeoutMs:7000});list.replaceChildren();const rows=data.ranking||[];if(!rows.length){const li=document.createElement("li");li.textContent="Aún no hay puntajes registrados.";list.append(li);return;}rows.forEach((row,i)=>{const li=document.createElement("li"),name=document.createElement("span"),points=document.createElement("b");name.textContent=(i+1)+". "+(row.display_name||"Participante");points.textContent=Number(row.best_score||0)+" goles";li.append(name,points);list.append(li);});}
  catch(error){list.replaceChildren();const li=document.createElement("li");li.textContent="No se pudo cargar el ranking.";list.append(li);}
 }
 function updateHistory(data){
  const stats=data.stats||{};best=Number(stats.best_score||best);gamesPlayed=Number(stats.games_played||gamesPlayed);
  modal.querySelector("#divorzhinha-stats").textContent="Partidas: "+gamesPlayed+" · Goles totales: "+Number(stats.total_goals||0)+" · Récord: "+best;
  paintHud();
 }
 function showOverlay(kicker,title,copy,buttonText,showExit=true){
  overlay.hidden=false;overlay.style.display="grid";modal.querySelector("#divorzhinha-overlay-kicker").textContent=kicker;modal.querySelector("#divorzhinha-overlay-title").textContent=title;modal.querySelector("#divorzhinha-overlay-copy").textContent=copy;startBtn.textContent=buttonText;startBtn.hidden=!buttonText;startBtn.style.display=buttonText?"block":"none";startBtn.disabled=!buttonText;exitBtn.hidden=!showExit;
 }
 async function submit(){
  if(submitted)return true;submitted=true;
  try{const result=await api("/api/divorzhinha/score",{method:"POST",body:JSON.stringify({gameId,goals:score,saves}),noMemoryCache:true});updateHistory(result);void loadDivorzhinhaLeaderboard();message="+"+Number(result.awardedPoints||0)+" ESPÍRITU";messageUntil=performance.now()+1800;return true;}
  catch(error){submitted=false;return false;}
 }
 async function consumeLife(){
  if(!active||shooting)return;shooting=true;saves++;active=false;paused=false;finished=true;gameAudio.pause();cancelAnimationFrame(raf);pauseBtn.disabled=true;
  catchFeedback=true;message="¡DIVORZINHA LA ATAJÓ!";messageUntil=performance.now()+1500;playCrowdSound("save");
  keeperDive={start:performance.now(),fromX:keeperX,toX:clamp(shotSaveTargetX??keeperX,170,790),fromY:keeperY,toY:keeperY,pose:keeperDive?.pose||"right"};shotSaveTargetX=null;
  if(!unlimitedLives){try{const result=await api("/api/divorzhinha/lives",{method:"POST",body:JSON.stringify({action:"lose-life"}),noMemoryCache:true});lives=Math.max(0,Math.min(5,Number(result.livesRemaining??Math.max(0,lives-1))));paintHud();}
  catch(error){lives=Math.max(0,lives-1);paintHud();showOverlay("SIN CONEXIÓN","NO SE PUDO CONFIRMAR LA VIDA",error.message,"",true);startBtn.disabled=true;return;}}
  const saved=await submit(),hasLives=unlimitedLives||lives>0;
  showOverlay(saved?"✦ ATAJADA ✦":"ERROR AL GUARDAR",saved?"¡DIVORZINHA LA ATAJÓ!":"PUNTAJE PENDIENTE",saved?("La partida terminó. Marcaste "+score+" goles. "+(unlimitedLives?"Como administrador tienes vidas infinitas.":hasLives?"Te quedan "+lives+" vidas para hoy.":"Has agotado tus cinco vidas de hoy.")):"No se pudo guardar tu resultado. Comprueba tu conexión e inténtalo otra vez.",hasLives?"JUGAR OTRA VIDA":"",true);
  startBtn.disabled=!saved||!hasLives;
 }
 async function finishOutsideShot(){
  active=false;paused=false;finished=true;shooting=false;gameAudio.pause();cancelAnimationFrame(raf);pauseBtn.disabled=true;
  message="¡FUERA!";messageUntil=performance.now()+1200;
  let lifeSaved=unlimitedLives; if(!unlimitedLives){try{const result=await api("/api/divorzhinha/lives",{method:"POST",body:JSON.stringify({action:"lose-life"}),noMemoryCache:true});lives=Math.max(0,Math.min(5,Number(result.livesRemaining??Math.max(0,lives-1))));lifeSaved=true;paintHud();}catch(error){lives=Math.max(0,lives-1);paintHud();}}
  const saved=await submit(),hasLives=unlimitedLives||lives>0;
  showOverlay(saved&&lifeSaved?"✦ PARTIDA TERMINADA ✦":"ERROR AL GUARDAR",saved&&lifeSaved?"¡LA MANDASTE FUERA!":"PUNTAJE PENDIENTE",saved&&lifeSaved?"El balón salió del arco. Terminaste con "+score+" goles. "+(unlimitedLives?"Como administrador tienes vidas infinitas.":hasLives?"Te quedan "+lives+" vidas para hoy.":"Has agotado tus cinco vidas de hoy."):"No se pudo confirmar el resultado o la vida. Comprueba tu conexión antes de continuar.","JUGAR OTRA VEZ",true);
  startBtn.disabled=!saved||!lifeSaved||!hasLives;
 }
 function resolveShot(){
  if(!shot)return;const current=shot;shot=null;shooting=false;
  const inside=current.targetX>=170&&current.targetX<=790&&current.targetY>=78&&current.targetY<=390;
  if(!inside){finishOutsideShot();return;}
  // Colisión con la silueta completa del arquero. Las coordenadas están
  // expresadas en el canvas final (960x540), con el suelo del arquero en Y≈382.
  // Se amplían los límites por el radio de la pelota para detectar también
  // impactos rasantes en guantes, botas y piernas.
  function hitsKeeperBody(ballX,ballY,keeperCenterX,keeperOffsetY){
   const dx=Math.abs(ballX-keeperCenterX),r=21,y=ballY-keeperOffsetY;
   const inBand=(top,bottom,halfWidth)=>y>=top-r&&y<=bottom+r&&dx<=halfWidth+r;
   // Cabeza y cuello.
   if(inBand(0,122,49))return true;
   // Torso, hombros y camiseta.
   if(inBand(105,278,65))return true;
   // Brazos, antebrazos y guantes: zona amplia de atajada.
   if(inBand(72,285,148))return true;
   // Guantes dirigidos hacia la trayectoria del balón (extensión de ambos brazos).
   const aimX=clamp((ballX-480)/310,-1,1),aimY=clamp((ballY-220)/170,-1,1);
   const gloveCenterX=keeperCenterX+aimX*92,gloveCenterY=382+keeperOffsetY-251-62+aimY*105;
   if(Math.hypot(ballX-gloveCenterX,ballY-gloveCenterY)<52)return true;
   // Pantalones cortos, muslos, pantorrillas y botas.
   if(inBand(258,382,68))return true;
   return false;
  }
  const caught=hitsKeeperBody(current.targetX,current.targetY,keeperX,keeperY);
  if(caught){shotSaveTargetX=current.targetX;const high=current.targetY<165,low=current.targetY>300,left=current.targetX<390,right=current.targetX>570;const pose=high?(left?"high-left":right?"high-right":"high"):(low?(left?"low-left":right?"low-right":"low"):(left?"left":right?"right":"center"));keeperDive={start:performance.now(),fromX:keeperX,toX:current.targetX,fromY:keeperY,toY:keeperY,pose};keeperX=current.targetX;void consumeLife();}
  else{score++;angryUntil=performance.now()+1600;message="¡GOOOOL! +1";messageUntil=performance.now()+1500;playCrowdSound("goal");for(let i=0;i<58;i++){const a=Math.random()*Math.PI*2,v=90+Math.random()*300;goalParticles.push({x:current.targetX,y:current.targetY,vx:Math.cos(a)*v,vy:Math.sin(a)*v-100,life:1,size:3+Math.random()*6,hue:[42,52,145,165,0][i%5]});}paintHud();}
 }
 function shoot(targetX=480,targetY=160){
  if(!active||paused||shooting||finished)return;
  targetX=clamp(targetX,35,925);targetY=clamp(targetY,18,505);
  shot={x:480,y:475,targetX,targetY,started:performance.now(),radiusStart:46,radiusEnd:20,duration:Math.max(360,Math.min(620,390+(475-targetY)*.55))};
  shooting=true;aim=null;keeperTargetX=clamp(targetX,170,790);keeperTargetY=clamp((targetY-220)*.43,-78,72);keeperReactAt=performance.now()+Math.max(70,145-Math.min(score,20)*3);setTimeout(()=>resolveShot(),shot.duration);
 }
 function frame(now){
  if(!active||paused)return;const dt=Math.min(.04,(now-last)/1000||.016);last=now;
  keeperSpeed=Math.min(1100,620*Math.pow(2,Math.min(2,Math.floor(score/5))));
  if(shooting&&shot&&now>=keeperReactAt){const dx=keeperTargetX-keeperX,dy=keeperTargetY-keeperY,stepX=keeperSpeed*dt,stepY=keeperSpeed*.9*dt;keeperX=Math.abs(dx)<=stepX?keeperTargetX:keeperX+Math.sign(dx)*stepX;keeperY=Math.abs(dy)<=stepY?keeperTargetY:keeperY+Math.sign(dy)*stepY;}
  else if(!shooting&&!keeperDive){keeperX+=(480-keeperX)*Math.min(1,dt*5);keeperY+=(0-keeperY)*Math.min(1,dt*5);}
  render(now);raf=requestAnimationFrame(frame);
 }
 function start(){if(active||(!unlimitedLives&&lives<=0)||finished)return;overlay.hidden=true;overlay.style.display="none";gameAudio.play().catch(()=>{});active=true;paused=false;shooting=false;last=performance.now();pauseBtn.disabled=false;raf=requestAnimationFrame(frame);}
 function restartGame(){
  if(!unlimitedLives&&lives<=0){showOverlay("✦ VIDAS AGOTADAS ✦","VUELVE MAÑANA","Has utilizado tus cinco vidas. Se renovarán a las 18:00, hora de Lima.","",false);startBtn.disabled=true;return;}
  score=0;saves=0;finished=false;submitted=false;shooting=false;catchFeedback=false;shotSaveTargetX=null;paused=false;active=false;shot=null;aim=null;pointerId=null;keeperX=480;keeperY=0;keeperDirection=1;keeperSpeed=220;keeperTargetX=480;keeperTargetY=0;keeperReactAt=0;keeperDive=null;angryUntil=0;goalParticles=[];message="";messageUntil=0;gameId=crypto.randomUUID().replace(/-/g,"");paintHud();pauseBtn.textContent="Ⅱ";pauseBtn.disabled=false;start();
 }
 function togglePause(){
  if(!active&&!paused)return;paused=!paused;
  if(paused){active=false;gameAudio.pause();cancelAnimationFrame(raf);pauseBtn.textContent="▶";showOverlay("PARTIDA EN PAUSA","TÓMATE UN RESPIRO","Tu progreso y tus vidas se mantienen.","▶ CONTINUAR",true);}
  else{overlay.hidden=true;overlay.style.display="none";gameAudio.play().catch(()=>{});active=true;pauseBtn.textContent="Ⅱ";last=performance.now();raf=requestAnimationFrame(frame);}
 }
 function close(){active=false;paused=false;gameAudio.pause();gameAudio.currentTime=0;cancelAnimationFrame(raf);if(score>0&&!submitted)void submit();window.removeEventListener("keydown",keyDown);modal.remove();const button=document.getElementById("divorzhinha-open-game");if(button){button.disabled=false;button.innerHTML=button.dataset.label||"JUGAR AHORA →";}}
 function canvasPoint(event){const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*W/rect.width,y:(event.clientY-rect.top)*H/rect.height};}
 function keyDown(event){if(event.code==="Space"||event.key==="Enter"){if(active){event.preventDefault();shoot(480,160);}}}
 canvas.style.touchAction="none";
 canvas.addEventListener("pointerdown",event=>{if(!active||paused||shooting||finished)return;const p=canvasPoint(event);if(p.y<330)return;event.preventDefault();pointerId=event.pointerId;aim={x:480,y:475};canvas.setPointerCapture?.(event.pointerId);},{passive:false});
 canvas.addEventListener("pointermove",event=>{if(pointerId!==event.pointerId||!aim)return;event.preventDefault();const p=canvasPoint(event);aim={x:clamp(p.x,35,925),y:clamp(p.y,18,505)};},{passive:false});
 const releaseAim=event=>{if(pointerId!==event.pointerId)return;event.preventDefault();const p=canvasPoint(event);pointerId=null;if(!active||!aim)return;const target={x:clamp(p.x,35,925),y:clamp(p.y,18,505)};aim=null;shoot(target.x,target.y);};
 canvas.addEventListener("pointerup",releaseAim,{passive:false});canvas.addEventListener("pointercancel",event=>{if(pointerId===event.pointerId){pointerId=null;aim=null;}});

 pauseBtn.addEventListener("click",togglePause);startBtn.addEventListener("click",async()=>{if(paused){togglePause();return;}if(finished){if(!submitted){const saved=await submit();if(!saved){showOverlay("ERROR AL GUARDAR","PUNTAJE PENDIENTE","No se pudo guardar la partida. Inténtalo nuevamente.","JUGAR OTRA VEZ",true);return;}}restartGame();return;}start();});
 exitBtn.addEventListener("click",close);modal.querySelector(".divorzhinha-close").addEventListener("click",close);modal.addEventListener("click",event=>{if(event.target===modal)close();});window.addEventListener("keydown",keyDown);
 updateHistory(state);paintHud();render(performance.now());loadDivorzhinhaLeaderboard();
 if(!unlimitedLives&&lives<=0)showOverlay("✦ VIDAS AGOTADAS ✦","VUELVE MAÑANA","Tus cinco vidas ya fueron utilizadas. Se renovarán a las 18:00, hora de Lima.","",false);
 else showOverlay("✦ RETO DE PENALES ✦","¡SUPERA A DIVORZINHA!",unlimitedLives?"Arrastra desde el balón hacia donde quieras disparar y suelta. ¡Marca goles y esquiva al arquero!":"Arrastra desde el balón hacia donde quieras disparar y suelta. ¡Tienes 5 vidas diarias que se renuevan a las 18:00, hora de Lima!","▶ COMENZAR",true);
}
