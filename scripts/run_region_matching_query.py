"""Run a persisted region query on RunPod using the independent worker."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import secrets
import shutil
import sys
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--backend-root", type=Path, default=Path("/workspace"))
    parser.add_argument("--data-root", type=Path,
                        default=Path("/workspace/reruns/pano512_8B_q90_20260915_b200/embedding"))
    parser.add_argument("--source", default="london_512_8_45_8B")
    parser.add_argument("--target", default="rome_512_8_45_8B")
    parser.add_argument("--longitude", type=float, default=-0.098479)
    parser.add_argument("--latitude", type=float, default=51.513773)
    parser.add_argument("--radius-m", type=float, default=500)
    parser.add_argument("--components", type=int, default=8)
    parser.add_argument("--pca-only", action="store_true",
                        help="Match in the selected PCA subspace without a residual constraint")
    parser.add_argument("--axis-weights", type=float, nargs="+")
    parser.add_argument("--label", default="St Paul's Cathedral, London")
    parser.add_argument("--center-reference", default="https://historicengland.org.uk/listing/heritage-gateway/results/record/0d636742-8028-4a8c-8b7c-e1f9aaf2d338/13c335be-35ea-45d5-ba1d-177803a4ef82")
    parser.add_argument("--max-centers", type=int, default=200_000)
    parser.add_argument("--center-step-m", type=float, default=100)
    args = parser.parse_args()
    if sys.platform != "linux":
        parser.error("Run this backend query on RunPod, never on Windows")
    if not 0 < args.radius_m <= 10_000:
        parser.error("Source radius must be positive and no more than 10 km")
    sys.path.insert(0, str(args.backend_root))
    from pyproj import Geod
    from backend.semantic_map.region_matching_schemas import ModelRequest, RunRequest
    from backend.semantic_map.region_matching_service import RegionConfig, RegionMatchingService, atomic_json

    args.output_root.mkdir(parents=True, exist_ok=True)
    if (args.output_root / "query-request.json").exists():
        parser.error("This experiment already exists; choose a new output root")
    geod = Geod(ellps="WGS84")
    ring = [list(geod.fwd(args.longitude, args.latitude, index * 360 / 256, args.radius_m)[:2])
            for index in range(256)]
    ring.append(ring[0])
    geometry = {"type": "Polygon", "coordinates": [ring]}
    weights = args.axis_weights or [1.0] * args.components
    model_request = ModelRequest(source_dataset_id=args.source, source_geometry=geometry,
                                 fit_components=args.components, selected_views=list(range(8)),
                                 compute_device="auto", spatial_cell_m=25)
    run_template = {"target_dataset_id": args.target, "selected_components": args.components,
                    "axis_weights": weights, "source_coverage": 0.9,
                    "residual_enabled": not args.pca_only, "compute_device": "auto",
                    "neighborhoods": {"center_step_m": args.center_step_m}}
    request = {"source_label": args.label, "source_center": [args.longitude, args.latitude],
               "source_radius_m": args.radius_m, "center_reference": args.center_reference,
               "source_circle_segments": 256, "model_request": model_request.model_dump(mode="json"),
               "run_template": run_template, "max_centers": args.max_centers}
    atomic_json(args.output_root / "query-request.json", request)
    atomic_json(args.output_root / "source.geojson", {
        "type": "FeatureCollection", "features": [{"type": "Feature", "geometry": geometry,
            "properties": {"label": args.label, "center": request["source_center"],
                           "radius_m": args.radius_m, "center_reference": args.center_reference}}]})
    config = RegionConfig(args.data_root, args.output_root / "worker", enabled=True,
                          token=secrets.token_urlsafe(32), max_centers=args.max_centers)
    started = time.perf_counter()
    service = RegionMatchingService(config)
    model_id = run_id = None

    def wait(identifier, kind):
        previous = None
        while True:
            manifest = service.status(identifier, kind)
            if manifest["status"] != previous:
                state = {"status": manifest["status"], "job_kind": kind, "job_id": identifier,
                         "model_id": model_id, "run_id": run_id,
                         "elapsed_seconds": time.perf_counter() - started}
                atomic_json(args.output_root / "state.json", state)
                print(json.dumps(state), flush=True)
                previous = manifest["status"]
            if manifest["status"] == "ready":
                return manifest
            if manifest["status"] in {"failed", "cancelled"}:
                raise RuntimeError(manifest.get("error", manifest["status"]))
            time.sleep(1)

    try:
        model_id = service.submit_model(model_request)["id"]
        model_manifest = wait(model_id, "models")
        atomic_json(args.output_root / "model-manifest.json", model_manifest)
        run_request = RunRequest(model_id=model_id, **run_template)
        run_id = service.submit_run(run_request)["id"]
        run_manifest = wait(run_id, "runs")
        atomic_json(args.output_root / "run-manifest.json", run_manifest)
        for name in ["regions.geojson", "profile.json", "exclusions.json"]:
            shutil.copy2(service.artifact(run_id, "runs", name), args.output_root / name)
        regions = json.loads((args.output_root / "regions.geojson").read_text())
        with (args.output_root / "ranked-regions.csv").open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["rank", "longitude", "latitude", "radius_m", "region_score",
                             "matched_weight", "composition_distance", "observed_rows", "occupied_cells"])
            for feature in regions["features"]:
                p = feature["properties"]
                writer.writerow([p["rank"], *p["center"], p["radius_m"], p["score"],
                                 p["matched_weight"], p["composition_distance"], p["observed_rows"], p["occupied_cells"]])
        summary = {"status": "complete", "model_id": model_id, "run_id": run_id,
                   "source_label": args.label, "source_center": request["source_center"],
                   "source_radius_m": args.radius_m, "source_dataset": args.source,
                   "target_dataset": args.target, "source_rows": model_manifest["source_rows"],
                   "source_occupied_cells": model_manifest["occupied_cells"],
                   "fitted_components": model_manifest["fitted_components"], "axis_weights": weights,
                   "effective_axis_weights": run_manifest["profile"]["axis_weights"],
                   "retained_variance_fraction": model_manifest["retained_variance_fraction"],
                   "pca_compute": model_manifest["pca_compute"],
                   "projection_compute": run_manifest["projection_compute"],
                   "source_coverage": run_manifest["profile"]["actual_source_coverage"],
                   "target_rows": run_manifest["valid_target_rows"],
                   "target_matched_rows": run_manifest["matched_rows"],
                   "target_excluded_rows": run_manifest["excluded_rows"],
                   "region_count": run_manifest["region_count"],
                   "region_diagnostics": regions["diagnostics"],
                   "model_stage_seconds": model_manifest.get("stage_timings_seconds"),
                   "run_stage_seconds": run_manifest.get("stage_timings_seconds"),
                   "model_elapsed_seconds": model_manifest["elapsed_seconds"],
                   "run_elapsed_seconds": run_manifest["elapsed_seconds"],
                   "total_seconds": time.perf_counter() - started,
                   "top_regions": [f["properties"] for f in regions["features"]]}
        atomic_json(args.output_root / "summary.json", summary)
        atomic_json(args.output_root / "state.json", {"status": "complete", "model_id": model_id,
                    "run_id": run_id, "elapsed_seconds": summary["total_seconds"],
                    "region_count": summary["region_count"]})
        print(json.dumps({"status": "complete", "source_rows": summary["source_rows"],
                          "target_rows": summary["target_rows"], "region_count": summary["region_count"],
                          "total_seconds": summary["total_seconds"]}), flush=True)
    except Exception as exc:
        atomic_json(args.output_root / "state.json", {"status": "failed", "model_id": model_id,
                    "run_id": run_id, "error": f"{type(exc).__name__}: {exc}",
                    "elapsed_seconds": time.perf_counter() - started})
        raise
    finally:
        service.close()


if __name__ == "__main__":
    main()
