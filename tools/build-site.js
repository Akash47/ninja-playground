// Build the free static website into dist/: the Ninja Playground home page + every project marked "static": true.
// Projects that need sign-in or a game server (no "static" flag) are left out; they only exist on the Node server.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),out=path.join(root,'dist');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const list=[];
for(const name of fs.readdirSync(path.join(root,'projects')).sort()){
  const dir=path.join(root,'projects',name),pj=path.join(dir,'project.json');
  if(!fs.existsSync(pj))continue;
  const p=JSON.parse(fs.readFileSync(pj,'utf8'));if(!p.static)continue;
  fs.mkdirSync(path.join(out,name),{recursive:true});
  for(const f of p.files||['index.html'])fs.copyFileSync(path.join(dir,f),path.join(out,name,f)); // throws if a listed file is missing
  list.push({name,title:p.title,tagline:p.tagline||'',emoji:p.emoji||'🎲',icon:p.icon||null,tags:p.tags||[],auth:false,href:name+'/'});
}
fs.copyFileSync(path.join(root,'site/index.html'),path.join(out,'index.html'));
fs.writeFileSync(path.join(out,'.nojekyll'),''); // tell GitHub Pages to serve the files as they are
fs.writeFileSync(path.join(out,'projects.json'),JSON.stringify(list,null,1));
console.log('Built',out);for(const p of list)console.log('  /'+p.name+'/   '+p.title);
