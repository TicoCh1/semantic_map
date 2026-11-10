"""Synthetic byte-preservation and resume checks; no real images or model loaded."""
import io
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import export_london_native as export


class NativeExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.sources = self.root/'sources'; self.sources.mkdir()
        self.run_root = self.root/'run'; self.run_root.mkdir()
        self.archive = self.sources/'01.tar'
        self.payloads = [b'\xff\xd8'+bytes([i+1])*size+b'\xff\xd9' for i,size in enumerate((37,1024,2049,53,177))]
        with tarfile.open(self.archive,'w',format=tarfile.PAX_FORMAT) as tar:
            for i,payload in enumerate(self.payloads):
                # Same basename in different directories, plus a long PAX name.
                member=tarfile.TarInfo(f"source{i}/"+('x'*130 if i==3 else 'same')+'.jpg')
                member.size=len(payload);tar.addfile(member,io.BytesIO(payload))
        with tarfile.open(self.archive,'r:') as tar: members=tar.getmembers()
        st=self.archive.stat()
        owner=dict(run_id='synthetic-run',config=dict(pano_root=str(self.sources),sources=[
            dict(name='01.tar',city='london',size=st.st_size,mtime_ns=st.st_mtime_ns)]))
        (self.run_root/'run.json').write_text(json.dumps(owner))
        with closing(sqlite3.connect(self.run_root/'inventory.sqlite3')) as con:
            con.execute('''CREATE TABLE records(seq INTEGER,city TEXT,namespace TEXT,tar_name TEXT,
                member_name TEXT,offset_data INTEGER,byte_size INTEGER,pano_id INTEGER,lon REAL,
                lat REAL,capture_date INTEGER,heading REAL,shard INTEGER)''')
            for i,member in enumerate(members):
                con.execute('INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    (i+1,'london','london','01.tar',member.name,member.offset_data,member.size,i+10,0.1,51.5,202509,None,None if i==4 else 0))
            con.execute('CREATE TABLE failures(record_id INTEGER,stage TEXT,resolved INTEGER)')
            con.execute("INSERT INTO failures VALUES(5,'prepare',0)")
            con.commit()
        self.args=SimpleNamespace(run_root=str(self.run_root),source_root=str(self.sources),
            output_dir=str(self.root/'export'),expected_count=5,shard_panos=2,
            execute=True,resume=False,available_output_gb=5)

    def call(self):
        with patch.object(export,'emit'),patch.object(export,'filesystem_type',return_value='ext4'):
            return export.run(self.args)

    def test_plan_has_no_output_writes(self):
        self.args.execute=False
        result=self.call()
        self.assertEqual(result['count'],5)
        self.assertFalse(Path(self.args.output_dir).exists())

    def test_payload_bytes_identity_and_failed_input_preserved(self):
        self.call();output=Path(self.args.output_dir);actual=[];names=[]
        for p in sorted(output.glob('*.tar')):
            with tarfile.open(p,'r:') as tar:
                for member in tar:
                    names.append(member.name);actual.append(tar.extractfile(member).read())
        self.assertEqual(actual,self.payloads)
        self.assertEqual(len(names),len(set(names)))
        self.assertEqual(json.loads((output/'complete.json').read_text())['count'],5)
        self.assertTrue(any('/00000005/' in name for name in names))

    def test_resume_after_partial_shard_preserves_committed_shards(self):
        original=export.write_shard
        def fail_second(paths,*args):
            if '00001' in paths['tar'].name:
                paths['tar'].with_suffix('.tar.partial').write_bytes(b'incomplete')
                raise OSError('simulated interrupted write')
            return original(paths,*args)
        with patch.object(export,'write_shard',side_effect=fail_second):
            with self.assertRaises(OSError):self.call()
        first=Path(self.args.output_dir)/'london_native_00000.tar'
        before=first.stat().st_mtime_ns
        self.args.resume=True;self.call()
        self.assertEqual(first.stat().st_mtime_ns,before)
        self.assertTrue((Path(self.args.output_dir)/'complete.json').exists())

    def test_changed_source_refused(self):
        with self.archive.open('ab') as f:f.write(b'changed')
        with self.assertRaisesRegex(ValueError,'changed since inventory'):self.call()
        self.assertFalse(Path(self.args.output_dir).exists())

    def test_resume_rejects_truncated_committed_archive(self):
        self.call();self.args.resume=True
        p=Path(self.args.output_dir)/'london_native_00000.tar'
        p.write_bytes(p.read_bytes()[:-1])
        with self.assertRaisesRegex(ValueError,'size mismatch'):self.call()

    def test_insufficient_quota_refused_before_copy(self):
        self.args.available_output_gb=0
        with self.assertRaisesRegex(ValueError,'Insufficient output capacity'):self.call()
        self.assertFalse(list(Path(self.args.output_dir).glob('*.tar')))

    def test_output_inside_sources_refused(self):
        self.args.output_dir=str(self.sources/'export')
        with self.assertRaisesRegex(ValueError,'separate'):self.call()


if __name__=='__main__': unittest.main()
