// Run: node projects/katora/sw.test.js  — checks the service worker's logic against a fake browser (real registration needs a real browser over https/localhost)
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'sw.js'),'utf8'),CURRENT=src.match(/const V='([^']+)'/)[1]; // whatever version the file declares
const handlers={},store=new Map(),deleted=[];let online=true;
const ok=body=>({ok:true,body,clone(){return this;}});
const ctx={
  URL,Promise,location:{origin:'http://x'},
  self:{addEventListener:(n,f)=>{handlers[n]=f;},skipWaiting(){},clients:{claim:async()=>{}}},
  caches:{open:async()=>({addAll:async u=>u.forEach(x=>store.set('shell:'+x,1)),put:async(r,res)=>store.set(r.url,res)}),
          keys:async()=>['katora-v0',CURRENT],delete:async k=>{deleted.push(k);},match:async r=>store.get(r.url)},
  fetch:async r=>{if(!online)throw new Error('offline');return ok('live:'+r.url);},
};
vm.runInNewContext(src,ctx);
const fetchEv=(method,url)=>{const e={request:{method,url},respondWith(p){e.p=p;}};handlers.fetch(e);return e;};
(async()=>{
  // install pre-caches the shell; activate removes old cache versions
  await new Promise(r=>handlers.install({waitUntil:p=>p.then(r)}));assert(['./','game.js','roomcore.js','p2p.js'].every(f=>store.has('shell:'+f)),'shell (including the p2p files) cached on install');
  await new Promise(r=>handlers.activate({waitUntil:p=>p.then(r)}));assert.deepEqual(deleted,['katora-v0'],'old cache deleted, current kept');
  // live game traffic is never touched
  assert.equal(fetchEv('GET','http://x/p/katora/api/rooms/ABCD').p,undefined,'API calls go straight to the network');
  assert.equal(fetchEv('POST','http://x/p/katora/index.html').p,undefined,'non-GET untouched');
  assert.equal(fetchEv('GET','http://other/p/katora/game.js').p,undefined,'other origins untouched');
  // static files: network first, and remembered
  assert.equal((await fetchEv('GET','http://x/p/katora/game.js').p).body,'live:http://x/p/katora/game.js');
  // offline: served from the remembered copy
  online=false;
  assert.equal((await fetchEv('GET','http://x/p/katora/game.js').p).body,'live:http://x/p/katora/game.js','offline falls back to cache');
  console.log('ok: service worker (install, cleanup, API untouched, network-first, offline fallback)');
})().catch(e=>{console.error(e);process.exitCode=1;});
