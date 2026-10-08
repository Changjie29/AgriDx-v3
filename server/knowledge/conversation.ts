import { queryWithoutIdentity, resolveScope, type RetrievalContext } from './scope';

export interface DiagnosticHistoryMessage {
  role: string;
  content: string;
}

export interface DiagnosticContext {
  /** Latest user text, for the answer to address the current turn. */
  currentQuery: string;
  /** Symptom plus user-declared identity and current applicability constraints. */
  query: string;
  scope: RetrievalContext;
}

const MACHINE_TYPES: [RegExp, string][] = [
  [/联合收割机|收割机|\bcombine\b/i, '联合收割机'],
  [/插秧机|\btransplanter\b/i, '插秧机'],
  [/植保机|\bsprayer\b/i, '植保机'],
  [/播种机|\bseeder\b/i, '播种机'],
  [/无人农机|无人拖拉机|\bautonomous\b/i, '无人农机'],
  [/新能源农机|电动拖拉机|电动农机|\belectric\b|new-energy/i, '新能源农机'],
  [/拖拉机|\btractor\b/i, '拖拉机'],
];

function declaredMachineType(text: string): string | undefined {
  // Document references and an explicitly attached implement do not identify
  // the primary machine. Use the same implement exception as the scope gate.
  const primary = queryWithoutIdentity(text).replace(
    /(?:挂接|连接|牵引|\bPTO\s*接)\s*(?:的\s*)?(?:收割机|插秧机|植保机|播种机|无人机|combine|transplanter|sprayer)/gi,
    ' ',
  );
  return MACHINE_TYPES.find(([pattern]) => pattern.test(primary))?.[1];
}

/** Remove only selection constraints. They are reattached from the latest user declaration. */
function withoutSelection(text: string): string {
  return queryWithoutIdentity(text).replace(
    /\bcab\b|\brops\b|驾驶室|防翻滚架|防翻架|\b2wd\b|\b4wd\b|两轮驱动|二轮驱动|四轮驱动|两驱|二驱|四驱|联合收割机|收割机|插秧机|植保机|播种机|无人农机|无人拖拉机|新能源农机|电动拖拉机|电动农机|拖拉机|\b(?:tractor|combine|transplanter|sprayer|electric|autonomous)\b/gi,
    ' ',
  ).trim();
}

function identityOnly(text: string): boolean {
  return !withoutSelection(text).replace(
    /我的|我这台|这台|那台|这辆|那辆|品牌|牌子|型号|机型|系列|平台|欧豹|具体|就是|是|为|用的|换成|换一台|另外一台|另一台|不是|而是|不对|[\s，,。.!！?？:：;；/]/g,
    '',
  );
}

function correctionText(text: string): string {
  // "不是久保田，是东方红" selects only the corrected declaration.
  return text.replace(/^.*?不是[^，,；;。\n]*[，,；;]\s*(?:而是|是|换成)\s*/, '');
}

function modelFromText(text: string, hasBrand: boolean, hasModel: boolean): string | undefined {
  const known = resolveScope(text, {}).models.filter((model) => model !== '国三' && model !== '国四');
  if (known.length) return known.join('/');
  const explicit = text.match(/(?:型号|机型)\s*(?:是|为|[:：])?\s*([a-z0-9][a-z0-9.\-_ /()（）]*\d[a-z0-9.\-_ /()（）]*|\d+[a-z0-9.\-_ /()（）]*)/i)?.[1]?.trim();
  if (explicit) return explicit;
  // Short model answers are common after the user has supplied the brand.
  const bare = text.trim();
  if (hasBrand && !hasModel && /^(?=.*\d)[a-z0-9][a-z0-9.\-_ /()（）]*$/i.test(bare)) return bare;
  return undefined;
}

function isContinuation(text: string): boolean {
  const clean = text.trim();
  return clean.length <= 100 && (
    /^(?:那|还|也|只|只有|仅|但是|不过|现在|刚才|补充|继续|怎么|为什么|需要|应该|能不能|可以|是否|多久|多长|多少|什么油|有什么|怎么办|会不会|是的|对|不是|请问|具体)/.test(clean) ||
    /空载|负载|带负荷|怠速|加油门|热车|冷车|挂挡|行驶时|作业时|启动时|起动时|报警|故障码/.test(clean)
  );
}

