(function(){
'use strict';
const $=id=>document.getElementById(id), motion=new RDNMotion.Controller(), math=RDNMotion.math;
const labels={idle:'GARDE LIBRE',walk:'MARCHE',turn:'DEMI-TOUR',strike:'ATTAQUE',recover:'RÉCUPÉRATION',charge:'CHARGE',align:'RÉALIGNEMENT',rush:'ACCÉLÉRATION'};
const fallback=$('diagnosticCanvas'),gl=$('renderCanvas'),ctx=fallback.getContext('2d');
let renderer=null,paused=false,speed=1,diagnostics=true,hidden=document.hidden,frameTime=performance.now(),camMode='three';
let W=1,H=1,dpr=1,sequence=null,toastTime=0,lastMessage='',phaseTime=0,engineTries=0;
function resize(){const rect=$('stage').getBoundingClientRect();W=Math.max(1,rect.width);H=Math.max(1,rect.height);dpr=Math.min(devicePixelRatio||1,1.5);fallback.width=W*dpr;fallback.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);if(renderer)renderer.resize();}
new ResizeObserver(resize).observe($('stage'));addEventListener('resize',resize);
function announce(message){lastMessage=message;$('toast').textContent=message;toastTime=2;$('toast').classList.add('show');}
function runAction(action){
 sequence=null;$('demo').classList.remove('active');
 if(motion.command(action)){announce({walk:'Le pied posé reste fixé au sol.',stop:'Freinage, puis fin du pas.',turn:'Pivot par petits pas, sans retour en arrière.',guard:'Le bouclier change de position. Les appuis restent en place.',strike:'Préparation → contact → récupération.',charge:'Réalignement vers le front avant d’accélérer.'}[action]);}
 else announce('Ce geste se termine avant le prochain ordre.');
 if(paused){paused=false;updatePause();}
}
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>runAction(b.dataset.action)));
function updatePause(){$('pause').textContent=paused?'Reprendre':'Pause';$('pause').setAttribute('aria-pressed',String(paused));}
$('pause').addEventListener('click',()=>{paused=!paused;updatePause();});
$('step').addEventListener('click',()=>{paused=true;sequence=null;updatePause();advance(1/60);render(0);});
document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{speed=Number(b.dataset.speed);document.querySelectorAll('[data-speed]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});}));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{camMode=b.dataset.view;if(renderer)renderer.cameraView(camMode);document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));}));
$('bones').addEventListener('change',()=>diagnostics=$('bones').checked);
$('terrain').addEventListener('change',()=>{motion.setSlope($('terrain').checked?.08:0);sequence=null;announce('Terrain changé : guerrier replacé au départ de l’atelier.');});
$('reset').addEventListener('click',()=>{motion.reset();sequence=null;paused=false;updatePause();announce('Atelier réinitialisé. Le jeu en ligne reste inchangé.');});
const demoSteps=[['walk',2.8],['stop',1.1],['turn',2.6],['guard',1.3],['guard',.9],['strike',1.6],['charge',5.0],['stop',1.0]];
$('demo').addEventListener('click',()=>{if(sequence){sequence=null;$('demo').classList.remove('active');motion.command('stop');return;}motion.reset();sequence={index:0,t:0};motion.command(demoSteps[0][0]);paused=false;updatePause();$('demo').classList.add('active');announce('Démonstration des six gestes.');});
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;frameTime=performance.now();});
function advance(dt){
 motion.step(dt);const events=motion.drainEvents();for(const e of events){if(renderer)renderer.impact();announce('Contact réel avec la cible — un seul impact.');}
 if(sequence){sequence.t+=dt;if(sequence.t>=demoSteps[sequence.index][1]){sequence.t=0;sequence.index++;if(sequence.index>=demoSteps.length){sequence=null;$('demo').classList.remove('active');}else motion.command(demoSteps[sequence.index][0]);}}
}
function project(p){
 const rel=math.sub(p,{x:motion.root.x,y:motion.ground(motion.root),z:motion.root.z}),s=Math.min(W*.37,H*.36);
 const a=camMode==='side'?0:camMode==='front'?Math.PI/2:camMode==='tactical'?.70:1.08;
 const elev=camMode==='tactical'?.82:.34;
 const x=rel.x*Math.sin(a)-rel.z*Math.cos(a),depth=rel.x*Math.cos(a)+rel.z*Math.sin(a);
 return {x:W*.50+x*s,y:H*.79-rel.y*s+depth*s*elev,depth};
}
function line3(a,b,color,width){const pa=project(a),pb=project(b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();}
function dot3(a,color,r){const p=project(a);ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();}
function fallbackRender(){
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
 const gradient=ctx.createRadialGradient(W*.47,H*.37,4,W*.5,H*.6,Math.max(W,H)*.70);gradient.addColorStop(0,'#243b32');gradient.addColorStop(1,'#0e1a17');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
 const j=motion.pose.joints,s=Math.min(W*.37,H*.36),r=motion.root;
 for(let z=Math.floor(r.z)-3;z<r.z+5;z++)line3({x:r.x-2,y:motion.slope*z,z},{x:r.x+2,y:motion.slope*z,z},'#43564b55',1);
 for(let x=-2;x<=2;x++)line3({x:r.x+x,y:motion.slope*(r.z-3),z:r.z-3},{x:r.x+x,y:motion.slope*(r.z+5),z:r.z+5},'#43564b33',1);
 const center=project({x:r.x,y:motion.ground(r),z:r.z});ctx.fillStyle='#04090866';ctx.beginPath();ctx.ellipse(center.x,center.y,.26*s,.08*s,0,0,Math.PI*2);ctx.fill();
 for(const side of ['L','R']){
   line3(j['hip'+side],j['knee'+side],'#758173',.155*s);line3(j['knee'+side],j['ankle'+side],'#685044',.123*s);
   dot3(j['knee'+side],'#a1aaa0',.07*s);
   const foot=motion.pose.feet[side==='L'?0:1],toe=math.add(foot.pos,math.yawRotate({x:0,y:-.042,z:.19},foot.yaw));
   line3(foot.pos,toe,'#554337',.12*s);
   line3(j['shoulder'+side],j['elbow'+side],'#79806d',.12*s);line3(j['elbow'+side],j['hand'+side],'#785a41',.105*s);
 }
 line3(j.pelvis,j.neck,'#414e42',.40*s);
 line3(j.pelvis,math.lerp(j.pelvis,j.neck,.19),'#896440',.43*s);
 dot3(j.head,'#be9375',.127*s);
 const head=project(j.head);ctx.fillStyle='#929c98';ctx.beginPath();ctx.moveTo(head.x-.145*s,head.y-.015*s);ctx.lineTo(head.x-.11*s,head.y-.15*s);ctx.lineTo(head.x,head.y-.205*s);ctx.lineTo(head.x+.10*s,head.y-.15*s);ctx.lineTo(head.x+.145*s,head.y-.015*s);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#b8a575';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(head.x-.135*s,head.y-.015*s);ctx.lineTo(head.x+.135*s,head.y-.015*s);ctx.stroke();
 line3(motion.pose.swordBase,motion.pose.swordTip,'#d5ded5',.031*s);
 const shield=project(motion.pose.shieldCenter);ctx.save();ctx.translate(shield.x,shield.y);ctx.fillStyle='#814c39';ctx.strokeStyle='#afb29b';ctx.lineWidth=.019*s;ctx.beginPath();ctx.ellipse(0,0,.265*s,.34*s,-.1,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#c2b58d';ctx.fillRect(-.022*s,-.3*s,.044*s,.6*s);ctx.fillStyle='#9ba39a';ctx.beginPath();ctx.ellipse(0,0,.075*s,.09*s,0,0,Math.PI*2);ctx.fill();ctx.restore();
 if(diagnostics){
   for(const side of ['L','R']){
     const color=side==='L'?'#dabb76':'#81c4cc';
     line3(j['hip'+side],j['knee'+side],color,1.5);line3(j['knee'+side],j['ankle'+side],color,1.5);
     for(const k of ['hip','knee','ankle','shoulder','elbow','hand'])dot3(j[k+side],color,2.3);
     const f=motion.pose.feet[side==='L'?0:1],p=project(f.pos);
     ctx.strokeStyle=color;ctx.setLineDash(f.planted?[]:[3,4]);ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(p.x,p.y+5,.13*s,.035*s,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
   }
 }
 ctx.fillStyle='#b9c7bc';ctx.textAlign='left';ctx.font='10px system-ui';ctx.fillText('APERÇU 2D DE CONTRÔLE · LE RENDU BABYLON SE CHARGE SÉPARÉMENT',18,H-16);
}
function readouts(){
 const p=motion.pose;$('actionName').textContent=motion.guard>.02&&motion.mode==='idle'?'BOUCLIER':labels[p.phase]||labels[motion.mode];
 $('phase').textContent=motion.mode==='strike'?(motion.t<.38?'Préparation':motion.t<.73?'Frappe / contact':'Récupération'):
   motion.mode==='charge'?(motion.chargePhase==='align'?'Appuis → axe du front':'Accélération → arrêt'):
   motion.mode==='recover'?'Retour progressif en garde':motion.guard>.01?(p.protected?'Protection en place':'Bouclier en transition'):motion.speed>.02?'Appui au sol → pied levé → pose du pied':'Deux appuis • respiration';
 $('footL').textContent=p.feet[0].planted?'APPUI':'LEVÉ';$('footR').textContent=p.feet[1].planted?'APPUI':'LEVÉ';
 $('footL').classList.toggle('air',!p.feet[0].planted);$('footR').classList.toggle('air',!p.feet[1].planted);
 $('drift').textContent=(motion.maxDrift*1000).toFixed(2)+' mm';$('reach').textContent=(motion.maxReachError*1000).toFixed(2)+' mm';
 $('velocity').textContent=motion.speed.toFixed(2)+' m/s';$('contactCount').textContent=String(motion.impactCount).padStart(2,'0');
 $('shieldState').textContent=p.protected?'EN PLACE':motion.guard>.01?'EN MOUVEMENT':'BAISSÉ';
 $('elapsed').textContent=motion.time.toFixed(2)+' s';$('modeBadge').textContent=paused?'EN PAUSE':hidden?'SUSPENDU':'EN MOUVEMENT';
 document.querySelectorAll('[data-action]').forEach(b=>b.classList.toggle('active',b.dataset.action===motion.mode||(b.dataset.action==='guard'&&motion.guardTarget>.5)));
}
function render(dt){
 if(renderer){try{renderer.apply(motion.pose,motion,diagnostics,dt);}catch(e){console.error(e);renderer.dispose();renderer=null;gl.hidden=true;fallback.hidden=false;$('engineStatus').textContent='Erreur 3D · aperçu de contrôle conservé';$('engineStatus').className='engine warning';$('retry3d').hidden=false;}}
 if(!renderer)fallbackRender();readouts();
}
function frame(now){const dt=Math.max(0,Math.min(.05,(now-frameTime)/1000));frameTime=now;if(!paused&&!hidden)advance(dt*speed);if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('show');}render(paused||hidden?0:dt*speed);requestAnimationFrame(frame);}
let loading=false;
function loadScript(url,timeout=7000){return new Promise((resolve,reject)=>{let done=false;const s=document.createElement('script');const fail=()=>{if(done)return;done=true;s.remove();reject(new Error('Chargement impossible : '+url));};const timer=setTimeout(fail,timeout);s.src=url;s.async=true;s.onload=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};s.onerror=()=>{clearTimeout(timer);fail();};document.head.appendChild(s);});}
async function start3D(){
 if(loading||renderer)return;loading=true;$('engineStatus').textContent='Connexion au moteur Babylon…';$('retry3d').hidden=true;
 const sources=['https://cdn.jsdelivr.net/npm/babylonjs@8.26.0/babylon.js','https://unpkg.com/babylonjs@8.26.0/babylon.js'];
 try{
   if(!window.BABYLON){let last;for(const url of sources){try{await loadScript(url);last=null;break;}catch(e){last=e;}}if(last)throw last;}
   gl.hidden=false;renderer=createBabylonView(gl);renderer.apply(motion.pose,motion,diagnostics,0);fallback.hidden=true;resize();
   $('engineStatus').textContent='Babylon.js '+BABYLON.Engine.Version+' · 3D';$('engineStatus').className='engine';
 }catch(e){if(renderer){renderer.dispose();renderer=null;}gl.hidden=true;fallback.hidden=false;$('engineStatus').textContent='Moteur 3D indisponible · contrôle 2D actif';$('engineStatus').className='engine warning';$('retry3d').hidden=false;console.warn(e.message);}
 finally{loading=false;}
}
$('retry3d').addEventListener('click',start3D);
resize();render(0);requestAnimationFrame(frame);
window.RDNWorkshop={motion,advance,render,command:runAction,get paused(){return paused;},setPaused(v){paused=!!v;updatePause();},get renderer(){return renderer;},get hidden(){return hidden;}};
if(new URLSearchParams(location.search).get('diagnostic')==='1'){$('engineStatus').textContent='Mode diagnostic 2D demandé';$('retry3d').hidden=false;}else start3D();
})();
