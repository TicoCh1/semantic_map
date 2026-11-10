import json
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

from run_logged_embedding import supervise


class LoggingTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='embedding-log-test-')
        self.root=Path(self.temp.name)
    def tearDown(self):self.temp.cleanup()
    def run_child(self,source):
        return supervise([sys.executable,'-u','-c',source],self.root,.03)
    def records(self):
        directory=next(self.root.iterdir())
        return directory,[json.loads(line) for line in (directory/'timing.jsonl').read_text().splitlines()]

    def test_silent_startup_has_heartbeat_and_total_time(self):
        self.assertEqual(self.run_child('import time;time.sleep(.16)'),0)
        _,rows=self.records()
        self.assertEqual(rows[0]['event'],'session_start')
        self.assertEqual(rows[-1]['event'],'session_end')
        self.assertGreaterEqual(sum(r['event']=='heartbeat' for r in rows),3)
        self.assertGreaterEqual(rows[-1]['session_elapsed_seconds'],.16)

    def test_stdout_stderr_and_progress_saved(self):
        code="import sys,json;print('hello');print('stderr sample',file=sys.stderr);print(json.dumps({'timestamp':'sample','elapsed_seconds':1.5,'stage':'embedding','committed_panos':8}))"
        self.assertEqual(self.run_child(code),0)
        path,rows=self.records()
        text=(path/'console.log').read_text()
        self.assertIn('hello',text);self.assertIn('stderr sample',text)
        progress=next(r for r in rows if r['event']=='pipeline_progress')
        self.assertEqual(progress['progress']['committed_panos'],8)
        self.assertEqual(rows[-1]['last_pipeline_progress']['elapsed_seconds'],1.5)

    def test_import_or_runtime_exception_logged(self):
        self.assertNotEqual(self.run_child("raise RuntimeError('startup failure')"),0)
        path,rows=self.records()
        self.assertIn('Traceback',(path/'console.log').read_text())
        self.assertEqual(rows[-1]['exit_code'],1)

    def test_missing_python_still_logged(self):
        self.assertEqual(supervise(['/nonexistent/embedding-python'],self.root,.03),1)
        _,rows=self.records()
        self.assertTrue(any(r['event']=='supervisor_error' for r in rows))
        self.assertEqual(rows[-1]['event'],'session_end')

    def test_resume_uses_new_log_directory(self):
        self.run_child("print('first')")
        self.run_child("print('second')")
        directories=list(self.root.iterdir())
        self.assertEqual(len(directories),2)
        self.assertNotEqual(directories[0].name,directories[1].name)
        self.assertEqual({(p/'console.log').read_text().strip() for p in directories},{'first','second'})

    @unittest.skipUnless(sys.platform!='win32','POSIX signal test')
    def test_killed_child_gets_end_record(self):
        self.assertEqual(self.run_child('import os,signal;os.kill(os.getpid(),signal.SIGKILL)'),137)
        _,rows=self.records()
        self.assertEqual(rows[-1]['exit_code'],137)

    def test_closed_console_does_not_stop_file_logging(self):
        class Closed:
            def write(self,_):raise BrokenPipeError()
            def flush(self):raise BrokenPipeError()
        with patch('sys.stdout',Closed()):
            result=self.run_child("print('survives closed output')")
        self.assertEqual(result,0)
        path,_=self.records()
        self.assertIn('survives closed output',(path/'console.log').read_text())

    def test_stage_times_cover_elapsed_without_double_counting(self):
        from pipeline_runtime import Stats
        rows=[]
        with Stats(.03,emit=rows.append) as stats:
            stats.set(stage='inventory');time.sleep(.04)
            stats.set(stage='embedding',city='rome');time.sleep(.04)
            stats.set(stage='complete')
        last=rows[-1]
        self.assertGreaterEqual(last['stage_wall_seconds']['inventory'],.04)
        self.assertGreaterEqual(last['stage_wall_seconds']['embedding:rome'],.04)
        self.assertAlmostEqual(sum(last['stage_wall_seconds'].values()),last['elapsed_seconds'],delta=.01)

    @unittest.skipUnless(sys.platform!='win32','POSIX signal test')
    def test_sigterm_is_forwarded_and_logged(self):
        wrapper=Path(__file__).with_name('run_logged_embedding.py')
        source="import signal,time,sys;signal.signal(signal.SIGTERM,lambda *_:sys.exit(0));print('READY',flush=True);time.sleep(30)"
        process=subprocess.Popen([sys.executable,str(wrapper),'--log-dir',str(self.root),'--interval','.03','--',sys.executable,'-u','-c',source],stdout=subprocess.DEVNULL)
        try:
            deadline=time.monotonic()+10
            while time.monotonic()<deadline:
                files=list(self.root.glob('*/console.log'))
                if files and 'READY' in files[0].read_text():break
                time.sleep(.02)
            else:self.fail('Child did not become ready')
            process.send_signal(signal.SIGTERM)
            self.assertEqual(process.wait(timeout=10),0)
            _,rows=self.records()
            self.assertTrue(any(r['event']=='signal_received' for r in rows))
            self.assertEqual(rows[-1]['exit_code'],0)
        finally:
            if process.poll() is None:process.kill();process.wait()


if __name__=='__main__':unittest.main(verbosity=2)
