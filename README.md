# TD-web

A tower defense game in your browser: https://hannesdelbeke.github.io/TD-web/  

Made with Codex, no manual coding.
<img width="1217" height="505" alt="image" src="https://github.com/user-attachments/assets/28051e3a-8a69-4792-985c-3d44da48a380" />


## Docs
- `docs/PORTAL_VISION.md` - end-state design for multi-dimension portal battles.
- `docs/SIMULATION_ARCHITECTURE.md` - high-level simulation model for 20 parallel fields, 1 visualized field.

## Core Features
- Grid-based map with buildable and blocked tiles.
- Enemy path from spawn to base.
- Multiple waves with configurable pacing.
- Gold economy for tower purchase/upgrade/sell.
- Base health (leaks reduce HP).
- Base can be directly attacked by enemies.
- Win condition (all waves cleared).
- Lose condition (base HP reaches 0).
- Game speed controls (1x/2x/4x).
- Pause and restart.

## Tower Features
- Multiple tower classes (single-target, AoE, slow, support, DOT, sniper).
- Multiple tiers per tower (upgrade paths).
- Tower targeting modes (first, last, nearest, strongest, weakest).
- Tower range visualization on select.
- Cooldown/fire rate stats.
- Sell with configurable refund.
- Placement validation (occupied, blocked, out-of-bounds, no-path-break).

## Enemy Features
- Alien bug-swarm fantasy (Zerg / Starship Troopers style).
- Multiple enemy archetypes (basic, fast, tank, armored, flying, boss).
- Enemy resistances and vulnerabilities.
- Enemy special traits (shield, regen, split, stealth).
- Status effects support (slow, burn, poison, stun, weaken).
- Enemy spawn modifiers by wave.
- Swarm scale support (thousands of enemies in aggregate simulation).

## Projectile / Combat Features
- Multiple projectile types (hitscan, ballistic, piercing, chain, AoE).
- Projectile lifetime/speed/homing support.
- Collision and damage falloff rules.
- Crits and damage modifiers.
- Clean damage pipeline (on-hit effects + status application).
- Enemies can attack and destroy towers.
- Base and towers both use health/destruction pipeline.

## Map / Content Features
- Multiple maps with unique paths and build zones.
- Tile metadata (path, buildable, obstacle, spawn, goal).
- Map-specific rules/modifiers.
- Difficulty presets per map.
- Portal-linked planet dimensions with distinct terrain and enemy pressure.

## UX / QoL Features
- Drag-place or click-place towers.
- Hotkeys for tower shortcuts.
- Tooltip and stat panel clarity.
- Build preview ghost with valid/invalid feedback.
- Clear wave preview (types/counts).
- Session summary screen (time, leaks, MVP tower).

## Satisfying Feel (VFX/SFX/Animation)
- Punchy tower muzzle flashes.
- Distinct projectile trails.
- Hit sparks + impact decals.
- Enemy death bursts (small/medium/boss variants).
- Tower placement pop + scale animation.
- Upgrade glow + quick morph animation.
- Gold gain flytext and subtle coin SFX.
- Screen shake on heavy hits/boss death.
- Layered SFX mix (fire, impact, death, UI).
- Responsive UI sounds (hover/click/confirm/error).
- Staggered spawn gate animation at wave start.

## Modular Architecture (Low-Code Friendly)
- Data-driven configs for towers/enemies/projectiles/maps/waves.
- Keep rules in small pure systems, not monolithic classes.
- Composition over inheritance (small reusable components).
- Shared stat/effect pipeline for all entities.
- Minimal engine-specific code in game logic core.
- One simulation state format reused by all maps.
- Visual layer reads simulation state; simulation stays renderer-agnostic.
- Avoid special-case branching; prefer table-driven behavior.

## Browser Runtime Plan (GitHub Pages)
- Engine: Phaser + TypeScript (lightweight, web-native, fast iteration).
- Build tool: Vite.
- Data: JSON for all content definitions.
- Rendering: single 2D canvas; one active visualized field.
- Simulation: support N fields in memory (e.g., 20), render one selected field.
- Save: localStorage for settings/unlocks.
- Deploy: static files to `gh-pages` branch.

## High-Level Implementation Plan
1. Bootstrap project: Vite + TS + Phaser, lint/format, CI build.
2. Define schemas: `TowerDef`, `EnemyDef`, `ProjectileDef`, `WaveDef`, `MapDef`.
3. Build simulation core: field state, pathing, wave spawn, combat tick, rewards.
4. Add placement + economy loop: build/upgrade/sell + validation.
5. Add visual layer: sprites, projectiles, health bars, HUD.
6. Add content pack v1: 3 towers, 3 enemies, 2 maps.
7. Add feel pass: VFX/SFX/placement/upgrade animations.
8. Add multi-field simulation manager: run 20 fields, render 1.
9. Add balancing tools: tweak JSON values and hot-reload configs.
10. Ship MVP to GitHub Pages; iterate with telemetry and playtest feedback.

## GitHub Pages Deployment
- Use `npm run build` to output static files.
- Publish `dist/` via GitHub Actions to Pages.
- Keep base path configurable for repo name.
- Cache-bust assets with hashed filenames.

## MVP Playability Checklist
- Open URL and start game in < 5 seconds.
- Place tower, kill enemies, earn gold.
- Complete at least one full wave cycle.
- Win/lose states working.
- No blocking errors in browser console.

## Guiding Constraints
- Less code over clever code.
- Prefer reusable systems over exceptions.
- Keep data declarative and behavior composable.
- Ship playable early; expand content after loop is solid.
