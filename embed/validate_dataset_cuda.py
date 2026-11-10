#!/usr/bin/env python3
"""Actual CUDA/Qwen gate for mixed 1/2/8-view sources; never launches a full run.

Execute on a GPU RunPod with the production Qwen environment. Synthetic inputs
and caches are temporary. Writes only the requested small JSON evidence report.
"""
import argparse
from dataclasses import replace
import json
from pathlib import Path
import sys
import tempfile

import numpy as np
from PIL import Image

from dataset_async_pipeline import CachedCPUPreparation, CudaImageEngine, flat_batches, lookahead_batches
from dataset_cpu_cache import CPUCache, build_cache
from dataset_run_state import StorageBudget
from dataset_image_pipeline import DEFAULT_YAWS, write_inventory, transform_image
from pipeline_runtime import NativeProjector


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo-dir', default='/workspace/Qwen3-VL-Embedding')
    parser.add_argument('--model-dir', default='/workspace/models/Qwen3-VL-Embedding-8B')
    parser.add_argument('--precision', choices=['bf16', 'fp16'], default='bf16')
    parser.add_argument('--output', required=True)
    parser.add_argument('--trace', help='Optional Chrome trace of CUDA/CPU activity for overlap inspection')
    args = parser.parse_args()
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError('Actual CUDA hardware is required; CPU tests do not satisfy this gate')
    dtype = getattr(torch, 'bfloat16' if args.precision == 'bf16' else 'float16')
    if args.precision == 'bf16' and not torch.cuda.is_bf16_supported():
        raise RuntimeError('Selected GPU does not support bf16')
    sys.path.insert(0, str(Path(args.repo_dir).resolve()))
    from src.models.qwen3_vl_embedding import Qwen3VLEmbedder
    embedder = Qwen3VLEmbedder(model_name_or_path=args.model_dir, dtype=dtype)
    projector = NativeProjector(precision=args.precision, yaws=DEFAULT_YAWS)
    def fail(*details): raise RuntimeError(repr(details))
    with tempfile.TemporaryDirectory(prefix='uf-cuda-gate-') as temporary:
        root = Path(temporary); rules = []
        rng = np.random.default_rng(20260920)
        for name, projection, mode, shape in [
                ('perspective', 'perspective', 'center_crop', (600, 800)),
                ('two_halves', 'perspective', 'horizontal_halves_if_2_to_1', (512, 1024)),
                ('panorama', 'equirectangular', 'center_crop', (512, 1024))]:
            directory = root/name; directory.mkdir()
            for i in range(2):
                Image.fromarray(rng.integers(0, 256, (*shape, 3), dtype=np.uint8)).save(directory/f'{i}.png')
            rules.append({'dataset_id': name, 'container': str(directory/'*.png'),
                          'projection': projection, 'perspective_mode': mode})
        catalog = root/'catalog.json'; catalog.write_text(json.dumps({'version': 1, 'sources': rules}))
        inventory = root/'inventory.jsonl'
        summary = write_inventory(catalog, inventory)
        summary['catalog_snapshot'] = json.loads(catalog.read_text())
        build_cache(catalog, inventory, summary, root/'cache', StorageBudget(root, root/'cache', 0, 0))
        cache = CPUCache(root/'cache', catalog, inventory, summary)
        preparation = CachedCPUPreparation(cache, workers=2, prefetch=4)
        sources = list(preparation.iterate(cache.records()))
        try:
            geometry_checks = []
            for source in sources:
                if source.record.projection != 'equirectangular': continue
                gpu_views = projector([source])
                cpu_views = transform_image(source.image, 'equirectangular')
                try:
                    for index, (actual, (reference, meta)) in enumerate(zip(gpu_views, cpu_views)):
                        difference = np.abs(np.asarray(actual).astype(float)-np.asarray(reference).astype(float))
                        if difference.mean() > .1 or difference.max() > 2:
                            raise AssertionError(f'CUDA/label geometry mismatch at yaw {meta["yaw_degrees"]}')
                        geometry_checks.append({'source': source.record.source_index, 'view': index,
                            'yaw': meta['yaw_degrees'], 'mean_pixel_difference': float(difference.mean()),
                            'maximum_pixel_difference': float(difference.max())})
                finally:
                    for image in gpu_views: image.close()
                    for image, _ in cpu_views: image.close()
            batches = list(flat_batches(sources, 5, fail))
            # Reference calls are intentionally outside the fast-path assertions.
            references = []
            for batch in batches:
                images = []
                for source, index in batch:
                    if source.record.projection == 'equirectangular':
                        views = projector([source]); images.append(views[index])
                        for i, image in enumerate(views):
                            if i != index: image.close()
                    else:
                        images.append(source.images[index].copy())
                try:
                    with torch.inference_mode(), torch.autocast('cuda', dtype=dtype):
                        values = embedder.process([{'image': image} for image in images], normalize=True)
                    references.append(values.to(device='cpu', dtype=torch.float16).numpy())
                finally:
                    for image in images: image.close()
            processor = embedder.processor
            class CheckedProcessor:
                def __getattr__(self, name): return getattr(processor, name)
                def __call__(self, **kwargs):
                    if not all(image.device.type == 'cuda' for image in kwargs['images']):
                        raise AssertionError('A model RGB image returned to host')
                    output = processor(**kwargs)
                    if output['pixel_values'].device.type != 'cuda':
                        raise AssertionError('Qwen preprocessing returned CPU pixel values')
                    return output
            embedder.processor = CheckedProcessor()
            projector.to_pil = lambda *_: fail('Fast path called to_pil')
            embedder.process = lambda *_args, **_kwargs: fail('Fast path called ordinary process')
            engine = CudaImageEngine(embedder, projector, args.precision, prepare_sources=2)
            evidence = []
            from contextlib import nullcontext
            profile = torch.profiler.profile(activities=[torch.profiler.ProfilerActivity.CPU,
                torch.profiler.ProfilerActivity.CUDA], record_shapes=True) if args.trace else nullcontext()
            with profile as trace:
                for repetition in range(2):
                    for index, (batch, values, error) in enumerate(lookahead_batches(iter(batches), engine)):
                        if error: raise RuntimeError(error)
                        baseline = references[index].astype(np.float32)
                        actual = values.astype(np.float32)
                        delta = float(np.max(np.abs(actual-baseline)))
                        cosine = np.sum(actual*baseline, axis=1)/(np.linalg.norm(actual,axis=1)*np.linalg.norm(baseline,axis=1))
                        if delta > 1e-4 or float(cosine.min()) < 0.99999:
                            raise AssertionError(f'Numerical equivalence failed: max_abs={delta}, min_cos={cosine.min()}')
                        evidence.append({'pass': repetition, 'batch': index, 'images': len(batch),
                            'max_abs_difference': delta, 'minimum_cosine': float(cosine.min())})
            if args.trace:
                trace.export_chrome_trace(args.trace)
            if not engine.cache.hits:
                raise AssertionError('Position cache was not reused')
            report = {'status': 'passed', 'device': torch.cuda.get_device_name(),
                'torch': torch.__version__, 'precision': args.precision,
                'source_view_counts': [len(source.rows) for source in sources],
                'batch_counts': [len(batch) for batch in batches], 'pixel_device': 'cuda',
                'model_dimension': 4096, 'comparisons': evidence, 'metrics': engine.stats,
                'geometry_checks': geometry_checks,
                'note': 'Inspect optional CUDA trace for physical overlap; scheduling overlap is separately regression-tested.'}
            Path(args.output).write_text(json.dumps(report, indent=2))
            print(json.dumps(report, indent=2))
        finally:
            preparation.close()


if __name__ == '__main__':
    main()
