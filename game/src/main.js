// EMBERGLASS main bootstrap: fixed 60 Hz simulation step, persistence, and state orchestration.

import { computeComboMultiplier, formatComboMultiplier } from './config.js';
import { createInputController } from './input.js';
import { createSoundEngine } from './audio.js';
import { createEffectsSystem } from './effects.js';
import {
  bufferCombatActions,
  chooseTemperingUpgrade,
  computeRunStars,
  createWorldState,
  setupTitleAttractScene,
  startNewRun,
  stepWorldSimulation,
} from './world.js';
import { renderGameFrame } from './render.js';
import { createOverlayUI } from './ui.js';

const SAVE_STORAGE_KEY = 'emberglass.save.v1';
const FIXED_DT = 1 / 60;

function loadSaveData() {
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return { bestScore: 0, bestStars: 0, difficulty: 'artisan', muted: false };
    const parsed = JSON.parse(raw);
    return {
      bestScore: Number(parsed.bestScore) || 0,
      bestStars: Number(parsed.bestStars) || 0,
      difficulty: typeof parsed.difficulty === 'string' ? parsed.difficulty : 'artisan',
      muted: Boolean(parsed.muted),
    };
  } catch {
    return { bestScore: 0, bestStars: 0, difficulty: 'artisan', muted: false };
  }
}

function persistSaveData(save) {
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Ignore private-browsing storage restrictions
  }
}

