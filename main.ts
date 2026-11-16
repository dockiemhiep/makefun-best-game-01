// Handover entrypoint for EMBERGLASS (best-game-01, Node 22 standard library only).
// Copies static offline files from game/ and real browser renders from screenshots/
// into /output (or MAKEFUN_OUTPUT_DIR locally) and writes /output/dossier.json
// using the unmodified vendored buildDossier implementation.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, type DossierCaps } from './vendor/makefun-game.ts';

const SCORER_DOSSIER_CAPS: DossierCaps = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  game_max_files: 993,
  game_max_bytes: 50_331_648,
  game_path_max_bytes: 1_000,
};

function shouldCopyEntry(sourcePath: string): boolean {
  return basename(sourcePath) !== '.DS_Store';
}

export function stageEntryOutput(repoDir: string, targetDir: string): void {
  const sourceGameDir = join(repoDir, 'game');
  const sourceShotsDir = join(repoDir, 'screenshots');
  const stagedGameDir = join(targetDir, 'game');
  const stagedShotsDir = join(targetDir, 'screenshots');

  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceGameDir, stagedGameDir, { recursive: true, filter: shouldCopyEntry });

  mkdirSync(stagedShotsDir, { recursive: true });
  if (existsSync(sourceShotsDir)) {
    cpSync(sourceShotsDir, stagedShotsDir, { recursive: true, filter: shouldCopyEntry });
  }

  const dossierPayload = buildDossier(targetDir, SCORER_DOSSIER_CAPS);
  writeFileSync(join(targetDir, 'dossier.json'), dossierPayload);
}

const repositoryRoot = fileURLToPath(new URL('.', import.meta.url));
const destinationRoot = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
stageEntryOutput(repositoryRoot, destinationRoot);
