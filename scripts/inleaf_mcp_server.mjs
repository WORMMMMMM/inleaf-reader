#!/usr/bin/env node

import { createInterface } from 'node:readline';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const rootArgument = process.argv.findIndex(argument => argument === '--root');
if (rootArgument < 0 || !process.argv[rootArgument + 1]) {
  process.stderr.write('Usage: inleaf_mcp_server.mjs --root <library-root>\n');
  process.exit(2);
}

const root = await realpath(process.argv[rootArgument + 1]);
const serverInfo = { name: 'inleaf-reader', version: '0.1.0' };
const tools = [
  tool('get_current_paper', 'Return the active PDF path, fingerprint, page, and update time.', {}),
  tool('get_current_selection', 'Return the active, user-created EvidenceLocator.', {}),
  tool('list_annotations', 'List annotations for a library PDF.', {
    pdfPath: { type: 'string', description: 'Optional PDF path. Defaults to the current paper.' }
  }),
  tool('get_paper_research_profile', 'Read a paper research profile.', {
    pdfPath: { type: 'string', description: 'Optional PDF path. Defaults to the current paper.' }
  }),
  tool('search_library', 'Search the rebuildable local library index.', {
    query: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } }
  }),
  tool('get_comparison_input', 'Read one saved evidence-based comparison.', {
    comparisonId: { type: 'string' }
  }, ['comparisonId']),
  tool('list_repository_artifacts', 'List repository artifacts from a paper profile.', {
    pdfPath: { type: 'string', description: 'Optional PDF path. Defaults to the current paper.' }
  })
];

const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });
reader.on('line', line => {
  void handleLine(line);
});

async function handleLine(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }
  if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string') return;
  if (request.id === undefined) return;
  try {
    if (request.method === 'initialize') {
      respond(request.id, {
        protocolVersion: request.params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo
      });
      return;
    }
    if (request.method === 'ping') {
      respond(request.id, {});
      return;
    }
    if (request.method === 'tools/list') {
      respond(request.id, { tools });
      return;
    }
    if (request.method === 'tools/call') {
      const name = request.params?.name;
      const args = request.params?.arguments || {};
      const result = await callTool(name, args);
      respond(request.id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result
      });
      return;
    }
    fail(request.id, -32601, `Method not found: ${request.method}`);
  } catch (error) {
    fail(request.id, -32000, error instanceof Error ? error.message : String(error));
  }
}

async function callTool(name, args) {
  if (name === 'get_current_paper') {
    const session = await currentSession();
    return {
      pdfPath: session.pdfPath,
      fingerprint: session.fingerprint,
      currentPage: session.currentPage,
      updatedAt: session.updatedAt
    };
  }
  if (name === 'get_current_selection') {
    const session = await currentSession();
    return session.selection || { status: 'empty', message: 'No current selection was published by Inleaf Reader.' };
  }
  if (name === 'list_annotations') {
    const pdfPath = await resolvePdf(args.pdfPath);
    return readJson(sidecar(pdfPath, 'annotations.json'), []);
  }
  if (name === 'get_paper_research_profile') {
    const pdfPath = await resolvePdf(args.pdfPath);
    return readJson(sidecar(pdfPath, 'research.json'), { status: 'empty', pdfPath });
  }
  if (name === 'search_library') {
    const index = await readJson(path.join(root, '.inleaf-reader', 'library.index.json'), {
      papers: [], warnings: ['Library index has not been built.']
    });
    const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
    const tags = Array.isArray(args.tags) ? args.tags.map(tag => String(tag).trim().toLowerCase()).filter(Boolean) : [];
    return {
      generatedAt: index.generatedAt,
      warnings: index.warnings || [],
      papers: (index.papers || []).filter(paper => {
        const text = `${paper.title || ''} ${paper.year || ''} ${(paper.tags || []).join(' ')}`.toLowerCase();
        return (!query || text.includes(query)) && tags.every(tag => (paper.tags || []).includes(tag));
      })
    };
  }
  if (name === 'get_comparison_input') {
    if (!/^[a-zA-Z0-9-]+$/.test(String(args.comparisonId || ''))) {
      throw new Error('comparisonId is invalid.');
    }
    return readJson(path.join(root, '.inleaf-reader', 'comparisons', `${args.comparisonId}.json`));
  }
  if (name === 'list_repository_artifacts') {
    const pdfPath = await resolvePdf(args.pdfPath);
    const profile = await readJson(sidecar(pdfPath, 'research.json'), { artifacts: [] });
    return (profile.artifacts || []).filter(artifact =>
      artifact.type === 'github' || artifact.type === 'git_repository'
    );
  }
  throw new Error(`Unknown tool: ${String(name)}`);
}

async function currentSession() {
  const session = await readJson(path.join(root, '.inleaf-reader', 'current-session.json'));
  await assertInsideRoot(session.pdfPath);
  return session;
}

async function resolvePdf(value) {
  const candidate = typeof value === 'string' && value.trim()
    ? value.trim()
    : (await currentSession()).pdfPath;
  return assertInsideRoot(candidate);
}

async function assertInsideRoot(candidate) {
  if (typeof candidate !== 'string' || !candidate) throw new Error('A PDF path is required.');
  const resolved = await realpath(candidate);
  if (!(resolved === root || resolved.startsWith(`${root}${path.sep}`))) {
    throw new Error('Requested path is outside the configured Inleaf library root.');
  }
  if (!resolved.toLowerCase().endsWith('.pdf')) throw new Error('Requested path is not a PDF.');
  return resolved;
}

function sidecar(pdfPath, suffix) {
  return path.join(path.dirname(pdfPath), '.inleaf-reader', `${path.basename(pdfPath)}.${suffix}`);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (fallback !== undefined && error?.code === 'ENOENT') return fallback;
    throw new Error(`Could not read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function tool(name, description, properties, required = []) {
  return {
    name,
    description,
    inputSchema: { type: 'object', properties, required, additionalProperties: false }
  };
}

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function fail(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
}
