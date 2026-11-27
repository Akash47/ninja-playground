// Katora room rules: who may do what inside a room. Pure logic: no network, no disk.
// Run by the Node server AND by a player's browser when it hosts a peer-to-peer room, so both behave identically.
(function(){
  const G=typeof require!=='undefined'?require('./game'):window; // browser: game.js defines these as globals
  const EMOJI=['😂','🔥','😱','👏','😭','🙏'];
  const clean=s=>String(s??'').trim().slice(0,20);

  const newRoom=(code,pid,name)=>{
    pid=clean(pid);name=clean(name);
    if(!pid)throw new Error('missing pid');if(!name)throw new Error('name required');
    return{code,seats:[{pid,name}],game:null};
  };
  // what one player is allowed to see of the room (cards are face up; the deck stays hidden)
  const snap=(r,pid)=>({code:r.code,seats:r.seats.map(s=>s.name),started:!!r.game,
    host:r.seats[0].pid===pid,pub:!!r.pub,you:r.seats.findIndex(s=>s.pid===pid),video:r.seats.map(s=>!!s.video),game:r.game&&G.view(r.game)});

  // Apply one action by one player. Throws Error(message) if it is not allowed.
  // Returns "effects" for the caller to deliver:  {snap:true} = everyone gets a fresh snapshot;  {to:'all'|pid, msg} = one small message.
  function apply(r,action,{pid,name,bid,emoji,on,to,data,text}={}){
    pid=clean(pid);if(!pid)throw new Error('missing pid');
    const seat=r.seats.findIndex(s=>s.pid===pid),g=r.game;
    if(action==='join'){
      if(seat>=0)return[]; // refresh / rejoin keeps your seat
      if((r.banned||[]).includes(pid))throw new Error('the host removed you from this table');
      if(g)throw new Error('game already started');
      if(r.seats.length>=8)throw new Error('room is full');
      name=clean(name);if(!name)throw new Error('name required');
      if(r.seats.some(s=>s.name.toLowerCase()===name.toLowerCase()))throw new Error('name taken');
      r.seats.push({pid,name});
    }else if(action==='start'){
      if(seat!==0)throw new Error('only the host can start');
      if(g)throw new Error('already started');
      if(r.seats.length<2)throw new Error('need at least 2 players');
      r.game=G.newGame(r.seats.map(s=>s.name));G.startRound(r.game);
    }else if(action==='bid'){
      if(!g||g.state!=='playing')throw new Error('no round in progress');
      if(seat!==g.players.indexOf(g.round.order[g.round.turn]))throw new Error('not your turn');
      G.play(g,bid);
    }else if(action==='next'){
      if(!g||g.state!=='roundEnd'||seat<0)throw new Error('round is not finished');
      G.startRound(g);
    }else if(action==='react'){ // ephemeral: not game state, so no snapshot
      if(seat<0)throw new Error('join the room first');
      if(!EMOJI.includes(emoji))throw new Error('unknown reaction');
      return[{to:'all',msg:{react:{seat,emoji}}}];
    }else if(action==='chat'){ // a live text message to the whole table. Deliberately NOT stored: no history for late joiners or reloads
      if(seat<0)throw new Error('join the room first');
      const msg=String(text??'').trim().slice(0,200);if(!msg)throw new Error('empty message');
      const now=Date.now();r.lastChat??={};if(now-(r.lastChat[seat]||0)<400)throw new Error('slow down');r.lastChat[seat]=now; // flood guard
      return[{to:'all',msg:{chat:{seat,name:r.seats[seat].name,text:msg}}}];
    }else if(action==='video'){ // "I have my camera on": others connect to me
      if(seat<0)throw new Error('join the room first');
      r.seats[seat].video=!!on;
    }else if(action==='signal'){ // relay one WebRTC handshake message between two players; media never passes through here
      if(seat<0)throw new Error('join the room first');
      const dst=r.seats[to];if(!dst||to===seat)throw new Error('bad target');
      if(!r.seats[seat].video||!dst.video)throw new Error('both players need video on');
      const msg={signal:{from:seat,data}};if(JSON.stringify(msg).length>16000)throw new Error('signal too large');
      return[{to:dst.pid,msg}];
    }else if(action==='public'){ // list this table in "Find a table" while it is waiting for players
      if(seat!==0)throw new Error('only the host can do that');
      r.pub=!!on;
    }else if(action==='kick'){ // host removes a player from the waiting room; they cannot rejoin
      if(seat!==0)throw new Error('only the host can remove players');
      if(g)throw new Error('cannot remove players during a game');
      const t=r.seats[to];if(!t||to===0)throw new Error('bad target');
      (r.banned??=[]).push(t.pid);r.seats.splice(to,1);
    }else if(action==='end'){
      if(seat!==0||!g)throw new Error('only the host can end a started game');
      g.state='over';
    }else throw new Error('unknown action');
    return[{snap:true}];
  }

  const api={EMOJI,clean,newRoom,snap,apply};
  if(typeof module!=='undefined')module.exports=api;else window.KatoraRooms=api;
})();
