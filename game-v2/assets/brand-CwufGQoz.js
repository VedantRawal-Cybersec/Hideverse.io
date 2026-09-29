const e={bg:"#000000",surface:"#0a0c11",fg:"#ededed",accent:"#5f7cf9",muted:"#62666e",border:"#23262e",ok:"#49c873",warn:"#f2b643",danger:"#d95c5c",info:"#5f7cf9",graphite:"#05060a",cloud:"#d0d2d7"},n="'Geist','Inter',system-ui,-apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif",s="'Geist','Inter',system-ui,-apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif",i="'Geist Mono',ui-monospace,'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace",a="wm-brand-tokens",r="wm-brand-font",l="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap",c=`
:root {
  --wm-bg: ${e.bg};
  --wm-surface: ${e.surface};
  --wm-fg: ${e.fg};
  --wm-accent: ${e.accent};
  --wm-muted: ${e.muted};
  --wm-border: ${e.border};
  --wm-ok: ${e.ok};
  --wm-warn: ${e.warn};
  --wm-danger: ${e.danger};
  --wm-info: ${e.info};

  /* Graphite: deep shadow and the void behind panels. */
  --wm-void: ${e.graphite};
  --wm-cloud: ${e.cloud};

  /* Channel forms of the colours that ever appear at partial alpha. A surface
     scrim over the live scene needs the palette AND an opacity, and rgba()
     cannot take a hex custom property — so the channels are the token and
     rgb(var(--x) / a) is how every translucent WORKMELT surface is built. */
  --wm-bg-rgb: 0 0 0;
  --wm-surface-rgb: 10 12 17;
  --wm-void-rgb: 5 6 10;
  --wm-fg-rgb: 237 237 237;
  --wm-accent-rgb: 95 124 249;

  /* Panels sit on the void at near-full opacity — Console Black is a console,
     not a window; the live scene shows only where a surface chooses to open. */
  --wm-panel: rgb(var(--wm-surface-rgb) / .92);
  /* color-mix(in srgb, Console 55%, Ice White 4%) — inset wells, chips, tracks */
  --wm-panel-2: #12141a;
  /* color-mix(in srgb, Console 80%, Ice White 8%) — row hover */
  --wm-hover: #191c23;
  /* color-mix(in srgb, Ice White 74%, Void) — body copy, 10.0:1 */
  --wm-fg-dim: #b0b0b0;
  /* color-mix(in srgb, Ice White 88%, Signal Blue) — the hover state of a
     filled primary button, warming the fill toward the accent without ever
     putting light text on a blue fill. */
  --wm-fg-warm: #dce1fb;
  /* color-mix(in srgb, Steel 55%, Ice White) — every string under 16px that
     wants to read as secondary uses this lift instead of Steel. 7.0:1. */
  --wm-muted-fg: #9ca0a8;

  /* Console Black is near-square: hairline rectangles, softened one step. */
  --wm-r: 2px;
  --wm-r-sm: 2px;
  --wm-display: ${n};
  --wm-body: ${s};
  --wm-mono: ${i};
  /* 120-180ms, swift out / linear in. Panels may overshoot subtly; nothing else. */
  --wm-t: 150ms cubic-bezier(.2,.85,.3,1);
  --wm-t-slow: 180ms cubic-bezier(.2,.85,.3,1);
  /* Depth is a hairline, not a shadow — kept only as a faint seat for the one
     or two surfaces that float over a live scene. Zero offset, always. */
  --wm-shadow: 0 0 48px rgb(var(--wm-void-rgb) / .6);
  --wm-shadow-lift: 0 0 64px rgb(var(--wm-void-rgb) / .75);
}

/* ---------------------------------------------------------------- wordmark */
/* WORKMEL<T> with the Signal Blue drip hanging off the T stem. Geist renders
   the mark tracked out and medium-weight; the drip is a plain hanging bar
   centred on the T's stem, which reads correctly in Geist and in every
   fallback grotesk — nothing here is metric-tuned to one face. */
.wm-mark {
  font-family: var(--wm-display);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: .18em;
  line-height: 1;
  color: var(--wm-fg);
  display: inline-block;
  position: relative;
  white-space: nowrap;
  max-width: 100%;
}
.wm-mark .t { position: relative; }
.wm-mark .t::after {
  content: ""; position: absolute; left: 38%; transform: translateX(-50%);
  bottom: -.14em; width: .09em; height: .22em;
  background: var(--wm-accent); border-radius: 0 0 .04em .04em;
}

/* ------------------------------------------------------------ scroll gutter */
.wm-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.wm-scroll::-webkit-scrollbar-thumb { background: var(--wm-border); border-radius: 99px; }
.wm-scroll::-webkit-scrollbar-track { background: transparent; }

/* --------------------------------------------------------------- reduced motion */
@media (prefers-reduced-motion: reduce) {
  :root { --wm-t: 1ms linear; --wm-t-slow: 1ms linear; }
}
`;function d({webfont:t=!0}={}){if(typeof document>"u"||(t&&m(),document.getElementById(a)))return;const o=document.createElement("style");o.id=a,o.textContent=c,document.head.prepend(o)}function m(){if(typeof document>"u"||document.getElementById(r))return;const t=document.createElement("link");t.id=r,t.rel="stylesheet",t.media="print",t.href=l,t.addEventListener("load",()=>{t.media="all"}),document.head.appendChild(t)}const w='HIDEVERS<span class="t">E</span>';export{w as W,d as i};
//# sourceMappingURL=brand-CwufGQoz.js.map
