"""RunPod-only regression tests for read-ahead cache finalization."""
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

import apsw

from finalize_dataset_cpu_cache import (ReadAheadVFS, select_samples,
    validate_database, validate_sampled_database)


class FinalizationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.path = self.root / 'cache.sqlite'
        self.expected = {'identity': 'unchanged'}
        with sqlite3.connect(self.path) as db:
            db.executescript('''CREATE TABLE metadata(id INTEGER PRIMARY KEY, payload TEXT);
                CREATE TABLE containers(name TEXT PRIMARY KEY, metadata TEXT);
                CREATE TABLE sources(id INTEGER PRIMARY KEY, record TEXT NOT NULL,
                    payload TEXT NOT NULL, labels BLOB NOT NULL, error TEXT);''')
            db.execute('INSERT INTO metadata VALUES(1,?)', (json.dumps(self.expected),))
            for i in range(300):
                db.execute('INSERT INTO sources VALUES(?,?,?,?,?)', (i,
                    json.dumps({'source_index': i, 'dataset_id': 'fixture', 'member': f'{i}.jpg'}),
                    json.dumps({'rows': [{'source_index': i}]}), bytes([i % 256]) * 20000,
                    'bad image' if i == 143 else None))
        self.skipped = self.root / 'skipped.jsonl'

    def tearDown(self):
        self.temp.cleanup()

    def validate(self):
        return validate_database(self.path, 300, self.expected, self.skipped, block_size=65536)

    def test_full_validation_and_only_real_error_skipped(self):
        before = self.path.stat()
        result = self.validate()
        self.assertEqual((result['records'], result['errors'], result['views']), (300, 1, 299))
        self.assertEqual(len(self.skipped.read_text().splitlines()), 1)
        self.assertEqual(json.loads(self.skipped.read_text())['source_index'], 143)
        self.assertEqual(before.st_mtime_ns, self.path.stat().st_mtime_ns)
        self.assertLess(result['validation']['read_calls'], 250)

    def test_hole_rejected_even_with_same_max_id(self):
        with sqlite3.connect(self.path) as db: db.execute('DELETE FROM sources WHERE id=90')
        with self.assertRaisesRegex(RuntimeError, 'contiguous'): self.validate()

    def test_misaligned_record_rejected(self):
        with sqlite3.connect(self.path) as db:
            db.execute('UPDATE sources SET record=? WHERE id=90',
                       (json.dumps({'source_index': 89, 'dataset_id': 'fixture'}),))
        with self.assertRaisesRegex(RuntimeError, 'misaligned'): self.validate()

    def test_identity_mismatch_rejected(self):
        self.expected = {'identity': 'wrong'}
        with self.assertRaisesRegex(RuntimeError, 'identity mismatch'): self.validate()

    def test_journal_refused(self):
        Path(str(self.path) + '-journal').write_bytes(b'pending')
        with self.assertRaisesRegex(RuntimeError, 'Journal/WAL'): self.validate()

    def test_structural_corruption_rejected(self):
        with self.path.open('r+b') as f:
            f.seek(4096); f.write(b'\xff' * 256)
        with self.assertRaises((apsw.Error, RuntimeError)): self.validate()

    def test_vfs_returns_exact_blob_bytes_across_blocks_and_is_readonly(self):
        vfs = ReadAheadVFS(block_size=8192, max_blocks=2)
        try:
            with apsw.Connection(self.path.as_uri() + '?immutable=1',
                    flags=apsw.SQLITE_OPEN_READONLY | apsw.SQLITE_OPEN_URI, vfs=vfs.name) as db:
                for i, blob in db.execute('SELECT id,labels FROM sources ORDER BY id DESC'):
                    self.assertEqual(blob, bytes([i % 256]) * 20000)
                with self.assertRaises(apsw.ReadOnlyError): db.execute('DELETE FROM sources')
        finally:
            vfs.unregister()


class SampledFinalizationTests(unittest.TestCase):
    def setUp(self):
        from test_dataset_cpu_cache import CPUCacheTests
        self.fixture = CPUCacheTests()
        self.fixture.setUp()
        self.ready = self.fixture.build()

    def tearDown(self):
        self.fixture.tearDown()

    def validate(self):
        return validate_sampled_database(self.fixture.cache_root/'prepared.sqlite',
            self.fixture.summary['records'], self.ready['identity'],
            self.fixture.root/'sample-errors.jsonl', [0, 1])

    def test_real_cache_samples_validate_without_claiming_full_scan(self):
        result = self.validate()
        self.assertIsNone(result['errors'])
        self.assertFalse(result['validation']['full_integrity_check'])
        self.assertEqual(result['validation']['successful_samples'], 2)
        self.assertEqual(result['validation']['decoded_datasets'], ['fixture'])
        ids, counts = select_samples(self.fixture.inventory, 2)
        self.assertEqual(ids, [0, 1])
        self.assertEqual(counts, {'fixture': 2})

    def test_missing_tail_rejected(self):
        with sqlite3.connect(self.fixture.cache_root/'prepared.sqlite') as db:
            db.execute('DELETE FROM sources WHERE id=1')
        with self.assertRaisesRegex(RuntimeError, 'bounds'): self.validate()

    def test_only_explicit_sample_error_is_skipped(self):
        with sqlite3.connect(self.fixture.cache_root/'prepared.sqlite') as db:
            db.execute("UPDATE sources SET error='bad original image' WHERE id=1")
        result = self.validate()
        self.assertEqual(result['validation']['sample_errors'], 1)
        self.assertEqual(result['validation']['successful_samples'], 1)
        self.assertEqual(json.loads((self.fixture.root/'sample-errors.jsonl').read_text())['source_index'], 1)

    def test_bad_annotation_offset_rejected(self):
        with sqlite3.connect(self.fixture.cache_root/'prepared.sqlite') as db:
            payload = json.loads(db.execute('SELECT payload FROM sources WHERE id=0').fetchone()[0])
            payload['rows'][0]['_cached_labels'][0][1] = -1
            db.execute('UPDATE sources SET payload=? WHERE id=0', (json.dumps(payload),))
        with self.assertRaisesRegex(RuntimeError, 'outside'): self.validate()


if __name__ == '__main__':
    unittest.main()