function bootstrapEmberglass() {
  const canvas = document.getElementById('game-canvas');
  const overlayRoot = document.getElementById('overlay-root');
  const ctx = canvas.getContext('2d');

  const saveData = loadSaveData();
  const params = new URLSearchParams(window.location.search);
  const urlSeed = Number(params.get('seed')) || 20261116;

  const world = createWorldState(urlSeed);
  world.difficulty = saveData.difficulty;

  const effects = createEffectsSystem(world.rng);
  const audio = createSoundEngine();
  audio.setMuted(saveData.muted);
  const input = createInputController(canvas);

  function recordRunCompletion() {
    if (world.score > saveData.bestScore) {
      saveData.bestScore = world.score;
      world.isNewBest = true;
    }
    const stars = computeRunStars(world);
    if (stars > saveData.bestStars) {
      saveData.bestStars = stars;
    }
    persistSaveData(saveData);
  }

  const ui = createOverlayUI(overlayRoot, {
    onSelectDifficulty(diffId) {
      audio.unlock();
      world.difficulty = diffId;
      saveData.difficulty = diffId;
      persistSaveData(saveData);
      ui.forceRefresh();
      ui.sync(world, saveData, audio.muted);
    },
    onStartRun() {
      audio.unlock();
      const nextSeed = params.has('seed') ? Number(params.get('seed')) : undefined;
      startNewRun(world, world.difficulty, nextSeed, effects);
      ui.sync(world, saveData, audio.muted);
    },
    onPickTempering(temperingId) {
      audio.unlock();
      chooseTemperingUpgrade(world, temperingId, audio, effects);
      ui.sync(world, saveData, audio.muted);
    },
    onResume() {
      if (world.mode === 'paused') {
        world.mode = 'playing';
        ui.sync(world, saveData, audio.muted);
      }
    },
    onReturnTitle() {
      world.mode = 'title';
      effects.clearAll();
      setupTitleAttractScene(world);
      ui.sync(world, saveData, audio.muted);
    },
    onToggleMute() {
      const muted = audio.toggleMute();
      saveData.muted = muted;
      persistSaveData(saveData);
      ui.forceRefresh();
      ui.sync(world, saveData, audio.muted);
    },
    onRefreshUI() {
      ui.sync(world, saveData, audio.muted);
    },
  });

  function handleGlobalShortcuts(actions) {
    if (actions.mute) {
      saveData.muted = audio.toggleMute();
      persistSaveData(saveData);
      ui.forceRefresh();
    }

    if (world.mode === 'title') {
      if (actions.confirm) {
        audio.unlock();
        startNewRun(world, world.difficulty, params.has('seed') ? Number(params.get('seed')) : undefined, effects);
      }
      return;
    }

    if (world.mode === 'tempering') {
      if (actions.prismSelect !== null && world.draftChoices[actions.prismSelect]) {
        chooseTemperingUpgrade(world, world.draftChoices[actions.prismSelect].id, audio, effects);
        actions.prismSelect = null;
      }
      return;
    }

    if (world.mode === 'playing' && actions.pause) {
      world.mode = 'paused';
      return;
    }

    if (world.mode === 'paused') {
      if (actions.pause) {
        world.mode = 'playing';
      } else if (actions.restart) {
        startNewRun(world, world.difficulty, undefined, effects);
      }
      return;
    }

    if (world.mode === 'victory' || world.mode === 'gameover') {
      if (actions.restart || actions.confirm) {
        startNewRun(world, world.difficulty, undefined, effects);
      }
    }
  }

  function advanceOneFixedStep() {
    const wasPlaying = world.mode === 'playing';
    const actions = input.consumeFrameActions();
    if (wasPlaying) {
      bufferCombatActions(world, actions);
    }
    handleGlobalShortcuts(actions);

    stepWorldSimulation(world, actions, FIXED_DT, audio, effects, (newMode) => {
      if (newMode === 'victory' || newMode === 'gameover') {
        recordRunCompletion();
      }
    });

    const intensity = world.boss ? 0.9 : 0.3 + world.trialIndex * 0.12;
    audio.updateMusic(FIXED_DT, world.mode === 'playing', intensity);
    ui.sync(world, saveData, audio.muted);
  }

  let lastTimestamp = performance.now();
  let accumulator = 0;

  function animationLoop(now) {
    const elapsed = Math.min(0.1, Math.max(0, (now - lastTimestamp) / 1000));
    lastTimestamp = now;
    accumulator += elapsed;

    while (accumulator >= FIXED_DT) {
      advanceOneFixedStep();
      accumulator -= FIXED_DT;
    }

    renderGameFrame(ctx, world, effects, input.state, saveData, audio.muted);
    window.requestAnimationFrame(animationLoop);
  }

  ui.sync(world, saveData, audio.muted);
  renderGameFrame(ctx, world, effects, input.state, saveData, audio.muted);
  window.requestAnimationFrame(animationLoop);

  // Expose clean inspection & deterministic step hook for automated verification
  window.__emberglass = {
    getState() {
      return {
        mode: world.mode,
        trial: world.trialIndex,
        score: world.score,
        combo: world.combo,
        maxCombo: world.stats.maxCombo,
        comboMultiplier: computeComboMultiplier(world.combo),
        hudMultiplierText: formatComboMultiplier(world.combo),
        hitStopTimer: effects.hitStopTimer,
        lanternHp: world.lanternHp,
        playerHp: world.player.hp,
        prisms: world.prisms.map((p) => ({ x: p.x, y: p.y, kind: p.kind })),
        enemies: world.enemies.map((e) => ({ x: e.x, y: e.y, kind: e.kind, hp: e.hp })),
        pylons: world.pylons.map((p) => ({ x: p.x, y: p.y, hp: p.hp })),
        boss: world.boss
          ? {
              x: world.boss.x,
              y: world.boss.y,
              hp: world.boss.hp,
              maxHp: world.boss.maxHp,
              phase: world.boss.phase,
              phaseGuardTimer: world.boss.phaseGuardTimer,
              phasesVisited: [...world.boss.phasesVisited],
            }
          : null,
        player: { x: world.player.x, y: world.player.y, dashCooldown: world.player.dashCooldown },
        shards: world.shards.map((s) => ({ x: s.x, y: s.y })),
        novaCharge: world.novaCharge,
        prismCharges: world.prismCharges,
        beamCount: effects.beams.length,
        stats: { ...world.stats, bossPhasesSeen: [...world.stats.bossPhasesSeen] },
      };
    },
    stepFrames(count = 1) {
      for (let i = 0; i < count; i++) {
        advanceOneFixedStep();
      }
      renderGameFrame(ctx, world, effects, input.state, saveData, audio.muted);
    },
  };
}

bootstrapEmberglass();
