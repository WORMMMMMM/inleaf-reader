import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import Module, { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function loadSource(file, mocks = {}, globals = {}) {
  const filename = new URL(`../${file}`, import.meta.url);
  const localRequire = createRequire(filename);
  const exports = {};
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true
    }
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: id => (id in mocks ? mocks[id] : localRequire(id)),
    AbortController,
    AbortSignal,
    Error,
    TypeError,
    URL,
    setTimeout,
    clearTimeout,
    console,
    ...globals
  }, { filename: filename.pathname });
  return exports;
}

// 1. i18n parity and resolution
const { EN_MESSAGES, ZH_MESSAGES, createTranslator, resolveLocale } = require('../out/i18n.js');
assert.equal(resolveLocale('zh-cn'), 'zh');
assert.equal(resolveLocale('zh-TW'), 'zh');
assert.equal(resolveLocale('en-US'), 'en');
assert.equal(resolveLocale(undefined), 'en');
assert.deepEqual(
  Object.keys(ZH_MESSAGES).sort(),
  Object.keys(EN_MESSAGES).sort(),
  'ZH_MESSAGES and EN_MESSAGES must share the exact same key set'
);
for (const [key, value] of Object.entries(ZH_MESSAGES)) {
  assert.ok(typeof value === 'string' && value.trim().length > 0, `Empty zh message for ${key}`);
}
const zhT = createTranslator('zh');
assert.equal(zhT('jumpToPage', { page: 12 }), '跳转到第 12 页');

// 2. Smart CJK / English text joining & selection context extraction
const { joinPdfTextPieces, buildSelectionContextFromParts } = loadSource('webview/src/pdfSelection.ts');
assert.equal(
  joinPdfTextPieces(['传统中国文化', '注重现世的道德修为', '，', '强调学以致用。']),
  '传统中国文化注重现世的道德修为，强调学以致用。',
  'CJK fragments should join without spurious spaces'
);
assert.equal(
  joinPdfTextPieces(['Trans-', 'former', 'models', 'align', 'tokens.']),
  'Transformer models align tokens.',
  'Hyphenated English line breaks should heal cleanly'
);
assert.equal(
  joinPdfTextPieces(['西方哲学', '与', 'AI', 'tools', '的结合']),
  '西方哲学与AI tools的结合'
);
const ctx = buildSelectionContextFromParts(
  'First sentence ends here. In modern architectures, attention mechanisms allow',
  'transformers',
  'to model long-range dependencies effectively. Next sentence starts here.'
);
assert.match(ctx.sentence, /In modern architectures, attention mechanisms allow transformers to model long-range dependencies effectively\./);
assert.ok(ctx.contextBefore.endsWith('allow'));
assert.ok(ctx.contextAfter.startsWith('to model'));

// 3. Annotation payload with tags, context, area selection & AI citation formatting
const {
  AREA_SELECTION_PLACEHOLDER,
  buildAnnotationPayload,
  collectFrequentTags,
  formatAiSelectionCitation
} = loadSource('webview/src/annotationModel.ts');

const areaPayload = buildAnnotationPayload(
  {
    selectedText: '',
    isArea: true,
    currentPage: 5,
    selectionPosition: {
      boundingRect: { x1: 10, y1: 20, x2: 110, y2: 120, width: 500, height: 700, pageNumber: 5 },
      rects: []
    }
  },
  { color: '#8fd3ff', kind: 'highlight', note: 'Equation 3', tags: ['formula', 'Key'] }
);
assert.ok(areaPayload);
assert.equal(areaPayload.selectedText, AREA_SELECTION_PLACEHOLDER);
assert.deepEqual(Array.from(areaPayload.tags), ['formula', 'key']);

const citation = formatAiSelectionCitation({
  paperName: 'attention.pdf',
  page: 4,
  selectedText: 'Attention is all you need.',
  contextBefore: 'We propose a simple network architecture.',
  contextAfter: 'It relies solely on attention.'
});
assert.match(citation, /Source: attention\.pdf \(PDF p\.4\)/);
assert.match(citation, /> Attention is all you need\./);
assert.match(citation, /Context: \.\.\.We propose/);

assert.deepEqual(
  Array.from(collectFrequentTags([
    { tags: ['method', 'core'] },
    { tags: ['core'] },
    { tags: ['question'] }
  ], 2)),
  ['core', 'method']
);

