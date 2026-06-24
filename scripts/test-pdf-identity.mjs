import assert from 'node:assert/strict';
import { mkdtemp, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  addLocationToIndex,
  createPdfLocation,
  fingerprintPdf,
  getSidecarPaths
} from '../out/pdfIdentity.js';

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'reading-extension-identity-'));
const originalPdf = path.join(temporaryDirectory, 'paper.pdf');
const renamedPdf = path.join(temporaryDirectory, 'renamed.pdf');
const contents = Buffer.alloc(3 * 1024 * 1024, 7);
await writeFile(originalPdf, contents);

const originalFingerprint = await fingerprintPdf(originalPdf);
await rename(originalPdf, renamedPdf);
assert.equal(await fingerprintPdf(renamedPdf), originalFingerprint);

contents[contents.length - 1] = 9;
await writeFile(renamedPdf, contents);
assert.notEqual(await fingerprintPdf(renamedPdf), originalFingerprint);

const originalLocation = createPdfLocation(originalPdf, '2026-06-20T00:00:00.000Z');
const renamedLocation = createPdfLocation(renamedPdf, '2026-06-21T00:00:00.000Z');
const paths = getSidecarPaths(renamedLocation);
assert.equal(paths.wordbook, path.join(temporaryDirectory, '.reading-extension', 'renamed.pdf.wordbook.json'));

const index = addLocationToIndex({}, originalFingerprint, originalLocation);
const updatedIndex = addLocationToIndex(index, originalFingerprint, renamedLocation);
assert.deepEqual(
  updatedIndex[originalFingerprint].map(location => location.pdfPath),
  [renamedPdf, originalPdf]
);

console.log('PDF identity tests passed.');
