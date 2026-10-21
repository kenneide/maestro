import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createBridge} from './bridge.mjs';
const port=Number(process.env.PORT||4173);
const bridge=createBridge({receivePort:Number(process.env.OSC_PORT||9000),requestPort:Number(process.env.DJAY_PORT||9001),receiveHost:process.env.OSC_HOST||'127.0.0.1',requestHost:process.env.DJAY_HOST??'127.0.0.1'});
const files=new Map([['/','index.html'],['/index.html','index.html'],['/app.js','app.js'],['/music.js','music.js'],['/styles.css','styles.css']]);
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
http.createServer(async(req,res)=>{
  const allowed=new Set([`localhost:${port}`,`127.0.0.1:${port}`]);
  if(!allowed.has(req.headers.host)){res.writeHead(403);res.end('Local access only');return;}
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/')){
    if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{res.writeHead(403);res.end();return;}if(origin.protocol!=='http:'||!allowed.has(origin.host)){res.writeHead(403);res.end('Origin not allowed');return;}}
    if(path==='/api/events'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});bridge.subscribe(res);return;}
    if(path==='/api/status'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(bridge.snapshot()));return;}
    if(path==='/api/refresh'&&req.method==='POST'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({requested:bridge.dump()}));return;}
    res.writeHead(404);res.end();return;
  }
  const name=files.get(new URL(req.url,'http://localhost').pathname);
  if(!name){res.writeHead(404);res.end('Not found');return;}
  try{const data=await readFile(new URL(name,import.meta.url));res.writeHead(200,{'Content-Type':types[name.split('.').pop()],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);}catch{res.writeHead(500);res.end('Unable to read app file');}
}).listen(port,'127.0.0.1',()=>{console.log(`Horizon is ready: http://localhost:${port}`);if(process.argv.includes('--open')&&process.platform==='darwin')spawn('open',[`http://localhost:${port}`],{stdio:'ignore'});}).on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Open http://localhost:${port}, or start with a different PORT.`:error.message);process.exit(1);});
