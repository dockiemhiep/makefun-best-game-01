import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldState, startNewRun, stepWorldSimulation, chooseTemperingUpgrade, continueTrialProgression, bufferCombatActions } from '../game/src/world.js';
import { createEffectsSystem } from '../game/src/effects.js';
import { deployPrismNode, triggerKilnSupernova } from '../game/src/prisms.js';
import { damageTarget, spawnBossVespera } from '../game/src/enemies.js';
import { loadProgressionAndSettings, recordTrialResult, isTrialUnlocked, restartCurrentTrial } from '../game/src/progression.js';
import { TEMPERING_CATALOG } from '../game/src/temperings.js';
import { computeComboMultiplier, formatComboMultiplier } from '../game/src/config.js';
import { scaleEnemyForTrial } from '../game/src/difficulty.js';

const audio = new Proxy({}, { get: () => () => {} });
const idle = () => ({ move: { dx: 0, dy: 0 }, aimX: 640, aimY: 240, prismSelect: null, cyclePrism: 0 });
function run() {
  const world = createWorldState(20261116);
  const effects = createEffectsSystem(world.rng);
  startNewRun(world, 'artisan', 20261116, effects);
  return { world, effects };
}
function clearFixture(world, effects) {
  // A cleared combat boundary; the simulation must award its bonus and request a draft.
  world.spawnQueue = []; world.enemies = [];
  stepWorldSimulation(world, idle(), 1 / 60, audio, effects);
}

// Public state transitions and player-visible outcomes, not private implementation calls.
test('trial clear records a local score, unlocks only the next trial, and survives reload', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k), setItem: (k,v) => store.set(k,v) };
  const save = loadProgressionAndSettings();
  const { world, effects } = run();
  world.score = 1200;
  clearFixture(world, effects);
  recordTrialResult(save, world, true);
  const loaded = loadProgressionAndSettings();
  assert.equal(loaded.trials.artisan[0].bestScore, 1800);
  assert.equal(loaded.trials.artisan[0].cleared, true);
  assert.equal(isTrialUnlocked(loaded, 'artisan', 2), true);
  assert.equal(isTrialUnlocked(loaded, 'artisan', 3), false);
  assert.equal(isTrialUnlocked(loaded, 'apprentice', 2), false);
  world.score = 1000;
  recordTrialResult(loaded, world, false);
  assert.equal(loaded.trials.artisan[0].bestScore, 1800);
  assert.equal(loaded.trials.artisan[0].cleared, true);
});

test('a loss can set a trial best without unlocking the next trial', () => {
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  const save = loadProgressionAndSettings(); const { world } = run();
  world.trialIndex = 2; world.trialStartScore = 5000; world.score = 5800;
  recordTrialResult(save, world, false);
  assert.equal(save.trials.artisan[1].bestScore, 800);
  assert.equal(isTrialUnlocked(save, 'artisan', 3), false);
});

test('each offered upgrade changes a real modifier or health, then waits on the trial map', () => {
  for (const spec of TEMPERING_CATALOG) {
    const { world, effects } = run(); clearFixture(world, effects);
    world.draftChoices = [spec]; world.player.hp = 3; world.lanternHp = 60;
    const before = JSON.stringify([world.mods, world.player.hp, world.player.maxHp, world.lanternHp]);
    assert.equal(chooseTemperingUpgrade(world, spec.id, audio, effects), true);
    assert.notEqual(JSON.stringify([world.mods, world.player.hp, world.player.maxHp, world.lanternHp]), before, spec.id);
    assert.equal(world.mode, 'trials'); assert.equal(world.trialIndex, 1); assert.equal(world.pendingTrial, 2);
    assert.equal(continueTrialProgression(world, effects), true);
    assert.equal(world.trialIndex, 2); assert.equal(world.mode, 'playing');
    assert.deepEqual(world.temperingIds, [spec.id]);
    assert.equal(chooseTemperingUpgrade(world, spec.id, audio, effects), false);
  }
});

test('draft rejects an unoffered relic without changing the run', () => {
  const { world, effects } = run(); clearFixture(world, effects);
  world.draftChoices = [TEMPERING_CATALOG[0]];
  assert.equal(chooseTemperingUpgrade(world, 'obsidian_edge', audio, effects), false);
  assert.deepEqual(world.temperingIds, []); assert.equal(world.mode, 'tempering');
});

