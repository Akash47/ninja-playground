// Katora game engine: pure logic, no I/O. rng is injectable so tests are deterministic.
// Ranks: Ace=1 .. King=13.
const shuffle=(a,rng)=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const newDeck=rng=>shuffle([...Array(52)].map((_,i)=>({r:1+i%13,s:'CDHS'[Math.floor(i/13)]})),rng);

function newGame(names,{ante=10,chips=100,rng=Math.random}={}){
  if(names.length<2||names.length>8)throw new Error('2-8 players');
  return{players:names.map(name=>({name,chips})),ante,pot:0,first:0,no:0,seq:0,rng,state:'idle',round:null};
}

function startRound(g){
  const low=g.pot<g.ante; // katora is low: everyone tops it up with an ante
  const n=g.players.length,seats=g.players.map((_,i)=>g.players[(g.first+i)%n]); // starts at the rotating first seat
  const active=seats.filter(p=>low?p.chips>=g.ante:p.chips>0);
  if(active.length<2){g.state='over';return g;}
  if(low)for(const p of active){p.chips-=g.ante;g.pot+=g.ante;}
  g.first=(g.first+1)%n; // next round starts one seat later
  const deck=newDeck(g.rng),hands=new Map();
  for(const p of active){
    for(;;){const a=deck.pop(),b=deck.pop();
      if(Math.abs(a.r-b.r)>=2){hands.set(p,[a,b].sort((x,y)=>x.r-y.r));break;}
      deck.unshift(a,b);} // D4: re-deal impossible hands
  }
  g.round={deck,hands,order:active,turn:0};g.state='playing';g.last=null;g.no++;
  return g;
}

const maxBid=(g,p)=>Math.max(0,Math.min(p.chips,g.pot-1)); // never the full katora

// current player bids, then the dealer opens a card. bid 0 = pass (no card opened).
function play(g,bid){
  const R=g.round,p=R.order[R.turn];
  if(!Number.isInteger(bid)||bid<0||bid>maxBid(g,p))throw new Error(`bid must be 0..${maxBid(g,p)}`);
  const[lo,hi]=R.hands.get(p),ev={player:p.name,bid,lo:lo.r,hi:hi.r,pass:bid===0,big:bid>0&&bid*2>=g.pot}; // big = bid is at least half the katora
  if(bid>0){
    const card=R.deck.pop(),win=card.r>lo.r&&card.r<hi.r;
    p.chips+=win?bid:-bid;g.pot+=win?-bid:bid;p.streak=win?(p.streak||0)+1:0;
    Object.assign(ev,{card,win});
  }
  g.last=ev;g.seq++;
  if(++R.turn===R.order.length)g.state='roundEnd';
  return ev;
}
const total=g=>g.players.reduce((s,p)=>s+p.chips,0)+g.pot;
// what a screen needs to draw the table (cards are face up, the deck stays hidden)
function view(g){
  const R=g.round,playing=g.state==='playing';
  return{state:g.state,no:g.no,seq:g.seq,pot:g.pot,ante:g.ante,last:g.last||null,
    players:g.players.map(p=>({name:p.name,chips:p.chips,streak:p.streak||0,hand:R&&R.hands.get(p)||null})),
    turn:playing?g.players.indexOf(R.order[R.turn]):-1,
    maxBid:playing?maxBid(g,R.order[R.turn]):0};
}
// save/restore a game as JSON (Maps and player references become indexes) so a reload or restart doesn't lose it
function dump(g){
  const R=g.round;
  return JSON.stringify({players:g.players,ante:g.ante,pot:g.pot,first:g.first,no:g.no,seq:g.seq,state:g.state,last:g.last,
    round:R&&{deck:R.deck,turn:R.turn,order:R.order.map(p=>g.players.indexOf(p)),hands:g.players.map(p=>R.hands.get(p)||null)}});
}
function restore(s,rng=Math.random){
  const o=JSON.parse(s),R=o.round;
  if(R){R.order=R.order.map(i=>o.players[i]);R.hands=new Map(R.hands.map((h,i)=>[o.players[i],h]).filter(([,h])=>h));}
  return{...o,rng};
}
if(typeof module!=='undefined')module.exports={newGame,startRound,play,maxBid,total,view,dump,restore};
