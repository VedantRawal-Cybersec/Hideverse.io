(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=`./`,t=`${e}game-v2/`,n=e=>`${t}?map=${encodeURIComponent(e)}`,r=[{id:`nuketown`,index:`01`,name:`Nuketown`,mode:`Competitive FPS`,detail:`Compact two-house test site with fast lanes, interiors and crisp daylight.`},{id:`rust`,index:`02`,name:`Rust`,mode:`Competitive FPS`,detail:`Desert refinery with vertical steel platforms, containers and close-range rotations.`},{id:`dome`,index:`03`,name:`Dome`,mode:`Competitive FPS`,detail:`Radar station combat around a broken radome and tight military structures.`},{id:`bloodgulch`,index:`04`,name:`Blood Gulch`,mode:`Competitive FPS`,detail:`Open canyon sightlines with bases, vehicles-scale cover and long-range fights.`},{id:`sitework`,index:`05`,name:`Site Work`,mode:`Competitive FPS`,detail:`Night construction site with neon lighting, industrial cover and layered routes.`},{id:`shivam`,index:`06`,name:`Shivam`,mode:`Competitive FPS`,detail:`Beachfront combat space with open lanes and dense urban cover.`},{id:`wilmot`,index:`07`,name:`Wilmot`,mode:`Competitive FPS`,detail:`Estate grounds with enterable manor, garden cover and varied engagement ranges.`},{id:`fishers`,index:`08`,name:`The Fisher's`,mode:`Competitive FPS`,detail:`North Shore estate built around a pool axis, terraces and flanking routes.`}],i=document.querySelector(`#app`);if(!i)throw Error(`Hideverse website root is missing.`);i.innerHTML=`
  <header class="nav shell">
    <a class="brand" href="${e}" aria-label="Hideverse home">
      <span class="brand-mark">H</span>
      <span>HIDEVERSE.IO</span>
    </a>
    <nav>
      <a href="#progress">Progress</a>
      <a href="#maps">Maps</a>
      <a href="#assets">Assets</a>
      <a class="nav-play" href="${n(`nuketown`)}">Play Build</a>
    </nav>
  </header>

  <main>
    <section class="hero shell">
      <div class="hero-copy">
        <p class="eyebrow">LIVE DEVELOPMENT BUILD</p>
        <h1>HIDE.<br />PLAY.<br /><span>BELONG.</span></h1>
        <p class="lede">
          Eight competitive FPS maps, template-based gunplay, bots, advanced rendering, adaptive PC/mobile
          graphics and realtime WebSocket rooms in one browser-first multiplayer runtime.
        </p>
        <div class="actions">
          <a class="button primary" href="${n(`nuketown`)}">Launch Current Build</a>
          <a class="button secondary" href="#maps">Choose a Map</a>
        </div>
      </div>
      <div class="hero-card">
        <div class="signal"><i></i> LIVE PIPELINE</div>
        <div class="card-grid">
          <div><span>ENGINE</span><strong>Three.js / WebGL2</strong></div>
          <div><span>FPS CORE</span><strong>Workmelt MIT Foundation</strong></div>
          <div><span>FPS MAPS</span><strong>8 ENABLED</strong></div>
          <div><span>DEPLOY</span><strong>Render Live</strong></div>
        </div>
        <p>
          The public build is generated from the latest verified <code>main</code> commit. The
          Render deployment provides the Game V2 WebSocket relay, room-ready flow, synchronized
          competitive matches, bots, advanced weapon systems and adaptive graphics.
        </p>
      </div>
    </section>

    <section id="progress" class="section shell">
      <div class="section-head">
        <p class="eyebrow">BUILD STATUS</p>
        <h2>Production roadmap</h2>
      </div>
      <div class="phase-grid extended">
        <article class="phase done">
          <span>PHASE 01</span><h3>Technical Foundation</h3>
          <p>Renderer, TypeScript/Vite, Rapier physics, validation and CI.</p><b>VERIFIED</b>
        </article>
        <article class="phase done">
          <span>PHASE 02</span><h3>Asset Pipeline</h3>
          <p>Source registry, local runtime assets, glTF validation and size budgets.</p><b>VERIFIED</b>
        </article>
        <article class="phase done">
          <span>PHASE 03</span><h3>Ravenwood Mansion</h3>
          <p>Optimized CC0 mansion, furniture, environment, spawns, hiding and collision.</p><b>PLAYABLE</b>
        </article>
        <article class="phase done">
          <span>PHASE 04</span><h3>All Six Maps</h3>
          <p>Shared full-3D layout runtime with doors, objectives, navigation and mobile LOD.</p><b>IMPLEMENTED</b>
        </article>
        <article class="phase done">
          <span>PHASE 05</span><h3>Role Characters</h3>
          <p>Hiders, seekers, guards, civilians, mimic, monster and traitor actors.</p><b>IMPLEMENTED</b>
        </article>
        <article class="phase done">
          <span>PHASE 06</span><h3>Movement + Animation</h3>
          <p>PC/mobile controls, sprint stamina, crouch, jump and shared motion states.</p><b>IMPLEMENTED</b>
        </article>
        <article class="phase done">
          <span>PHASE 07</span><h3>Six Modes</h3>
          <p>Map-bound objectives and complete mode progress state for all six game modes.</p><b>IMPLEMENTED</b>
        </article>
        <article class="phase done">
          <span>PHASE 08</span><h3>Multiplayer Rooms</h3>
          <p>Private rooms, Quick Match, SSE peer streaming, shared objectives and authoritative room state.</p><b>LIVE</b>
        </article>
        <article class="phase done">
          <span>PHASE 09</span><h3>Cross-Platform Release Pass</h3>
          <p>Adaptive resolution, mobile GPU budgets, collision-safe AI routing, result flow and input tuning.</p><b>VERIFIED</b>
        </article>
      </div>
    </section>

    <section id="maps" class="section shell">
      <div class="section-head">
        <p class="eyebrow">EIGHT PLAYABLE FPS MAPS</p>
        <h2>Choose the combat map</h2>
      </div>
      <div class="maps-grid">
        ${r.map(e=>`
              <article class="map-card">
                <span>MAP ${e.index}</span>
                <h3>${e.name}</h3>
                <b>${e.mode}</b>
                <p>${e.detail}</p>
                <a class="button secondary" href="${n(e.id)}">Play ${e.name}</a>
              </article>
            `).join(``)}
      </div>
    </section>

    <section id="ravenwood" class="section shell">
      <div class="section-head">
        <p class="eyebrow">ASSET-BACKED MAP 01</p>
        <h2>Ravenwood Mansion</h2>
      </div>
      <div class="map-feature">
        <div class="map-feature-copy">
          <span class="map-kicker">CURRENT ASSET-BACKED MAP</span>
          <h3>Victorian shell.<br />Hideverse systems.</h3>
          <p>
            Ravenwood uses the pinned CC0 Victorian house asset, optimized below the runtime
            triangle budget and combined with local Kenney and KayKit environment assets.
          </p>
          <a class="button primary" href="${n(`nuketown`)}">Enter Ravenwood</a>
        </div>
        <div class="map-meta">
          <div><span>ARCHITECTURE</span><strong>CC0 Victorian House</strong></div>
          <div><span>ASSET STATE</span><strong id="ravenwood-asset-state">LOADING</strong></div>
          <div><span>RUNTIME TRIANGLES</span><strong id="ravenwood-triangles">—</strong></div>
          <div><span>TARGET</span><strong id="ravenwood-target">≤ 400K</strong></div>
        </div>
      </div>
    </section>

    <section id="assets" class="section shell">
      <div class="section-head">
        <p class="eyebrow">LIVE ASSET REGISTRY</p>
        <h2>Repository-backed content</h2>
      </div>
      <div class="stats" id="asset-stats">
        <div><strong>—</strong><span>Acquired Assets</span></div>
        <div><strong>—</strong><span>Candidate Assets</span></div>
        <div><strong>—</strong><span>Runtime Files</span></div>
      </div>
      <div class="source-list" id="source-list"></div>
    </section>
  </main>

  <footer class="shell">
    <span>HIDEVERSE.IO</span>
    <span>Latest verified public development surface</span>
  </footer>
`;async function a(){try{let t=await fetch(`${e}data/asset-summary.json`,{cache:`no-store`});if(!t.ok)throw Error(`Asset summary HTTP ${t.status}`);let n=await t.json(),r=document.querySelector(`#asset-stats`);r&&(r.innerHTML=`
        <div><strong>${n.acquiredAssets}</strong><span>Acquired Assets</span></div>
        <div><strong>${n.candidateAssets}</strong><span>Candidate Assets</span></div>
        <div><strong>${n.runtimeFiles}</strong><span>Runtime Files</span></div>
      `);let i=document.querySelector(`#ravenwood-asset-state`),a=document.querySelector(`#ravenwood-triangles`),o=document.querySelector(`#ravenwood-target`);if(n.ravenwood){let e=n.ravenwood.status===`acquired`;i&&(i.textContent=e?`ACQUIRED + VALIDATED`:`VENDORING`),a&&(a.textContent=n.ravenwood.runtimeTriangles?n.ravenwood.runtimeTriangles.toLocaleString():`PENDING`),o&&n.ravenwood.targetTriangles&&(o.textContent=`≤ ${n.ravenwood.targetTriangles.toLocaleString()}`)}let s=document.querySelector(`#source-list`);s&&(s.innerHTML=Object.entries(n.sources).map(([e,t])=>`<span><b>${t}</b> ${e}</span>`).join(``))}catch(e){console.error(`[Hideverse web] Asset summary failed:`,e)}}a();