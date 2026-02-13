# Portal Vision

## End Goal
- The game is a portal-based tower defense.
- Each portal opens into a different dimension (a separate battle field).
- Many dimensions are simulated at the same time.
- The player can only view one dimension at a time, but all dimensions continue running.
- Theme: alien bug swarms invading connected planets (Zerg / Starship Troopers tone).

## Core Loop
- Choose a dimension.
- Place/upgrade/sell towers in that dimension.
- Switch to another dimension.
- Return later and see that battle progressed while off-screen.
- Defend each planetary base from direct assault.

## Player Strategy Impact
- Time and attention become resources.
- A stable dimension can be left unattended.
- Critical dimensions need intervention (new builds, upgrades, ability use).
- Long-term success depends on planning for parallel pressure, not one map at a time.
- You lose if any critical base reaches 0 HP (configurable mode: per-base or global command base).

## Design Principles
- Simulation is authoritative.
- Rendering is just a window into one selected dimension.
- No paused-offscreen logic hacks.
- Same rules for all dimensions.
- Data-driven content so adding dimensions/maps/enemies is mostly config.

## Satisfaction Opportunities
- Portal transitions between dimensions with strong VFX/SFX.
- Distinct visual language per dimension (palette, particles, ambient sound).
- "Off-screen report" feedback when switching back:
  - Gold earned while away.
  - Leaks/damage while away.
  - Key kills or events.
- Time-lapse replay snippet when entering a dimension.

## Technical Non-Negotiables
- Deterministic-ish tick simulation per dimension.
- Dimension state isolated by `fieldId`.
- One simulation code path for all dimensions.
- Visualizer can attach to any `fieldId` instantly.
- Scales to at least 20 active dimensions on browser target hardware.
- Supports large swarm counts (thousands across all active dimensions).
- Enemies can damage both base and towers; tower destruction is part of the core loop.
