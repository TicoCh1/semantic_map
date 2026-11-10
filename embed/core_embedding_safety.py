"""Keep independent CORE artifacts outside source/model/production roots."""
from pathlib import Path


def check_output_root(output, model_dir, repo_dir):
    root = Path(output).absolute()
    if any(path.is_symlink() for path in (root, *root.parents)):
        raise ValueError('CORE output cannot use symlinks')
    root = root.resolve()
    protected = [model_dir, repo_dir, '/workspace/embedding', '/workspace/backend',
                 '/workspace/semantic_backend', '/workspace/pano', '/workspace/embed',
                 '/workspace/reruns/pano512_8B_q90_20260915_b200',
                 '/workspace/reruns/public_datasets_512_qwen8b']
    for value in protected:
        path = Path(value).resolve()
        if root == path or path in root.parents or root in path.parents:
            raise ValueError(f'CORE output overlaps protected data: {path}')
    if root.exists() and (root / 'run_manifest.json').exists():
        import json
        manifest = json.loads((root / 'run_manifest.json').read_text())
        if manifest.get('core', {}).get('model_id') != 'Alibaba-NLP/core-emb-8b':
            raise ValueError('Existing output is not a CORE run')
    return root
