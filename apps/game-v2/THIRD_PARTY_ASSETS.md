# Third-party LOW graphics assets

This file documents optional third-party resources used by Hideverse Game V2's
LOW refinery presentation.

## Kenney Factory Kit / City Kit (Industrial)

- Author: Kenney
- License: Creative Commons Zero (CC0 1.0)
- Official sources:
  - https://kenney.nl/assets/factory-kit
  - https://kenney.nl/assets/city-kit-industrial
- Runtime mirror used for the curated GLB subset:
  - https://github.com/shorepine/kenney
- Purpose:
  - factory cone
  - machine housing
  - catwalk segment
  - large pipe valve
  - storage tank
  - refinery chimney
  - industrial building shell
  - catwalk stairs
  - personnel/factory door
  - windowed machine module
  - straight and bent process-pipe modules
  - conveyor/service-rack segment
  - second industrial building shell
  - large chimney
  - Trey Ramm CC0 modular-industrial loading bay
  - Trey Ramm CC0 elevated walkway

Hideverse discards the source materials for these models and merges their
geometry into its existing LOW material batches.

### Trey Ramm Modular Industrial Pieces

- Creator: Trey Ramm / OpenGameArt user `minime453`
- License: CC0 1.0 Universal
- Official source: https://opengameart.org/content/modular-industrial-kit
- Runtime GLB mirror / deterministic conversions:
  https://github.com/AetherRadar/operation-steel-tide/tree/main/assets/models/trey_modular_industrial
- Current LOW use:
  - `loading-bay.glb` — 2,384 triangles
  - `elevated-walkway.glb` — geometry-only skyline/service structure

Source texture dependencies are redirected to a 1×1 white image at load time
because Hideverse uses only the authored geometry; the final surfaces come from
Hideverse's existing LOW material batches.

## Poly Haven textures

The LOW refinery uses four optional diffuse maps originally published by Poly
Haven under CC0 1.0:

- Asphalt 03 diffuse, 1K
- Concrete Floor diffuse, 1K
- Rusty Painted Metal diffuse, 1K
- Corrugated Iron diffuse, 1K

Runtime mirror:
https://github.com/AetherRadar/operation-steel-tide/tree/main/assets/textures

The mirror's assets/textures/LICENSE.md records the Poly Haven source and CC0
license for these files.

Only diffuse maps are used in LOW. Normal, roughness, displacement, HDR and
other heavier maps are intentionally omitted to preserve browser performance.

## Failure behaviour

All network-loaded assets are optional. Hideverse retains its procedural
geometry/material fallback if a CDN or source repository is unavailable, so
third-party availability cannot prevent the game from starting.
