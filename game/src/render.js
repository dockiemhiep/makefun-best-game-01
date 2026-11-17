// Layered 2D Canvas renderer: Crucible astrolabe arena, stained-glass prisms, beams, foes, and wing HUD.

import {
  ARENA,
  DIFFICULTY_MODES,
  formatComboMultiplier,
  PRISM_ORDER,
  PRISM_SPECS,
  TRIAL_WAVES,
} from './config.js';
import { clampPrismPosition } from './prisms.js';
import { TEMPERING_CATALOG } from './temperings.js';

function drawPolygon(ctx, x, y, radius, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * Math.PI * 2) / sides;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawRoundedPanel(ctx, x, y, w, h, r = 10) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function renderCrucibleArena(ctx, world) {
  const { centerX, centerY, outerRadius, lanternRadius } = ARENA;

  // Deep volcanic backdrop
  const bgGrad = ctx.createRadialGradient(centerX, centerY, 40, centerX, centerY, 740);
  bgGrad.addColorStop(0, '#172038');
  bgGrad.addColorStop(0.52, '#0c1222');
  bgGrad.addColorStop(1, '#060911');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);

  // Subtle architectural wing grid lines
  ctx.strokeStyle = 'rgba(200, 150, 70, 0.06)';
  ctx.lineWidth = 1;
  for (let y = 60; y < ARENA.height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA.width, y);
    ctx.stroke();
  }

  // Crucible floor disc
  const warmthRatio = Math.max(0.1, world.lanternHp / Math.max(1, world.lanternMaxHp));
  const floorGrad = ctx.createRadialGradient(centerX, centerY, 16, centerX, centerY, outerRadius);
  floorGrad.addColorStop(0, `rgba(255, 168, 46, ${0.24 * warmthRatio})`);
  floorGrad.addColorStop(0.36, '#18223c');
  floorGrad.addColorStop(0.84, '#10172b');
  floorGrad.addColorStop(1, '#0b101e');
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
  ctx.fillStyle = floorGrad;
  ctx.fill();

  // Concentric burnished-brass astrolabe inlay rings
  ctx.save();
  for (const ringR of [92, 168, 238]) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(244, 201, 121, 0.13)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // 12 radial kiln spokes & outer stained-glass vault panes
  const paneColors = ['#ff3e6c', '#18e4ff', '#ffd24c'];
  for (let i = 0; i < 12; i++) {
    const a0 = (i * Math.PI * 2) / 12;
    const a1 = ((i + 1) * Math.PI * 2) / 12;
    const mid = (a0 + a1) * 0.5;

    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(mid) * (lanternRadius + 18), centerY + Math.sin(mid) * (lanternRadius + 18));
    ctx.lineTo(centerX + Math.cos(mid) * outerRadius, centerY + Math.sin(mid) * outerRadius);
    ctx.strokeStyle = 'rgba(244, 201, 121, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Outer stained-glass rim arc segment
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius + 6, a0 + 0.03, a1 - 0.03);
    ctx.strokeStyle = paneColors[i % 3];
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Main brass Crucible rim
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
  ctx.strokeStyle = '#d6a456';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius + 11, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(244, 201, 121, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Central Heart-Lantern
  const pulse = 1 + Math.sin(world.time * 4.2) * 0.06;
  const glowR = lanternRadius * 2.5 * pulse;
  const lanternGlow = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, glowR);
  lanternGlow.addColorStop(0, world.lanternHitFlash > 0 ? 'rgba(255, 77, 109, 0.9)' : 'rgba(255, 232, 165, 0.85)');
  lanternGlow.addColorStop(0.45, 'rgba(255, 162, 38, 0.34)');
  lanternGlow.addColorStop(1, 'rgba(255, 140, 20, 0)');
  ctx.fillStyle = lanternGlow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Brass octagonal lantern housing
  drawPolygon(ctx, centerX, centerY, lanternRadius, 8, Math.PI / 8);
  ctx.fillStyle = '#1d160d';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f4c979';
  ctx.stroke();

  drawPolygon(ctx, centerX, centerY, lanternRadius * 0.68 * pulse, 8, world.time * 0.5);
  ctx.fillStyle = world.lanternHitFlash > 0 ? '#ff5c7c' : '#ffbe3b';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(centerX, centerY, lanternRadius * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = '#fff9e6';
  ctx.fill();

  // Circular integrity arc around Heart-Lantern
  const hpPct = Math.max(0, world.lanternHp / Math.max(1, world.lanternMaxHp));
  ctx.beginPath();
  ctx.arc(centerX, centerY, lanternRadius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpPct);
  ctx.strokeStyle = hpPct > 0.35 ? '#ffd24c' : '#ff4d6d';
  ctx.lineWidth = 3.2;
  ctx.stroke();
}

