import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appDir = path.join(rootDir, 'app');
const outputDir = path.join(rootDir, 'public');
const outputAppDir = path.join(outputDir, 'app');

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });
await fs.cp(appDir, outputAppDir, {
  recursive: true,
  filter: (source) => !source.includes(`${path.sep}.DS_Store`)
});

console.log('SIPAGI static app prepared in public/app');
