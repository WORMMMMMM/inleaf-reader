import { parentPort } from 'worker_threads';
import { readFile } from 'fs/promises';
import { gunzip } from 'zlib';
import { promisify } from 'util';
import * as path from 'path';

const gunzipAsync = promisify(gunzip);

interface DictionaryEntry {
  p?: string;
  t?: string[] | string;
  d?: string[] | string;
  pos?: string[] | string;
}

interface LookupRequest {
  id: number;
  dictionaryPath: string;
  word: string;
}

interface DictionaryManifest {
  format: 'inleaf-ecdict-shards';
  version: 1;
  bucketCount: number;
}

const MAX_CACHED_SHARDS = 4;
let manifestPromise: Promise<DictionaryManifest> | undefined;
const shardCache = new Map<number, Promise<Record<string, DictionaryEntry>>>();

parentPort?.on('message', async (request: LookupRequest) => {
  try {
    const word = request.word.trim();
    const dictionary = await loadShard(request.dictionaryPath, word);
    const entry = dictionary[word] || dictionary[word.toLowerCase()];
    parentPort?.postMessage({
      id: request.id,
      result: entry ? {
        word,
        phonetic: entry.p || undefined,
        definitions: entryToDefinitions(entry)
      } : undefined
    });
  } catch (error) {
    parentPort?.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

async function loadShard(dictionaryPath: string, word: string) {
  manifestPromise ??= loadManifest(dictionaryPath);
  const manifest = await manifestPromise;
  const bucket = hashWord(word.toLowerCase()) % manifest.bucketCount;
  const cached = shardCache.get(bucket);
  if (cached) {
    shardCache.delete(bucket);
    shardCache.set(bucket, cached);
    return cached;
  }

  const shard = readCompressedJson<Record<string, DictionaryEntry>>(
    path.join(dictionaryPath, `${bucket.toString(16).padStart(2, '0')}.json.gz`)
  );
  shardCache.set(bucket, shard);
  while (shardCache.size > MAX_CACHED_SHARDS) {
    const oldestBucket = shardCache.keys().next().value as number | undefined;
    if (oldestBucket !== undefined) {
      shardCache.delete(oldestBucket);
    }
  }
  return shard;
}

async function loadManifest(dictionaryPath: string) {
  const manifest = JSON.parse(
    await readFile(path.join(dictionaryPath, 'manifest.json'), 'utf8')
  ) as Partial<DictionaryManifest>;
  if (
    manifest.format !== 'inleaf-ecdict-shards' ||
    manifest.version !== 1 ||
    !Number.isInteger(manifest.bucketCount) ||
    (manifest.bucketCount ?? 0) < 1
  ) {
    throw new Error('Unsupported offline dictionary format.');
  }
  return manifest as DictionaryManifest;
}

async function readCompressedJson<T>(filePath: string) {
  const compressed = await readFile(filePath);
  const bytes = await gunzipAsync(compressed);
  return JSON.parse(bytes.toString('utf8')) as T;
}

function hashWord(word: string) {
  let hash = 0x811c9dc5;
  for (const byte of Buffer.from(word, 'utf8')) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function entryToDefinitions(entry: DictionaryEntry) {
  const translations = normalizeLines(entry.t);
  const definitions = normalizeLines(entry.d);
  const partsOfSpeech = normalizeLines(entry.pos);
  const count = Math.max(translations.length, definitions.length);
  const result: Array<{ pos: string; meaning: string; translation?: string }> = [];

  for (let index = 0; index < count; index += 1) {
    const [translationPos, translation] = splitDefinition(translations[index] || '');
    const [definitionPos, meaning] = splitDefinition(definitions[index] || '');
    result.push({
      pos: translationPos || partsOfSpeech[index] || definitionPos,
      meaning,
      translation: translation || undefined
    });
  }
  return result;
}

function normalizeLines(value?: string[] | string) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  return typeof value === 'string'
    ? value.split('\\n').map(item => item.trim()).filter(Boolean)
    : [];
}

function splitDefinition(value: string): [string, string] {
  const match = value.match(/^(definite article|indefinite article|def\. article|def art\.|adj\.|adv\.|conj\.|int\.|interj\.|n\.|prep\.|pron\.|vt\.& vi\.|vt\.|vi\.|v\.|a\.|s\.|abbr\.|aux\.|det\.|pref\.|suf\.|suff\.)\s*(.*)$/);
  return match ? [match[1], match[2]] : ['', value];
}
