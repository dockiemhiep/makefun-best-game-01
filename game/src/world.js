// Core Crucible world state, fixed-step simulation, Trial spawner, Weaver physics, and run scoring.

import { ARENA, DIFFICULTY_MODES, PRISM_ORDER, PRISM_SPECS, TRIAL_WAVES } from './config.js';
import { createSeededRng } from './rng.js';
import { computeTemperingModifiers, rollTemperingChoices, TEMPERING_CATALOG } from './temperings.js';
import { deployPrismNode, recallNearestPrism, refractThroughPrismChain, triggerKilnSupernova } from './prisms.js';
import { damageTarget, spawnBossVespera, spawnWaveEnemy, updateEnemiesAndBoss } from './enemies.js';

export function createWorldState(initialSeed = 20261116) {
  const rng = createSeededRng(initialSeed);
  const world = {
    seed: initialSeed,
    rng,
    entitySeq: 0,
    mode: 'title', // 'title' | 'playing' | 'tempering' | 'paused' | 'victory' | 'gameover'
    difficulty: 'artisan',
    time: 0,
    runTime: 0,
    score: 0,
    combo: 1,
    comboTimer: 0,
    trialIndex: 1,
    trialBannerTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    totalTrialEnemies: 0,
    spawnedTrialEnemies: 0,

    lanternHp: 100,
    lanternMaxHp: 100,
    lanternHitFlash: 0,

    player: {
      x: ARENA.centerX,
      y: ARENA.centerY + 112,
      vx: 0,
      vy: 0,
      radius: 14,
      angle: -Math.PI / 2,
      hp: 5,
      maxHp: 5,
      fireCooldown: 0,
      shotCount: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashDirX: 0,
      dashDirY: -1,
      invulnTimer: 0,
    },

    selectedPrismIndex: 0,
    autoCyclePrisms: true,
    prismCharges: 3,
    maxPrismCharges: 3,
    novaCharge: 25,

    temperingIds: [],
    mods: computeTemperingModifiers([]),
    draftChoices: [],

    prisms: [],
    bolts: [],
    enemies: [],
    pylons: [],
    boss: null,
    enemyProjectiles: [],
    shards: [],

    defeatReason: '',
    isNewBest: false,
    stats: {
      enemiesShattered: 0,
      beamsRefracted: 0,
      shardsCollected: 0,
      maxCombo: 1,
      supernovasCast: 0,
      trialsCleared: 0,
    },
  };

  setupTitleAttractScene(world);
  return world;
}

export function setupTitleAttractScene(world) {
  world.prisms.length = 0;
  world.bolts.length = 0;
  world.enemies.length = 0;
  world.pylons.length = 0;
  world.enemyProjectiles.length = 0;
  world.shards.length = 0;
  world.boss = null;

  for (let i = 0; i < 6; i++) {
    const kind = PRISM_ORDER[i % 3];
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6;
    const dist = 252;
    const spec = PRISM_SPECS[kind];
    world.prisms.push({
      id: ++world.entitySeq,
      kind,
      x: ARENA.centerX + Math.cos(angle) * dist,
      y: ARENA.centerY + Math.sin(angle) * dist,
      radius: 19,
      durability: spec.maxDurability,
      maxDurability: spec.maxDurability,
      refractCount: 0,
      pulse: 0.6,
      rot: angle,
      drainedBy: 0,
    });
  }
  world.player.x = ARENA.centerX - 96;
  world.player.y = ARENA.centerY - 228;
  world.player.angle = 0.4;
}

export function beginTrialWave(world, trialNumber, effects) {
  world.trialIndex = trialNumber;
  world.trialBannerTimer = 2.8;
  const waveDef = TRIAL_WAVES[trialNumber - 1];
  world.spawnQueue.length = 0;

  if (waveDef.isBossTrial) {
    spawnBossVespera(world);
    for (let i = 0; i < (waveDef.openingBurst || 2); i++) {
      spawnWaveEnemy(world, i % 2 === 0 ? 'skitterer' : 'siphon', (i * Math.PI * 2) / 3 + 0.4);
    }
    world.totalTrialEnemies = 1;
    world.spawnedTrialEnemies = 1;
    effects.addCallout(ARENA.centerX, ARENA.centerY - 82, `TRIAL 5 · ${waveDef.title.toUpperCase()}`, '#ff8fab', 1.18);
    return;
  }

  const list = [];
  for (const entry of waveDef.budget) {
    for (let i = 0; i < entry.count; i++) {
      list.push(entry.kind);
    }
  }
  world.spawnQueue = world.rng.shuffle(list);
  world.totalTrialEnemies = world.spawnQueue.length;
  world.spawnedTrialEnemies = 0;

  // Spawn opening formation evenly spaced around the Crucible rim
  const burst = Math.min(waveDef.openingBurst || 4, world.spawnQueue.length);
  const baseAngle = world.rng.range(0, Math.PI * 2);
  for (let i = 0; i < burst; i++) {
    const kind = world.spawnQueue.pop();
    spawnWaveEnemy(world, kind, baseAngle + (i * Math.PI * 2) / burst);
    world.spawnedTrialEnemies += 1;
  }
  world.spawnTimer = waveDef.spawnInterval * 0.85;

  effects.addCallout(
    ARENA.centerX,
    ARENA.centerY - 82,
    `TRIAL ${trialNumber} · ${waveDef.title.toUpperCase()}`,
    '#ffe184',
    1.16,
  );
}

