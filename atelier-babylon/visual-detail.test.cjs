'use strict';
const assert=require('node:assert/strict');
require('./visual-detail.js');
const {seeded,groundColor,capePoint,capeData}=globalThis.RDNVisualMath;
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
test('seed repeatability',()=>{let a=seeded(1),b=seeded(1);for(let i=0;i<100;i++)assert.equal(a(),b());});
test('seed interval',()=>{let r=seeded(9);for(let i=0;i<1000;i++)assert(r()>=0&&r()<1);});
test('ground channels bounded',()=>{for(let x=-40;x<=40;x++)for(let z=-40;z<=40;z+=4)for(const c of groundColor(x,z,.7))assert(Number.isInteger(c)&&c>=0&&c<=255);});
test('path distinct from verge',()=>assert.notDeepEqual(groundColor(0,0,.5),groundColor(5,0,.5)));
test('cape top seam stays fixed',()=>{for(let u=0;u<=1;u+=.1)assert.deepEqual(capePoint(u,0,0,0),capePoint(u,0,9,2));});
test('cape reacts to motion',()=>assert.notDeepEqual(capePoint(.3,1,0,0),capePoint(.3,1,2,2)));
test('cape topology',()=>{const d=capeData(0,0);assert.equal(d.positions.length,13*17*3);assert.equal(d.uvs.length,13*17*2);assert.equal(d.indices.length,12*16*6);for(const i of d.indices)assert(i>=0&&i<221);});
test('cape finite over cycle',()=>{for(let t=0;t<20;t+=.2)assert(capeData(t,3).positions.every(Number.isFinite));});
test('clear error without Babylon',()=>assert.throws(()=>RDNVisualPass.install(null,null),/Babylon/));
// Minimal engine doubles validate attachment/rollback contracts, NOT GPU rendering.
let materials=new Map(),meshes=new Map(),ownedMeshes=[],observers=[];
class Color {static White(){return {r:1,g:1,b:1};}static Black(){return {r:0,g:0,b:0};}}
class Material {constructor(name){this.name=name;this.albedoColor='original';this.roughness=.5;this.metallic=.3;materials.set(name,this);}clone(name){return Object.assign(new Material(name),this,{name});}dispose(){this.disposed=true;}}
class Mesh {constructor(name){this.name=name;this.updates=[];ownedMeshes.push(this);}updateVerticesData(...args){this.updates.push(args);}dispose(){this.disposed=true;}}
class Texture {constructor(name,size){this.name=name;this.size=size;}getContext(){return {fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},bezierCurveTo(){},putImageData(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};}};}update(){}dispose(){this.disposed=true;}}
class VertexData {static ComputeNormals(p,i,n){n.push(...p.map(()=>0));}applyToMesh(m){m.vertexData=this;}}
for(const n of ['cloth','red','leather','wood','steel','stone','ground'])new Material(n);
meshes.set('short cape',{visibility:1});
const scene={getMaterialByName:n=>materials.get(n),getMeshByName:n=>meshes.get(n),getTransformNodeByName:n=>({name:n}),getLightByName:()=>({getShadowGenerator:()=>({addShadowCaster(){},removeShadowCaster(){}})}),onBeforeRenderObservable:{add(fn){observers.push(fn);return fn;},remove(fn){observers=observers.filter(x=>x!==fn);}}};
const B={Color3:Color,DynamicTexture:Texture,VertexData,Mesh,StandardMaterial:Material,VertexBuffer:{PositionKind:'position',NormalKind:'normal'}};
const motion={time:0,speed:0,slope:0},workshop={renderer:{kind:'babylon',scene},motion};
let addon;
test('install additive layer',()=>{addon=RDNVisualPass.install(workshop,B);assert.equal(addon.version,'0.2.0');assert.equal(observers.length,1);assert.equal(meshes.get('short cape').visibility,0);});
test('install idempotent',()=>assert.equal(RDNVisualPass.install(workshop,B),addon));
test('controller untouched by layer',()=>{const before=JSON.stringify(motion);observers.forEach(fn=>fn());assert.equal(JSON.stringify(motion),before);});
test('cape is updated by render observer',()=>assert(ownedMeshes.find(m=>m.name==='rdn-draped-cape').updates.length>=2));
test('grass matches slope without changing controller',()=>{motion.slope=.08;observers.forEach(fn=>fn());const g=ownedMeshes.find(m=>m.name==='rdn-grass-verges');const p=g.updates.at(-1)[1];assert(p.every(Number.isFinite));assert.equal(motion.slope,.08);});
test('dispose restores original scene',()=>{addon.dispose();assert.equal(observers.length,0);assert.equal(meshes.get('short cape').visibility,1);assert.equal(materials.get('cloth').albedoColor,'original');assert.equal(workshop.renderer.visualDetails,undefined);});
console.log('\n'+count+' tests passed. Syntax/math/integration doubles only; no Babylon GPU or physical iPhone validation.');
