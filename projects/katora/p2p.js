// Katora peer-to-peer mode: NO game server. One player's browser (the host) runs the room rules (roomcore.js);
// friends connect to it with WebRTC data channels. Video reuses the same message relay as the server mode.
//
// The only third-party piece is a free public "meeting point" (PeerJS's open signaling broker). Two browsers use it ONCE,
// to swap the offer/answer that sets up their direct connection; after that, nothing goes through it.
// To use your own broker instead:  ?broker=wss://your-host/peerjs?key=peerjs
(()=>{
const core=window.KatoraRooms;
const BROKER=new URLSearchParams(location.search).get('broker')||'wss://0.peerjs.com/peerjs?key=peerjs';
const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'},
  {urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478'],username:'peerjs',credential:'peerjsp'}]}; // PeerJS's free public relay (best effort, may change)
const L='ABCDEFGHJKLMNPQRSTUVWXYZ',rid=()=>Math.random().toString(36).slice(2,10),HOST=c=>'katora-'+c,KEEP=12*36e5,SAVE='katora.p2phost',SLOTS=30,LOB=i=>'katora-lobby-'+i;
// The broker only relays messages whose payload has these fields (found by testing against the real service).
const pay=(cid,x)=>({type:'data',connectionId:cid,label:'katora',reliable:true,serialization:'json',...x});
// the broker also drops CANDIDATE messages that don't look like an ICE candidate, so lobby pings wear that shape
const ice=text=>({candidate:text,sdpMid:'0',sdpMLineIndex:0});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ---- the meeting point ----
function meet(id,onmsg,onclose){
  return new Promise((resolve,reject)=>{
    let opened=false,hb;
    const ws=new WebSocket(`${BROKER}${BROKER.includes('?')?'&':'?'}id=${id}&token=${rid()+rid()}`);
    const to=setTimeout(()=>{ws.close();reject(new Error('The free meeting-point server did not answer. Check your internet connection.'));},10000);
    ws.onmessage=e=>{
      let m;try{m=JSON.parse(e.data);}catch{return;}
      if(m.type==='OPEN'){
        opened=true;clearTimeout(to);hb=setInterval(()=>ws.readyState===1&&ws.send('{"type":"HEARTBEAT"}'),5000);
        resolve({send:o=>ws.readyState===1&&ws.send(JSON.stringify(o)),close:()=>{clearInterval(hb);ws.onclose=null;ws.close();}});
      }else if(m.type==='ID-TAKEN'){clearTimeout(to);reject(Object.assign(new Error('taken'),{taken:true}));}
      else onmsg(m);
    };
    ws.onerror=()=>{if(!opened){clearTimeout(to);reject(new Error('Could not reach the free meeting-point server. Check your internet connection.'));}};
    ws.onclose=()=>{clearInterval(hb);clearTimeout(to);if(opened&&onclose)onclose();};
  });
}

// ---- HOST: owns the room, accepts friends' connections ----
function hostRoom(pid,r){
  const conns=new Map(),pcs=new Map(); // player id -> data channel;  broker peer id -> connection being set up
  let sock=null,alive=true,onLocal=()=>{};
  const send=(ch,o)=>{if(ch.readyState==='open')ch.send(JSON.stringify(o));};
  const persist=()=>{try{localStorage[SAVE]=JSON.stringify({ts:Date.now(),code:r.code,pid,seats:r.seats.map(s=>({pid:s.pid,name:s.name})),pub:r.pub,game:r.game&&dump(r.game)});}catch{}};
  function deliver(fx){ // same effects the Node server delivers over SSE
    for(const e of fx){
      if(e.snap){onLocal(core.snap(r,pid));for(const[p,ch]of conns)send(ch,{t:'snap',d:core.snap(r,p)});}
      else if(e.msg){if(e.to==='all'||e.to===pid)onLocal(e.msg);for(const[p,ch]of conns)if(e.to==='all'||e.to===p)send(ch,{t:'msg',d:e.msg});}
    }
  }
  function run(from,a,p){const fx=core.apply(r,a,{...p,pid:from});persist();deliver(fx);lobby();} // throws if the rules refuse
  // "Find a table": a public waiting room also sits on one of a few well-known broker ids; a browsing player pings them all and each answers with its room card.
  let lob=null,claiming=false;
  async function lobby(){
    if(!alive)return;
    if(!(r.pub&&!r.game&&r.seats.length<8)){if(lob){lob.close();lob=null;}return;}
    if(lob||claiming)return;claiming=true;
    for(let i=0;i<SLOTS&&!lob;i++)try{
      const s=await meet(LOB(i),m=>{if(m.type==='CANDIDATE'&&m.payload&&m.payload.candidate&&m.payload.candidate.candidate==='katora-list')s.send({type:'CANDIDATE',dst:m.src,payload:pay(m.payload.connectionId,{candidate:ice(JSON.stringify({code:r.code,host:r.seats[0].name,n:r.seats.length,max:8}))})});},()=>{if(lob===s)lob=null;});
      lob=s;
    }catch(e){if(!e.taken)break;} // taken = another table has this slot, try the next
    claiming=false;
  }
  const tick=setInterval(lobby,10000);
  function wire(ch){
    let who=null;
    ch.onmessage=e=>{
      if(String(e.data).length>20000)return;
      let m;try{m=JSON.parse(e.data);}catch{return;}
      if(m.t==='hello'){
        who=core.clean(m.pid);if(!who)return;
        const old=conns.get(who);conns.set(who,ch);if(old&&old!==ch)try{old.close();}catch{}
        send(ch,{t:'snap',d:core.snap(r,who)});
      }else if(m.t==='act'&&who){
        let res={t:'ack',id:m.id,ok:true};
        try{run(who,m.a,m.p||{});}catch(err){res={t:'ack',id:m.id,ok:false,err:err.message};}
        send(ch,res);
      }
    };
    ch.onclose=()=>{ // a friend left: stop others from calling their camera
      if(who&&conns.get(who)===ch){conns.delete(who);const s=r.seats.find(s=>s.pid===who);if(s&&s.video){s.video=false;deliver([{snap:true}]);}}
    };
  }
  async function onBroker(m){
    const src=m.src,cid=m.payload&&m.payload.connectionId;
    if(m.type==='OFFER'){
      if(pcs.size>=24)return;
      const pc=new RTCPeerConnection(ICE),st={pc,pending:[]};pcs.set(src,st);
      pc.onicecandidate=e=>e.candidate&&sock.send({type:'CANDIDATE',dst:src,payload:pay(cid,{candidate:e.candidate})});
      pc.ondatachannel=e=>wire(e.channel);
      pc.onconnectionstatechange=()=>{if(pc.connectionState==='closed'||pc.connectionState==='failed')pcs.delete(src);};
      try{
        await pc.setRemoteDescription(m.payload.sdp);
        for(const c of st.pending.splice(0))await pc.addIceCandidate(c).catch(()=>{});
        await pc.setLocalDescription(await pc.createAnswer());
        sock.send({type:'ANSWER',dst:src,payload:pay(cid,{sdp:pc.localDescription})});
      }catch{pc.close();pcs.delete(src);}
    }else if(m.type==='CANDIDATE'){
      const st=pcs.get(src);if(!st)return;st.pending.push(m.payload.candidate);
      if(st.pc.remoteDescription)for(const c of st.pending.splice(0))await st.pc.addIceCandidate(c).catch(()=>{});
    }
  }
  const connect=async()=>{sock=await meet(HOST(r.code),onBroker,()=>{if(alive)sleep(2000).then(()=>alive&&connect().catch(()=>{}));});lobby();};
  return{
    code:r.code,role:'host',connect,
    set onmsg(fn){onLocal=fn;},
    snapshot:()=>core.snap(r,pid),
    act:async(a,p)=>{run(pid,a,p||{});return{ok:true};},
    close(){alive=false;clearInterval(tick);try{sock&&sock.close();lob&&lob.close();}catch{}for(const ch of conns.values())try{ch.close();}catch{}for(const s of pcs.values())try{s.pc.close();}catch{}localStorage.removeItem(SAVE);},
  };
}

// ---- BROWSE: ping every lobby slot, collect the room cards that answer. The broker only relays handshake-shaped messages, so the ping and the reply ride in ICE-candidate-shaped ones ----
async function browse(){
  const out=new Map(),sock=await meet('katora-g-'+rid()+rid(),m=>{let i;try{i=m.type==='CANDIDATE'&&JSON.parse(m.payload.candidate.candidate);}catch{}if(i&&typeof i==='object')out.set(m.src,i);});
  for(let i=0;i<SLOTS;i++)sock.send({type:'CANDIDATE',dst:LOB(i),payload:pay('ls_'+rid(),{candidate:ice('katora-list')})});
  await sleep(2500);sock.close();
  return[...out.values()].filter(i=>/^[A-Z]{4}$/.test(i.code)).map(i=>({code:i.code,host:String(i.host||'').slice(0,20),n:+i.n||1,max:+i.max||8})); // other people's data: validate before showing
}

// ---- GUEST: connects to the host; keeps retrying if the link drops ----
function guestLink(code,pid,status){
  let ch=null,pc=null,closed=false,tries=0,n=0,starting=null,onmsg=()=>{};const acks=new Map();
  function handle(m){
    if(m.t==='snap')onmsg(m.d);else if(m.t==='msg')onmsg(m.d);
    else if(m.t==='ack'){const a=acks.get(m.id);if(a){acks.delete(m.id);m.ok?a.res({ok:true}):a.rej(new Error(m.err));}}
  }
  function lost(){
    if(closed)return;status('down');ch=null;
    sleep(Math.min(30000,1000*2**tries++)).then(()=>!closed&&dial().then(()=>{tries=0;status('up');}).catch(()=>lost()));
  }
  function dial(){
    return new Promise(async(resolve,reject)=>{
      let done=false,sock=null;const cid='dc_'+rid(),pend=[];
      const fail=e=>{if(done)return;done=true;clearTimeout(to);try{sock&&sock.close();}catch{}try{p&&p.close();}catch{}reject(e);};
      const p=pc=new RTCPeerConnection(ICE);
      const to=setTimeout(()=>fail(new Error('Could not connect to the host. Their network may block direct connections.')),15000);
      const dc=p.createDataChannel('k');
      dc.onopen=()=>{if(done)return;done=true;clearTimeout(to);try{sock.close();}catch{}ch=dc;dc.send(JSON.stringify({t:'hello',pid}));resolve();};
      dc.onmessage=e=>{try{handle(JSON.parse(e.data));}catch{}};
      dc.onclose=()=>{if(ch===dc)lost();};
      p.onicecandidate=e=>e.candidate&&sock&&sock.send({type:'CANDIDATE',dst:HOST(code),payload:pay(cid,{candidate:e.candidate})});
      try{
        sock=await meet('katora-g-'+rid()+rid(),async m=>{
          if(m.type==='ANSWER'){await p.setRemoteDescription(m.payload.sdp);for(const c of pend.splice(0))await p.addIceCandidate(c).catch(()=>{});}
          else if(m.type==='CANDIDATE'){p.remoteDescription?p.addIceCandidate(m.payload.candidate).catch(()=>{}):pend.push(m.payload.candidate);}
          else if(m.type==='EXPIRE')fail(new Error('No room with that code is online. Check the code, or ask the host to open the game.'));
        });
        await p.setLocalDescription(await p.createOffer());
        sock.send({type:'OFFER',dst:HOST(code),payload:pay(cid,{sdp:p.localDescription})});
      }catch(e){fail(e);}
    });
  }
  return{
    code,role:'guest',
    // connect once. retry=true (rejoining after a reload): keep trying with backoff if the host is not there yet
    start:retry=>starting??=dial().then(()=>{tries=0;status('up');}).catch(e=>{starting=null;if(retry){lost();return;}throw e;}),
    set onmsg(fn){onmsg=fn;},
    hello:()=>ch&&ch.readyState==='open'&&ch.send(JSON.stringify({t:'hello',pid})), // ask the host for a fresh snapshot
    act:(a,p)=>new Promise((res,rej)=>{
      if(!ch||ch.readyState!=='open')return rej(new Error('Not connected to the host right now.'));
      const id=++n;acks.set(id,{res,rej});ch.send(JSON.stringify({t:'act',id,a,p:p||{}}));
      setTimeout(()=>{if(acks.delete(id))rej(new Error('The host did not answer.'));},8000);
    }),
    close(){closed=true;try{ch&&ch.close();}catch{}try{pc&&pc.close();}catch{}},
  };
}

// ---- the same shape as the server transport, so the page does not care which one it has ----
window.KatoraP2P=function(pid){
  let link=null;const api={kind:'p2p',onstatus:()=>{}};
  const status=s=>api.onstatus(s);
  api.saved=()=>{try{const s=JSON.parse(localStorage[SAVE]);return Date.now()-s.ts<KEEP?s:null;}catch{return null;}};
  api.create=async name=>{
    for(let i=0;i<10;i++){ // the broker refuses an id that is already taken, which keeps room codes unique for free
      const code=Array.from({length:4},()=>L[Math.floor(Math.random()*L.length)]).join('');
      const h=hostRoom(pid,core.newRoom(code,pid,name));
      try{await h.connect();link=h;h.act('video',{on:false}).catch(()=>{});localStorage[SAVE]=JSON.stringify({ts:Date.now(),code,pid,seats:[{pid,name}],game:null});return{code};}
      catch(e){if(!e.taken)throw e;}
    }
    throw new Error('Could not find a free room code. Try again.');
  };
  api.resumeHost=async()=>{ // the host reloaded: rebuild the room from the saved copy and re-register under the same code
    const s=api.saved();if(!s)throw new Error('Nothing to resume.');
    const r={code:s.code,seats:s.seats,pub:s.pub,game:s.game&&restore(s.game)};
    const h=hostRoom(s.pid,r);
    for(let i=0;;i++){try{await h.connect();break;}catch(e){if(!e.taken||i>=5)throw e;await sleep(1500);}} // the old registration may take a moment to expire
    link=h;return{code:s.code,pid:s.pid};
  };
  api.join=async(code,name)=>{
    if(link)link.close();
    const g=guestLink(code,pid,status);await g.start(false);link=g;
    await g.act('join',{name});return{ok:true};
  };
  api.browse=browse;
  api.exists=async code=>{ // a guest can't know in advance; the connection attempt tells them
    if(!link||link.code!==code){const g=guestLink(code,pid,status);link=g;}
    return true;
  };
  api.act=(code,a,p)=>link.act(a,p);
  api.open=(code,onmsg)=>{
    if(link&&link.role==='host'){link.onmsg=onmsg;onmsg(link.snapshot());}
    else{
      if(!link||link.code!==code)link=guestLink(code,pid,status);
      link.onmsg=onmsg;
      link.start(true).then(()=>link&&link.hello()); // already connected after join(): this just asks the host for a fresh snapshot
    }
    return()=>{if(link){link.close();link=null;}};
  };
  return api;
};
})();
