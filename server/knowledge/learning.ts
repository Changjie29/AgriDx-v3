import fs from 'node:fs';
import path from 'node:path';
import type { LearningEntry } from '../../shared/knowledge-catalog';

export const LEARNING_INDEXES = [
  'docs/tractor-knowledge/index.jsonl',
  'docs/tractor-knowledge/expansion-5000/index.jsonl',
] as const;

/** Read the sole Markdown bodies for browsing; these records never become repair RAG chunks. */
export function loadLearningEntries(root = process.cwd()): LearningEntry[] {
  const boundary = fs.realpathSync(path.resolve(root, 'docs/tractor-knowledge'));
  const documents = new Map<string, Map<string, string>>();
  const entries: LearningEntry[] = [];
  const ids = new Set<string>();
  for (const index of LEARNING_INDEXES) {
    const rows: unknown[] = fs.readFileSync(path.join(root, index), 'utf8').split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
    if (!rows.length) throw new Error(`通识索引为空：${index}`);
    for (const row of rows) {
      if (!row || typeof row !== 'object') throw new Error('通识索引格式无效');
      const item = row as Record<string, unknown>;
      const { entry_id: id, title, topic, status, knowledge_path: relative } = item;
      if (typeof id !== 'string' || !/^TK-\d{4}$/.test(id) || ids.has(id) ||
        typeof title !== 'string' || !title.trim() || typeof topic !== 'string' || !topic.trim() ||
        typeof status !== 'string' || !status.trim() || item.entry_type !== '通识学习' ||
        item.diagnostic_evidence !== false || item.anchor !== id.toLowerCase() ||
        typeof relative !== 'string' || !/^docs\/tractor-knowledge\/(?:expansion-5000\/)?\d{2}\.md$/.test(relative)) {
        throw new Error(`通识索引编号、定位或用途无效：${String(id)}`);
      }
      if (!documents.has(relative)) {
        const file = fs.realpathSync(path.resolve(root, relative));
        const within = path.relative(boundary, file);
        if (within.startsWith('..') || path.isAbsolute(within)) throw new Error('通识正文路径越出资料目录');
        const sections = new Map<string, string>();
        for (const match of fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').matchAll(/^### (TK-\d{4})\n([\s\S]*?)(?=^#{1,3} |$(?![\s\S]))/gm)) {
          if (sections.has(match[1])) throw new Error(`通识正文编号重复：${match[1]}`);
          sections.set(match[1], match[2].trim());
        }
        documents.set(relative, sections);
      }
      let content = documents.get(relative)!.get(id);
      if (!content) throw new Error(`通识正文缺失：${id}`);
      if (relative.includes('/expansion-5000/')) {
        const heading = `**${title}**`;
        if (!content.startsWith(`${heading}\n`)) throw new Error(`通识标题不符：${id}`);
        content = content.slice(heading.length).trim();
        if (!content) throw new Error(`通识正文为空：${id}`);
      }
      ids.add(id);
      entries.push({ collection: 'learning', entryId: id, title, entryType: '通识学习',
        topic, status, knowledgePath: relative, content, diagnosticEvidence: false });
    }
  }
  const bodyCount = [...documents.values()].reduce((count, sections) => count + sections.size, 0);
  if (bodyCount !== entries.length) throw new Error('通识正文与索引数量不符');
  return entries;
}
