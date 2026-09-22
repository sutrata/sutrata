import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const files = [
  ['src/shell/fonts/fonts.css', 'dist/shell/fonts/fonts.css'],
  ['src/styles/screenplay.css', 'dist/styles/screenplay.css'],
  ['src/desktop-api.d.ts', 'dist/desktop-api.d.ts'],
];

for (const [from, to] of files) {
  mkdirSync(dirname(join(root, to)), { recursive: true });
  copyFileSync(join(root, from), join(root, to));
}
