/* Les Rangs du Nord: additive workshop equipment pass 0.3.0.
 * Keep the original game, controller, foot contacts and attack window intact.
 * Procedural geometry, not imported final-character assets.
 */
(function (global) {
  'use strict';
  const VERSION = '0.3.0', TAU = Math.PI * 2;
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const add = (a,b) => ({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
  const mix = (a,b,t) => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
  const unit = a => { const n=Math.hypot(a.x,a.y,a.z)||1; return {x:a.x/n,y:a.y/n,z:a.z/n}; };
  const rotate = (a,y) => ({x:a.x*Math.cos(y)+a.z*Math.sin(y),y:a.y,z:-a.x*Math.sin(y)+a.z*Math.cos(y)});
  function carryWeight(ctl) {
    if (ctl.mode === 'strike') return ctl.t < .18 ? 1-smooth(ctl.t/.18) : smooth((ctl.t-1.24)/.18);
    if (ctl.mode === 'recover') return smooth(ctl.t/.32);
    return 1;
  }
  function refinePose(p, ctl, motion) {
    const weight=carryWeight(ctl);
    if(weight<=0) return p; // Original hit/contact pose is deliberately identical.
    const gait=Math.sin(ctl.distance*TAU/.62)*.032*clamp(ctl.speed/.72);
    const local={x:.34,y:.075,z:.16+gait};
    const desired=add(p.joints.pelvis,rotate(local,p.yaw));
    const hand=mix(p.joints.handR,desired,weight);
    const pole=add(p.joints.pelvis,rotate({x:.48,y:.20,z:-.09},p.yaw));
    const arm=motion.twoBone(p.joints.shoulderR,hand,.315,.31,pole);
    const swordDir=unit(mix(p.swordDir,rotate(unit({x:.055,y:-.70,z:.71}),p.yaw),weight));
    const offset=n=>add(arm.end,{x:swordDir.x*n,y:swordDir.y*n,z:swordDir.z*n});
    return {...p,joints:{...p.joints,elbowR:arm.joint,handR:arm.end},swordDir,
      swordBase:offset(.12),swordTip:offset(.86),reachError:Math.max(p.reachError||0,arm.error)};
  }
  function bladeData() {
    // Closed, tapered blade; the centre groove is geometry, not a painted stripe.
    const profile=[[-1,0],[-.55,.72],[-.18,1],[0,.7],[.18,1],[.55,.72],[1,0],[.55,-.72],[.18,-1],[0,-.7],[-.18,-1],[-.55,-.72]];
    const rings=[[.14,.032,.010],[.25,.030,.009],[.57,.023,.008],[.735,.014,.005]];
    const positions=[],indices=[];
    rings.forEach(([y,w,d])=>profile.forEach(([x,z])=>positions.push(x*w,y,z*d)));
    for(let r=0;r<rings.length-1;r++)for(let i=0;i<12;i++){
      const a=r*12+i,b=r*12+(i+1)%12,c=b+12,d=a+12;
      indices.push(a,c,b,a,d,c);
    }
    const base=positions.length/3; positions.push(0,.14,0);
    const tip=positions.length/3; positions.push(0,.86,0);
    for(let i=0;i<12;i++){ const j=(i+1)%12; indices.push(base,i,j,36+i,tip,36+j); }
    return {positions,indices};
  }
  function domeData() {
    const rings=[[.058,.167],[.108,.165],[.156,.147],[.195,.117],[.225,.076],[.24,.03]];
    const positions=[],indices=[],n=24;
    rings.forEach(([y,r])=>{for(let i=0;i<n;i++){const a=i*TAU/n;positions.push(Math.sin(a)*r,y,Math.cos(a)*r);}});
    for(let k=0;k<rings.length-1;k++)for(let i=0;i<n;i++){
      const a=k*n+i,b=k*n+(i+1)%n;indices.push(a,a+n,b,b,a+n,b+n);
    }
    const tip=positions.length/3;positions.push(0,.244,0);
    for(let i=0;i<n;i++)indices.push(120+i,tip,120+(i+1)%n);
    return {positions,indices};
  }
  function pebbleData() {
    let seed=59013;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const positions=[],indices=[],colors=[];
    for(let i=0;i<160;i++){
      const x=(random()<.5?-1:1)*(2.1+random()*5),z=-6+random()*22;
      const r=.025+random()*.11,h=.025+random()*.08,a=random()*TAU,b=positions.length/3;
      const shade=.24+random()*.13;
      for(let k=0;k<5;k++){const t=a+k*TAU/5;positions.push(x+Math.cos(t)*r,.003,z+Math.sin(t)*r*.72);colors.push(shade*.95,shade,shade*.85,1);}
      positions.push(x+r*.13,h,z);colors.push(shade*1.28,shade*1.28,shade*1.08,1);
      for(let k=0;k<5;k++)indices.push(b+k,b+(k+1)%5,b+5);
    }
    return {positions,indices,colors};
  }
  function install(workshop,B,motion) {
    const view=workshop&&workshop.renderer;
    if(!view||view.kind!=='babylon'||!B||!motion||!motion.twoBone)throw new Error('Atelier Babylon et contrôleur requis.');
    if(view.equipmentDetails)return view.equipmentDetails;
    const scene=view.scene,owned=[],undo=[];
    const sword=scene.getTransformNodeByName('sword'),head=scene.getTransformNodeByName('head');
    if(!sword||!head)throw new Error('Le guerrier original est introuvable.');
    const shadow=scene.getLightByName('sun')?.getShadowGenerator();
    let observer=null,disposed=false;
    const keep=o=>{owned.push(o);return o;};
    function hide(o){if(!o)return;const enabled=o.isEnabled();undo.push(()=>o.setEnabled(enabled));o.setEnabled(false);}
    function finish(mesh,mat,parent,casts=true){keep(mesh);mesh.material=mat;mesh.parent=parent||null;mesh.isPickable=false;if(casts&&shadow){shadow.addShadowCaster(mesh);undo.push(()=>shadow.removeShadowCaster(mesh));}return mesh;}
    function geometry(name,data,mat,parent,casts=true){
      const mesh=new B.Mesh(name,scene);keep(mesh);const vd=new B.VertexData();
      vd.positions=data.positions;vd.indices=data.indices;vd.normals=[];if(data.colors)vd.colors=data.colors;
      B.VertexData.ComputeNormals(vd.positions,vd.indices,vd.normals);vd.applyToMesh(mesh,true);
      // Registered once in owned, even when a construction error occurs.
      owned.pop();return finish(mesh,mat,parent,casts);
    }
    function material(source,name,rough){const m=scene.getMaterialByName(source);if(!m)throw new Error('Matière absente : '+source);const c=keep(m.clone(name));c.roughness=rough;return c;}
    function cylinder(name,diameter,height,pos,mat,parent,n=12){
      const o=B.MeshBuilder.CreateCylinder(name,{diameter,height,tessellation:n},scene);o.position.set(...pos);return finish(o,mat,parent);
    }
    try{
      const steel=material('edge','rdn-forged-blade',.47),iron=material('steel','rdn-forged-hilt',.56);
      const leather=scene.getMaterialByName('leather'),brass=scene.getMaterialByName('gold');
      sword.getChildMeshes().slice().forEach(hide);
      geometry('rdn-fullered-blade',bladeData(),steel,sword);
      cylinder('rdn-wrapped-grip',.043,.175,[0,0,0],leather,sword);
      for(let i=0;i<7;i++){
        const ring=B.MeshBuilder.CreateTorus('rdn-grip-binding',{diameter:.044,thickness:.003,tessellation:12},scene);
        ring.position.y=-.069+i*.022;finish(ring,iron,sword,false);
      }
      const guard=[[-.133,.092,0],[-.08,.117,0],[0,.123,0],[.08,.117,0],[.133,.092,0]];
      for(let i=1;i<guard.length;i++){
        const a=guard[i-1],b=guard[i],d=new B.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
        const mesh=cylinder('rdn-curved-guard',.029,d.length(),[(a[0]+b[0])/2,(a[1]+b[1])/2,0],iron,sword,10);
        const u=d.normalize(),axis=B.Vector3.Cross(B.Vector3.Up(),u).normalize();
        mesh.rotationQuaternion=B.Quaternion.RotationAxis(axis,Math.acos(Math.max(-1,Math.min(1,B.Vector3.Dot(B.Vector3.Up(),u)))));
      }
      const pommel=cylinder('rdn-wheel-pommel',.070,.035,[0,-.12,0],iron,sword,20);pommel.rotation.x=Math.PI/2;
      const boss=cylinder('rdn-pommel-rivet',.019,.04,[0,-.12,0],brass,sword,10);boss.rotation.x=Math.PI/2;
      hide(scene.getMeshByName('helmet'));geometry('rdn-rounded-helmet',domeData(),iron,head);
      const oldApply=view.apply;
      function apply(p,ctl,diagnostics,dt){return oldApply.call(this,refinePose(p,ctl,motion),ctl,diagnostics,dt);}
      view.apply=apply;undo.push(()=>{if(view.apply===apply)view.apply=oldApply;});
      const stones=pebbleData(),base=stones.positions.slice();
      const sm=keep(new B.StandardMaterial('rdn-pebble-material',scene));sm.diffuseColor=B.Color3.White();sm.specularColor=B.Color3.Black();
      const pebbles=geometry('rdn-path-pebbles',stones,sm,null,false);pebbles.receiveShadows=true;
      let previousSlope=NaN;
      observer=scene.onBeforeRenderObservable.add(()=>{
        const slope=workshop.motion.slope;
        if(slope===previousSlope)return;previousSlope=slope;
        for(let i=0;i<base.length;i+=3)stones.positions[i+1]=base[i+1]+slope*base[i+2];
        const normals=[];B.VertexData.ComputeNormals(stones.positions,stones.indices,normals);
        pebbles.updateVerticesData(B.VertexBuffer.PositionKind,stones.positions,true);
        pebbles.updateVerticesData(B.VertexBuffer.NormalKind,normals);
      });
      return view.equipmentDetails={version:VERSION,dispose};
    }catch(error){dispose();throw error;}
    function dispose(){
      if(disposed)return;disposed=true;
      if(observer)scene.onBeforeRenderObservable.remove(observer);
      undo.reverse().forEach(fn=>{try{fn();}catch(_){}});
      owned.reverse().forEach(o=>{try{o.dispose();}catch(_){}});
      delete view.equipmentDetails;
    }
  }
  const api={version:VERSION,carryWeight,refinePose,bladeData,domeData,pebbleData,install};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else global.RDNEquipmentPass=api;
})(globalThis);
