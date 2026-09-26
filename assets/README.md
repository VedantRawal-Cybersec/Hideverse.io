# Hideverse Asset Library

Phase 2 establishes a controlled asset-acquisition pipeline.

## Rules

1. Every external asset must exist in `assets/manifest.json`.
2. Commercial-use license must be verified before `status` becomes `acquired`.
3. GitHub sources must be pinned to an immutable commit SHA.
4. Runtime files live under `assets/runtime/` and must stay under the configured file-size budget.
5. Heavy editable/source archives belong under `assets/raw/` and use Git LFS.
6. Collision meshes are authored separately from decorative visual meshes.
7. No runtime asset may depend on a third-party CDN.
8. Phase 3 may optimize acquired assets to GLB/KTX2 after visual QA.

## Current seed

The Ravenwood seed contains CC0 nature models from Kenney and CC0 furniture from KayKit. The OpenGameArt mansion is recorded as a candidate only until the downloaded archive has been inspected.
