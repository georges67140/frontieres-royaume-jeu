/* Renderer adapter. The motion controller owns all animation and contact logic.
 * Segmented procedural rig (no imported/scanned model and no skinned GLB).
 * Babylon.js 8.26.0; geometry and materials are built locally, no model textures.
 */
(function(global){
'use strict';
global.createBabylonView=function(canvas){
  const B=global.BABYLON;
  if(!B)throw new Error('Babylon.js n’est pas chargé.');
  const V=B.Vector3;
  if(!B.Engine.isSupported())throw new Error('WebGL est indisponible.');
  const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,antialias:true});
  engine.setHardwareScalingLevel(1/Math.min(global.devicePixelRatio||1,1.5));
  const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.057,.083,.078,1);
  scene.ambientColor=new B.Color3(.27,.30,.27);
  scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogDensity=.028;scene.fogColor=new B.Color3(.10,.15,.14);
  const camera=new B.ArcRotateCamera('camera',1.12,1.20,4.8,new V(0,1.0,0),scene);
  camera.minZ=.04;camera.lowerRadiusLimit=2.6;camera.upperRadiusLimit=14;camera.lowerBetaLimit=.30;camera.upperBetaLimit=1.48;
  camera.wheelPrecision=60;camera.panningSensibility=0;camera.inertia=.70;camera.attachControl(canvas,true);
  const sky=new B.HemisphericLight('sky',new V(0,1,0),scene);sky.intensity=.68;sky.groundColor=new B.Color3(.18,.20,.15);
  const sun=new B.DirectionalLight('sun',new V(-.6,-1,-.5),scene);sun.position=new V(7,10,6);sun.intensity=1.3;
  sun.diffuse=new B.Color3(1,.89,.72);
  const rim=new B.DirectionalLight('rim',new V(.5,-.2,.8),scene);rim.intensity=.38;rim.diffuse=new B.Color3(.60,.80,.91);
  const shadow=new B.ShadowGenerator(1024,sun);shadow.usePercentageCloserFiltering=true;shadow.bias=.003;shadow.normalBias=.025;
  shadow.filteringQuality=B.ShadowGenerator.QUALITY_LOW;
  const m={};
  function material(name,color,rough=.88,metal=0){const p=new B.PBRMaterial(name,scene);p.albedoColor=B.Color3.FromHexString(color);p.roughness=rough;p.metallic=metal;m[name]=p;return p;}
  material('cloth','#424D43');material('red','#713E35');material('leather','#50392B');material('strap','#9A7550');
  material('skin','#B98C6D');material('beard','#4A3B2D');material('steel','#89928F',.39,.80);material('edge','#B4BBB3',.3,.88);
  material('iron','#323D3A',.54,.68);material('gold','#AE915A',.43,.68);material('wood','#715238');material('ground','#424F43');
  material('stone','#575E53');material('pine','#253F35');material('pale','#C2B291');material('eye','#282826');
  const markerMats={};for(const [n,c] of [['L','#D9B871'],['R','#7FC1C6'],['air','#495C56']]){
    const p=new B.StandardMaterial('marker'+n,scene);p.diffuseColor=B.Color3.FromHexString(c);p.emissiveColor=p.diffuseColor.scale(.45);markerMats[n]=p;
  }
  function assign(mesh,mat,parent,cast=true){mesh.material=typeof mat==='string'?m[mat]:mat;mesh.parent=parent||null;mesh.isPickable=false;if(cast)shadow.addShadowCaster(mesh);return mesh;}
  function box(name,size,pos,mat,parent,cast=true){const s=B.MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},scene);s.position.set(...pos);return assign(s,mat,parent,cast);}
  function sphere(name,size,pos,mat,parent,cast=true){const s=B.MeshBuilder.CreateSphere(name,{diameter:1,segments:12},scene);s.scaling.set(...size);s.position.set(...pos);return assign(s,mat,parent,cast);}
  function cyl(name,r1,r2,height,pos,mat,parent,n=12,cast=true){const s=B.MeshBuilder.CreateCylinder(name,{diameterTop:r1*2,diameterBottom:r2*2,height,tessellation:n},scene);s.position.set(...pos);return assign(s,mat,parent,cast);}
  function node(name){return new B.TransformNode(name,scene);}
  const setp=(node,p)=>node.position.set(p.x,p.y,p.z);
  function orientY(mesh,d){const u=new V(d.x,d.y,d.z).normalize(),dot=V.Dot(V.Up(),u);if(dot>.999999)mesh.rotationQuaternion=B.Quaternion.Identity();else if(dot<-.999999)mesh.rotationQuaternion=B.Quaternion.RotationAxis(V.Right(),Math.PI);else mesh.rotationQuaternion=B.Quaternion.RotationAxis(V.Cross(V.Up(),u).normalize(),Math.acos(Math.max(-1,Math.min(1,dot))));}
  function segment(mesh,a,b){setp(mesh,{x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2});const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};mesh.scaling.y=Math.hypot(d.x,d.y,d.z);orientY(mesh,d);}
  const ground=B.MeshBuilder.CreateGround('terrain',{width:80,height:80,subdivisions:20,updatable:true},scene);ground.material=m.ground;ground.receiveShadows=true;
  const positions=ground.getVerticesData(B.VertexBuffer.PositionKind),basePositions=positions.slice();let slope=0;
  let seed=78131;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const scenery=[];
  for(let i=0;i<26;i++){
    const x=(random()>.5?1:-1)*(4+random()*12),z=-9+random()*30,s=.6+random();
    const root=node('pine'+i);root.position.set(x,0,z);scenery.push(root);
    cyl('trunk',.045*s,.085*s,1.3*s,[0,.65*s,0],'wood',root,8,false);
    for(let k=0;k<3;k++)cyl('branches',0,(.80-k*.14)*s,1.6*s,[0,(1.5+k*.65)*s,0],'pine',root,8,false);
  }
  for(let i=0;i<30;i++){
    const x=(random()>.5?1:-1)*(2+random()*12),z=-9+random()*30;
    const s=B.MeshBuilder.CreatePolyhedron('rock'+i,{type:1,size:.10+random()*.25},scene);
    s.position.set(x,.10,z);s.scaling.y=.64;s.rotation.y=random()*6;assign(s,'stone',null,false);scenery.push(s);
  }
  const markerLines=[];
  for(let z=-10;z<=18;z++){
    const tick=box('metre',[.20,.009,.015],[1.6,.012,z],'pale',null,false);markerLines.push(tick);
  }
  const hips=node('pelvis');const body=node('torso');const head=node('head');
  cyl('pelvisCloth',.205,.25,.27,[0,0,0],'cloth',hips,10);
  cyl('belt',.222,.224,.073,[0,.135,0],'leather',hips,12);
  box('buckle',[.072,.06,.026],[0,.13,.229],'gold',hips);
  for(let i=0;i<9;i++){
    const theta=i*Math.PI*2/9,flap=box('leather skirt',[.116,.32,.026],[Math.sin(theta)*.21,-.13,Math.cos(theta)*.21],i%3===0?'strap':'leather',hips);
    flap.rotation.y=theta;flap.rotation.x=Math.cos(theta)*-.08;
    sphere('rivet',[.018,.018,.012],[Math.sin(theta)*.221,-.005,Math.cos(theta)*.221],'gold',hips);
  }
  cyl('tunic',.264,.203,.52,[0,0,0],'cloth',body,12);
  cyl('mailCollar',.165,.25,.15,[0,.245,0],'iron',body,16);
  for(let i=0;i<14;i++){
    const a=i*Math.PI*2/14;sphere('mailRing',[.034,.047,.025],[Math.sin(a)*.203,.205,Math.cos(a)*.203],'steel',body,false);
  }
  const sash=box('sash',[.06,.53,.035],[.075,0,.217],'strap',body);sash.rotation.z=-.23;
  for(const side of [-1,1])sphere('pauldron',[.255,.12,.29],[side*.266,.205,0],'steel',body);
  const cape=box('short cape',[.46,.64,.038],[0,-.03,-.23],'red',body);cape.rotation.x=-.10;
  cyl('neck',.075,.077,.16,[0,-.125,0],'skin',head);
  sphere('face',[.257,.305,.242],[0,0,.026],'skin',head);
  sphere('nose',[.053,.073,.065],[0,.005,.152],'skin',head);
  sphere('beard',[.235,.168,.124],[0,-.092,.099],'beard',head);
  for(const s of [-1,1]){
    sphere('eye',[.024,.013,.012],[s*.058,.047,.139],'eye',head,false);
    const brow=box('brow',[.053,.014,.012],[s*.06,.075,.134],'beard',head,false);brow.rotation.z=s*-.11;
  }
  cyl('helmet',.034,.166,.23,[0,.159,0],'steel',head,16);
  cyl('helmetBand',.170,.172,.04,[0,.061,0],'iron',head,20);
  box('nasal',[.027,.155,.025],[0,.012,.169],'steel',head);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;sphere('helmet rivet',[.018,.018,.018],[Math.sin(a)*.17,.064,Math.cos(a)*.17],'gold',head,false);}
  const limbs={};const kneeNodes={},elbowNodes={},feetNodes={};
  for(const [s,sign] of [['L',-1],['R',1]]){
    limbs['thigh'+s]=cyl('thigh'+s,.084,.106,1,[0,0,0],'cloth',null,12);
    limbs['shin'+s]=cyl('shin'+s,.073,.065,1,[0,0,0],'leather',null,12);
    limbs['upper'+s]=cyl('upper'+s,.083,.068,1,[0,0,0],'cloth',null,12);
    limbs['fore'+s]=cyl('forearm'+s,.067,.059,1,[0,0,0],'leather',null,12);
    kneeNodes[s]=sphere('knee'+s,[.18,.19,.18],[0,0,0],'steel');
    elbowNodes[s]=sphere('elbow'+s,[.135,.14,.135],[0,0,0],'steel');
    const foot=node('boot'+s);feetNodes[s]=foot;
    box('sole',[.16,.048,.335],[0,-.079,.045],'iron',foot);
    sphere('toe',[.167,.11,.245],[0,-.02,.091],'leather',foot);
    box('heel',[.144,.097,.145],[0,-.031,-.073],'leather',foot);
    cyl('boot cuff',.077,.079,.19,[0,.07,-.017],'leather',foot,12);
    for(const yy of [.045,.112])cyl('boot strap',.081,.081,.023,[0,yy,-.017],'strap',foot,12);
  }
  const hands={L:sphere('gloveL',[.122,.145,.115],[0,0,0],'leather'),R:sphere('gloveR',[.122,.145,.115],[0,0,0],'leather')};
  const shieldNode=node('shield');
  const disk=cyl('wood shield',.355,.355,.054,[0,0,0],'wood',shieldNode,40);disk.rotation.x=Math.PI/2;
  const rimMesh=B.MeshBuilder.CreateTorus('shield rim',{diameter:.72,thickness:.028,tessellation:40},scene);rimMesh.rotation.x=Math.PI/2;assign(rimMesh,'iron',shieldNode);
  for(let i=-3;i<=3;i++){
    const x=i*.083,h=2*Math.sqrt(Math.max(0,.34*.34-x*x));box('wood seam',[.005,h,.009],[x,0,.031],'leather',shieldNode,false);
  }
  for(let q=0;q<4;q++){
    const verts=[0,0,.033],indices=[];const start=q*Math.PI/2+.07,end=(q+1)*Math.PI/2-.07;
    for(let i=0;i<=8;i++){let a=start+(end-start)*i/8;verts.push(Math.cos(a)*.30,Math.sin(a)*.30,.033);if(i>0)indices.push(0,i,i+1);}
    const mesh=new B.Mesh('paint',scene),d=new B.VertexData();d.positions=verts;d.indices=indices;d.normals=[];B.VertexData.ComputeNormals(verts,indices,d.normals);d.applyToMesh(mesh);assign(mesh,q%2?'pale':'red',shieldNode,false);mesh.material.backFaceCulling=false;
  }
  sphere('shield boss',[.18,.18,.094],[0,0,.06],'steel',shieldNode);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;sphere('shield bolt',[.02,.02,.013],[Math.cos(a)*.326,Math.sin(a)*.326,.038],'gold',shieldNode,false);}
  const sword=node('sword');
  cyl('grip',.023,.026,.18,[0,0,0],'leather',sword,10);
  sphere('pommel',[.071,.047,.050],[0,-.12,0],'gold',sword);
  box('crossguard',[.23,.036,.045],[0,.12,0],'steel',sword);
  const blade=new B.Mesh('blade',scene),bd=new B.VertexData();
  bd.positions=[-.034,.14,0,0,.14,.014,.034,.14,0,0,.14,-.014,-.023,.71,0,0,.71,.010,.023,.71,0,0,.71,-.010,0,.86,0];
  bd.indices=[0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,8,5,5,8,6,6,8,7,7,8,4];bd.normals=[];B.VertexData.ComputeNormals(bd.positions,bd.indices,bd.normals);bd.applyToMesh(blade);assign(blade,'edge',sword);
  const dummy=node('target');cyl('targetPole',.07,.07,1.4,[0,.7,0],'wood',dummy,10);
  sphere('straw',[.44,.45,.30],[0,1.42,0],'strap',dummy);box('target stripe',[.46,.045,.31],[0,1.42,0],'red',dummy);
  dummy.setEnabled(false);
  const contacts={};for(const s of ['L','R']){
    const ring=B.MeshBuilder.CreateTorus('contact'+s,{diameter:.27,thickness:.009,tessellation:24},scene);assign(ring,markerMats[s],null,false);contacts[s]=ring;
  }
  const pairs=[['hipL','kneeL'],['kneeL','ankleL'],['hipR','kneeR'],['kneeR','ankleR'],['pelvis','neck'],['shoulderL','elbowL'],['elbowL','handL'],['shoulderR','elbowR'],['elbowR','handR']];
  let skeleton=null,showBones=false,lastPose=null,camChoice='three',autoView=null,hitAge=99;
  function setTerrain(s){
    if(s===slope)return;slope=s;
    for(let i=0;i<positions.length;i+=3)positions[i+1]=positions[i+2]*slope;
    ground.updateVerticesData(B.VertexBuffer.PositionKind,positions);
    const normals=[];B.VertexData.ComputeNormals(positions,ground.getIndices(),normals);ground.updateVerticesData(B.VertexBuffer.NormalKind,normals);ground.refreshBoundingInfo();
    scenery.forEach(o=>o.position.y=slope*o.position.z);markerLines.forEach(o=>{o.position.y=slope*o.position.z+.013;o.rotation.x=-Math.atan(slope);});
  }
  function apply(p,controller,diagnostics,dt){
    lastPose=p;const j=p.joints;setTerrain(controller.slope);hitAge+=dt;
    setp(hips,j.pelvis);hips.rotation.y=p.yaw;
    setp(body,{x:j.pelvis.x,y:j.pelvis.y+.35,z:j.pelvis.z});body.rotation.y=p.yaw;
    cape.rotation.x=-.10-Math.sin(controller.time*3)*.025-Math.min(.15,controller.speed*.07);
    setp(head,j.head);head.rotation.y=p.yaw;
    for(const s of ['L','R']){
      segment(limbs['thigh'+s],j['hip'+s],j['knee'+s]);segment(limbs['shin'+s],j['knee'+s],j['ankle'+s]);
      segment(limbs['upper'+s],j['shoulder'+s],j['elbow'+s]);segment(limbs['fore'+s],j['elbow'+s],j['hand'+s]);
      setp(kneeNodes[s],j['knee'+s]);setp(elbowNodes[s],j['elbow'+s]);setp(hands[s],j['hand'+s]);
      const f=p.feet[s==='L'?0:1];setp(feetNodes[s],f.pos);feetNodes[s].rotation.set(f.pitch-Math.atan(slope)*Math.cos(f.yaw),f.yaw,Math.atan(slope)*Math.sin(f.yaw));
      setp(contacts[s],{x:f.pos.x,y:controller.ground(f.pos)+.015,z:f.pos.z+.025});contacts[s].rotation.x=-Math.atan(slope);contacts[s].setEnabled(diagnostics);contacts[s].material=f.planted?markerMats[s]:markerMats.air;
    }
    setp(shieldNode,p.shieldCenter);shieldNode.rotation.set(p.shieldTilt,p.shieldYaw,0);
    setp(sword,j.handR);orientY(sword,p.swordDir);
    const target=controller.point({x:.06,y:0,z:1.08});setp(dummy,target);dummy.rotation.y=p.yaw;dummy.setEnabled(controller.mode==='strike'||hitAge<.7);dummy.rotation.x=hitAge<.4?Math.sin(hitAge*24)*Math.exp(-hitAge*8)*.13:0;
    const targetCamera=new V(p.root.x,j.pelvis.y+.03,p.root.z);
    camera.target.copyFrom(targetCamera);
    if(autoView){camera.alpha+=(autoView[0]-camera.alpha)*.14;camera.beta+=(autoView[1]-camera.beta)*.14;camera.radius+=(autoView[2]-camera.radius)*.14;if(Math.abs(autoView[0]-camera.alpha)<.004)autoView=null;}
    showBones=diagnostics;
    if(skeleton)skeleton.dispose();skeleton=null;
    if(showBones){skeleton=B.MeshBuilder.CreateLineSystem('rig',{lines:pairs.map(pair=>pair.map(k=>new V(j[k].x,j[k].y,j[k].z)))},scene);skeleton.color=new B.Color3(.9,.82,.47);skeleton.renderingGroupId=2;skeleton.isPickable=false;}
    scene.render();
  }
  return {
    kind:'babylon',engine,scene,camera,apply,
    impact(){hitAge=0;},
    cameraView(name){camChoice=name;const yaw=lastPose?lastPose.yaw:0;autoView=name==='front'?[Math.PI/2-yaw,1.22,4.8]:name==='side'?[.04-yaw,1.20,4.8]:name==='tactical'?[.84-yaw,.53,7.0]:[1.12-yaw,1.20,4.8];},
    resize(){engine.resize();},dispose(){scene.dispose();engine.dispose();}
  };
};
})(globalThis);
