"""Explainable, conservative repair-knowledge candidate features and relations.

This module reads no files, loads no model, and never changes source records.
Similarity is candidate evidence; it is never sufficient to establish a duplicate.
"""
import hashlib
import re
import unicodedata


RELATIONS_VERSION = '1.0.0'

FIELD_LABELS = {
    'symptom': {'故障现象', '适用现象', '现象'},
    'cause': {'可能原因', '原表可能原因', '故障原因', '原因', '可能原因选摘', '故障表可能原因'},
    'action': {'针对处理', '维修建议', '排除方法', '处理措施', '维修措施', '处理方法',
               '解决办法', '原文方向', '措施', '处理', '诊断步骤'},
}
METADATA_LABELS = {'证据', '证据位置', '资料来源', '来源', '来源编号', '验证状态',
                   '核验状态', '核对状态', '状态', '原始文件', '公开原件入口'}
SCOPE_LABELS = {'适用条件', '适用限制', '适用范围', '范围限制', '工况', '作业条件'}

# Deliberately small and inspectable: no general thesaurus and no translations
# of quantities, procedures, fluid grades, fault codes, or safety instructions.
SYNONYMS = (
    ('不能起动', '不能启动'), ('无法起动', '不能启动'), ('无法启动', '不能启动'),
    ('起动', '启动'), ('电瓶', '蓄电池'), ('亏电', '电量不足'),
    ('空滤', '空气滤清器'), ('换新', '更换'),
)


def normalize(value):
    """Normalize presentation while retaining decimal/sign/unit/negative text."""
    text = unicodedata.normalize('NFKC', str(value or '')).lower()
    text = text.replace('–', '-').replace('—', '-').replace('−', '-').replace('～', '~')
    result = []
    for position, character in enumerate(text):
        if character.isspace():
            continue
        if character in '.,':
            # A numeric comma may be a decimal or grouping separator. Preserve
            # it rather than guessing the locale and collapsing 1,5 into 15.
            # Sentence punctuation outside numbers is only presentation.
            if (position and position + 1 < len(text) and
                    text[position - 1].isdigit() and text[position + 1].isdigit()):
                result.append(character)
        elif character in '+-/%°≤≥<>=~':
            result.append(character)
        elif not unicodedata.category(character).startswith(('P', 'S')):
            result.append(character)
    return ''.join(result)


def canonical(value):
    text = normalize(value)
    for original, replacement in SYNONYMS:
        text = text.replace(original, replacement)
    return text


def _labelled(line):
    line = re.sub(r'^\s*(?:[-*+]\s+|\d+[.)]\s+)?', '', line.strip())
    line = line.replace('**', '')
    match = re.match(r'^([^：:\n]{1,24})[：:]\s*(.*)$', line)
    return (match[1].strip(), match[2].strip()) if match else (None, None)


def _protections(text):
    english_negations = re.findall(r"\b(?:never|not|no|cannot|can't|don't|mustn't)\b",
                                  unicodedata.normalize('NFKC', text).lower())
    # Unit prefixes are case-sensitive: MPa and mPa differ by 10^9.
    # Never derive this guard from the lowercased retrieval representation.
    quantities = re.sub(r'\s+', '', unicodedata.normalize('NFKC', text)).replace('−', '-')
    text = canonical(text)
    # Keep value and unit together; an unrecognized unit remains in the text
    # and still prevents an exact/semantic equality claim.
    numbers = re.findall(
        r'[+-]?\d+(?:[.,]\d+)?(?:[A-Za-zμΩ]+(?:[·*/][A-Za-zμΩ]+)?|%|°[CcFf]?|'
        r'兆帕|千帕|帕|毫米|厘米|米|毫升|升|千克|公斤|克|小时|分钟|秒|伏|安|牛米)?', quantities)
    # Deficiency terms are different candidate causes, not a polarity flip of
    # the same repair instruction (e.g. 电量不足 versus 滤清器堵塞).
    negations = re.findall(r'禁止|严禁|不得|不可|不能|不允许|切勿|勿|未|无|不(?!足|良|稳|畅)', text)
    negations.extend(english_negations)
    safety = re.findall(r'禁止|严禁|不得|不可|不允许|切勿|危险|卸压|泄压|支撑|停机|断电|冷却后', text)
    return {'numbers': sorted(numbers), 'negations': sorted(negations), 'safety': sorted(safety)}


