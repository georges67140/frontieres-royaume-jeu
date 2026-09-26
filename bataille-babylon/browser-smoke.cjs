'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {createServer}=require('../dev-server.cjs');

(async()=>{
 await fs.mkdir('artifacts',{recursive:true});
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port+'/bataille-babylon/';
 const bytes=await fs.readFile(require.resolve('babylonjs'));
 const results=[];
 try{
  for(const config of [
   {name:'desktop-chromium',engine:chromium,options:{viewport:{width:1440,height:900}}},
   {name:'iphone-landscape-webkit',engine:webkit,options:{viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2}}
  ]){
   const browser=await config.engine.launch(config.engine===chromium?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']}:{});
   let page;const errors=[],messages=[];
   try{
    const context=await browser.newContext(config.options);page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(messages.length<30)messages.push(m.type()+': '+m.text());});
    await page.route(/https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\/.*babylon\.js/,r=>r.fulfill({contentType:'text/javascript',body:bytes}));
    await page.goto(url);
    await page.waitForFunction(()=>window.RDNDebug?.ready||!document.getElementById('retry').hidden,null,{timeout:45000});
    const diagnostics=await page.evaluate(()=>({ready:window.RDNDebug?.ready,message:document.getElementById('loadMessage').textContent,errors:window.RDNDebug?.errors}));
    assert.equal(diagnostics.ready,true,JSON.stringify(diagnostics));
    assert.equal(await page.evaluate(()=>BABYLON.Engine.Version),'8.26.0');
    assert.equal(await page.evaluate(()=>RDNDebug.game.units.length),48);
    assert.ok(await page.evaluate(()=>RDNDebug.view.scene.getActiveMeshes().length>50));
    await page.waitForTimeout(900);
    await page.screenshot({path:'artifacts/'+config.name+'.png'});
    // Check project/pick roundtrip at the actual backing resolution (Retina included).
    const pick=await page.evaluate(()=>{
     const view=RDNDebug.view,B=BABYLON,pt=new B.Vector3(-5,RDNBattle.heightAt(-5,1),1),rect=view.canvas.getBoundingClientRect();
     const rw=view.engine.getRenderWidth(),rh=view.engine.getRenderHeight();
     const p=B.Vector3.Project(pt,B.Matrix.Identity(),view.scene.getTransformMatrix(),view.camera.viewport.toGlobal(rw,rh));
     const x=rect.left+p.x/rw*rect.width,y=rect.top+p.y/rh*rect.height,hit=view.pick(x,y);
     return{x,y,error:hit?B.Vector3.Distance(hit,pt):999};
    });
    assert.ok(pick.error<.08,'Touch picking error '+pick.error);
    if(config.options.hasTouch)await page.touchscreen.tap(pick.x,pick.y);else await page.mouse.click(pick.x,pick.y);
    assert.equal(await page.evaluate(()=>RDNDebug.game.player.order),'advance');
    await page.locator('[data-command="shield"]').click();
    assert.equal(await page.evaluate(()=>RDNDebug.game.player.order),'shield');
    await page.locator('[data-command="formation"]').click();
    assert.equal(await page.evaluate(()=>RDNDebug.game.player.form),'wall');
    await page.locator('[data-command="volley"]').click();
    assert.equal(await page.evaluate(()=>RDNDebug.game.player.order),'volley');
    await page.locator('#pause').click();
    assert.equal(await page.evaluate(()=>RDNDebug.game.state),'paused');
    await page.locator('#view').click();await page.waitForTimeout(1500);
    await page.screenshot({path:'artifacts/'+config.name+'-close.png'});
    assert.equal(await page.evaluate(()=>RDNDebug.view.mode),'close');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.deepEqual(errors,[]);
    results.push({name:config.name,passed:true,pickingError:pick.error});
    console.log('PASS '+config.name+' — 3D, 48 soldiers, commands, Retina picking, pause and close view');
   }catch(e){
    const diagnostic=page?await page.evaluate(()=>({ready:window.RDNDebug?.ready,message:document.getElementById('loadMessage')?.textContent,errors:window.RDNDebug?.errors})).catch(()=>null):null;
    console.error('FAIL '+config.name, e.message, JSON.stringify({diagnostic,errors,messages}));
    if(page)await page.screenshot({path:'artifacts/'+config.name+'-failure.png'}).catch(()=>{});
    results.push({name:config.name,passed:false,error:e.message,diagnostic,errors,messages});
   }finally{await browser.close();}
  }
  const browser=await chromium.launch({args:['--no-sandbox']});
  try{
   const page=await browser.newPage();await page.route(/https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.abort());
   await page.goto(url);await page.locator('#retry').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>RDNDebug.ready),false);
   assert.match(await page.locator('#loadMessage').textContent(),/moteur 3D est inaccessible/);
   results.push({name:'cdn-failure-recovery',passed:true});
  }catch(e){results.push({name:'cdn-failure-recovery',passed:false,error:e.message});}finally{await browser.close();}
  await fs.writeFile('artifacts/results.json',JSON.stringify(results,null,2));
  assert.ok(results.every(r=>r.passed),'Browser checks failed; see artifacts/results.json');
 }finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
