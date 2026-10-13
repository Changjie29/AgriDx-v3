/**
 * 本地轻量 RAG
 *
 * 设计原则：
 * - 不引入向量库 / ES / Redis / LangChain。
 * - 启动时扫描 server/knowledge/ 下的 .md，并加载拖拉机归档索引中的独立条目。
 * - 查询时用关键词重叠打分（中文 bigram + 英文 token），取 top-K 片段。
 * - 知识库很小，全量塞 prompt 也可；这里做"按需选片"，为未来扩充留接口。
 * - 未来接入 PDF/Word 时，只需在 loadAll() 里加新解析器，返回 {path, heading, text}。
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadArchive } from './archive';
import { archiveApplicability, queryWithoutIdentity, resolveScope, type RetrievalContext } from './scope';

export interface KnowledgeChunk {
  /** 通用文档相对 server/knowledge；归档文档相对仓库根目录 */
  source: string;
  /** 该块所属章节标题（## 级） */
  heading: string;
  /** 块正文 */
  text: string;
  entryId?: string;
  sourceId?: string;
  /** Bound by the archive loader after checking the entry, source and section. */
  indexedReference?: Readonly<{ entryId: string; sourceId: string }>;
  brand?: string;
  model?: string;
  models?: string[];
  /** Entry-specific subsets require an exact identity rather than a brand-only match. */
  requiresExactModel?: boolean;
  configuration?: 'CAB' | 'ROPS';
  driveConfiguration?: '2WD' | '4WD';
  emissionStage?: '国三' | '国四';
  sourceUrl?: string;
  originalPath?: string;
  locator?: string;
  version?: string;
  scopeBoundary?: string;
  status?: string;
  entryType?: string;
  applicability?: 'matched' | 'pending';
}

interface ScoredChunk extends KnowledgeChunk {
  score: number;
}

const KB_ROOT = path.resolve(process.cwd(), 'server/knowledge');
const MAX_CHUNKS_IN_PROMPT = 6;
const MAX_CHARS_PER_CHUNK = 1200;

// ---- 启动时索引 ----
let chunks: KnowledgeChunk[] = [];

function walkMdFiles(dir: string, base: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.join(base, e.name);
    if (e.isDirectory()) {
      out.push(...walkMdFiles(full, rel));
    } else if (e.isFile() && e.name.endsWith('.md')) {
      out.push(rel);
    }
  }
  return out;
}

function splitByHeading(relPath: string, content: string): KnowledgeChunk[] {
  const out: KnowledgeChunk[] = [];
  // 按 ## 切；文件首个 # 标题作为文件头，保留为 meta
  const lines = content.split(/\r?\n/);
  let currentHeading = '(概述)';
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join('\n').trim();
    if (text.length > 0) {
      out.push({ source: relPath, heading: currentHeading, text });
    }
    buf = [];
  };
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      flush();
      currentHeading = line.replace(/^##\s+/, '').trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}

export function loadKnowledgeBase(): { fileCount: number; chunkCount: number } {
  chunks = [];
  let fileCount = 0;
  try {
    const files = walkMdFiles(KB_ROOT, '');
    for (const rel of files) {
      // 跳过说明性 README（00_说明 下的 README 不参与检索）
      if (rel.replace(/\\/g, '/').startsWith('00_说明/')) continue;
      const abs = path.join(KB_ROOT, rel);
      const content = fs.readFileSync(abs, 'utf-8');
      chunks.push(...splitByHeading(rel.replace(/\\/g, '/'), content));
      fileCount++;
    }
  } catch (e) {
    console.warn('[kb] load failed:', (e as Error).message);
  }
  // Invalid archive references must fail startup rather than silently hide missing entries.
  const archive = loadArchive();
  chunks.push(...archive.chunks);
  fileCount += archive.fileCount;
  console.log(`[kb] loaded ${fileCount} files, ${chunks.length} chunks (${archive.chunks.length} archived entries)`);
  return { fileCount, chunkCount: chunks.length };
}

// ---- 关键词打分 ----

function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  // 英文/数字 token
  const enTokens = lower.match(/[a-z0-9]{2,}/g) || [];
  // 中文按 2-gram
  const zhBigrams: string[] = [];
  // Do not fabricate bigrams across identity-removal gaps or punctuation.
  for (const run of lower.match(/[\u4e00-\u9fa5]+/g) || []) {
    for (let i = 0; i < run.length - 1; i++) zhBigrams.push(run.slice(i, i + 2));
  }
  return [...enTokens, ...zhBigrams];
}

/** Vocabulary only: these aliases express symptoms, never infer a failed component. */
const SYMPTOM_ALIASES = [
  ['启动', '起动'],
  ['打不着', '打不着火', '不着车', '不能着车', '打不着车', '无法启动', '无法起动', '不能启动', '不能起动', '启动不了', '起动不了', '启动困难', '起动困难', '不着火'],
  ['启动马达', '起动马达', '启动电机', '起动机'],
  ['开锅', '水温过高', '水温高', '发动机过热'],
  ['动力不足', '没劲', '没力气', '加速无力', '牵引无力'],
  ['升不起来', '升不起', '提不起来', '提升无力', '提升不起', '提升失效', '举不起来'],
  ['掉下来', '自己下降', '农具沉降', '自行下降'],
  ['异响', '响声', '噪声', '噪音', '异常声音'],
  ['震动', '振动', '抖动', '颤动'],
  ['方向重', '方向盘很重', '转向沉重', '转向费力'],
  ['刹不住', '刹车不灵', '制动失灵', '制动不灵'],
  ['刹车跑偏', '制动跑偏'],
  ['冒黑烟', '黑烟'],
  ['漏油', '渗油', '油液泄漏'],
  ['定位丢失', '没有定位', '未定位', '定位失效'],
  ['断联', '失联', '通信中断'],
] as const;

