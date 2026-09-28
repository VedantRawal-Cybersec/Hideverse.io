import './styles.css';

type AssetSummary = {
  acquiredAssets: number;
  candidateAssets: number;
  runtimeFiles: number;
  sources: Record<string, number>;
  ravenwood: {
    status: 'candidate' | 'acquired' | 'rejected';
    source: string;
    sourceTriangles: number | null;
    runtimeTriangles: number | null;
    runtimeBytes: number | null;
    targetTriangles: number | null;
    targetBytes: number | null;
  } | null;
  generatedAt: string;
};

const siteBase = import.meta.env.BASE_URL;
const gameHref = `${siteBase}game-v2/`;
const mapHref = (id: string): string => `${gameHref}?map=${encodeURIComponent(id)}`;

const maps = [
  {
    id: 'ravenwood',
    index: '01',
    name: 'Ravenwood Mansion',
    mode: 'Kick the Box',
    detail: 'Victorian mansion, estate cover, interactive doors, hiding and five objectives.',
  },
  {
    id: 'nexus',
    index: '02',
    name: 'Nexus Mega Mall',
    mode: 'Who Is Real?',
    detail: 'Mall atrium, retail wings, crowds, mimic role and verification objectives.',
  },
  {
    id: 'museum',
    index: '03',
    name: 'Grand Museum & Vault',
    mode: 'Hide & Heist',
    detail: 'Gallery lanes, security roles, vault route, artifacts and extraction objective.',
  },
  {
    id: 'hospital',
    index: '04',
    name: 'Blackwood Hospital',
    mode: 'Monster Hunt',
    detail: 'Dark wards, surgery wing, monster patrol, power restoration and survival cover.',
  },
  {
    id: 'hotel',
    index: '05',
    name: 'Vertigo Hotel',
    mode: 'Floor by Floor',
    detail: 'Stacked playable floors, stair route, service cover and sequential floor objectives.',
  },
  {
    id: 'axiom',
    index: '06',
    name: 'Axiom Research Facility',
    mode: 'Traitor',
    detail: 'Research wings, reactor route, scientists, security and hidden-traitor tasks.',
  },
];

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Hideverse website root is missing.');

app.innerHTML = `
  <header class="nav shell">
    <a class="brand" href="${siteBase}" aria-label="Hideverse home">
      <span class="brand-mark">H</span>
      <span>HIDEVERSE.IO</span>
    </a>
    <nav>
      <a href="#progress">Progress</a>
      <a href="#maps">Maps</a>
      <a href="#assets">Assets</a>
      <a class="nav-play" href="${mapHref('ravenwood')}">Play Build</a>
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
          <a class="button primary" href="${mapHref('ravenwood')}">Launch Current Build</a>
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
        <p class="eyebrow">SIX PLAYABLE ROUTES</p>
        <h2>Choose the map and mode</h2>
      </div>
      <div class="maps-grid">
        ${maps
          .map(
            (map) => `
              <article class="map-card">
                <span>MAP ${map.index}</span>
                <h3>${map.name}</h3>
                <b>${map.mode}</b>
                <p>${map.detail}</p>
                <a class="button secondary" href="${mapHref(map.id)}">Play ${map.name}</a>
              </article>
            `,
          )
          .join('')}
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
          <a class="button primary" href="${mapHref('ravenwood')}">Enter Ravenwood</a>
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
`;

async function hydrateAssets(): Promise<void> {
  try {
    const response = await fetch(`${siteBase}data/asset-summary.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Asset summary HTTP ${response.status}`);
    const summary = (await response.json()) as AssetSummary;

    const stats = document.querySelector<HTMLDivElement>('#asset-stats');
    if (stats) {
      stats.innerHTML = `
        <div><strong>${summary.acquiredAssets}</strong><span>Acquired Assets</span></div>
        <div><strong>${summary.candidateAssets}</strong><span>Candidate Assets</span></div>
        <div><strong>${summary.runtimeFiles}</strong><span>Runtime Files</span></div>
      `;
    }

    const ravenwoodState = document.querySelector<HTMLElement>('#ravenwood-asset-state');
    const ravenwoodTriangles = document.querySelector<HTMLElement>('#ravenwood-triangles');
    const ravenwoodTarget = document.querySelector<HTMLElement>('#ravenwood-target');

    if (summary.ravenwood) {
      const ready = summary.ravenwood.status === 'acquired';
      if (ravenwoodState) ravenwoodState.textContent = ready ? 'ACQUIRED + VALIDATED' : 'VENDORING';
      if (ravenwoodTriangles) {
        ravenwoodTriangles.textContent = summary.ravenwood.runtimeTriangles
          ? summary.ravenwood.runtimeTriangles.toLocaleString()
          : 'PENDING';
      }
      if (ravenwoodTarget && summary.ravenwood.targetTriangles) {
        ravenwoodTarget.textContent = `≤ ${summary.ravenwood.targetTriangles.toLocaleString()}`;
      }
    }

    const sources = document.querySelector<HTMLDivElement>('#source-list');
    if (sources) {
      sources.innerHTML = Object.entries(summary.sources)
        .map(([name, count]) => `<span><b>${count}</b> ${name}</span>`)
        .join('');
    }
  } catch (error) {
    console.error('[Hideverse web] Asset summary failed:', error);
  }
}

void hydrateAssets();
