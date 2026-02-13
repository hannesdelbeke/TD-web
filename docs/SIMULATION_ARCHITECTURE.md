# Simulation Architecture

## Objective
- Simulate many battles in parallel.
- Visualize one battle at a time.
- Keep code small, modular, and data-driven.
- Support very high alien swarm counts and destructible defenses.

## Model
- `SimulationWorld`
  - Owns all fields.
  - Advances fixed timestep (`tickDelta`, e.g. 1/30).
- `FieldState`
  - One battle dimension.
  - Contains entities, wave state, economy, path data.
- `EntityState`
  - Tower, enemy, projectile, effect.
  - Has compact components (health, position, tags, stats).

## Critical Rule
- All gameplay logic runs in simulation regardless of visibility.
- Renderer reads current state of selected field only.

## Update Pipeline (Per Tick)
1. Spawn/wave updates per field.
2. Movement/pathing.
3. Enemy target acquisition (towers/base).
4. Tower target acquisition.
5. Projectile update / hit resolve.
6. Damage + status effects.
7. Death handling + rewards.
8. Economy/event outputs.

## Field Isolation
- Every entity has `fieldId`.
- Systems always operate within matching `fieldId`.
- No cross-field collision or targeting unless explicitly designed.

## Rendering Bridge
- `Visualizer` selects active `fieldId`.
- Maps sim entities to lightweight view proxies.
- Creates/updates/destroys proxies only for active field.
- Switching field does not alter simulation state.

## Data Modules
- `MapDef` (grid, path, rules)
- `EnemyDef` (stats, behaviors, rewards)
- `TowerDef` (cost, fire model, upgrade tree)
- `ProjectileDef` (speed, behavior, effects)
- `WaveDef` (spawn schedule)
- `DimensionDef` (modifiers/theme)
- `BaseDef` (base HP, fail conditions, defense modifiers)

## Minimal Code Strategy
- Favor tables/config over branches.
- Reuse same damage/status/death pipeline for all entities.
- Keep systems pure and short.
- Avoid exception-heavy special cases; encode variants as data.

## Performance Targets (Browser)
- 20 active fields simulated.
- 1 field rendered.
- Fixed timestep with accumulator.
- Soft cap entity counts per field (configurable).
- Object pooling for view proxies and projectile visuals.
- Thousands of enemies in aggregate across active fields.

## GitHub Pages Constraints
- Static deploy only.
- Keep bundle lean.
- Prefer JSON content over large hardcoded files.
- No server dependency for core gameplay.

## Milestones
1. Single-field full loop in simulation-only model.
2. Add visualizer bridge.
3. Add base HP + lose condition.
4. Add enemy attacks on towers and base.
5. Add multi-field simulation manager.
6. Switchable active field UI.
7. Portal-themed content + transitions.
8. Balance + profiling for 20-field and swarm target.