export function startNewRun(world, difficultyId, seed, effects) {
  const cleanSeed = (Number(seed) >>> 0) || ((Date.now() ^ 0x5f3759df) >>> 0);
  world.seed = cleanSeed;
  world.rng = createSeededRng(cleanSeed);
  world.difficulty = DIFFICULTY_MODES[difficultyId] ? difficultyId : 'artisan';
  const diff = DIFFICULTY_MODES[world.difficulty];

  effects.clearAll();

  world.mode = 'playing';
  world.runTime = 0;
  world.score = 0;
  world.combo = 1;
  world.comboTimer = 0;
  world.defeatReason = '';
  world.isNewBest = false;

  world.temperingIds = [];
  world.mods = computeTemperingModifiers([]);
  world.draftChoices = [];

  world.lanternMaxHp = diff.lanternMaxHp;
  world.lanternHp = diff.lanternMaxHp;
  world.lanternHitFlash = 0;

  world.player.x = ARENA.centerX;
  world.player.y = ARENA.centerY + 108;
  world.player.vx = 0;
  world.player.vy = 0;
  world.player.hp = diff.playerMaxHp;
  world.player.maxHp = diff.playerMaxHp;
  world.player.fireCooldown = 0;
  world.player.shotCount = 0;
  world.player.dashTimer = 0;
  world.player.dashCooldown = 0;
  world.player.invulnTimer = 0.6;

  world.selectedPrismIndex = 0;
  world.autoCyclePrisms = true;
  world.maxPrismCharges = 3;
  world.prismCharges = 3;
  world.novaCharge = 30;

  world.prisms.length = 0;
  world.bolts.length = 0;
  world.enemies.length = 0;
  world.pylons.length = 0;
  world.boss = null;
  world.enemyProjectiles.length = 0;
  world.shards.length = 0;

  world.stats = {
    enemiesShattered: 0,
    beamsRefracted: 0,
    shardsCollected: 0,
    maxCombo: 1,
    supernovasCast: 0,
    trialsCleared: 0,
  };

  // Gift one opening Topaz Prism north of the Heart-Lantern so refraction works from shot #1!
  deployPrismNode(world, ARENA.centerX, ARENA.centerY - 126, { playPrismDeploy() {} }, effects);
  world.prismCharges = 3;

  beginTrialWave(world, 1, effects);
}

export function chooseTemperingUpgrade(world, temperingId, audio, effects) {
  if (world.mode !== 'tempering') return false;
  const spec = TEMPERING_CATALOG.find((t) => t.id === temperingId) || world.draftChoices[0];
  if (!spec) return false;

  world.temperingIds.push(spec.id);
  world.mods = computeTemperingModifiers(world.temperingIds);
  world.maxPrismCharges = Math.max(3, world.mods.maxPrisms);
  world.prismCharges = Math.min(world.maxPrismCharges, world.prismCharges + 1.5);

  if (spec.immediateLanternHeal) {
    world.lanternHp = Math.min(world.lanternMaxHp, world.lanternHp + spec.immediateLanternHeal);
  }
  if (spec.immediatePlayerHeal) {
    world.player.hp = Math.min(world.player.maxHp, world.player.hp + spec.immediatePlayerHeal);
  }
  if (spec.immediateMaxHull) {
    world.player.maxHp += spec.immediateMaxHull;
    world.player.hp += spec.immediateMaxHull;
  }

  // Refresh existing prisms' durability slightly between trials
  for (const p of world.prisms) {
    p.maxDurability = PRISM_SPECS[p.kind].maxDurability + world.mods.prismDurabilityBonus;
    p.durability = Math.min(p.maxDurability, p.durability + 5);
  }

  audio.playTemperingPick();
  world.draftChoices = [];
  world.mode = 'playing';
  beginTrialWave(world, world.trialIndex + 1, effects);
  return true;
}

