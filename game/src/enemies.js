// Six enemy archetypes, directional armor physics, and 3-phase Boss Vespera, The Rime Sovereign.

import { ARENA, BOSS_SPEC, DIFFICULTY_MODES, ENEMY_SPECS } from './config.js';

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function spawnWaveEnemy(world, kind, angleOverride = null) {
  const spec = ENEMY_SPECS[kind] || ENEMY_SPECS.skitterer;
  const diff = DIFFICULTY_MODES[world.difficulty] || DIFFICULTY_MODES.artisan;
  const angle = angleOverride !== null ? angleOverride : world.rng.range(0, Math.PI * 2);
  const spawnDist = ARENA.outerRadius - 8;
  const x = ARENA.centerX + Math.cos(angle) * spawnDist;
  const y = ARENA.centerY + Math.sin(angle) * spawnDist;
  const maxHp = Math.round(spec.hp * diff.enemyHpScale * (1 + (world.trialIndex - 1) * 0.14));

  const enemy = {
    id: ++world.entitySeq,
    isEnemy: true,
    kind: spec.id,
    name: spec.name,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: spec.radius,
    hp: maxHp,
    maxHp,
    speed: spec.speed * diff.enemySpeedScale,
    score: spec.score,
    shards: spec.shards,
    lanternDamage: spec.lanternDamage,
    color: spec.color,
    trim: spec.trim,
    shieldHalfArc: spec.shieldHalfArc || 0,
    facing: Math.atan2(ARENA.centerY - y, ARENA.centerX - x),
    phaseOffset: world.rng.range(0, Math.PI * 2),
    fireCooldown: world.rng.range(1.2, 2.4),
    telegraphTimer: 0,
    slowTimer: 0,
    hitFlash: 0,
    armorCalloutCooldown: 0,
  };

  world.enemies.push(enemy);
  return enemy;
}

export function spawnChildMite(world, x, y, angle) {
  const mite = spawnWaveEnemy(world, 'mite', angle);
  mite.x = x + Math.cos(angle) * 14;
  mite.y = y + Math.sin(angle) * 14;
  return mite;
}

export function spawnBossVespera(world) {
  const diff = DIFFICULTY_MODES[world.difficulty] || DIFFICULTY_MODES.artisan;
  const maxHp = Math.round(BOSS_SPEC.maxHp * diff.enemyHpScale);
  const angle = -Math.PI / 2;
  world.boss = {
    id: ++world.entitySeq,
    isBoss: true,
    name: BOSS_SPEC.name,
    x: ARENA.centerX + Math.cos(angle) * BOSS_SPEC.orbitRadius,
    y: ARENA.centerY + Math.sin(angle) * BOSS_SPEC.orbitRadius,
    orbitAngle: angle,
    orbitRadius: BOSS_SPEC.orbitRadius,
    radius: BOSS_SPEC.radius,
    hp: maxHp,
    maxHp,
    phase: 1,
    shieldAngle: 0,
    fireTimer: 1.8,
    summonTimer: 4.4,
    sweepState: 'idle', // 'idle' | 'telegraph' | 'firing'
    sweepTimer: 5.5,
    sweepAngle: 0,
    slowTimer: 0,
    hitFlash: 0,
  };
  return world.boss;
}

function spawnCryoPylons(world, effects) {
  world.pylons.length = 0;
  const diff = DIFFICULTY_MODES[world.difficulty] || DIFFICULTY_MODES.artisan;
  const maxHp = Math.round(BOSS_SPEC.pylonHp * diff.enemyHpScale);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + 0.52;
    const dist = 168;
    const px = ARENA.centerX + Math.cos(a) * dist;
    const py = ARENA.centerY + Math.sin(a) * dist;
    world.pylons.push({
      id: ++world.entitySeq,
      isPylon: true,
      name: 'Cryo Pylon',
      x: px,
      y: py,
      radius: 17,
      hp: maxHp,
      maxHp,
      hitFlash: 0,
      pulse: i * 1.4,
    });
    effects.addShockwave(px, py, 54, '#8ce8ff', 3, 0.32);
  }
}

function spawnShardPickups(world, x, y, count) {
  for (let i = 0; i < count; i++) {
    const a = world.rng.range(0, Math.PI * 2);
    const spd = world.rng.range(35, 95);
    world.shards.push({
      id: ++world.entitySeq,
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      rot: world.rng.range(0, Math.PI * 2),
      life: 11.5,
    });
  }
}