def _title_conditions(title):
    """Keep explicit title scope without treating a symptom title as scope.

    A bounded vocabulary recognizes conditions, not inferred model aliases or
    every difference in wording. The complete original title is also retained.
    """
    text = unicodedata.normalize('NFKC', str(title or '')).lower()
    conditions = re.findall(
        r'国[一二三四五六]|(?:stage|tier)\s*[ivx0-9]+|'
        r'(?<![a-z0-9])(?:cab|rops|[24]wd)(?![a-z0-9])|'
        r'高海拔|低温|高温|寒冷|高寒|高粉尘|多尘|重载|轻载|冷机|热机', text)
    return sorted({normalize(condition) for condition in conditions})


def extract_features(entry, source, section):
    """Adapt labelled cards and legacy prose without inventing missing fields.

    ``section`` is the existing validator's {body, heading, line} object. Scope
    retains source and entry limits separately; unknown scope is never broadened.
    """
    body = section.get('body', '')
    raw = {field: [] for field in FIELD_LABELS}
    conditions, retained, residual = [], [], []
    for line in body.splitlines():
        label, value = _labelled(line)
        if label in METADATA_LABELS:
            continue
        retained.append(line)
        matched = False
        for field, labels in FIELD_LABELS.items():
            if label in labels:
                raw[field].append(value)
                matched = True
                break
        if label in SCOPE_LABELS:
            conditions.append(value)
            matched = True
        if not matched and line.strip():
            residual.append(line)
    raw_fields = {field: '\n'.join(values) for field, values in raw.items()}
    fields = {field: normalize(value) for field, value in raw_fields.items()}
    models = entry.get('models') or source.get('models')
    if not models:
        model = entry.get('model') or source.get('model')
        models = [model] if model else []
    scope = {
        'brand': normalize(entry.get('brand') or source.get('brand')),
        'model': normalize(entry.get('model') or source.get('model')),
        'models': sorted({normalize(model) for model in models}),
        'configuration': normalize(entry.get('configuration') or source.get('configuration')),
        'drive_configuration': normalize(entry.get('drive_configuration') or source.get('drive_configuration')),
        'emission_stage': normalize(entry.get('emission_stage') or source.get('emission_stage')),
        'source_boundary': normalize(source.get('scope_boundary')),
        'entry_boundary': normalize(entry.get('scope_boundary')),
        'use': normalize(entry.get('use')),
        'source_use': normalize(source.get('use')),
        'title_conditions': _title_conditions(entry.get('title', '')),
        'conditions': sorted({normalize(value) for value in conditions}),
    }
    content = '\n'.join(retained)
    normalized = normalize(content)
    return {
        'entry_id': entry.get('entry_id'), 'source_id': entry.get('source_id'),
        'title': entry.get('title', ''), 'body': body,
        'case_key': entry.get('case_key'), 'models': models,
        'normalized': normalized,
        'normalized_hash': hashlib.sha256(normalized.encode('utf8')).hexdigest(),
        'canonical': canonical(content),
        **fields, 'raw_fields': raw_fields,
        'semantic_fields': {field: canonical(value) for field, value in raw_fields.items()},
        'missing_fields': [field for field, value in fields.items() if not value],
        'scope': scope, 'residual': canonical('\n'.join(residual)),
        'protected': _protections(entry.get('title', '') + '\n' + content),
    }


