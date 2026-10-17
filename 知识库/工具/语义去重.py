#!/usr/bin/env python3
"""Read-only offline deduplication CLI; never loaded by the diagnosis service."""
import argparse
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
from knowledge_quality import atomic_write, safe_output
from knowledge_semantic import scan, markdown_report, validator
from semantic_embedding import LocalEmbedder


def main():
    parser = argparse.ArgumentParser(description='只读增量语义去重；全部候选等待人工审核，不修改知识')
    parser.add_argument('--mode', choices=['auto', 'rules', 'local'], default='auto')
    parser.add_argument('--model-dir', type=Path)
    parser.add_argument('--batch-size', type=int, default=16)
    parser.add_argument('--top-k', type=int, default=12)
    parser.add_argument('--threshold', type=float, default=0.75)
    parser.add_argument('--checkpoint-every', type=int, default=100)
    parser.add_argument('--full', action='store_true')
    for name in ('report', 'markdown', 'cache', 'quality-cache'):
        parser.add_argument('--' + name, type=Path)
    args = parser.parse_args()
    outputs = [safe_output(p, validator.REPO) for p in
               (args.report, args.markdown, args.cache, args.quality_cache) if p]
    if len(outputs) != len(set(outputs)):
        raise ValueError('报告、语义缓存与质量缓存不得互相覆盖')
    if args.model_dir:
        model_path = args.model_dir.expanduser().resolve()
        if any(path.is_relative_to(model_path) for path in outputs):
            raise ValueError('输出不得覆盖本地模型目录')
    embedder = LocalEmbedder(args.model_dir, args.mode, args.batch_size)
    result = scan(cache_path=args.cache, quality_cache_path=args.quality_cache, full=args.full,
                  embedder=embedder, checkpoint_every=args.checkpoint_every,
                  top_k=args.top_k, threshold=args.threshold)
    protected = {(validator.REPO / p).resolve() for p in result['snapshot']['files']}
    if protected.intersection(outputs):
        raise ValueError('报告或缓存不得覆盖被检查的输入文件')
    if args.report:
        atomic_write(safe_output(args.report, validator.REPO), json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    if args.markdown:
        atomic_write(safe_output(args.markdown, validator.REPO), markdown_report(result))
    print(json.dumps({'summary': result['summary'], 'model_mode': result['model']['mode'],
                      'model_reason': result['model'].get('reason'), 'blocked': result['blocked'],
                      'performance': result.get('performance')}, ensure_ascii=False))
    return int(result['blocked'])


if __name__ == '__main__':
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding='utf-8')
    try:
        sys.exit(main())
    except (ValueError, OSError, RuntimeError) as error:
        print(f'语义去重失败：{error}', file=sys.stderr)
        sys.exit(1)
