// Run: node projects/katora/rooms.test.js  (starts the gateway on a spare port, uses a temp event log)
const{spawn}=require('child_process'),assert=require('assert'),path=require('path'),os=require('os'),fs=require('fs');
const PORT=3199,B=`http://localhost:${PORT}/p/katora/api`,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const RF=path.join(os.tmpdir(),'katora-test-rooms.json');try{fs.unlinkSync(RF);}catch{}
const boot=()=>spawn('node',['server.js'],{cwd:path.join(__dirname,'../..'),env:{...process.env,PORT,EVENTS:path.join(os.tmpdir(),'katora-test-events.jsonl'),KATORA_ROOMS:RF}});
let srv=boot();
const post=(p,b)=>fetch(B+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(async r=>({status:r.status,...await r.json()}));
(async()=>{
  const ctl=new AbortController();
  try{
    await sleep(800);
    const c=(await post('/rooms',{pid:'p1',name:'Asha'})).code;assert(/^[A-Z]{4}$/.test(c));
    assert.equal((await post(`/rooms/${c}/join`,{pid:'p2',name:'Ben'})).ok,true);
    assert.equal((await post(`/rooms/${c}/join`,{pid:'p3',name:'ben'})).status,400,'duplicate name rejected');
    assert.equal((await post(`/rooms/${c}/start`,{pid:'p2'})).status,400,'only host starts');
    const snaps=[],reacts=[],signals=[],chats=[];
    fetch(`${B}/rooms/${c}/events?pid=p2`,{signal:ctl.signal}).then(async r=>{
      const rd=r.body.getReader(),dec=new TextDecoder();
      for(;;){const{value,done}=await rd.read();if(done)break;for(const m of dec.decode(value).matchAll(/data: (.*)\n/g)){const d=JSON.parse(m[1]);(d.chat?chats:d.react?reacts:d.signal?signals:snaps).push(d);}}
    }).catch(()=>{});
    await sleep(200);assert.equal(snaps.at(-1).started,false);assert.equal(snaps.at(-1).you,1);
    assert.equal((await post(`/rooms/${c}/start`,{pid:'p1'})).ok,true);await sleep(200);
    assert.equal(snaps.at(-1).game.state,'playing');assert.equal(snaps.at(-1).game.turn,0);
    assert.equal((await post(`/rooms/${c}/bid`,{pid:'p2',bid:0})).status,400,'not your turn');
    assert.equal((await post(`/rooms/${c}/bid`,{pid:'p1',bid:999})).status,400,'bad bid');
    assert.equal((await post(`/rooms/${c}/bid`,{pid:'p1',bid:0})).ok,true);await sleep(200);
    assert.equal(snaps.at(-1).game.turn,1,'turn moved to second player');
    assert.equal((await post(`/rooms/${c}/bid`,{pid:'p2',bid:5})).ok,true);await sleep(200);
    const s=snaps.at(-1).game;assert.equal(s.state,'roundEnd');assert(s.last.card);
    assert.equal(s.pot+s.players.reduce((a,p)=>a+p.chips,0),200,'chips conserved');
    assert.equal((await post(`/rooms/${c}/react`,{pid:'p1',emoji:'🔥'})).ok,true);await sleep(200);
    assert.deepEqual(reacts.at(-1),{react:{seat:0,emoji:'🔥'}},'reaction reaches other screens with the sender seat');
    assert.equal((await post(`/rooms/${c}/react`,{pid:'p1',emoji:'💣'})).status,400,'unknown emoji rejected');
    assert.equal((await post(`/rooms/${c}/react`,{pid:'stranger',emoji:'🔥'})).status,400,'non-members cannot react');
    // chat: delivered live to everyone and flood-guarded. Deliberately NO history: nothing stored, nothing replayed
    assert.equal((await post(`/rooms/${c}/chat`,{pid:'p1',text:'hello table'})).ok,true);await sleep(200);
    const got=chats.at(-1).chat;assert.deepEqual({seat:got.seat,name:got.name,text:got.text},{seat:0,name:'Asha',text:'hello table'},'chat reaches the other screen with the sender name');
    assert.equal((await post(`/rooms/${c}/chat`,{pid:'p1',text:'too fast'})).status,400,'flood guard');
    assert.equal((await post(`/rooms/${c}/chat`,{pid:'stranger',text:'hi'})).status,400,'strangers cannot chat');
    assert.equal((await post(`/rooms/${c}/chat`,{pid:'p2',text:'   '})).status,400,'empty message rejected');
    const late=new AbortController(),lateMsgs=[];
    fetch(`${B}/rooms/${c}/events?pid=p1`,{signal:late.signal}).then(async r=>{const rd=r.body.getReader(),dec=new TextDecoder();for(;;){const{value,done}=await rd.read();if(done)break;for(const m of dec.decode(value).matchAll(/data: (.*)\n/g))lateMsgs.push(JSON.parse(m[1]));}}).catch(()=>{});
    await sleep(300);late.abort();
    assert(!lateMsgs.some(m=>m.chat||m.chatlog),'a screen that connects later gets NO replay of earlier chat');
    assert(!JSON.stringify(JSON.parse(fs.readFileSync(RF,'utf8'))).includes('hello table'),'chat text is never written to disk');
    // video: a presence flag per seat, plus a relay for WebRTC handshake messages (the server never touches media)
    const offer={d:{type:'offer',sdp:'v=0 fake'}};
    assert.equal((await post(`/rooms/${c}/signal`,{pid:'p1',to:1,data:offer})).status,400,'no signaling before both have video on');
    assert.equal((await post(`/rooms/${c}/video`,{pid:'p1',on:true})).ok,true);
    assert.equal((await post(`/rooms/${c}/video`,{pid:'p2',on:true})).ok,true);await sleep(200);
    assert.deepEqual(snaps.at(-1).video,[true,true],'video flags reach everyone');
    assert.equal((await post(`/rooms/${c}/signal`,{pid:'p1',to:1,data:offer})).ok,true);await sleep(200);
    assert.deepEqual(signals.at(-1),{signal:{from:0,data:offer}},'signal reaches the target, tagged with the sender seat');
    assert.equal((await post(`/rooms/${c}/signal`,{pid:'stranger',to:1,data:offer})).status,400,'strangers cannot signal');
    assert.equal((await post(`/rooms/${c}/signal`,{pid:'p1',to:0,data:offer})).status,400,'cannot signal yourself');
    assert.equal((await post(`/rooms/${c}/signal`,{pid:'p1',to:7,data:offer})).status,400,'unknown seat rejected');
    assert.equal((await post(`/rooms/${c}/signal`,{pid:'p1',to:1,data:{d:'x'.repeat(17000)}})).status,400,'huge signal rejected');
    const seen2=signals.length;await post(`/rooms/${c}/signal`,{pid:'p2',to:0,data:offer});await sleep(150);
    assert.equal(signals.length,seen2,'a signal for seat 0 is not delivered to seat 1 (p2 only hears signals meant for p2)');
    ctl.abort();await sleep(400); // p2 closes the tab
    assert.deepEqual((await fetch(`${B}/rooms/${c}?pid=p1`).then(r=>r.json())).video,[true,false],'closing the tab clears that seat video flag');
    assert.equal((await post('/rooms/ZZZZ/join',{pid:'p9',name:'X'})).status,400,'unknown room');
    // restart survival: kill the server, start a new one on the same file; the room, seats and game must still be there
    const before=snaps.at(-1).game;
    srv.kill();await sleep(300);srv=boot();await sleep(800);
    const back=await fetch(`${B}/rooms/${c}?pid=p1`).then(r=>r.json());
    assert.equal(back.started,true,'room survived a restart');assert.equal(back.you,0,'seat survived a restart');
    assert.equal(back.game.pot,before.pot);assert.equal(back.game.state,'roundEnd');
    assert.equal((await post(`/rooms/${c}/next`,{pid:'p1'})).ok,true,'game keeps playing after a restart');
    assert.equal((await fetch(`${B}/rooms/ZZZZ?pid=p1`)).status,404,'unknown room is 404');
    let n=0,last;for(;n<400;n++){last=await post('/rooms',{pid:'bulk'+n,name:'B'});if(last.status===400)break;}
    assert(n>=150&&n<400&&/busy/.test(last.error),'room cap protects a public server');
    console.log('ok: rooms (create, join, host-only start, turn order, bid validation, live push, conservation, survives restart, room cap)');
  }catch(e){console.error(e);process.exitCode=1;}
  finally{ctl.abort();srv.kill();}
})();