function renderPrismNetworkAndGhost(ctx, world, inputState) {
  // Harmonic link preview lines between deployed Prisms within link range
  ctx.save();
  ctx.setLineDash([6, 6]);
  for (let i = 0; i < world.prisms.length; i++) {
    for (let j = i + 1; j < world.prisms.length; j++) {
      const a = world.prisms[i];
      const b = world.prisms[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d <= ARENA.prismLinkRange) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(255, 226, 160, 0.24)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);

  // Subtle placement ghost at cursor when playing
  if (world.mode === 'playing' && inputState.usingPointer) {
    const ghostPos = clampPrismPosition(inputState.aimX, inputState.aimY);
    const nextKind = PRISM_ORDER[world.selectedPrismIndex % PRISM_ORDER.length];
    const spec = PRISM_SPECS[nextKind];
    for (const p of world.prisms) {
      if (Math.hypot(p.x - ghostPos.x, p.y - ghostPos.y) <= ARENA.prismLinkRange) {
        ctx.beginPath();
        ctx.moveTo(ghostPos.x, ghostPos.y);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.arc(ghostPos.x, ghostPos.y, 16, 0, Math.PI * 2);
    ctx.strokeStyle = spec.color;
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Render deployed Stained-Glass Prisms
  for (const p of world.prisms) {
    const spec = PRISM_SPECS[p.kind];
    const scale = 1 + p.pulse * 0.24;
    const r = p.radius * scale;

    // Halo glow
    const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r * 2.1);
    glow.addColorStop(0, spec.glowColor);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.1, 0, Math.PI * 2);
    ctx.fill();

    const sides = p.kind === 'ruby' ? 4 : p.kind === 'cyan' ? 6 : 8;
    drawPolygon(ctx, p.x, p.y, r, sides, p.rot);
    ctx.fillStyle = spec.color;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#fff5dc';
    ctx.stroke();

    // Inner crystal facet
    drawPolygon(ctx, p.x, p.y, r * 0.54, sides, -p.rot * 1.2);
    ctx.fillStyle = spec.coreColor;
    ctx.fill();

    // Durability arc
    const durPct = Math.max(0, p.durability / Math.max(1, p.maxDurability));
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * durPct);
    ctx.strokeStyle = spec.color;
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }
}

function renderEntitiesAndBeams(ctx, world, effects) {
  // Glass shard pickups
  for (const s of world.shards) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5.5, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-5.5, 0);
    ctx.closePath();
    ctx.fillStyle = '#ffe27a';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  // Siphon Moth drain tethers
  for (const e of world.enemies) {
    if (e.kind === 'siphon' && world.prisms.length > 0) {
      let nearest = null;
      let bestD = 62;
      for (const p of world.prisms) {
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < bestD) {
          bestD = d;
          nearest = p;
        }
      }
      if (nearest) {
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(nearest.x, nearest.y);
        ctx.strokeStyle = 'rgba(232, 122, 255, 0.72)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }

  // Cryo Pylons & protective icy tethers to Boss Vespera
  for (const pylon of world.pylons) {
    if (world.boss) {
      ctx.save();
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(pylon.x, pylon.y);
      ctx.lineTo(world.boss.x, world.boss.y);
      ctx.strokeStyle = 'rgba(140, 232, 255, 0.58)';
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.restore();
    }

    drawPolygon(ctx, pylon.x, pylon.y, pylon.radius, 6, pylon.pulse * 0.25);
    ctx.fillStyle = pylon.hitFlash > 0 ? '#ffffff' : '#3a86ff';
    ctx.fill();
    ctx.strokeStyle = '#caf0f8';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    drawPolygon(ctx, pylon.x, pylon.y, pylon.radius * 0.5, 3, -pylon.pulse * 0.4);
    ctx.fillStyle = '#e0fbfc';
    ctx.fill();
  }

  // Enemies
  for (const e of world.enemies) {
    const fill = e.hitFlash > 0 ? '#ffffff' : e.color;
    ctx.save();
    ctx.translate(e.x, e.y);

    // Caster telegraph ring
    if (e.telegraphTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 8 * (e.telegraphTimer / 0.55), 0, Math.PI * 2);
      ctx.strokeStyle = '#ff6384';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.rotate(e.facing);
    if (e.kind === 'skitterer' || e.kind === 'mite') {
      ctx.beginPath();
      ctx.moveTo(e.radius * 1.15, 0);
      ctx.lineTo(-e.radius * 0.85, e.radius * 0.82);
      ctx.lineTo(-e.radius * 0.45, 0);
      ctx.lineTo(-e.radius * 0.85, -e.radius * 0.82);
      ctx.closePath();
    } else if (e.kind === 'bulwark') {
      drawPolygon(ctx, 0, 0, e.radius, 5, 0);
    } else if (e.kind === 'caster') {
      drawPolygon(ctx, 0, 0, e.radius, 4, 0);
    } else {
      drawPolygon(ctx, 0, 0, e.radius, 6, 0);
    }
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = e.trim;
    ctx.stroke();

    //Crimson weak core
    ctx.beginPath();
    ctx.arc(-2, 0, e.radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#1d1e2c';
    ctx.fill();

    // Directional brass-ice shield arc on Slag Bulwark
    if (e.shieldHalfArc > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 5, -e.shieldHalfArc, e.shieldHalfArc);
      ctx.strokeStyle = '#ffd24c';
      ctx.lineWidth = 4.5;
      ctx.stroke();
    }
    ctx.restore();

    // Health bar for damaged tougher foes
    if (e.hp < e.maxHp && e.maxHp >= 35) {
      const bw = e.radius * 2;
      ctx.fillStyle = 'rgba(8, 12, 22, 0.85)';
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 10, bw, 4);
      ctx.fillStyle = '#6fffe9';
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 10, bw * (e.hp / e.maxHp), 4);
    }
  }

  // Boss Vespera, The Rime Sovereign
  if (world.boss && world.boss.hp > 0) {
    const b = world.boss;

    // Phase 3 sweep telegraph or beam
    if (b.sweepState === 'telegraph') {
      ctx.save();
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + Math.cos(b.sweepAngle) * 460, b.y + Math.sin(b.sweepAngle) * 460);
      ctx.strokeStyle = 'rgba(255, 77, 109, 0.85)';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    } else if (b.sweepState === 'firing') {
      const ex = b.x + Math.cos(b.sweepAngle) * 460;
      const ey = b.y + Math.sin(b.sweepAngle) * 460;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = 'rgba(140, 232, 255, 0.65)';
      ctx.lineWidth = 18;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    }

    // Boss crown body
    const bossGlow = ctx.createRadialGradient(b.x, b.y, 6, b.x, b.y, b.radius * 2.1);
    bossGlow.addColorStop(0, 'rgba(140, 232, 255, 0.55)');
    bossGlow.addColorStop(1, 'rgba(140, 232, 255, 0)');
    ctx.fillStyle = bossGlow;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 2.1, 0, Math.PI * 2);
    ctx.fill();

    drawPolygon(ctx, b.x, b.y, b.radius, 8, b.orbitAngle * 1.4);
    ctx.fillStyle = b.hitFlash > 0 ? '#ffffff' : '#7b61ff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#dcfbff';
    ctx.stroke();

    drawPolygon(ctx, b.x, b.y, b.radius * 0.58, 4, -b.orbitAngle * 2);
    ctx.fillStyle = '#8ce8ff';
    ctx.fill();

    // Rotating Glacial Aegis arcs & phase-transition ward shimmer
    if (b.phaseGuardTimer > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius + 13, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(140, 232, 255, 0.88)';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    } else if (world.pylons.length === 0) {
      for (const base of [b.shieldAngle, b.shieldAngle + Math.PI]) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + 9, base - 0.5, base + 0.5);
        ctx.strokeStyle = '#caf0f8';
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    }
  }

  // Enemy Frost Orbs
  for (const orb of world.enemyProjectiles) {
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#9bf6ff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff4d6d';
    ctx.stroke();
  }

  // Dash afterimages
  for (const g of effects.afterimages) {
    const alpha = (g.life / g.maxLife) * 0.48;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.angle);
    ctx.globalAlpha = alpha;
    drawPolygon(ctx, 0, 0, 14, 3, 0);
    ctx.fillStyle = g.color;
    ctx.fill();
    ctx.restore();
  }

  // Weaver player vessel
  const p = world.player;
  const blinkSkip = p.invulnTimer > 0 && Math.floor(world.time * 18) % 2 === 0;
  if (!blinkSkip) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 12);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, -12);
    ctx.closePath();
    ctx.fillStyle = '#ffd166';
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#fff9e6';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(2, 0, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#18e4ff';
    ctx.fill();
    ctx.restore();
  }

  // Primary Ember Bolts & Refracted Laser Beams (additive blend)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (const b of world.bolts) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(b.angle) * 18, b.y - Math.sin(b.angle) * 18);
    ctx.strokeStyle = '#ff9f1c';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff8e1';
    ctx.fill();
  }

  for (const beam of effects.beams) {
    const t = beam.life / beam.maxLife;
    ctx.lineCap = 'round';
    ctx.globalAlpha = t * 0.55;
    ctx.beginPath();
    ctx.moveTo(beam.x1, beam.y1);
    ctx.lineTo(beam.x2, beam.y2);
    ctx.strokeStyle = beam.color;
    ctx.lineWidth = beam.width * 2.8;
    ctx.stroke();

    ctx.globalAlpha = t;
    ctx.lineWidth = beam.width;
    ctx.strokeStyle = beam.color;
    ctx.stroke();

    ctx.lineWidth = Math.max(1.8, beam.width * 0.42);
    ctx.strokeStyle = beam.coreColor;
    ctx.stroke();
  }

  for (const sw of effects.shockwaves) {
    ctx.globalAlpha = Math.max(0, sw.life / sw.maxLife);
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.strokeStyle = sw.color;
    ctx.lineWidth = sw.width;
    ctx.stroke();
  }

  // Stained-glass shatter shards
  for (const pt of effects.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.translate(pt.x, pt.y);
    ctx.rotate(pt.rot);
    if (pt.faceted) {
      ctx.beginPath();
      ctx.moveTo(0, -pt.size);
      ctx.lineTo(pt.size * 0.75, 0);
      ctx.lineTo(0, pt.size);
      ctx.lineTo(-pt.size * 0.75, 0);
      ctx.closePath();
      ctx.fillStyle = pt.color;
      ctx.fill();
    } else {
      ctx.fillStyle = pt.color;
      ctx.fillRect(-pt.size * 0.5, -pt.size * 0.5, pt.size, pt.size);
    }
    ctx.restore();
  }
  ctx.restore();

  // Floating score & tactical callouts
  for (const c of effects.callouts) {
    const alpha = Math.min(1, (c.life / c.maxLife) * 1.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `900 ${Math.round(15 * c.scale)}px "Avenir Next", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(6, 9, 17, 0.92)';
    ctx.strokeText(c.text, c.x, c.y);
    ctx.fillStyle = c.color;
    ctx.fillText(c.text, c.x, c.y);
    ctx.restore();
  }
}

function renderCrosshair(ctx, world, inputState) {
  if (world.mode !== 'playing' || !inputState.usingPointer) return;
  const { aimX, aimY } = inputState;
  const activeSpec = PRISM_SPECS[PRISM_ORDER[world.selectedPrismIndex % PRISM_ORDER.length]];
  ctx.save();
  ctx.beginPath();
  ctx.arc(aimX, aimY, 11, 0, Math.PI * 2);
  ctx.strokeStyle = activeSpec.color;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(aimX, aimY, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff9e6';
  ctx.fill();
  ctx.restore();
}

function renderWingHud(ctx, world, saveData, audioMuted) {
  ctx.save();
  if (world.mode !== 'playing') {
    ctx.globalAlpha = 0.22;
  }
  const panelFill = 'rgba(13, 19, 34, 0.88)';
  const panelBorder = 'rgba(214, 164, 86, 0.42)';

  // ================= LEFT WING HUD (x = 20..308) =================
  const lx = 20;
  const lw = 288;

  // 1. Heart-Lantern Integrity Card
  drawRoundedPanel(ctx, lx, 20, lw, 84, 11);
  ctx.fillStyle = panelFill;
  ctx.fill();
  ctx.strokeStyle = panelBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const lanternPct = Math.max(0, world.lanternHp / Math.max(1, world.lanternMaxHp));
  ctx.fillStyle = '#f4c979';
  ctx.font = '800 20px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText('INTEGRITY', lx + 14, 42);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff6df';
  ctx.font = '900 22px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(`${Math.ceil(world.lanternHp)} / ${world.lanternMaxHp}`, lx + lw - 14, 43);
  ctx.textAlign = 'left';

  drawRoundedPanel(ctx, lx + 14, 54, lw - 28, 16, 8);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.fill();
  if (lanternPct > 0) {
    drawRoundedPanel(ctx, lx + 14, 54, Math.max(10, (lw - 28) * lanternPct), 16, 8);
    const barGrad = ctx.createLinearGradient(lx + 14, 0, lx + lw - 14, 0);
    barGrad.addColorStop(0, lanternPct > 0.35 ? '#ff9f1c' : '#ff3e6c');
    barGrad.addColorStop(1, lanternPct > 0.35 ? '#ffe17d' : '#ff758f');
    ctx.fillStyle = barGrad;
    ctx.fill();
  }
  ctx.fillStyle = '#a9b4d0';
  ctx.font = '600 11px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText('Defend center flame from rime foes', lx + 14, 90);

  // 2. Weaver Hull & Dash Status Card
  drawRoundedPanel(ctx, lx, 116, lw, 76, 11);
  ctx.fillStyle = panelFill;
  ctx.fill();
  ctx.strokeStyle = panelBorder;
  ctx.stroke();

  ctx.fillStyle = '#f4c979';
  ctx.font = '800 11.5px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText('WEAVER HULL', lx + 14, 138);

  const dashReady = world.player.dashCooldown <= 0;
  ctx.textAlign = 'right';
  ctx.fillStyle = dashReady ? '#38e2b2' : '#9aa6c4';
  ctx.font = '800 11px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(dashReady ? 'DASH READY [SPACE]' : 'DASH RECHARGING', lx + lw - 14, 138);
  ctx.textAlign = 'left';

  for (let i = 0; i < world.player.maxHp; i++) {
    const hx = lx + 24 + i * 34;
    const hy = 165;
    drawPolygon(ctx, hx, hy, 11, 4, 0);
    ctx.fillStyle = i < world.player.hp ? '#ff4d6d' : 'rgba(255, 255, 255, 0.1)';
    ctx.fill();
    ctx.strokeStyle = i < world.player.hp ? '#ffd4e0' : 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // 3. Stained-Glass Prism Charges & Attunement Card
  drawRoundedPanel(ctx, lx, 204, lw, 114, 11);
  ctx.fillStyle = panelFill;
  ctx.fill();
  ctx.strokeStyle = panelBorder;
  ctx.stroke();

  ctx.fillStyle = '#f4c979';
  ctx.font = '800 16px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText('PRISMS [E]', lx + 14, 226);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff6df';
  ctx.font = '800 16px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(`${world.prisms.length}/${world.mods.maxPrisms} ACTIVE`, lx + lw - 14, 226);
  ctx.textAlign = 'left';

  // Charge bars
  const maxC = world.maxPrismCharges;
  const segW = (lw - 28 - (maxC - 1) * 6) / maxC;
  for (let i = 0; i < maxC; i++) {
    const fillAmt = Math.max(0, Math.min(1, world.prismCharges - i));
    const sx = lx + 14 + i * (segW + 6);
    drawRoundedPanel(ctx, sx, 236, segW, 12, 5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();
    if (fillAmt > 0) {
      drawRoundedPanel(ctx, sx, 236, Math.max(6, segW * fillAmt), 12, 5);
      ctx.fillStyle = fillAmt >= 1 ? '#18e4ff' : 'rgba(24, 228, 255, 0.45)';
      ctx.fill();
    }
  }

  // Attunement pills [1] Ruby [2] Cyan [3] Topaz
  PRISM_ORDER.forEach((kind, idx) => {
    const spec = PRISM_SPECS[kind];
    const pw = (lw - 36) / 3;
    const px = lx + 14 + idx * (pw + 4);
    const py = 262;
    const selected = world.selectedPrismIndex % 3 === idx;
    drawRoundedPanel(ctx, px, py, pw, 40, 7);
    ctx.fillStyle = selected ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.04)';
    ctx.fill();
    ctx.strokeStyle = selected ? spec.color : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();

    ctx.fillStyle = spec.color;
    ctx.font = '800 11px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText(`[${idx + 1}] ${spec.shortLabel}`, px + 8, py + 18);
    ctx.fillStyle = '#cbd5ee';
    ctx.font = '600 9.5px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText(kind === 'ruby' ? '3-Way Fan' : kind === 'cyan' ? 'Arc + Slow' : 'Nova Ring', px + 8, py + 32);
  });

  // 4. Kiln Supernova Overdrive Card
  const novaReady = world.novaCharge >= 100;
  drawRoundedPanel(ctx, lx, 330, lw, 76, 11);
  ctx.fillStyle = panelFill;
  ctx.fill();
  ctx.strokeStyle = novaReady ? '#ffd24c' : panelBorder;
  ctx.lineWidth = novaReady ? 2.2 : 1.5;
  ctx.stroke();

  ctx.fillStyle = novaReady ? '#ffe27a' : '#f4c979';
  ctx.font = '800 16px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText('SUPERNOVA [F]', lx + 14, 352);
  ctx.textAlign = 'right';
  ctx.fillStyle = novaReady ? '#38e2b2' : '#fff6df';
  ctx.font = '900 13px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(novaReady ? 'READY' : `${Math.floor(world.novaCharge)}%`, lx + lw - 14, 352);
  ctx.textAlign = 'left';

  drawRoundedPanel(ctx, lx + 14, 364, lw - 28, 14, 7);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.fill();
  if (world.novaCharge > 0) {
    drawRoundedPanel(ctx, lx + 14, 364, Math.max(8, ((lw - 28) * world.novaCharge) / 100), 14, 7);
    ctx.fillStyle = novaReady ? '#ffd24c' : '#ff3e6c';
    ctx.fill();
  }
  ctx.fillStyle = '#a9b4d0';
  ctx.font = '600 10.5px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText('Links all Prisms into a star-web blast', lx + 14, 396);

  // 5. Controls Legend Card (Bottom-Left)
  drawRoundedPanel(ctx, lx, 556, lw, 144, 11);
  ctx.fillStyle = panelFill;
  ctx.fill();
  ctx.strokeStyle = panelBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#f4c979';
  ctx.font = '800 11.5px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText('CONTROLS', lx + 14, 578);

  const controlsList = [
    ['WASD / Arrows', 'Move Weaver'],
    ['Left Click', 'Fire Ember Bolt'],
    ['Right Click / E', 'Deploy Prism'],
    ['Space / Shift', 'Phase Dash'],
    ['Q / F / P', 'Recall · Nova · Pause'],
  ];
  controlsList.forEach(([k, v], i) => {
    const cy = 600 + i * 21;
    ctx.fillStyle = '#ffe5ad';
    ctx.font = '800 11px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText(k, lx + 14, cy);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#b6bfd8';
    ctx.font = '600 11px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText(v, lx + lw - 14, cy);
    ctx.textAlign = 'left';
  });

  // ================= RIGHT WING HUD (x = 972..1260) =================
  const rx = 972;
  const rw = 288;

  // 1. Score & High Score Card
  drawRoundedPanel(ctx, rx, 20, rw, 94, 11);
  ctx.fillStyle = panelFill;
  ctx.fill();
  ctx.strokeStyle = panelBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const diffLabel = (DIFFICULTY_MODES[world.difficulty]?.label || 'Artisan').toUpperCase();
  ctx.fillStyle = '#f4c979';
  ctx.font = '800 11.5px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(`SCORE · ${diffLabel}`, rx + 14, 42);

  ctx.fillStyle = '#fff8e6';
  ctx.font = '900 42px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(world.score.toLocaleString('en-US'), rx + 14, 78);

  const liveBest = Math.max(saveData.bestScore || 0, world.score);
  ctx.fillStyle = '#a9b4d0';
  ctx.font = '700 11.5px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(`BEST: ${liveBest.toLocaleString('en-US')}`, rx + 14, 101);

  // 2. Resonance Combo Medallion Card
  const hotCombo = world.combo >= 4;
  drawRoundedPanel(ctx, rx, 126, rw, 84, 11);
  ctx.fillStyle = panelFill;
  ctx.fill();
  ctx.strokeStyle = hotCombo ? '#18e4ff' : panelBorder;
  ctx.lineWidth = hotCombo ? 2 : 1.5;
  ctx.stroke();

  ctx.fillStyle = '#f4c979';
  ctx.font = '800 18px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText('RESONANCE', rx + 14, 148);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#9aa6c4';
  ctx.font = '700 10.5px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(`STREAK ${world.combo}/12`, rx + rw - 14, 148);
  ctx.textAlign = 'left';

  ctx.fillStyle = world.combo >= 8 ? '#ffd24c' : world.combo >= 4 ? '#18e4ff' : '#e6ecf8';
  ctx.font = '900 38px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(formatComboMultiplier(world.combo), rx + 14, 182);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#b6bfd8';
  ctx.font = '700 11.5px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(`PEAK ${formatComboMultiplier(world.stats.maxCombo)}`, rx + rw - 14, 182);
  ctx.textAlign = 'left';

  const comboPct = world.combo > 1 ? Math.max(0, world.comboTimer / 4.2) : 0;
  drawRoundedPanel(ctx, rx + 14, 193, rw - 28, 7, 4);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.fill();
  if (comboPct > 0) {
    drawRoundedPanel(ctx, rx + 14, 193, Math.max(6, (rw - 28) * comboPct), 7, 4);
    ctx.fillStyle = '#18e4ff';
    ctx.fill();
  }

  // 3. Trial Progress Card
  const waveDef = TRIAL_WAVES[world.trialIndex - 1] || TRIAL_WAVES[0];
  drawRoundedPanel(ctx, rx, 222, rw, 94, 11);
  ctx.fillStyle = panelFill;
  ctx.fill();
  ctx.strokeStyle = panelBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#f4c979';
  ctx.font = '800 11.5px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(`TRIAL ${world.trialIndex} OF ${TRIAL_WAVES.length}`, rx + 14, 244);

  const mins = String(Math.floor(world.runTime / 60)).padStart(2, '0');
  const secs = String(Math.floor(world.runTime % 60)).padStart(2, '0');
  ctx.textAlign = 'right';
  ctx.fillStyle = '#d9e2f8';
  ctx.font = '700 12px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(`${mins}:${secs}`, rx + rw - 14, 244);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#fff6df';
  ctx.font = '800 15px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(waveDef.title, rx + 14, 268);

  let waveProg = 1;
  if (waveDef.isBossTrial) {
    waveProg = world.boss ? 1 - world.boss.hp / world.boss.maxHp : 1;
  } else if (world.totalTrialEnemies > 0) {
    const remaining = world.spawnQueue.length + world.enemies.length;
    waveProg = Math.max(0, 1 - remaining / world.totalTrialEnemies);
  }

  drawRoundedPanel(ctx, rx + 14, 282, rw - 28, 12, 6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.fill();
  if (waveProg > 0) {
    drawRoundedPanel(ctx, rx + 14, 282, Math.max(8, (rw - 28) * waveProg), 12, 6);
    ctx.fillStyle = waveDef.isBossTrial ? '#ff3e6c' : '#38e2b2';
    ctx.fill();
  }
  ctx.fillStyle = '#a9b4d0';
  ctx.font = '600 10.5px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(
    waveDef.isBossTrial
      ? world.pylons.length > 0
        ? `Destroy ${world.pylons.length} Cryo Pylons to pierce shield!`
        : 'Shatter The Rime Sovereign!'
      : `Foes shattered: ${world.stats.enemiesShattered} · Beams: ${world.stats.beamsRefracted}`,
    rx + 14,
    308,
  );

  // 4. Forged Temperings (Relics) Card
  drawRoundedPanel(ctx, rx, 328, rw, 168, 11);
  ctx.fillStyle = panelFill;
  ctx.fill();
  ctx.strokeStyle = panelBorder;
  ctx.stroke();

  ctx.fillStyle = '#f4c979';
  ctx.font = '800 11.5px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(`FORGED TEMPERINGS (${world.temperingIds.length})`, rx + 14, 350);

  if (world.temperingIds.length === 0) {
    ctx.fillStyle = '#8e9ab8';
    ctx.font = '600 11.5px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText('Clear each Trial to forge a', rx + 14, 378);
    ctx.fillText('permanent relic upgrade.', rx + 14, 396);
  } else {
    world.temperingIds.slice(0, 4).forEach((id, idx) => {
      const spec = TEMPERING_CATALOG.find((t) => t.id === id);
      if (!spec) return;
      const ty = 374 + idx * 29;
      drawRoundedPanel(ctx, rx + 12, ty - 15, rw - 24, 24, 6);
      ctx.fillStyle = 'rgba(24, 228, 255, 0.1)';
      ctx.fill();
      ctx.fillStyle = '#dcfbff';
      ctx.font = '700 11.5px "Avenir Next", "Segoe UI", sans-serif';
      ctx.fillText(`◆ ${spec.name}`, rx + 20, ty + 1);
    });
  }

  // 5. Audio & Pause Quick Pill (Bottom-Right)
  drawRoundedPanel(ctx, rx, 650, rw, 50, 11);
  ctx.fillStyle = panelFill;
  ctx.fill();
  ctx.strokeStyle = panelBorder;
  ctx.stroke();

  ctx.fillStyle = '#e5ecff';
  ctx.font = '700 12px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(audioMuted ? '[M] SOUND: MUTED' : '[M] SOUND: ON', rx + 16, 680);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f4c979';
  ctx.fillText('[P] PAUSE & CODEX', rx + rw - 16, 680);
  ctx.textAlign = 'left';

  // ================= TOP-CENTER BOSS OR TRIAL BANNER =================
  if (world.boss && world.boss.hp > 0) {
    const bw = 584;
    const bx = ARENA.centerX - bw / 2;
    const by = 8;
    drawRoundedPanel(ctx, bx, by, bw, 58, 10);
    ctx.fillStyle = 'rgba(18, 14, 34, 0.92)';
    ctx.fill();
    ctx.strokeStyle = '#ff6384';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = '#ffe5ec';
    ctx.font = '900 30px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText('VESPERA', bx + 16, by + 31);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8ce8ff';
    ctx.font = '900 28px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText(`PHASE ${world.boss.phase}/3`, bx + bw - 16, by + 31);
    ctx.textAlign = 'center';
    ctx.font = '700 12px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText(`${Math.ceil(world.boss.hp)} / ${world.boss.maxHp}`, ARENA.centerX, by + 29);
    ctx.textAlign = 'left';

    const bossPct = Math.max(0, world.boss.hp / world.boss.maxHp);
    drawRoundedPanel(ctx, bx + 16, by + 39, bw - 32, 11, 5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fill();
    drawRoundedPanel(ctx, bx + 16, by + 39, Math.max(8, (bw - 32) * bossPct), 11, 5);
    const bGrad = ctx.createLinearGradient(bx + 16, 0, bx + bw - 16, 0);
    bGrad.addColorStop(0, '#ff3e6c');
    bGrad.addColorStop(1, '#9b7ede');
    ctx.fillStyle = bGrad;
    ctx.fill();

    // 34% and 66% phase gate notches on Boss HP bar
    ctx.fillStyle = 'rgba(255, 246, 223, 0.85)';
    for (const gate of [0.34, 0.66]) {
      const gx = bx + 16 + (bw - 32) * gate;
      ctx.fillRect(gx - 1, by + 38, 2, 13);
    }
  } else if (world.mode === 'playing') {
    const bw = 580;
    const bx = ARENA.centerX - bw / 2;
    const by = 14;
    drawRoundedPanel(ctx, bx, by, bw, 38, 10);
    ctx.fillStyle = 'rgba(13, 19, 34, 0.88)';
    ctx.fill();
    ctx.strokeStyle = panelBorder;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe6b0';
    ctx.font = '800 12.5px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText(
      `TRIAL ${world.trialIndex}/${TRIAL_WAVES.length}: ${waveDef.title.toUpperCase()} — ${waveDef.subtitle}`,
      ARENA.centerX,
      by + 24,
      bw - 28,
    );
    ctx.textAlign = 'left';
  }

  ctx.restore();
}

// The title's rose window is original live Canvas geometry, built from the combat palette.
function renderTitleStainedGlass(ctx, world) {
  ctx.fillStyle = '#080d18';
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  const cx = 962, cy = 350, radius = 238;
  const halo = ctx.createRadialGradient(cx, cy, 40, cx, cy, 370);
  halo.addColorStop(0, '#253953'); halo.addColorStop(.65, '#111e32'); halo.addColorStop(1, '#080d18');
  ctx.fillStyle = halo; ctx.fillRect(650, 0, 630, 720);
  const colors = ['#e64b6b', '#ef9442', '#eac366', '#38bfc9', '#3c819d', '#a13e72'];
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = '#101827'; ctx.lineWidth = 5;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6 - Math.PI / 2;
    const b = a + Math.PI / 6;
    const mid = (a + b) / 2;
    const point = (angle, r) => [Math.cos(angle) * r, Math.sin(angle) * r];
    const polygons = [
      [point(a, 72), point(mid, 158), point(b, 72)],
      [point(a, 72), point(a, radius), point(mid, 158)],
      [point(b, 72), point(mid, 158), point(b, radius)],
      [point(a, radius), point(mid, 158), point(b, radius)],
    ];
    polygons.forEach((vertices, j) => {
      ctx.beginPath(); vertices.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
      ctx.fillStyle = colors[(i + j) % colors.length]; ctx.globalAlpha = j === 0 ? .95 : .62 + Math.sin(i * 3 + j) * .15;
      ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(...vertices[0]); ctx.lineTo(...vertices[1]);
      ctx.strokeStyle = 'rgba(255, 239, 196, .28)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = '#101827'; ctx.lineWidth = 5;
    });
  }
  for (const r of [radius + 2, radius + 14, 73]) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.strokeStyle = '#d6ac67'; ctx.lineWidth = r === radius + 2 ? 4 : 1.5; ctx.stroke();
  }
  // The Heart-Lantern floats in the window's central, brass-set aperture.
  drawPolygon(ctx, 0, 0, 61, 8, Math.PI / 8); ctx.fillStyle = '#182339'; ctx.fill(); ctx.strokeStyle = '#f4c979'; ctx.lineWidth = 3; ctx.stroke();
  const pulse = 1 + Math.sin(world.time * 2) * .025;
  drawPolygon(ctx, 0, 0, 44 * pulse, 4, 0); ctx.fillStyle = '#ffb849'; ctx.fill();
  drawPolygon(ctx, 0, 0, 24, 4, 0); ctx.fillStyle = '#fff2cd'; ctx.fill();
  ctx.restore();
  ctx.font = '700 12px "Avenir Next", "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#c6a574';
  ctx.fillText('THE HEART-LANTERN', cx, 652);
  ctx.font = '500 11px "Avenir Next", "Segoe UI", sans-serif'; ctx.fillStyle = '#8f9eba';
  ctx.fillText('A flame worth defending.', cx, 674); ctx.textAlign = 'left';
}

export function renderGameFrame(ctx, world, effects, inputState, saveData, audioMuted) {
  if (world.mode === 'title') { renderTitleStainedGlass(ctx, world); return; }
  ctx.save();
  ctx.translate(effects.shakeX, effects.shakeY);

  renderCrucibleArena(ctx, world);
  renderPrismNetworkAndGhost(ctx, world, inputState);
  renderEntitiesAndBeams(ctx, world, effects);
  renderCrosshair(ctx, world, inputState);

  ctx.restore();

  if (effects.flashAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = effects.flashAlpha;
    ctx.fillStyle = effects.flashColor;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.restore();
  }

  renderWingHud(ctx, world, saveData, audioMuted);
}
