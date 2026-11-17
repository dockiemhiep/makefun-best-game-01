# EMBERGLASS phase 4 — judge-visible repackaging

Parent commit: `d0dacb7`. No mechanic, balance, or content change; no new dependency; still fully offline.
This file is part of the phase-4 commit, so it cannot contain its own SHA. Get it with
`git log -1 --format=%H -- PHASE4-NOTES.md`.

## Real content numbers (counted from code)

| What | Count | Source |
| --- | --- | --- |
| Trials | 5 | `TRIAL_WAVES` in `game/src/config.js` (4 wave trials + 1 boss trial) |
| Boss phases | 3 | Vespera, `game/src/enemies.js` (phase 2 at 66% HP, phase 3 at 34% HP) |
| Distinct relics | 10 | `TEMPERING_CATALOG` in `game/src/temperings.js` (a full run forges 4 of them, one after each of trials 1–4) |
| Foe types | 6 | `ENEMY_SPECS` in `game/src/config.js` (boss, pylons and boss lances not counted) |
| Prism types | 3 | `PRISM_SPECS` (ruby, cyan, topaz) |
| Difficulty modes | 3 | Apprentice, Artisan, Masterwork |

Numbers safe to use in the submission title: **5 trials, 3-phase boss, 10 relics, 6 foe types, 3 prism types, 3 difficulties.**
The in-game labels read the trial, relic and foe counts from those arrays; "3-phase" is a literal.

## Screenshots

All 1280×720 JPEG, seed `20261116`, Apprentice, captured by `scripts/playtest.mjs --capture` from the tested bot run.

| Before | After | What the new frame is |
| --- | --- | --- |
| `1-title.jpg` — cover | `1-title.jpg` — cover | Same cover. Second pitch line now reads "5 trials · 10 relics · 6 foe types · a 3-phase boss." |
| `2-boss.jpg` — phase 2, pylon callouts | `2-gameplay.jpg` | Trial 4 mid-fight: closed 3-prism beam chain, ruby fan hitting foes, 4 foes on the field, score 49,725, 3.75x streak |
| `3-trials.jpg` — upgrade draft (menu) | `3-boss.jpg` | Vespera phase 3/3, guard down, beams and her lance crossing the arena, no floating callout text |
| `4-victory.jpg` — "RUN TIME 00:22" (menu) | `4-scale.jpg` | Trial map: 4 of 5 cleared with best scores, boss node "05 VESPERA · 3-PHASE BOSS" lit as next, scope chips |

The sheet went from 1 gameplay frame and 3 menus to 2 gameplay frames, the cover, and 1 menu.

Slot 4 choice: the trial map, not the upgrade draft. On a contact sheet (cover large, three 320×180 tiles) the map is the
only frame that shows the whole campaign; the draft shows one choice. The 4-of-5 state was chosen over 5-of-5 because
the lit boss node reads better than five identical cleared cards.

Capture points are state conditions, not frame numbers: the first trial-4 bot tick with 3 prisms, at least 4 foes and
at least 15 live beams; the first phase-3 boss tick with the phase guard at 0; the map straight after the fourth relic pick.
Two consecutive captures gave byte-identical `2-gameplay.jpg`, `3-boss.jpg` and `4-scale.jpg`. `1-title.jpg` differs by a
few bytes between runs, as before.

## Victory card now

- Headline row: **Trials Cleared 5 / 5** · **Final Score 87,569** (largest) · **Relics Forged 4**.
- Second row: Peak Multiplier 3.75x · Foes Shattered 146 · Beams Refracted 290.
- Relic names, then the buttons.
- The timer is one 12 px line under the buttons: "Combat clock 00:22". It is no longer a stat tile.
- The defeat card uses the same layout.

The victory frame is not one of the four submission shots. The playtest still reaches it through the full run, asserts
the headline row, asserts no time appears in the stat tiles, and saves `victory.png` to the evidence directory.

## Other changes

- Trial select: the subtitle is replaced by four scope chips (5 TRIALS · 3-PHASE BOSS · 10 RELICS · 6 FOE TYPES); the
  unlock hint moved to the footer line; the boss node has larger type and a pink glow.
- Favicon: the ~600-character `data:` URI in `game/index.html` is now `game/favicon.svg` (276 bytes, same icon).
  `index.html` went from 912 to 622 bytes and the dossier outline no longer contains the URI.

## Files touched beyond the listed scope, and why

- `scripts/playtest.mjs` — the capture points live here; also asserts the new labels.
- `scripts/verify-output.mjs` — hardcodes the four screenshot names.
- `game/styles.css` — styles for the victory headline row, scope chips and boss node.
- `game/favicon.svg` — the new icon file.

Not touched: `README.md`. Its phase-3 paragraph still describes the old screenshot set.

## Gates

- `node --test tests/game-systems.test.mjs`: 11 of 11 pass.
- `scripts/playtest.mjs --capture`: exit 0; 0 console/page errors, 0 failed requests, 0 external requests; title → 5 trials
  → boss phases 1, 2, 3 → victory → restart, plus the defeat path.
- `main.ts` + `scripts/verify-output.mjs`: pass; 18 game files; all references local.
- `git diff --check`: clean.

## Open points for the debate

- An independent tile-size review rated the map tile 4/5, gameplay 3/5 and boss 2/5: at 320×180 the two arena frames look
  alike, and only the "VESPERA · PHASE 3/3" bar marks the boss. Vespera is drawn about the size of a prism and the arena
  renderer was out of scope. Swapping the boss tile for the upgrade draft is the alternative.
- The cover shows "BEST 0" (fresh save). Left alone because the title was only to be touched for the pitch line.
