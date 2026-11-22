const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),stats=require('./stats');
// Safe by default on the internet: no guessable secrets. Set SECRET / ADMIN_KEY to keep them across restarts.
const rand=()=>crypto.randomBytes(16).toString('hex');
const SECRET=process.env.SECRET||rand(),ADMIN=process.env.ADMIN_KEY||rand(),PORT=process.env.PORT||3000;
const EV=process.env.EVENTS||'data/events.jsonl',P='projects';
process.on('uncaughtException',e=>console.error('uncaught:',e.message)); // a public server must not die on one bad request
const sign=v=>v+'.'+crypto.createHmac('sha256',SECRET).update(v).digest('hex').slice(0,24);
const unsign=s=>{if(!s)return;const i=s.lastIndexOf('.'),v=s.slice(0,i);return sign(v)===s?v:undefined};
const ck=(r,k)=>(r.headers.cookie||'').split('; ').map(c=>c.split('=')).find(c=>c[0]===k)?.[1];
const projects=()=>fs.readdirSync(P).filter(n=>fs.existsSync(`${P}/${n}/project.json`)).map(n=>({name:n,...JSON.parse(fs.readFileSync(`${P}/${n}/project.json`))}));
http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x'),setc=[];
  let anon=ck(req,'aid'); if(!anon){anon='a_'+crypto.randomBytes(6).toString('hex');setc.push(`aid=${anon}; Path=/; Max-Age=31536000; SameSite=Lax`);}
  const user=unsign(decodeURIComponent(ck(req,'u')||''));
  const send=(code,body,type='text/html',h={})=>{res.writeHead(code,{'Content-Type':type,'Set-Cookie':setc,...h});res.end(body);};
  // the Ninja Playground home page (same file the static site uses) and the list of projects that feeds it
  if(u.pathname==='/')return send(200,fs.readFileSync('site/index.html'));
  if(u.pathname==='/projects.json')return send(200,JSON.stringify(projects().map(p=>({name:p.name,title:p.title,tagline:p.tagline||'',emoji:p.emoji||'🎲',icon:p.icon||null,tags:p.tags||[],auth:!!p.auth,href:`/p/${p.name}/`}))),'application/json');
  if(u.pathname==='/login'){ // ponytail: email-only sign-in, no verification; add magic link/OAuth before real users
    if(req.method==='POST'){let b='';req.on('data',d=>{b+=d;if(b.length>1e4)req.destroy();}).on('end',()=>{
      const email=(new URLSearchParams(b).get('email')||'').trim().toLowerCase();
      if(!/^\S+@\S+$/.test(email))return send(400,'bad email');
      setc.push(`u=${encodeURIComponent(sign(email))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
      const nx=u.searchParams.get('next')||'/';send(302,'','text/plain',{Location:/^\/(?!\/)/.test(nx)?nx:'/'});});return;}
    return send(200,'<form method=post><input name=email type=email placeholder=you@x.com required><button>Sign in</button></form>');
  }
  if(u.pathname==='/stats'||u.pathname==='/dashboard'){
    if(u.searchParams.get('key')!==ADMIN)return send(403,'no');
    const s=stats();
    if(u.pathname==='/stats')return send(200,JSON.stringify(s,null,1),'application/json');
    const rows=Object.entries(s).sort((a,b)=>b[1].hits-a[1].hits).map(([n,p])=>`<tr><td>${n}<td>${p.hits}<td>${p.users}<td>${p.signedIn}<td>${new Date(p.last).toLocaleString()}`).join('');
    return send(200,`<meta http-equiv=refresh content=10><h1>Usage</h1><table border=1 cellpadding=6><tr><th>Project<th>Hits<th>Users<th>Signed in<th>Last seen${rows}</table>`);
  }
  const m=u.pathname.match(/^\/p\/([\w-]+)(\/.*)?$/),proj=m&&projects().find(p=>p.name===m[1]);
  if(!proj)return send(404,'not found');
  if(!m[2])return send(302,'','text/plain',{Location:u.pathname+'/'+u.search}); // /p/katora -> /p/katora/ so relative files (icons, manifest) resolve
  if(proj.auth&&!user)return send(302,'','text/plain',{Location:'/login?next='+encodeURIComponent(u.pathname)});
  const sub=m[2]||'/',isUse=sub==='/'||sub.endsWith('.html')||(sub.startsWith('/api/')&&!sub.endsWith('/events')); // count page opens and game actions, not images, scripts or SSE reconnects
  if(isUse)
    fs.appendFileSync(EV,JSON.stringify({ts:Date.now(),project:proj.name,path:m[2]||'/',user,anon})+'\n');
  // a project may ship its own server.js to handle /p/<name>/api/*; the gateway still logs and guards it
  if((m[2]||'').startsWith('/api/')){
    const h=path.resolve(P,proj.name,'server.js');
    return fs.existsSync(h)?require(h)(req,res,m[2].slice(5)):send(404,'no api');
  }
  const f=path.join(P,proj.name,path.normalize(m[2]&&m[2]!=='/'?m[2]:'/index.html'));
  if(!f.startsWith(path.join(P,proj.name))||!fs.existsSync(f)||f.endsWith('project.json')||/(^|[\\/])(server|[\w.-]+\.test)\.js$/.test(f))return send(404,'not found');
  send(200,fs.readFileSync(f),{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'}[path.extname(f)]||'application/octet-stream');
}).listen(PORT,()=>{console.log('http://localhost:'+PORT);console.log('usage dashboard: http://localhost:'+PORT+'/dashboard?key='+ADMIN+(process.env.ADMIN_KEY?'':'   (random key; set ADMIN_KEY to keep it)'));});
