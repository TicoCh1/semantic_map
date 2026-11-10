"""Finite 10-minute production observation using small status files, never SQL."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import statistics
import subprocess
import time


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--pid', type=int, required=True)
    p.add_argument('--output-root', required=True)
    p.add_argument('--audit-root', required=True)
    p.add_argument('--seconds', type=int, default=600)
    args = p.parse_args()
    root, audit = Path(args.output_root), Path(args.audit_root)
    samples = []
    deadline = time.monotonic() + 1200
    first = None
    while True:
        now = time.monotonic()
        proc = Path('/proc') / str(args.pid)
        alive = proc.exists() and b'run_dataset_embedding.py' in (proc/'cmdline').read_bytes()
        metrics = json.loads((root/'pipeline_metrics.json').read_text()) if (root/'pipeline_metrics.json').exists() else {}
        status = json.loads((root/'run_status.json').read_text()) if (root/'run_status.json').exists() else {}
        if first is None and metrics.get('rgb_images', 0) > 0:
            first = now
        markers = [json.loads(path.read_text()) for path in (root/'packages').glob('*/checkpoint.json')]
        gpu = subprocess.run(['nvidia-smi', '--query-gpu=utilization.gpu,memory.used,power.draw',
                              '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=10)
        gpu_values = [float(value.strip()) for value in gpu.stdout.strip().split(',')] if gpu.returncode == 0 else []
        error_path = root/'embedding_errors.jsonl'
        sample = {'utc': datetime.now(timezone.utc).isoformat(), 'monotonic': now,
            'observation_seconds': None if first is None else now-first, 'pid': args.pid,
            'alive': alive, 'status': status, 'metrics': metrics,
            'committed_views': sum(m['rows'] for m in markers),
            'committed_sources': sum(m['sources'] for m in markers),
            'gpu_utilization': gpu_values[0] if gpu_values else None,
            'gpu_memory_MiB': gpu_values[1] if gpu_values else None,
            'gpu_power_W': gpu_values[2] if gpu_values else None,
            'error_log_bytes': error_path.stat().st_size if error_path.exists() else 0}
        with (audit/'observation.jsonl').open('a') as f: f.write(json.dumps(sample)+'\n')
        if first is not None:
            samples.append(sample)
            duration = samples[-1]['monotonic'] - samples[0]['monotonic']
            if duration:
                sample['average_rgb_per_second'] = (metrics['rgb_images']-samples[0]['metrics']['rgb_images'])/duration
                sample['average_committed_views_per_second'] = (sample['committed_views']-samples[0]['committed_views'])/duration
        (audit/'observation-latest.json').write_text(json.dumps(sample, indent=2))
        print(json.dumps(sample), flush=True)
        if not alive or status.get('status') in ('failed', 'complete', 'complete_with_errors'):
            break
        if first is not None and now-first >= args.seconds:
            break
        if first is None and now > deadline:
            raise RuntimeError('No production progress within startup deadline')
        time.sleep(30)
    if len(samples) > 1:
        duration = samples[-1]['monotonic']-samples[0]['monotonic']
        rate = (samples[-1]['metrics']['rgb_images']-samples[0]['metrics']['rgb_images'])/duration
        durable_rate = (samples[-1]['committed_views']-samples[0]['committed_views'])/duration
        result = {'seconds': duration, 'rgb_per_second': rate,
            'committed_views_per_second': durable_rate,
            'stable_and_at_least_70': duration >= args.seconds and all(s['alive'] for s in samples)
                and rate >= 70 and durable_rate >= 70
                and not any(s['status'].get('status')=='failed' for s in samples),
            'mean_gpu_utilization': statistics.mean(s['gpu_utilization'] for s in samples if s['gpu_utilization'] is not None),
            'peak_observed_gpu_memory_MiB': max(s['gpu_memory_MiB'] or 0 for s in samples),
            'first': samples[0], 'last': samples[-1]}
        (audit/'observation-summary.json').write_text(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
