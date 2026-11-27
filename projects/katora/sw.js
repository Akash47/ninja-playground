// Katora service worker: network first, cache as the backup, so the app still opens when offline
// (one-screen mode works offline; rooms need the network). Bump V to force everyone onto new files.
const V='katora-v4',SHELL=['./','game.js','roomcore.js','p2p.js','manifest.json','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.includes('/api/'))return; // live game traffic always goes to the network
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(V).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request)));
});
