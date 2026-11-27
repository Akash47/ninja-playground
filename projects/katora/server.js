// Katora rooms over HTTP: the server is the authority. SSE pushes state down, POSTs send actions up.
// The rules themselves live in roomcore.js (shared with the peer-to-peer host in the browser); this file adds networking, saving and limits.
const fs=require('fs'),path=require('path');
const {dump,restore}=require('./game');
const core=require('./roomcore'),{snap}=core;
const rooms=new Map(),L='ABCDEFGHJKLMNPQRSTUVWXYZ',clean=core.clean;

// Rooms live 12h after their last activity, and are saved to disk so a server restart doesn't lose games.
const MAX_ROOMS=200,MAX_WATCHERS=30,TTL=12*36e5,FILE=process.env.KATORA_ROOMS||path.join(__dirname,'../../data/katora-rooms.json');
function save(){ // ponytail: rewrites the whole file on every change; fine for a few rooms, debounce or use SQLite if it grows
  try{fs.mkdirSync(path.dirname(FILE),{recursive:true});
    fs.writeFileSync(FILE,JSON.stringify([...rooms.values()].map(r=>({code:r.code,at:r.at,pub:r.pub,seats:r.seats.map(s=>({pid:s.pid,name:s.name})),game:r.game&&dump(r.game)}))));}catch(e){console.error('katora: could not save rooms',e.message);}
}
try{for(const o of JSON.parse(fs.readFileSync(FILE,'utf8')))
  if(Date.now()-o.at<TTL)rooms.set(o.code,{code:o.code,at:o.at,pub:o.pub,seats:o.seats,game:o.game&&restore(o.game),clients:new Set()});}catch{}
const live=c=>{const r=rooms.get(c);if(r&&Date.now()-r.at>TTL){rooms.delete(c);return;}return r;};
const push=r=>{for(const c of r.clients)c.res.write(`data: ${JSON.stringify(snap(r,c.pid))}\n\n`);};
const json=(res,code,o)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(o));};

function act(code,action,body){
  const pid=core.clean(body.pid);if(!pid)throw new Error('missing pid');
  if(!code){ // create room
    for(const k of rooms.keys())live(k); // sweep expired rooms; no timer needed
    if(rooms.size>=MAX_ROOMS)throw new Error('server is busy, try again later'); // protects a public server from room spam
    let c;do c=Array.from({length:4},()=>L[Math.floor(Math.random()*L.length)]).join('');while(rooms.has(c));
    const r=core.newRoom(c,pid,body.name);Object.assign(r,{at:Date.now(),clients:new Set()});
    rooms.set(c,r);save();
    return{code:c};
  }
  const r=live(code);if(!r)throw new Error('no such room');
  r.at=Date.now();
  const fx=core.apply(r,action,body); // the rules live in roomcore.js; here we only deliver the results
  if(fx.some(e=>e.snap)){save();push(r);}
  for(const e of fx)if(e.msg){const line=`data: ${JSON.stringify(e.msg)}\n\n`;for(const c of r.clients)if(e.to==='all'||c.pid===e.to)c.res.write(line);}
  return{ok:true};
}

module.exports=(req,res,p)=>{
  const m=p.match(/^rooms(?:\/([A-Z]{4})(?:\/(\w+))?)?$/);
  if(!m)return json(res,404,{error:'not found'});
  const[,code,action]=m;
  if(req.method==='GET'&&!code){ // "Find a table": public rooms that are still waiting for players
    const list=[];for(const k of [...rooms.keys()]){const r=live(k);if(r&&r.pub&&!r.game&&r.seats.length<8)list.push({code:r.code,host:r.seats[0].name,n:r.seats.length,max:8});}
    return json(res,200,{rooms:list.slice(0,30)});
  }
  if(req.method==='GET'&&action==='events'){
    const r=live(code),pid=clean(new URL(req.url,'http://x').searchParams.get('pid'));
    if(!r)return json(res,404,{error:'no such room'});
    if(r.clients.size>=MAX_WATCHERS)return json(res,429,{error:'room is full of viewers'});
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive','X-Accel-Buffering':'no'}); // no-buffering hint so proxies/tunnels stream updates live
    const c={res,pid};r.clients.add(c);
    res.write(`data: ${JSON.stringify(snap(r,pid))}\n\n`);
    const ka=setInterval(()=>res.write(': keepalive\n\n'),25000);
    return req.on('close',()=>{
      clearInterval(ka);r.clients.delete(c);
      const gone=![...r.clients].some(x=>x.pid===pid),s=r.seats.find(s=>s.pid===pid);
      if(gone&&s&&s.video){s.video=false;push(r);} // closed tab: stop others from calling a dead camera
    });
  }
  if(req.method==='GET'&&code&&!action){ // does this room still exist? (used by "Rejoin" after a reload)
    const r=live(code);if(!r)return json(res,404,{error:'no such room'});
    return json(res,200,snap(r,clean(new URL(req.url,'http://x').searchParams.get('pid'))));
  }
  if(req.method!=='POST')return json(res,405,{error:'POST only'});
  let b='';
  req.on('data',d=>{b+=d;if(b.length>20000)req.destroy();}).on('end',()=>{
    try{json(res,200,act(code,action,JSON.parse(b||'{}')));}
    catch(e){json(res,400,{error:e.message});}
  });
};