// 4. PDF outline extraction & active section detection
const { extractPdfOutline, findActiveOutlineId } = loadSource('webview/src/pdfOutline.ts');
const fakeOutlineDoc = {
  getOutline: async () => [
    {
      title: '1 Introduction',
      dest: 'intro',
      items: [{ title: '1.1 Background', dest: [{ num: 2 }] }]
    },
    { title: '2 Methods', dest: [5] }
  ],
  getDestination: async name => (name === 'intro' ? [{ num: 0 }] : null),
  getPageIndex: async ref => ref.num
};
const outline = await extractPdfOutline(fakeOutlineDoc);
assert.equal(outline.length, 2);
assert.equal(outline[0].pageNumber, 1);
assert.equal(outline[0].items[0].pageNumber, 3);
assert.equal(outline[1].pageNumber, 6);
assert.equal(findActiveOutlineId(outline, 4), outline[0].items[0].id);
assert.equal(findActiveOutlineId(outline, 7), outline[1].id);

// 5. Full-text search across CJK & English pages + cancellation
const { PdfTextSearchCache } = loadSource('webview/src/pdfSearch.ts', {
  './pdfSelection': { joinPdfTextPieces }
});
const searchCache = new PdfTextSearchCache();
const fakeSearchDoc = {
  numPages: 2,
  getPage: async pageNum => ({
    getTextContent: async () => ({
      items: pageNum === 1
        ? [{ str: '西方' }, { str: '哲学史' }, { str: '导论' }]
        : [{ str: 'Trans-' }, { str: 'former' }, { str: ' and 西方哲学' }]
    })
  })
};
const cjkHits = await searchCache.search(fakeSearchDoc, '西方哲学', () => false);
assert.equal(cjkHits.length, 2);
assert.equal(cjkHits[0].pageNumber, 1);
assert.equal(cjkHits[1].pageNumber, 2);
const enHits = await searchCache.search(fakeSearchDoc, 'transformer', () => false);
assert.equal(enHits.length, 1);
assert.equal(enHits[0].pageNumber, 2);
const cancelledHits = await searchCache.search(fakeSearchDoc, '西方', () => true);
assert.equal(cancelledHits.length, 0);

// 6. Wordbook Markdown & Anki CSV export + ReaderStorage updateWord/writeActiveContext
const { formatWordbookAnkiCsv, formatWordbookMarkdown } = require('../out/wordbookExports.js');
const sampleWords = [
  {
    id: 'w1',
    word: 'epistemology',
    phonetic: '/ɪˌpɪstəˈmɒlədʒi/',
    translation: '认识论',
    definitions: [{ pos: 'n.', meaning: 'theory of knowledge', translation: '认识论' }],
    sentence: 'Modern epistemology questions the foundations of certainty.',
    note: 'Core philosophical term, Chapter 2',
    page: 14,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
];
const wbMd = formatWordbookMarkdown('book.pdf', sampleWords);
assert.match(wbMd, /## epistemology/);
assert.match(wbMd, /Modern epistemology questions/);
assert.match(wbMd, /- Page: 14/);
const wbCsv = formatWordbookAnkiCsv(sampleWords);
assert.match(wbCsv, /^Word,Phonetic,Translation,Definitions,Sentence,Note,Page/);
assert.match(wbCsv, /"Core philosophical term, Chapter 2"/);

// 7. OpenAI-compatible provider keyless localhost + remote key check
const identity = require('../out/identity.js');
const translationContract = require('../out/translationContract.js');
let capturedUrl = '';
let capturedHeaders = null;
const ollamaConfig = {
  get: key => ({
    translationProvider: 'openai',
    openAiBaseUrl: 'http://localhost:11434/v1',
    openAiModel: 'qwen2.5:7b',
    translationTarget: 'zh'
  })[key]
};
const { TranslationService } = loadSource('src/translationService.ts', {
  vscode: { workspace: { getConfiguration: () => ollamaConfig } },
  './identity': identity,
  './translationContract': translationContract,
  './argosTranslationDaemon': { ArgosTranslationDaemon: class { dispose() {} } },
  './ecdictClient': { EcdictClient: class { dispose() {} } }
}, {
  fetch: async (url, options) => {
    capturedUrl = url;
    capturedHeaders = options.headers;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: '本地模型译文' } }] })
    };
  }
});
const localService = new TranslationService({ fsPath: '/tmp' }, { get: async () => undefined });
const localResult = await localService.translate('A full sentence for local translation.');
assert.equal(localResult.translatedText, '本地模型译文');
assert.equal(capturedUrl, 'http://localhost:11434/v1/chat/completions');
assert.equal('Authorization' in capturedHeaders, false, 'Local keyless endpoint should omit Authorization header');
localService.dispose();

// 8. Manifest omits customEditors interception, areaSelectMode works without altKey, & storage updateWord / active-context.json
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(manifest.contributes.customEditors, undefined, 'Custom PDF editor should not intercept default opening');
assert.equal(manifest.activationEvents.some(event => event.startsWith('onCustomEditor:')), false);

