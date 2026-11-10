"""Bounded B200 batch calibration; no production outputs or source changes."""
import argparse
import gc
import json
from pathlib import Path
import sys
import time
from types import SimpleNamespace

import numpy as np
from PIL import Image

from dataset_async_pipeline import CudaImageEngine, lookahead_batches
from dataset_image_pipeline import DEFAULT_YAWS
from pipeline_runtime import NativeProjector


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--batches', default='512,1024')
    args = parser.parse_args()
    import torch
    sys.path.insert(0, '/workspace/Qwen3-VL-Embedding')
    from src.models.qwen3_vl_embedding import Qwen3VLEmbedder
    model = Qwen3VLEmbedder(model_name_or_path='/workspace/models/Qwen3-VL-Embedding-8B',
                           dtype=torch.bfloat16)
    engine = CudaImageEngine(model, NativeProjector(precision='bf16', yaws=DEFAULT_YAWS), 'bf16', 4)
    pixels = np.random.default_rng(42).integers(0, 256, (512, 512, 3), dtype=np.uint8)
    image = Image.fromarray(pixels)
    source = SimpleNamespace(record=SimpleNamespace(projection='perspective', source_index=0),
                             images=[image])
    reports = []
    for size in map(int, args.batches.split(',')):
        torch.cuda.reset_peak_memory_stats()
        batch = [(source, 0)] * size
        try:
            engine.forward(engine.prepare(batch), size)
            engine.synchronize()
            started = time.monotonic()
            for items, values, error in lookahead_batches(iter([batch] * 4), engine):
                if error: raise RuntimeError(error)
                assert values.shape == (size, 4096) and np.isfinite(values).all()
            engine.synchronize()
            elapsed = time.monotonic() - started
            report = {'batch': size, 'images': size * 4, 'seconds': elapsed,
                      'images_per_second': size * 4 / elapsed, 'status': 'passed',
                      'peak_allocated_GiB': torch.cuda.max_memory_allocated() / 2**30,
                      'peak_reserved_GiB': torch.cuda.max_memory_reserved() / 2**30}
        except Exception as exc:
            report = {'batch': size, 'status': 'failed', 'error': f'{type(exc).__name__}: {exc}'}
            reports.append(report)
            Path(args.output).write_text(json.dumps(reports, indent=2))
            print(json.dumps(report), flush=True)
            raise
        reports.append(report)
        Path(args.output).write_text(json.dumps(reports, indent=2))
        print(json.dumps(report), flush=True)
        gc.collect(); torch.cuda.empty_cache()
    image.close()


if __name__ == '__main__':
    main()