test('restart current trial restores entry score, health, relics, enemies and RNG without farming score', () => {
  const { world, effects } = run(); clearFixture(world, effects);
  world.draftChoices = [TEMPERING_CATALOG.find(t => t.id === 'crystalline_ward')];
  chooseTemperingUpgrade(world, 'crystalline_ward', audio, effects);
  continueTrialProgression(world, effects);
  const entry = structuredClone({ score: world.score, hp: world.player.hp, maxHp: world.player.maxHp, prisms: world.prisms, enemies: world.enemies, mods: world.mods, stats: world.stats });
  const rngNext = world.rng.next();
  world.score += 2000; world.player.hp = 1; world.prisms = []; world.enemies = []; world.stats.enemiesShattered += 12; world.mode = 'paused';
  assert.equal(restartCurrentTrial(world, effects), true);
  assert.equal(world.mode, 'playing'); assert.equal(world.trialIndex, 2);
  assert.deepEqual({ score: world.score, hp: world.player.hp, maxHp: world.player.maxHp, prisms: world.prisms, enemies: world.enemies, mods: world.mods, stats: world.stats }, entry);
  assert.equal(world.rng.next(), rngNext);
  assert.deepEqual(world.temperingIds, ['crystalline_ward']);
});

test('difficulty and trial scaling preserve the expected health and speed', () => {
  const spec = { hp: 100, speed: 100 };
  assert.deepEqual(scaleEnemyForTrial(spec, 'artisan', 1), { maxHp: 100, speed: 100 });
  assert.deepEqual(scaleEnemyForTrial(spec, 'artisan', 5), { maxHp: 156, speed: 100 });
  assert.deepEqual(scaleEnemyForTrial(spec, 'masterwork', 5), { maxHp: 193, speed: 113.99999999999999 });
});

test('Phase 2: deploy and dash survive hit-stop and execute on the first accepting tick', () => {
  const { world, effects } = run();
  effects.triggerHitStop(.05);
  const action = { ...idle(), deployPrism: true, deployAimX: 780, deployAimY: 366, dash: true };
  bufferCombatActions(world, action);
  stepWorldSimulation(world, action, 1 / 60, audio, effects);
  assert.equal(world.prisms.length, 1);
  for (let i = 0; i < 6; i++) stepWorldSimulation(world, idle(), 1 / 60, audio, effects);
  assert.equal(world.prisms.length, 2);
  assert.ok(world.player.dashCooldown > 0);
});

for (const charges of [0, 3]) test(`Phase 2: overlap replacement removes exactly one Prism at ${charges} charges`, () => {
  const { world, effects } = run();
  deployPrismNode(world, 780, 366, audio, effects); deployPrismNode(world, 500, 366, audio, effects);
  assert.equal(world.prisms.length, 3); world.prismCharges = charges;
  deployPrismNode(world, 780, 366, audio, effects);
  assert.equal(world.prisms.length, 3);
  assert.equal(world.prisms.filter(p => p.x === 500 && p.y === 366).length, 1);
  assert.equal(world.prisms.filter(p => p.x === 780 && p.y === 366).length, 1);
});

test('Phase 2: overwhelming burst damage cannot skip any boss phase or bypass fresh pylons', () => {
  const { world, effects } = run(); world.trialIndex = 5; world.enemies = []; spawnBossVespera(world);
  const boss = world.boss;
  damageTarget(world, boss, 1e9, 0, { ignoreArmor: true }, audio, effects);
  assert.equal(boss.phase, 2); assert.ok(boss.hp > 0); assert.equal(world.pylons.length, 3);
  world.novaCharge = 100; triggerKilnSupernova(world, audio, effects);
  assert.ok(world.pylons.every(p => p.hp > 0)); assert.equal(boss.phase, 2);
  for (const p of [...world.pylons]) { p.spawnGuardTimer = 0; damageTarget(world, p, 1e9, 0, { ignoreArmor: true }, audio, effects); }
  boss.phaseGuardTimer = 0;
  damageTarget(world, boss, 1e9, 0, { ignoreArmor: true }, audio, effects);
  assert.equal(boss.phase, 3); assert.ok(boss.hp > 0);
  damageTarget(world, boss, 1e9, 0, { ignoreArmor: true }, audio, effects);
  assert.ok(world.boss); boss.phaseGuardTimer = 0;
  damageTarget(world, boss, 1e9, 0, { ignoreArmor: true }, audio, effects);
  assert.equal(world.boss, null); assert.deepEqual(world.stats.bossPhasesSeen, [1,2,3]);
});

test('Phase 2: HUD and scored multiplier agree at low, mid and capped streaks', () => {
  for (const [combo, expected] of [[1,1],[6,2.25],[12,3.75],[20,3.75]]) {
    assert.equal(computeComboMultiplier(combo), expected);
    assert.equal(formatComboMultiplier(combo), `${expected.toFixed(2)}x`);
  }
});