const reactMock = {
  useRef: value => ({ current: value }),
  useCallback: fn => fn,
  useEffect: () => {},
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } })
};
const { PdfDocumentView } = loadSource('webview/src/components/PdfDocumentView.tsx', {
  react: reactMock,
  'react-pdf-highlighter-plus': { PdfHighlighter: 'highlighter', scaledPositionToViewport: value => value },
  '../pdfSearch': { computePageSearchRects: () => [] },
  '../pdfSelection': { markPageSelectionRegions() {} },
  '../selectionShade': { trackSelectionShade() {} }
});
const defaultTree = PdfDocumentView({
  pdfDocument: { numPages: 1 },
  highlights: [],
  zoom: 'page-width',
  areaSelectMode: false,
  onDocumentReady() {},
  onOpen() {},
  onPageChange() {},
  onPinchZoom() {},
  onSelection() {},
  utilsRef() {}
});
assert.equal(defaultTree.props.enableAreaSelection({ altKey: false }), false);
assert.equal(defaultTree.props.enableAreaSelection({ altKey: true }), true);
const areaModeTree = PdfDocumentView({
  pdfDocument: { numPages: 1 },
  highlights: [],
  zoom: 'page-width',
  areaSelectMode: true,
  onDocumentReady() {},
  onOpen() {},
  onPageChange() {},
  onPinchZoom() {},
  onSelection() {},
  utilsRef() {}
});
assert.equal(areaModeTree.props.enableAreaSelection({ altKey: false }), true);

// Storage test for updateWord, exportWordbookMarkdown/Csv, writeActiveContext
class Uri {
  constructor(fsPath) { this.fsPath = fsPath; }
  static file(value) { return new Uri(value); }
  static joinPath(base, ...parts) { return new Uri(path.join(base.fsPath, ...parts)); }
}
class FileSystemError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}
async function withFileError(op) {
  try { return await op(); }
  catch (err) { if (err?.code === 'ENOENT') throw new FileSystemError(err.message, 'FileNotFound'); throw err; }
}
const vscodeMock = {
  Uri,
  FileSystemError,
  workspace: {
    fs: {
      createDirectory: uri => mkdir(uri.fsPath, { recursive: true }),
      readFile: uri => withFileError(() => readFile(uri.fsPath)),
      writeFile: (uri, bytes) => writeFile(uri.fsPath, bytes),
      copy: (s, d, opts) => copyFile(s.fsPath, d.fsPath, opts?.overwrite ? 0 : 1),
      rename: async (s, d, opts) => {
        if (opts?.overwrite) {
          try { await unlink(d.fsPath); } catch (err) { if (err?.code !== 'ENOENT') throw err; }
        }
        await rename(s.fsPath, d.fsPath);
      },
      delete: uri => unlink(uri.fsPath),
      stat: uri => withFileError(() => stat(uri.fsPath))
    }
  }
};
const originalLoad = Module._load;
Module._load = (req, parent, isMain) => (req === 'vscode' ? vscodeMock : originalLoad.call(Module, req, parent, isMain));
try {
  delete require.cache[require.resolve('../out/readerStorage.js')];
  const { ReaderStorage } = require('../out/readerStorage.js');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'inleaf-ux-'));
  const pdfPath = path.join(dir, 'paper.pdf');
  await writeFile(pdfPath, Buffer.from('%PDF-1.7 test'));
  const values = new Map();
  const storage = new ReaderStorage(Uri.file(pdfPath), {
    get: (k, fb) => (values.has(k) ? values.get(k) : fb),
    update: async (k, v) => { values.set(k, v); }
  });
  const added = await storage.addWord({ word: 'heuristic', sentence: 'A heuristic works fast.', page: 3 });
  const updated = await storage.updateWord(added[0].id, { note: 'Remember for exam' });
  assert.equal(updated[0].note, 'Remember for exam');
  const mdUri = await storage.exportWordbookMarkdown();
  const csvUri = await storage.exportWordbookCsv();
  assert.match(await readFile(mdUri.fsPath, 'utf8'), /Remember for exam/);
  assert.match(await readFile(csvUri.fsPath, 'utf8'), /heuristic/);
  const ctxUri = await storage.writeActiveContext({
    page: 7,
    pageTotal: 20,
    selectedText: 'Key claim',
    contextBefore: 'Before',
    contextAfter: 'After'
  });
  const writtenCtx = JSON.parse(await readFile(ctxUri.fsPath, 'utf8'));
  assert.equal(writtenCtx.fileName, 'paper.pdf');
  assert.equal(writtenCtx.page, 7);
  assert.equal(writtenCtx.selectedText, 'Key claim');
} finally {
  Module._load = originalLoad;
}

console.log('UX enhancements regression passed.');
