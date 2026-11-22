// usage per project: hits, unique users, signed-in users, last seen
const fs=require('fs');
module.exports=(file='data/events.jsonl')=>{
  const out={};
  if(!fs.existsSync(file))return out;
  for(const l of fs.readFileSync(file,'utf8').split('\n').filter(Boolean)){
    const e=JSON.parse(l),p=out[e.project]??={hits:0,users:new Set(),signedIn:new Set(),last:0};
    p.hits++;p.users.add(e.user||e.anon);if(e.user)p.signedIn.add(e.user);p.last=Math.max(p.last,e.ts);
  }
  for(const p of Object.values(out)){p.users=p.users.size;p.signedIn=p.signedIn.size;}
  return out;
};