/**
 * Build retrieval context from user declarations, never from assistant suggestions.
 * Complete new questions replace old symptoms; short identity/operating-condition
 * answers retain the diagnostic question. A machine change clears old constraints.
 */
export function resolveDiagnosticContext(
  history: readonly DiagnosticHistoryMessage[],
  explicitScope: RetrievalContext = {},
): DiagnosticContext {
  const users = history.filter((message) => message.role === 'user').slice(-12);
  const scope: RetrievalContext = {};
  let symptoms: string[] = [];
  let emissions: string[] = [];
  let configurations: string[] = [];
  let drives: string[] = [];
  let ambiguousIdentity = '';

  for (const message of users) {
    const text = correctionText(message.content.trim());
    const detected = resolveScope(text, {});
    const brand = detected.brand ?? text.match(/(?:品牌|牌子)\s*(?:是|为|[:：])\s*([^\s，,。；;]{1,30})/)?.[1];
    const model = modelFromText(text, Boolean(brand || scope.brand), Boolean(scope.model));
    const machineType = declaredMachineType(text);
    const replacedMachine = /换一台|另一台|另外一台|换成/.test(message.content) ||
      Boolean(machineType && scope.machineType && machineType !== scope.machineType);
    const changed = Boolean(
      (brand && scope.brand && brand !== scope.brand) ||
      (model && scope.model && model !== scope.model) ||
      (machineType && scope.machineType && machineType !== scope.machineType) ||
      replacedMachine,
    );
    if (changed) {
      if (replacedMachine || (brand && brand !== scope.brand)) {
        delete scope.brand;
        delete scope.model;
      } else if (model) delete scope.model;
      // A corrected brand/model may describe the same machine. Previously
      // declared emissions/configuration remain constraints until corrected
      // themselves or the user explicitly switches to a different machine.
      if (replacedMachine) {
        if (!machineType) delete scope.machineType;
        emissions = [];
        configurations = [];
        drives = [];
      }
    }
    if (detected.ambiguous) {
      delete scope.brand;
      delete scope.model;
      ambiguousIdentity = text;
    } else if (brand || model) ambiguousIdentity = '';
    if (brand) {
      if (scope.brand && scope.brand !== brand) delete scope.model;
      scope.brand = brand;
    }
    if (model) scope.model = model;
    if (machineType) scope.machineType = machineType;
    if (detected.emissions.length) emissions = detected.emissions;
    if (detected.configurations.length) configurations = detected.configurations;
    if (detected.driveConfigurations.length) drives = detected.driveConfigurations;

    const body = withoutSelection(text);
    if (!body || identityOnly(text)) continue;
    if (symptoms.length && isContinuation(body)) symptoms = [...symptoms.slice(-2), body];
    else symptoms = [body];
  }

  // Keep the active user declaration before applying request fields. The scope
  // gate must see both identities to reject conflicting fields; removing user
  // identities from the symptom text must never bypass that check.
  const declaredScope = { ...scope };
  const explicitBrand = resolveScope('', explicitScope).brand;
  if (explicitBrand && explicitBrand !== scope.brand && !explicitScope.model?.trim()) {
    delete scope.model;
  }
  for (const field of ['machineType', 'brand', 'model'] as const) {
    if (explicitScope[field]?.trim()) scope[field] = explicitScope[field]!.trim();
  }
  const currentQuery = users.at(-1)?.content.trim() ?? '';
  return {
    currentQuery,
    query: [
      scope.brand, scope.model, scope.machineType,
      declaredScope.brand, declaredScope.model, declaredScope.machineType,
      ambiguousIdentity, ...emissions, ...configurations, ...drives, ...symptoms,
      // Preserve same-turn conflicts and unknown identities in their original
      // spelling. Retired machines remain excluded; explicit corrections use
      // only the corrected declaration.
      correctionText(currentQuery),
    ].filter(Boolean).join(' '),
    scope,
  };
}
