// Real Chrome, real input controller, normal combat simulation. No world/state injection.
// PLAYWRIGHT_MODULE may point to an installed playwright/index.mjs outside this static game.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.GAME_URL || 'http://127.0.0.1:8093';
const evidence = process.env.EVIDENCE_DIR || '/tmp/emberglass-phase4-evidence';
const capture = process.argv.includes('--capture');
mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], externalRequests = [], failedRequests = [], checks = [];
function observe(page) {
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!r.url().startsWith(origin + '/') && !r.url().startsWith('data:')) externalRequests.push(r.url()); });
  page.on('requestfailed', r => failedRequests.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });
}
const viewport = { width: 1280, height: 720 };
const state = page => page.evaluate(() => window.__emberglass.getState());
const tick = (page, n = 1) => page.evaluate(n => window.__emberglass.stepFrames(n), n);
async function shot(page, name) {
  if (capture) await page.screenshot({ path: resolve('screenshots', name), type: 'jpeg', quality: 86 });
}
async function auditScreen(page, name) {
  if (!process.env.VISUAL_AUDIT) return;
  const probe = readFileSync(process.env.LAYOUT_PROBE, 'utf8');
  const results = [];
  for (const [width, height] of [[1440, 900], [390, 844]]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: theme });
    await page.addScriptTag({ path: process.env.AXE_SCRIPT });
    const axe = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })));
    const layout = await page.evaluate(`${probe}\nlayoutProbe()`);
    const prefix = `${evidence}/${name}-${width}-${theme}`;
    await page.screenshot({ path: `${prefix}.png` });
    const result = { name, width, height, theme, axe, layout };
    writeFileSync(`${prefix}.json`, JSON.stringify(result, null, 2)); results.push(result);
  }
  await page.setViewportSize(viewport);
  await page.emulateMedia({ colorScheme: 'dark' });
  const violations = results.flatMap(r => r.axe);
  assert.deepEqual(violations, [], `WCAG scanner: ${name}`);
}
try {
  // Check the normal requestAnimationFrame path, both pause shortcuts, real WebAudio gain,
  // keyboard focus, persisted settings, and a trial restart while the animation loop runs.
  const live = await browser.newPage({ viewport }); observe(live);
  await live.goto(`${origin}/?seed=20261116`);
  await live.getByRole('button', { name: 'START RUN [ENTER]', exact: true }).click();
  await live.waitForTimeout(250);
  assert.ok((await state(live)).runTime > 0);
  await live.keyboard.press('p');
  await live.getByRole('dialog', { name: 'Pause and settings' }).waitFor();
  const paused = await state(live);
  await live.waitForTimeout(150);
  assert.equal((await state(live)).runTime, paused.runTime);
  await live.locator('#sound-volume').fill('37');
  await live.waitForFunction(() => Math.abs(window.__emberglass.getState().sound.gain - .0962) < .00001);
  let s = await state(live);
  assert.equal(s.sound.volume, .37); assert.ok(Math.abs(s.sound.gain - .0962) < .00001);
  await live.getByRole('button', { name: 'MUTE SOUND', exact: true }).click();
  await live.waitForFunction(() => window.__emberglass.getState().sound.gain === 0);
  assert.equal((await state(live)).sound.gain, 0);
  await live.getByRole('button', { name: 'UNMUTE SOUND', exact: true }).click();
  await live.waitForFunction(() => window.__emberglass.getState().sound.gain > 0);
  assert.ok((await state(live)).sound.gain > 0);
  await live.keyboard.press('Tab');
  await live.getByRole('button', { name: 'RESUME [ESC / P]', exact: true }).focus();
  const focusOutline = await live.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.notEqual(focusOutline, 'none');
  await live.keyboard.press('Tab');
  assert.equal(await live.evaluate(() => document.activeElement.dataset.action), 'restart-trial');
  await live.keyboard.press('Enter');
  await live.waitForTimeout(80);
  s = await state(live); assert.equal(s.mode, 'playing'); assert.equal(s.trial, 1); assert.equal(s.score, 0);
  await live.keyboard.press('Escape');
  await live.getByRole('dialog').waitFor();
  await live.screenshot({ path: `${evidence}/pause-settings.png` });
  await auditScreen(live, 'pause');
  await live.keyboard.press('Escape');
  await live.waitForTimeout(80); assert.equal((await state(live)).mode, 'playing');
  await live.reload(); assert.equal((await state(live)).sound.volume, .37);
  checks.push('live RAF, Esc/P pause freeze/resume, volume gain, mute/unmute, keyboard focus, restart trial, settings reload');
  await live.close();

  // Seeded full campaign. Stepping the public 60 Hz hook accelerates time only;
  // mouse/keyboard events still use the shipped input controller and damage rules.
  const page = await browser.newPage({ viewport }); observe(page);
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`${origin}/?seed=20261116`);
  await page.getByRole('heading', { name: 'EMBERGLASS', exact: true }).click();
  await shot(page, '1-title.jpg');
  await auditScreen(page, 'title');
  await page.getByRole('button', { name: 'HOW TO PLAY', exact: true }).click();
  assert.match(await page.locator('#overlay-root').innerText(), /rime threats/i);
  await auditScreen(page, 'codex');
  await page.keyboard.press('Escape'); await tick(page);
  assert.equal(await page.locator('#btn-start-run').count(), 1);
  await page.getByRole('button', { name: 'TRIAL SELECT', exact: true }).click();
  assert.equal(await page.locator('[data-trial]:disabled').count(), 4);
  await page.screenshot({ path: `${evidence}/trials-fresh.png` });
  await auditScreen(page, 'trials-locked');
  await page.getByRole('button', { name: 'TITLE SCREEN [ESC]', exact: true }).click();
  await page.getByRole('button', { name: 'Apprentice (1.0x)', exact: true }).click();
  await page.getByRole('button', { name: 'START RUN [ENTER]', exact: true }).click();
  await page.evaluate(() => {
    window.botTick = 0;
    window.playCombatBatch = (stopFor = '') => {
      const api = window.__emberglass, canvas = document.querySelector('canvas');
      const key = code => { window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })); };
      const mouse = (type, x, y, button = 0) => canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true }));
      for (let i = 0; i < 500; i++) {
        const s = api.getState();
        if (s.mode !== 'playing') return s;
        // Screenshot stops: a trial-4 chain with foes on the field, then a settled phase-3 boss frame.
        const webUp = s.prisms.length >= 3 && s.screenFlash < .06;
        if (stopFor === 'gameplay' && s.trial === 4 && webUp && s.enemies.length >= 4 && s.beamCount >= 15) return s;
        if (stopFor === 'boss' && s.boss?.phase === 3 && s.boss.phaseGuardTimer === 0 && webUp && s.beamCount >= 3) return s;
        window.botTick++;
        if (s.prisms.length < Math.min(3, s.modifiers.maxPrisms) || (botTick % 90 === 0 && s.prismCharges >= 1)) {
          const slots = [0, 1, 2].map(n => ({ x: 640 + Math.cos(n * 2 * Math.PI / 3 - Math.PI / 2) * 140, y: 366 + Math.sin(n * 2 * Math.PI / 3 - Math.PI / 2) * 140 }));
          const slot = slots.find(pt => !s.prisms.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) < 70)) || slots[Math.floor(botTick / 90) % 3];
          mouse('mousedown', slot.x, slot.y, 2);
        }
        const target = s.prisms.reduce((a, p) => !a || Math.hypot(p.x - s.player.x, p.y - s.player.y) < Math.hypot(a.x - s.player.x, a.y - s.player.y) ? p : a, null)
          || s.pylons[0] || s.boss || s.enemies[0] || { x: 640, y: 240 };
        mouse('mousemove', target.x, target.y); mouse('mousedown', target.x, target.y);
        if (s.novaCharge >= 100) key('KeyF');
        const a = botTick * .035;
        const dx = 640 + Math.cos(a) * 95 - s.player.x, dy = 366 + Math.sin(a) * 95 - s.player.y;
        for (const [code, on] of [['KeyD', dx > 12], ['KeyA', dx < -12], ['KeyS', dy > 12], ['KeyW', dy < -12]]) {
          window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code, bubbles: true }));
        }
        if (s.player.dashCooldown === 0 && s.enemies.some(e => Math.hypot(e.x - s.player.x, e.y - s.player.y) < 55)) key('Space');
        api.stepFrames(6);
      }
      return api.getState();
    };
  });
  let gameplayCaptured = false, bossCaptured = false, victory = null;
  const drafts = [];
  for (let batch = 0; batch < 60; batch++) {
    let s = await page.evaluate(stop => window.playCombatBatch(stop), !gameplayCaptured ? 'gameplay' : !bossCaptured ? 'boss' : '');
    assert.notEqual(s.mode, 'gameover', 'campaign bot must win without cheats');
    if (!gameplayCaptured && s.mode === 'playing' && s.trial === 4 && s.enemies.length >= 4 && s.beamCount >= 15) {
      await shot(page, '2-gameplay.jpg'); gameplayCaptured = true;
      writeFileSync(`${evidence}/gameplay-state.json`, JSON.stringify(s, null, 2));
      continue;
    }
    if (gameplayCaptured && !bossCaptured && s.boss?.phase === 3 && s.beamCount >= 3) {
      await shot(page, '3-boss.jpg'); bossCaptured = true;
      writeFileSync(`${evidence}/boss-state.json`, JSON.stringify(s, null, 2));
      // Pause on trial 5 and restart; four relics and previous score must survive.
      await page.keyboard.press('p'); await tick(page);
      assert.equal((await state(page)).mode, 'paused');
      await page.getByRole('button', { name: 'RESTART TRIAL [R]', exact: true }).click();
      const restarted = await state(page);
      assert.equal(restarted.trial, 5); assert.equal(restarted.score, s.trialStartScore);
      assert.deepEqual(restarted.temperingIds, s.temperingIds);
      assert.equal(restarted.boss.phase, 1);
      checks.push('trial-5 restart preserves all four relics and entry score');
      continue;
    }
    if (s.mode === 'tempering') {
      await tick(page, 90);
      assert.equal(await page.locator('[data-tempering]').count(), 3);
      assert.equal(s.progression.apprentice[s.trial - 1].cleared, true);
      assert.ok(s.progression.apprentice[s.trial - 1].bestScore > 0);
      if (s.trial === 2) {
        await page.getByRole('heading', { name: 'CHOOSE YOUR UPGRADE' }).click();
        await auditScreen(page, 'upgrade');
      }
      await page.screenshot({ path: `${evidence}/upgrade-${s.trial}.png` });
      const priority = ['heartfire_mend', 'obsidian_edge', 'bifocal_facets', 'quicksilver_spindle', 'sunburst_core', 'crystalline_ward', 'chromatic_surge'];
      const choice = priority.map(id => s.draftChoices.find(c => c.id === id)).find(Boolean) || s.draftChoices[0];
      if (s.trial === 1) {
        await page.keyboard.press(String(s.draftChoices.findIndex(c => c.id === choice.id) + 1));
        await tick(page);
      } else await page.locator(`[data-tempering="${choice.id}"]`).click();
      const chosen = await state(page);
      assert.equal(chosen.mode, 'trials'); assert.equal(chosen.pendingTrial, s.trial + 1);
      assert.ok(chosen.temperingIds.includes(choice.id));
      assert.notDeepEqual(chosen.modifiers, s.modifiers);
      assert.equal(await page.locator(`[data-trial="${s.trial + 1}"]:not(:disabled)`).count(), 1);
      await page.screenshot({ path: `${evidence}/progression-${s.trial}.png` });
      if (s.trial === 4) {
        // Campaign map: four trials cleared, four relics forged, the boss node is next.
        assert.match(await page.locator('.campaign-scope').innerText(), /5\s*TRIALS\s*3\s*-PHASE BOSS\s*10\s*RELICS\s*6\s*FOE TYPES/);
        await page.getByRole('heading', { name: 'TRIAL SELECT', exact: true }).click();
        await shot(page, '4-scale.jpg');
      }
      if (s.trial === 2) await auditScreen(page, 'progression');
      drafts.push({ afterTrial: s.trial, picked: choice.id, trialBest: chosen.progression.apprentice[s.trial - 1].bestScore });
      await page.locator(`[data-trial="${s.trial + 1}"]`).click();
    }
    if (s.mode === 'victory') { victory = s; break; }
  }
  assert.ok(victory, 'full campaign reached victory'); assert.ok(gameplayCaptured, 'trial-4 chain captured with foes on the field'); assert.ok(bossCaptured, 'phase-3 boss fight captured with visible beams');
  assert.equal(victory.stats.trialsCleared, 5); assert.equal(victory.temperingIds.length, 4);
  assert.deepEqual(victory.stats.bossPhasesSeen, [1, 2, 3]);
  assert.ok(victory.progression.apprentice.every(t => t.cleared && t.bestScore > 0));
  await tick(page, 90);
  await page.getByRole('heading', { name: 'VICTORY', exact: true }).click();
  await page.screenshot({ path: `${evidence}/victory.png` });
  assert.match(await page.locator('.result-headline').innerText(), /5 \/ 5\s*TRIALS CLEARED[\s\S]*FINAL SCORE[\s\S]*4\s*RELICS FORGED/i);
  assert.equal(await page.locator('.stats-grid').getByText(/\d\d:\d\d/).count(), 0);
  await auditScreen(page, 'victory');
  writeFileSync(`${evidence}/victory-state.json`, JSON.stringify(victory, null, 2));
  await page.getByRole('button', { name: 'RESTART RUN [R]', exact: true }).click();
  assert.equal((await state(page)).mode, 'playing');
  assert.equal((await state(page)).trial, 1); assert.equal((await state(page)).score, 0);
  checks.push('victory results restart to a fresh trial-1 run');
  // Saved progress survives reload; it is isolated by difficulty and usable from title.
  await page.reload();
  await page.getByRole('button', { name: 'TRIAL SELECT', exact: true }).click();
  assert.equal(await page.locator('[data-trial]:disabled').count(), 0);
  await page.screenshot({ path: `${evidence}/progression-all-cleared.png` });
  await page.locator('[data-trial="3"]').click();
  let replay = await state(page); assert.equal(replay.trial, 3); assert.equal(replay.score, 0); assert.deepEqual(replay.temperingIds, []);
  checks.push('codex and Esc return, keyboard relic pick, full seeded campaign, 4 real relic picks, saved per-trial bests, unlocks, all 3 boss phases, title trial replay');

  // Defeat uses enemy attacks; no HP/state modification.
  await page.reload();
  await page.getByRole('button', { name: 'START RUN [ENTER]', exact: true }).click();
  for (let i = 0; i < 20 && (await state(page)).mode === 'playing'; i++) await tick(page, 300);
  const defeat = await state(page); assert.equal(defeat.mode, 'gameover');
  await page.screenshot({ path: `${evidence}/defeat.png` });
  await auditScreen(page, 'defeat');
  await page.getByRole('button', { name: 'RESTART RUN [R]', exact: true }).click();
  assert.equal((await state(page)).mode, 'playing'); assert.equal((await state(page)).trial, 1);
  checks.push('natural enemy-damage defeat and results restart to trial 1');
  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []); assert.deepEqual(failedRequests, []);
  const report = { browser: await browser.version(), viewport, seed: 20261116, checks, drafts,
    victory: { score: victory.score, trials: victory.stats.trialsCleared, bossPhases: victory.stats.bossPhasesSeen, runTime: victory.runTime },
    defeat: { mode: defeat.mode, playerHp: defeat.playerHp, lanternHp: defeat.lanternHp }, errors, externalRequests, failedRequests };
  writeFileSync(`${evidence}/playtest.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