function fireEmberBolt(world, angle, audio) {
  const muzzleDist = 18;
  const x = world.player.x + Math.cos(angle) * muzzleDist;
  const y = world.player.y + Math.sin(angle) * muzzleDist;
  const speed = 590;
  world.bolts.push({
    id: ++world.entitySeq,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    radius: 5.5,
    damage: 20 * world.mods.damageMult,
    life: 1.15,
  });
  audio.playBoltFire();
}

export function computeRunStars(world) {
  if (world.mode !== 'victory') return 0;
  const lanternPct = world.lanternHp / Math.max(1, world.lanternMaxHp);
  if (lanternPct >= 0.65 && world.stats.maxCombo >= 6) return 3;
  if (lanternPct >= 0.35) return 2;
  return 1;
}

function stepTitleAttract(world, dt, effects) {
  world.time += dt;
  const orbitA = -Math.PI / 2 + world.time * 0.55;
  world.player.x = ARENA.centerX + Math.cos(orbitA) * 215;
  world.player.y = ARENA.centerY + Math.sin(orbitA) * 215;
  for (let i = 0; i < world.prisms.length; i++) {
    const p = world.prisms[i];
    p.rot += dt * 0.7;
    p.pulse = Math.max(0.15, p.pulse - dt * 1.5);
  }
  if (Math.floor((world.time - dt) * 2.5) !== Math.floor(world.time * 2.5) && world.prisms.length >= 6) {
    const idx = Math.floor(world.time * 2.5) % world.prisms.length;
    const p1 = world.prisms[idx];
    const p2 = world.prisms[(idx + 1) % world.prisms.length];
    const p3 = world.prisms[(idx + 2) % world.prisms.length];
    p1.pulse = 1;
    p2.pulse = 0.9;
    p3.pulse = 0.8;
    effects.addBeamRibbon(p1.x, p1.y, p2.x, p2.y, PRISM_SPECS[p1.kind].color, '#ffffff', 5.2, 0.45);
    effects.addBeamRibbon(p2.x, p2.y, p3.x, p3.y, PRISM_SPECS[p2.kind].color, '#ffffff', 4.6, 0.45);
    effects.spawnGlassShards(p2.x, p2.y, PRISM_SPECS[p2.kind].coreColor, 5, 0.5);
  }
  effects.update(dt);
}

