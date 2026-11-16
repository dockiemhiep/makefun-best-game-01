# makefun-best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/dockiemhiep/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/dockiemhiep/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**EMBERGLASS** is an original stained-glass laser-refraction arcade tactics game built from scratch for desktop Chrome with zero external dependencies or network requests. Pilot the Weaver inside the Obsidian Crucible, deploy **Ruby**, **Tourmaline Cyan**, and **Topaz** Prisms around the central **Heart-Lantern**, and shoot Ember Bolts into your Prism web to refract amplified multi-beam laser chains across five escalating Kiln Trials and a three-phase final boss (**Vespera, The Rime Sovereign**).

### Features

- **Geometric Prism-Refraction Combat:** Place and recall stained-glass Prisms (`Right Click` / `E` / `Q`) that split bolts into crimson fans, chain lightning-fast slowing arcs, and detonate solar shockwaves, escalating up to **x12 Resonance Combos**.
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
