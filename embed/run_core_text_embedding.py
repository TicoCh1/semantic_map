#!/usr/bin/env python3
"""Batch text embeddings in the same CORE space as the independent image runs."""
import argparse
import json
from pathlib import Path
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, help='JSON array of strings')
    parser.add_argument('--output-root', required=True)
    parser.add_argument('--model-dir', default='/workspace/models/core-emb-8b')
    parser.add_argument('--repo-dir', default='/workspace/core-emb')
    parser.add_argument('--batch-size', type=int, default=16)
    args = parser.parse_args()
    if args.batch_size <= 0:
        parser.error('batch-size must be positive')
    texts = json.loads(Path(args.input).read_text())
    if not texts or not isinstance(texts, list) or any(not isinstance(x, str) or not x.strip() for x in texts):
        raise ValueError('Expected a nonempty JSON array of nonempty strings')
    from core_embedding_safety import check_output_root
    root = check_output_root(args.output_root, args.model_dir, args.repo_dir)
    import numpy as np
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError('CUDA is required; no model loaded or output created')
    from dataset_run_state import RunLock
    from dataset_package_store import atomic_json
    from core_embedding_adapter import CoreEmbedder, provenance
    root.mkdir(parents=True, exist_ok=True)
    with RunLock(root):
        manifest = {'core': provenance(args.repo_dir, args.model_dir), 'texts': texts,
                    'batch_size': args.batch_size, 'dtype': 'float16', 'dimension': 4096,
                    'normalization': 'last_valid_hidden_float32_L2_then_float16'}
        manifest_path = root / 'run_manifest.json'
        if manifest_path.exists() and json.loads(manifest_path.read_text()) != manifest:
            raise RuntimeError('Text/model configuration changed; use a new output root')
        if not manifest_path.exists() and any(x.name != '.embedding.lock' for x in root.iterdir()):
            raise RuntimeError('Refusing a nonempty, unowned text output root')
        atomic_json(manifest_path, manifest)
        output = root / 'text_embeddings.npy'
        if output.exists():
            array = np.load(output, mmap_mode='r', allow_pickle=False)
            if array.shape != (len(texts), 4096) or array.dtype != np.float16 or not np.isfinite(array).all():
                raise RuntimeError('Invalid existing CORE text output')
            print(json.dumps({'status': 'already_complete', 'shape': list(array.shape)}))
            return
        started = time.monotonic()
        model = CoreEmbedder(args.model_dir, args.repo_dir)
        loaded = time.monotonic()
        values = []
        for start in range(0, len(texts), args.batch_size):
            vectors = model.process([{'text': text} for text in texts[start:start + args.batch_size]], normalize=False)
            vectors = torch.nn.functional.normalize(vectors.float(), p=2, dim=-1)
            values.append(vectors.to(device='cpu', dtype=torch.float16).numpy())
        array = np.concatenate(values)
        if array.shape != (len(texts), 4096) or not np.isfinite(array).all():
            raise RuntimeError('Invalid CORE text embeddings')
        import os
        with output.with_suffix('.npy.partial').open('wb') as handle:
            np.save(handle, array, allow_pickle=False); handle.flush(); os.fsync(handle.fileno())
        os.replace(output.with_suffix('.npy.partial'), output)
        atomic_json(root / 'complete.json', {'status': 'complete', 'shape': list(array.shape),
            'model_load_seconds': loaded - started, 'inference_and_write_seconds': time.monotonic() - loaded})
        print((root / 'complete.json').read_text())


if __name__ == '__main__':
    main()
