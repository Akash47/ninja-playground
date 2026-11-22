// Run: node projects/katora/roomcore.test.js — the room rules on their own (no network)
const assert=require('assert'),core=require('./roomcore');
const r=core.newRoom('ABCD','p1','Asha');
assert.throws(()=>core.newRoom('ABCD','p1','  '),/name required/);
assert.deepEqual(core.apply(r,'join',{pid:'p2',name:'Ben'}),[{snap:true}],'a new player triggers a snapshot for everyone');
assert.deepEqual(core.apply(r,'join',{pid:'p2',name:'Ben'}),[],'rejoining with the same id changes nothing');
assert.throws(()=>core.apply(r,'join',{pid:'p3',name:'BEN'}),/name taken/);
assert.throws(()=>core.apply(r,'start',{pid:'p2'}),/only the host/);
core.apply(r,'start',{pid:'p1'});
assert.throws(()=>core.apply(r,'join',{pid:'p3',name:'Cy'}),/already started/);
assert.deepEqual(core.apply(r,'react',{pid:'p2',emoji:'🔥'}),[{to:'all',msg:{react:{seat:1,emoji:'🔥'}}}]);
assert.throws(()=>core.apply(r,'react',{pid:'p2',emoji:'💣'}),/unknown reaction/);
core.apply(r,'video',{pid:'p1',on:true});core.apply(r,'video',{pid:'p2',on:true});
assert.deepEqual(core.apply(r,'signal',{pid:'p1',to:1,data:{c:1}}),[{to:'p2',msg:{signal:{from:0,data:{c:1}}}}],'a handshake message goes only to its target');
const s=core.snap(r,'p2');assert.equal(s.you,1);assert.equal(s.host,false);assert.deepEqual(s.video,[true,true]);
assert.equal(core.snap(r,'stranger').you,-1);
assert.throws(()=>core.apply(r,'bid',{pid:'p2',bid:1}),/not your turn/);
// chat
const c1=core.apply(r,'chat',{pid:'p1',text:'  hello table  '});
assert.equal(c1.length,1);assert.equal(c1[0].to,'all');
assert.deepEqual({seat:c1[0].msg.chat.seat,name:c1[0].msg.chat.name,text:c1[0].msg.chat.text},{seat:0,name:'Asha',text:'hello table'},'trimmed, tagged with sender');
assert.throws(()=>core.apply(r,'chat',{pid:'p1',text:'again'}),/slow down/,'flood guard');
assert.throws(()=>core.apply(r,'chat',{pid:'p2',text:'   '}),/empty message/);
assert.throws(()=>core.apply(r,'chat',{pid:'stranger',text:'hi'}),/join the room first/);
assert.equal(core.apply(r,'chat',{pid:'p2',text:'x'.repeat(500)})[0].msg.chat.text.length,200,'long messages are cut to 200');
assert.equal(r.chat,undefined,'chat is not stored anywhere in the room (no history)');
console.log('ok: room rules (roomcore)');
