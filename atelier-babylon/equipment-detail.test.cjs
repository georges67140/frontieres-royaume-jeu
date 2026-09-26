'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('./equipment-detail.js');
const v=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>v(a.x+b.x,a.y+b.y,a.z+b.z),sub=(a,b)=>v(a.x-b.x,a.y-b.y,a.z-b.z);
const mul=(a,k)=>v(a.x*k,a.y*k,a.z*k),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,len=a=>Math.hypot(a.x,a.y,a.z);
const unit=a=>mul(a,1/(len(a)||1));
const rotate=(a,y)=>v(a.x*Math.cos(y)+a.z*Math.sin(y),a.y,-a.x*Math.sin(y)+a.z*Math.cos(y));
// Reference solver from the unchanged workshop controller.
function twoBone(a,b,l1,l2,pole){
  const delta=sub(b,a),distance=len(delta),dir=distance>1e-8?mul(delta,1/distance):v(0,-1,0);
  const reach=Math.max(Math.abs(l1-l2)+1e-6,Math.min(l1+l2-1e-6,distance));
  let bend=sub(sub(pole,a),mul(dir,dot(sub(pole,a),dir)));
  if(len(bend)<1e-7){bend=sub(v(0,0,1),mul(dir,dir.z));if(len(bend)<1e-7)bend=sub(v(1,0,0),mul(dir,dir.x));}
  bend=unit(bend);const along=(l1*l1-l2*l2+reach*reach)/(2*reach),h=Math.sqrt(Math.max(0,l1*l1-along*along));
  return {joint:add(add(a,mul(dir,along)),mul(bend,h)),end:add(a,mul(dir,reach)),error:Math.abs(distance-reach)};
}
function fixture(yaw=0,root=v()){
  const point=a=>add(root,rotate(a,yaw));
  return {yaw,root,pelvisHeight:1.005,feet:[{anchor:v(),planted:true}],guard:0,protected:false,reachError:0,
    joints:{pelvis:point(v(0,1.005,0)),shoulderR:point(v(.255,1.57,0)),elbowR:point(v(.49,1.42,-.2)),handR:point(v(.37,1.27,.06)),handL:point(v(-.37,1.23,.09)),ankleR:point(v(.145,.11,0))},
    swordDir:rotate(unit(v(.1,-.91,.39)),yaw),swordBase:point(v()),swordTip:point(v()),shieldCenter:point(v(-.39,1.23,.145))};
}
function ctl(mode='walk',t=0){return {mode,t,distance:1.9,speed:.72};}
const motion={twoBone};
const close=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
function triangles(data,fn){for(let i=0;i<data.indices.length;i+=3){const pts=data.indices.slice(i,i+3).map(k=>v(...data.positions.slice(k*3,k*3+3)));fn(pts,i);}}
const cross=(a,b)=>v(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
test('version identifies the new equipment layer',()=>assert.equal(P.version,'0.3.0'));
test('no input pose is mutated',()=>{const p=fixture(),saved=JSON.stringify(p);P.refinePose(p,ctl(),motion);assert.equal(JSON.stringify(p),saved);});
test('feet, root, shield and left hand are untouched',()=>{const p=fixture(),q=P.refinePose(p,ctl(),motion);for(const key of ['feet','root','shieldCenter'])assert.equal(q[key],p[key]);assert.equal(q.joints.handL,p.joints.handL);assert.equal(q.joints.ankleR,p.joints.ankleR);});
test('arm segment lengths remain physical across headings and gait phases',()=>{for(let i=0;i<120;i++){const p=fixture(i*.11,v(2,.8,-4)),c=ctl();c.distance=i*.037;const q=P.refinePose(p,c,motion);close(len(sub(q.joints.shoulderR,q.joints.elbowR)),.315);close(len(sub(q.joints.elbowR,q.joints.handR)),.31);assert.ok(q.reachError<1e-6);}});
test('right elbow no longer flares far from the body',()=>{const q=P.refinePose(fixture(),ctl(),motion);assert.ok(q.joints.elbowR.x<.50);assert.ok(q.joints.handR.y<1.13);});
test('sword length and unit direction match original combat geometry',()=>{const q=P.refinePose(fixture(),ctl(),motion);close(len(q.swordDir),1);close(len(sub(q.swordTip,q.joints.handR)),.86);close(len(sub(q.swordBase,q.joints.handR)),.12);});
test('carried blade clears flat and ten-percent sloped ground',()=>{for(let i=0;i<60;i++){const p=fixture(i*.1,v(0,1.5,15)),c=ctl();c.distance=i*.1;const q=P.refinePose(p,c,motion);assert.ok(q.swordTip.y-.1*q.swordTip.z>.35);}});
test('every attack contact-window pose is unchanged by identity',()=>{for(let t=.40;t<=.67;t+=.01){const p=fixture();assert.equal(P.refinePose(p,ctl('strike',t),motion),p);}});
test('attack entry and recovery blends are bounded and continuous',()=>{close(P.carryWeight(ctl('strike',0)),1);close(P.carryWeight(ctl('strike',.18)),0);close(P.carryWeight(ctl('strike',1.24)),0);close(P.carryWeight(ctl('strike',1.42)),1);close(P.carryWeight(ctl('recover',0)),0);close(P.carryWeight(ctl('recover',.32)),1);});
test('blade is a watertight indexed mesh',()=>{const d=P.bladeData(),edges=new Map();for(let i=0;i<d.indices.length;i+=3){const f=d.indices.slice(i,i+3);for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3],key=[a,b].sort((a,b)=>a-b).join(':');edges.set(key,(edges.get(key)||0)+1);}}for(const count of edges.values())assert.equal(count,2);assert.equal(d.positions.length/3-edges.size+d.indices.length/3,2);});
test('blade has no degenerate triangles or out-of-range indices',()=>{const d=P.bladeData();assert.ok(d.indices.every(i=>i>=0&&i<d.positions.length/3));triangles(d,([a,b,c])=>assert.ok(len(cross(sub(b,a),sub(c,a)))>1e-9));});
test('blade uses Babylon left-handed outward winding',()=>{const d=P.bladeData();let volume=0;triangles(d,([a,b,c])=>volume+=dot(a,cross(b,c))/6);assert.ok(volume<0);});
test('rounded helmet is finite and fits the existing head',()=>{const d=P.domeData();assert.ok(d.positions.every(Number.isFinite));close(Math.max(...d.positions.filter((_,i)=>i%3===1)),.244);triangles(d,([a,b,c])=>assert.ok(len(cross(sub(b,a),sub(c,a)))>1e-9));});
test('pebbles are deterministic and stay outside the walking lane',()=>{const d=P.pebbleData();assert.deepEqual(d,P.pebbleData());assert.equal(d.colors.length,d.positions.length/3*4);assert.equal(d.indices.length,160*5*3);assert.ok(d.positions.filter((_,i)=>i%3===0).every(x=>Math.abs(x)>1.8));});
test('install rejects a missing or diagnostic-only renderer',()=>{assert.throws(()=>P.install({},null,null),/Atelier Babylon/);assert.throws(()=>P.install({renderer:{kind:'diagnostic'}},{},motion),/Atelier Babylon/);});
