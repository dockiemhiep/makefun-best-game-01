// Stained-glass Prism placement, harmonic chain-beam refraction, and Kiln Supernova overdrive.

import { ARENA, PRISM_ORDER, PRISM_SPECS } from './config.js';
import { damageTarget } from './enemies.js';

export function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 0.0001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / lenSq));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

export function clampPrismPosition(x, y) {
  const dx = x - ARENA.centerX;
  const dy = y - ARENA.centerY;
  const dist = Math.hypot(dx, dy);
  const angle = dist > 0.001 ? Math.atan2(dy, dx) : 0;
  const clampedDist = Math.max(
    ARENA.prismMinDistFromCenter,
    Math.min(ARENA.prismMaxDistFromCenter, dist),
  );
  return {
    x: ARENA.centerX + Math.cos(angle) * clampedDist,
    y: ARENA.centerY + Math.sin(angle) * clampedDist,
  };
}

export function deployPrismNode(world, rawX, rawY, audio, effects) {
  if (world.prismCharges < 1 && world.prisms.length === 0) {
    effects.addCallout(rawX, rawY - 16, 'NEED GLASS SHARDS', '#ff8fa3', 0.88);
    return false;
  }

  // Allow free reposition by recycling oldest prism if charges are empty, or spend 1 charge
  if (world.prismCharges >= 1) {
    world.prismCharges -= 1;
  } else if (world.prisms.length > 0) {
    const recycled = world.prisms.shift();
    effects.spawnGlassShards(recycled.x, recycled.y, PRISM_SPECS[recycled.kind].color, 8, 0.7);
  }

  if (world.prisms.length >= world.mods.maxPrisms) {
    const oldest = world.prisms.shift();
    effects.spawnGlassShards(oldest.x, oldest.y, PRISM_SPECS[oldest.kind].color, 8, 0.7);
  }

  let pos = clampPrismPosition(rawX, rawY);
  const kind = PRISM_ORDER[world.selectedPrismIndex % PRISM_ORDER.length];
  const spec = PRISM_SPECS[kind];
  const maxDurability = spec.maxDurability + world.mods.prismDurabilityBonus;

  // Prevent accidental overlapping prisms: if deployed right on an existing prism, replace it in place;
  // if slightly too close (< 84px), nudge angularly around the Lantern for clean triad geometry.
  const exactOverlapIdx = world.prisms.findIndex((p) => Math.hypot(p.x - pos.x, p.y - pos.y) < 38);
  if (exactOverlapIdx !== -1) {
    world.prisms.splice(exactOverlapIdx, 1);
  } else {
    for (let attempt = 0; attempt < 5; attempt++) {
      const crowded = world.prisms.find((p) => Math.hypot(p.x - pos.x, p.y - pos.y) < 84);
      if (!crowded) break;
      const baseAngle = Math.atan2(pos.y - ARENA.centerY, pos.x - ARENA.centerX) + 0.58;
      const r = Math.hypot(pos.x - ARENA.centerX, pos.y - ARENA.centerY);
      pos = clampPrismPosition(
        ARENA.centerX + Math.cos(baseAngle) * r,
        ARENA.centerY + Math.sin(baseAngle) * r,
      );
    }
  }

  const prism = {
    id: ++world.entitySeq,
    kind,
    x: pos.x,
    y: pos.y,
    radius: 19,
    durability: maxDurability,
    maxDurability,
    refractCount: 0,
    pulse: 1.0,
    rot: world.rng.range(0, Math.PI * 2),
    drainedBy: 0,
  };

  world.prisms.push(prism);
  if (world.autoCyclePrisms) {
    world.selectedPrismIndex = (world.selectedPrismIndex + 1) % PRISM_ORDER.length;
  }

  audio.playPrismDeploy(kind);
  effects.addShockwave(pos.x, pos.y, 62, spec.color, 3, 0.28);
  effects.spawnGlassShards(pos.x, pos.y, spec.coreColor, 9, 0.65);
  return true;
}

export function recallNearestPrism(world, x, y, audio, effects) {
  if (world.prisms.length === 0) return false;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < world.prisms.length; i++) {
    const d = Math.hypot(world.prisms[i].x - x, world.prisms[i].y - y);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  const [removed] = world.prisms.splice(bestIdx, 1);
  world.prismCharges = Math.min(world.maxPrismCharges, world.prismCharges + 0.85);
  effects.spawnGlassShards(removed.x, removed.y, PRISM_SPECS[removed.kind].color, 12, 0.8);
  effects.addCallout(removed.x, removed.y - 14, 'PRISM RECALLED', '#dcfbff', 0.86);
  audio.playShardCollect(1);
  return true;
}

function collectCombatTargets(world) {
  const list = [];
  for (const enemy of world.enemies) {
    if (enemy.hp > 0) list.push(enemy);
  }
  for (const pylon of world.pylons) {
    if (pylon.hp > 0) list.push(pylon);
  }
  if (world.boss && world.boss.hp > 0) {
    list.push(world.boss);
  }
  return list;
}

