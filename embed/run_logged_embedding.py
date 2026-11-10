#!/usr/bin/env python3
"""Standard-library supervisor: durable per-launch logs, independent of Torch."""
import argparse
from datetime import datetime, timezone
import json
import os
import platform
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time
import uuid


def utc():
    return datetime.now(timezone.utc).isoformat()


class SessionLog:
    def __init__(self, directory, command):
        directory=Path(directory)
        directory.mkdir(parents=True,exist_ok=True)
        self.session_id=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:8]
        self.path=directory/self.session_id
        self.path.mkdir()
        self.console=(self.path/'console.log').open('x',encoding='utf-8',buffering=1)
        self.timings=(self.path/'timing.jsonl').open('x',encoding='utf-8',buffering=1)
        self.lock=threading.Lock()
        self.started=time.monotonic()
        self.last_output=self.started
        self.last_progress=None
        self.command=command
        self.warned=False

    def record(self,event,**values):
        row=dict(session_id=self.session_id,event=event,timestamp=utc(),
                 session_elapsed_seconds=round(time.monotonic()-self.started,6),**values)
        with self.lock:
            self.timings.write(json.dumps(row,ensure_ascii=True)+'\n')
            self.timings.flush()
            os.fsync(self.timings.fileno())
            self.console.flush()
            os.fsync(self.console.fileno())
        return row

    def output(self,line):
        self.last_output=time.monotonic()
        with self.lock:
            self.console.write(line)
        try:
            progress=json.loads(line)
        except (ValueError,TypeError):
            return
        if isinstance(progress,dict) and 'elapsed_seconds' in progress:
            self.last_progress=progress
            self.record('pipeline_progress',progress=progress)

    def heartbeat(self):
        self.record('heartbeat',seconds_since_child_output=round(time.monotonic()-self.last_output,3),
                    last_pipeline_progress=self.last_progress)

    def close(self):
        self.console.close();self.timings.close()


def supervise(command, directory, interval=30):
    log=SessionLog(directory,command)
    done=threading.Event()
    child=None
    def echo(text):
        try:
            sys.stdout.write(text);sys.stdout.flush()
        except (OSError,ValueError):
            # A closed notebook/terminal output must not kill the paid GPU job.
            pass
    def safe(action,*args,**kwargs):
        try:
            return action(*args,**kwargs)
        except OSError as exc:
            echo(f'LOG_WRITE_ERROR: {exc}; session={log.path}\n')
            return None
    def heartbeat():
        deadline=time.monotonic()+interval
        while not done.wait(max(0,deadline-time.monotonic())):
            safe(log.heartbeat)
            deadline+=interval
            if deadline<time.monotonic():deadline=time.monotonic()+interval
    handlers={}
    def forward(sig,_frame):
        safe(log.record,'signal_received',signal=sig)
        if child is not None and child.poll() is None:
            try:child.send_signal(sig)
            except ProcessLookupError:pass
    ticker=threading.Thread(target=heartbeat,name='persistent-log-clock',daemon=True)
    exit_code=1
    try:
        # Fail before starting expensive work if persistent logging cannot start.
        log.record('session_start',command=command,supervisor_pid=os.getpid())
        echo(f'LOG_DIRECTORY={log.path}\n')
        hardware=dict(cpu_count=os.cpu_count(),platform=platform.platform())
        try:
            gpu=subprocess.run(['nvidia-smi','--query-gpu=name,memory.total,driver_version','--format=csv,noheader'],
                               capture_output=True,text=True,timeout=5)
            hardware['nvidia_smi']=gpu.stdout.strip()
            hardware['nvidia_smi_exit_code']=gpu.returncode
        except (OSError,subprocess.TimeoutExpired) as exc:
            hardware['gpu_probe_error']=str(exc)
        log.record('hardware',**hardware)
        for sig in (signal.SIGINT,signal.SIGTERM):
            handlers[sig]=signal.signal(sig,forward)
        ticker.start()
        environment=dict(os.environ,PYTHONUNBUFFERED='1')
        child=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,
                               text=True,encoding='utf-8',errors='replace',bufsize=1,env=environment)
        safe(log.record,'child_started',child_pid=child.pid)
        for line in child.stdout:
            safe(log.output,line)
            echo(line)
        exit_code=child.wait()
        if exit_code<0:exit_code=128-exit_code
        return exit_code
    except Exception as exc:
        safe(log.record,'supervisor_error',error=f'{type(exc).__name__}: {exc}')
        if child is not None and child.poll() is None:
            # Keep supervising if logging/stream processing itself failed.
            exit_code=child.wait()
            if exit_code<0:exit_code=128-exit_code
            return exit_code
        echo(f'LAUNCH_ERROR: {exc}\n')
        return exit_code
    finally:
        done.set()
        if ticker.is_alive():ticker.join()
        safe(log.record,'session_end',exit_code=exit_code,last_pipeline_progress=log.last_progress)
        for sig,handler in handlers.items():signal.signal(sig,handler)
        if child is not None and child.stdout is not None:child.stdout.close()
        log.close()


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--log-dir',required=True)
    p.add_argument('--interval',type=float,default=30)
    p.add_argument('command',nargs=argparse.REMAINDER)
    args=p.parse_args()
    command=args.command[1:] if args.command[:1]==['--'] else args.command
    if not command or args.interval<=0:p.error('A command and positive interval are required')
    return supervise(command,args.log_dir,args.interval)


if __name__=='__main__':sys.exit(main())
