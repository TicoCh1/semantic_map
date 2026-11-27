#!/usr/bin/env bash
set -euo pipefail
work="$(cd "$(dirname "$0")" && pwd)"
root="$(dirname "$work")"
source "$root/phase2_deep_dive/env.sh"
export PYTHONPATH="$root/atlas_150m_release/build:$root/phase2_deep_dive:$root/ablation_semantic_whiten:$PYTHONPATH"
cd "$work"
exec python -u -c 'import os, service, uvicorn; uvicorn.run(service.app,host=os.environ.get("BOUNDARY_HOST","127.0.0.1"),port=18771,workers=1)'
