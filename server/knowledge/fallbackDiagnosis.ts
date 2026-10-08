import { describeSource, type KnowledgeChunk } from './retriever';
import { resolveScope, type RetrievalContext } from './scope';

/** Without a model service, report retrieved evidence instead of synthesizing a diagnosis. */
export function generateLocalKnowledgeReply(
  query: string,
  retrieved: KnowledgeChunk[],
  opts: RetrievalContext = {},
  fallbackReason?: 'not_configured' | 'provider_unavailable',
  displayQuery: string = query,
): string {
  const machineDesc = [opts.machineType, opts.brand, opts.model].filter(Boolean).join(' ') || '农机设备';
  const primary = retrieved[0];
  const serviceNotice = fallbackReason === 'not_configured'
    ? '**【服务状态】**\n当前未启用外部模型，本次仅提供本地资料和信息补充建议。\n\n'
    : fallbackReason === 'provider_unavailable'
      ? '**【服务状态】**\n外部模型本次暂不可用，已回退为本地资料回复。可稍后重试以获得模型辅助分析。\n\n'
      : '';
  const identityQuestions = [
    !opts.machineType && '农机类型',
    !opts.brand && '品牌',
    !opts.model && '完整型号',
  ].filter(Boolean).join('、');

  if (!primary) {
    const identityNotice = resolveScope(query, opts).identityConflict
      ? '已填写的农机信息与问题中的类型、品牌或型号不一致。请确认本次咨询对象，修改已填写信息或问题中的机型后再检索。\n'
      : '';
    return `${serviceNotice}**【故障现象分析】**
收到关于「${machineDesc}」的咨询：“${displayQuery}”。

**【当前资料不足】**
${identityNotice}未检索到与问题及已知机型相符的知识条目，不能据此确定原因或提供操作参数。

**【需要补充】**
${identityQuestions ? `- 请补充${identityQuestions}，以便匹配对应手册。\n` : ''}- 故障是在启动、行驶还是带机具作业时出现？出现前是否有保养、更换或碰撞？
- 请记录异常位置、报警／故障代码及伴随现象，并确认出厂配置与版本。

**【安全提醒】**
故障原因未确认前不要继续危险作业、绕过安全装置或盲目拆修。电动／无人机型请按本机安全规程处理，并联系具备相应资质的维修人员。`;
  }

  if (!primary.entryId) {
    return `${serviceNotice}**【咨询现象】**
收到关于「${machineDesc}」的咨询：“${displayQuery}”。

**【当前资料不足】**
仅命中整理者编写的信息收集提示，未取得本次咨询所需的匹配手册证据。以下问题不是操作／维修依据，不能据此判断故障原因、提供维修步骤、操作参数或保养周期。

**【信息收集】**
### ${primary.heading}
${primary.text}

**【提示来源】**
${describeSource(primary)}
这是信息收集清单的文件位置，不是原厂手册的证据引用。

**【需要补充的资料】**
请提供品牌、完整型号及后缀、市场／排放、配置、手册版本和已经观察到的现象或已有检测记录；取得匹配手册及具体章节后再核对。不能用其他品牌或相近机型填补缺口。

**【安全提醒】**
本清单不要求新增测量、拆检或试操作。现场安全处置请向本机厂家或具备相应资质的维修支持确认，并核对本机匹配安全规程。`;
  }

  const scopeNotice = primary.applicability === 'matched'
    ? '已找到对应品牌／型号的资料；市场、配置和手册版本仍需确认。下面是来源事实摘录，不代表已确诊。'
    : '已找到该品牌／系列的参考资料，具体车辆适用性待核实。不能直接套用操作步骤或参数。';
  const background = ['机型资料', '资料缺口', '资料索引', '资料核验', '系统适用边界'].includes(primary.entryType ?? '');

  // Show the best matching entry intact so its safety conditions and evidence stay together.
  return `${serviceNotice}**【故障现象分析】**
针对「${machineDesc}」的咨询：“${displayQuery}”。

**【${background ? '来源与适用信息' : '初步判断'}】**
${scopeNotice}${background ? '该资料仅用于来源、适用范围或资料缺口说明，不是操作／维修依据。' : ''}

**【检索到的知识】**
### ${primary.heading}
${primary.text}

**【知识依据】**
${describeSource(primary)}

**【当前资料不足】**
请确认完整机型、市场、配置和原手册版本；条目中的待核实内容不能用其他品牌或相近机型补齐。${background ? '来源索引、封面核验或报道摘要不构成已审核的操作／维修步骤；请查本机匹配原件及具体章节。' : '故障表中的可能原因需要检测验证，不能据单一症状决定换件。'}

**【安全提醒】**
遵守本机手册的停机与安全隔离规程；不要绕过安全联锁、带压拆修或在悬空机具下作业。高温、高压、电池高压和无人作业相关检查应交具备相应资质的人员处理。`;
}
