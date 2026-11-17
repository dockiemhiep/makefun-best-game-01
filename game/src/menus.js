// Accessible game menus: Title, Trial Select, Upgrade Draft, Pause/Settings, Victory, and Defeat.

import { DIFFICULTY_MODES, formatComboMultiplier } from './config.js';
import { TEMPERING_CATALOG } from './temperings.js';
import { computeRunStars } from './world.js';
import { renderTrialSelectScreen } from './trial-select.js';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderStarsMarkup(litCount) {
  let out = '';
  for (let i = 1; i <= 3; i++) {
    out += `<span class="${i <= litCount ? 'star-lit' : 'star-dim'}">★</span>`;
  }
  return out;
}

export function createGameMenus(rootEl, handlers) {
  let renderedSignature = '';
  let showCodexOnTitle = false;

  function buildSignature(world, saveData, audioMuted) {
    return [
      world.mode,
      world.difficulty,
      showCodexOnTitle ? 'codex1' : 'codex0',
      audioMuted ? 'm1' : 'm0',
      world.trialIndex,
      world.pendingTrial,
      JSON.stringify(saveData.trials[world.difficulty]),
      world.score,
      saveData.bestScore,
      saveData.bestStars,
      world.draftChoices.map((c) => c.id).join(','),
    ].join('|');
  }

  function sync(world, saveData, audioMuted) {
    const sig = buildSignature(world, saveData, audioMuted);
    if (sig === renderedSignature) return;
    renderedSignature = sig;
    const previousMode = rootEl.dataset.mode;
    const active = rootEl.contains(document.activeElement) ? document.activeElement : null;
    const activeAction = active?.getAttribute('data-action');
    const activeId = active?.id;
    rootEl.dataset.mode = world.mode;
    document.getElementById('game-canvas').inert = world.mode !== 'playing';

    if (world.mode === 'playing') {
      rootEl.innerHTML = '';
      return;
    }

    if (world.mode === 'title') {
      renderTitleOverlay(world, saveData, audioMuted);
    } else if (world.mode === 'trials') {
      rootEl.innerHTML = renderTrialSelectScreen(world, saveData);
      bindCommonButtons();
    } else if (world.mode === 'tempering') {
      renderTemperingOverlay(world);
    } else if (world.mode === 'paused') {
      renderPauseSettingsMenu(world, saveData, audioMuted);
    } else if (world.mode === 'victory' || world.mode === 'gameover') {
      renderResultsOverlay(world, saveData);
    }
    const target = activeId ? rootEl.querySelector(`#${activeId}`) :
      activeAction ? rootEl.querySelector(`[data-action="${activeAction}"]`) : null;
    if (target) target.focus({ preventScroll: true });
    else if (previousMode !== world.mode || active) {
      (rootEl.querySelector('[data-focus-first]') || rootEl.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
    }
  }

  function renderTitleOverlay(world, saveData, audioMuted) {
    if (showCodexOnTitle) {
      rootEl.innerHTML = `
        <section class="overlay-screen compact-modal" aria-label="Crucible Guide">
          <div class="eyebrow-row">
            <span>EMBERGLASS · TACTICAL CODEX</span>
            <span class="best-pill">5 TRIALS · FINAL BOSS</span>
          </div>
          <div class="codex-columns">
            <div class="codex-box">
              <h3>Refraction Rules</h3>
              <p>Shoot any deployed <strong>Stained-Glass Prism</strong> to amplify and split your Ember Bolt into instant piercing beams. Prisms within link range chain automatically for up to <strong>3.75x Resonance Multipliers</strong> across 12-hit streaks.</p>
              <p>Collect dropped <strong>Glass Shards</strong> to recharge Prisms and fill your <strong>Kiln Supernova [F]</strong>.</p>
            </div>
            <div class="codex-box">
              <h3>Rime Threats</h3>
              <p><strong>Slag Bulwarks</strong> carry golden front shields — angle beams through side Prisms for <strong>Flank Shatters</strong>!</p>
              <p><strong>Siphon Moths</strong> drain unguarded Prisms. <strong>Vespera (Trial 5)</strong> summons Cryo Pylons that must be shattered to drop her ward.</p>
            </div>
          </div>
          <div class="cta-row">
            <button class="btn-primary" data-action="close-codex">BACK TO TITLE</button>
            <button class="btn-secondary" data-action="start-run">START FORGE RUN</button>
          </div>
        </section>
      `;
      bindCommonButtons();
      return;
    }

    const diffButtons = Object.values(DIFFICULTY_MODES)
      .map(
        (d) => `
        <button class="diff-btn ${world.difficulty === d.id ? 'active' : ''}" data-diff="${d.id}">
          ${escapeHtml(d.label)} (${d.scoreMult.toFixed(2).replace(/\.00$/, '.0')}x)
        </button>
      `,
      )
      .join('');

    rootEl.innerHTML = `
      <section class="overlay-screen title-screen" aria-label="Emberglass Title Screen">
        <div class="title-copy">
          <div class="eyebrow-row">A STAINED-GLASS COMBAT RITUAL</div>
          <header>
            <h1 class="game-title" translate="no">EMBERGLASS</h1>
            <p class="title-mantra">REFRACT THE FLAME.</p>
          </header>
          <p class="title-goal">Build a prism web. Defend the Heart-Lantern.<br>Survive five trials. Shatter the Rime Sovereign.</p>
          <div class="prism-legend"><span class="ruby">◆ RUBY SPLITS</span><span class="cyan">◆ CYAN CHAINS</span><span class="topaz">◆ TOPAZ DETONATES</span></div>
          <div class="difficulty-bar" role="group" aria-label="Select Difficulty">${diffButtons}</div>
          <div class="cta-row">
            <button class="btn-primary" id="btn-start-run" data-action="start-run" data-focus-first>START RUN <small>[ENTER]</small></button>
            <button class="btn-secondary" data-action="open-trials">TRIAL SELECT</button>
          </div>
          <div class="title-controls" aria-label="Controls"><span><b>WASD</b> Move</span><span><b>CLICK</b> Fire</span><span><b>E</b> Prism</span><span><b>SPACE</b> Dash</span></div>
          <div class="title-utility">
            <button class="text-button" data-action="open-codex">HOW TO PLAY</button>
            <button class="text-button" data-action="toggle-mute">${audioMuted ? 'SOUND OFF [M]' : 'SOUND ON [M]'}</button>
            <span class="title-best">BEST ${saveData.bestScore.toLocaleString('en-US')}</span>
          </div>
        </div>
      </section>
    `;
    bindCommonButtons();
  }

  function renderTemperingOverlay(world) {
    const cardsHtml = world.draftChoices
      .map(
        (choice, index) => `
        <button class="tempering-card ${['glass-ruby', 'glass-cyan', 'glass-topaz'][index % 3]}" data-tempering="${choice.id}">
          <div>
            <div class="tempering-tag">${escapeHtml(choice.tag)}</div>
            <div class="tempering-name">${escapeHtml(choice.name)}</div>
            <div class="tempering-effect"><strong>${escapeHtml(choice.effect.split(' ')[0])}</strong><span>${escapeHtml(choice.effect.split(' ').slice(1).join(' '))}</span></div>
            <div class="tempering-desc">${escapeHtml(choice.desc)}</div>
          </div>
          <div class="tempering-pick-hint">FORGE RELIC <kbd>${index + 1}</kbd></div>
        </button>
      `,
      )
      .join('');

    rootEl.innerHTML = `
      <section class="overlay-screen stained-menu upgrade-screen" aria-label="Choose an upgrade">
        <div class="eyebrow-row">
          <span>TRIAL ${world.trialIndex} CLEARED · KILN FORGE</span>
          <span class="best-pill">SCORE: ${world.score.toLocaleString('en-US')}</span>
        </div>
        <header class="hero-header">
          <h2 class="result-heading victory">CHOOSE YOUR UPGRADE</h2>
          <p class="game-subtitle">Pick one. Its power lasts for every remaining trial.</p>
        </header>
        <div class="draft-grid">
          ${cardsHtml}
        </div>
        <div class="upgrade-route" aria-label="Run route">${[1,2,3,4,5].map(n => `<span class="${n <= world.trialIndex ? 'done' : n === world.trialIndex + 1 ? 'upcoming' : ''}"><b>${n <= world.trialIndex ? '✓' : n}</b>${n <= world.trialIndex ? 'CLEARED' : n === world.trialIndex + 1 ? 'NEXT' : n === 5 ? 'BOSS' : 'LOCKED'}</span>`).join('<i></i>')}</div>
      </section>
    `;
    bindCommonButtons();
  }

  function renderPauseSettingsMenu(world, saveData, audioMuted) {
    rootEl.innerHTML = `
      <section class="overlay-screen pause-screen" role="dialog" aria-modal="true" aria-label="Pause and settings">
        <div class="eyebrow-row"><span>TRIAL ${world.trialIndex} / 5</span><span>SIMULATION PAUSED</span></div>
        <h2 class="result-heading">PAUSE / SETTINGS</h2>
        <div class="settings-row">
          <label for="sound-volume">SOUND VOLUME <output id="volume-value" for="sound-volume">${Math.round(saveData.volume * 100)}%</output></label>
          <input id="sound-volume" type="range" min="0" max="100" step="1" value="${Math.round(saveData.volume * 100)}">
          <button class="btn-secondary" data-action="toggle-mute" aria-pressed="${audioMuted}">${audioMuted ? 'UNMUTE SOUND' : 'MUTE SOUND'}</button>
        </div>
        <p class="game-subtitle">Restart restores this trial's entry score, health and relics.</p>
        <div class="cta-row">
          <button class="btn-primary" data-action="resume-run" data-focus-first>RESUME [ESC / P]</button>
          <button class="btn-secondary" data-action="restart-trial">RESTART TRIAL [R]</button>
          <button class="btn-secondary" data-action="return-title">TITLE</button>
        </div>
        <div class="pause-controls">WASD Move · Click Fire · RMB / E Prism · Q Recall<br>Space Dash · 1 / 2 / 3 Prism color · F Supernova · M Mute</div>
        <div class="relic-strip">${world.temperingIds.map(id => `<span class="relic-chip">${escapeHtml(TEMPERING_CATALOG.find(t => t.id === id)?.name || id)}</span>`).join('')}</div>
      </section>
    `;
    bindCommonButtons();
  }

  function renderResultsOverlay(world, saveData) {
    const isVictory = world.mode === 'victory';
    const stars = computeRunStars(world);
    const mins = String(Math.floor(world.runTime / 60)).padStart(2, '0');
    const secs = String(Math.floor(world.runTime % 60)).padStart(2, '0');

    const relicChips =
      world.temperingIds.length > 0
        ? world.temperingIds
            .map((id) => TEMPERING_CATALOG.find((t) => t.id === id))
            .filter(Boolean)
            .map((t) => `<span class="relic-chip">◆ ${escapeHtml(t.name)}</span>`)
            .join('')
        : '<span class="relic-chip">No Temperings Forged</span>';

    rootEl.innerHTML = `
      <section class="overlay-screen stained-menu results-screen ${isVictory ? 'is-victory' : 'is-defeat'}" aria-label="${isVictory ? 'Victory Summary' : 'Defeat Summary'}">
        <div class="eyebrow-row">
          <span>${isVictory ? (world.runStartTrial === 1 ? 'ALL 5 KILN TRIALS CONQUERED' : 'THE RIME SOVEREIGN DEFEATED') : `FALLEN ON TRIAL ${world.trialIndex} OF 5`}</span>
          <span class="best-pill">${world.isNewBest ? '★ NEW HIGH SCORE! ★' : `BEST: ${saveData.bestScore.toLocaleString('en-US')}`}</span>
        </div>

        <div class="result-banner">
          <h2 class="result-heading ${isVictory ? 'victory' : 'defeat'}">
            ${isVictory ? 'VICTORY' : 'CRUCIBLE SHATTERED'}
          </h2>
          ${isVictory ? `<div class="stars-row" aria-label="${stars} of 3 stars">${renderStarsMarkup(stars)}</div>` : ''}
          <p class="game-subtitle">
            ${
              isVictory
                ? 'Vespera, The Rime Sovereign lies shattered and the Heart-Lantern blazes across the citadel!'
                : escapeHtml(world.defeatReason)
            }
          </p>
        </div>

        <div class="score-hero">
          <div class="stat-label">Final Score</div>
          <div class="stat-value">${world.score.toLocaleString('en-US')}</div>
        </div>

        <div class="stats-grid">
          <div class="stat-tile">
            <div class="stat-value">${formatComboMultiplier(world.stats.maxCombo)}</div>
            <div class="stat-label">Peak Multiplier</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">${world.stats.trialsCleared} / 5</div>
            <div class="stat-label">Trials Cleared</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">${world.stats.enemiesShattered}</div>
            <div class="stat-label">Foes Shattered</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">${world.stats.beamsRefracted}</div>
            <div class="stat-label">Beams Refracted</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">${mins}:${secs}</div>
            <div class="stat-label">Run Time</div>
          </div>
        </div>

        <div class="relic-strip">${relicChips}</div>

        <div class="cta-row">
          <button class="btn-primary" id="btn-play-again" data-action="restart-run" data-focus-first>RESTART RUN [R]</button>
          <button class="btn-secondary" data-action="open-trials">TRIAL SELECT</button>
          <button class="btn-secondary" data-action="return-title">TITLE SCREEN</button>
        </div>
      </section>
    `;
    bindCommonButtons();
  }

  function bindCommonButtons() {
    rootEl.querySelectorAll('[data-trial]').forEach(btn => {
      btn.addEventListener('click', () => handlers.onSelectTrial(Number(btn.dataset.trial)));
    });
    const volume = rootEl.querySelector('#sound-volume');
    volume?.addEventListener('input', () => {
      handlers.onSetVolume(Number(volume.value) / 100);
      rootEl.querySelector('#volume-value').value = `${volume.value}%`;
    });
    rootEl.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        handlers.onSelectDifficulty(btn.getAttribute('data-diff'));
      });
    });

    rootEl.querySelectorAll('[data-tempering]').forEach((btn) => {
      btn.addEventListener('click', () => {
        handlers.onPickTempering(btn.getAttribute('data-tempering'));
      });
    });

    rootEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (action === 'start-run' || action === 'restart-run') {
          showCodexOnTitle = false;
          handlers.onStartRun();
        } else if (action === 'open-trials') {
          showCodexOnTitle = false;
          handlers.onOpenTrials();
        } else if (action === 'restart-trial') {
          handlers.onRestartTrial();
        } else if (action === 'resume-run') {
          handlers.onResume();
        } else if (action === 'return-title') {
          showCodexOnTitle = false;
          handlers.onReturnTitle();
        } else if (action === 'toggle-mute') {
          handlers.onToggleMute();
        } else if (action === 'open-codex') {
          showCodexOnTitle = true;
          renderedSignature = '';
          handlers.onRefreshUI();
        } else if (action === 'close-codex') {
          showCodexOnTitle = false;
          renderedSignature = '';
          handlers.onRefreshUI();
        }
      });
    });
  }

  function forceRefresh() {
    renderedSignature = '';
  }

  rootEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !rootEl.querySelector('[aria-modal="true"]')) return;
    const controls = [...rootEl.querySelectorAll('button:not(:disabled), input')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  return {
    sync,
    returnToTitle: handlers.onReturnTitle,
    dismissCodex() { showCodexOnTitle = false; renderedSignature = ''; handlers.onRefreshUI(); },
    forceRefresh,
  };
}
