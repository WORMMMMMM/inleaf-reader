import { createHash } from 'crypto';
import { open, stat } from 'fs/promises';
import * as path from 'path';

const SAMPLE_BYTES = 1024 * 1024;

export const PDF_LOCATION_INDEX_KEY = 'readingExtension.pdfLocationIndex.v1';

export type SidecarKind =
  | 'annotations'
  | 'annotations.md'
  | 'annotated.pdf'
  | 'wordbook'
  | 'progress';

export interface PdfLocation {
  pdfPath: string;
  storageDir: string;
  baseName: string;
  updatedAt: string;
}

export type PdfLocationIndex = Record<string, PdfLocation[]>;

export type SidecarPaths = Record<SidecarKind, string>;

export const SIDECAR_KINDS: SidecarKind[] = [
  'annotations',
  'annotations.md',
  'annotated.pdf',
  'wordbook',
  'progress'
];

export function createPdfLocation(pdfPath: string, updatedAt = new Date().toISOString()): PdfLocation {
  const resolvedPath = path.resolve(pdfPath);
  return {
    pdfPath: resolvedPath,
    storageDir: path.join(path.dirname(resolvedPath), '.reading-extension'),
    baseName: path.basename(resolvedPath),
    updatedAt
  };
}

export function getSidecarPaths(location: PdfLocation): SidecarPaths {
  const prefix = path.join(location.storageDir, location.baseName);
  return {
    annotations: `${prefix}.annotations.json`,
    'annotations.md': `${prefix}.annotations.md`,
    'annotated.pdf': `${prefix}.annotated.pdf`,
    wordbook: `${prefix}.wordbook.json`,
    progress: `${prefix}.progress.json`
  };
}

export async function fingerprintPdf(pdfPath: string): Promise<string> {
  const fileStat = await stat(pdfPath);
  const hash = createHash('sha256');
  hash.update('reading-extension-pdf-sample-v1\0');
  hash.update(String(fileStat.size));

  const handle = await open(pdfPath, 'r');
  try {
    const sampleLength = Math.min(SAMPLE_BYTES, fileStat.size);
    const positions = Array.from(
      new Set([
        0,
        Math.max(0, Math.floor((fileStat.size - sampleLength) / 2)),
        Math.max(0, fileStat.size - sampleLength)
      ])
    );

    for (const position of positions) {
      const buffer = Buffer.alloc(sampleLength);
      const { bytesRead } = await handle.read(buffer, 0, sampleLength, position);
      hash.update(String(position));
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    await handle.close();
  }

  return hash.digest('hex');
}

export function addLocationToIndex(
  index: PdfLocationIndex,
  fingerprint: string,
  location: PdfLocation,
  maximumLocations = 8
): PdfLocationIndex {
  const otherLocations = (index[fingerprint] ?? []).filter(
    candidate => path.resolve(candidate.pdfPath) !== location.pdfPath
  );
  return {
    ...index,
    [fingerprint]: [location, ...otherLocations].slice(0, maximumLocations)
  };
}