function clampEndpointToCrucible(x1, y1, x2, y2) {
  const maxR = ARENA.outerRadius - 4;
  const dx2 = x2 - ARENA.centerX;
  const dy2 = y2 - ARENA.centerY;
  if (Math.hypot(dx2, dy2) <= maxR) return { x: x2, y: y2 };

  // Ray-circle intersection from (x1, y1) toward (x2, y2) inside Crucible
  const vx = x2 - x1;
  const vy = y2 - y1;
  const ox = x1 - ARENA.centerX;
  const oy = y1 - ARENA.centerY;
  const a = vx * vx + vy * vy;
  if (a < 0.0001) return { x: x1, y: y1 };
  const b = 2 * (ox * vx + oy * vy);
  const c = ox * ox + oy * oy - maxR * maxR;
  const disc = Math.max(0, b * b - 4 * a * c);
  const t = Math.max(0, Math.min(1, (-b + Math.sqrt(disc)) / (2 * a)));
  return { x: x1 + vx * t, y: y1 + vy * t };
}

export function castLaserBeamSegment(world, x1, y1, rawX2, rawY2, damage, spec, bounceDepth, audio, effects) {
  const end = clampEndpointToCrucible(x1, y1, rawX2, rawY2);
  const x2 = end.x;
  const y2 = end.y;
  effects.addBeamRibbon(x1, y1, x2, y2, spec.color, spec.coreColor, 4.5 + bounceDepth * 1.1, 0.25);
  const beamAngle = Math.atan2(y2 - y1, x2 - x1);
  const targets = collectCombatTargets(world);
  let hits = 0;

  for (const target of targets) {
    const dist = distancePointToSegment(target.x, target.y, x1, y1, x2, y2);
    if (dist <= target.radius + 9) {
      if (spec.id === 'cyan' && target.slowTimer !== undefined) {
        target.slowTimer = Math.max(target.slowTimer, 1.8);
      }
      damageTarget(
        world,
        target,
        damage,
        beamAngle,
        { refracted: true, bounceDepth, color: spec.color },
        audio,
        effects,
      );
      hits++;
    }
  }

  // Refracted beams vaporize incoming frost orbs along their path
  for (let i = world.enemyProjectiles.length - 1; i >= 0; i--) {
    const orb = world.enemyProjectiles[i];
    if (distancePointToSegment(orb.x, orb.y, x1, y1, x2, y2) <= orb.radius + 10) {
      effects.spawnGlassShards(orb.x, orb.y, '#caf0f8', 5, 0.55);
      world.enemyProjectiles.splice(i, 1);
    }
  }

  return hits;
}

function findNextChainPrism(world, fromPrism, visitedIds) {
  let best = null;
  let bestDist = ARENA.prismLinkRange;
  for (const candidate of world.prisms) {
    if (candidate.id === fromPrism.id || visitedIds.has(candidate.id)) continue;
    const d = Math.hypot(candidate.x - fromPrism.x, candidate.y - fromPrism.y);
    if (d <= bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return best;
}

function findPriorityEnemyAngle(world, fromX, fromY, fallbackAngle) {
  const targets = collectCombatTargets(world);
  let best = null;
  let bestScore = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - fromX, t.y - fromY);
    if (d < 420 && d < bestScore) {
      bestScore = d;
      best = t;
    }
  }
  if (!best) return fallbackAngle;
  return Math.atan2(best.y - fromY, best.x - fromX);
}

