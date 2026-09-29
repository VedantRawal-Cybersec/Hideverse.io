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

Hideverse discards the source materials for these models and merges their
geometry into its existing LOW material batches.

## Poly Haven textures

The LOW refinery uses two optional diffuse maps originally published by Poly
Haven under CC0 1.0:

- Asphalt 03 diffuse, 1K
- Concrete Floor diffuse, 1K

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
