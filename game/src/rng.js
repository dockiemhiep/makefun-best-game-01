//Deterministic Mulberry32 PRNG and spatial random helpers for EMBERGLASS.

export function createSeededRng(initialSeed = 1337) {
  let state = (Number(initialSeed) >>> 0) || 0x6d2b79f5;

  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min, max) {
    return min + (max - min) * next();
  }

  function int(min, maxInclusive) {
    return Math.floor(range(min, maxInclusive + 1));
  }

  function chance(probability) {
    return next() < probability;
  }

  function pick(items) {
    if (!items || items.length === 0) return undefined;
    return items[Math.floor(next() * items.length)];
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  return { next, range, int, chance, pick, shuffle };
}
