# Rat Survivors - Development Guide

## Overview
Rat Survivors (`src/rat_survivors.js`) is a Vampire Survivors clone featuring a rat theme. It is built as a modification of the original engine (`src/game.js`).

## Data Structure Patterns

### Weapons
Weapons are defined using the `createWeapon` helper function to keep the file size manageable.
Format:
```javascript
createWeapon(key, name, emoji, description, type, requiredPassive, evolvesTo, iconColor, baseStats, levelUpgrades)
```
- `baseStats`: Object with level 1 stats.
- `levelUpgrades`: Array of objects. `levelUpgrades[0]` is the upgrade for Level 2.
- Stats can be deltas (numeric addition) or overrides (non-numeric or specific fields).

### Characters
Characters are defined in the `CHARACTERS` object.
Key features:
- `initialStats`: Includes extended stats like `curse`, `greed`, `revivals`.
- `accessories`: Array of visual accessories (`{ type: 'hat_wizard', color: '#...' }`) rendered by `Rat.draw`.

### Enemies
Enemies use a single `Enemy` class with a `type` parameter ('bat', 'skeleton', etc.) which determines stats and drawing logic.
Spawn logic is controlled by `SpawnDirector.phases`.

## Build Process
Run `python3 tools/build.py` to generate `rat_survivors.html` (and `ratato.html`).
This script injects `src/styles.css` and the JS file into the HTML template.

## Mechanics
- **Projectile Types:** `projectile-nearest`, `projectile-facing`, `lightning` (instant), `screen-wipe`, `boomerang`, `vertical-zone`.
- **Passives:** Handled via `PASSIVE_ITEMS` apply functions and `Rat` stats.
- **Visuals:** Procedural drawing in `draw()` methods. No external assets.
