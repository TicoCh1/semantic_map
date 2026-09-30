"""Durable AI-only runs, blind presentations, human-priority matching and encores."""
from __future__ import annotations

import csv
import io
import json
import logging
import random
import sqlite3
import threading
import uuid
from collections import Counter
from contextlib import closing, contextmanager
from pathlib import Path
from time import perf_counter

from .ai_verification_schemas import AIRatingBatch, AIRunRequest, AIAssignmentRequest
from .human_verification import HumanVerificationSampler
from .human_verification_schemas import HumanVerificationSampleRequest
from .human_verification_storage import HumanVerificationStorage, utc_now


logger = logging.getLogger('uvicorn.error')


@contextmanager
def operation_timing(operation, **identity):
    """One compact server-side event; never include prompts, scores or credentials."""
    started = perf_counter()
    timing = dict(operation=operation, **identity)
    try:
        yield timing
    except Exception as exc:
        timing['error_type'] = type(exc).__name__
        raise
    finally:
        timing['total_ms'] = round((perf_counter() - started) * 1000, 3)
        logger.info('ai_verify_timing %s', canonical(timing))


@contextmanager
def timing_phase(timing, name):
    started = perf_counter()
    try:
        yield
    finally:
        timing[name + '_ms'] = round(timing.get(name + '_ms', 0) +
                                    (perf_counter() - started) * 1000, 3)


