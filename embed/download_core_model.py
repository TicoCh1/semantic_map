#!/usr/bin/env python3
"""Download the official merged CORE embedder, pinned to its resolved revision."""
import argparse
import json
from pathlib import Path
import time


def main():
    from huggingface_hub import HfApi, snapshot_download
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model-dir', default='/workspace/models/core-emb-8b')
    parser.add_argument('--revision', default='main')
    parser.add_argument('--metadata-only', action='store_true')
    args = parser.parse_args()
    repo = 'Alibaba-NLP/core-emb-8b'
    started = time.monotonic()
    info = HfApi().model_info(repo, revision=args.revision, files_metadata=True)
    files = [{'name': f.rfilename, 'size': f.size} for f in info.siblings
             if f.rfilename.endswith(('.json', '.safetensors', '.bin', '.txt', '.jinja', '.md'))]
    report = {'model_id': repo, 'revision': info.sha, 'files': files,
              'total_bytes': sum(f['size'] or 0 for f in files)}
    print(json.dumps(report), flush=True)
    if args.metadata_only:
        return
    root = Path(args.model_dir)
    snapshot_download(repo, revision=info.sha, local_dir=root,
                      allow_patterns=[f['name'] for f in files], max_workers=4)
    for item in files:
        path = root / item['name']
        if not path.is_file() or path.stat().st_size != item['size']:
            raise RuntimeError(f'Incomplete download: {path}')
    report['download_seconds'] = time.monotonic() - started
    report['status'] = 'complete'
    (root / 'urbanfabric-download.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
