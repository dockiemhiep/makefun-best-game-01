// Accessible DOM overlay screens: Title, Codex, Tempering Draft, Pause, Victory, and Defeat.

import { DIFFICULTY_MODES, formatComboMultiplier } from './config.js';
import { TEMPERING_CATALOG } from './temperings.js';
import { computeRunStars } from './world.js';

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

export function createOverlayUI(rootEl, handlers) {
  let renderedSignature = '';
  let showCodexOnTitle = false;

  function buildSignature(world, saveData, audioMuted) {
    return [
      world.mode,
      world.difficulty,
      showCodexOnTitle ? 'codex1' : 'codex0',
      audioMuted ? 'm1' : 'm0',
      world.trialIndex,
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

    if (world.mode === 'playing') {
      rootEl.innerHTML = '';
      return;
    }

    if (world.mode === 'title') {
      renderTitleOverlay(world, saveData, audioMuted);
    } else if (world.mode === 'tempering') {
      renderTemperingOverlay(world);
    } else if (world.mode === 'paused') {
      renderPauseOverlay(world, audioMuted);
    } else if (world.mode === 'victory' || world.mode === 'gameover') {
      renderResultsOverlay(world, saveData);
    }
  }

  function renderTitleOverlay(world, saveData, audioMuted) {
    if (showCodexOnTitle) {
      rootEl.innerHTML = `
        <section class="overlay-screen compact-modal" aria-label="Crucible Guide">
          <div class="eyebrow-row">
            <span>EMBERGLASS · TACTICAL CODEX</span>
            <span class="best-pill">5 TRIALS + 3-PHASE BOSS</span>
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

    const bestStarsText = saveData.bestStars > 0 ? `${'★'.repeat(saveData.bestStars)}${'☆'.repeat(3 - saveData.bestStars)}` : '☆☆☆';

    rootEl.innerHTML = `
      <section class="overlay-screen" aria-label="Emberglass Title Screen">
        <div class="eyebrow-row">
          <span>STAINED-GLASS REFRACTION ARENA</span>
          <span class="best-pill">BEST SCORE: ${saveData.bestScore.toLocaleString('en-US')} · ${bestStarsText}</span>
        </div>

        <header class="hero-header">
          <h1 class="game-title">EMBERGLASS</h1>
          <p class="game-subtitle">
            Architect a network of stained-glass Prisms around the Heart-Lantern and shoot into them to refract blazing multi-beam combos across 5 Kiln Trials.
          </p>
        </header>

        <div class="prism-triptych">
          <div class="prism-badge-card ruby">
            <div class="prism-badge-title">◆ Ruby Splitter</div>
            <div class="prism-badge-desc">Splits bolts into 3 piercing crimson lances + relays chain.</div>
          </div>
          <div class="prism-badge-card cyan">
            <div class="prism-badge-title">⬡ Tourmaline Arc</div>
            <div class="prism-badge-desc">Instant lightning relay that slows foes & vaporizes frost orbs.</div>
          </div>
          <div class="prism-badge-card topaz">
            <div class="prism-badge-title">✦ Topaz Sunburst</div>
            <div class="prism-badge-desc">Detonates a radiant shockwave nova every 2nd refraction.</div>
          </div>
        </div>

        <div class="difficulty-bar" role="group" aria-label="Select Difficulty">
          ${diffButtons}
        </div>

        <div class="controls-grid">
          <div class="ctrl-item"><span class="keycap">WASD / ARROWS</span><span class="ctrl-label">Move Vessel</span></div>
          <div class="ctrl-item"><span class="keycap">LEFT CLICK</span><span class="ctrl-label">Fire Ember Bolt</span></div>
          <div class="ctrl-item"><span class="keycap">RIGHT CLICK / E</span><span class="ctrl-label">Deploy Prism</span></div>
          <div class="ctrl-item"><span class="keycap">SPACE / SHIFT</span><span class="ctrl-label">Phase Dash</span></div>
          <div class="ctrl-item"><span class="keycap">F / 1-2-3</span><span class="ctrl-label">Supernova · Color</span></div>
        </div>

        <div class="cta-row">
          <button class="btn-primary" id="btn-start-run" data-action="start-run">START RUN [ENTER]</button>
          <button class="btn-secondary" data-action="open-codex">CODEX &amp; RULES</button>
          <button class="btn-secondary" data-action="toggle-mute">${audioMuted ? 'SOUND: OFF' : 'SOUND: ON'}</button>
        </div>
      </section>
    `;

    bindCommonButtons();
  }

  function renderTemperingOverlay(world) {
    const cardsHtml = world.draftChoices
      .map(
        (choice, index) => `
        <button class="tempering-card" data-tempering="${choice.id}">
          <div>
            <div class="tempering-tag">${escapeHtml(choice.tag)}</div>
            <div class="tempering-name">${escapeHtml(choice.name)}</div>
            <div class="tempering-desc">${escapeHtml(choice.desc)}</div>
          </div>
          <div class="tempering-pick-hint">FORGE RELIC [${index + 1}]</div>
        </button>
      `,
      )
      .join('');

    rootEl.innerHTML = `
      <section class="overlay-screen compact-modal" aria-label="Choose a Forged Tempering">
        <div class="eyebrow-row">
          <span>TRIAL ${world.trialIndex} CLEARED · KILN FORGE</span>
          <span class="best-pill">SCORE: ${world.score.toLocaleString('en-US')}</span>
        </div>
        <header class="hero-header">
          <h2 class="result-heading victory" style="font-size: 30px;">CHOOSE A FORGED TEMPERING</h2>
          <p class="game-subtitle">Select 1 relic to empower your Weaver and Prisms for Trial ${world.trialIndex + 1}.</p>
        </header>
        <div class="draft-grid">
          ${cardsHtml}
        </div>
      </section>
    `;
    bindCommonButtons();
  }

  function renderPauseOverlay(world, audioMuted) {
    rootEl.innerHTML = `
      <section class="overlay-screen compact-modal" aria-label="Game Paused">
        <div class="eyebrow-row">
          <span>CRUCIBLE SUSPENDED</span>
          <span class="best-pill">TRIAL ${world.trialIndex} / 5</span>
        </div>
        <header class="hero-header">
          <h2 class="result-heading" style="font-size: 32px; color: #ffe6b0;">PAUSED</h2>
          <p class="game-subtitle">Tip: Place 2 or 3 Prisms in a triangle around the Heart-Lantern so one bolt chains across the entire arena.</p>
        </header>
        <div class="codex-columns">
          <div class="codex-box">
            <h3>Active Controls</h3>
            <p><strong>WASD / Arrows</strong>: Move · <strong>Space</strong>: Phase Dash<br>
            <strong>Left Click</strong>: Shoot · <strong>Right Click / E</strong>: Place Prism<br>
            <strong>Q</strong>: Recall Prism · <strong>F</strong>: Kiln Supernova</p>
          </div>
          <div class="codex-box">
            <h3>Current Run</h3>
            <p>Score: <strong>${world.score.toLocaleString('en-US')}</strong> · Peak Multiplier: <strong>${formatComboMultiplier(world.stats.maxCombo)}</strong> (${world.stats.maxCombo} streak)<br>
            Lantern Warmth: <strong>${Math.ceil(world.lanternHp)}/${world.lanternMaxHp}</strong></p>
          </div>
        </div>
        <div class="cta-row">
          <button class="btn-primary" data-action="resume-run">RESUME [ESC]</button>
          <button class="btn-secondary" data-action="restart-run">RESTART RUN [R]</button>
          <button class="btn-secondary" data-action="toggle-mute">${audioMuted ? 'SOUND: OFF' : 'SOUND: ON'}</button>
          <button class="btn-secondary" data-action="return-title">TITLE MENU</button>
        </div>
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
      <section class="overlay-screen compact-modal" aria-label="${isVictory ? 'Victory Summary' : 'Defeat Summary'}">
        <div class="eyebrow-row">
          <span>${isVictory ? 'ALL 5 KILN TRIALS CONQUERED' : `FALLEN ON TRIAL ${world.trialIndex} OF 5`}</span>
          <span class="best-pill">${world.isNewBest ? '★ NEW HIGH SCORE! ★' : `BEST: ${saveData.bestScore.toLocaleString('en-US')}`}</span>
        </div>

        <div class="result-banner">
          <h2 class="result-heading ${isVictory ? 'victory' : 'defeat'}">
            ${isVictory ? 'VICTORY — THE KILN ENDURES' : 'CRUCIBLE SHATTERED'}
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

        <div class="stats-grid">
          <div class="stat-tile">
            <div class="stat-value">${world.score.toLocaleString('en-US')}</div>
            <div class="stat-label">Final Score</div>
          </div>
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
          <button class="btn-primary" id="btn-play-again" data-action="restart-run">PLAY AGAIN [R]</button>
          <button class="btn-secondary" data-action="return-title">TITLE SCREEN</button>
        </div>
      </section>
    `;
    bindCommonButtons();
  }

  function bindCommonButtons() {
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

  return {
    sync,
    forceRefresh,
  };
}
