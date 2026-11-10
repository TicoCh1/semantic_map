"""Align saved patch colors to the saved city palette; never fit PCA/t-SNE.

Run with the existing project .venv (NumPy and Pillow). Outputs are separate
RGB sidecars and diagnostics. Source GeoJSON and point binaries stay untouched.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from slim_geojson_for_viewer import iter_feature_json

ROOT = Path(__file__).resolve().parents[2]
VIEWER = ROOT / "frontend_pcatsne"
DATA = VIEWER / "public_pointcloud/data"
SOURCE = VIEWER / "public/webmercator_grid_rgb48_pca50_tsne3/geojson_rgb48"
OUT = DATA / "affine_color_alignment"
REPORT = ROOT / "outputs/pcatsne-affine-colors-20261001"
RECORD = np.dtype([("xy", "<f4", (2,)), ("rgba", "u1", (4,))])
RIDGE = 0.25
VARIANTS = ("affine", "regularized")


def rgb_to_lab(rgb):
    rgb = np.asarray(rgb, dtype=np.float64)
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    lms = lin @ np.array([[0.4122214708, 0.2119034982, 0.0883024619],
                          [0.5363325363, 0.6806995451, 0.2817188376],
                          [0.0514459929, 0.1073969566, 0.6299787005]])
    return np.cbrt(lms) @ np.array([[0.2104542553, 1.9779984951, 0.0259040371],
                                    [0.7936177850, -2.4285922050, 0.7827717662],
                                    [-0.0040720468, 0.4505937099, -0.8086757660]])


def lab_to_linear(lab):
    lab = np.asarray(lab, dtype=np.float64)
    lms = lab @ np.array([[1., 1., 1.],
                         [0.3963377774, -0.1055613458, -0.0894841775],
                         [0.2158037573, -0.0638541728, -1.2914855480]])
    return (lms ** 3) @ np.array([[4.0767416621, -1.2684380046, -0.0041960863],
                                  [-3.3077115913, 2.6097574011, -0.7034186147],
                                  [0.2309699292, -0.3413193965, 1.7076147010]])


def gamut_map(lab):
    raw = lab_to_linear(lab)
    bad = np.any((raw < -1e-7) | (raw > 1 + 1e-7), axis=1)
    mapped = np.array(lab, copy=True)
    if np.any(bad):
        tail = mapped[bad].copy()
        tail[:, 0] = np.clip(tail[:, 0], 0, 1)
        low, high = np.zeros(len(tail)), np.ones(len(tail))
        for _ in range(22):
            mid = (low + high) / 2
            trial = tail.copy()
            trial[:, 1:] *= mid[:, None]
            lin = lab_to_linear(trial)
            ok = np.all((lin >= 0) & (lin <= 1), axis=1)
            low = np.where(ok, mid, low)
            high = np.where(ok, high, mid)
        tail[:, 1:] *= low[:, None]
        mapped[bad] = tail
    lin = np.clip(lab_to_linear(mapped), 0, 1)
    rgb = np.where(lin <= 0.0031308, 12.92 * lin,
                   1.055 * np.power(lin, 1 / 2.4) - 0.055)
    return np.round(np.clip(rgb, 0, 1) * 255).astype(np.uint8), bad


def read_features(path):
    ids, xy, rgb = [], [], []
    for raw in iter_feature_json(path):
        f = json.loads(raw)
        p = f["properties"]
        ids.append((int(p.get("pano_id", p.get("ID"))),
                    int(p.get("date", p.get("DATE")))))
        xy.append(f["geometry"]["coordinates"][:2])
        rgb.append([p.get(k, p.get(k.upper())) for k in ("r", "g", "b")])
    return ids, np.asarray(xy, dtype=np.float64), np.asarray(rgb, dtype=np.uint8)


def check_binary(path, xy, rgb):
    records = np.fromfile(path, dtype=RECORD)
    if len(records) != len(xy):
        raise ValueError(f"Count differs from GeoJSON: {path}")
    sinlat = np.sin(np.radians(xy[:, 1]))
    merc = np.column_stack(((xy[:, 0] + 180) / 360,
                           0.5 - np.log((1 + sinlat) / (1 - sinlat)) / (4 * np.pi)))
    if not np.array_equal(records["xy"], merc.astype(np.float32)):
        raise ValueError(f"Position/order differs from GeoJSON: {path}")
    if not np.array_equal(records["rgba"][:, :3], rgb):
        raise ValueError(f"RGB/order differs from GeoJSON: {path}")
    return records


def fit_affine(x, target, ridge):
    mx, mt = x.mean(0), target.mean(0)
    xc, tc = x - mx, target - mt
    u, _, vt = np.linalg.svd(xc.T @ tc)
    rotation = u @ vt  # Unit-scale orthogonal prior; reflections are allowed.
    cov, cross = xc.T @ xc / len(x), xc.T @ tc / len(x)
    if ridge == 0:
        a = np.linalg.lstsq(xc, tc, rcond=None)[0]
    else:
        penalty = ridge * np.trace(cov) / 3
        a = np.linalg.solve(cov + penalty * np.eye(3), cross + penalty * rotation)
    return a, mt - mx @ a


def describe(error):
    return {"median": float(np.median(error)), "p95": float(np.quantile(error, .95)),
            "mean": float(np.mean(error))}


def contrast(lab):
    return float(np.sqrt(np.mean(np.sum((lab - lab.mean(0)) ** 2, axis=1))))


def font(size):
    return ImageFont.truetype("C:/Windows/Fonts/arial.ttf", size)


def render_center_panels(centers, base_xy, base_colors):
    # Every panel uses the exact same IDs and geographic extent: color is the
    # only changing variable. Draw full 2km core, without map tiles or interpolation.
    xy = centers[2]["xy"]
    ids = centers[2]["ids"]
    lookup = {key: i for i, key in enumerate(ids)}
    panels = []
    for scale in [2, 4, 8, 16, 32]:
        if scale == 32:
            panels.append({mode: base_colors[[base_xy[key] for key in ids]]
                           for mode in ["original", *VARIANTS]})
        else:
            c = centers[scale]
            join = {key: i for i, key in enumerate(c["ids"])}
            panels.append({mode: c[mode][[join[key] for key in ids]]
                           for mode in ["original", *VARIANTS]})
    ss, w, h = 2, 340, 265
    canvas = Image.new("RGB", (1840 * ss, 1080 * ss), "#111713")
    draw = ImageDraw.Draw(canvas)
    draw.text((26*ss, 20*ss), "Same locations, different fitted scopes", font=font(29*ss), fill="#f0f6ec")
    draw.text((26*ss, 61*ss), "3,031 central points | existing embeddings | fixed 32 km palette reference | no PCA / t-SNE refit",
              font=font(16*ss), fill="#b8c6b3")
    lo, hi = xy.min(0), xy.max(0)
    for row, mode in enumerate(["original", *VARIANTS]):
        y0 = 140 + row*305
        title = {"original": "Original displayed colors", "affine": "Oklab affine to 32 km",
                 "regularized": "Regularized affine (ridge 0.25)"}[mode]
        draw.text((26*ss, (y0-27)*ss), title, font=font(18*ss), fill="#dfe9d9")
        for col, scale in enumerate([2, 4, 8, 16, 32]):
            x0 = 26 + col*360
            draw.rounded_rectangle((x0*ss, y0*ss, (x0+w)*ss, (y0+h)*ss), radius=6*ss, fill="#030705")
            draw.text(((x0+10)*ss, (y0+7)*ss), f"{scale} km" + ("  reference" if scale == 32 else ""),
                      font=font(17*ss), fill="#dae5d4")
            px = x0 + 12 + (xy[:, 0]-lo[0])/(hi[0]-lo[0])*(w-24)
            py = y0 + 39 + (hi[1]-xy[:, 1])/(hi[1]-lo[1])*(h-50)
            for x, y, rgb in zip(px, py, panels[col][mode]):
                r = 1.1*ss
                draw.ellipse((x*ss-r,y*ss-r,x*ss+r,y*ss+r),fill=tuple(int(v) for v in rgb))
    draw.text((26*ss, 1060*ss), "Equal colors can reflect compressed contrast. Check held-out drift and contrast diagnostics together.",
              font=font(14*ss), fill="#b8c6b3")
    canvas.resize((1840,1080), Image.Resampling.LANCZOS).save(REPORT / "center-comparison.png")


def main():
    started = time.perf_counter()
    OUT.mkdir(parents=True, exist_ok=True)
    REPORT.mkdir(parents=True, exist_ok=True)
    print("Reading saved full-city reference", flush=True)
    base_ids, base_coords, base_rgb_raw = read_features(VIEWER / "public/data/r32km_all_london/tsne3_rgb_uint8.geojson")
    check_binary(DATA / "r32km_all_london/points.bin", base_coords, base_rgb_raw)
    base_lookup = {key: i for i, key in enumerate(base_ids)}
    if len(base_lookup) != len(base_ids):
        raise ValueError("Reference pano/date IDs are not unique")
    base_rgb = base_rgb_raw[:, [1, 0, 2]]  # Match the original viewer's display.
    base_lab = rgb_to_lab(base_rgb / 255)
    grid = json.loads((DATA / "webmercator_grid_rgb48/manifest.json").read_text(encoding="utf-8-sig"))
    result = {"version": 1, "reference": "saved 32km all London displayed colors",
              "id_join": "panorama ID + date, verified coordinates and binary order",
              "fit": "80% deterministic training / 20% held-out; per-patch affine in Oklab",
              "regularization": {"ridge": RIDGE, "prior": "unit-scale orthogonal Procrustes"},
              "gamut": "clip lightness only if needed; hue-preserving chroma contraction; quantize once",
              "sources_unchanged": True, "pca_tsne_refit": False, "patches": [], "scales": []}
    mapping, centers = {}, {}
    for group in grid["groups"]:
        scale = int(group["id"].replace("km", ""))
        group_id = f"wm{scale:02d}km_grid" if scale != 32 else "wm32km_all_london"
        grouped_files = {}
        for mode in VARIANTS:
            path = OUT / mode / f"{group_id}.rgb"
            path.parent.mkdir(parents=True, exist_ok=True)
            grouped_files[mode] = path.open("wb")
        errors = {m: [] for m in ["original", *VARIANTS]}
        contrasts = {m: [] for m in VARIANTS}
        tail_counts = {m: 0 for m in VARIANTS}
        count = 0
        grouped_original = DATA / "webmercator_grid_rgb48_grouped" / group_id / "points.bin"
        with grouped_original.open("rb") as old:
            for patch in sorted(group["patches"], key=lambda p:p["id"]):
                patch_id = patch["id"]
                if scale == 32:
                    patch_path = DATA / "webmercator_grid_rgb48/32km_all_london/points.bin"
                    if old.read() != patch_path.read_bytes():
                        raise ValueError("Grouped 32km differs from reference")
                    for mode in VARIANTS:
                        grouped_files[mode].write(base_rgb.tobytes())
                        path = OUT / mode / "wm32km_center.rgb"
                        path.write_bytes(base_rgb.tobytes())
                    count = len(base_rgb)
                    mapping["center-32km"] = {m:f"./data/affine_color_alignment/{m}/wm32km_center.rgb" for m in VARIANTS}
                    continue
                patch_dir = DATA / "webmercator_grid_rgb48" / group["id"] / patch_id
                patch_bin = patch_dir / "points.bin"
                payload = patch_bin.read_bytes()
                if old.read(len(payload)) != payload:
                    raise ValueError(f"Grouped point order differs: {patch_id}")
                ids, coords, raw_rgb = read_features(SOURCE / f"{patch_id}_rgb48.geojson")
                check_binary(patch_bin, coords, raw_rgb)
                bi = np.asarray([base_lookup.get(key, -1) for key in ids], dtype=np.int64)
                if np.any(bi < 0):
                    raise ValueError(f"Missing reference IDs in {patch_id}")
                if not np.allclose(coords, base_coords[bi], atol=1e-6, rtol=0):
                    raise ValueError(f"Shared IDs have different locations in {patch_id}")
                rgb = raw_rgb[:, [2, 0, 1] if scale <= 8 else [1, 0, 2]]
                x, target = rgb_to_lab(rgb / 255), base_lab[bi]
                rng = np.random.default_rng(42 + scale*100000 + patch["grid"]["x"]*100 + patch["grid"]["y"])
                perm = rng.permutation(len(ids))
                ntest = max(1, len(ids)//5)
                test, train = perm[:ntest], perm[ntest:]
                sparse = len(train) < 8
                baseline = np.linalg.norm(x[test]-target[test], axis=1)
                errors["original"].append(baseline)
                entry = {"id": patch_id, "scale_km": scale, "count": len(ids),
                         "train_count": len(train), "test_count": len(test), "original": describe(baseline),
                         "status": "original colors retained: insufficient fit points" if sparse else "fitted"}
                color_data = {"original": rgb}
                for mode, ridge in [("affine",0.),("regularized",RIDGE)]:
                    a,b = (np.eye(3), np.zeros(3)) if sparse else fit_affine(x[train], target[train], ridge)
                    predicted = x @ a + b
                    packed, bad = gamut_map(predicted)
                    final_lab = rgb_to_lab(packed / 255)
                    err = np.linalg.norm(final_lab[test]-target[test],axis=1)
                    ratio = contrast(final_lab) / max(contrast(x),1e-12)
                    errors[mode].append(err)
                    contrasts[mode].append((ratio,len(ids)))
                    tail_counts[mode] += int(bad.sum())
                    grouped_files[mode].write(packed.tobytes())
                    singular = np.linalg.svd(a,compute_uv=False)
                    entry[mode] = {"matrix_row_vector": a.tolist(), "bias": b.tolist(),
                                   "singular_values": singular.tolist(),
                                   "condition_number": float(singular[0]/max(singular[-1],1e-12)),
                                   "held_out": describe(err), "contrast_ratio": ratio,
                                   "gamut_adjusted_fraction": float(bad.mean())}
                    color_data[mode] = packed
                    if patch["grid"] == {"x":0,"y":0}:
                        (OUT / mode / f"wm{scale:02d}km_center.rgb").write_bytes(packed.tobytes())
                if patch["grid"] == {"x":0,"y":0}:
                    centers[scale] = {"ids":ids,"xy":coords,**color_data}
                    mapping[f"center-{scale}km"] = {m:f"./data/affine_color_alignment/{m}/wm{scale:02d}km_center.rgb" for m in VARIANTS}
                result["patches"].append(entry)
                count += len(ids)
                if len(result["patches"]) % 30 == 0:
                    print(f"Aligned {len(result['patches'])} patches",flush=True)
            if old.read(1):
                raise ValueError(f"Extra records in grouped {group_id}")
        for f in grouped_files.values():
            f.close()
        mapping[f"grid-{scale}km"] = {m:f"./data/affine_color_alignment/{m}/{group_id}.rgb" for m in VARIANTS}
        s = {"scale_km":scale,"count":count,"patch_count":len(group["patches"])}
        if scale != 32:
            for mode in errors:
                s[mode] = describe(np.concatenate(errors[mode]))
            for mode in VARIANTS:
                s[mode]["point_weighted_patch_contrast_ratio"] = sum(r*n for r,n in contrasts[mode])/count
                s[mode]["gamut_adjusted_fraction"] = tail_counts[mode]/count
        result["scales"].append(s)
        print("Scale complete",json.dumps(s),flush=True)
    result["elapsed_seconds"] = time.perf_counter()-started
    (REPORT / "report.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
    (OUT / "manifest.json").write_text(json.dumps({"version":1,"colorSpace":"Oklab",
        "reference":"32km saved displayed palette","ridge":RIDGE,"layers":mapping,
        "summary":result["scales"]},indent=2),encoding="utf-8")
    render_center_panels(centers,base_lookup,base_rgb)
    print(f"Complete in {time.perf_counter()-started:.1f}s. Report: {REPORT}",flush=True)


if __name__ == "__main__":
    main()
