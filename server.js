// Servidor estático Node.js para o Render. A persistência fica no Firebase.
const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=path.join(__dirname,"public"),PORT=process.env.PORT||3000;
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".gif":"image/gif"};
function config(){
 const e=n=>(process.env[n]||"").trim().replace(/^(["'])(.*)\1$/, "$2");
 const firebase={apiKey:e("FIREBASE_API_KEY"),authDomain:e("FIREBASE_AUTH_DOMAIN"),projectId:e("FIREBASE_PROJECT_ID"),messagingSenderId:e("FIREBASE_MESSAGING_SENDER_ID"),appId:e("FIREBASE_APP_ID")};
 const out={};if(Object.values(firebase).every(Boolean))out.firebase=firebase;
 return "window.APP_CONFIG = "+JSON.stringify(out).replace(/</g,"\\u003c")+";\n";
}
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,"http://localhost");
 if(url.pathname==="/healthz"){res.writeHead(200,{"content-type":"text/plain"});return res.end("ok");}
 if(url.pathname==="/config.js"){res.writeHead(200,{"content-type":mime[".js"],"cache-control":"no-store"});return res.end(config());}
 let pathname=decodeURIComponent(url.pathname);if(pathname==="/")pathname="/index.html";
 let file=path.resolve(ROOT,"."+pathname);
 if(!file.startsWith(ROOT+path.sep)&&file!==ROOT){res.writeHead(403);return res.end("Forbidden");}
 fs.stat(file,(err,st)=>{
  if(!err&&st.isDirectory())file=path.join(file,"index.html");
  fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end("Não encontrado");}
   res.writeHead(200,{"content-type":mime[path.extname(file).toLowerCase()]||"application/octet-stream","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","cache-control":"no-cache"});res.end(data);
  });
 });
});
server.listen(PORT,"0.0.0.0",()=>console.log("Amigo Secreto no ar na porta "+PORT));
