import"./modulepreload-polyfill-B5Qt9EMX.js";import{i as $,W as k}from"./brand-CwufGQoz.js";$();const y=document.createElement("style");y.textContent=`
  html, body { margin: 0; background: var(--wm-bg); color: var(--wm-fg); font-family: var(--wm-body); }
  #app { max-width: 960px; margin: 0 auto; padding: 32px 24px 96px; }
  .wm-header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 4px; }
  .wm-mark { font-size: 32px; }
  .wm-sub { color: var(--wm-muted-fg); font-size: 14px; margin-bottom: 28px; }
  .wm-group { margin-bottom: 28px; }
  .wm-group h2 { font-family: var(--wm-display); font-weight: 400; letter-spacing: .04em; text-transform: uppercase;
    font-size: 20px; color: var(--wm-fg); border-bottom: 1px solid var(--wm-border); padding-bottom: 8px; margin-bottom: 12px; }
  .wm-subgroup { margin-bottom: 16px; }
  .wm-subgroup h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--wm-muted-fg);
    margin: 0 0 8px; font-weight: 600; }
  .wm-rows { display: flex; flex-direction: column; gap: 6px; }
  .wm-row { display: flex; align-items: center; gap: 10px; background: var(--wm-panel); border: 1px solid var(--wm-border);
    border-radius: var(--wm-r-sm); padding: 8px 10px; transition: border-color var(--wm-t); }
  .wm-row:hover { border-color: var(--wm-accent); }
  .wm-row button { appearance: none; border: none; border-radius: var(--wm-r-sm); background: var(--wm-fg); color: var(--wm-graphite, #181c28);
    font: inherit; font-weight: 600; font-size: 13px; padding: 6px 14px; cursor: pointer; transition: background var(--wm-t); }
  .wm-row button:hover { background: var(--wm-fg-warm); }
  .wm-row button.playing { background: var(--wm-accent); }
  .wm-row .name { font-size: 13px; color: var(--wm-fg-dim); flex: 1; font-family: monospace; }
  .wm-row .dur { font-size: 12px; color: var(--wm-muted-fg); font-variant-numeric: tabular-nums; width: 42px; text-align: right; }
  .wm-controls { position: sticky; top: 0; z-index: 1; background: var(--wm-bg); padding: 12px 0; margin-bottom: 12px;
    display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--wm-border); }
  .wm-controls label { font-size: 13px; color: var(--wm-muted-fg); display: flex; align-items: center; gap: 6px; }
  .wm-controls input[type="range"] { accent-color: var(--wm-accent); }
  .wm-controls input[type="text"] { background: var(--wm-panel-2); border: 1px solid var(--wm-border); color: var(--wm-fg);
    border-radius: var(--wm-r-sm); padding: 6px 10px; font: inherit; font-size: 13px; flex: 1; }
  .wm-empty { color: var(--wm-muted-fg); font-size: 13px; padding: 24px 0; }
`;document.head.appendChild(y);const z=document.getElementById("app");z.innerHTML=`
  <div class="wm-header"><span class="wm-mark">${k}</span><span>Audio Debug</span></div>
  <div class="wm-sub">/debug/audio — plays raw files from public/sfx via the manifest. Nothing here touches the game's mixer.</div>
  <div class="wm-controls">
    <input type="text" id="filter" placeholder="Filter (e.g. shot/ak, footstep, wood)" />
    <label>Vol <input type="range" id="vol" min="0" max="1" step="0.01" value="0.8" /></label>
  </div>
  <div id="groups"></div>
`;const d=document.getElementById("groups"),h=document.getElementById("filter"),w=document.getElementById("vol");let E={},o=null,i=null;function g(){o&&(o.pause(),o.currentTime=0),i&&i.classList.remove("playing"),o=null,i=null}function H(e,r){g();const t=new Audio(`/sfx/${e}`);t.volume=Number(w.value),t.addEventListener("ended",()=>{o===t&&g()}),t.play().catch(n=>console.warn("playback failed",e,n)),o=t,i=r,r.classList.add("playing")}function L(e){const r=e.trim().toLowerCase();d.innerHTML="";let t=!1;for(const[n,b]of Object.entries(E)){const s=document.createElement("div");s.className="wm-group";let v=!1,x=`<h2>${n}</h2>`;for(const[a,p]of Object.entries(b))p.filter(u=>!r||`${n}/${a}/${u}`.toLowerCase().includes(r)).length&&(v=!0,x+=`<div class="wm-subgroup"><h3>${a}</h3><div class="wm-rows" data-sub="${n}/${a}"></div></div>`);if(v){t=!0,s.innerHTML=x,d.appendChild(s);for(const[a,p]of Object.entries(b)){const c=p.filter(m=>!r||`${n}/${a}/${m}`.toLowerCase().includes(r));if(!c.length)continue;const u=s.querySelector(`[data-sub="${n}/${a}"]`);for(const m of c){const l=document.createElement("div");l.className="wm-row",l.innerHTML=`<button type="button">▶</button><span class="name">${m}</span>`;const f=l.querySelector("button");f.addEventListener("click",()=>{if(i===f)return g();H(m,f)}),u.appendChild(l)}}}}t||(d.innerHTML='<div class="wm-empty">No sounds match that filter.</div>')}h.addEventListener("input",()=>L(h.value));w.addEventListener("input",()=>{o&&(o.volume=Number(w.value))});fetch("/sfx/manifest.json").then(e=>e.json()).then(e=>{E=e,L("")}).catch(e=>{d.innerHTML=`<div class="wm-empty">Failed to load manifest.json: ${e}</div>`});
//# sourceMappingURL=debugAudio-D-vPXMvj.js.map
