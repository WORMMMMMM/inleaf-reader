import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'node_modules', 'pdfjs-dist');
const targetRoot = path.join(root, 'media', 'pdfjs-dist');

await rm(targetRoot, { recursive: true, force: true });
await mkdir(targetRoot, { recursive: true });
await Promise.all([
  cp(path.join(sourceRoot, 'cmaps'), path.join(targetRoot, 'cmaps'), { recursive: true }),
  cp(path.join(sourceRoot, 'standard_fonts'), path.join(targetRoot, 'standard_fonts'), {
    recursive: true
  })
]);

console.log('Copied PDF.js CMaps and standard fonts into media/pdfjs-dist.');
