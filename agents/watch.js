// Reads usage, writes agents/TASKS.md: one action per project. Run on cron: */15 * * * * node agents/watch.js
const fs=require('fs'),stats=require('../stats')(),DAY=864e5;
const names=fs.readdirSync('projects').filter(n=>fs.existsSync(`projects/${n}/project.json`));
const rows=names.map(n=>{
  const s=stats[n],auth=JSON.parse(fs.readFileSync(`projects/${n}/project.json`)).auth;
  let a;
  if(!s)a='NO USAGE: improve landing/first-run, make it funnier or shareable';
  else if(Date.now()-s.last>7*DAY)a=`STALE (${s.hits} hits total): revive or archive`;
  else if(s.users>=10)a=`GROWING (${s.users} users, ${s.hits} hits): add features, harden, add feedback`;
  else a=`EARLY (${s.users} users, ${s.hits} hits): watch, fix rough edges`;
  if(auth&&s&&!s.signedIn)a+=' | auth on but nobody signed in: check login flow';
  return `- **${n}**: ${a}`;
});
fs.writeFileSync('agents/TASKS.md',`# Agent tasks (generated ${new Date().toISOString()})\n\n${rows.join('\n')}\n`);
console.log(rows.join('\n'));
