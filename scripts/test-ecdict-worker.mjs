import assert from 'node:assert/strict';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const worker = new Worker(path.join(root, 'out', 'ecdictWorker.js'));
const rssBeforeLookup = process.memoryUsage().rss;

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
      dictionaryPath: path.join(root, 'scripts', 'ecdict')
    });
  });
}

const result = await lookup(1, 'algorithm');
assert.equal(result.word, 'algorithm');
assert.ok(result.definitions.some(item => item.translation?.includes('算法')));
assert.equal(await lookup(2, 'definitely-not-an-ecdict-word-xyz'), undefined);
const rssGrowth = process.memoryUsage().rss - rssBeforeLookup;
assert.ok(
  rssGrowth < 128 * 1024 * 1024,
  `dictionary lookup should stay below 128 MiB RSS growth, observed ${Math.round(rssGrowth / 1024 / 1024)} MiB`
);

await worker.terminate();
console.log(`ECDICT worker tests passed (${Math.round(rssGrowth / 1024 / 1024)} MiB RSS growth).`);
