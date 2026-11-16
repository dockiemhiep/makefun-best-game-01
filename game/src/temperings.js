// Between-trial Forged Tempering relic catalog, choice roller, and modifier solver.

export const TEMPERING_CATALOG = [
  {
    id: 'bifocal_facets',
    name: 'Bifocal Facets',
    tag: 'Refraction',
    desc: '+1 max Prism on field (up to 4+) and +1 extra beam bounce depth.',
    apply(mods) {
      mods.maxPrisms += 1;
      mods.maxBounces += 1;
    },
  },
  {
    id: 'quicksilver_spindle',
    name: 'Quicksilver Spindle',
    tag: 'Cadence',
    desc: '+28% primary Ember Bolt fire rate and +18% Weaver movement speed.',
    apply(mods) {
      mods.fireRateMult *= 1.28;
      mods.moveSpeedMult *= 1.18;
    },
  },
  {
    id: 'heartfire_mend',
    name: 'Heartfire Mend',
    tag: 'Sanctuary',
    desc: 'Restores +30 Lantern warmth now; x6+ combo kills heal the Heart-Lantern.',
    immediateLanternHeal: 30,
    immediatePlayerHeal: 1,
    apply(mods) {
      mods.comboLanternHeal += 1.4;
    },
  },
  {
    id: 'phase_detonator',
    name: 'Phase Detonator',
    tag: 'Mobility',
    desc: 'Phase Dash cooldown -25% and leaves a volatile solar nova on takeoff.',
    apply(mods) {
      mods.dashCooldownMult *= 0.75;
      mods.dashNovaDamage += 42;
    },
  },
  {
    id: 'chromatic_surge',
    name: 'Chromatic Surge',
    tag: 'Overdrive',
    desc: '+40% Resonance Overdrive gain and Kiln Supernova deals +35% damage.',
    apply(mods) {
      mods.novaGainMult *= 1.4;
      mods.novaDamageMult *= 1.35;
    },
  },
  {
    id: 'obsidian_edge',
    name: 'Obsidian Edge',
    tag: 'Potency',
    desc: '+26% bolt & refracted beam damage; flanking armored foes deals +40% bonus.',
    apply(mods) {
      mods.damageMult *= 1.26;
      mods.flankBonusMult *= 1.4;
    },
  },
  {
    id: 'lodestone_weave',
    name: 'Lodestone Weave',
    tag: 'Harvest',
    desc: '+85% Glass Shard pickup pull radius and each shard grants +15% Prism charge.',
    apply(mods) {
      mods.magnetRadiusMult *= 1.85;
      mods.shardChargeMult *= 1.3;
    },
  },
  {
    id: 'twin_crucible',
    name: 'Twin Crucible',
    tag: 'Barrage',
    desc: 'Every 3rd primary shot fires twin angled Ember Bolts at once.',
    apply(mods) {
      mods.twinEveryThird = true;
    },
  },
  {
    id: 'crystalline_ward',
    name: 'Crystalline Ward',
    tag: 'Durability',
    desc: '+1 max Weaver Hull heart immediately and Prisms gain +6 durability.',
    immediateMaxHull: 1,
    apply(mods) {
      mods.prismDurabilityBonus += 6;
    },
  },
  {
    id: 'sunburst_core',
    name: 'Sunburst Core',
    tag: 'Area',
    desc: 'All Prism novas & shatter bursts expand +35% wider and burn lingering foes.',
    apply(mods) {
      mods.novaRadiusMult *= 1.35;
      mods.damageMult *= 1.12;
    },
  },
];

export function createBaseModifiers() {
  return {
    maxPrisms: 3,
    maxBounces: 4,
    fireRateMult: 1.0,
    moveSpeedMult: 1.0,
    damageMult: 1.0,
    flankBonusMult: 1.0,
    dashCooldownMult: 1.0,
    dashNovaDamage: 0,
    novaGainMult: 1.0,
    novaDamageMult: 1.0,
    magnetRadiusMult: 1.0,
    shardChargeMult: 1.0,
    twinEveryThird: false,
    prismDurabilityBonus: 0,
    comboLanternHeal: 0,
    novaRadiusMult: 1.0,
  };
}

export function computeTemperingModifiers(ownedIds) {
  const mods = createBaseModifiers();
  for (const id of ownedIds) {
    const spec = TEMPERING_CATALOG.find((item) => item.id === id);
    if (spec) spec.apply(mods);
  }
  return mods;
}

export function rollTemperingChoices(rng, ownedIds, count = 3) {
  const unowned = TEMPERING_CATALOG.filter((item) => !ownedIds.includes(item.id));
  const pool = unowned.length >= count ? unowned : TEMPERING_CATALOG;
  return rng.shuffle(pool).slice(0, count);
}
