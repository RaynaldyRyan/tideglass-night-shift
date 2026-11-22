// Tideglass: Night Shift — the entry program (Node 22, standard library only).
// It hands the game in: it copies this repository's game/ and screenshots/
// beside this file into /output and writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library. The game itself is
// plain static files a desktop browser loads offline: game/index.html and its
// ES modules, no library and no network request.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

mkdirSync(outputDir, { recursive: true });
cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
const dossierPath = join(outputDir, 'dossier.json');
writeFileSync(dossierPath, dossier);

// Report what was handed in, so a run's result is visible at a glance: the
// dossier's bytes against its 1.5 MiB cap, and the screenshot count and bytes.
const shotFiles = readdirSync(join(outputDir, 'screenshots')).filter((name) => !name.startsWith('.'));
const shotBytes = shotFiles.reduce(
  (sum, name) => sum + statSync(join(outputDir, 'screenshots', name)).size,
  0,
);
console.log(
  `Tideglass handed in: dossier ${statSync(dossierPath).size} bytes, ` +
    `${shotFiles.length} screenshots (${shotBytes} bytes), game/ copied.`,
);
