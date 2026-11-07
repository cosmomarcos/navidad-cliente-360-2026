const css=`
.install-card{display:none;margin:12px auto 18px;padding:16px 18px;border:1px solid rgba(215,182,108,.45);border-radius:16px;background:linear-gradient(135deg,#f8f2e5,#fffaf0);color:#19372d;box-shadow:0 8px 24px rgba(18,59,49,.08)}
.install-card.visible{display:flex;align-items:center;gap:14px}.install-icon{font-size:27px;flex:0 0 auto}.install-copy{min-width:0;flex:1}.install-copy strong{display:block;font-size:14px}.install-copy p{margin:4px 0 0;font-size:12px;line-height:1.45;color:#596c60}.install-action{border:0;border-radius:999px;background:#174536;color:#fff7e7;padding:10px 14px;font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer}.install-dismiss{border:0;background:transparent;color:#64766b;font-size:18px;padding:4px;cursor:pointer}
.install-help{display:none;margin-top:10px;padding:12px;border-radius:12px;background:#e9eee5;color:#19372d;font-size:12px;line-height:1.55}.install-help.visible{display:block}.install-help ol{padding-left:20px;margin:7px 0}.install-help li{margin:3px 0}
@media(max-width:520px){.install-card.visible{align-items:flex-start;flex-wrap:wrap}.install-action{margin-left:40px}.install-dismiss{margin-left:auto}}
`;
const style=document.createElement("style");style.textContent=css;document.head.append(style);
const card=document.createElement("aside");card.className="install-card";card.id="install-card";card.setAttribute("aria-label","Instalar aplicación");
card.innerHTML='<span class="install-icon" aria-hidden="true">📲</span><div class="install-copy"><strong>Instala Navidad Cliente 360</strong><p id="install-description">Agrega la aplicación a tu pantalla de inicio para entrar más rápido.</p><div class="install-help" id="install-help"></div></div><button class="install-action" id="install-action" type="button">Instalar</button><button class="install-dismiss" id="install-dismiss" type="button" aria-label="Cerrar">×</button>';
const place=()=>{const header=document.querySelector(".topbar");if(header&&!card.isConnected)header.insertAdjacentElement("afterend",card);};
place();if(!card.isConnected)document.addEventListener("DOMContentLoaded",place,{once:true});
let promptEvent=null;
const ua=navigator.userAgent||"",ios=/iPad|iPhone|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
const safari=ios&&/Safari/.test(ua)&&!/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Chrome/.test(ua);
const standalone=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const action=card.querySelector("#install-action"),description=card.querySelector("#install-description"),help=card.querySelector("#install-help");
const show=(text,html,button)=>{description.textContent=text;help.innerHTML=html;help.classList.add("visible");action.textContent=button||"Entendido";card.classList.add("visible");};
if(!standalone){
 if(ios&&safari){
  show("Añade la app a tu pantalla de inicio en unos pasos.",'<ol><li>Toca el botón <b>Compartir</b> de Safari.</li><li>Desplázate y selecciona <b>Añadir a pantalla de inicio</b>.</li><li>Confirma con <b>Añadir</b>.</li></ol>',"Ver pasos");
  action.addEventListener("click",()=>help.classList.toggle("visible"));
 }else if(ios){
  show("Para instalarla en iPhone, abre este mismo enlace en Safari.",'<ol><li>Copia la dirección de esta página.</li><li>Abre Safari y pega el enlace.</li><li>Toca <b>Compartir → Añadir a pantalla de inicio</b>.</li></ol>',"Cómo hacerlo");
  action.addEventListener("click",()=>help.classList.toggle("visible"));
 }else{
  card.classList.add("visible");
  window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();promptEvent=event;});
  action.addEventListener("click",async()=>{
   if(promptEvent){promptEvent.prompt();await promptEvent.userChoice;promptEvent=null;return;}
   show("Busca la opción para instalar o añadir esta página a tu pantalla de inicio.",'<ol><li>Abre el menú del navegador (⋮ o compartir).</li><li>Elige <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.</li><li>Confirma la instalación.</li></ol>',"Ver pasos");
  });
 }
}
card.querySelector("#install-dismiss").addEventListener("click",()=>card.remove());
