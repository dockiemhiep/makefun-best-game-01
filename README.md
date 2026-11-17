# makefun-best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/dockiemhiep/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/dockiemhiep/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**EMBERGLASS** is an original stained-glass laser-refraction arcade tactics game built from scratch for desktop Chrome with zero external dependencies or network requests. Pilot the Weaver inside the Obsidian Crucible, deploy **Ruby**, **Tourmaline Cyan**, and **Topaz** Prisms around the central **Heart-Lantern**, and shoot Ember Bolts into your Prism web to refract amplified multi-beam laser chains across five escalating Kiln Trials, ending in a three-phase final boss (**Vespera, The Rime Sovereign**).

### Features

- **Geometric Prism-Refraction Combat:** Place and recall stained-glass Prisms (`Right Click` / `E` / `Q`) that split bolts into crimson fans, chain lightning-fast slowing arcs, and detonate solar shockwaves, escalating up to **3.75x Resonance Multipliers** across 12-hit streaks.
- **Tactical Enemy Variety & 3-Phase Boss:** Angle beams behind front-shielded **Slag Bulwarks** for Flank Shatters, intercept Prism-draining **Siphon Moths**, vaporize **Rime Caster** frost orbs, and shatter **Cryo Pylons** during Vespera's three-phase boss encounter.
- **Forged Tempering Relics & Kiln Supernova:** Draft 1 of 3 permanent relic upgrades after each cleared Trial and unleash **Kiln Supernova (`F`)** at 100% Resonance to link every Prism into an arena-wide star polygon.
- **100% Self-Contained Static Web App:** Fixed 60 Hz deterministic simulation, layered 2D Canvas visuals, procedural Dorian glass-harp WebAudio synthesizer and generative score, three difficulty modes, and saved high scores/stars under `game/`.

## Run it

```sh
node serve.ts
# Open http://localhost:8080 in desktop Chrome

# Stage /output and generate dossier.json locally:
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=r027wqk6&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

## Phase 3: progression and menus

- **Trial Select** shows all five trials, the final boss, locked and cleared states, and best trial scores saved separately for each difficulty. Open it from the title or results; every between-trial relic pick also returns to this map. An unlocked trial can be replayed as a fresh run from that point.
- **Choose Your Upgrade** offers three real relics after each of Trials 1–4. Pick with the mouse or `1` / `2` / `3`; the selected power carries into every remaining trial. The route strip shows the cleared trials and the next destination.
- **Pause / Settings** (`Esc` / `P`) freezes combat, adjusts the procedural soundtrack and effects volume, and mutes or unmutes instantly. `Restart Trial` / `R` restores that trial's entry score, health, relics and formation. Volume and mute persist across reloads.

The submission screenshots are direct 1280×720 Chrome captures: title cover, an active phase-two boss fight with HUD, the three-way upgrade draft, and victory with score and restart. `shots.json` records the seed and scenes. Nothing is fetched outside `game/`.

## Verification

```sh
# No dependencies or build step are needed to play, package, or run the system tests.
node --test tests/game-systems.test.mjs

# Browser QA uses a separately installed Playwright and desktop Chrome.
node serve.ts --port 8093
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/playtest.mjs
# Add --capture to regenerate the four screenshots from that same tested run.

# Package to a new temporary output directory, then check its complete tree and dossier.
entry_output=$(mktemp -d)
MAKEFUN_OUTPUT_DIR="$entry_output" node main.ts
node scripts/verify-output.mjs "$entry_output"
git diff --check
```

`playtest.mjs` exercises the live animation loop and WebAudio settings, then uses real keyboard/mouse events with the game's existing fixed-step hook to accelerate a complete seeded campaign. It asserts all five clears, four upgrades, all three boss phases, score-preserving trial restart, persistent unlocks, natural enemy-damage defeat, and restart. It fails on any console/page error, failed request, or external request. `VISUAL_AUDIT=1` additionally runs layout probes and axe on every menu at 1440×900 and 390×844 under both color-scheme preferences; supply `LAYOUT_PROBE` and `AXE_SCRIPT` paths. The game retains its single obsidian theme.
