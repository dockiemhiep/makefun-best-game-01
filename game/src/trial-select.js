// Five-trial route map: actual saved clears, unlock gates, records, and the next run destination.
import { DIFFICULTY_MODES, TRIAL_WAVES } from './config.js';
import { isTrialUnlocked } from './progression.js';

export function renderTrialSelectScreen(world, save) {
  const records = save.trials[world.difficulty];
  const challenges = ['Prism refraction', 'Armored flanks', 'Prism hunters', 'The final swarm', '3-PHASE BOSS'];
  const cards = TRIAL_WAVES.map((trial, i) => {
    const record = records[i];
    const next = world.pendingTrial === trial.trial;
    const unlocked = isTrialUnlocked(save, world.difficulty, trial.trial);
    const enabled = world.pendingTrial ? next : unlocked;
    const status = next ? 'NEXT TRIAL' : record.cleared ? 'CLEARED' : unlocked ? 'UNLOCKED' : 'LOCKED';
    return `<button class="trial-node ${record.cleared ? 'cleared' : ''} ${next ? 'next' : ''} ${trial.isBossTrial ? 'boss-node' : ''}"
      data-trial="${trial.trial}" ${enabled ? '' : 'disabled'} ${next ? 'data-focus-first' : ''}>
      <span class="trial-state">${record.cleared ? '✓ ' : ''}${status}</span>
      <span class="trial-number">${String(trial.trial).padStart(2, '0')}</span>
      <span class="trial-name">${trial.isBossTrial ? 'Vespera' : trial.title}</span>
      <span class="trial-challenge">${challenges[i]}</span>
      <span class="trial-record"><small>BEST SCORE</small><strong>${record.bestScore.toLocaleString('en-US')}</strong></span>
      <span class="trial-enter">${next ? 'ENTER TRIAL →' : enabled ? record.cleared ? 'REPLAY TRIAL →' : 'ENTER TRIAL →' : record.cleared ? 'TRIAL CLEARED' : 'CLEAR TRIAL ' + i}</span>
    </button>`;
  }).join('');
  return `<section class="overlay-screen progression-screen" aria-label="Trial select and progression">
    <div class="eyebrow-row"><span>${DIFFICULTY_MODES[world.difficulty].label.toUpperCase()} · FIVE KILN TRIALS</span><span>${records.filter(t => t.cleared).length} / 5 CLEARED</span></div>
    <header class="hero-header"><h2 class="result-heading">TRIAL SELECT</h2>
      <p class="game-subtitle">${world.pendingTrial ? 'Your relic is forged. The next trial awaits.' : 'Clear each trial to unlock the next. Forge a relic after every clear.'}</p></header>
    <div class="trial-route">${cards}</div>
    <div class="relic-strip">${world.pendingTrial ? `RUN SCORE <strong>${world.score.toLocaleString('en-US')}</strong> · ${world.temperingIds.length} RELICS ACTIVE` : 'Records are saved per difficulty. Replays begin a fresh run at that trial.'}</div>
    <div class="cta-row"><button class="btn-secondary" data-action="return-title">TITLE SCREEN [ESC]</button></div>
  </section>`;
}
