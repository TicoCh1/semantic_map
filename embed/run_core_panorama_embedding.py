#!/usr/bin/env python3
"""Independent four-city 512/8/45 CORE 8B embedding pipeline."""
import argparse
import json
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import threading

from core_panorama_state import DATASETS, EXPECTED_COUNTS, RunLock, RunState, atomic_json, read_selection, source_specs
from pipeline_runtime import GEOMETRY_VERSION, YAWS, NativeProjector, Stats, process_city, FailurePolicy


def arguments(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--pano-root", default="/workspace/pano")
    p.add_argument('--source-run-root', help='Use the committed retained panorama TARs of a completed Qwen run')
    p.add_argument("--output-root", default="/workspace/reruns/core512_8B_20261006")
    p.add_argument("--selection", default="/workspace/semantic_backend/audits/london_ulez_2021_20260915_5pWR1r/london_ulez_2021_points.csv")
    p.add_argument("--repo-dir", default="/workspace/core-emb")
    p.add_argument("--model-dir", default="/workspace/models/core-emb-8b")
    p.add_argument("--cities", nargs="+", choices=list(DATASETS), default=list(DATASETS))
    p.add_argument("--precision", choices=["fp16", "bf16"], default="bf16")
    p.add_argument("--jpeg-quality", type=int, choices=[85,90,95], default=90)
    for name,default in [("pano-batch",1),("embed-batch",8),("decode-workers",4),("prefetch-panos",16),("checkpoint-panos",8192)]:
        p.add_argument("--"+name,type=int,default=default)
    p.add_argument("--report-seconds", type=float, default=30)
    p.add_argument("--volume-root", help="Actual output volume mount root, required for FUSE quota accounting")
    p.add_argument("--volume-capacity-gb", type=float, help="Confirmed provisioned quota in decimal GB, required on FUSE")
    p.add_argument("--check", action="store_true", help="Read-only preflight; never load model or create output")
    p.add_argument("--inventory-only", action="store_true", help="Build/resume TAR-header inventory without GPU")
    p.add_argument('--retry-failed',action='store_true',help='Retry previously failed images without recomputing successful outputs')
    p.add_argument('--cuda-input-pipeline', action='store_true', default=True, help='CUDA image preprocessing, position cache and one-batch GPU lookahead')
    p.add_argument('--gpu-prepare-panos', type=int, default=8, help='Bound native projection/preprocessing temporaries independently of model batch')
    p.add_argument('--max-consecutive-errors',type=int,default=100)
    p.add_argument('--error-window',type=int,default=1000)
    p.add_argument('--max-error-fraction',type=float,default=.5)
    args = p.parse_args(argv)
    for name in ("pano_batch","embed_batch","decode_workers","prefetch_panos","checkpoint_panos","report_seconds","max_consecutive_errors","error_window"):
        if getattr(args,name) <= 0:
            p.error(f"--{name.replace('_','-')} must be positive")
    if len(set(args.cities)) != len(args.cities):
        p.error("Duplicate cities")
    if not 0 < args.max_error_fraction <= 1:p.error('--max-error-fraction must be in (0,1]')
    if args.gpu_prepare_panos <= 0:p.error('--gpu-prepare-panos must be positive')
    if args.cuda_input_pipeline and args.embed_batch != args.pano_batch*8:
        p.error('CUDA input pipeline currently requires --embed-batch = --pano-batch * 8')
    return args


def safe_root(args):
    root = Path(args.output_root).absolute()
    if any(p.is_symlink() for p in (root,*root.parents)):
        raise ValueError("Output root cannot use symlinks")
    root = root.resolve()
    for protected in (args.pano_root, args.model_dir, args.repo_dir,
                      "/workspace/embedding", "/workspace/semantic_backend", "/workspace/backend", "/workspace/embed"):
        path = Path(protected).resolve()
        if root == path or path in root.parents or root in path.parents:
            raise ValueError(f"Output must be a separate run directory, outside {path}")
    return root


def capacity(args, remaining):
    root = Path(args.output_root).resolve()
    existing = root
    while not existing.exists():
        existing = existing.parent
    fs = json.loads(subprocess.check_output(["findmnt", "-J", "-T", str(existing), "-o", "TARGET,FSTYPE"], text=True))["filesystems"][0]
    free = shutil.disk_usage(existing).free
    quota = args.volume_capacity_gb
    if "fuse" in fs["fstype"].lower() and (quota is None or args.volume_root is None):
        raise ValueError("FUSE df reports shared-pool space, not your quota. Set --volume-root and --volume-capacity-gb to the confirmed output volume allocation.")
    used = None
    if quota is not None:
        mount = Path(args.volume_root or fs["target"]).resolve()
        if mount != Path(fs["target"]).resolve() or (root != mount and mount not in root.parents):
            raise ValueError("--volume-root must be the actual output filesystem mount, not a subdirectory")
        used = int(subprocess.check_output(["du", "-s", "-B1", str(mount)], text=True).split()[0])
        free = min(free, quota*1e9-used)
    per_pano = {85:500000,90:580000,95:770000}[args.jpeg_quality]
    required = remaining*per_pano + (20e9 if remaining else 0)
    return dict(filesystem=fs, provisioned_gb=quota, used_bytes=used,
                available_bytes=free, planned_remaining_bytes=required, sufficient=free >= required)


def main(argv=None):
    args = arguments(argv)
    args.failure_policy=FailurePolicy(args.max_consecutive_errors,args.error_window,args.max_error_fraction)
    root = safe_root(args)
    from core_embedding_safety import check_output_root
    check_output_root(root, args.model_dir, args.repo_dir)
    source_run = None
    if args.source_run_root:
        from core_retained_sources import source_manifest
        args.pano_root, sources, selection, expected_counts, source_run = source_manifest(args.source_run_root, args.cities)
        source_root = Path(args.source_run_root).resolve()
        if root == source_root or source_root in root.parents or root in source_root.parents:
            raise ValueError('CORE output must be separate from the retained Qwen source run')
        # Recheck after resolving the retained input directory.
        safe_root(args)
    else:
        expected_counts = EXPECTED_COUNTS
        selection = read_selection(args.selection) if 'london' in args.cities else set()
        if 'london' in args.cities and len(selection) != expected_counts['london']:
            raise ValueError(f'Expected 156895 London identities, got {len(selection)}')
        sources = source_specs(args.pano_root, args.cities)
    model = Path(args.model_dir).resolve()
    model_config = json.loads((model/"config.json").read_text())
    dimension = model_config["text_config"]["hidden_size"]
    if dimension != 4096:
        raise ValueError(f"Expected CORE 8B dimension 4096, found {dimension}")
    weights = sorted(model.glob("*.safetensors")) or sorted(model.glob("pytorch_model-*.bin"))
    if not weights:
        raise ValueError("Missing model weights")
    config = dict(version=1, cities=args.cities, sources=sources, pano_root=str(Path(args.pano_root).resolve()),
                  model_config=model_config, model_files=[dict(name=p.name,size=p.stat().st_size,mtime_ns=p.stat().st_mtime_ns) for p in weights],
                  dimension=dimension, view_size=512, yaw_degrees=YAWS, fov=45,
                  geometry_version=GEOMETRY_VERSION, jpeg_quality=args.jpeg_quality,
                  jpeg_subsampling=2, output_dtype="float16", reference_dtype="float64", precision=args.precision)
    from core_embedding_adapter import provenance
    config["core"] = provenance(args.repo_dir, args.model_dir)
    config['source_run'] = source_run
    config['pipeline_code'] = [dict(name=name, size=(Path(__file__).parent / name).stat().st_size,
        mtime_ns=(Path(__file__).parent / name).stat().st_mtime_ns) for name in (
        'run_core_panorama_embedding.py', 'core_panorama_state.py', 'core_retained_sources.py',
        'gpu_input_pipeline.py', 'pipeline_runtime.py', 'pipeline_state.py')]
    import torch
    if args.check:
        report = dict(cuda_available=torch.cuda.is_available(), sources=len(sources),
                      expected_counts={c:expected_counts[c] for c in args.cities}, output_root=str(root))
        try:
            report["capacity"] = capacity(args, sum(expected_counts[c] for c in args.cities))
        except ValueError as exc:
            report["capacity_error"] = str(exc)
        print(json.dumps(report, indent=2))
        return 0
    if not args.inventory_only and not torch.cuda.is_available():
        raise RuntimeError("CUDA GPU is required; no model loaded and no output created")
    root.mkdir(parents=True, exist_ok=True)
    stop = threading.Event()
    for sig in (signal.SIGINT,signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())
    with RunLock(root), Stats(args.report_seconds) as stats:
        state = RunState(root, config, args.selection if selection and not source_run else None)
        try:
            if args.retry_failed:
                state.reset_failed()
                (root/'complete.json').unlink(missing_ok=True)
            next_shards = state.recover()
            committed = sum(state.counts(committed=True).values())
            stats.set(stage="preflight", committed_panos=committed, expected_panos=sum(expected_counts[c] for c in args.cities))
            if not args.inventory_only:
                space = capacity(args, sum(expected_counts[c] for c in args.cities)-committed)
                print(json.dumps({"capacity":space}),flush=True)
                if not space["sufficient"]:
                    raise RuntimeError("Insufficient output quota; prepare adequate storage before rerunning")
            if not state.inventory(args.pano_root,selection,stats,stop,expected_counts,args.failure_policy):
                stats.set(stage="interrupted_inventory")
                return 130
            if args.inventory_only:
                stats.set(stage="inventory_complete")
                return 0
            if state.completion()['remaining']==0:
                finish(state,stats)
                return 0
            if stop.is_set():
                return 130
            stats.set(stage="loading_model")
            from core_embedding_adapter import CoreEmbedder
            if args.precision == "bf16" and not torch.cuda.is_bf16_supported():
                raise RuntimeError("GPU does not support bf16; use fp16 with a new output root")
            embedder = CoreEmbedder(model_name_or_path=str(model), repo_dir=args.repo_dir, dtype=getattr(torch,"bfloat16" if args.precision=="bf16" else "float16"))
            projector = NativeProjector(precision=args.precision)
            city_processor = process_city
            if args.cuda_input_pipeline:
                from gpu_input_pipeline import CudaEngine, process_city as gpu_process_city
                args.cuda_engine = CudaEngine(embedder, projector, stats, args.gpu_prepare_panos)
                city_processor = gpu_process_city
                stats.set(input_pipeline='cuda-images-position-cache-prefetch1', gpu_prepare_panos=args.gpu_prepare_panos)
            for city in args.cities:
                if stop.is_set():
                    break
                stats.set(stage="embedding", city=city)
                city_processor(state, city, next_shards[city], args.pano_root, projector, embedder, args, stats, stop)
            if state.completion()['remaining']:
                stats.set(stage="interrupted", **state.completion())
                return 130
            finish(state,stats)
        except Exception as exc:
            state.failure({}, 'fatal', f'{type(exc).__name__}: {exc}')
            stats.set(stage='failed', error=str(exc))
            raise
        finally:
            state.failure_report()
    return 0


def finish(state,stats):
    summary=state.completion()
    status='complete_with_errors' if summary['unresolved_issues'] else 'complete'
    state.failure_report()
    atomic_json(state.root/'complete.json',dict(run_id=state.run_id,status=status,**summary,original_data_retained=True))
    stats.set(stage=status,**summary)


if __name__ == "__main__":
    sys.exit(main())
