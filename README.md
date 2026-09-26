# Hideverse.io

Hideverse.io is a browser-first multiplayer social-stealth game project.

## Phase 1 foundation

The current foundation intentionally contains only the runtime base needed before map production:

- PlayCanvas renderer/runtime
- TypeScript + Vite build pipeline
- Rapier 3D physics boot and live rigid-body simulation
- Yuka AI entity-manager boot
- responsive desktop/mobile canvas shell
- production static server suitable for Railway
- GitHub Actions verification

## Local development

```bash
npm install
npm run dev:game
```

## Verify

```bash
npm run verify
npm run format:check
```

## Production

```bash
npm run build
npm run start --workspace @hideverse/game
```

The server reads `PORT` when deployed and defaults to `4173` locally.

## Phase boundary

Map assets, characters, multiplayer gameplay, accounts and mode logic are deliberately not part of Phase 1. They will be layered on only after this foundation is stable.
