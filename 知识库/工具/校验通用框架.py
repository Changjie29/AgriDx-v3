#!/usr/bin/env python3
"""Validate common classification and evidence pointers without copying repair facts."""
import json
from pathlib import Path
import re

STAGES = {'normal', 'symptom', 'cause', 'check', 'action', 'retest'}
INFORMATION_TYPES = {'资料索引', '资料核验', '机型资料', '资料缺口', '系统适用边界'}


def validate_common_framework(repo):
    index = repo / '知识库/整理后的知识库/农用拖拉机知识库'
    data = json.loads((index / '通用框架.json').read_text('utf8'))
    hierarchy = json.loads((index / 'hierarchy.json').read_text('utf8'))
    entries = {e['entry_id']: e for e in map(json.loads, (index / 'entries.jsonl').read_text('utf8').splitlines()) if e}
    associations = {e['entry_id']: {c['component_id'] for c in e['components']} for e in hierarchy['entries']}
    components = {c['id'] for c in hierarchy['components']}

    def require(condition, message):
        if not condition:
            raise ValueError(message)

    def strings(values, label, nonempty=True):
        require(isinstance(values, list) and (values or not nonempty) and
                all(isinstance(v, str) and v.strip() for v in values) and
                len(set(values)) == len(values), f'{label}须为无重复的文字列表')

    def identities(values, label):
        require(isinstance(values, list) and bool(values), f'{label}须为非空列表')
        require(all(isinstance(v, dict) and isinstance(v.get('id'), str) and v['id'].strip() and
                    isinstance(v.get('name'), str) and v['name'].strip() for v in values), f'{label}缺少编号或名称')
        require(len({v['id'] for v in values}) == len(values), f'{label}编号重复')

    require(isinstance(data, dict) and data.get('schemaVersion') == 1, '通用框架版次无效')
    require(isinstance(data.get('purpose'), str) and data['purpose'].strip(), '通用框架缺少用途')
    strings(data.get('questions'), '共同问诊问题')
    identities(data.get('stages'), '阶段')
    require({s['id'] for s in data['stages']} == STAGES, '诊断阶段缺失或未知')
    identities(data.get('systems'), '系统')
    performances = {}
    for system in data['systems']:
        strings(system.get('componentIds'), system['id'])
        require(set(system['componentIds']) <= components, f"系统组件不存在：{system['id']}")
        require(isinstance(system.get('configurationNotes'), str) and system['configurationNotes'].strip(), f"系统配置说明缺失：{system['id']}")
        identities(system.get('performanceTargets'), '性能目标')
        for target in system['performanceTargets']:
            require(target['id'] not in performances, f"性能目标编号重复：{target['id']}")
            performances[target['id']] = system
    systems = {s['id'] for s in data['systems']}
    identities(data.get('symptoms'), '表现')
    symptoms = {s['id']: s for s in data['symptoms']}
    for symptom in symptoms.values():
        strings(symptom.get('aliases'), '表现别名', False)
        strings(symptom.get('questions'), '表现问诊问题')
        strings(symptom.get('systemIds'), '表现系统')
        strings(symptom.get('performanceIds'), '表现性能')
        require(set(symptom['systemIds']) <= systems, f"表现系统不存在：{symptom['id']}")
        require(all(p in performances and performances[p]['id'] in symptom['systemIds'] for p in symptom['performanceIds']), f"表现性能不属于关联系统：{symptom['id']}")
    require(isinstance(data.get('links'), list), '条目关联须为列表')
    seen = set()
    documents = {}
    for link in data['links']:
        entry_id = link['entryId']
        require(entry_id not in seen and entry_id in entries, f'条目关联重复或不存在：{entry_id}')
        seen.add(entry_id)
        entry = entries[entry_id]
        require(entry['entry_type'] not in INFORMATION_TYPES, f'资料信息不能作为诊断关联：{entry_id}')
        strings(link.get('symptomIds'), '关联表现', False)
        strings(link.get('performanceIds'), '关联性能')
        require(set(link['symptomIds']) <= symptoms.keys() and set(link['performanceIds']) <= performances.keys(), f'关联目标不存在：{entry_id}')
        require(all(set(performances[p]['componentIds']) & associations[entry_id] for p in link['performanceIds']), f'性能与原组件不一致：{entry_id}')
        require(all(set(symptoms[s]['performanceIds']) & set(link['performanceIds']) for s in link['symptomIds']), f'关联表现与性能不一致：{entry_id}')
        path = repo / entry['knowledge_path']
        if path not in documents:
            documents[path] = {m[1].split('｜')[0]: m[2] for m in re.finditer(r'^##\s+([^\r\n]+)\r?\n([\s\S]*?)(?=^##\s+|\Z)', path.read_text('utf8'), re.M)}
        body = documents[path][entry_id]
        require(isinstance(link.get('stages'), list) and bool(link['stages']), f'关联阶段缺失：{entry_id}')
        stage_ids = [s['id'] for s in link['stages']]
        require(set(stage_ids) <= STAGES and len(set(stage_ids)) == len(stage_ids), f'关联阶段未知或重复：{entry_id}')
        for stage in link['stages']:
            strings(stage.get('evidenceTerms'), '阶段核对词')
            require(all(t in body for t in stage['evidenceTerms']), f"原文缺少阶段依据：{entry_id}/{stage['id']}")
    return {'systems': len(systems), 'performance_targets': len(performances), 'symptoms': len(symptoms),
            'linked_entries': len(seen), 'matrix_cells': len(performances) * len(STAGES)}


if __name__ == '__main__':
    print(json.dumps(validate_common_framework(Path(__file__).resolve().parents[2]), ensure_ascii=False))