export function refractThroughPrismChain(world, entryAngle, baseDamage, startPrism, visitedIds, bounceDepth, audio, effects) {
  if (!startPrism || bounceDepth > world.mods.maxBounces) return;
  visitedIds.add(startPrism.id);

  const spec = PRISM_SPECS[startPrism.kind];
  startPrism.pulse = 1.0;
  startPrism.refractCount += 1;
  startPrism.durability -= 1;
  world.stats.beamsRefracted += 1;
  world.novaCharge = Math.min(100, world.novaCharge + 1.15 * world.mods.novaGainMult);

  const amplifiedDamage = baseDamage * spec.damageMult * (1 + bounceDepth * 0.16);
  audio.playPrismRefract(bounceDepth, startPrism.kind);
  effects.spawnGlassShards(startPrism.x, startPrism.y, spec.coreColor, 6, 0.55);

  const aimAngle = findPriorityEnemyAngle(world, startPrism.x, startPrism.y, entryAngle);

  if (startPrism.kind === 'ruby') {
    const spread = [-0.28, 0, 0.28];
    for (const offset of spread) {
      const a = aimAngle + offset;
      const len = 295;
      castLaserBeamSegment(
        world,
        startPrism.x,
        startPrism.y,
        startPrism.x + Math.cos(a) * len,
        startPrism.y + Math.sin(a) * len,
        amplifiedDamage * 0.78,
        spec,
        bounceDepth,
        audio,
        effects,
      );
    }
  } else if (startPrism.kind === 'cyan') {
    const len = 340;
    castLaserBeamSegment(
      world,
      startPrism.x,
      startPrism.y,
      startPrism.x + Math.cos(aimAngle) * len,
      startPrism.y + Math.sin(aimAngle) * len,
      amplifiedDamage,
      spec,
      bounceDepth,
      audio,
      effects,
    );
  } else if (startPrism.kind === 'topaz') {
    const len = 285;
    castLaserBeamSegment(
      world,
      startPrism.x,
      startPrism.y,
      startPrism.x + Math.cos(aimAngle) * len,
      startPrism.y + Math.sin(aimAngle) * len,
      amplifiedDamage * 0.92,
      spec,
      bounceDepth,
      audio,
      effects,
    );
    if (startPrism.refractCount % 2 === 0) {
      const novaRadius = 112 * world.mods.novaRadiusMult;
      effects.addShockwave(startPrism.x, startPrism.y, novaRadius, spec.color, 4.5, 0.34);
      const targets = collectCombatTargets(world);
      for (const t of targets) {
        if (Math.hypot(t.x - startPrism.x, t.y - startPrism.y) <= novaRadius + t.radius) {
          const outAngle = Math.atan2(t.y - startPrism.y, t.x - startPrism.x);
          damageTarget(
            world,
            t,
            amplifiedDamage * 0.95,
            outAngle,
            { refracted: true, bounceDepth, color: spec.color, ignoreArmor: true },
            audio,
            effects,
          );
        }
      }
    }
  }

  // Chain harmonic relay to next unvisited Prism in link range
  const nextPrism = findNextChainPrism(world, startPrism, visitedIds);
  if (nextPrism && bounceDepth < world.mods.maxBounces) {
    castLaserBeamSegment(
      world,
      startPrism.x,
      startPrism.y,
      nextPrism.x,
      nextPrism.y,
      amplifiedDamage * 1.12,
      spec,
      bounceDepth + 1,
      audio,
      effects,
    );
    const linkAngle = Math.atan2(nextPrism.y - startPrism.y, nextPrism.x - startPrism.x);
    refractThroughPrismChain(
      world,
      linkAngle,
      amplifiedDamage,
      nextPrism,
      visitedIds,
      bounceDepth + 1,
      audio,
      effects,
    );
  }

  // Shatter spent prism gracefully with a final burst
  if (startPrism.durability <= 0) {
    const idx = world.prisms.findIndex((p) => p.id === startPrism.id);
    if (idx !== -1) {
      world.prisms.splice(idx, 1);
      effects.addShockwave(startPrism.x, startPrism.y, 88 * world.mods.novaRadiusMult, spec.color, 4, 0.3);
      effects.spawnGlassShards(startPrism.x, startPrism.y, spec.color, 16, 1.0);
    }
  }
}

export function triggerKilnSupernova(world, audio, effects) {
  if (world.novaCharge < 100) return false;
  world.novaCharge = 0;
  world.stats.supernovasCast += 1;

  audio.playSupernova();
  effects.triggerShake(9.5);
  effects.triggerHitStop(0.045);
  effects.triggerScreenFlash('#ffd24c', 0.28);
  effects.addShockwave(ARENA.centerX, ARENA.centerY, ARENA.outerRadius + 18, '#ffd24c', 6, 0.52);
  effects.addCallout(ARENA.centerX, ARENA.centerY - 54, 'KILN SUPERNOVA!', '#ffe599', 1.35);

  const novaDamage = 92 * world.mods.damageMult * world.mods.novaDamageMult;
  const nodes = [
    { x: ARENA.centerX, y: ARENA.centerY, spec: PRISM_SPECS.topaz },
    ...world.prisms.map((p) => ({ x: p.x, y: p.y, spec: PRISM_SPECS[p.kind] })),
  ];

  // Connect every node into a radiant stained-glass polygon web
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      castLaserBeamSegment(
        world,
        nodes[i].x,
        nodes[i].y,
        nodes[j].x,
        nodes[j].y,
        novaDamage * 0.72,
        nodes[j].spec,
        3,
        audio,
        effects,
      );
    }
  }

  // Radial arena-wide resonance pulse + projectile cleanse + Lantern warmth mend
  world.enemyProjectiles.length = 0;
  world.lanternHp = Math.min(world.lanternMaxHp, world.lanternHp + 12);

  const targets = collectCombatTargets(world);
  for (const t of targets) {
    const a = Math.atan2(t.y - ARENA.centerY, t.x - ARENA.centerX);
    damageTarget(
      world,
      t,
      novaDamage,
      a,
      { refracted: true, bounceDepth: 3, color: '#ffd24c', ignoreArmor: true },
      audio,
      effects,
    );
  }

  return true;
}
