"""Compare old/new dispatch on private SQLite snapshots; never mutate source data.

Run from a source-only staging directory on the backend runtime. The benchmark
uses real history but a deterministic synthetic sampler if the random queue runs
out; it does not read embeddings, archives, or generate images.
"""
import argparse
import importlib.util
import json
import logging
import shutil
import sqlite3
from contextlib import closing
from pathlib import Path
from time import perf_counter

from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.semantic_map.ai_verification import AIVerificationService, question_key
from backend.semantic_map.ai_verification_api import build_ai_router
from backend.semantic_map.ai_verification_schemas import AIAssignmentRequest
from backend.semantic_map.auth import require_backend_token
from backend.semantic_map.human_verification_storage import HumanVerificationStorage
from backend.tests.test_ai_verification import FakeSampler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--result-root', type=Path, required=True)
    parser.add_argument('--legacy-source', type=Path, required=True)
    parser.add_argument('--run-id', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--count', type=int, default=5)
    args = parser.parse_args()
    root, out = args.result_root.resolve(), args.output.resolve()
    if out == root or root in out.parents:
        raise ValueError('Benchmark output must be outside the production result tree')
    out.mkdir(parents=True, exist_ok=False)
    for kind in ['ai', 'human']:
        source = root / (kind + '_verification') / 'ratings.sqlite3'
        with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as src, \
                closing(sqlite3.connect(out / (kind + '-snapshot.sqlite3'))) as dst:
            src.execute('PRAGMA query_only=ON'); src.backup(dst)
    spec = importlib.util.spec_from_file_location('backend.semantic_map._benchmark_legacy', args.legacy_source)
    legacy = importlib.util.module_from_spec(spec); spec.loader.exec_module(legacy)
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    result = {'production_writes': False, 'count': args.count, 'run_id': args.run_id,
              'scope': 'HTTP dispatch on private history copies; synthetic sampler on queue exhaustion; no images'}
    outputs = []
    for name, cls in [('before', legacy.AIVerificationService), ('after', AIVerificationService)]:
        ai_db, human_db = out / (name + '-ai.sqlite3'), out / (name + '-human.sqlite3')
        shutil.copy2(out / 'ai-snapshot.sqlite3', ai_db)
        shutil.copy2(out / 'human-snapshot.sqlite3', human_db)
        with closing(sqlite3.connect(ai_db)) as con:
            config = json.loads(con.execute('SELECT config FROM ai_runs WHERE run_id=?', (args.run_id,)).fetchone()[0])
        sampler = FakeSampler()
        service = cls(ai_db, HumanVerificationStorage(human_db), sampler, config['dataset_ids'])
        assignment = service.create_assignment(AIAssignmentRequest(
            **dict(config, request_id='isolated-dispatch-benchmark', run_id=args.run_id, new_run=False, target=args.count)))
        app = FastAPI(); app.include_router(build_ai_router(service, None))
        app.dependency_overrides[require_backend_token] = lambda: None
        with TestClient(app) as client:
            start = perf_counter()
            response = client.post(f'/api/ai-verification/runs/{args.run_id}/next', json={
                'count': args.count, 'assignment_id': assignment['assignment_id'], 'request_id': 'benchmark'})
            seconds = perf_counter() - start
            response.raise_for_status()
        rows = [service.task(args.run_id, t['task_id']) for t in response.json()['tasks']]
        outputs.append([(r['sequence'], r['source'], r['encore_of'], question_key(json.loads(r['payload']))) for r in rows])
        result[name] = {'seconds': seconds, 'returned': len(rows), 'sampler_calls': len(sampler.calls)}
        print(json.dumps({name: result[name]}), flush=True)
    result['same_ordered_questions_sources_and_encores'] = outputs[0] == outputs[1]
    (out / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    if not result['same_ordered_questions_sources_and_encores']:
        raise AssertionError('Old/new dispatch differ')
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