def canonical(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def question_key(question: dict) -> str:
    # Numeric pano IDs are not globally unique, especially in New York.
    return canonical([question.get(k) for k in ('dataset_id', 'pano_id', 'lon', 'lat',
                     'date', 'prompt_id', 'result_revision', 'prompt')])


def encore_probability(sequence: int) -> float:
    previous = sequence - 1
    return 0 if previous < 10 else .01 + .04 * min(1, (previous - 10) / 40)


class AIVerificationService:
    def __init__(self, database_path: Path, human: HumanVerificationStorage,
                 sampler: HumanVerificationSampler, default_datasets: list[str]):
        self.database_path = database_path
        self.human = human
        self.sampler = sampler
        self.default_datasets = default_datasets
        self._lock = threading.RLock()
        self._initialized = False

    @contextmanager
    def _timed_lock(self, timing):
        with timing_phase(timing, 'lock_wait'):
            self._lock.acquire()
        try:
            with timing_phase(timing, 'lock_hold'):
                yield
        finally:
            self._lock.release()

    def _connect(self):
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(self.database_path, timeout=120)
        con.row_factory = sqlite3.Row
        con.execute('PRAGMA foreign_keys=ON')
        if not self._initialized:
            con.executescript('''
                CREATE TABLE IF NOT EXISTS ai_runs (
                    run_id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL,
                    config TEXT NOT NULL, created_at TEXT NOT NULL, random_blocks INTEGER NOT NULL DEFAULT 0,
                    last_prompt TEXT);
                CREATE TABLE IF NOT EXISTS ai_questions (
                    question_id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL,
                    payload TEXT NOT NULL, human_sources TEXT NOT NULL DEFAULT '[]');
                CREATE TABLE IF NOT EXISTS ai_random_queue (
                    run_id TEXT NOT NULL REFERENCES ai_runs(run_id),
                    question_id TEXT NOT NULL REFERENCES ai_questions(question_id),
                    queue_order INTEGER NOT NULL, PRIMARY KEY(run_id, question_id));
                CREATE TABLE IF NOT EXISTS ai_presentations (
                    task_id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES ai_runs(run_id),
                    question_id TEXT NOT NULL REFERENCES ai_questions(question_id),
                    sequence INTEGER NOT NULL, source TEXT NOT NULL,
                    encore_of TEXT REFERENCES ai_presentations(task_id), issued_at TEXT NOT NULL,
                    UNIQUE(run_id, sequence));
                CREATE TABLE IF NOT EXISTS ai_ratings (
                    task_id TEXT PRIMARY KEY REFERENCES ai_presentations(task_id),
                    payload TEXT NOT NULL, received_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS ai_dispatch_requests (
                    run_id TEXT NOT NULL REFERENCES ai_runs(run_id), request_id TEXT NOT NULL,
                    count INTEGER NOT NULL, task_ids TEXT NOT NULL,
                    PRIMARY KEY(run_id, request_id));
                CREATE INDEX IF NOT EXISTS ai_presentations_run ON ai_presentations(run_id, question_id);
                CREATE TABLE IF NOT EXISTS ai_run_requests (
                    request_id TEXT PRIMARY KEY, config TEXT NOT NULL,
                    run_id TEXT NOT NULL REFERENCES ai_runs(run_id));
                CREATE TABLE IF NOT EXISTS ai_assignments (
                    assignment_id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL,
                    run_id TEXT NOT NULL REFERENCES ai_runs(run_id), config TEXT NOT NULL,
                    target INTEGER NOT NULL, baseline_ratings INTEGER NOT NULL, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS ai_assignment_tasks (
                    task_id TEXT PRIMARY KEY REFERENCES ai_presentations(task_id),
                    assignment_id TEXT NOT NULL REFERENCES ai_assignments(assignment_id));
                CREATE INDEX IF NOT EXISTS ai_assignment_tasks_owner ON ai_assignment_tasks(assignment_id);
            ''')
            self._initialized = True
        return con

    def _request_config(self, request):
        if request.new_run and request.run_id:
            raise ValueError('Choose run_id OR new_run, not both')
        config = request.model_dump(exclude={'run_id', 'new_run', 'target'})
        config['dataset_ids'] = list(dict.fromkeys(request.dataset_ids or self.default_datasets))
        if not config['dataset_ids'] or not set(config['dataset_ids']).issubset(self.default_datasets):
            raise ValueError('dataset_ids must be drawn from the active backend datasets')
        if len(canonical(config)) > 16000:
            raise ValueError('Run configuration is too large')
        return config

    def _run_progress(self, con, row):
        result = self._public_run(row)
        counts = dict(con.execute('''SELECT p.source,COUNT(*) FROM ai_presentations p
            JOIN ai_ratings r ON r.task_id=p.task_id WHERE p.run_id=? GROUP BY p.source''', (row['run_id'],)))
        issued = con.execute('SELECT COUNT(*) FROM ai_presentations WHERE run_id=?', (row['run_id'],)).fetchone()[0]
        models = {result['model']}
        models.update(json.loads(r[0])['model'] for r in con.execute(
            'SELECT config FROM ai_assignments WHERE run_id=?', (row['run_id'],)))
        return dict(result, ratings=sum(counts.values()), by_source=counts,
                    ordinary_ratings=sum(v for k,v in counts.items() if k!='encore'),
                    encore_ratings=counts.get('encore',0), pending=issued-sum(counts.values()),
                    models=sorted(models), active_assignments=con.execute('''SELECT COUNT(*) FROM ai_assignments a
                        WHERE a.run_id=? AND a.target>(SELECT COUNT(*) FROM ai_assignment_tasks t
                        JOIN ai_ratings r ON r.task_id=t.task_id WHERE t.assignment_id=a.assignment_id)''',
                        (row['run_id'],)).fetchone()[0])

    def list_runs(self):
        with self._lock, closing(self._connect()) as con:
            runs=[self._run_progress(con,r) for r in con.execute('SELECT * FROM ai_runs ORDER BY created_at,run_id')]
            return dict(runs=runs, count=len(runs), selection_policy='One matching dataset scope: continue; multiple: user selects; explicit new_run: independent replicate')

    def _resolve_run(self, con, request, config):
        binding = canonical(dict(config, run_id=request.run_id, new_run=request.new_run))
        previous=con.execute('SELECT * FROM ai_run_requests WHERE request_id=?',(request.request_id,)).fetchone()
        if previous:
            if previous['config']!=binding: raise ValueError('request_id already has a different run selection/configuration')
            return dict(self._public_run(self._run(con,previous['run_id'])),status='ready')
        # Old callers retain exact request-id replay, without rewriting historical rows.
        legacy=con.execute('SELECT * FROM ai_runs WHERE request_id=?',(request.request_id,)).fetchone()
        if legacy:
            if legacy['config']!=canonical(config): raise ValueError('request_id already belongs to a different run configuration')
            if request.run_id and request.run_id!=legacy['run_id']:
                raise ValueError('request_id already belongs to another run')
            selected=legacy
        elif request.run_id:
            selected=self._run(con,request.run_id)
            if set(json.loads(selected['config'])['dataset_ids'])!=set(config['dataset_ids']):
                raise ValueError('Selected run has a different dataset scope; select matching datasets or explicitly request a new run')
        else:
            candidates=[] if request.new_run else [r for r in con.execute('SELECT * FROM ai_runs ORDER BY created_at,run_id')
                if set(json.loads(r['config'])['dataset_ids'])==set(config['dataset_ids'])]
            if len(candidates)>1:
                return dict(status='selection_required', runs=[self._run_progress(con,r) for r in candidates],
                            instruction='Ask the user which run to continue. Retry with run_id and the same request_id. Do not silently pick one or set new_run.')
            selected=candidates[0] if candidates else None
        if selected is None:
            rid='ai-run-'+uuid.uuid4().hex
            con.execute('INSERT INTO ai_runs(run_id,request_id,config,created_at) VALUES(?,?,?,?)',
                        (rid,request.request_id,canonical(config),utc_now()))
            selected=self._run(con,rid)
        con.execute('INSERT INTO ai_run_requests VALUES(?,?,?)',(request.request_id,binding,selected['run_id']))
        return dict(self._public_run(selected),status='ready')

    def create_run(self, request: AIRunRequest) -> dict:
        config=self._request_config(request)
        with self._lock, closing(self._connect()) as con, con:
            con.execute('BEGIN IMMEDIATE')
            return self._resolve_run(con,request,config)

    def _assignment_progress(self, con, row):
        ratings=con.execute('''SELECT COUNT(*) FROM ai_assignment_tasks t JOIN ai_ratings r ON r.task_id=t.task_id
            WHERE t.assignment_id=?''',(row['assignment_id'],)).fetchone()[0]
        issued=con.execute('SELECT COUNT(*) FROM ai_assignment_tasks WHERE assignment_id=?',(row['assignment_id'],)).fetchone()[0]
        return dict(assignment_id=row['assignment_id'],run_id=row['run_id'],target=row['target'],ratings=ratings,
                    remaining=row['target']-ratings,pending=issued-ratings,baseline_ratings=row['baseline_ratings'],
                    run_ratings=self._run_progress(con,self._run(con,row['run_id']))['ratings'])

    def create_assignment(self, request: AIAssignmentRequest):
        config=self._request_config(request)
        saved=canonical(dict(config,run_id=request.run_id,new_run=request.new_run,target=request.target))
        with self._lock, closing(self._connect()) as con, con:
            con.execute('BEGIN IMMEDIATE')
            old=con.execute('SELECT * FROM ai_assignments WHERE request_id=?',(request.request_id,)).fetchone()
            if old:
                if old['config']!=saved: raise ValueError('request_id already belongs to a different assignment; use its assignment_id for recovery')
                return dict(self._assignment_progress(con,old),status='ready')
            result=self._resolve_run(con,request,config)
            if result['status']=='selection_required': return result
            aid='ai-assignment-'+uuid.uuid4().hex
            baseline=self._run_progress(con,self._run(con,result['run_id']))['ratings']
            con.execute('INSERT INTO ai_assignments VALUES(?,?,?,?,?,?,?)',
                        (aid,request.request_id,result['run_id'],saved,request.target,baseline,utc_now()))
            return dict(self._assignment_progress(con,con.execute('SELECT * FROM ai_assignments WHERE assignment_id=?',(aid,)).fetchone()),status='ready')

    def assignment_stats(self, assignment_id):
        with operation_timing('assignment_stats', assignment_id=assignment_id) as timing, \
                self._timed_lock(timing), closing(self._connect()) as con:
            row=con.execute('SELECT * FROM ai_assignments WHERE assignment_id=?',(assignment_id,)).fetchone()
            if row is None: raise LookupError('Unknown assignment')
            return self._assignment_progress(con,row)

    @staticmethod
    def _public_run(row) -> dict:
        config = json.loads(row['config'])
        return dict(run_id=row['run_id'], evaluator_id=config['evaluator_id'], model=config['model'],
                    dataset_ids=config['dataset_ids'], created_at=row['created_at'])

    @staticmethod
    def _run(con, run_id):
        row = con.execute('SELECT * FROM ai_runs WHERE run_id=?', (run_id,)).fetchone()
        if row is None:
            raise LookupError('Unknown AI run')
        return row

    @staticmethod
    def _upsert_question(con, payload: dict, human_source: dict | None = None) -> str:
        identity = question_key(payload)
        row = con.execute('SELECT * FROM ai_questions WHERE identity=?', (identity,)).fetchone()
        if row:
            sources = json.loads(row['human_sources'])
            if human_source is not None and human_source not in sources:
                sources.append(human_source)
                con.execute('UPDATE ai_questions SET human_sources=? WHERE question_id=?',
                            (canonical(sources), row['question_id']))
            return row['question_id']
        question_id = 'ai-question-' + uuid.uuid4().hex
        con.execute('INSERT INTO ai_questions VALUES(?,?,?,?)',
                    (question_id, identity, canonical(payload), canonical([human_source] if human_source else [])))
        return question_id

    def _refresh_human(self, con, config: dict, candidates: list[dict]) -> list[str]:
        priority = []
        for source in candidates:
            if source['dataset_id'] not in config['dataset_ids']:
                continue
            payload = {key: source[key] for key in ('dataset_id','city_id','pano_id','lon','lat',
                       'prompt_id','result_revision','prompt','score','zscore','ai_bucket',
                       'stratum_population','stratum_sample_count')}
            payload['date'] = int(source['capture_date']) if source['capture_date'] else None
            qid = self._upsert_question(con, payload, {'study_id':source['study_id'],'task_id':source['task_id']})
            if qid not in priority:
                priority.append(qid)
        return priority

    @staticmethod
    def _seen(con, run_id: str) -> set[str]:
        return {row[0] for row in con.execute('SELECT question_id FROM ai_presentations WHERE run_id=?', (run_id,))}

    def _fill_random_queue(self, con, run_id: str, config: dict) -> None:
        row = self._run(con, run_id)
        block = row['random_blocks']
        # Same prompt balancing policy as humans, driven exclusively by this AI run's
        # completed ratings, rather than human completion totals.
        counts = {}
        for item in con.execute('''SELECT q.payload, COUNT(*) AS n FROM ai_ratings AS r
                JOIN ai_presentations AS p ON p.task_id=r.task_id
                JOIN ai_questions AS q ON q.question_id=p.question_id
                WHERE p.run_id=? GROUP BY q.question_id''', (run_id,)):
            prompt = json.loads(item['payload'])['prompt']
            counts[prompt] = counts.get(prompt, 0) + item['n']
        # This sampler is exclusively AI-owned and protected by the service lock.
        self.sampler._prompt_completion_counts = lambda: counts
        request = HumanVerificationSampleRequest(dataset_ids=config['dataset_ids'],
            samples_per_bucket_per_dataset=1,
            seed=random.Random(f"{config['seed']}:block:{block}").randrange(2**63),
            exclude_prompts=[row['last_prompt']] if row['last_prompt'] else [])
        try:
            study = self.sampler.sample(request)
        except LookupError:
            # A backend with one available prompt can continue sampling that prompt.
            study = self.sampler.sample(request.model_copy(update={'exclude_prompts':[]}))
        con.execute('UPDATE ai_runs SET random_blocks=random_blocks+1,last_prompt=? WHERE run_id=?',
                    (study.prompt, run_id))
        seen = self._seen(con, run_id)
        for order, task in enumerate(study.tasks[:20]):
            payload = task.model_dump(); payload['prompt'] = study.prompt
            payload.pop('task_id')
            qid = self._upsert_question(con, payload)
            if qid not in seen:
                con.execute('INSERT OR IGNORE INTO ai_random_queue VALUES(?,?,?)',
                            (run_id, qid, block * 20 + order))

    def next_tasks(self, run_id: str, count: int, request_id: str | None = None, assignment_id: str | None = None) -> list[dict]:
        with operation_timing('next_tasks', run_id=run_id, assignment_id=assignment_id,
                              count=count, request_id=request_id) as timing:
            rows = self._next_tasks(run_id, count, request_id, assignment_id, timing)
            timing['returned'] = len(rows)
            return rows

    def _next_tasks(self, run_id, count, request_id, assignment_id, timing):
        if not 1 <= count <= 20 or (request_id is not None and not 1 <= len(request_id) <= 160):
            raise ValueError('Invalid dispatch count or request_id')
        # Reading human records never registers a human study or writes a human rating.
        with timing_phase(timing, 'human_read'):
            candidates = self.human.human_question_candidates()
        with self._timed_lock(timing), closing(self._connect()) as con, con:
            with timing_phase(timing, 'transaction_wait'):
                con.execute('BEGIN IMMEDIATE')
            run = self._run(con, run_id); config = json.loads(run['config'])
            if not set(config['dataset_ids']).issubset(self.default_datasets):
                raise ValueError('This run uses inactive datasets; create a run for the current datasets. Historical ratings remain available for export.')
            assignment=None
            if assignment_id:
                assignment=con.execute('SELECT * FROM ai_assignments WHERE assignment_id=? AND run_id=?',(assignment_id,run_id)).fetchone()
                if assignment is None: raise LookupError('Assignment does not belong to this run')
                # Fence dispatch receipts between independent append requests.
                if request_id is not None: request_id=assignment_id+':'+request_id
            if request_id is not None:
                previous = con.execute('SELECT * FROM ai_dispatch_requests WHERE run_id=? AND request_id=?',
                                       (run_id,request_id)).fetchone()
                if previous:
                    if previous['count'] != count:
                        raise ValueError('Dispatch request_id already has a different count')
                    timing['replayed'] = True
                    return [self._task(con,tid) for tid in json.loads(previous['task_ids'])]
            all_pending = con.execute('''SELECT p.task_id FROM ai_presentations p
                LEFT JOIN ai_ratings r ON r.task_id=p.task_id
                WHERE p.run_id=? AND r.task_id IS NULL ORDER BY p.sequence''', (run_id,)).fetchall()
            pending=all_pending
            if assignment:
                owned={r[0] for r in con.execute('SELECT task_id FROM ai_assignment_tasks WHERE assignment_id=?',(assignment_id,))}
                pending=[r for r in all_pending if r['task_id'] in owned]
            else:
                # Legacy recovery must never take tasks owned by a new assignment.
                owned={r[0] for r in con.execute('SELECT task_id FROM ai_assignment_tasks')}
                pending=[r for r in all_pending if r['task_id'] not in owned]
            if pending and request_id is None:
                # Retries/restarts return the same outstanding tasks, not new work.
                return [self._task(con, r['task_id']) for r in pending[:count]]
            available = 200 - len(all_pending)
            if assignment:
                remaining=assignment['target']-len(owned)
                if remaining<=0: return []
                available=min(available,remaining)
            if available <= 0:
                raise RuntimeError('AI run has 200 outstanding presentations; submit or recover existing claims before requesting more')
            with timing_phase(timing, 'human_refresh'):
                priority = self._refresh_human(con, config, candidates)
                seen = self._seen(con, run_id)
                fresh_human = [qid for qid in priority if qid not in seen]
            sequence = con.execute('SELECT COALESCE(MAX(sequence),0)+1 FROM ai_presentations WHERE run_id=?', (run_id,)).fetchone()[0]
            with timing_phase(timing, 'encore_history'):
                # Snapshot inside BEGIN IMMEDIATE: no other dispatcher/rater can change
                # this history until commit. New unrated tasks cannot become candidates.
                # Include candidates that reach the ten-presentation gap later in this batch.
                history = [(row, json.loads(row['payload'])['prompt']) for row in con.execute('''
                    SELECT p.*,q.payload FROM ai_presentations p
                    JOIN ai_ratings r ON r.task_id=p.task_id
                    JOIN ai_questions q ON q.question_id=p.question_id
                    WHERE p.run_id=? AND p.encore_of IS NULL AND p.sequence<=?
                    ORDER BY p.sequence''', (run_id, sequence + min(count, available) - 11))]
                # Count issued encores, including pending ones, exactly as before.
                repeats = Counter(json.loads(row[0])['prompt'] for row in con.execute('''
                    SELECT q.payload FROM ai_presentations p JOIN ai_questions q ON q.question_id=p.question_id
                    WHERE p.run_id=? AND p.encore_of IS NOT NULL''', (run_id,)))
                prompts = {row['task_id']: prompt for row, prompt in history}
                timing['history_candidates'] = len(history)
                timing['issued_encores'] = sum(repeats.values())
            created = []
            for _ in range(min(count,available)):
                rng = random.Random(f"{config['seed']}:{sequence}:encore")
                with timing_phase(timing, 'encore_select'):
                    eligible = [prior for prior, prompt in history
                                if prior['sequence'] <= sequence - 10 and repeats[prompt] < 5]
                    encore = rng.choice(eligible) if eligible and rng.random() < encore_probability(sequence) else None
                if encore:
                    qid = encore['question_id']; source = 'encore'; encore_of = encore['task_id']
                elif fresh_human:
                    qid = fresh_human.pop(0); source = 'human_match'; encore_of = None
                else:
                    # Do not fall back until outstanding matched-human tasks have
                    # actually been rated, including tasks created earlier in this batch.
                    if ((created and any(self._task(con, task)['source']=='human_match' for task in created))
                            or any(self._task(con, p['task_id'])['source']=='human_match' for p in pending)):
                        break
                    queued = None
                    for attempt in range(6):
                        queued = con.execute('SELECT question_id FROM ai_random_queue WHERE run_id=? ORDER BY queue_order LIMIT 1', (run_id,)).fetchone()
                        if queued or attempt == 5:
                            break
                        with timing_phase(timing, 'random_sample'):
                            self._fill_random_queue(con, run_id, config)
                    if queued is None:
                        break
                    qid = queued['question_id']; source = 'random'; encore_of = None
                    con.execute('DELETE FROM ai_random_queue WHERE run_id=? AND question_id=?', (run_id, qid))
                task_id = 'ai-task-' + uuid.uuid4().hex
                with timing_phase(timing, 'task_write'):
                    con.execute('INSERT INTO ai_presentations VALUES(?,?,?,?,?,?,?)',
                                (task_id,run_id,qid,sequence,source,encore_of,utc_now()))
                    if assignment:
                        con.execute('INSERT INTO ai_assignment_tasks VALUES(?,?)',(task_id,assignment_id))
                    con.execute('DELETE FROM ai_random_queue WHERE run_id=? AND question_id=?', (run_id,qid))
                if encore:
                    repeats[prompts[encore['task_id']]] += 1
                created.append(task_id); sequence += 1
            if request_id is not None and created:
                # Allocation and receipt commit together: a lost reply replays this exact batch,
                # even after individual tasks have been rated. Empty results are retryable.
                with timing_phase(timing, 'task_write'):
                    con.execute('INSERT INTO ai_dispatch_requests VALUES(?,?,?,?)',
                                (run_id,request_id,count,canonical(created)))
            rows = [self._task(con, task_id) for task_id in created]
            with timing_phase(timing, 'commit'):
                con.commit()
            return rows

    @staticmethod
    def _task(con, task_id: str) -> dict:
        row = con.execute('''SELECT p.*,q.payload,q.human_sources FROM ai_presentations p
            JOIN ai_questions q ON q.question_id=p.question_id WHERE p.task_id=?''', (task_id,)).fetchone()
        if row is None:
            raise LookupError('Unknown AI task')
        return dict(row)

    def task(self, run_id: str, task_id: str) -> dict:
        with operation_timing('task', run_id=run_id, task_id=task_id) as timing, \
                self._timed_lock(timing), closing(self._connect()) as con:
            row = self._task(con, task_id)
            if row['run_id'] != run_id:
                raise LookupError('Task does not belong to this AI run')
            return row

    def record(self, batch: AIRatingBatch) -> dict:
        if len({r.task_id for r in batch.ratings}) != len(batch.ratings):
            raise ValueError('A batch may not repeat a task_id')
        accepted = 0; duplicates = 0
        with operation_timing('record', run_id=batch.run_id, count=len(batch.ratings)) as timing, \
                self._timed_lock(timing), closing(self._connect()) as con, con:
            con.execute('BEGIN IMMEDIATE')
            config = json.loads(self._run(con, batch.run_id)['config'])
            for rating in batch.ratings:
                row = self._task(con, rating.task_id)
                if row['run_id'] != batch.run_id:
                    raise LookupError('Task does not belong to this AI run')
                answer = rating.model_dump(mode='json')
                assignment=con.execute('''SELECT a.config FROM ai_assignments a JOIN ai_assignment_tasks t
                    ON t.assignment_id=a.assignment_id WHERE t.task_id=?''',(rating.task_id,)).fetchone()
                rating_config=json.loads(assignment['config']) if assignment else config
                if rating.worker is None:
                    # Preserve pre-upgrade canonical payloads for exact retries.
                    answer.pop('worker',None)
                    if rating_config['model_settings'].get('allocation') == 'local_shared_pool_v2':
                        raise ValueError('Shared-pool ratings require the actual worker identity')
                elif rating.worker.model != rating_config['model']:
                    raise ValueError('Worker model does not match the shared run model')
                if len(canonical(answer)) > 24000:
                    raise ValueError('Rating and worker metadata are too large')
                payload = canonical(answer)
                old = con.execute('SELECT payload FROM ai_ratings WHERE task_id=?', (rating.task_id,)).fetchone()
                if old:
                    if old['payload'] != payload:
                        raise ValueError('This presentation is already rated; retries must preserve the exact body. Use a new run for another independent evaluation.')
                    duplicates += 1
                else:
                    con.execute('INSERT INTO ai_ratings VALUES(?,?,?)', (rating.task_id,payload,utc_now()))
                    accepted += 1
        return dict(accepted=accepted, already_recorded=duplicates, run_id=batch.run_id)

    def stats(self, run_id: str) -> dict:
        with self._lock, closing(self._connect()) as con:
            run = self._run(con, run_id)
            legacy=con.execute('''SELECT COUNT(*) FROM ai_presentations p JOIN ai_ratings r ON r.task_id=p.task_id
                WHERE p.run_id=? AND NOT EXISTS(SELECT 1 FROM ai_assignment_tasks t WHERE t.task_id=p.task_id)''',(run_id,)).fetchone()[0]
            return dict(self._run_progress(con,run),legacy_ratings=legacy,storage='ai_verification/ratings.sqlite3')

    def export_csv(self, run_id: str | None = None) -> str:
        with self._lock, closing(self._connect()) as con:
            if run_id is not None:
                self._run(con, run_id)  # Preserve 404 for an unknown per-run export.
            query = '''SELECT p.*,q.payload AS question,q.human_sources, a.config AS run_config,
                r.payload AS answer,r.received_at FROM ai_presentations p
                JOIN ai_questions q ON q.question_id=p.question_id
                JOIN ai_runs a ON a.run_id=p.run_id
                JOIN ai_ratings r ON r.task_id=p.task_id'''
            params = ()
            if run_id is not None:
                query += ' WHERE p.run_id=?'
                params = (run_id,)
            rows = con.execute(query + ' ORDER BY a.created_at,p.run_id,p.sequence',params).fetchall()
            records = []
            for row in rows:
                config = json.loads(row['run_config'])
                assignment=con.execute('''SELECT a.assignment_id,a.config FROM ai_assignments a JOIN ai_assignment_tasks t
                    ON t.assignment_id=a.assignment_id WHERE t.task_id=?''',(row['task_id'],)).fetchone()
                if assignment: config=json.loads(assignment['config'])
                question = json.loads(row['question']); answer = json.loads(row['answer'])
                worker = answer.get('worker') or {}
                records.append(dict(run_id=row['run_id'],assignment_id=assignment['assignment_id'] if assignment else '',evaluator_id=config['evaluator_id'],model=config['model'],
                    model_settings=canonical(config['model_settings']),task_id=row['task_id'],
                    worker_id=worker.get('worker_id'),worker_model=worker.get('model'),
                    worker_model_settings=canonical(worker.get('model_settings',{})),
                    question_id=row['question_id'],sequence=row['sequence'],source=row['source'],encore_of=row['encore_of'],
                    human_sources=row['human_sources'],**{k:question.get(k) for k in ('dataset_id','city_id','pano_id','lon','lat','date','prompt_id','result_revision','prompt','score','zscore','ai_bucket','stratum_population','stratum_sample_count')},
                    rating=answer['rating'],rationale=answer['rationale'],elapsed_ms=answer['elapsed_ms'],
                    rated_at=answer['rated_at'],received_at=row['received_at']))
            output = io.StringIO(newline='')
            fields = list(records[0]) if records else ['run_id','task_id','rating']
            writer = csv.DictWriter(output,fieldnames=fields); writer.writeheader(); writer.writerows(records)
            return output.getvalue()
