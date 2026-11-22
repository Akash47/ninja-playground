// Run: node projects/katora/game.test.js
const assert=require('assert'),{newGame,startRound,play,maxBid,total}=require('./game');
let s=42;const rng=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296; // seeded: repeatable

// 1. deck is a real 52-card deck, Ace low
{const g=newGame(['A','B'],{rng});startRound(g);
 const all=[...g.round.deck,...[...g.round.hands.values()].flat()];
 assert.equal(new Set(all.map(c=>c.r+c.s)).size,52);
 assert(all.every(c=>c.r>=1&&c.r<=13));}

// 2. bid rules: negative, fractional, too big, full katora all rejected
{const g=newGame(['A','B'],{rng});startRound(g); // pot 20
 for(const bad of [-1,1.5,20,999,'5'])assert.throws(()=>play(g,bad),Error,`bid ${bad} should be rejected`);
 assert.equal(maxBid(g,g.round.order[0]),19);}

// 3. win/lose money moves, with hand-picked cards
{const g=newGame(['A','B'],{rng});startRound(g);const p=g.round.order[0];
 g.round.hands.set(p,[{r:3,s:'C'},{r:9,s:'C'}]);
 g.round.deck.push({r:5,s:'D'});play(g,10);           // 5 is between 3 and 9: win
 assert.equal(p.chips,90+10);assert.equal(g.pot,10);
 const q=g.round.order[1];g.round.hands.set(q,[{r:3,s:'C'},{r:9,s:'C'}]);
 g.round.deck.push({r:9,s:'D'});play(g,5);             // exact hit: loss
 assert.equal(q.chips,90-5);assert.equal(g.pot,15);}

// 4. pass opens no card
{const g=newGame(['A','B'],{rng});startRound(g);const n=g.round.deck.length;
 const ev=play(g,0);assert(ev.pass&&g.round.deck.length===n);}

// 5. simulation: random bids, chips+pot never change, game ends cleanly
{const g=newGame(['A','B','C'],{rng}),money=total(g);let rounds=0,wins=0,losses=0;
 while(rounds<5000){startRound(g);if(g.state==='over')break;rounds++;
  while(g.state==='playing'){const p=g.round.order[g.round.turn],
    ev=play(g,Math.floor(rng()*(maxBid(g,p)+1)));
    if(ev.win)wins++;else if(!ev.pass)losses++;
    assert.equal(total(g),money);assert(g.pot>=0&&g.players.every(p=>p.chips>=0));}}
 assert(wins>0&&losses>0);
 console.log(`ok: ${rounds} rounds, ${wins} wins, ${losses} losses, chips conserved`);}

// 6. first seat rotates each round; ante only when katora is low
{const g=newGame(['A','B','C'],{rng});
 startRound(g);assert.equal(g.pot,30);assert.equal(g.round.order[0].name,'A');
 while(g.state==='playing')play(g,0);                 // everyone passes
 startRound(g);assert.equal(g.pot,30,'no ante: katora not low');assert.equal(g.round.order[0].name,'B');
 assert.deepEqual(g.round.order.map(p=>p.name),['B','C','A']);
 while(g.state==='playing')play(g,0);
 g.pot=5;                                             // force a low katora (5 < ante 10)
 startRound(g);assert.equal(g.pot,35,'low katora: everyone antes');assert.equal(g.round.order[0].name,'C');}
// 7. streaks and the big-bid flag
{const g=newGame(['A','B'],{rng});startRound(g);const[p,q]=g.round.order;
 g.round.hands.set(p,[{r:3,s:'C'},{r:9,s:'C'}]);g.round.hands.set(q,[{r:3,s:'C'},{r:9,s:'C'}]);
 g.round.deck.push({r:9,s:'D'});g.round.deck.push({r:5,s:'D'});
 const e1=play(g,10);assert(e1.win&&e1.big,'10 of a 20 katora is big');assert.equal(p.streak,1);
 const e2=play(g,2);assert(!e2.win&&!e2.big);assert.equal(q.streak,0);}
// 8. save/restore: a game survives JSON and keeps playing identically
{const{dump,restore,view}=require('./game');
 const g=newGame(['A','B','C'],{rng});startRound(g);play(g,7);
 const r=restore(dump(g),rng);
 assert.equal(JSON.stringify(view(r)),JSON.stringify(view(g)),'restored game looks identical');
 const cur=r.round.order[r.round.turn];assert(r.round.order.every(p=>r.players.includes(p)),'order points at real players');
 play(r,Math.min(5,maxBid(r,cur)));assert.equal(total(r),total(g),'chips conserved after restore');
 while(r.state==='playing')play(r,0);startRound(r);assert.equal(r.state,'playing','next round works after restore');}
console.log('all tests passed');
