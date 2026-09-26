# Phase 2 — Asset acquisition and validation

## Objective

Create the repeatable asset pipeline used by every Hideverse map.

## Phase 2 deliverables

- machine-readable asset manifest
- approved-source registry
- pinned source revisions for GitHub assets
- locally vendored Ravenwood seed assets
- glTF/glb validation
- per-file browser size budget
- CI asset verification
- source/license documentation
- clear split between raw editable assets and web-runtime assets

## Ravenwood starter set

### Nature
Oak tree, detailed tree, pine tree, bush, grass, large rock, small rock, stump, flower and log.

### Furniture
Chair, couch, double bed, long dining table, decorated shelf and standing lamp.

### Base architecture
The OpenGameArt CC0 mansion is tracked as a candidate. It is intentionally not promoted to `acquired` until the complete archive can be inspected.

## Phase 2 exit gate

Phase 2 is complete only when all acquired local models exist, the asset manifest passes, every glTF/GLB validates, runtime files stay inside the budget, formatting passes, and the GitHub CI workflow is green.
