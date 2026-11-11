import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {POST} from '../api/forms.js';
const root=path.resolve('dist');if(!fs.existsSync(root))throw Error('Run npm run build first.');
const port=Number(process.env.PORT||4174);const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.xml':'application/xml','.txt':'text/plain'};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,`http://127.0.0.1:${port}`);
 if(url.pathname==='/api/forms'){
  try{const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});const response=await POST(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(400);res.end('Invalid request');}return;
 }
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname));}catch{res.writeHead(400);res.end();return;}
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 let status=200;if(!fs.existsSync(file)||!fs.statSync(file).isFile()){file=path.join(root,'404.html');status=404;}
 res.writeHead(status,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`Vercel output preview: http://127.0.0.1:${port}`));
