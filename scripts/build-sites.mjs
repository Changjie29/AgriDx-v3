import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const originalRetriever = path.join(root, 'server/knowledge/retriever.ts');
const hosting = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const release = JSON.parse(await readFile('.openai/release.json', 'utf8'));
if (hosting.project_id !== 'appgprj_6ab5efd42cc48191a3bee1276e02c952') {
  throw new Error('Sites project identity mismatch');
}
if (release.version !== pkg.version) throw new Error('Release/package version mismatch');
await mkdir('.sites-runtime', { recursive: true });

// Use the authoritative main loader, including its source/path validation.
// The snapshot export exists only in this build process; source stays intact.
const loader = await build({
  stdin: {
    contents: `import {loadKnowledgeBase,snapshotKnowledgeBase} from './server/knowledge/retriever.ts';
      export const loaded = loadKnowledgeBase();
      export const chunks = snapshotKnowledgeBase();
      import {loadKnowledgeCatalog,snapshotKnowledgeCatalog} from './server/knowledge/catalog.ts';
      loadKnowledgeCatalog();
      export const catalogState = snapshotKnowledgeCatalog();`,
    resolveDir: root,
    sourcefile: 'sites-knowledge-export.ts',
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  plugins: [{
    name: 'knowledge-build-snapshot',
    setup(builder) {
      builder.onLoad({ filter: /[/\\]server[/\\]knowledge[/\\]retriever\.ts$/ }, async (args) => ({
        contents: (await readFile(args.path, 'utf8')) + '\nexport function snapshotKnowledgeBase(){return chunks;}\n',
        loader: 'ts', resolveDir: path.dirname(args.path),
      }));
      builder.onLoad({ filter: /[/\\]server[/\\]knowledge[/\\]catalog\.ts$/ }, async (args) => ({
        contents: (await readFile(args.path, 'utf8')) + '\nexport function snapshotKnowledgeCatalog(){return state;}\n',
        loader: 'ts', resolveDir: path.dirname(args.path),
      }));
    },
  }],
});
const reference = await import(`data:text/javascript;base64,${Buffer.from(loader.outputFiles[0].text).toString('base64')}`);
const chunks = reference.chunks;
const sources = JSON.parse(await readFile('知识库/整理后的知识库/农用拖拉机知识库/sources.json', 'utf8'));
const archivedEntries = chunks.filter((chunk) => chunk.entryId).length;
if (sources.length !== 26 || chunks.length !== 221 || archivedEntries !== 212) {
  throw new Error(`Knowledge snapshot mismatch: ${sources.length}/${archivedEntries}/${chunks.length}`);
}
const catalogState = reference.catalogState;
if (catalogState.catalog.totals.entries !== archivedEntries || catalogState.catalog.totals.sources !== sources.length ||
    catalogState.catalog.totals.mappedEntries !== archivedEntries) throw new Error('Catalog snapshot mismatch');
const catalogSnapshot = JSON.stringify({
  catalog: catalogState.catalog, chunks: catalogState.chunks,
  links: [...catalogState.links], sources: [...catalogState.sources],
});
await writeFile('.sites-runtime/reference-kb.json', JSON.stringify({
  ...reference.loaded, sourceCount: sources.length, archivedEntries, chunks,
}));

const client = spawnSync('npm', ['run', 'build:client'], { stdio: 'inherit' });
if (client.status !== 0) process.exit(client.status ?? 1);
await mkdir('dist/client', { recursive: true });
// The original Vite build writes to dist/. Move its outputs into the Sites
// asset directory without changing its frontend or public model files.
const { readdir } = await import('node:fs/promises');
for (const item of await readdir('dist', { withFileTypes: true })) {
  if (['client', 'server', '.openai'].includes(item.name)) continue;
  await cp(path.join('dist', item.name), path.join('dist/client', item.name), { recursive: true });
  await rm(path.join('dist', item.name), { recursive: true });
}
await mkdir('dist/server', { recursive: true });
const worker = await build({
  entryPoints: ['sites/worker.ts'],
  outfile: 'dist/server/index.js',
  bundle: true,
  platform: 'neutral',
  format: 'esm',
  target: 'es2022',
  conditions: ['worker', 'browser'],
  define: { __KB_SOURCE_COUNT__: String(sources.length) },
  metafile: true,
  plugins: [{
    name: 'knowledge-worker-snapshot',
    setup(builder) {
      builder.onLoad({ filter: /[/\\]server[/\\]knowledge[/\\]catalog\.ts$/ }, async (args) => {
        let contents = await readFile(args.path, 'utf8');
        contents = contents
          .replace("import fs from 'node:fs';\n", '')
          .replace("import path from 'node:path';\n", '')
          .replace("import { loadArchive } from './archive';\n", '')
          .replace(/^const INDEX_ROOT = .*;\r?\n/m, '');
        const start = contents.indexOf('/** Build once alongside');
        const end = contents.indexOf('function asEntry');
        if (start < 0 || end <= start) throw new Error('Catalog loader boundary changed');
        contents = contents.slice(0, start) + `
          const snapshot = ${catalogSnapshot};
          export function loadKnowledgeCatalog(): KnowledgeCatalog {
            state = {catalog: snapshot.catalog as KnowledgeCatalog, chunks: snapshot.chunks as KnowledgeChunk[],
              links: new Map(snapshot.links) as Map<string, EntryLink[]>,
              sources: new Map(snapshot.sources) as Map<string, SourceMetadata>};
            return state.catalog;
          }
        \n` + contents.slice(end);
        return { contents, loader: 'ts', resolveDir: path.dirname(args.path) };
      });
      builder.onLoad({ filter: /[/\\]server[/\\]knowledge[/\\]retriever\.ts$/ }, async (args) => {
        if (path.resolve(args.path) !== originalRetriever) throw new Error('Unexpected retriever');
        let contents = await readFile(args.path, 'utf8');
        contents = contents
          .replace("import fs from 'node:fs';\n", '')
          .replace("import path from 'node:path';\n", '')
          .replace("import { loadArchive } from './archive';\n", '')
          .replace("import { archiveApplicability,", "import { configureIndexedModels, archiveApplicability,")
          .replace(/^const KB_ROOT = .*;\r?\n/m, '');
        const start = contents.indexOf('// ---- 启动时索引 ----');
        const end = contents.indexOf('// ---- 关键词打分 ----');
        if (start < 0 || end <= start) throw new Error('Retriever loader boundary changed');
        contents = contents.slice(0, start) + `
          const chunks: KnowledgeChunk[] = ${JSON.stringify(chunks)};
          configureIndexedModels(chunks);
          export function loadKnowledgeBase(){return ${JSON.stringify(reference.loaded)};}
        \n` + contents.slice(end);
        return { contents, loader: 'ts', resolveDir: path.dirname(args.path) };
      });
    },
  }],
});
if (Object.values(worker.metafile.outputs).some((output) => output.imports.length)) {
  throw new Error('Worker bundle has unresolved runtime imports');
}
await writeFile('dist/server/wrangler.json', JSON.stringify({
  name: 'agridx-main',
  main: 'index.js',
  compatibility_date: '2026-05-15',
  compatibility_flags: ['nodejs_compat'],
  assets: { directory: '../client', binding: 'ASSETS', run_worker_first: true, not_found_handling: 'single-page-application' },
  no_bundle: true,
}));
await mkdir('dist/.openai', { recursive: true });
await cp('.openai/hosting.json', 'dist/.openai/hosting.json');
// Import smoke test confirms the generated artifact exports the expected API.
const artifact = await import(pathToFileURL(path.join(root, 'dist/server/index.js')));
if (typeof artifact.default?.fetch !== 'function') throw new Error('Worker fetch export missing');
console.log(`[sites] Built ${pkg.version}; ${sources.length} sources / ${archivedEntries} entries / ${chunks.length} chunks`);
