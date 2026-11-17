// Saved trial unlocks, per-difficulty records, and exact trial-entry restart checkpoints.
import { DIFFICULTY_MODES, TRIAL_WAVES } from './config.js';

const SAVE_STORAGE_KEY = 'emberglass.save.v1';

export function loadProgressionAndSettings() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY)) || {}; } catch { /* Storage is optional. */ }
  const trials = {};
  for (const difficulty of Object.keys(DIFFICULTY_MODES)) {
    trials[difficulty] = TRIAL_WAVES.map((_, i) => ({
      cleared: stored.trials?.[difficulty]?.[i]?.cleared === true,
      bestScore: Math.max(0, Math.floor(Number(stored.trials?.[difficulty]?.[i]?.bestScore) || 0)),
    }));
  }
  return {
    bestScore: Math.max(0, Number(stored.bestScore) || 0),
    bestStars: Math.max(0, Math.min(3, Math.floor(Number(stored.bestStars) || 0))),
    difficulty: DIFFICULTY_MODES[stored.difficulty] ? stored.difficulty : 'artisan',
    muted: Boolean(stored.muted),
    volume: Number.isFinite(stored.volume) ? Math.max(0, Math.min(1, stored.volume)) : 1,
    trials,
  };
}

export function persistProgressionAndSettings(save) {
  try { localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save)); } catch { /* Private browsing. */ }
}

export function isTrialUnlocked(save, difficulty, trial) {
  return trial >= 1 && trial <= TRIAL_WAVES.length &&
    (trial === 1 || save.trials[difficulty][trial - 2].cleared);
}

export function recordTrialResult(save, world, cleared) {
  const record = save.trials[world.difficulty][world.trialIndex - 1];
  record.bestScore = Math.max(record.bestScore, world.score - world.trialStartScore);
  record.cleared ||= cleared;
  persistProgressionAndSettings(save);
}

export function captureTrialEntryCheckpoint(world) {
  const { rng, trialCheckpoint, ...state } = world;
  world.trialCheckpoint = { state: structuredClone(state), rngState: rng.getState() };
}

export function restartCurrentTrial(world, effects) {
  if (!world.trialCheckpoint) return false;
  const { state, rngState } = world.trialCheckpoint;
  Object.assign(world, structuredClone(state));
  world.rng.setState(rngState);
  world.mode = 'playing';
  effects.clearAll();
  return true;
}
