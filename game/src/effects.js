// Visual feedback system: stained-glass shards, laser beam trails, shockwaves, hit-stop, and callouts.

export function createEffectsSystem(rng) {
  const particles = [];
  const beams = [];
  const shockwaves = [];
  const callouts = [];
  const afterimages = [];

  let shakeMag = 0;
  let shakeX = 0;
  let shakeY = 0;
  let hitStopTimer = 0;
  let flashAlpha = 0;
  let flashColor = '#ffd24c';

  function spawnGlassShards(x, y, color, count = 12, speedScale = 1) {
    const cap = Math.min(count, 32);
    for (let i = 0; i < cap; i++) {
      if (particles.length > 420) particles.shift();
      const angle = rng.range(0, Math.PI * 2);
      const speed = rng.range(55, 240) * speedScale;
      const life = rng.range(0.28, 0.68);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: rng.range(0, Math.PI * 2),
        vrot: rng.range(-9, 9),
        size: rng.range(3.5, 8.5),
        color,
        life,
        maxLife: life,
        faceted: rng.chance(0.68),
      });
    }
  }

  function addBeamRibbon(x1, y1, x2, y2, color, coreColor = '#ffffff', width = 5, duration = 0.24) {
    if (beams.length > 90) beams.shift();
    beams.push({
      x1,
      y1,
      x2,
      y2,
      color,
      coreColor,
      width,
      life: duration,
      maxLife: duration,
    });
  }

  function addShockwave(x, y, maxRadius, color, width = 3.5, duration = 0.34) {
    if (shockwaves.length > 36) shockwaves.shift();
    shockwaves.push({
      x,
      y,
      radius: 8,
      maxRadius,
      color,
      width,
      life: duration,
      maxLife: duration,
    });
  }

  function addCallout(rawX, rawY, text, color = '#ffe599', scale = 1.0) {
    while (callouts.length >= 6) callouts.shift();
    const x = Math.max(430, Math.min(850, rawX));
    let adjustedY = Math.max(96, Math.min(610, rawY));
    for (const existing of callouts) {
      if (Math.abs(existing.x - x) < 110 && Math.abs(existing.y - adjustedY) < 24) {
        adjustedY -= 24;
      }
    }
    callouts.push({
      x,
      y: Math.max(88, adjustedY),
      vy: -34,
      text,
      color,
      scale,
      life: 0.78,
      maxLife: 0.78,
    });
  }

  function addDashGhost(x, y, angle, color = '#18e4ff') {
    afterimages.push({
      x,
      y,
      angle,
      color,
      life: 0.22,
      maxLife: 0.22,
    });
  }

  function triggerShake(amount) {
    shakeMag = Math.min(14, Math.max(shakeMag, amount));
  }

  function triggerHitStop(seconds) {
    hitStopTimer = Math.max(hitStopTimer, Math.min(0.055, seconds));
  }

  function triggerScreenFlash(color = '#ffd24c', alpha = 0.22) {
    flashColor = color;
    flashAlpha = Math.max(flashAlpha, Math.min(0.38, alpha));
  }

  function consumeHitStop(dt) {
    if (hitStopTimer > 0) {
      hitStopTimer = Math.max(0, hitStopTimer - dt);
      updateVisualDecayOnly(dt * 0.35);
      return true;
    }
    return false;
  }

  function updateVisualDecayOnly(dt) {
    if (shakeMag > 0.1) {
      shakeX = rng.range(-shakeMag, shakeMag);
      shakeY = rng.range(-shakeMag, shakeMag);
      shakeMag *= Math.pow(0.04, dt);
    } else {
      shakeMag = 0;
      shakeX = 0;
      shakeY = 0;
    }
    if (flashAlpha > 0) {
      flashAlpha = Math.max(0, flashAlpha - dt * 1.15);
    }
  }

  function update(dt) {
    updateVisualDecayOnly(dt);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.14, dt);
      p.vy *= Math.pow(0.14, dt);
      p.rot += p.vrot * dt;
    }

    for (let i = beams.length - 1; i >= 0; i--) {
      beams[i].life -= dt;
      if (beams[i].life <= 0) beams.splice(i, 1);
    }

    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const s = shockwaves[i];
      s.life -= dt;
      if (s.life <= 0) {
        shockwaves.splice(i, 1);
        continue;
      }
      const t = 1 - s.life / s.maxLife;
      s.radius = 8 + (s.maxRadius - 8) * (1 - Math.pow(1 - t, 2.4));
    }

    for (let i = callouts.length - 1; i >= 0; i--) {
      const c = callouts[i];
      c.life -= dt;
      if (c.life <= 0) {
        callouts.splice(i, 1);
        continue;
      }
      c.y += c.vy * dt;
      c.vy *= Math.pow(0.35, dt);
    }

    for (let i = afterimages.length - 1; i >= 0; i--) {
      afterimages[i].life -= dt;
      if (afterimages[i].life <= 0) afterimages.splice(i, 1);
    }
  }

  function clearAll() {
    particles.length = 0;
    beams.length = 0;
    shockwaves.length = 0;
    callouts.length = 0;
    afterimages.length = 0;
    shakeMag = 0;
    shakeX = 0;
    shakeY = 0;
    hitStopTimer = 0;
    flashAlpha = 0;
  }

  return {
    particles,
    beams,
    shockwaves,
    callouts,
    afterimages,
    get shakeX() { return shakeX; },
    get shakeY() { return shakeY; },
    get flashAlpha() { return flashAlpha; },
    get flashColor() { return flashColor; },
    spawnGlassShards,
    addBeamRibbon,
    addShockwave,
    addCallout,
    addDashGhost,
    triggerShake,
    triggerHitStop,
    triggerScreenFlash,
    consumeHitStop,
    update,
    clearAll,
  };
}
