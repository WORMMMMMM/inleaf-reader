import { parentPort } from 'worker_threads';
import { readFile } from 'fs/promises';
import { gunzip } from 'zlib';
import { promisify } from 'util';

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

let dictionaryPromise: Promise<Record<string, DictionaryEntry>> | undefined;

parentPort?.on('message', async (request: LookupRequest) => {
  try {
    dictionaryPromise ??= loadDictionary(request.dictionaryPath);
    const dictionary = await dictionaryPromise;
    const word = request.word.trim();
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

async function loadDictionary(dictionaryPath: string) {
  const compressed = await readFile(dictionaryPath);
  const bytes = await gunzipAsync(compressed);
  return JSON.parse(bytes.toString('utf8')) as Record<string, DictionaryEntry>;
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
