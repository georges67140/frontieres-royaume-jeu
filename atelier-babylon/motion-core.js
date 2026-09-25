/* Les Rangs du Nord — motion laboratory 0.1.0.
 * Pure, deterministic motion/IK. Metres, seconds, +Y up, +Z facing forward.
 * No timer callbacks, engine globals, asset downloads or DOM dependencies.
 */
(function (global) {
  'use strict';
  const PI=Math.PI, TAU=2*PI;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const v=(x=0,y=0,z=0)=>({x,y,z});
  const add=(a,b)=>v(a.x+b.x,a.y+b.y,a.z+b.z);
  const sub=(a,b)=>v(a.x-b.x,a.y-b.y,a.z-b.z);
  const mul=(a,k)=>v(a.x*k,a.y*k,a.z*k);
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const len=a=>Math.hypot(a.x,a.y,a.z);
  const unit=a=>mul(a,1/(len(a)||1));
  const lerp=(a,b,t)=>add(a,mul(sub(b,a),t));
  const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
  const yawRotate=(a,yaw)=>v(a.x*Math.cos(yaw)+a.z*Math.sin(yaw),a.y,-a.x*Math.sin(yaw)+a.z*Math.cos(yaw));
  const approach=(x,target,amount)=>x+clamp(target-x,-amount,amount);
  function twoBone(a,b,l1,l2,pole) {
    const delta=sub(b,a), distance=len(delta);
    const dir=distance>1e-8?mul(delta,1/distance):v(0,-1,0);
    const reach=clamp(distance,Math.abs(l1-l2)+1e-6,l1+l2-1e-6);
    let bend=sub(sub(pole,a),mul(dir,dot(sub(pole,a),dir)));
    if(len(bend)<1e-7){bend=sub(v(0,0,1),mul(dir,dir.z));if(len(bend)<1e-7)bend=sub(v(1,0,0),mul(dir,dir.x));}
    bend=unit(bend);
    const along=(l1*l1-l2*l2+reach*reach)/(2*reach);
    const height=Math.sqrt(Math.max(0,l1*l1-along*along));
    return {joint:add(add(a,mul(dir,along)),mul(bend,height)),end:add(a,mul(dir,reach)),error:Math.abs(distance-reach)};
  }
  function track(keys,t){
    if(t<=keys[0][0])return v(...keys[0][1]);
    for(let i=1;i<keys.length;i++)if(t<=keys[i][0])return lerp(v(...keys[i-1][1]),v(...keys[i][1]),smooth((t-keys[i-1][0])/(keys[i][0]-keys[i-1][0])));
    return v(...keys[keys.length-1][1]);
  }
  const HAND=[ [0,[.37,1.27,.06]], [.38,[.38,1.73,-.13]], [.54,[.22,1.47,.44]], [.73,[.11,1.25,.46]], [1.42,[.37,1.27,.06]] ];
  const BLADE=[ [0,[.10,-.91,.39]], [.38,[.16,.93,-.33]], [.54,[-.14,.08,.99]], [.73,[-.36,-.80,.48]], [1.42,[.10,-.91,.39]] ];
  function segmentDistance(a,b,p){const d=sub(b,a),s=dot(d,d);const t=s>1e-12?clamp(dot(sub(p,a),d)/s,0,1):0;return len(sub(add(a,mul(d,t)),p));}
  class Controller {
    constructor(){this.slope=0;this.reset();}
    ground(p){return this.slope*p.z;}
    reset(){
      this.time=0;this.root=v();this.yaw=0;this.attackYaw=0;this.speed=0;this.mode='idle';this.t=0;this.guard=0;
      this.guardTarget=0;this.recovery=null;this.turnFrom=0;this.turnTo=0;this.lastFoot=1;this.events=[];this.impactCount=0;
      this.actionId=0;this.hitThisAction=false;this.chargePhase='none';this.distance=0;this.maxDrift=0;this.maxReachError=0;
      this.feet=[-1,1].map((side,i)=>{const a=v(side*.145,.11,i===0?.05:-.04);a.y+=this.ground(a);return {side,anchor:a,pos:{...a},yaw:0,planted:true,swing:null,pitch:0};});
      this.pose=this.evaluate();
    }
    setSlope(s){this.slope=clamp(Number(s)||0,0,.10);this.reset();}
    point(local){return add(v(this.root.x,this.ground(this.root),this.root.z),yawRotate(local,this.yaw));}
    command(action){
      if(!['walk','stop','turn','guard','strike','charge'].includes(action))return false;
      if(action==='stop'){if(this.mode==='strike'){this.recovery={hand:track(HAND,this.t),blade:track(BLADE,this.t)};this.mode='recover';}else if(this.mode!=='recover'){this.mode='idle';}this.t=0;this.guardTarget=0;this.chargePhase='none';return true;}
      if(['strike','turn','charge','recover'].includes(this.mode))return false;
      if(action==='guard'){this.guardTarget=this.guardTarget>.5?0:1;this.mode='idle';this.t=0;return true;}
      this.guardTarget=0;this.actionId++;this.hitThisAction=false;this.t=0;
      this.mode=action;
      if(action==='turn'){this.turnFrom=this.yaw;this.turnTo=this.yaw+PI;}
      if(action==='charge'){this.chargePhase='align';this.turnFrom=this.yaw;this.turnTo=this.yaw+angle(this.attackYaw-this.yaw);}
      return true;
    }
    expectedFoot(i,future=.0){
      const side=this.feet[i].side;
      const yr=this.mode==='turn'?mix(this.turnFrom,this.turnTo,smooth((this.t+future)/1.8)):
        this.mode==='charge'&&this.chargePhase==='align'?mix(this.turnFrom,this.turnTo,smooth((this.t+future)/1.2)):this.yaw;
      let local=v(side*.145,0,i===0?.045:-.045);
      if(this.speed>.03)local.z=.23+this.speed*.18;
      const p=add(this.root,yawRotate(local,yr));p.y=this.ground(p)+.11;
      return {p,yaw:yr};
    }
    startStep(i){
      const foot=this.feet[i],duration=this.speed>1?.29:.37;
      const target=this.expectedFoot(i,duration*.65);
      foot.planted=false;foot.swing={t:0,duration,start:{...foot.pos},end:target.p,fromYaw:foot.yaw,toYaw:target.yaw};
      this.lastFoot=i;
    }
    updateFeet(dt){
      let hasSwing=false;
      for(const foot of this.feet){
        const s=foot.swing;
        if(s){
          s.t+=dt;const t=clamp(s.t/s.duration,0,1),ease=smooth(t);
          foot.pos=lerp(s.start,s.end,ease);
          foot.pos.y+=Math.sin(PI*t)*(.085+.045*this.speed);
          foot.yaw=s.fromYaw+angle(s.toYaw-s.fromYaw)*ease;
          foot.pitch=-Math.sin(PI*t)*.24;
          if(t>=1){foot.pos={...s.end};foot.anchor={...s.end};foot.yaw=s.toYaw;foot.pitch=0;foot.swing=null;foot.planted=true;}
          else hasSwing=true;
        } else {foot.pos={...foot.anchor};foot.pitch=0;foot.planted=true;}
      }
      if(hasSwing)return;
      const facing=yawRotate(v(0,0,1),this.yaw);
      const behind=this.feet.map(f=>dot(sub(f.pos,this.root),facing));
      let candidate=-1;
      if(this.speed>.035){
        const i=behind[0]<behind[1]?0:1;
        if(behind[i]<-.11)candidate=i;
      } else {
        const errors=this.feet.map((f,i)=>{const target=this.expectedFoot(i,.25);return len(sub(target.p,f.pos))+Math.abs(angle(target.yaw-f.yaw))*.1;});
        const i=errors[0]>errors[1]?0:1;
        if(errors[i]>.026)candidate=i;
      }
      if(candidate>=0)this.startStep(candidate);
    }
    step(dt){
      if(!Number.isFinite(dt)||dt<0)throw new RangeError('dt must be finite and non-negative');
      if(dt>1/120+1e-10){let remaining=Math.min(dt,.25);while(remaining>1e-9){const h=Math.min(remaining,1/120);this.step(h);remaining-=h;}return;}
      this.time+=dt;this.t+=dt;
      let desired=this.mode==='walk'?.72:0;
      if(this.mode==='turn'){
        this.yaw=mix(this.turnFrom,this.turnTo,smooth(this.t/1.8));
        if(this.t>=2.35){this.yaw=this.turnTo;this.mode='idle';this.t=0;}
      }
      if(this.mode==='charge'){
        if(this.chargePhase==='align'){
          this.yaw=mix(this.turnFrom,this.turnTo,smooth(this.t/1.2));
          if(this.t>=1.7&&this.feet.every(f=>f.planted&&Math.abs(angle(f.yaw-this.turnTo))<.20)){
            this.chargePhase='rush';this.t=0;this.yaw=this.turnTo;
          }
        } else {desired=1.3;if(this.t>=1.85){this.mode='idle';this.chargePhase='none';desired=0;}}
      }
      if(Math.hypot(this.root.x,this.root.z)>9.3&&this.mode==='walk'){this.mode='idle';desired=0;}
      this.speed=approach(this.speed,desired,dt*(desired>this.speed?1.8:3.6));
      const travel=this.speed*dt,forward=yawRotate(v(0,0,1),this.yaw);
      this.root=add(this.root,mul(forward,travel));this.root.y=0;this.distance+=travel;
      this.guard=approach(this.guard,this.guardTarget,dt/0.7);
      this.updateFeet(dt);
      if(this.mode==='strike'&&this.t>=1.42){this.mode='idle';this.t=0;}
      if(this.mode==='recover'&&this.t>=.32){this.mode='idle';this.recovery=null;this.t=0;}
      this.pose=this.evaluate();
      if(this.mode==='strike'&&!this.hitThisAction&&this.t>=.40&&this.t<=.67){
        const target=this.point(v(.06,1.42,1.08));
        const d=segmentDistance(this.pose.swordBase,this.pose.swordTip,target);
        if(d<.24){this.hitThisAction=true;this.impactCount++;this.events.push({type:'contact',time:this.time,actionId:this.actionId,point:target});}
      }
      for(const f of this.feet)if(f.planted)this.maxDrift=Math.max(this.maxDrift,len(sub(f.pos,f.anchor)));
      this.maxReachError=Math.max(this.maxReachError,this.pose.reachError);
    }
    evaluate(){
      const feet=this.feet;
      let height=1.005+.003*Math.sin(this.time*1.7)-.05*smooth(this.guard)+Math.sin(this.distance*2*PI/.62)*.012*Math.min(1,this.speed/.4);
      for(let i=0;i<2;i++){
        const local=this.point(v(feet[i].side*.145,0,0)),d=feet[i].pos;
        const horizontal=Math.hypot(local.x-d.x,local.z-d.z);
        const cap=Math.sqrt(Math.max(.48*.48,.975*.975-horizontal*horizontal));
        height=Math.min(height,d.y-this.ground(this.root)+cap);
      }
      const pelvis=this.point(v(0,height,0));
      const crouch=height-1.005;
      const j={pelvis,neck:this.point(v(0,1.67+crouch,0)),head:this.point(v(0,1.83+crouch,.018))};
      let error=0;
      for(let i=0;i<2;i++){
        const side=i===0?'L':'R',hip=this.point(v(feet[i].side*.145,height,0));
        const pole=this.point(v(feet[i].side*.24,.50,.55));
        const solved=twoBone(hip,feet[i].pos,.50,.50,pole);
        j['hip'+side]=hip;j['knee'+side]=solved.joint;j['ankle'+side]=solved.end;error=Math.max(error,solved.error);
      }
      const guard=smooth(this.guard);
      const left=lerp(v(-.37,1.23,.09),v(-.31,1.48,.45),guard);
      let right=this.mode==='strike'?track(HAND,this.t):this.mode==='recover'&&this.recovery?lerp(this.recovery.hand,v(.37,1.27,.06),smooth(this.t/.32)):v(.37,1.27,.06);
      if(this.mode==='walk'||this.chargePhase==='rush')right=add(right,v(0,0,Math.sin(this.distance*TAU/.62)*.065));
      const hands=[left,right];
      for(let i=0;i<2;i++){
        const side=i===0?'L':'R',sign=i===0?-1:1;
        const shoulder=this.point(v(sign*.255,1.57+crouch,0));
        const hand=this.point(add(hands[i],v(0,crouch,0)));
        const pole=this.point(v(sign*.8,1.35+crouch,-.24));
        const arm=twoBone(shoulder,hand,.315,.31,pole);
        j['shoulder'+side]=shoulder;j['elbow'+side]=arm.joint;j['hand'+side]=arm.end;
        error=Math.max(error,arm.error);
      }
      const bladeLocal=this.mode==='strike'?track(BLADE,this.t):this.mode==='recover'&&this.recovery?lerp(this.recovery.blade,v(.10,-.91,.39),smooth(this.t/.32)):v(.10,-.91,.39);
      const swordDirection=yawRotate(unit(bladeLocal),this.yaw);
      return {joints:j,feet:feet.map(f=>({pos:{...f.pos},yaw:f.yaw,pitch:f.pitch,planted:f.planted,anchor:{...f.anchor}})),
        yaw:this.yaw,root:{...this.root},pelvisHeight:height,guard:this.guard,protected:guard>=.95,
        swordDir:swordDirection,swordBase:add(j.handR,mul(swordDirection,.12)),swordTip:add(j.handR,mul(swordDirection,.86)),
        shieldCenter:add(j.handL,yawRotate(v(-.02,0,.055),this.yaw)),reachError:error,
        shieldYaw:this.yaw-.85*(1-guard),shieldTilt:-.12*guard,
        phase:this.mode==='charge'?this.chargePhase:this.mode,
        footDrift:Math.max(...feet.filter(f=>f.planted).map(f=>len(sub(f.pos,f.anchor))),0)};
    }
    drainEvents(){const e=this.events;this.events=[];return e;}
  }
  const api={Controller,twoBone,segmentDistance,track,math:{v,add,sub,mul,dot,len,unit,lerp,clamp,mix,smooth,yawRotate,angle}};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else global.RDNMotion=api;
})(typeof globalThis!=='undefined'?globalThis:this);
