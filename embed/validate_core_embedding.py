#!/usr/bin/env python3
"""Bounded real-GPU equivalence and durable CORE panorama output validation."""
import argparse
import io
import json
from pathlib import Path
import tarfile
import threading
import time


def main():
    import numpy as np
    import torch
    from PIL import Image
    from core_embedding_adapter import CoreEmbedder
    from core_panorama_state import RunState
    from gpu_input_pipeline import CudaEngine, cuda_inputs
    from pipeline_runtime import NativeProjector, PreparedStream, Stats
    from pipeline_state import RunLock, atomic_json, parse_identity, ref_key

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-tar', required=True, help='Small TAR containing native pano identities')
    parser.add_argument('--output-root', required=True)
    parser.add_argument('--model-dir', default='/workspace/models/core-emb-8b')
    parser.add_argument('--repo-dir', default='/workspace/core-emb')
    args = parser.parse_args()
    from core_embedding_safety import check_output_root
    root = check_output_root(args.output_root, args.model_dir, args.repo_dir)
    source = Path(args.source_tar).resolve()
    with tarfile.open(source) as archive:
        selection = {ref_key(*parse_identity(item.name)[:4]) for item in archive if item.isfile()}
    if not 1 <= len(selection) <= 8:
        raise ValueError('Validation TAR must contain 1 to 8 real panoramas')
    if not torch.cuda.is_available():
        raise RuntimeError('CUDA required; no model loaded')
    torch.set_num_threads(8)
    started = time.monotonic()
    model = CoreEmbedder(args.model_dir, args.repo_dir)
    report = {'core': model.provenance, 'model_load_seconds': time.monotonic() - started,
              'gpu': torch.cuda.get_device_name(0), 'checks': {}}
    config = {'cities': ['london'], 'sources': [{'name': source.name, 'city': 'london',
        'namespace': 'london', 'size': source.stat().st_size, 'mtime_ns': source.stat().st_mtime_ns}],
        'dimension': 4096, 'jpeg_quality': 90, 'core': model.provenance}
    root.mkdir(parents=True, exist_ok=True)
    stats, stop = Stats(emit=lambda _: None), threading.Event()
    with RunLock(root):
        state = RunState(root, config)
        state.inventory(source.parent, selection, stats, stop, expected={'london': len(selection)})
        next_shards = state.recover()
        projector = NativeProjector(precision='bf16')
        engine = CudaEngine(model, projector, stats, chunk_panos=1)
        outputs = []
        with PreparedStream(state.pending('london'), source.parent, 2, 3, 90, stats, stop) as stream:
            for item in stream:
                t = time.monotonic()
                prepared = engine.prepare([item])
                fast = engine.forward(prepared, 1)
                outputs.append(fast)
                report['checks'].setdefault('pano_batch_seconds', []).append(time.monotonic() - t)
                if len(outputs) == 1:
                    # Host pixels below are test-only official-reference inputs.
                    with torch.inference_mode():
                        projected = projector.project_tensor([item])
                        pixels = projected.mul(255).clamp(0, 255).to(torch.uint8)
                        gpu_data = cuda_inputs(model, pixels)
                        pil = [Image.fromarray(a) for a in pixels.cpu().numpy().transpose(0, 2, 3, 1)]
                        reference_data = model.reference_inputs([{'image': im} for im in pil])
                        for name in ('input_ids', 'attention_mask', 'image_grid_thw'):
                            assert torch.equal(gpu_data[name].cpu(), reference_data[name]), name
                        pixel_error = float((gpu_data['pixel_values'].cpu() - reference_data['pixel_values']).abs().max())
                        assert pixel_error < 1e-6, pixel_error
                        mask = reference_data['attention_mask']
                        last = mask.sum(1) - 1
                        eod = model.official_processor.tokenizer.convert_tokens_to_ids('<|endoftext|>')
                        assert torch.all(reference_data['input_ids'][torch.arange(len(mask)), last] == eod)
                        reference = model.process([{'image': im} for im in pil]).to('cpu', torch.float16).numpy()
                        difference = float(np.abs(fast[0].astype('float32') - reference.astype('float32')).max())
                        similarity = np.sum(fast[0].astype('float32') * reference.astype('float32'), axis=1)
                        similarity /= np.linalg.norm(fast[0].astype('float32'), axis=1) * np.linalg.norm(reference.astype('float32'), axis=1)
                        assert difference < 5e-4 and float(similarity.min()) > 0.99999, (difference, similarity)
                        report['checks']['official_equivalence'] = {'pixel_max_abs_error': pixel_error,
                            'embedding_max_abs_error': difference, 'minimum_vector_cosine': float(similarity.min()),
                            'tokens_and_grid_equal': True, 'official_eod_last': True}
                        for im in pil: im.close()
                        del gpu_data, reference_data, projected, pixels, reference
                values = fast.astype('float32')
                assert np.isfinite(values).all()
                assert np.max(np.abs(np.linalg.norm(values, axis=-1) - 1)) < .001
                shard = next_shards['london']
                state.write_shard('london', shard, shard, [item], fast, stats)
                next_shards['london'] += 1
                item.image.close()
        engine.synchronize()
        assert state.completion()['remaining'] == 0
        recovered = RunState(root, config)
        recovered.recover()
        assert not list(recovered.pending('london'))
        report['checks']['resume'] = {'remaining': 0, 'counts': recovered.counts(True),
                                    'dataset_namespace': 'london_512_8_45_CORE8B'}
        texts = ['the scene contains a green car', 'a black car', 'green fence around a building']
        t = time.monotonic()
        vectors = model.process([{'text': text} for text in texts]).float().cpu().numpy()
        assert vectors.shape == (3, 4096) and np.isfinite(vectors).all()
        assert np.max(np.abs(np.linalg.norm(vectors, axis=1) - 1)) < .005
        np.save(root / 'validation_text_embeddings.npy', vectors.astype('float16'), allow_pickle=False)
        atomic_json(root / 'validation_texts.json', texts)
        report['checks']['text_batch'] = {'shape': list(vectors.shape), 'seconds': time.monotonic() - t}
        report['stats'] = stats.values
        report['position_cache_hits'] = engine.cache.hits
        report['position_cache_misses'] = engine.cache.misses
        assert report['checks'].get('official_equivalence'), 'No image equivalence check ran'
        assert recovered.counts(True) == {'london': len(selection)}, recovered.counts(True)
        report['peak_gpu_allocated_bytes'] = torch.cuda.max_memory_allocated()
        report['total_seconds'] = time.monotonic() - started
        report['status'] = 'passed'
        atomic_json(root / 'validation_report.json', report)
        print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    main()
