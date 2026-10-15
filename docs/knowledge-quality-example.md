> 节选示例：只展示1219项信息提示中的3项；不是全量报告。完整报告由命令在忽略目录生成。

# 维修知识库规则清洗报告

文件/来源/编号/标题/适用条件/正文格式规则校验；不等于全文事实审校、厂家确认或实车验证

生成时间（UTC）：2026-10-15T08:36:24.069044+00:00
快照：`fd973d1f3db5342b97f0f262569345d2f13735d11cee19a9fc15ef44e88102ad`；规则版本：1.0.0

来源 26；条目 2213；错误 0；警告 0；提示 1219。

状态分类仅描述现有严格解析器结果；unspecified不等于未经人工核对。

| verified | pending | unverified | unspecified |
|---|---|---|---|
| 1014 | 0 | 0 | 1199 |

## 按规则统计

| 规则 | 数量 |
|---|---|
| status.unspecified | 1199 |
| source.external | 7 |
| source.level | 13 |

## 规则问题

| 问题编号／规则 | 条目／来源 | 严重程度 | 具体问题 | 原始值 | 证据位置 | 处理建议 |
|---|---|---|---|---|---|---|
| KQ-3c1151ecc92b0dd11998 / status.unspecified | KB-LX2620-001 / SRC-KB-LX2620-6C82063118 | info | 原状态未被现有严格核验解析器识别，不等于未人工核对 | 沿用既有原文核对条目 | 知识库/整理后的知识库/农用拖拉机知识库/entries.jsonl:1 status - 证据：SRC-KB-LX2620-6C82063118，Periodic service／Daily check／Changing engine oil；PDF 第 101、104、112 页；印刷第 99、102、110 页。 | 现有严格解析器无法分类；保留原状态，人工核对后再考虑结构化映射。 |
| KQ-0e8270ee1d0384975825 / source.level | — / SRC-WD-WF1404-1804-2022 | info | 来源未记录source_level，不能据此判定不可信 | — | 知识库/整理后的知识库/农用拖拉机知识库/sources.json:— /21/source_level  | 补充发布方与取得渠道；缺失不等于来源不可靠。 |
| KQ-4b58f49fbe0cd51603fd / source.external | — / SRC-WD-WF1404-1604-2021 | info | 本次只核对本地来源记录，未重新取得外链PDF；采用取得时登记的原件哈希/页数 | — | 知识库/整理后的知识库/农用拖拉机知识库/sources.json:— /20/manual_sha256  | 如需重新证明PDF完整性，提供已取得的临时原件；本工具不下载。 |

## 执行与限制

```json
{
  "incremental": {
    "enabled": true,
    "sources_checked": 26,
    "sources_reused": 0,
    "entries_checked": 2213,
    "entries_reused": 0,
    "global_checks": "索引解析、编号唯一性、内容哈希与输入稳定性每次重检"
  },
  "performance": {
    "elapsed_ms": 2108.927,
    "hashed_files": 68,
    "hashed_bytes": 140591055,
    "parsed_documents": 40
  }
}
```

只读检查，不修改验证状态，不证明全文事实、厂家确认或实车验证。未执行语义去重或AI冲突检测。
