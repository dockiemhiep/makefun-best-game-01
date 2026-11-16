// Procedural WebAudio glass-harp & brass resonance synthesizer + generative kiln score.

const DORIAN_SCALE_HZ = [
  293.66, // D4
  329.63, // E4
  349.23, // F4
  392.00, // G4
  440.00, // A4
  493.88, // B4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  698.46, // F5
  783.99, // G5
  880.00, // A5
  1046.50, // C6
  1174.66, // D6
];

export function createSoundEngine() {
  let ctx = null;
  let masterGain = null;
  let muted = false;
  let musicClock = 0;
  let musicStep = 0;

  function ensureContext() {
    if (muted) return null;
    if (!ctx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      try {
        ctx = new AudioCtor();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.26;
        masterGain.connect(ctx.destination);
      } catch {
        ctx = null;
        return null;
      }
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function tone(freq, duration, type = 'triangle', volume = 0.22, slideTo = null, delay = 0) {
    const ac = ensureContext();
    if (!ac || !masterGain) return;
    try {
      const t0 = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(40, freq), t0);
      if (slideTo !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + duration);
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch {
      // Ignore WebAudio scheduling edge cases in restricted headless contexts
    }
  }

  function playBoltFire() {
    tone(520, 0.085, 'triangle', 0.14, 280);
    tone(1040, 0.05, 'sine', 0.07, 680);
  }

  function playPrismDeploy(kind) {
    const base = kind === 'ruby' ? 587.33 : kind === 'cyan' ? 659.25 : 783.99;
    tone(base, 0.18, 'sine', 0.2);
    tone(base * 1.5, 0.22, 'triangle', 0.14, null, 0.035);
  }

  function playPrismRefract(bounceDepth, kind) {
    const idx = Math.min(DORIAN_SCALE_HZ.length - 1, 5 + bounceDepth * 2);
    const freq = DORIAN_SCALE_HZ[idx];
    const harmonic = kind === 'cyan' ? 2.0 : 1.5;
    tone(freq, 0.2, 'sine', 0.21);
    tone(freq * harmonic, 0.16, 'triangle', 0.11, freq * harmonic * 1.04, 0.02);
  }

  function playArmorRicochet() {
    tone(240, 0.09, 'sawtooth', 0.14, 155);
  }

  function playEnemyShatter(isHeavy = false) {
    if (isHeavy) {
      tone(196, 0.22, 'sawtooth', 0.2, 92);
      tone(659.25, 0.18, 'triangle', 0.16, 987.77, 0.02);
    } else {
      tone(740, 0.11, 'triangle', 0.14, 1120);
      tone(310, 0.1, 'sine', 0.12, 160);
    }
  }

  function playShardCollect(combo) {
    const idx = Math.min(DORIAN_SCALE_HZ.length - 1, 6 + (combo % 7));
    tone(DORIAN_SCALE_HZ[idx], 0.1, 'sine', 0.12, DORIAN_SCALE_HZ[idx] * 1.25);
  }

  function playDash() {
    tone(320, 0.13, 'sine', 0.16, 760);
  }

  function playSupernova() {
    [293.66, 440, 587.33, 880, 1174.66].forEach((f, i) => {
      tone(f, 0.45, 'triangle', 0.18, f * 1.02, i * 0.045);
    });
  }

  function playHurt() {
    tone(165, 0.26, 'sawtooth', 0.24, 78);
  }

  function playBossPhase() {
    tone(146.83, 0.5, 'sawtooth', 0.22, 110);
    tone(440, 0.38, 'triangle', 0.18, 587.33, 0.08);
  }

  function playTemperingPick() {
    tone(587.33, 0.18, 'sine', 0.2);
    tone(783.99, 0.22, 'sine', 0.18, null, 0.06);
    tone(1174.66, 0.28, 'triangle', 0.16, null, 0.12);
  }

  function playVictoryFanfare() {
    [587.33, 739.99, 880, 1174.66].forEach((f, i) => {
      tone(f, 0.42, 'triangle', 0.2, null, i * 0.1);
    });
  }

  function playDefeatToll() {
    [349.23, 329.63, 293.66, 220].forEach((f, i) => {
      tone(f, 0.36, 'sawtooth', 0.16, f * 0.96, i * 0.11);
    });
  }

  function updateMusic(dt, isPlaying, intensity = 0.4) {
    if (muted || !isPlaying || !ctx || ctx.state !== 'running') return;
    const stepInterval = Math.max(0.24, 0.42 - intensity * 0.12);
    musicClock += dt;
    if (musicClock >= stepInterval) {
      musicClock -= stepInterval;
      const pattern = [0, 4, 7, 5, 3, 7, 8, 4];
      const noteIdx = pattern[musicStep % pattern.length];
      if (musicStep % 4 === 0) {
        tone(146.83, stepInterval * 1.5, 'sine', 0.065);
      }
      tone(DORIAN_SCALE_HZ[noteIdx], stepInterval * 0.85, 'sine', 0.038 + intensity * 0.02);
      musicStep = (musicStep + 1) % 32;
    }
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  function setMuted(flag) {
    muted = Boolean(flag);
  }

  return {
    get muted() { return muted; },
    unlock: ensureContext,
    toggleMute,
    setMuted,
    playBoltFire,
    playPrismDeploy,
    playPrismRefract,
    playArmorRicochet,
    playEnemyShatter,
    playShardCollect,
    playDash,
    playSupernova,
    playHurt,
    playBossPhase,
    playTemperingPick,
    playVictoryFanfare,
    playDefeatToll,
    updateMusic,
  };
}
