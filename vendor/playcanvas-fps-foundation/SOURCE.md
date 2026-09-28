# FPS foundation provenance

Upstream: https://github.com/playcanvas/create-playcanvas
Pinned commit: b632e40e7e01df664434b380b64b96f6afc3b326
Template: templates/_shared/first-person-controller
License: MIT
Copyright: PlayCanvas Ltd.

The Hideverse FPS controller tuning and input behavior are derived from the official
PlayCanvas first-person-controller template and engine controller conventions. Hideverse
keeps Rapier for its runtime collision/character movement while matching the official
template's browser-first control semantics, pointer-lock behavior, touch support, jump/sprint
feel and camera conventions.

Referenced upstream files:
- LICENSE
- templates/_shared/first-person-controller/README.md
- templates/_shared/first-person-controller/src/controller.ts
- templates/engine/first-person-controller/src/main.ts

This directory is documentation/provenance only; runtime code lives in apps/game/src/core.
