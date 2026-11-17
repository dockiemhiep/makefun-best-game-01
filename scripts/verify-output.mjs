// Verify the handover tree independently of main.ts, using the kit's unchanged dossier builder.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier, readGameTree, htmlFacts, sourceImports, resolveGamePath } from '../vendor/makefun-game.ts';
const output = resolve(process.argv[2] || '/output');
const caps = { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648, game_path_max_bytes: 1000 };
assert.deepEqual(readdirSync(output).sort(), ['dossier.json', 'game', 'screenshots']);
const tree = readGameTree(join(output, 'game'), caps);
for (const file of tree.files) {
  assert.ok(lstatSync(join(output, 'game', file.path)).isFile());
  assert.deepEqual(readFileSync(join(output, 'game', file.path)), readFileSync(join('game', file.path)), file.path);
}
const names = ['1-title.jpg', '2-boss.jpg', '3-trials.jpg', '4-victory.jpg'];
assert.deepEqual(readdirSync(join(output, 'screenshots')).sort(), names);
assert.deepEqual(JSON.parse(readFileSync('shots.json')).map(s => s.name), names);
function jpegDimensions(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9);
  let offset = 2;
  while (offset < bytes.length) {
    assert.equal(bytes[offset], 0xff);
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    offset += 2 + length;
  }
  throw new Error('JPEG has no frame header');
}
const screenshots = names.map(name => {
  const bytes = readFileSync(join(output, 'screenshots', name));
  assert.ok(bytes.length < 262144, name);
  assert.deepEqual(bytes, readFileSync(join('screenshots', name)));
  assert.deepEqual(jpegDimensions(bytes), { width: 1280, height: 720 });
  return { name, bytes: bytes.length, width: 1280, height: 720 };
});
const dossierBytes = readFileSync(join(output, 'dossier.json'));
assert.ok(dossierBytes.length <= 1572864);
assert.deepEqual(dossierBytes, Buffer.from(buildDossier(output, caps)));
const dossier = JSON.parse(dossierBytes);
assert.equal(dossier.schema, 'makefun/dossier/v1');
// All static imports and page references resolve to ordinary files inside game/.
const sources = new Set(tree.files.map(f => f.path));
const facts = htmlFacts(readFileSync(join(output, 'game/index.html'), 'utf8'));
function verifyRef(ref, from) {
  if (ref.startsWith('data:')) return;
  assert.ok(!/^(?:[a-z]+:|\/\/)/i.test(ref), `${from}: ${ref}`);
  const resolved = ref.startsWith('/') ? ref.slice(1) : resolveGamePath(ref, from);
  assert.ok(resolved && sources.has(resolved), `${from}: ${ref}`);
}
for (const file of tree.files.filter(f => /\.(?:m?js)$/.test(f.path))) {
  for (const ref of sourceImports(readFileSync(join(output, 'game', file.path), 'utf8'))) verifyRef(ref, file.path);
}
assert.equal(facts.importMaps.length, 0);
for (const script of facts.scripts) if (script.src) verifyRef(script.src, 'index.html');
for (const link of facts.links) verifyRef(link.href, 'index.html');
for (const resource of facts.resources) verifyRef(resource.src, 'index.html');
console.log(JSON.stringify({ output, gameFiles: tree.files.length, screenshots, dossierBytes: dossierBytes.length, dossierMatches: true, staticReferences: 'all local' }, null, 2));
