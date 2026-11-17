// Difficulty tiers and escalating enemy health/speed, independent of arena and enemy behavior.

export const DIFFICULTY_MODES = {
  apprentice: {
    id: 'apprentice',
    label: 'Apprentice',
    subtitle: 'Generous Heart-Lantern warmth & gentler enemy pace',
    enemyHpScale: 0.82,
    enemySpeedScale: 0.86,
    lanternMaxHp: 130,
    playerMaxHp: 6,
    scoreMult: 1.0,
  },
  artisan: {
    id: 'artisan',
    label: 'Artisan',
    subtitle: 'Standard Crucible balance · 1.25x score multiplier',
    enemyHpScale: 1.0,
    enemySpeedScale: 1.0,
    lanternMaxHp: 100,
    playerMaxHp: 5,
    scoreMult: 1.25,
  },
  masterwork: {
    id: 'masterwork',
    label: 'Masterwork',
    subtitle: 'Fierce rime surges & ruthless boss cadence · 1.6x score',
    enemyHpScale: 1.24,
    enemySpeedScale: 1.14,
    lanternMaxHp: 85,
    playerMaxHp: 4,
    scoreMult: 1.6,
  },
};

export function scaleEnemyForTrial(spec, difficulty, trial) {
  const tier = DIFFICULTY_MODES[difficulty] || DIFFICULTY_MODES.artisan;
  return {
    maxHp: Math.round(spec.hp * tier.enemyHpScale * (1 + (trial - 1) * 0.14)),
    speed: spec.speed * tier.enemySpeedScale,
  };
}
