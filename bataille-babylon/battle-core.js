/* Les Rangs du Nord — battle 0.2.0. No renderer dependency.
 * Extends, rather than replaces, the Atelier's RDNMotion.Controller and IK.
 * World positions and planted-foot anchors are never teleported by an order.
 */
(function(g){'use strict';
const M=typeof module!=='undefined'&&module.exports?require('../atelier-babylon/motion-core.js'):g.RDNMotion;
const {v,add,sub,mul,len,lerp,clamp,smooth,yawRotate,angle}=M.math;
const approach=(a,b,d)=>a+clamp(b-a,-d,d),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const FORMS=['line','wall','wedge','loose'];
function heightAt(x,z){return .10*Math.sin(x*.18)*Math.cos(z*.24)+1.45*Math.exp(-((x+7)**2/45+(z-9)**2/17))+.8*Math.exp(-((x-12)**2/60+(z+10)**2/25));}
function terrainAt(x,z){return Math.abs(z-(8.2+Math.sin(x*.13)*1.5))<.7?'water':Math.abs(z-.7*Math.sin(x*.15))<1.7?'road':Math.abs(z)>5?'grass':'field';}
function slots(n,form,side){const cols=form==='wall'?6:form==='loose'?8:6,spacing=form==='wall'?.82:form==='loose'?1.33:1.04;return Array.from({length:n},(_,i)=>{const row=Math.floor(i/cols),col=i%cols;let x=side*(1.5-row)*spacing,z=(col-(Math.min(n,cols)-1)/2)*spacing;if(form==='wedge')x+=side*(2.5-Math.abs(col-2.5))*.65;return{x,z};});}
class Soldier extends M.Controller{
 ground(p){return heightAt(p.x,p.z);}
 constructor(id,side,x,z,role='sword',rank=0){super();this.id=id;this.side=side;this.role=role;this.rank=rank;this.hp=100+rank*15;this.maxHp=this.hp;this.xp=rank*2;this.vx=0;this.vz=0;this.dead=false;this.deathTime=0;this.attackTarget=null;this.cooldown=(id%7)*.09;this.draw=0;this.shotTime=-1;this.hitFlash=0;this.actionHit=false;this.delay=(id%8)*.035;this.root=v(x,0,z);this.yaw=side*Math.PI/2;
 for(let i=0;i<2;i++){const f=this.feet[i],p=add(this.root,yawRotate(v(f.side*.145,0,i===0?.05:-.04),this.yaw));p.y=this.ground(p)+.11;Object.assign(f,{pos:{...p},anchor:{...p},yaw:this.yaw,planted:true,swing:null});}this.pose=this.evaluate();}
 expectedFoot(i,future=0){const f=this.feet[i],p=add(this.root,yawRotate(v(f.side*.145,0,i===0?.045:-.045),this.yaw));p.x+=this.vx*(future+.12);p.z+=this.vz*(future+.12);p.y=this.ground(p)+.11;return{p,yaw:this.yaw};}
 updateFeet(dt){let swinging=false;for(const f of this.feet){const s=f.swing;if(s){s.t+=dt;const t=clamp(s.t/s.duration,0,1);f.pos=lerp(s.start,s.end,smooth(t));f.pos.y+=Math.sin(Math.PI*t)*(.08+.025*this.speed);f.yaw=s.fromYaw+angle(s.toYaw-s.fromYaw)*smooth(t);f.pitch=-Math.sin(Math.PI*t)*.20;if(t>=1){f.pos={...s.end};f.anchor={...s.end};f.swing=null;f.planted=true;f.pitch=0;}else swinging=true;}else{f.pos={...f.anchor};f.planted=true;f.pitch=0;}}if(swinging)return;let k=-1,big=0;for(let i=0;i<2;i++){const target=this.expectedFoot(i,.16),f=this.feet[i],error=dist(f.pos,target.p)+Math.abs(angle(f.yaw-target.yaw))*.10;if(error>big){big=error;k=i;}}if(big>(this.speed>.04?.19:.037))this.startStep(k);}
 advance(dt,target,face,maxSpeed,guard){if(this.dead)return;this.time+=dt;this.t+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.hitFlash=Math.max(0,this.hitFlash-dt*3);
 const delta=sub(target,this.root),d=Math.hypot(delta.x,delta.z),striking=this.mode==='strike',want=striking?0:Math.min(maxSpeed,d*2.4),weight=terrainAt(this.root.x,this.root.z)==='water'?.55:1;
 const wx=d>.02?delta.x/d*want*weight:0,wz=d>.02?delta.z/d*want*weight:0;this.vx=approach(this.vx,wx,dt*2.7);this.vz=approach(this.vz,wz,dt*2.7);this.speed=Math.hypot(this.vx,this.vz);
 this.root.x+=this.vx*dt;this.root.z+=this.vz*dt;this.distance+=this.speed*dt;
 if(!striking)this.yaw+=clamp(angle(face-this.yaw),-dt*1.7,dt*1.7);
 this.guard=approach(this.guard,guard,dt*(this.rank?1.8:1.15));this.guardTarget=guard;
 if(striking&&this.t>=1.42){this.mode='idle';this.t=0;}else if(!striking)this.mode=this.speed>.04?'walk':'idle';
 this.updateFeet(dt);this.pose=this.evaluate();
 if(this.role==='archer')this.archerPose();
 for(const f of this.feet)if(f.planted)this.maxDrift=Math.max(this.maxDrift,len(sub(f.pos,f.anchor)));
 }
 archerPose(){const p=this.pose,j=p.joints,crouch=p.pelvisHeight-1.005,d=this.draw;
 const positions=[v(-.19,1.39,.52),v(.26,1.4,.49-.45*d)];for(let i=0;i<2;i++){const side=i?'R':'L',sign=i?1:-1,hand=this.point(add(positions[i],v(0,crouch,0))),arm=M.twoBone(j['shoulder'+side],hand,.315,.31,this.point(v(sign*.7,1.32,-.15)));j['elbow'+side]=arm.joint;j['hand'+side]=arm.end;}
 }
 strike(target){if(this.dead||this.cooldown>0||this.role==='archer'||this.mode==='strike')return false;this.mode='strike';this.t=0;this.actionHit=false;this.attackTarget=target.id;this.cooldown=1.8+(this.id%5)*.13;return true;}
}
class Battle{
 constructor(seed=721){this.seed=seed>>>0;this.nextId=0;this.wave=1;this.time=0;this.state='ready';this.lastOrder=0;this.events=[];this.arrows=[];this.recruited=false;this.form='line';this.notice='Touchez le terrain pour avancer. Les ordres lancent la bataille.';this.player=this.makeArmy(1,-8);this.enemy=this.makeArmy(-1,8);this.units=[...this.player.units,...this.enemy.units];this.aiAt=3;this.volleyReady=0;this.rebuildSlots();}
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 makeArmy(side,x){const a={side,x,z:0,tx:x,tz:0,order:'hold',orderAt:0,form:'line',morale:100,courage:65,units:[]};for(let i=0;i<24;i++)a.units.push(new Soldier(this.nextId++,side,x+side*(1.5-Math.floor(i/6))*1.04,(i%6-2.5)*1.04,i>=18?'archer':'sword',i%11===0?1:0));return a;}
 alive(a){return a.units.filter(u=>!u.dead);}
 rebuildSlots(){for(const a of [this.player,this.enemy]){a.offsets=slots(a.units.length,a.form,a.side);}}
 issue(cmd,point){if(['victory','defeat','paused'].includes(this.state))return false;
 if(cmd==='charge'&&this.player.courage<30)return false;if(cmd==='volley'&&this.time<this.volleyReady)return false;if(cmd==='recruit'&&this.recruited)return false;
 if(!['move','shield','charge','volley','formation','recruit','hold'].includes(cmd))return false;
 if(cmd==='move'&&(!point||!Number.isFinite(point.x)||!Number.isFinite(point.z)))return false;
 this.state='running';this.lastOrder=this.time;const a=this.player;a.orderAt=this.time;
 if(cmd==='move'){if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.z))return false;a.tx=clamp(point.x,-18,18);a.tz=clamp(point.z,-4.7,4.7);a.order='advance';this.notice='Marche — les hommes rejoignent la destination.';}
 if(cmd==='hold'){a.tx=a.x;a.tz=a.z;a.order='hold';this.notice='Tenez la position.';}
 if(cmd==='shield'){a.order='shield';a.tx=a.x;a.tz=a.z;this.notice='Boucliers en place — formation inchangée.';}
 if(cmd==='charge'){a.order='charge';a.courage-=30;a.tx=Math.min(18,a.x+4.7);this.notice='Charge !';}
 if(cmd==='formation'){a.form=FORMS[(FORMS.indexOf(a.form)+1)%FORMS.length];this.form=a.form;a.order='hold';a.tx=a.x;this.rebuildSlots();this.notice='Formation : '+({line:'ligne',wall:'mur',wedge:'pointe',loose:'écartée'}[a.form]);}
 if(cmd==='volley'){a.order='volley';a.tx=a.x;a.tz=a.z;this.beginVolley(a);this.volleyReady=this.time+5;this.notice='Archers : encochez, tendez, lâchez.';}
 if(cmd==='recruit'){this.recruited=true;for(let i=0;i<6;i++){const u=new Soldier(this.nextId++,1,a.x-3.7,(i-2.5)*.95,'sword');u.hp=85;u.maxHp=85;a.units.push(u);this.units.push(u);}this.rebuildSlots();a.order='hold';a.tx=a.x;this.notice='Six recrues rejoignent les rangs.';}
 this.events.push({type:'order',name:cmd});return true;
 }
 beginVolley(a){for(const u of a.units)if(!u.dead&&u.role==='archer'&&u.shotTime<0){u.shotTime=0;u.draw=0;}}
 pause(){if(this.state==='running'){this.state='paused';return true;}if(this.state==='paused'){this.state='running';return true;}return false;}
 step(dt){if(!Number.isFinite(dt)||dt<0)throw new RangeError('Invalid time step');if(this.state!=='running')return;let rest=Math.min(dt,.25);while(rest>1e-8&&this.state==='running'){const h=Math.min(rest,1/60);this.tick(h);rest-=h;}}
 tick(dt){this.time+=dt;const p=this.player,e=this.enemy;
 if(this.time-this.lastOrder>=5){p.order='retreat';p.tx=-19;p.tz=p.z;p.morale=Math.max(0,p.morale-dt*.65);this.notice='Sans ordre, vos hommes cèdent du terrain.';}
 if(p.order==='charge'&&this.time-p.orderAt>3.8){p.order='hold';p.tx=p.x;}
 if(this.time>=this.aiAt){this.aiAt=this.time+3.5+this.random()*2;const distance=e.x-p.x,r=this.random();e.order=distance>7?'advance':p.order==='volley'&&r<.60?'shield':r<.25?'volley':r<.48?'charge':'advance';e.orderAt=this.time;if(e.order==='volley')this.beginVolley(e);}
 for(const a of [p,e]){const other=a===p?e:p;if(a===e){a.tx=Math.max(-18,p.x+4);a.tz=p.z*.5;if(a.morale<22){a.order='retreat';a.tx=19;}}
 let speed=a.order==='charge'?1.2:a.order==='advance'?.72:a.order==='retreat'?.6:0;
 if(a.order==='charge'&&this.time-a.orderAt<.55)speed=.10;
 if(a===e&&a.order==='advance'&&a.x-p.x<3.6)speed=.05;
 const d=Math.hypot(a.tx-a.x,a.tz-a.z);if(d>.02&&speed>0){const step=Math.min(d,speed*dt);a.x+=(a.tx-a.x)/d*step;a.z+=(a.tz-a.z)/d*step;}
 a.courage=clamp(a.courage+dt*(a.order==='retreat'?-1:1.4),0,100);
 for(let i=0;i<a.units.length;i++){const u=a.units[i];if(u.dead)continue;const o=a.offsets[i],enemy=this.nearest(u,other);let target=v(a.x+o.x,0,a.z+o.z),maxSpeed=speed>1?1.35:.9,face=a.side*Math.PI/2;
 if(a.order==='charge'){target.z+=Math.sin(u.id*2.43)*clamp(this.time-a.orderAt,0,3)*.20;maxSpeed=1.4;}
 if(enemy){const d=dist(u.root,enemy.root);if(d<2.4&&u.role!=='archer'){face=Math.atan2(enemy.root.x-u.root.x,enemy.root.z-u.root.z);if(d<1.20){target={...u.root};if(a.order!=='retreat'&&a.order!=='shield')u.strike(enemy);}else if(d<2.4&&a.order!=='retreat'&&a.order!=='shield'){const dx=(enemy.root.x-u.root.x)/d,dz=(enemy.root.z-u.root.z)/d;target=v(enemy.root.x-dx*1.08,0,enemy.root.z-dz*1.08);}}}
 // Soft, physical separation: alters destinations, never feet or world transforms.
 for(const near of this.units){if(near===u||near.dead)continue;const dx=u.root.x-near.root.x,dz=u.root.z-near.root.z,d2=dx*dx+dz*dz;if(d2<.51*.51&&d2>1e-6){const d=Math.sqrt(d2);target.x+=dx/d*(.51-d)*1.5;target.z+=dz/d*(.51-d)*1.5;}}
 const guard=a.order==='shield'&&this.time-a.orderAt>u.delay&&u.role!=='archer'?1:0;
 u.advance(dt,target,face,maxSpeed,guard);this.resolveMelee(u,a,other);
 if(u.shotTime>=0){const prev=u.shotTime;u.shotTime+=dt;u.draw=clamp((u.shotTime-u.delay-.4)/1.2,0,1);if(prev<1.8+u.delay&&u.shotTime>=1.8+u.delay){this.shoot(u,other);u.draw=0;}if(u.shotTime>2+u.delay)u.draw=0;if(u.shotTime>4.2)u.shotTime=-1;}
 }
 }
 this.updateArrows(dt);
 if(p.x<=-18.8||p.morale<=0||this.alive(p).length<4){this.state='defeat';this.notice='La ligne a cédé. Votre garnison se replie.';}
 else if(e.x>=18.8||e.morale<=0||this.alive(e).length<4){this.state='victory';this.notice='Victoire. Vos survivants gagnent de l’expérience.';for(const u of this.alive(p)){u.xp++;u.rank=Math.min(2,Math.floor(u.xp/2));}}
 }
 nearest(u,a){let best=null,d=Infinity;for(const other of a.units){if(other.dead)continue;const dd=dist(u.root,other.root);if(dd<d){d=dd;best=other;}}return best;}
 resolveMelee(u,a,other){if(u.mode!=='strike'||u.actionHit||u.t<.42||u.t>.73)return;const t=other.units.find(e=>e.id===u.attackTarget&&!e.dead);if(!t)return;const chest=v(t.root.x,heightAt(t.root.x,t.root.z)+1.35,t.root.z);if(M.segmentDistance(u.pose.swordBase,u.pose.swordTip,chest)>.53)return;
 u.actionHit=true;let damage=13+u.rank*3;if(a.order==='charge')damage*=other.form==='wall'?1:1.6;this.hit(t,damage,u.root,'melee');const push=(other.order==='shield'?.025:.09)*(a.order==='charge'?2:1);other.x+=a.side*push;other.tx+=a.side*push;}
 hit(target,damage,from,kind){if(target.dead)return;const incoming=Math.atan2(from.x-target.root.x,from.z-target.root.z),blocked=target.role!=='archer'&&target.guard>=.95&&Math.abs(angle(incoming-target.yaw))<1.3;if(blocked)damage*=kind==='arrow'?.10:.28;target.hp-=damage;target.hitFlash=.8;this.events.push({type:blocked?'block':'hit',x:target.root.x,y:heightAt(target.root.x,target.root.z)+1.25,z:target.root.z});if(target.hp<=0){target.dead=true;target.deathTime=this.time;const a=target.side===1?this.player:this.enemy;a.morale=Math.max(0,a.morale-3.8);this.events.push({type:'fallen',id:target.id});}}
 shoot(u,other){const live=this.alive(other);if(!live.length)return;const t=live[Math.floor(this.random()*live.length)],from=u.pose.joints.handL,spread=u.rank?.24:.58,to=v(t.root.x+(this.random()-.5)*spread,heightAt(t.root.x,t.root.z)+1.25,t.root.z+(this.random()-.5)*spread);this.arrows.push({from:{...from},to,side:u.side,t:0,duration:.7+dist(from,to)*.028,target:t.id,id:this.nextId++,dead:false});this.events.push({type:'shot'});}
 updateArrows(dt){for(const a of this.arrows){a.t+=dt;if(a.t>=a.duration){a.dead=true;const other=a.side===1?this.enemy:this.player,target=other.units.find(u=>u.id===a.target&&!u.dead);if(target&&dist(target.root,a.to)<.8)this.hit(target,24,a.from,'arrow');}}this.arrows=this.arrows.filter(a=>!a.dead);}
 nextWave(){if(this.state!=='victory')return null;const b=new Battle(this.seed);b.wave=this.wave+1;const survivors=this.alive(this.player);for(let i=0;i<Math.min(24,survivors.length);i++){b.player.units[i].xp=survivors[i].xp;b.player.units[i].rank=survivors[i].rank;}for(const u of b.enemy.units){u.maxHp+=Math.min(60,(b.wave-1)*8);u.hp=u.maxHp;}return b;}
 drainEvents(){const result=this.events;this.events=[];return result;}
 summary(){return{wave:this.wave,state:this.state,player:this.alive(this.player).length,enemy:this.alive(this.enemy).length,morale:Math.round(this.player.morale),courage:Math.round(this.player.courage),order:this.player.order,formation:this.player.form,remaining:Math.max(0,5-this.time+this.lastOrder),volleyWait:Math.max(0,this.volleyReady-this.time),recruited:this.recruited,notice:this.notice};}
}
const api={Battle,Soldier,heightAt,terrainAt,slots,FORMS};if(typeof module!=='undefined'&&module.exports)module.exports=api;else g.RDNBattle=api;
})(globalThis);