export function stepWorldSimulation(world, actions, dt, audio, effects, onStateChange) {
  if (world.mode === 'title') {
    stepTitleAttract(world, dt, effects);
    return;
  }

  if (world.mode !== 'playing') {
    effects.update(dt * 0.5);
    return;
  }

  if (effects.consumeHitStop(dt)) {
    return;
  }

  world.time += dt;
  world.runTime += dt;
  if (world.trialBannerTimer > 0) world.trialBannerTimer = Math.max(0, world.trialBannerTimer - dt);
  if (world.lanternHitFlash > 0) world.lanternHitFlash = Math.max(0, world.lanternHitFlash - dt);

  if (world.combo > 1) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) {
      world.combo = 1;
      world.comboTimer = 0;
    }
  }

  // Prism selection & placement controls
  if (actions.prismSelect !== null) {
    world.selectedPrismIndex = actions.prismSelect % PRISM_ORDER.length;
    world.autoCyclePrisms = false;
  } else if (actions.cyclePrism !== 0) {
    world.selectedPrismIndex =
      (world.selectedPrismIndex + actions.cyclePrism + PRISM_ORDER.length) % PRISM_ORDER.length;
    world.autoCyclePrisms = false;
  }

  if (actions.deployPrism) {
    deployPrismNode(world, actions.aimX, actions.aimY, audio, effects);
  }
  if (actions.recallPrism) {
    recallNearestPrism(world, actions.aimX, actions.aimY, audio, effects);
  }
  if (actions.nova) {
    triggerKilnSupernova(world, audio, effects);
  }

  // Weaver movement & Phase Dash
  const player = world.player;
  if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
  if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  if (player.fireCooldown > 0) player.fireCooldown = Math.max(0, player.fireCooldown - dt);

  player.angle = Math.atan2(actions.aimY - player.y, actions.aimX - player.x);

  if (actions.dash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
    const moveMag = Math.hypot(actions.move.dx, actions.move.dy);
    if (moveMag > 0.1) {
      player.dashDirX = actions.move.dx / moveMag;
      player.dashDirY = actions.move.dy / moveMag;
    } else {
      player.dashDirX = Math.cos(player.angle);
      player.dashDirY = Math.sin(player.angle);
    }
    player.dashTimer = 0.17;
    player.dashCooldown = 0.95 * world.mods.dashCooldownMult;
    player.invulnTimer = Math.max(player.invulnTimer, 0.24);
    audio.playDash();
    effects.addShockwave(player.x, player.y, 44, '#18e4ff', 2.8, 0.2);

    if (world.mods.dashNovaDamage > 0) {
      effects.addShockwave(player.x, player.y, 96, '#ff3e6c', 4, 0.3);
      for (const e of world.enemies.slice()) {
        if (Math.hypot(e.x - player.x, e.y - player.y) <= 96 + e.radius) {
          damageTarget(
            world,
            e,
            world.mods.dashNovaDamage * world.mods.damageMult,
            Math.atan2(e.y - player.y, e.x - player.x),
            { refracted: true, bounceDepth: 1, color: '#ff3e6c', ignoreArmor: true },
            audio,
            effects,
          );
        }
      }
    }
  }

  if (player.dashTimer > 0) {
    player.dashTimer = Math.max(0, player.dashTimer - dt);
    const dashSpeed = 640;
    player.x += player.dashDirX * dashSpeed * dt;
    player.y += player.dashDirY * dashSpeed * dt;
    effects.addDashGhost(player.x, player.y, player.angle);
  } else {
    const moveSpeed = 232 * world.mods.moveSpeedMult;
    player.vx = actions.move.dx * moveSpeed;
    player.vy = actions.move.dy * moveSpeed;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
  }

  // Constrain Weaver outside Heart-Lantern core and inside Crucible wall
  const dxCenter = player.x - ARENA.centerX;
  const dyCenter = player.y - ARENA.centerY;
  const distCenter = Math.hypot(dxCenter, dyCenter) || 0.001;
  const minPlayerDist = ARENA.lanternRadius + player.radius + 6;
  const maxPlayerDist = ARENA.outerRadius - player.radius - 6;
  if (distCenter < minPlayerDist) {
    player.x = ARENA.centerX + (dxCenter / distCenter) * minPlayerDist;
    player.y = ARENA.centerY + (dyCenter / distCenter) * minPlayerDist;
  } else if (distCenter > maxPlayerDist) {
    player.x = ARENA.centerX + (dxCenter / distCenter) * maxPlayerDist;
    player.y = ARENA.centerY + (dyCenter / distCenter) * maxPlayerDist;
  }

  // Primary fire
  if (actions.firing && player.fireCooldown <= 0) {
    player.shotCount += 1;
    if (world.mods.twinEveryThird && player.shotCount % 3 === 0) {
      fireEmberBolt(world, player.angle - 0.11, audio);
      fireEmberBolt(world, player.angle + 0.11, { playBoltFire() {} });
    } else {
      fireEmberBolt(world, player.angle, audio);
    }
    player.fireCooldown = 0.19 / world.mods.fireRateMult;
  }

  // Update Prisms rotation/pulse & passive trickle charge
  world.prismCharges = Math.min(world.maxPrismCharges, world.prismCharges + dt * 0.075);
  for (const p of world.prisms) {
    p.rot += dt * 0.75;
    p.pulse = Math.max(0, p.pulse - dt * 2.4);
  }

  // Update primary Ember Bolts (check Prism refraction first, then combat targets)
  for (let i = world.bolts.length - 1; i >= 0; i--) {
    const b = world.bolts[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.life <= 0 || Math.hypot(b.x - ARENA.centerX, b.y - ARENA.centerY) > ARENA.outerRadius + 10) {
      world.bolts.splice(i, 1);
      continue;
    }

    let consumed = false;
    for (const prism of world.prisms) {
      if (Math.hypot(b.x - prism.x, b.y - prism.y) <= prism.radius + b.radius + 4) {
        effects.addBeamRibbon(
          b.x - Math.cos(b.angle) * 28,
          b.y - Math.sin(b.angle) * 28,
          prism.x,
          prism.y,
          '#ffaa2b',
          '#fff6d6',
          4.2,
          0.18,
        );
        refractThroughPrismChain(world, b.angle, b.damage, prism, new Set(), 1, audio, effects);
        world.bolts.splice(i, 1);
        consumed = true;
        break;
      }
    }
    if (consumed) continue;

    // Check Pylons, Boss, and Enemies
    const allTargets = [...world.pylons, ...(world.boss ? [world.boss] : []), ...world.enemies];
    for (const target of allTargets) {
      if (target.hp > 0 && Math.hypot(b.x - target.x, b.y - target.y) <= target.radius + b.radius) {
        damageTarget(world, target, b.damage, b.angle, { refracted: false, bounceDepth: 0 }, audio, effects);
        effects.spawnGlassShards(b.x, b.y, '#ffbe3b', 5, 0.45);
        world.bolts.splice(i, 1);
        consumed = true;
        break;
      }
    }
  }

  // Spawn Trial queue in multi-vent batches so combat stays rich and active
  const waveDef = TRIAL_WAVES[world.trialIndex - 1];
  if (!waveDef.isBossTrial && world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0 || world.enemies.length <= 1) {
      const batch = Math.min(waveDef.batchSize || 2, world.spawnQueue.length);
      const baseA = world.rng.range(0, Math.PI * 2);
      for (let bIdx = 0; bIdx < batch; bIdx++) {
        const nextKind = world.spawnQueue.pop();
        spawnWaveEnemy(world, nextKind, baseA + (bIdx * Math.PI * 2) / batch + world.rng.range(-0.22, 0.22));
        world.spawnedTrialEnemies += 1;
      }
      world.spawnTimer = waveDef.spawnInterval;
    }
  }

  // Step Enemies, Boss, Pylons, and Frost Orbs
  updateEnemiesAndBoss(world, dt, audio, effects);

  // Step Glass Shards (magnet pull + pickup)
  const magnetRadius = 92 * world.mods.magnetRadiusMult;
  for (let i = world.shards.length - 1; i >= 0; i--) {
    const s = world.shards[i];
    s.life -= dt;
    if (s.life <= 0) {
      world.shards.splice(i, 1);
      continue;
    }
    s.rot += dt * 3.2;
    const dx = player.x - s.x;
    const dy = player.y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < magnetRadius) {
      const pull = (1 - d / magnetRadius) * 440 + 150;
      s.vx += (dx / d) * pull * dt * 5;
      s.vy += (dy / d) * pull * dt * 5;
    } else {
      s.vx *= Math.pow(0.18, dt);
      s.vy *= Math.pow(0.18, dt);
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    if (d <= player.radius + 12) {
      world.shards.splice(i, 1);
      world.stats.shardsCollected += 1;
      world.prismCharges = Math.min(
        world.maxPrismCharges,
        world.prismCharges + 0.36 * world.mods.shardChargeMult,
      );
      world.novaCharge = Math.min(100, world.novaCharge + 0.9 * world.mods.novaGainMult);
      world.score += Math.round(15 * (DIFFICULTY_MODES[world.difficulty]?.scoreMult || 1));
      if (world.combo > 1) world.comboTimer = Math.min(4.2, world.comboTimer + 0.45);
      audio.playShardCollect(world.combo);
    }
  }

  effects.update(dt);

  // Check Defeat conditions
  if (world.lanternHp <= 0 || player.hp <= 0) {
    world.defeatReason =
      world.lanternHp <= 0
        ? 'The Heart-Lantern was snuffed by the creeping rime.'
        : 'Your Weaver vessel shattered inside the Crucible.';
    world.mode = 'gameover';
    audio.playDefeatToll();
    if (onStateChange) onStateChange('gameover');
    return;
  }

  // Check Trial clear / Victory conditions
  const trialCleared = waveDef.isBossTrial
    ? world.boss === null
    : world.spawnQueue.length === 0 && world.enemies.length === 0;

  if (trialCleared) {
    world.stats.trialsCleared = world.trialIndex;
    const integrityBonus = Math.round(world.lanternHp * 6);
    world.score += integrityBonus;
    world.lanternHp = Math.min(world.lanternMaxHp, world.lanternHp + 14);
    world.player.hp = Math.min(world.player.maxHp, world.player.hp + 1);

    if (world.trialIndex >= TRIAL_WAVES.length) {
      world.mode = 'victory';
      audio.playVictoryFanfare();
      if (onStateChange) onStateChange('victory');
    } else {
      world.draftChoices = rollTemperingChoices(world.rng, world.temperingIds, 3);
      world.mode = 'tempering';
      audio.playTemperingPick();
      if (onStateChange) onStateChange('tempering');
    }
  }
}