export function registerComboScore(world, basePoints, x, y, labelPrefix, color, effects) {
  const diff = DIFFICULTY_MODES[world.difficulty] || DIFFICULTY_MODES.artisan;
  world.combo = Math.min(12, world.combo + 1);
  world.comboTimer = 4.2;
  if (world.combo > world.stats.maxCombo) {
    world.stats.maxCombo = world.combo;
  }

  const mult = 1 + (world.combo - 1) * 0.25;
  const gained = Math.round(basePoints * diff.scoreMult * mult);
  world.score += gained;

  if (world.combo >= 6 && world.mods.comboLanternHeal > 0) {
    world.lanternHp = Math.min(world.lanternMaxHp, world.lanternHp + world.mods.comboLanternHeal);
  }

  const tag = labelPrefix
    ? `${labelPrefix} +${gained}`
    : world.combo >= 3
      ? `x${world.combo} +${gained}`
      : `+${gained}`;
  effects.addCallout(x, y - 14, tag, color, world.combo >= 6 ? 1.14 : 0.96);
}

export function damageTarget(world, target, rawDamage, hitAngle, meta, audio, effects) {
  if (!target || target.hp <= 0) return false;

  let finalDamage = rawDamage;
  let calloutPrefix = '';
  const incomingFrom = normalizeAngle(hitAngle + Math.PI);

  // Slag Bulwark front shield check
  if (target.isEnemy && target.shieldHalfArc > 0 && !meta.ignoreArmor) {
    const delta = Math.abs(normalizeAngle(incomingFrom - target.facing));
    if (delta <= target.shieldHalfArc) {
      finalDamage *= 0.24;
      audio.playArmorRicochet();
      effects.spawnGlassShards(target.x, target.y, '#ffd24c', 4, 0.45);
      if (target.armorCalloutCooldown <= 0) {
        effects.addCallout(target.x, target.y - 20, 'SHIELDED! REFRACT FLANK', '#ffd24c', 0.85);
        target.armorCalloutCooldown = 1.6;
      }
    } else if (meta.refracted) {
      finalDamage *= 1.65 * world.mods.flankBonusMult;
      calloutPrefix = 'FLANK SHATTER';
    }
  }

  // Boss Vespera rotating twin glacial shield arcs in Phases 1 & 2
  if (target.isBoss && !meta.ignoreArmor && world.pylons.length === 0) {
    const d1 = Math.abs(normalizeAngle(incomingFrom - target.shieldAngle));
    const d2 = Math.abs(normalizeAngle(incomingFrom - (target.shieldAngle + Math.PI)));
    if (Math.min(d1, d2) < 0.52 && !meta.refracted) {
      finalDamage *= 0.35;
      audio.playArmorRicochet();
    }
  }

  // Cryo Pylons protect Boss Vespera in Phase 2 (55% damage reduction until shattered)
  if (target.isBoss && world.pylons.length > 0) {
    finalDamage *= 0.45;
  }

  target.hp -= finalDamage;
  target.hitFlash = 0.14;

  if (target.hp > 0) {
    if (meta.refracted) {
      world.comboTimer = Math.max(world.comboTimer, 2.8);
    }
    return false;
  }

  // Target shattered!
  target.hp = 0;

  if (target.isPylon) {
    const idx = world.pylons.indexOf(target);
    if (idx !== -1) world.pylons.splice(idx, 1);
    audio.playEnemyShatter(true);
    effects.spawnGlassShards(target.x, target.y, '#8ce8ff', 18, 1.05);
    effects.addShockwave(target.x, target.y, 72, '#18e4ff', 3.5, 0.32);
    registerComboScore(world, 280, target.x, target.y, 'PYLON SHATTERED', '#8ce8ff', effects);
    spawnShardPickups(world, target.x, target.y, 3);
    return true;
  }

  if (target.isBoss) {
    world.boss = null;
    world.pylons.length = 0;
    world.enemies.length = 0;
    world.enemyProjectiles.length = 0;
    world.stats.enemiesShattered += 1;
    audio.playEnemyShatter(true);
    effects.triggerShake(13);
    effects.triggerHitStop(0.055);
    effects.triggerScreenFlash('#ffe28a', 0.35);
    effects.addShockwave(target.x, target.y, 240, '#ffd24c', 6, 0.58);
    effects.spawnGlassShards(target.x, target.y, '#8ce8ff', 32, 1.35);
    effects.spawnGlassShards(target.x, target.y, '#ff3e6c', 24, 1.15);
    registerComboScore(world, BOSS_SPEC.score, target.x, target.y, 'SOVEREIGN SHATTERED!', '#ffe184', effects);
    return true;
  }

  // Regular enemy shattered
  const idx = world.enemies.indexOf(target);
  if (idx !== -1) world.enemies.splice(idx, 1);
  world.stats.enemiesShattered += 1;
  world.novaCharge = Math.min(100, world.novaCharge + (meta.refracted ? 2.4 : 1.4) * world.mods.novaGainMult);

  const isHeavy = target.kind === 'bulwark' || target.kind === 'splitter';
  audio.playEnemyShatter(isHeavy);
  if (meta.refracted && meta.bounceDepth >= 2) {
    effects.triggerHitStop(0.024);
    effects.triggerShake(3.8);
    if (!calloutPrefix) calloutPrefix = `CHAIN x${meta.bounceDepth}`;
  }
  effects.spawnGlassShards(target.x, target.y, meta.color || target.color, isHeavy ? 18 : 11, isHeavy ? 1.0 : 0.8);
  if (isHeavy) {
    effects.addShockwave(target.x, target.y, 64, target.color, 3, 0.26);
  }

  if (target.kind === 'splitter') {
    const baseA = world.rng.range(0, Math.PI * 2);
    spawnChildMite(world, target.x, target.y, baseA);
    spawnChildMite(world, target.x, target.y, baseA + Math.PI);
  }

  spawnShardPickups(world, target.x, target.y, target.shards);
  registerComboScore(
    world,
    target.score,
    target.x,
    target.y,
    calloutPrefix,
    meta.refracted ? '#ffe599' : '#dcfbff',
    effects,
  );
  return true;
}

