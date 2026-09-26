'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {createServer}=require('../dev-server.cjs');
(async()=>{
  await fs.mkdir('artifacts',{recursive:true});
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url='http://127.0.0.1:'+server.address().port+'/atelier-babylon/apercu-graphique.html';
  const bytes=await fs.readFile(require.resolve('babylonjs')),results=[];
  try{
    for(const config of [
      {name:'atelier-desktop',engine:chromium,options:{viewport:{width:1360,height:900}}},
      {name:'atelier-iphone-landscape',engine:webkit,options:{viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2}},
      {name:'atelier-iphone-portrait',engine:webkit,options:{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}}
    ]){
      const browser=await config.engine.launch(config.engine===chromium?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']}:{});
      let page;const errors=[],messages=[];
      try{
        const context=await browser.newContext(config.options);page=await context.newPage();
        page.on('pageerror',e=>errors.push(e.stack||e.message));
        page.on('console',async m=>{if(['error','warning'].includes(m.type())){messages.push(m.text());for(const a of m.args()){const stack=await a.evaluate(x=>x instanceof Error?x.stack:null).catch(()=>null);if(stack)messages.push(stack);}}});
        await page.route(/https:\/\/(cdn\.jsdelivr\.net|unpkg\.com|cdn\.babylonjs\.com)\/.*babylon(?:\.max)?\.js/,r=>r.fulfill({contentType:'text/javascript',body:bytes}));
        await page.goto(url);
        await page.waitForFunction(()=>{const w=document.getElementById('workshop').contentWindow;return w.RDNWorkshop?.renderer?.equipmentDetails?.version==='0.3.0'||w.document.getElementById('engineStatus')?.textContent.includes('Erreur 3D');},null,{timeout:20000});
        const frame=await (await page.locator('#workshop').elementHandle()).contentFrame();
        await page.waitForTimeout(500);
        assert.equal(await frame.evaluate(()=>RDNWorkshop.renderer?.kind),'babylon');
        const rendering=await frame.evaluate(()=>{
          const s=RDNWorkshop.renderer.scene;
          return {version:BABYLON.Engine.Version,ready:s.isReady(),blade:s.getMeshByName('rdn-fullered-blade')?.getTotalVertices(),helmet:s.getMeshByName('rdn-rounded-helmet')?.isEnabled(),oldHelmet:s.getMeshByName('helmet')?.isEnabled(),cape:!!s.getMeshByName('rdn-draped-cape'),pebbles:!!s.getMeshByName('rdn-path-pebbles')};
        });
        assert.equal(rendering.version,'8.26.0');assert.ok(rendering.ready);assert.equal(rendering.blade,50);
        assert.equal(rendering.helmet,true);assert.equal(rendering.oldHelmet,false);assert.ok(rendering.cape&&rendering.pebbles);
        await frame.locator('[data-action="walk"]').click();
        await frame.waitForFunction(()=>RDNWorkshop.motion.distance>.1,null,{timeout:15000});
        await frame.locator('[data-action="stop"]').click();
        await frame.waitForFunction(()=>RDNWorkshop.motion.speed===0,null,{timeout:15000});
        await frame.locator('[data-action="guard"]').click();
        await frame.waitForFunction(()=>RDNWorkshop.motion.guard>.95,null,{timeout:15000});
        await page.screenshot({path:'artifacts/'+config.name+'-guard.png'});
        await frame.locator('[data-action="guard"]').click();
        await frame.locator('[data-action="strike"]').click();
        await frame.waitForFunction(()=>RDNWorkshop.motion.impactCount>0,null,{timeout:15000});
        await frame.waitForFunction(()=>RDNWorkshop.motion.mode==='idle',null,{timeout:15000});
        assert.equal(await frame.evaluate(()=>RDNWorkshop.motion.impactCount),1);
        assert.ok(await frame.evaluate(()=>RDNWorkshop.motion.maxDrift<1e-6));
        await frame.evaluate(()=>RDNWorkshop.motion.setSlope(.08));
        await page.waitForTimeout(500);
        await page.screenshot({path:'artifacts/'+config.name+'-slope.png'});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        assert.deepEqual(errors,[]);
        results.push({name:config.name,passed:true,rendering,messages});console.log('PASS '+config.name+' — original atelier, equipment 0.3, walk/guard/contact and slope');
      }catch(error){
        const status=page?await page.locator('#status').textContent().catch(()=>null):null;
        results.push({name:config.name,passed:false,error:error.message,status,errors,messages});
        console.error('FAIL '+config.name,JSON.stringify(results[results.length-1]));
        if(page)await page.screenshot({path:'artifacts/'+config.name+'-failure.png'}).catch(()=>{});
      }finally{await browser.close();}
    }
    await fs.writeFile('artifacts/atelier-results.json',JSON.stringify(results,null,2));
    if(results.some(r=>!r.passed)){
      await fs.writeFile('artifacts/debug-babylon-8.26.0.js',bytes);
      await fs.cp('atelier-babylon','artifacts/debug-workshop',{recursive:true});
    }
    assert.ok(results.every(r=>r.passed),'Atelier browser checks failed; see artifacts/atelier-results.json');
  }finally{await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
