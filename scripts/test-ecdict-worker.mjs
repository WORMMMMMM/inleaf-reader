import assert from 'node:assert/strict';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const worker = new Worker(path.join(root, 'out', 'ecdictWorker.js'));

function lookup(id, word) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Lookup timed out: ${word}`)), 15000);
    const listener = message => {
      if (message.id !== id) return;
      clearTimeout(timeout);
      worker.off('message', listener);
      message.error ? reject(new Error(message.error)) : resolve(message.result);
    };
    worker.on('message', listener);
    worker.postMessage({
      id,
      word,
      dictionaryPath: path.join(root, 'scripts', 'ecdict_compact.json.gz')
    });
  });
}

const result = await lookup(1, 'algorithm');
assert.equal(result.word, 'algorithm');
assert.ok(result.definitions.some(item => item.translation?.includes('算法')));
assert.equal(await lookup(2, 'definitely-not-an-ecdict-word-xyz'), undefined);

await worker.terminate();
console.log('ECDICT worker tests passed.');
