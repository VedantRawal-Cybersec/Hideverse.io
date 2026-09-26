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

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Hideverse website root is missing.');

app.innerHTML = `
  <header class="nav shell">
    <a class="brand" href="/" aria-label="Hideverse home">
      <span class="brand-mark">H</span>
      <span>HIDEVERSE.IO</span>
    </a>
    <nav>
      <a href="#progress">Progress</a>
      <a href="#assets">Assets</a>
      <a href="#roadmap">Roadmap</a>
      <a class="nav-play" href="/game/">Play Current Build</a>
    </nav>
  </header>

  <main>
    <section class="hero shell">
      <div class="hero-copy">
        <p class="eyebrow">LIVE DEVELOPMENT BUILD</p>
        <h1>HIDE.<br />PLAY.<br /><span>BELONG.</span></h1>
        <p class="lede">
          A browser-first multiplayer social-stealth playground. This page always represents
          the latest verified Hideverse build deployed from the main branch.
        </p>
        <div class="actions">
          <a class="button primary" href="/game/">Launch Current Build</a>
          <a class="button secondary" href="#progress">See What Works</a>
        </div>
      </div>
      <div class="hero-card">
        <div class="signal"><i></i> LIVE PIPELINE</div>
        <div class="card-grid">
          <div><span>ENGINE</span><strong>PlayCanvas</strong></div>
          <div><span>PHYSICS</span><strong>Rapier 3D</strong></div>
          <div><span>AI BASE</span><strong>Yuka</strong></div>
          <div><span>DEPLOY</span><strong>Railway</strong></div>
        </div>
        <p>Every verified change merged to <code>main</code> is intended to become visible here.</p>
      </div>
    </section>

    <section id="progress" class="section shell">
      <div class="section-head">
        <p class="eyebrow">BUILD STATUS</p>
        <h2>What exists right now</h2>
      </div>
      <div class="phase-grid">
        <article class="phase done">
          <span>PHASE 01</span>
          <h3>Technical Foundation</h3>
          <p>Renderer, physics, AI bootstrap, TypeScript/Vite, CI and Railway-ready server.</p>
          <b>VERIFIED</b>
        </article>
        <article class="phase done">
          <span>PHASE 02</span>
          <h3>Asset Pipeline</h3>
          <p>CC0 source registry, local runtime assets, glTF validation, size budgets and license tracking.</p>
          <b>ACTIVE</b>
        </article>
        <article class="phase active">
          <span>PHASE 03</span>
          <h3>Ravenwood Mansion</h3>
          <p>CC0 Victorian mansion base + mixed-source nature, furniture, Rapier movement, collision and map QA.</p>
          <b id="ravenwood-card-status">IN DEVELOPMENT</b>
        </article>
      </div>
    </section>

    <section id="ravenwood" class="section shell">
      <div class="section-head">
        <p class="eyebrow">MAP 01 · PHASE 03</p>
        <h2>Ravenwood Mansion</h2>
      </div>
      <div class="map-feature">
        <div class="map-feature-copy">
          <span class="map-kicker">CURRENT PLAYABLE MAP</span>
          <h3>Victorian shell.<br />Hideverse systems.</h3>
          <p>
            Ravenwood is being built from a pinned CC0 Victorian house source, then optimized
            for browser play and combined with our existing Kenney and KayKit environment library.
          </p>
          <a class="button primary" href="/game/">Enter Ravenwood Build</a>
        </div>
        <div class="map-meta">
          <div><span>ARCHITECTURE</span><strong>CC0 Victorian House</strong></div>
          <div><span>ASSET STATE</span><strong id="ravenwood-asset-state">VENDORING</strong></div>
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

    <section id="roadmap" class="section shell">
      <div class="section-head">
        <p class="eyebrow">PRODUCTION ORDER</p>
        <h2>Where Hideverse goes next</h2>
      </div>
      <ol class="roadmap">
        <li><span>03</span><div><b>Ravenwood Mansion</b><p>Complete, explorable production map.</p></div></li>
        <li><span>04</span><div><b>All Six Maps</b><p>Mall, museum, hospital, hotel and research facility.</p></div></li>
        <li><span>05</span><div><b>Characters</b><p>Players, seekers, NPCs, guards and monster actors.</p></div></li>
        <li><span>06</span><div><b>Movement + Animation</b><p>Desktop/mobile controller and common animation state machine.</p></div></li>
        <li><span>07</span><div><b>Six Modes</b><p>Gameplay rules, objectives, AI and interactions.</p></div></li>
        <li><span>08</span><div><b>Multiplayer</b><p>Authoritative rooms, private codes, matchmaking and persistence.</p></div></li>
      </ol>
    </section>
  </main>

  <footer class="shell">
    <span>HIDEVERSE.IO</span>
    <span>Latest verified public development surface</span>
  </footer>
`;

async function hydrateAssets(): Promise<void> {
  try {
    const response = await fetch('/data/asset-summary.json', { cache: 'no-store' });
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
    const ravenwoodCardStatus = document.querySelector<HTMLElement>('#ravenwood-card-status');

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
      if (ravenwoodCardStatus) {
        ravenwoodCardStatus.textContent = ready ? 'PLAYABLE BUILD' : 'IN DEVELOPMENT';
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