def candidate_tokens(feature):
    """Local lexical postings; no scope filter can hide a scope-variant pair."""
    # Core fields avoid metadata and repeated source/safety boilerplate drowning
    # repair terms, while legacy cards can still enter lexical candidate search.
    text = canonical(' '.join(feature.get('raw_fields', {}).values()))
    if not text:
        text = canonical(feature.get('title', '') + feature.get('normalized', ''))
    tokens = set(re.findall(r'[a-z0-9]+(?:[.\-/][a-z0-9]+)*', text))
    for run in re.findall(r'[\u3400-\u9fff]+', text):
        tokens.update(run[position:position + 2] for position in range(max(0, len(run) - 1)))
        if len(run) == 1:
            tokens.add(run)
    return tokens


def _result(relation, reasons):
    actions = {
        'exact_duplicate': '人工逐项核对适用条件及来源后决定是否整理引用；不自动合并。',
        'semantic_duplicate': '人工回看双方原文，确认故障、原因、措施和限制均一致；不自动合并。',
        'partial_overlap': '人工核对包含范围及新增步骤，保留各自独有事实和安全限制。',
        'complementary': '保留双方知识，人工核对不同原因或措施是否为并列排查候选。',
        'scope_variant': '按各自车型、配置、排放和工况分别保留；人工核对适用范围。',
        'uncertain': '保留双方原文，人工核对数值、否定、安全限制及缺失证据后再判断。',
    }
    return {'relation': relation, 'reasons': reasons,
            'recommended_action': actions[relation], 'review_state': 'pending'}


def classify(left, right, similarity=None):
    """Return a review relationship, never a merge decision or truth claim."""
    protected_left, protected_right = left.get('protected', {}), right.get('protected', {})
    different = [key for key in ('numbers', 'negations', 'safety')
                 if protected_left.get(key, []) != protected_right.get(key, [])]
    if different:
        labels = {'numbers': '数值或单位', 'negations': '否定词', 'safety': '安全禁令或必要条件'}
        return _result('uncertain', [f'{labels[key]}不同，不能由文本或语义相似度抵消。' for key in different])
    scope_left, scope_right = left.get('scope', {}), right.get('scope', {})
    scope_changes = [key for key in sorted(set(scope_left) | set(scope_right))
                     if scope_left.get(key) != scope_right.get(key)]
    if scope_changes:
        return _result('scope_variant', ['适用范围不同或一侧未知：' + '、'.join(scope_changes) + '。'])
    title_matches = canonical(left.get('title', '')) == canonical(right.get('title', ''))
    if title_matches and left.get('normalized') and left['normalized'] == right.get('normalized'):
        return _result('exact_duplicate', ['剔除来源/核验元数据后的规范化正文及关键适用条件一致。'])
    if left.get('missing_fields') or right.get('missing_fields'):
        reasons = ['故障、原因或措施字段缺失；同症状或相同case_key不足以认定重复。']
        if similarity is not None:
            reasons.append('语义相似度只用于候选召回，不能补足缺失的结构证据。')
        return _result('uncertain', reasons)
    first, second = left['semantic_fields'], right['semantic_fields']
    same = {key: first[key] == second[key] for key in FIELD_LABELS}
    if title_matches and all(same.values()) and left.get('residual') == right.get('residual'):
        return _result('semantic_duplicate', ['故障、候选原因和措施在有限显式同义映射后一致，且适用条件与额外限制一致。'])
    # Require every component to contain the other in the same direction, rather
    # than treating arbitrary shared words or a shared symptom as containment.
    for smaller, larger in ((left, right), (right, left)):
        a, b = smaller['semantic_fields'], larger['semantic_fields']
        if (all(a[key] in b[key] for key in FIELD_LABELS) and
                any(a[key] != b[key] for key in FIELD_LABELS) and
                smaller.get('residual', '') in larger.get('residual', '')):
            return _result('partial_overlap', ['故障、原因和措施存在同向文本包含，较长记录含额外内容；不是完整重复。'])
    if same['symptom'] and (not same['cause'] or not same['action']):
        differences = [name for key, name in (('cause', '候选原因'), ('action', '维修措施')) if not same[key]]
        return _result('complementary', ['故障现象一致，但' + '及'.join(differences) + '不同；同一故障现象不等于同一故障原因。'])
    return _result('uncertain', ['规范化事实未能证明完整重复或包含；相似度及共享词项只构成待审核线索。'])