function fireFrostOrb(world, x, y, angle, speed = 158, damage = 1, radius = 6.5) {
  world.enemyProjectiles.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    damage,
    life: 4.5,
  });
}

export function hurtPlayer(world, audio, effects) {
  if (world.player.invulnTimer > 0 || world.mode !== 'playing') return;
  world.player.hp -= 1;
  world.player.invulnTimer = 1.15;
  world.combo = Math.max(1, Math.floor(world.combo * 0.5));
  audio.playHurt();
  effects.triggerShake(7.5);
  effects.triggerScreenFlash('#ff3e6c', 0.24);
  effects.addCallout(world.player.x, world.player.y - 22, 'HULL CRACKED!', '#ff6b8b', 1.05);
}

export function hurtLantern(world, amount, audio, effects) {
  if (world.mode !== 'playing') return;
  world.lanternHp = Math.max(0, world.lanternHp - amount);
  world.lanternHitFlash = 0.25;
  audio.playHurt();
  effects.triggerShake(5.5);
  effects.addShockwave(ARENA.centerX, ARENA.centerY, 68, '#ff4d6d', 3.5, 0.28);
}

export function updateEnemiesAndBoss(world, dt, audio, effects) {
  for (const prism of world.prisms) {
    prism.drainedBy = 0;
  }

  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.armorCalloutCooldown > 0) e.armorCalloutCooldown = Math.max(0, e.armorCalloutCooldown - dt);
    if (e.slowTimer > 0) e.slowTimer = Math.max(0, e.slowTimer - dt);

    const speedMult = e.slowTimer > 0 ? 0.52 : 1.0;
    const spd = e.speed * speedMult;
    const toCenterX = ARENA.centerX - e.x;
    const toCenterY = ARENA.centerY - e.y;
    const distCenter = Math.hypot(toCenterX, toCenterY) || 1;
    const dirCenterAngle = Math.atan2(toCenterY, toCenterX);

    if (e.kind === 'skitterer' || e.kind === 'mite') {
      const weave = Math.sin(world.time * 4.6 + e.phaseOffset) * 0.52;
      const moveA = dirCenterAngle + weave;
      e.vx = Math.cos(moveA) * spd;
      e.vy = Math.sin(moveA) * spd;
      e.facing = moveA;
    } else if (e.kind === 'bulwark' || e.kind === 'splitter') {
      e.vx = Math.cos(dirCenterAngle) * spd;
      e.vy = Math.sin(dirCenterAngle) * spd;
      e.facing = dirCenterAngle;
    } else if (e.kind === 'caster') {
      const desiredDist = 195;
      const radialPush = distCenter > desiredDist + 18 ? 1 : distCenter < desiredDist - 18 ? -0.6 : 0;
      const tangentA = dirCenterAngle + Math.PI / 2;
      e.vx = (Math.cos(dirCenterAngle) * radialPush * 0.7 + Math.cos(tangentA) * 0.75) * spd;
      e.vy = (Math.sin(dirCenterAngle) * radialPush * 0.7 + Math.sin(tangentA) * 0.75) * spd;
      e.facing = Math.atan2(world.player.y - e.y, world.player.x - e.x);

      e.fireCooldown -= dt * speedMult;
      if (e.fireCooldown <= 0.55 && e.telegraphTimer <= 0) {
        e.telegraphTimer = 0.55;
      }
      if (e.telegraphTimer > 0) {
        e.telegraphTimer -= dt;
        if (e.telegraphTimer <= 0) {
          const aim = Math.atan2(world.player.y - e.y, world.player.x - e.x);
          fireFrostOrb(world, e.x, e.y, aim, 162);
          e.fireCooldown = 2.6;
        }
      }
    } else if (e.kind === 'siphon') {
      let targetPrism = null;
      let bestD = Infinity;
      for (const p of world.prisms) {
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < bestD) {
          bestD = d;
          targetPrism = p;
        }
      }
      if (targetPrism) {
        const a = Math.atan2(targetPrism.y - e.y, targetPrism.x - e.x);
        e.facing = a;
        if (bestD > 48) {
          e.vx = Math.cos(a) * spd;
          e.vy = Math.sin(a) * spd;
        } else {
          e.vx = Math.cos(a + Math.PI / 2) * spd * 0.45;
          e.vy = Math.sin(a + Math.PI / 2) * spd * 0.45;
          targetPrism.drainedBy += 1;
          targetPrism.durability -= dt * 1.45;
          if (targetPrism.durability <= 0) {
            const pIdx = world.prisms.indexOf(targetPrism);
            if (pIdx !== -1) {
              world.prisms.splice(pIdx, 1);
              effects.spawnGlassShards(targetPrism.x, targetPrism.y, '#e87aff', 12, 0.8);
            }
          }
        }
      } else {
        e.vx = Math.cos(dirCenterAngle) * spd;
        e.vy = Math.sin(dirCenterAngle) * spd;
        e.facing = dirCenterAngle;
      }
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;

    // Collide with Heart-Lantern
    if (Math.hypot(e.x - ARENA.centerX, e.y - ARENA.centerY) <= ARENA.lanternRadius + e.radius - 4) {
      hurtLantern(world, e.lanternDamage, audio, effects);
      effects.spawnGlassShards(e.x, e.y, e.color, 10, 0.75);
      world.enemies.splice(i, 1);
      continue;
    }

    // Collide with Weaver player
    if (
      world.mode === 'playing' &&
      Math.hypot(e.x - world.player.x, e.y - world.player.y) <= world.player.radius + e.radius - 3
    ) {
      if (world.player.dashTimer > 0) {
        // Phase dashing through minor foes deals kinetic chip
        damageTarget(world, e, 18 * world.mods.damageMult, e.facing + Math.PI, { refracted: false, ignoreArmor: true }, audio, effects);
      } else {
        hurtPlayer(world, audio, effects);
      }
    }
  }

  // Cryo Pylons chill the Heart-Lantern slowly while standing
  if (world.pylons.length > 0 && world.mode === 'playing') {
    for (const p of world.pylons) {
      if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
      p.pulse += dt * 3;
    }
    world.lanternHp = Math.max(0, world.lanternHp - world.pylons.length * 0.85 * dt);
  }

  // Boss Vespera AI & 3-Phase State Machine
  const boss = world.boss;
  if (boss && boss.hp > 0) {
    if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);
    if (boss.slowTimer > 0) boss.slowTimer = Math.max(0, boss.slowTimer - dt);

    const hpRatio = boss.hp / boss.maxHp;
    if (boss.phase === 1 && hpRatio <= 0.66) {
      boss.phase = 2;
      spawnCryoPylons(world, effects);
      audio.playBossPhase();
      effects.triggerShake(9);
      effects.addCallout(boss.x, boss.y - 40, 'PHASE II · CRYO PYLONS!', '#8ce8ff', 1.25);
    } else if (boss.phase === 2 && hpRatio <= 0.34) {
      boss.phase = 3;
      audio.playBossPhase();
      effects.triggerShake(10);
      effects.addCallout(boss.x, boss.y - 40, 'PHASE III · ABSOLUTE ZERO!', '#ff6384', 1.3);
    }

    const orbitSpeed = (boss.phase === 3 ? 0.68 : 0.46) * (boss.slowTimer > 0 ? 0.6 : 1.0);
    boss.orbitAngle += orbitSpeed * dt;
    boss.x = ARENA.centerX + Math.cos(boss.orbitAngle) * boss.orbitRadius;
    boss.y = ARENA.centerY + Math.sin(boss.orbitAngle) * boss.orbitRadius;
    boss.shieldAngle += (boss.phase === 1 ? 1.15 : 1.55) * dt;

    boss.fireTimer -= dt;
    if (boss.fireTimer <= 0) {
      const aimPlayer = Math.atan2(world.player.y - boss.y, world.player.x - boss.x);
      const fanCount = boss.phase === 1 ? 3 : 5;
      for (let k = 0; k < fanCount; k++) {
        const offset = (k - (fanCount - 1) / 2) * 0.24;
        fireFrostOrb(world, boss.x, boss.y, aimPlayer + offset, 176, 1, 7.5);
      }
      boss.fireTimer = boss.phase === 3 ? 1.55 : 2.1;
    }

    boss.summonTimer -= dt;
    if (boss.summonTimer <= 0 && world.enemies.length < 7) {
      const pool = boss.phase === 1 ? ['skitterer', 'siphon'] : ['skitterer', 'bulwark', 'siphon'];
      spawnWaveEnemy(world, world.rng.pick(pool));
      boss.summonTimer = boss.phase === 3 ? 3.4 : 4.6;
    }

    if (boss.phase === 3) {
      boss.sweepTimer -= dt;
      if (boss.sweepState === 'idle' && boss.sweepTimer <= 0) {
        boss.sweepState = 'telegraph';
        boss.sweepTimer = 1.05;
        boss.sweepAngle = Math.atan2(world.player.y - boss.y, world.player.x - boss.x);
      } else if (boss.sweepState === 'telegraph' && boss.sweepTimer <= 0) {
        boss.sweepState = 'firing';
        boss.sweepTimer = 1.35;
      } else if (boss.sweepState === 'firing') {
        boss.sweepAngle += 0.92 * dt;
        const bx2 = boss.x + Math.cos(boss.sweepAngle) * 460;
        const by2 = boss.y + Math.sin(boss.sweepAngle) * 460;
        // Check sweep hit against player unless invulnerable/dashing
        const vx = bx2 - boss.x;
        const vy = by2 - boss.y;
        const t = Math.max(0, Math.min(1, ((world.player.x - boss.x) * vx + (world.player.y - boss.y) * vy) / (vx * vx + vy * vy)));
        const dPlayer = Math.hypot(world.player.x - (boss.x + t * vx), world.player.y - (boss.y + t * vy));
        if (dPlayer <= world.player.radius + 8 && world.player.dashTimer <= 0) {
          hurtPlayer(world, audio, effects);
        }
        if (boss.sweepTimer <= 0) {
          boss.sweepState = 'idle';
          boss.sweepTimer = 4.2;
        }
      }
    }
  }

  // Enemy Frost Orbs update
  for (let i = world.enemyProjectiles.length - 1; i >= 0; i--) {
    const orb = world.enemyProjectiles[i];
    orb.life -= dt;
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;

    if (orb.life <= 0 || Math.hypot(orb.x - ARENA.centerX, orb.y - ARENA.centerY) > ARENA.outerRadius + 24) {
      world.enemyProjectiles.splice(i, 1);
      continue;
    }

    if (Math.hypot(orb.x - ARENA.centerX, orb.y - ARENA.centerY) <= ARENA.lanternRadius + orb.radius) {
      hurtLantern(world, 5, audio, effects);
      effects.spawnGlassShards(orb.x, orb.y, '#8ce8ff', 6, 0.5);
      world.enemyProjectiles.splice(i, 1);
      continue;
    }

    if (
      world.mode === 'playing' &&
      Math.hypot(orb.x - world.player.x, orb.y - world.player.y) <= world.player.radius + orb.radius
    ) {
      if (world.player.dashTimer <= 0) {
        hurtPlayer(world, audio, effects);
      }
      effects.spawnGlassShards(orb.x, orb.y, '#8ce8ff', 6, 0.5);
      world.enemyProjectiles.splice(i, 1);
    }
  }
}
