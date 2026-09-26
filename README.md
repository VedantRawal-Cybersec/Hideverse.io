# Hideverse.io

Hideverse.io is a browser-first multiplayer social-stealth game project.

## Live development contract

The main website is the canonical public development surface. Every verified game, map, asset and feature change is integrated into the repository and deployed from `main`.

- `/` — live Hideverse website and development status
- `/game/` — current playable browser build
- live asset counts are generated from `assets/manifest.json`

## Current foundation

- PlayCanvas renderer/runtime
- TypeScript + Vite
- Rapier 3D physics
- Yuka AI bootstrap
- verified CC0 asset registry and glTF validation
- GitHub Actions verification
- Railway-ready production website

## Development

```bash
npm install
npm run dev:game
npm run dev:web
```

## Verify

```bash
npm run assets:verify
npm run verify
npm run format:check
```

## Production

```bash
npm run build:live
npm run start --workspace @hideverse/web
```

The production server reads Railway's `PORT` automatically.
