#!/usr/bin/env python3
"""Test and optionally install the reviewed heterogeneous v4 release on RunPod.

Run with the intended Linux Python environment. No Pod restart, dependency
installation or production inference is performed by this installer.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

CODE = ['dataset_cpu_cache.py', 'test_dataset_cpu_cache.py', '03_prepare_dataset_cpu.sh', 'run_dataset_embedding.py', 'dataset_async_pipeline.py', 'dataset_package_store.py',
        'dataset_run_state.py', 'dataset_image_pipeline.py', 'dataset_validation_export.py',
        'validation_projection.py', 'pipeline_runtime.py', 'gpu_input_pipeline.py',
        '04_run_dataset_embedding.sh', 'check_dataset_validation.py', 'validate_dataset_cuda.py',
        'test_dataset_image_pipeline.py', 'test_dataset_runner.py', 'test_dataset_async_pipeline.py',
        'VALIDATION_TARGETS.md', 'heterogeneous-dataset-embedding.md']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', default='/workspace/embed')
    parser.add_argument('--deploy', action='store_true')
    parser.add_argument('--cuda-gate', action='store_true')
    args = parser.parse_args()
    if sys.platform != 'linux':
        raise RuntimeError('Run this installer on RunPod Linux, not the local workstation')
    root = Path(__file__).resolve().parent
    target = Path(args.target).resolve()
    if root == target:
        raise RuntimeError('Run from an isolated release directory, not the live installation')
    for name in CODE:
        if not (root/name).is_file(): raise FileNotFoundError(root/name)
    environment = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
    tests = subprocess.run([sys.executable, '-m', 'unittest', '-v',
        'test_dataset_image_pipeline.py', 'test_dataset_runner.py', 'test_dataset_async_pipeline.py',
        'test_dataset_cpu_cache.py'],
        cwd=root, env=environment, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    (root/'installation-tests.log').write_text(tests.stdout)
    print(tests.stdout)
    tests.check_returncode()
    if args.cuda_gate:
        subprocess.run([sys.executable, str(root/'validate_dataset_cuda.py'),
            '--output', str(root/'cuda-gate.json')], cwd=root, env=environment, check=True)
    if not args.deploy:
        print('CPU checks passed. No files deployed. CUDA gate: '+('passed' if args.cuda_gate else 'not run'))
        return
    for proc in Path('/proc').glob('[0-9]*/cmdline'):
        try: argv = proc.read_bytes().split(b'\0')
        except (FileNotFoundError, PermissionError): continue
        if any(arg.endswith(b'/run_dataset_embedding.py') or arg == b'run_dataset_embedding.py' for arg in argv):
            raise RuntimeError('An embedding process is active; installation stopped')
    if not target.is_dir(): raise RuntimeError('Expected deployed embed directory is missing')
    backup = target/'.deploy-backups'/('multidata-cuda-v4-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    backup.mkdir(parents=True)
    for name in CODE:
        if (target/name).exists(): shutil.copy2(target/name, backup/name)
    for name in CODE:
        content = (root/name).read_text().replace('\r\n', '\n')
        partial = target/(name+'.deploy-partial')
        with partial.open('w') as handle:
            handle.write(content); handle.flush(); os.fsync(handle.fileno())
        if (target/name).exists(): os.chmod(partial, (target/name).stat().st_mode)
        os.replace(partial, target/name)
        if (target/name).read_text() != content: raise RuntimeError('Deployment readback mismatch: '+name)
    receipt = {'backup': str(backup), 'files': CODE, 'cpu_tests': 'passed',
               'cuda_gate': 'passed' if args.cuda_gate else 'pending', 'inference_started': False}
    (target/'dataset-v4-deployment.json').write_text(json.dumps(receipt, indent=2))
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
