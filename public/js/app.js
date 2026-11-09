const $ = selector => document.querySelector(selector);
const setClass = (selector, className, enabled) => { const el=$(selector); if(el) el.classList.toggle(className, !!enabled); return el; };
const params = new URLSearchParams(location.search);
const urlInvite = params.get("invite") || location.pathname.match(/\/unirse\/([^/]+)/)?.[1] || "";
if(urlInvite)sessionStorage.setItem("navidad_invite_token",urlInvite);
const token = urlInvite || sessionStorage.getItem("navidad_invite_token") || "";
const isWhatsAppInApp = /WhatsApp/i.test(navigator.userAgent) && !!token;

let signedIn=false, currentUser=null, inviteValid=false, inviteEdition=null, communityPollTimer=null, selectedEditionId=new URLSearchParams(location.search).get("editionId")||localStorage.getItem("navidad_selected_edition")||"";
const apiMemoryCache=new Map();
const api=async(path,options={})=>{
 const method=(options.method||"GET").toUpperCase(),cacheable=method==="GET"&&!options.noMemoryCache;
 let requestPath=path;
 if(selectedEditionId && path.startsWith("/api/") && path!=="/api/config" && path!=="/api/health" && path!=="/api/admin/editions" && !/[?&]editionId=/.test(path)){const separator=path.includes("?")?"&":"?";requestPath=path+separator+"editionId="+encodeURIComponent(selectedEditionId);}
 if(method!=="GET")apiMemoryCache.clear();
 if(cacheable){const cached=apiMemoryCache.get(requestPath);if(cached&&Date.now()-cached.time<((path==="/api/community")?3500:8000))return cached.data;}
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),18000);
 let r,raw;
 try{
  r=await fetch(requestPath,{credentials:"same-origin",cache:"no-store",...options,signal:controller.signal,headers:{"content-type":"application/json",...(options.headers||{})}});
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
function avatarUrl(value,size=64){if(!value||!/^https:\/\//i.test(value))return "";try{const url=new URL(value);if(/(^|\.)googleusercontent\.com$/i.test(url.hostname)){url.pathname=url.pathname.replace(/=s\d+(?:-c)?$/i,"")+"=s"+size+"-c";}return url.href;}catch{return value;}}
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
async function loadInvite(){if(!token)return;try{const r=await api("/api/invitations/"+encodeURIComponent(token));inviteValid=true;inviteEdition=r.edition;}catch{inviteValid=false;}}
function showProfileForm(profile=null){
 setSnowfall(false);
 const card=$("#join-card");card.classList.remove("hidden");card.innerHTML=`<div class="card-heading"><div class="icon-bubble">👤</div><div><p class="kicker">TU PERFIL DE PARTICIPANTE</p><h2>¿Cómo te llamas?</h2></div></div><p class="muted">Escribe tus nombres y apellidos reales. Estos datos serán utilizados para identificarte durante el sorteo; no mostraremos tu correo como nombre.</p><form id="participant-profile-form" class="profile-form"><label>Nombres<input name="firstName" autocomplete="given-name" maxlength="80" required value="${esc(profile?.first_name||"")}"></label><label>Apellidos<input name="lastName" autocomplete="family-name" maxlength="100" required value="${esc(profile?.last_name||"")}"></label><button class="primary-button" type="submit">Guardar mi nombre <span>→</span></button></form><div id="profile-feedback" class="status hidden" role="status"></div>`;
 $("#participant-profile-form").addEventListener("submit",async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));const fb=$("#profile-feedback");try{await api("/api/profile/participant",{method:"POST",body:JSON.stringify(values)});currentUser=await api("/api/me"+(selectedEditionId?"?editionId="+encodeURIComponent(selectedEditionId):""));renderMemberApp();}catch(err){fb.textContent=err.message;fb.classList.remove("hidden");fb.classList.add("error");}});
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
 app.innerHTML=`<section class="member-home" id="member-tab-content">${homeMarkup}</section><nav class="bottom-nav" aria-label="Menú principal"><button class="active" data-tab="home"><span>⌂</span>Inicio</button><button data-tab="secret"><span>🎁</span>Mi secreto <span class="nav-unread-badge" id="secret-unread-badge" hidden></span></button><button data-tab="community" aria-label="Mensajes"><span>✉️</span>Mensajes <span class="nav-unread-badge" id="community-unread-badge" hidden></span></button><button data-tab="wishes"><span>💝</span>Deseos <span class="nav-unread-badge" id="wishes-unread-badge" hidden></span></button><button data-tab="spirit"><span>🎄</span>Espíritu <span class="nav-unread-badge" id="spirit-unread-badge" hidden></span></button><button data-tab="profile"><span>👥</span>Mi equipo</button>${currentUser.isPrimaryAdmin?'<button data-tab="admin-settings"><span>⚙️</span>Ajustes</button>':""}</nav>`;
 if(isOnboarding)loadOnboardingHome();
 startActivityHeartbeat();
 updateMemberCountdown(currentUser.membership?.event_date);

 prefetchMemberTabs();
 if(communityPollTimer)clearInterval(communityPollTimer);
 updateTabUnreadBadges();
 communityPollTimer=setInterval(updateTabUnreadBadges,90000);
 app.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{setSnowfall(btn.dataset.tab==="home");app.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===btn));if(btn.dataset.tab==="profile"){showProfileSettings();return;}if(btn.dataset.tab==="admin-settings"){showAdminSettings();return;}if(btn.dataset.tab==="secret"){renderSecretTab();return;}if(btn.dataset.tab==="wishes"){renderWishesTab();return;}if(btn.dataset.tab==="community"){renderCommunityTab();return;}if(btn.dataset.tab==="spirit"){renderSpiritTab();return;}const labels={home:"Inicio",secret:"Mi amigo secreto",community:"Mensajes",wishes:"Lista de deseos"};if(btn.dataset.tab!=="home"){const section=app.querySelector(".member-home");section.innerHTML=`<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>${labels[btn.dataset.tab]}</h2></div><article class="member-feature"><span>${btn.dataset.tab==="secret"?"🎁":btn.dataset.tab==="community"?"💬":"💝"}</span><div><b>${labels[btn.dataset.tab]}</b><p>Esta funcionalidad se habilitará en su fase correspondiente del proyecto.</p></div><small>Próximamente</small></article>`;}else{renderMemberApp();}}));
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
  const names=people.map(p=>String(p.display_name||"Participante")+(group.rank===1&&Number(p.first_place_streak)>1?"  🔥 "+Number(p.first_place_streak):"")).join("  ·  ");
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
async function renderSpiritTab(){
 const home=$("#member-app .member-home");if(!home)return;
 home.innerHTML='<div class="spirit-heading"><span>🎄</span><div><p class="kicker">NAVIDAD PYME · 2026</p><h2>Espíritu Navideño</h2><p>Comparte, participa y contagia la alegría de estas fiestas. ¡El primer puesto se llevará un premio sorpresa!</p></div></div><div id="spirit-content"><div class="tab-skeleton"><span></span><span></span><span></span></div></div>';
 try{
  const data=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("Espíritu está tardando más de lo esperado. Revisa tu conexión e inténtalo nuevamente.")),15000);api("/api/spirit/board",{noMemoryCache:true}).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});}),host=$("#spirit-content"),challenge=data.challenge,ranking=data.ranking||[],submissions=data.submissions||[],medals=["🥇","🥈","🥉"];
  const rankGroups=[...new Set(ranking.map(p=>Number(p.rank)))].map(rank=>({rank,people:ranking.filter(p=>Number(p.rank)===rank)}));
  const rankMarkup=rankGroups.length?rankGroups.map(group=>{const names=group.people.map(p=>'<span class="spirit-rank-person">'+esc(p.display_name)+(Number(p.rank)===1&&Number(p.first_place_streak)>1?' <b class="spirit-streak">🔥 '+Number(p.first_place_streak)+' días</b>':'')+(p.user_id===currentUser.user.id?' <small>¡Tú!</small>':'')+'</span>').join('<span class="spirit-tie-join"> y </span>');const label=group.people.length>1?'Empate en el '+(group.rank===1?'primer':group.rank===2?'segundo':'tercer')+' lugar':(group.rank===1?'Primer':group.rank===2?'Segundo':'Tercer')+' lugar';return '<article class="spirit-rank-row spirit-rank-group '+(group.people.some(p=>p.user_id===currentUser.user.id)?'is-me':'')+'"><span class="spirit-medal">'+(medals[group.rank-1]||'🏅')+'</span><span class="spirit-rank-name"><small class="spirit-rank-place">'+label+'</small><span class="spirit-rank-names">'+names+'</span></span><span class="spirit-rank-points">'+Number(group.people[0].points||0)+' pts</span></article>';}).join(""):'<p class="spirit-muted">Aún no hay puntos registrados. ¡Sé el primero en participar!</p>';
  const type=challenge?.challenge_type||"text",cfg=challenge?.config||{};
  const challengeMarkup=challenge?'<article class="spirit-challenge"><div class="spirit-challenge-top"><span>🎯 RETO ACTIVO</span><b>❤️ POR LIKES</b></div><h3>'+esc(challenge.title)+'</h3><p>'+esc(challenge.description)+'</p><small>Cada Me gusta de otro participante suma 1 punto (máximo 10 por publicación). La publicación más votada del día recibe 10 puntos extra; si hay empate, todos los primeros lugares reciben la bonificación.</small></article>':'<article class="spirit-challenge"><h3>¡Estamos preparando el próximo reto!</h3><p>El reto de hoy terminó a las 11:00 p. m. (hora Perú). Estamos en pausa hasta las 9:00 a. m., cuando se abrirá el siguiente reto. ¡Vuelve mañana para seguir sumando! 🎄</p></article>';
  let field=type==="photo"?'<label class="spirit-file-label">📷 Sube tu foto<input name="media" type="file" accept="image/jpeg,image/png,image/webp" required></label><label>Comentario (opcional)<textarea name="caption" maxlength="500"></textarea></label>':type==="voice"?'<div class="spirit-voice-recorder"><button type="button" class="admin-action" data-spirit-record>🎙️ Iniciar grabación</button><span id="spirit-record-status">Máximo 30 segundos</span><audio id="spirit-audio-preview" controls class="hidden"></audio></div><label>Comentario (opcional)<textarea name="caption" maxlength="300"></textarea></label>':type==="trivia"?'<fieldset class="spirit-trivia-options"><legend>'+esc(cfg.question||"Elige la respuesta correcta")+'</legend>'+(cfg.options||[]).map(o=>'<label><input type="radio" name="answer" value="'+esc(o)+'" required><span>'+esc(o)+'</span></label>').join("")+'</fieldset>':'<label>Tu participación<textarea name="caption" maxlength="500" minlength="2" required placeholder="Cuéntanos o comparte tu momento navideño…"></textarea></label>';
  const formMarkup=challenge?(data.mySubmission?'<div class="spirit-submitted">🎉 ¡Ya participaste en este reto! Tu publicación está en el carrusel de la comunidad.</div>':'<form id="spirit-submission-form" class="spirit-submit-form">'+field+'<button class="primary-button" type="submit">Enviar mi participación <span>→</span></button><div id="spirit-feedback" class="spirit-feedback" role="status"></div></form>'):"";
  const feed=submissions.length?'<div class="spirit-carousel" aria-label="Participaciones de la comunidad"><div class="spirit-carousel-track">'+submissions.map(p=>'<article class="spirit-post"><div class="spirit-post-head"><span class="spirit-post-avatar">'+(p.avatar_url&&/^https:\/\//i.test(p.avatar_url)?'<img src="'+esc(avatarUrl(p.avatar_url,64))+'" alt="" loading="lazy" decoding="async" width="44" height="44">':'🎄')+'</span><div><b>'+esc(p.display_name)+'</b><small>'+new Date(String(p.created_at).replace(" ","T")+"Z").toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"})+'</small></div></div><p>'+esc(p.caption)+'</p>'+(p.has_media&&String(p.media_type||"").startsWith("audio/")?'<audio class="spirit-post-audio" controls preload="none" data-spirit-media="'+esc(p.id)+'"></audio>':p.has_media?'<img class="spirit-post-image" loading="lazy" data-spirit-media="'+esc(p.id)+'" alt="Foto compartida">':"")+'<div class="spirit-post-actions"><span>❤️ '+Number(p.votes)+' Me gusta</span>'+(p.user_id===currentUser.user.id?'<button type="button" class="spirit-delete-button" data-spirit-delete="'+esc(p.id)+'">Eliminar mi participación</button>':p.eligibleForVoting===false?'<small class="spirit-trivia-wrong">Respuesta incorrecta</small>':'<button type="button" '+(p.voted?'data-spirit-unvote="'+esc(p.id)+'"':'data-spirit-vote="'+esc(p.id)+'"')+'>'+(p.voted?"Quitar Me gusta ✓":"Me gusta ❤️")+'</button>')+'</div></article>').join("")+'</div></div>':'<p class="spirit-muted">Todavía no hay publicaciones. ¡Anímate a inaugurar el reto!</p>';
  host.innerHTML='<section class="spirit-score-card"><div><small>TU PUNTUACIÓN</small><strong>'+Number(data.myPoints||0)+' pts</strong><span>'+(data.myRank?'Puesto #'+data.myRank:'Aún sin posición')+'</span></div><span class="spirit-score-icon">🏆</span></section>'+challengeMarkup+formMarkup+(challenge?'<section class="spirit-section"><div class="spirit-section-title"><h3>✨ Comunidad navideña</h3><small>'+submissions.length+' últimas publicaciones · desliza para verlas</small></div>'+feed+'</section>':'')+'<section class="spirit-section"><div class="spirit-section-title"><h3>🏆 Podio</h3><small>Los 3 primeros</small></div><div class="spirit-ranking">'+rankMarkup+'</div><button type="button" id="spirit-share-podium" class="spirit-share-podium">📲 Compartir podio como imagen</button></section>';
  const loadSpiritPostMedia=element=>{if(element.dataset.mediaLoaded==="1"||element.dataset.mediaLoading==="1")return;element.dataset.mediaLoading="1";const success=()=>{element.dataset.mediaLoading="";element.dataset.mediaLoaded="1";};const failure=()=>{element.dataset.mediaLoading="";element.dataset.mediaLoaded="";if(!element.dataset.mediaErrorShown){element.dataset.mediaErrorShown="1";element.insertAdjacentHTML("afterend",'<small class="spirit-muted">No se pudo cargar el archivo. Puedes volver a intentarlo.</small>');}};element.addEventListener(element.tagName==="AUDIO"?"loadeddata":"load",success,{once:true});element.addEventListener("error",failure,{once:true});element.src="/api/spirit/media/"+encodeURIComponent(element.dataset.spiritMedia);if(element.tagName==="AUDIO"){element.preload="metadata";element.load();}};
  const postMedia=host.querySelectorAll('[data-spirit-media]');
  if("IntersectionObserver" in window){const mediaObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){mediaObserver.unobserve(entry.target);loadSpiritPostMedia(entry.target);}}),{rootMargin:"100px"});postMedia.forEach(media=>mediaObserver.observe(media));}else postMedia.forEach(loadSpiritPostMedia);
  if(!home.dataset.spiritHandlers){
   home.dataset.spiritHandlers="1";
   home.addEventListener("submit",async ev=>{if(ev.target.id!=="spirit-submission-form")return;ev.preventDefault();const form=ev.target,button=form.querySelector('button[type="submit"]'),fb=$("#spirit-feedback");button.disabled=true;button.textContent="Enviando…";try{let caption=String(form.elements.caption?.value||"").trim(),mediaData="",mediaType="";if(type==="photo"){const file=form.elements.media.files[0];if(!file)throw Error("Selecciona una foto.");mediaData=await compressWishImage(file);mediaType="image/jpeg";}if(type==="voice"){if(!window.__spiritAudioBlob)throw Error("Primero graba tu mensaje de voz.");mediaData=await blobToDataUrl(window.__spiritAudioBlob);mediaType=(window.__spiritAudioBlob.type||"audio/webm").split(";")[0].toLowerCase()||"audio/webm";}if(type==="trivia")caption=String(new FormData(form).get("answer")||"");const result=await api("/api/spirit/submissions",{method:"POST",body:JSON.stringify({caption,mediaData,mediaType})});await renderSpiritTab();const score=$("#spirit-content .spirit-score-card");if(score)score.insertAdjacentHTML("afterend",'<p class="spirit-success">'+(type==="trivia"?(result.correct?"¡Respuesta correcta! ":"Respuesta registrada. Sigue participando. "):"¡Participación enviada! ")+"Los puntos llegarán con los Me gusta que recibas. ❤️</p>");}catch(error){fb.textContent=error.message;button.disabled=false;button.textContent="Enviar mi participación →";}});
   home.addEventListener("click",async ev=>{
    const sharePodium=ev.target.closest("#spirit-share-podium");if(sharePodium){await shareSpiritPodium(ranking,challenge);return;}
    const record=ev.target.closest("[data-spirit-record]");if(record){const status=$("#spirit-record-status"),preview=$("#spirit-audio-preview");try{if(!spiritRecorder||spiritRecorder.state==="inactive"){if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error("La grabación necesita abrirse desde el enlace seguro de la aplicación (https://) en Chrome o Safari.");if(!window.MediaRecorder)throw Error("Este navegador no es compatible con la grabación de audio. Abre la aplicación en Chrome actualizado.");let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}catch(firstError){if(firstError?.name==="OverconstrainedError"||firstError?.name==="ConstraintNotSatisfiedError")stream=await navigator.mediaDevices.getUserMedia({audio:true});else throw firstError;}spiritAudioChunks=[];spiritRecorder=new MediaRecorder(stream);spiritRecorder.ondataavailable=e=>{if(e.data.size)spiritAudioChunks.push(e.data);};spiritRecorder.onstop=()=>{window.__spiritAudioBlob=new Blob(spiritAudioChunks,{type:spiritRecorder.mimeType||"audio/webm"});preview.src=URL.createObjectURL(window.__spiritAudioBlob);preview.classList.remove("hidden");stream.getTracks().forEach(t=>t.stop());status.textContent="Audio listo para enviar.";record.textContent="🎙️ Grabar nuevamente";};spiritRecorder.start();record.textContent="⏹ Detener grabación";status.textContent="Grabando… máximo 30 segundos.";window.__spiritVoiceLimit=setTimeout(()=>{if(spiritRecorder?.state==="recording")spiritRecorder.stop();},30000);}else if(spiritRecorder.state==="recording"){clearTimeout(window.__spiritVoiceLimit);spiritRecorder.stop();}}catch(error){const name=error?.name||"";if(name==="NotAllowedError"||name==="PermissionDeniedError"||/permission denied|not allowed/i.test(error?.message||"")){status.textContent="No se concedió acceso al micrófono. En Android: abre los ajustes del sitio desde el candado junto a la dirección, entra en Permisos y activa Micrófono. Si está bloqueado en el teléfono, ve a Ajustes > Aplicaciones > Chrome > Permisos > Micrófono. Después vuelve a cargar esta página e inténtalo otra vez.";}else if(name==="NotFoundError"||name==="DevicesNotFoundError"){status.textContent="No encontramos un micrófono disponible en este dispositivo.";}else if(name==="NotReadableError"||name==="TrackStartError"){status.textContent="El micrófono está siendo usado por otra aplicación. Ciérrala e inténtalo nuevamente.";}else if(name==="SecurityError"){status.textContent="El navegador bloqueó el micrófono. Abre la aplicación directamente en Chrome y permite el acceso al micrófono.";}else{status.textContent=error?.message||"No se pudo iniciar la grabación. Revisa el permiso del micrófono.";}console.warn("Error de grabación de Espíritu:",name,error?.message||error);}return;}
    const del=ev.target.closest("[data-spirit-delete]");if(del){if(!confirm("¿Eliminar tu participación y los puntos asociados?"))return;del.disabled=true;del.textContent="Eliminando…";try{await api("/api/spirit/submissions/"+encodeURIComponent(del.dataset.spiritDelete),{method:"DELETE"});await renderSpiritTab();}catch(error){del.disabled=false;del.textContent=error.message;}return;}
    const unvote=ev.target.closest("[data-spirit-unvote]");if(unvote){unvote.disabled=true;try{await api("/api/spirit/submissions/"+encodeURIComponent(unvote.dataset.spiritUnvote)+"/vote",{method:"DELETE"});await renderSpiritTab();}catch(error){unvote.disabled=false;unvote.textContent=error.message;}return;}const vote=ev.target.closest("[data-spirit-vote]");if(!vote)return;vote.disabled=true;vote.textContent="Enviando…";try{await api("/api/spirit/submissions/"+encodeURIComponent(vote.dataset.spiritVote)+"/vote",{method:"POST",body:JSON.stringify({})});await renderSpiritTab();}catch(error){vote.disabled=false;vote.textContent=error.message;}
   });
  }
 }catch(error){const host=$("#spirit-content");if(host){host.innerHTML='<div class="status error" role="alert">'+esc(error.message||"No se pudo cargar Espíritu Navideño.")+'</div><button type="button" class="primary-button" id="spirit-retry-button">Reintentar carga</button>';host.querySelector("#spirit-retry-button")?.addEventListener("click",()=>renderSpiritTab());}}
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
  host.innerHTML='<section class="spirit-admin"><div class="management-heading"><div><h3>🎄 Retos diarios</h3><p>Prepara los retos con anticipación. Cada uno abrirá a las 9:00 a. m. y cerrará a las 11:00 p. m. (hora Perú).</p></div></div><div class="spirit-suggestion-grid">'+ideas.map(x=>'<button type="button" class="spirit-suggestion-card" data-spirit-suggestion="'+x.id+'"><span>'+x.icon+'</span><b>'+esc(x.title)+'</b><small>'+({text:"Texto",photo:"Foto",voice:"Voz",trivia:"Trivia"}[x.type])+'</small></button>').join("")+'</div><div id="spirit-suggestion-editor" class="hidden"><form id="spirit-admin-form" class="spirit-admin-form"><input type="hidden" name="challengeType"><label>Nombre del reto<input name="title" maxlength="80" required></label><label>Instrucciones<textarea name="description" maxlength="300" required></textarea></label><label>Fecha de apertura<input name="scheduledDate" type="date" required></label><div id="spirit-trivia-config" class="hidden"><label>Pregunta<input name="question" maxlength="180"></label><div class="spirit-trivia-admin-options"><label>Opción A<input name="optionA"></label><label>Opción B<input name="optionB"></label><label>Opción C<input name="optionC"></label><label>Opción D<input name="optionD"></label></div><label>Respuesta correcta<select name="correctAnswer"><option value="">Selecciona</option></select></label></div><p class="spirit-admin-points">Los puntos se asignan automáticamente según los Me gusta recibidos. No se otorgan puntos por publicar.</p><div class="spirit-admin-editor-actions"><button class="admin-action" type="submit">📅 Programar reto</button><button class="spirit-admin-cancel" type="button" id="spirit-admin-cancel">Cancelar</button></div><div id="spirit-admin-feedback" role="status"></div></form></div><div class="spirit-active-challenge"><b>Reto actual</b><span>'+(data.active?esc(data.active.title)+' · '+({text:"Texto",photo:"Foto",voice:"Voz",trivia:"Trivia"}[data.active.challenge_type]||"Texto"):'No hay un reto activo')+'</span></div><div class="spirit-active-challenge"><b>Próximos retos programados</b><span>'+(data.scheduled&&data.scheduled.length?data.scheduled.map(x=>esc(x.title)+' · '+new Date(String(x.starts_at).replace(" ","T")+"Z").toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"})).join(" · "):"Aún no hay retos programados.")+'</span></div><button type="button" class="spirit-reset-points" id="spirit-reset-my-points">↺ Reiniciar mis puntos</button><small>Solo afecta tu puntuación en la edición actual.</small></section>';
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
   const avatar=p.avatar_url&&/^https:\/\//i.test(p.avatar_url)?'<img src="'+esc(avatarUrl(p.avatar_url,64))+'" alt="" loading="lazy" decoding="async" width="44" height="44">':esc(initials||"🎄");
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
   const formatPeruTime=value=>{if(!value)return "Recientemente";const date=new Date(String(value).replace(" ","T")+"Z");if(Number.isNaN(date.getTime()))return "Recientemente";return new Intl.DateTimeFormat("es-PE",{timeZone:"America/Lima",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(date);};
   host.innerHTML='<div class="admin-activity-heading"><div><h3>Actividad de participantes</h3><p>Usuarios que han usado la aplicación recientemente.</p></div><button type="button" class="admin-action" id="admin-activity-refresh">↻ Actualizar</button></div><div class="admin-activity-grid">'+metric("Activos ahora",data.activeNow,"Actividad en los últimos 5 minutos")+metric("Activos hoy",data.activeToday,"Usuarios únicos")+metric("Activos esta semana",data.activeWeek,"Usuarios únicos")+metric("Participantes",data.participants,"Inscripciones confirmadas")+'</div><div class="admin-activity-list"><h4>Conectados recientemente</h4>'+(data.recent?.length?data.recent.map(p=>'<div class="admin-activity-person"><span class="admin-activity-avatar">'+(p.avatar_url&&String(p.avatar_url).startsWith("https://")?'<img src="'+esc(avatarUrl(p.avatar_url,64))+'" alt="">':'🎄')+'</span><span><b>'+esc(p.display_name)+'</b><small>'+ (p.is_active?'Activo ahora':'Última actividad: '+esc(formatPeruTime(p.last_seen_label)))+'</small></span><i class="'+(p.is_active?'is-online':'')+'"></i></div>').join(""):'<p class="muted">Todavía no hay actividad registrada.</p>')+'</div><p class="settings-note">La actividad se actualiza automáticamente cada minuto. Se considera activo a quien haya interactuado durante los últimos 5 minutos.</p>';
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
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return "";
 return new Intl.DateTimeFormat("es-PE",{dateStyle:"medium",timeStyle:"short"}).format(date);
}

async function renderCommunityTab(){
 const section=$("#member-app .member-home");if(!section)return;
 section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Buzón secreto ✉️</h2><p>Deja un mensaje anónimo para tu amigo secreto y revisa las sorpresas que te envíe.</p></div><div class="tab-skeleton" aria-label="Preparando buzón"><span></span><span></span><span></span></div>';
 try{
  const clues=await api("/api/community/clues");
  let messageMarkup="";
  if(clues.state==="not_assigned")messageMarkup='<div class="clue-locked"><span>🎁</span><div><b>Tu buzón estará listo pronto</b><p>Cuando el organizador te asigne un amigo secreto, podrás enviarle mensajes anónimos.</p></div></div>';
  else if(clues.state!=="drawn")messageMarkup='<div class="clue-locked"><span>🔐</span><div><b>El buzón se abrirá después del sorteo</b><p>Una vez realizado el sorteo, podrás dejar mensajes anónimos a tu amigo secreto y recibir los suyos.</p></div></div>';
  else messageMarkup='<div class="clue-recieved-list">'+(clues.clues||[]).map(c=>'<article class="clue-received"><span>💌</span><div><b>Un mensaje para ti</b><p>'+esc(c.message)+'</p><time>'+formatCommunityTime(c.created_at)+'</time></div></article>').join('')+'</div>' + (!(clues.clues||[]).length?'<div class="community-empty clue-empty"><span>💌</span><b>Tu buzón está esperando</b><p>Aún no recibes mensajes. ¡Tu amigo secreto podría sorprenderte pronto!</p></div>':'')+'<div class="clue-compose"><div class="clue-compose-heading"><div><span class="wish-kicker">UN DETALLE EN SECRETO</span><h3>Dejar un mensaje</h3></div><span class="wish-count">'+clues.sentCount+' enviados</span></div><form id="clue-form"><label for="clue-message">Escribe algo para tu amigo secreto</label><textarea id="clue-message" name="message" maxlength="240" rows="3" placeholder="Ej. ¡Espero que tengas una Navidad increíble! 🎄" required></textarea><div class="clue-compose-footer"><small>Tu identidad permanecerá en secreto. Puedes enviar todos los mensajes que quieras.</small><button class="primary-button" type="submit">Enviar mensaje →</button></div><div id="clue-feedback" class="status hidden"></div></form></div>';
  section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Buzón secreto ✉️</h2><p>Un espacio privado para dejarle mensajes anónimos a tu amigo secreto y recibir los suyos.</p></div><div class="push-settings"><div><b>Entérate al instante</b><p>Recibe avisos cuando tu amigo secreto te deje una pista o alguien reaccione a tu participación en Espíritu.</p></div><button type="button" id="enable-push-notifications" class="secondary-action">🔔 Activar notificaciones</button><div id="push-feedback" class="status hidden" role="status"></div></div><section class="community-clues">'+messageMarkup+'</section>';
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
 section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Lista de deseos 💝</h2><p>Pequeñas ideas para inspirar el regalo perfecto.</p></div><div class="tab-skeleton" aria-label="Preparando deseos"><span></span><span></span><span></span></div>';
 try{
  const data=await api("/api/wishes");
  const mine=data.wishes||[];
  const wishCards=(items,removable)=>items.map((w,index)=>'<article class="wish-card">'+(w.has_image?'<div class="wish-image-link"><img class="wish-image" data-wish-image="'+esc(w.id)+'" alt="Imagen adjunta de '+esc(w.title)+'" loading="lazy"></div>':'<div class="wish-card-icon" aria-hidden="true">🎁</div>')+'<div class="wish-card-content"><span class="wish-number">DESEO '+String(index+1).padStart(2,"0")+'</span><h4>'+esc(w.title)+'</h4>'+(w.note?'<p>'+esc(w.note)+'</p>':'')+(w.url?'<a class="wish-link" href="'+esc(w.url)+'" target="_blank" rel="noopener noreferrer"><span>↗</span> Ver referencia</a>':'')+(w.has_image?'<button type="button" class="wish-view-image" data-view-image="'+esc(w.id)+'">⌕ Ver imagen</button>':'')+'</div>'+(removable?'<div class="wish-card-actions"><button class="wish-edit" data-edit-wish="'+esc(w.id)+'" aria-label="Editar '+esc(w.title)+'" title="Editar deseo">✎</button><button class="wish-delete" data-delete-wish="'+esc(w.id)+'" aria-label="Eliminar '+esc(w.title)+'" title="Eliminar deseo">×</button></div>':'')+'</article>').join('');
  const wishCarousel=(items,removable,id)=>'<div class="wish-carousel" data-wish-carousel="'+id+'" aria-label="'+(removable?'Tus deseos':'Deseos de tu amigo secreto')+'"><div class="wish-carousel-top"><span>'+items.length+' '+(items.length===1?'deseo':'deseos')+'</span><small>Desliza para descubrirlos <span aria-hidden="true">→</span></small></div><div class="wish-carousel-track">'+wishCards(items,removable)+'</div><div class="wish-carousel-dots" aria-hidden="true">'+items.map((_,i)=>'<span class="'+(i===0?'active':'')+'"></span>').join('')+'</div></div>';
  const recipient=data.canSeeRecipientWishes?'<section class="recipient-wishes"><div class="wish-section-heading"><div><span class="wish-kicker">INSPIRACIÓN PARA TU REGALO</span><h3>Los deseos de '+esc(data.recipientName)+'</h3></div><span class="wish-heading-icon">✨</span></div><p class="wish-section-description">Estas son algunas ideas que compartió tu amigo secreto. ¡La sorpresa sigue siendo tuya!</p>'+(data.recipientWishes.length?wishCarousel(data.recipientWishes,false,'recipient'):'<p class="wish-empty">Todavía no ha agregado deseos.</p>')+'</section>':'<div class="wish-privacy"><span>🔒</span><p><b>Tu lista es privada</b><small>Solo la persona que te tenga asignado podrá consultar tus deseos después del sorteo.</small></p></div>';
  section.innerHTML='<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Lista de deseos 💝</h2><p>Comparte lo que te gustaría recibir y ayuda a tu amigo secreto a encontrar el regalo ideal.</p></div><section class="wish-editor"><div class="wish-section-heading"><div><span class="wish-kicker">TU LISTA PERSONAL</span><h3>Agregar un deseo</h3></div><span class="wish-heading-icon">✍️</span></div><form id="wish-form"><label>Nombre del regalo<input name="title" maxlength="100" placeholder="Ej. Figura de colección de Seiya" required></label><label>Detalles o características <span>(opcional)</span><textarea name="note" maxlength="300" rows="2" placeholder="Color, modelo, tamaño o cualquier detalle útil…"></textarea></label><label>Enlace de referencia <span>(opcional)</span><input name="url" type="url" placeholder="https://…"></label><label>Imagen de referencia <span>(opcional · JPG, PNG o WEBP; máx. 2 MB)</span><input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="wish-image-preview hidden" id="wish-new-image-preview"></div><small class="wish-image-help">Si no tienes un enlace, puedes adjuntar una foto del producto.</small><div class="wish-form-footer"><small>'+mine.length+' de 10 deseos</small><button class="primary-button" type="submit" '+(mine.length>=10?'disabled':'')+'>＋ Agregar deseo</button></div><div id="wish-feedback" class="status hidden"></div></form></section><section class="wish-list"><div class="wish-section-heading"><div><span class="wish-kicker">TUS IDEAS FAVORITAS</span><h3>Mis deseos</h3></div><span class="wish-count">'+mine.length+' / 10</span></div>'+(mine.length?wishCarousel(mine,true,'mine'):'<div class="wish-empty-state"><span>🎁</span><b>Tu lista está esperando ideas</b><p>Agrega ese regalo que te haría ilusión recibir esta Navidad.</p></div>')+'</section>'+recipient;
  const wishImageObserver="IntersectionObserver"in window?new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){const img=entry.target;wishImageObserver.unobserve(img);img.src="/api/wishes/image/"+encodeURIComponent(img.dataset.wishImage)+(selectedEditionId?"?editionId="+encodeURIComponent(selectedEditionId):"");img.removeAttribute("data-wish-image");}}),{rootMargin:"250px"}):null;
  section.querySelectorAll("img[data-wish-image]").forEach(img=>wishImageObserver?wishImageObserver.observe(img):img.setAttribute("src","/api/wishes/image/"+encodeURIComponent(img.dataset.wishImage)+(selectedEditionId?"?editionId="+encodeURIComponent(selectedEditionId):"")));
  section.querySelectorAll(".wish-carousel").forEach(carousel=>{const track=carousel.querySelector(".wish-carousel-track"),dots=[...carousel.querySelectorAll(".wish-carousel-dots span")];if(!track)return;track.addEventListener("scroll",()=>{const cards=[...track.querySelectorAll(".wish-card")];if(!cards.length)return;const index=Math.max(0,Math.min(cards.length-1,Math.round(track.scrollLeft/(cards[0].offsetWidth+12))));dots.forEach((dot,i)=>dot.classList.toggle("active",i===index));},{passive:true});});
  $("#wish-form").elements.imageFile.addEventListener("change",async ev=>{const preview=$("#wish-new-image-preview");preview.classList.add("hidden");preview.innerHTML="";const file=ev.target.files[0];if(!file)return;try{const data=await compressWishImage(file);preview.innerHTML='<img src="'+data+'" alt="Vista previa de la imagen seleccionada"><button type="button" class="wish-image-remove">Quitar imagen</button>';preview.classList.remove("hidden");preview.querySelector("button").addEventListener("click",()=>{ev.target.value="";preview.classList.add("hidden");preview.innerHTML="";});}catch(e){const fb=$("#wish-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");ev.target.value="";}});
  $("#wish-form").addEventListener("submit",async ev=>{ev.preventDefault();const form=ev.currentTarget;const values=Object.fromEntries(new FormData(form));const file=form.elements.imageFile.files[0];const fb=$("#wish-feedback");try{if(file)values.imageData=await compressWishImage(file);delete values.imageFile;await api("/api/wishes",{method:"POST",body:JSON.stringify(values)});await renderWishesTab();}catch(e){fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
  section.querySelectorAll("[data-view-image]").forEach(btn=>btn.addEventListener("click",()=>{
   const wish=mine.find(item=>item.id===btn.dataset.viewImage)||((data.recipientWishes||[]).find(item=>item.id===btn.dataset.viewImage));
   if(!wish?.has_image)return;
   const imageUrl="/api/wishes/image/"+encodeURIComponent(wish.id);
   const modal=document.createElement("div");modal.className="wish-image-modal";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label","Imagen de referencia: "+wish.title);
   modal.innerHTML='<div class="wish-image-modal-panel"><div class="wish-image-modal-header"><div><span>IMAGEN DE REFERENCIA</span><h3>'+esc(wish.title)+'</h3></div><button type="button" class="wish-image-modal-close" aria-label="Cerrar">×</button></div><div class="wish-image-modal-stage"><img src="'+imageUrl+'" alt="Imagen de referencia para '+esc(wish.title)+'"></div><p class="wish-image-modal-caption">Imagen compartida en la lista de deseos</p></div>';
   const close=()=>{modal.remove();document.removeEventListener("keydown",onKey);};
   const onKey=e=>{if(e.key==="Escape")close();};
   modal.addEventListener("click",e=>{if(e.target===modal)close();});
   modal.querySelector(".wish-image-modal-close").addEventListener("click",close);
   document.addEventListener("keydown",onKey);document.body.appendChild(modal);modal.querySelector(".wish-image-modal-close").focus();
  }));
  section.querySelectorAll("[data-edit-wish]").forEach(btn=>btn.addEventListener("click",()=>{
   const wish=mine.find(item=>item.id===btn.dataset.editWish);if(!wish)return;
   const card=btn.closest(".wish-card");if(!card)return;
   card.innerHTML='<form class="wish-inline-edit" data-wish-edit-form="'+esc(wish.id)+'"><div class="wish-edit-heading"><b>Editar deseo</b><button type="button" class="wish-edit-cancel">Cancelar</button></div><label>Nombre del regalo<input name="title" maxlength="100" required value="'+esc(wish.title)+'"></label><label>Detalles o características<textarea name="note" maxlength="300" rows="2">'+esc(wish.note||"")+'</textarea></label><label>Enlace de referencia<input name="url" type="url" value="'+esc(wish.url||"")+'" placeholder="https://…"></label><label>Imagen de referencia <span>(opcional · JPG, PNG o WEBP)</span><input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"></label>'+(wish.has_image?'<div class="wish-image-preview"><img src="/api/wishes/image/'+encodeURIComponent(wish.id)+'" alt="Imagen actual"><label class="wish-remove-image-label"><input type="checkbox" name="removeImage" value="1"> Quitar imagen actual</label></div>':'<div class="wish-image-preview hidden"></div>')+'<div class="wish-edit-actions"><button type="button" class="wish-edit-cancel secondary">Cancelar</button><button type="submit" class="primary-button">Guardar cambios</button></div><div class="wish-edit-feedback status hidden"></div></form>';
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
 const app=$("#member-app"), profile=currentUser.participantProfile||{};
 app.querySelector(".member-home").innerHTML=`<div class="member-section-heading"><p class="kicker">NAVIDAD PYME · 2026</p><h2>Mi equipo</h2><p>Consulta quiénes forman parte del intercambio y administra tu participación.</p></div><article class="member-feature"><span>👤</span><div><b>Mi perfil</b><p>${esc([profile.first_name,profile.last_name].filter(Boolean).join(" ")||currentUser.user.email)}</p><p>${esc(currentUser.user.email)}</p></div><button class="profile-action" id="edit-profile">Editar</button></article><section class="home-participants-card profile-participants-card" aria-labelledby="profile-participants-title"><div class="home-participants-heading"><div><span class="exchange-budget-kicker">EL EQUIPO QUE CELEBRA</span><h2 id="profile-participants-title">Lista de participantes <span id="profile-participants-count">(—)</span></h2></div><span class="home-participants-icon">🎄</span></div><div id="profile-participants-list" class="home-participants-list" aria-live="polite"><p class="participants-loading">Cargando participantes…</p></div></section><div class="profile-actions"><button id="withdraw-participation" class="secondary-action">Ya no quiero participar</button><button id="logout-button" class="secondary-action">Cerrar sesión</button></div><div id="profile-action-feedback" class="status hidden"></div>`;
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
async function logout(){if(communityPollTimer)clearInterval(communityPollTimer);try{await api("/api/auth/logout",{method:"POST"});}finally{location.href=location.pathname+(token?"?invite="+encodeURIComponent(token):"");}}
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
 $("#confirm-join").addEventListener("click",async()=>{try{await api("/api/invitations/join",{method:"POST",body:JSON.stringify({token})});sessionStorage.removeItem("navidad_invite_token");currentUser=await api("/api/me");showProfileForm();}catch(e){const fb=$("#join-feedback");fb.textContent=e.message;fb.classList.remove("hidden");fb.classList.add("error");}});
 }else if(currentUser.membership?.status==="confirmed"&&!currentUser.participantProfile){$("#join-card").classList.add("hidden");showProfileForm();}
 else if(currentUser.membership?.status==="confirmed"){renderMemberApp();} else if(currentUser.membership?.status==="withdrawn"&&!currentUser.isPrimaryAdmin){renderRejoinView();}
 else if(currentUser.isPrimaryAdmin){$("#join-card").classList.add("hidden");setClass("#admin-panel","hidden",false);}
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
