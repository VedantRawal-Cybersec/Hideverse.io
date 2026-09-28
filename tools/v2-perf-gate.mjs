import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const root = path.resolve('apps/web/dist');
const port = Number(process.env.V2_PERF_PORT || 4173);
const p95Limit = Number(process.env.V2_PERF_P95_MS || 24);
const long50Limit = Number(process.env.V2_PERF_LONG50_PCT || 1);

const mime = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.svg':'image/svg+xml',
  '.wasm':'application/wasm',
  '.mp3':'audio/mpeg',
  '.ogg':'audio/ogg',
  '.bin':'application/octet-stream'
};

const server = http.createServer((req,res)=>{
  try {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, '.' + rel);
    if (!file.startsWith(root)) throw new Error('path traversal');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404; res.end('not found'); return;
    }
    res.setHeader('content-type', mime[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('cache-control', 'no-store');
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    res.statusCode = 500; res.end(String(e));
  }
});
await new Promise((resolve,reject)=>{
  server.once('error', reject);
  server.listen(port,'127.0.0.1',resolve);
});

const candidates = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);
const chrome = candidates.find((p)=>fs.existsSync(p));
if (!chrome) {
  server.close();
  throw new Error('No Chromium/Chrome binary found on CI runner');
}
const userData = fs.mkdtempSync(path.join(os.tmpdir(),'hideverse-v2-perf-'));
const chromeProc = spawn(chrome,[
  '--headless=new',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--window-size=1280,720',
  '--remote-debugging-port=9222',
  '--user-data-dir='+userData,
  'about:blank'
],{stdio:['ignore','ignore','pipe']});
let stderr='';
chromeProc.stderr.on('data',(d)=>{ stderr += String(d); });

const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let version;
for (let i=0;i<80;i++) {
  try {
    const r=await fetch('http://127.0.0.1:9222/json/version');
    if (r.ok) { version=await r.json(); break; }
  } catch {}
  await sleep(100);
}
if (!version) throw new Error('Chrome DevTools endpoint did not start: '+stderr.slice(-1500));

const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const target = targets.find((x)=>x.type==='page');
if (!target?.webSocketDebuggerUrl) throw new Error('No Chrome page target');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{
  ws.addEventListener('open',resolve,{once:true});
  ws.addEventListener('error',reject,{once:true});
});
let nextId=1;
const pending=new Map();
ws.addEventListener('message',(ev)=>{
  const msg=JSON.parse(ev.data);
  if (!msg.id) return;
  const p=pending.get(msg.id); if (!p) return;
  pending.delete(msg.id);
  if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
  else p.resolve(msg.result);
});
const cdp=(method,params={})=>new Promise((resolve,reject)=>{
  const id=nextId++; pending.set(id,{resolve,reject});
  ws.send(JSON.stringify({id,method,params}));
});
await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/game-v2/?match=0&mp=0&q=performance`});

for (let i=0;i<240;i++) {
  const r=await cdp('Runtime.evaluate',{expression:'window.__READY__ === true',returnByValue:true});
  if (r.result?.value === true) break;
  if (i===239) throw new Error('V2 never reached __READY__');
  await sleep(100);
}
await cdp('Runtime.evaluate',{expression:"window.__APPLY_SHOT__?.('combat')",returnByValue:true});
await sleep(2500);

const expression = String.raw`new Promise((resolve) => {
  const dts = [];
  let last = performance.now();
  const start = last;
  function done() {
    const s = dts.slice().sort((a,b)=>a-b);
    const pct = (p) => s[Math.min(s.length-1, Math.max(0, Math.floor((s.length-1)*p)))] || 0;
    const mean = dts.reduce((a,b)=>a+b,0) / Math.max(1,dts.length);
    resolve({
      samples: dts.length,
      meanMs: mean,
      fps: 1000 / mean,
      p50Ms: pct(.50),
      p95Ms: pct(.95),
      p99Ms: pct(.99),
      maxMs: Math.max(...dts),
      over25: dts.filter(x=>x>25).length,
      over33: dts.filter(x=>x>33.34).length,
      over50: dts.filter(x=>x>50).length,
      engine: window.__PERF_STATS__?.(600) ?? null,
      render: window.__RENDER_INFO__ ?? null
    });
  }
  function tick(t) {
    const dt = t-last; last=t;
    if (dt < 1000) dts.push(dt);
    if (dts.length >= 600 || t-start >= 10000) done();
    else requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})`;
const evalResult=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
const stats=evalResult.result?.value;
if (!stats) throw new Error('No performance stats returned');
const long50Pct = stats.samples ? (stats.over50 / stats.samples) * 100 : 100;
console.log('[v2-perf]', JSON.stringify({...stats,long50Pct:Number(long50Pct.toFixed(2))}, null, 2));

const failures=[];
if (stats.p95Ms > p95Limit) failures.push(`p95 ${stats.p95Ms.toFixed(2)}ms > ${p95Limit}ms`);
if (long50Pct > long50Limit) failures.push(`>50ms frames ${long50Pct.toFixed(2)}% > ${long50Limit}%`);
if ((stats.render?.calls ?? 0) > 350) failures.push(`draw calls ${stats.render.calls} > 350`);

try { ws.close(); } catch {}
try { chromeProc.kill('SIGTERM'); } catch {}
server.close();

if (failures.length) {
  console.error('[v2-perf] FAIL:', failures.join('; '));
  process.exit(1);
}
console.log('[v2-perf] PASS');
