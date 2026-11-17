// EMBERGLASS main bootstrap: fixed 60 Hz simulation step, persistence, and state orchestration.

import { computeComboMultiplier, formatComboMultiplier } from './config.js';
import { createInputController } from './input.js';
import { createSoundEngine } from './audio.js';
import { createEffectsSystem } from './effects.js';
import {
  bufferCombatActions,
  chooseTemperingUpgrade,
  continueTrialProgression,
  computeRunStars,
  createWorldState,
  setupTitleAttractScene,
  startNewRun,
  stepWorldSimulation,
} from './world.js';
import { renderGameFrame } from './render.js';
import { createGameMenus } from './menus.js';
import { loadProgressionAndSettings, persistProgressionAndSettings, isTrialUnlocked, recordTrialResult, restartCurrentTrial } from './progression.js';

const FIXED_DT = 1 / 60;

function bootstrapEmberglass() {
  const canvas = document.getElementById('game-canvas');
  const overlayRoot = document.getElementById('overlay-root');
  const ctx = canvas.getContext('2d');

  const saveData = loadProgressionAndSettings();
  const params = new URLSearchParams(window.location.search);
  const urlSeed = Number(params.get('seed')) || 20261116;

  const world = createWorldState(urlSeed);
  world.difficulty = saveData.difficulty;

  const effects = createEffectsSystem(world.rng);
  const audio = createSoundEngine();
  audio.setMuted(saveData.muted);
  audio.setVolume(saveData.volume);
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
    persistProgressionAndSettings(saveData);
  }

  const ui = createGameMenus(overlayRoot, {
    onSelectDifficulty(diffId) {
      audio.unlock();
      world.difficulty = diffId;
      saveData.difficulty = diffId;
      persistProgressionAndSettings(saveData);
      ui.forceRefresh();
      ui.sync(world, saveData, audio.muted);
    },
    onStartRun() {
      audio.unlock();
      const nextSeed = params.has('seed') ? Number(params.get('seed')) : undefined;
      startNewRun(world, world.difficulty, nextSeed, effects);
      ui.sync(world, saveData, audio.muted);
    },
    onOpenTrials() {
      world.pendingTrial = null;
      world.mode = 'trials';
      ui.sync(world, saveData, audio.muted);
    },
    onSelectTrial(trial) {
      audio.unlock();
      if (world.pendingTrial) {
        if (trial !== world.pendingTrial) return;
        continueTrialProgression(world, effects);
      } else {
        if (!isTrialUnlocked(saveData, world.difficulty, trial)) return;
        startNewRun(world, world.difficulty, urlSeed, effects, trial);
      }
      ui.sync(world, saveData, audio.muted);
    },
    onRestartTrial() {
      restartCurrentTrial(world, effects);
      ui.sync(world, saveData, audio.muted);
    },
    onSetVolume(value) {
      audio.setVolume(value);
      saveData.volume = audio.volume;
      persistProgressionAndSettings(saveData);
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
      world.pendingTrial = null;
      effects.clearAll();
      setupTitleAttractScene(world);
      ui.sync(world, saveData, audio.muted);
    },
    onToggleMute() {
      const muted = audio.toggleMute();
      saveData.muted = muted;
      persistProgressionAndSettings(saveData);
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
      persistProgressionAndSettings(saveData);
      ui.forceRefresh();
    }

    if (world.mode === 'title') {
      if (actions.pause) ui.dismissCodex();
      if (actions.confirm) {
        audio.unlock();
        startNewRun(world, world.difficulty, params.has('seed') ? Number(params.get('seed')) : undefined, effects);
      }
      return;
    }

    if (world.mode === 'trials') {
      if (actions.pause) ui.returnToTitle();
      if (actions.confirm && world.pendingTrial) continueTrialProgression(world, effects);
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
        restartCurrentTrial(world, effects);
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
      if (newMode === 'tempering' || newMode === 'victory' || newMode === 'gameover') {
        recordTrialResult(saveData, world, newMode !== 'gameover');
      }
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
        seed: world.seed,
        difficulty: world.difficulty,
        runTime: world.runTime,
        pendingTrial: world.pendingTrial,
        trialStartScore: world.trialStartScore,
        runStartTrial: world.runStartTrial,
        temperingIds: [...world.temperingIds],
        modifiers: { ...world.mods },
        draftChoices: world.draftChoices.map(({ id, name }) => ({ id, name })),
        progression: structuredClone(saveData.trials),
        sound: { muted: audio.muted, volume: audio.volume, ...audio.status },
        trial: world.trialIndex,
        score: world.score,
        combo: world.combo,
        maxCombo: world.stats.maxCombo,
        comboMultiplier: computeComboMultiplier(world.combo),
        hudMultiplierText: formatComboMultiplier(world.combo),
        hitStopTimer: effects.hitStopTimer,
        screenFlash: effects.flashAlpha,
        lanternHp: world.lanternHp,
        playerHp: world.player.hp,
        playerMaxHp: world.player.maxHp,
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
              hitFlash: world.boss.hitFlash,
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