function symptomTokens(query: string): { tokens: Map<string, number>; groups: readonly (readonly string[])[] } {
  const text = queryWithoutIdentity(query).replace(
    /联合收割机|拖拉机|插秧机|植保机|播种机|农业机械|农用机械|农机|请问|请帮我|怎么办|怎么修|怎么处理|怎么回事|是什么原因|什么原因|我的|这台|那台|这个|那个|\b(?:tractor|combine|transplanter|sprayer)\b/gi,
    ' ',
  );
  const tokens = new Map(tokenize(text).map((token) => [token, 1]));
  const groups: (readonly string[])[] = [];
  for (const group of SYMPTOM_ALIASES) {
    if (!group.some((term) => text.includes(term))) continue;
    groups.push(group);
    // Expanded aliases must match the whole phrase. Their incidental bigrams
    // (for example 声音 inside 异常声音) would broaden recall to unrelated faults.
    for (const term of group) {
      if (!tokens.has(term)) tokens.set(term, 0.65);
    }
  }
  return { tokens, groups };
}

function scoreChunk(chunk: KnowledgeChunk, queryTokens: Map<string, number>, groups: readonly (readonly string[])[]): number {
  const heading = (chunk.entryId ? chunk.heading.split('｜').slice(1).join('｜') : chunk.heading).toLowerCase();
  // Brand/model names repeated in citations are not evidence that a symptom is relevant.
  const body = chunk.entryId ? chunk.text.split('\n')
    .filter((line) => !/^- (证据|故障证据|来源|原始|定位|适用|状态)[：:]/.test(line))
    .join('\n').replace(/\b(?:SRC|KB|NH|ZL|LV|DF|HH)-[A-Z0-9-]+\b/g, '') : chunk.text;
  const haystack = (heading + '\n' + body).toLowerCase();
  // A shared component name or an incidental bigram does not establish that
  // a clearly stated symptom is covered (打不着 must not match 打不开).
  if (groups.length && !groups.some((group) => group.some((term) => haystack.includes(term)))) return 0;
  // Engine power loss after warming up is not starter torque or implement lift weakness.
  const powerLoss = groups.some(group => group.includes('动力不足'));
  const startingSymptom = groups.some(group => group.includes('启动') || group.includes('起动机') || group.includes('打不着'));
  if (powerLoss && !startingSymptom && /启动机|起动机|启动电机|起动电机|启动马达|起动马达/.test(heading)) return 0;
  let score = 0;
  for (const [t, weight] of queryTokens) {
    if (haystack.includes(t)) {
      // 标题命中权重更高
      score += (heading.includes(t) ? 3 : 1) * weight;
    }
  }
  return score;
}

/**
 * 根据用户问题检索最相关的知识片段。
 * 无命中时返回空数组，调用方决定 fallback。
 */
export function retrieve(query: string, k = MAX_CHUNKS_IN_PROMPT, context: RetrievalContext = {}): KnowledgeChunk[] {
  if (chunks.length === 0) return [];
  const { tokens: qTokens, groups } = symptomTokens(query);
  if (qTokens.size === 0) return [];
  const scope = resolveScope(query, context);

  const scored: ScoredChunk[] = [];
  for (const c of chunks) {
    // The local file preamble describes editing the sample, not diagnostic evidence.
    if (!c.entryId && c.heading === '(概述)') continue;
    const applicability = c.entryId ? archiveApplicability(c, scope) : undefined;
    if (c.entryId ? !applicability : !scope.genericKnowledge) continue;
    const s = scoreChunk(c, qTokens, groups);
    if (s > 0) scored.push({ ...c, applicability, score: s });
  }
  // Manual-specific hits take precedence; sample parameters must not contradict their instructions.
  const archived = scored.filter((chunk) => chunk.entryId);
  const selected = archived.length ? archived : scored;
  selected.sort((a, b) => b.score - a.score);
  return selected.slice(0, k).map(({ score: _score, ...chunk }) => chunk);
}

/** 当前知识条目数（供 /api/health 或前端展示） */
export function stats() {
  return { chunks: chunks.length, archivedEntries: chunks.filter((chunk) => chunk.entryId).length };
}

/** Source facts remain outside body truncation so applicability limits cannot be lost. */
export function describeSource(chunk: KnowledgeChunk): string {
  if (!chunk.entryId) return `来源：${chunk.source}｜章节：${chunk.heading}`;
  return [
    `条目：${chunk.entryId}｜来源编号：${chunk.sourceId}｜章节：${chunk.heading}`,
    `知识文档：${chunk.source}`,
    `品牌／型号：${chunk.brand}／${chunk.model}｜资料版本：${chunk.version}`,
    `原始资料：${chunk.originalPath}｜来源网址：${chunk.sourceUrl}`,
    `原文定位：${chunk.locator}`,
    `核验状态：${chunk.status}｜资料类别：${chunk.entryType}`,
    `适用性：${chunk.applicability === 'matched' ? '品牌／型号匹配，市场、配置及手册版本仍需核对' : '具体机型适用性待核实，不直接套用操作或参数'}`,
    `适用限制：${chunk.scopeBoundary}`,
  ].join('\n');
}

/** 把命中的片段格式化为注入 system prompt 的文本块 */
export function formatForPrompt(found: KnowledgeChunk[]): string {
  if (found.length === 0) return '';
  return found
    .map((c, i) => {
      const body = c.text.length > MAX_CHARS_PER_CHUNK ? c.text.slice(0, MAX_CHARS_PER_CHUNK) + '…' : c.text;
      return `【片段 ${i + 1}】\n${describeSource(c)}\n\n${body}`;
    })
    .join('\n\n---\n\n');
}
