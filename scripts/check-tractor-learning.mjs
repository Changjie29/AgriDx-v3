import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, main, rootDir } from './lib/process.mjs';

const learningPath = 'docs/tractor-knowledge';
const expansionPath = `${learningPath}/expansion-5000`;
const requireValue = (condition, message) => {
  if (!condition) throw new Error(message);
};
// GitHub's Windows checkout can use CRLF; manifests describe the repository's
// UTF-8/LF text, just as the existing archive preservation checks do.
const digest = value => createHash('sha256').update(value.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
const normalized = text => text.normalize('NFKC').replace(/[\p{P}\s]/gu, '');

export function checkTractorLearning(directory = rootDir) {
  const read = relative => readFileSync(path.join(directory, relative), 'utf8');
  const json = relative => JSON.parse(read(relative));
  const lines = relative => read(relative).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const manifest = json(`${expansionPath}/validation.json`);
  const topics = json(`${expansionPath}/topics.json`);
  const entries = lines(`${expansionPath}/index.jsonl`);
  const oldEntries = lines(`${learningPath}/index.jsonl`);
  requireValue(manifest.schema === 1 && manifest.entry_count === 5000 && manifest.total_learning_entries === 6000,
    '通识扩充清单的数量或格式错误。');
  requireValue(entries.length === 5000 && oldEntries.length === 1000 && topics.length === 250,
    '通识资料应保留原1000条，新增5000条和250个细分主题。');
  requireValue(Object.keys(manifest.preserved_baseline.files).length >= 13,
    '缺少原1000条资料的保留摘要。');
  for (const [relative, expected] of Object.entries({ ...manifest.preserved_baseline.files, ...manifest.files })) {
    const absolute = path.resolve(directory, relative);
    requireValue(absolute.startsWith(`${path.resolve(directory)}${path.sep}`), '摘要路径越出工作区。');
    requireValue(digest(readFileSync(absolute)) === expected, `文件摘要不符：${relative}`);
  }
  const topicMap = new Map(topics.map(topic => [topic.topic_id, topic]));
  requireValue(topicMap.size === 250, '细分主题编号重复。');
  const counts = new Map();
  const documents = new Map();
  const bodies = new Map();
  for (let index = 1; index <= 10; index++) {
    const relative = `${learningPath}/${String(index).padStart(2, '0')}.md`;
    for (const match of read(relative).matchAll(/^### (TK-\d{4})\r?\n\r?\n([\s\S]+?)(?=^#{1,3} |$(?![\s\S]))/gm)) {
      bodies.set(normalized(match[2]), match[1]);
    }
  }
  requireValue(bodies.size === 1000, '原1000条正文缺失或完全重复。');
  for (let index = 0; index < oldEntries.length; index++) {
    requireValue(oldEntries[index].entry_id === `TK-${String(index + 1).padStart(4, '0')}` &&
      oldEntries[index].diagnostic_evidence === false, '原通识索引编号或用途发生变化。');
  }
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const id = `TK-${index + 1001}`;
    requireValue(entry.entry_id === id && entry.anchor === id.toLowerCase(), `编号或锚点不连续：${id}`);
    requireValue(entry.diagnostic_evidence === false && entry.entry_type === '通识学习' &&
      typeof entry.status === 'string' && entry.status.includes('未逐条'), `缺少学习用途边界：${id}`);
    requireValue(!['text', 'body', 'summary'].some(key => key in entry), `索引重复保存事实正文：${id}`);
    const topic = topicMap.get(entry.topic_id);
    requireValue(topic && entry.topic === topic.topic && entry.domain === topic.domain &&
      index + 1001 >= topic.start && index + 1001 <= topic.end, `主题定位不符：${id}`);
    const expectedPath = `${expansionPath}/${String(Math.floor(index / 100) + 11).padStart(2, '0')}.md`;
    requireValue(entry.knowledge_path === expectedPath, `文档定位不符：${id}`);
    counts.set(entry.topic_id, (counts.get(entry.topic_id) ?? 0) + 1);
    if (!documents.has(expectedPath)) {
      const parsed = new Map();
      for (const match of read(expectedPath).matchAll(/^### (TK-\d{4})\r?\n\r?\n\*\*(.+)\*\*\r?\n\r?\n([\s\S]+?)(?=^#{1,3} |$(?![\s\S]))/gm)) {
        requireValue(!parsed.has(match[1]), `正文编号重复：${match[1]}`);
        parsed.set(match[1], { title: match[2], body: match[3].trim() });
      }
      requireValue(parsed.size === 100, `每份新增文档必须有100条正文：${expectedPath}`);
      documents.set(expectedPath, parsed);
    }
    const content = documents.get(expectedPath).get(id);
    requireValue(content && content.title === entry.title && content.body.length >= 35, `正文缺失或空泛：${id}`);
    const key = normalized(content.body);
    requireValue(!bodies.has(key), `正文与${bodies.get(key)}完全重复：${id}`);
    bodies.set(key, id);
  }
  requireValue(documents.size === 50 && counts.size === 250 && [...counts.values()].every(count => count === 20),
    '新增资料应为50份文档、250个主题各20条。');
  requireValue(manifest.checks.runtime_rag_import === false &&
    manifest.checks.oem_manual_entrywise_verification === 'not_performed', '不能扩大资料用途或核验声明。');
  for (const relative of [`${learningPath}/overview.md`, `${expansionPath}/README.md`, ...documents.keys()]) {
    for (const match of read(relative).matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^https?:\/\//.test(target)) continue;
      const [file, anchor] = target.split('#');
      const absolute = file ? path.resolve(directory, path.dirname(relative), file) : path.resolve(directory, relative);
      requireValue(absolute.startsWith(`${path.resolve(directory)}${path.sep}`), '资料链接越出工作区。');
      const text = readFileSync(absolute, 'utf8');
      if (anchor?.startsWith('tk-')) {
        requireValue(text.includes(`### ${anchor.toUpperCase()}\n`) || text.includes(`### ${anchor.toUpperCase()}\r\n`),
          `资料链接锚点不存在：${relative} → ${target}`);
      }
    }
  }
  const result = { added: entries.length, total: entries.length + oldEntries.length, topics: counts.size, documents: documents.size };
  console.log(`[tractor-learning] ${JSON.stringify(result)}；编号、定位、摘要、原资料保留及用途检查通过。`);
  return result;
}

if (isMain(import.meta.url)) main(checkTractorLearning, 'tractor-learning');
