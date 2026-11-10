"""Fit full-corpus London PCA128 on RunPod and prepare native-image evidence.

The PCA64 atlas is read only. No caption model or nonlinear reduction is used.
"""
from __future__ import annotations

import argparse
import io
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tarfile
import time
import traceback
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import torch

import pca64_pacmap_neighbor_atlas as atlas

DATA = Path('/workspace/reruns/pano512_8B_q90_20260915_b200/embedding/london_512_8_45_8B')
DEFAULT_OUTPUT = Path('/workspace/semantic_notebooks/london_pca128_review_20261003')
ORIGINAL = Path('/workspace/semantic_notebooks/london_4096_pca64_pacmap_neighbor_atlas_v1')
INDEPENDENT = DEFAULT_OUTPUT
YAWS = (45, 90, 135, 180, 225, 270, 315, 0)
CAVEATS = [
    'PCA sign is arbitrary; positive and negative name numerical poles, not desirability.',
    'Axes are empirical contrasts and can combine several visual properties; no monosemanticity claim.',
    'Ordered view blocks preserve camera orientation, so heading, lighting, capture date, stitching and geography may confound an axis.',
    'Evidence uses full-corpus tails. Neighbouring or repeated panoramas may share visual content.',
    'The randomized covariance solver approximates PCA; reported variance is measured from final all-row projections.',
    'Image boards show verified complete spherical panoramas, including all eight embedding yaw directions.',
]


def save(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    temporary.replace(path)


def report(out, stage, **fields):
    value = dict(stage=stage, pid=os.getpid(), updated_utc=time.time(), **fields)
    save(out / 'state.json', value)
    print(json.dumps(value), flush=True)


class NativePanoramas:
    """Exact Pictures identity/index/header protocol, with full spherical images."""
    def __init__(self, sources, references, wanted, out):
        self.out = out
        self.identities = {}
        self.receipts = {}
        old_receipts = INDEPENDENT / 'image_receipts.json'
        self.cached_receipts = json.loads(old_receipts.read_text()) if old_receipts.exists() and out != INDEPENDENT else {}
        self.references = references
        self.paths = {}
        for source in sources:
            selected = {gid - source['offset'] for gid in wanted
                        if source['offset'] <= gid < source['offset'] + source['rows']}
            if not selected:
                continue
            identity = Path(source['embedding']['path']).with_name(
                Path(source['embedding']['path']).stem + '_identity.jsonl')
            with identity.open() as stream:
                for row, line in enumerate(stream):
                    if row not in selected:
                        continue
                    gid = source['offset'] + row
                    item = json.loads(line)
                    item['shard_number'] = source['number']
                    if (abs(item['lon'] - references[gid, 1]) >= 1e-5
                            or abs(item['lat'] - references[gid, 2]) >= 1e-5
                            or int(item['pano_id']) != int(references[gid, 0])):
                        raise RuntimeError(f'Identity/reference mismatch for source row {gid}')
                    self.identities[gid] = item
        if not wanted.issubset(self.identities):
            raise RuntimeError('Missing exact identity sidecars for requested images')
        self.index = Path('/tmp/london-native-q90-pca128.sqlite')
        if not self.index.exists():
            shutil.copyfile('/workspace/semantic_backend/pano_index_native_q90_20260916/london.sqlite', self.index)
        (out / 'viewer/native').mkdir(parents=True, exist_ok=True)
        (out / 'viewer/details').mkdir(parents=True, exist_ok=True)

    def prepare(self, gid):
        ident = self.identities[gid]
        cached = self.cached_receipts.get(str(gid))
        if (cached and cached['header_and_identity_verified'] and cached['native_payload_preserved']
                and cached['member'] == ident['pano_member'] and cached['pano_id'] == ident['pano_id']):
            for key in ['native', 'detail']:
                source = INDEPENDENT / 'viewer' / cached[key]
                target = self.out / 'viewer' / cached[key]
                if not source.exists():
                    raise RuntimeError(f'Missing verified cached image {gid}')
                if not target.exists():
                    try:
                        os.link(source, target)
                    except OSError:
                        shutil.copyfile(source, target)
            return gid, dict(cached, reused_verified_cache=str(INDEPENDENT))
        archive = DATA.parents[1] / 'pano' / DATA.name / f"panos_shard_{ident['shard_number']:05d}.tar"
        with sqlite3.connect(self.index.as_uri() + '?mode=ro&immutable=1', uri=True) as db:
            row = db.execute('SELECT offset_data,byte_size,lon,lat,pano_id FROM panos WHERE tar_id=? AND member_name=?',
                             (str(archive), ident['pano_member'])).fetchone()
        if row is None:
            raise RuntimeError(f'Missing exact native panorama {gid}')
        offset, size, lon, lat, pano_id = row
        if abs(lon - ident['lon']) >= 1e-7 or abs(lat - ident['lat']) >= 1e-7 or pano_id != ident['pano_id']:
            raise RuntimeError(f'Native index/identity mismatch {gid}')
        with archive.open('rb') as stream:
            stream.seek(offset - 512)
            header = tarfile.TarInfo.frombuf(stream.read(512), 'utf-8', 'surrogateescape')
            if header.name != ident['pano_member'] or header.size != size:
                raise RuntimeError(f'TAR header/identity mismatch {gid}')
            payload = stream.read(size)
        if len(payload) != size:
            raise RuntimeError(f'Truncated native panorama {gid}')
        with Image.open(io.BytesIO(payload)) as original:
            fmt = original.format
            image = original.convert('RGB')
        native = Path('native') / f'pano-{gid}.{dict(JPEG="jpg", PNG="png", WEBP="webp").get(fmt, "bin")}'
        # Preserve the original native payload byte-for-byte, without text encoding.
        target = self.out / 'viewer' / native
        if not target.exists():
            temporary = target.with_name(target.name + '.tmp')
            temporary.write_bytes(payload)
            temporary.replace(target)
        actual = list(image.size)
        method = ident['geometry']['method']
        if method not in ('full_sphere', 'verified_horizontal_wrap'):
            raise RuntimeError(f'Unverified panorama geometry {gid}')
        if abs(image.width / image.height - 2) >= .03:
            if actual != ident['original_size'] or method != 'verified_horizontal_wrap':
                raise RuntimeError(f'Invalid horizontal-wrap source {gid}')
            image = image.crop(ident['geometry']['crop'])
        if abs(image.width / image.height - 2) >= .03 or image.width < 512:
            raise RuntimeError(f'Invalid spherical panorama {gid}')
        detail = Path('details') / f'pano-{gid}.jpg'
        detail_image = image.copy()
        detail_image.thumbnail((2048, 1024), Image.Resampling.LANCZOS)
        detail_image.save(self.out / 'viewer' / detail, quality=92)
        receipt = dict(source_row=gid, pano_id=pano_id, member=header.name, archive=str(archive),
                       offset=offset, bytes=size, actual_size=actual, spherical_size=list(image.size),
                       geometry=ident['geometry'], declared_pano_size=ident['pano_size'],
                       native=str(native), detail=str(detail), native_payload_preserved=True,
                       header_and_identity_verified=True, yaw_degrees=list(YAWS), fov_degrees=45)
        image.close()
        detail_image.close()
        return gid, receipt


def make_board(out, axis, font, smallfont):
    tilew, tileh = 768, 384
    header, rowh = 114, 430
    canvas = Image.new('RGB', (1536, header + 5 * rowh + 60), (17, 22, 25))
    draw = ImageDraw.Draw(canvas)
    draw.text((16, 12), f'PC{axis["axis"]:03d} | variance {100 * axis["variance_fraction"]:.4f}% | cumulative {100 * axis["cumulative_variance_fraction"]:.2f}%', font=font, fill='white')
    draw.text((16, 45), 'Full spherical panoramas: all yaw directions. Axis sign is arbitrary; inspect both poles.', font=smallfont, fill=(205, 214, 219))
    draw.text((16, 79), 'POSITIVE / HIGH SCORES', font=font, fill=(242, 193, 106))
    draw.text((tilew + 16, 79), 'NEGATIVE / LOW SCORES', font=font, fill=(135, 194, 237))
    items = [(r, 0, item, 'HIGH') for r, item in enumerate(axis['positive_examples'])]
    items += [(r, 1, item, 'LOW') for r, item in enumerate(axis['negative_examples'])]
    items += [(4, col, item, 'NEAR ZERO CONTROL') for col, item in enumerate(axis['control_examples'])]
    for row, col, item, pole in items:
        x, y = col * tilew, header + row * rowh
        text = f'{pole} | row {item["source_row"]} | score {item["score"]:.5f}'
        draw.text((x + 10, y + 3), text, font=smallfont, fill='white')
        draw.text((x + 10, y + 25), f'{item["lon"]:.6f}, {item["lat"]:.6f} | pano {item["pano_id"]}', font=smallfont, fill=(191, 201, 208))
        with Image.open(out / 'viewer' / item['detail']) as source:
            tile = source.resize((tilew, tileh), Image.Resampling.LANCZOS)
            canvas.paste(tile, (x, y + 46))
    draw.text((16, canvas.height - 43), 'Potential confounds: direction / heading, illumination, season, capture date, stitching, geographic repetition.', font=smallfont, fill=(205, 214, 219))
    target = out / 'viewer' / axis['board']
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, quality=90)
    canvas.close()


def html_index(out, index):
    html = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>London PCA128 evidence</title><style>body{font:16px system-ui;background:#111619;color:#eef1f3;margin:24px;max-width:1600px}a{color:#9ed4ff}img{max-width:100%;height:auto}select{font:inherit;padding:8px}p{max-width:1100px;line-height:1.5}.details{display:flex;gap:12px;flex-wrap:wrap}</style><h1>London PCA128 evidence</h1><p>156,880 panoramas; ordered raw eight-view 4096D concatenation, centered global unwhitened PCA128. Every axis is a contrast between two numerical poles. Camera direction, lighting, date and geography can confound the contrast.</p><label>Axis <select id="axis"></select></label><p id="stats"></p><img id="board" alt="Panorama evidence for both axis poles and near-zero controls"><p>High resolution panorama details</p><div id="details" class="details"></div><script>const data=INDEX;const s=document.querySelector('#axis');data.axes.forEach(a=>{const o=document.createElement('option');o.value=a.axis;o.textContent='PC'+a.axis;s.append(o)});function show(){const a=data.axes.find(a=>a.axis==s.value);document.querySelector('#board').src=a.board;document.querySelector('#stats').textContent='Variance '+(100*a.variance_fraction).toFixed(4)+'%; cumulative '+(100*a.cumulative_variance_fraction).toFixed(2)+'%. All eight yaw directions appear in each full panorama.';document.querySelector('#details').replaceChildren();for(const [pole,items] of [['High',a.positive_examples],['Low',a.negative_examples],['Control',a.control_examples]])items.forEach((e,i)=>{const link=document.createElement('a');link.href=e.detail;link.textContent=pole+' '+(i+1)+' (row '+e.source_row+')';document.querySelector('#details').append(link)})}s.onchange=show;if(data.axes.length)show();</script></html>'''
    if index.get('fixed_prefix_dimensions'):
        html = html.replace('centered global unwhitened PCA128', 'unwhitened fixed-prefix PCA extension: original PCA64 plus 64 residual axes')
    (out / 'viewer/index.html').write_text(html.replace('INDEX', json.dumps(index)), encoding='utf-8')


def fit_fixed_extension(factory, original, out):
    """Keep the original PCA64 untouched and fit its orthogonal complement."""
    dimensions, width, power = 32768, 96, 2
    count = int(original['rows'])
    mean = original['mean'].astype(np.float32)
    prefix = original['components'].astype(np.float64)
    gram = prefix @ prefix.T
    def complement(q):
        # Gram correction removes tiny FP32 deviations from exact orthonormality.
        return q - prefix.T @ np.linalg.solve(gram, prefix @ q)
    rng = np.random.default_rng(42)
    q = np.linalg.qr(complement(rng.normal(size=(dimensions, width))))[0].astype(np.float32)
    times = []
    @torch.no_grad()
    def covariance(q):
        cq = np.zeros((dimensions, width), dtype=np.float64)
        gq = torch.from_numpy(q).cuda()
        processed, last_report = 0, time.time()
        for _, x in factory():
            gx = torch.from_numpy(x - mean).cuda()
            cq += (gx.T @ (gx @ gq)).cpu().numpy()
            processed += len(x)
            if time.time() - last_report > 15:
                report(out, 'fitting_fixed_extension', processed_rows=processed, rows=count)
                last_report = time.time()
        return complement(cq / (count - 1))
    for iteration in range(power + 1):
        started = time.time()
        report(out, 'fitting_fixed_extension', covariance_pass=iteration + 1, covariance_passes=4)
        q = np.linalg.qr(covariance(q))[0].astype(np.float32)
        times.append(time.time() - started)
    started = time.time()
    report(out, 'fitting_fixed_extension', covariance_pass=4, covariance_passes=4)
    cq = covariance(q)
    small = q.T @ cq
    values, vectors = np.linalg.eigh((small + small.T) / 2)
    order = np.argsort(values)[::-1][:64]
    tail = (q @ vectors[:, order]).T.astype(np.float32)
    signs = np.sign(tail[np.arange(64), np.abs(tail).argmax(axis=1)])
    tail *= signs[:, None]
    times.append(time.time() - started)
    return dict(mean=original['mean'].copy(),
                components=np.concatenate((original['components'], tail), axis=0),
                eigenvalues=np.concatenate((original['eigenvalues'], values[order])),
                total_variance=original['total_variance'].copy(), rows=original['rows'].copy(),
                fit_pass_seconds=np.asarray(times))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--batch-rows', type=int, default=2048)
    parser.add_argument('--fixed-prefix', action='store_true', help='Copy original PCA64 exactly; fit 64 orthogonal residual axes')
    args = parser.parse_args()
    if not args.execute:
        print('Plan: separate full-corpus PCA128 fit and 128 native panorama evidence boards. Add --execute on RunPod.')
        return
    if os.name == 'nt' or not DATA.is_dir():
        raise RuntimeError('Execute only on the authorized RunPod with the exact London dataset')
    out = args.output
    if args.fixed_prefix and out == DEFAULT_OUTPUT:
        out = Path('/workspace/semantic_notebooks/london_pca128_fixed64_review_20261003')
    out.mkdir(parents=True, exist_ok=True)
    (out / 'viewer').mkdir(exist_ok=True)
    started = time.time()
    atlas.numpy()
    torch.set_num_threads(8)
    torch.backends.cuda.matmul.allow_tf32 = False
    config = dict(input_dir=str(DATA), views=8, view_dimensions=4096)
    sources = atlas.inspect_sources(config)
    n = sum(source['rows'] for source in sources)
    if n != 156880:
        raise RuntimeError(f'Wrong corpus row count {n}')
    run = json.loads((DATA.parents[1] / 'run.json').read_text())
    if tuple(run['config']['yaw_degrees']) != YAWS:
        raise RuntimeError('Wrong embedding yaw order')
    refs = atlas.load_references(sources)
    factory = lambda: atlas.batches(sources, args.batch_rows)
    manifest = dict(dataset='london_512_8_45_8B', rows=n, source_shards=sources,
                    views=8, view_dimensions=4096, input_dimensions=32768, yaw_degrees=list(YAWS),
                    normalization='none', feature_scaling='none', whitening=False,
                    centering='Full-corpus feature mean', pca_dimensions=128, oversampling=32,
                    power_iterations=2, seed=42, batch_rows=args.batch_rows,
                    device=torch.cuda.get_device_name(), arithmetic='FP32 torch CUDA GEMM; TF32 disabled; CPU FP64 accumulation',
                    input_dir=str(DATA), output_dir=str(out), method='All-row randomized covariance subspace')
    save(out / 'input_manifest.json', manifest)
    original = dict(np.load(ORIGINAL / 'global_pca_model.npz', allow_pickle=False)) if args.fixed_prefix else None
    original_scores = np.load(ORIGINAL / 'pca64.npy', mmap_mode='r', allow_pickle=False) if args.fixed_prefix else None
    if args.fixed_prefix:
        original_sources = json.loads((ORIGINAL / 'prepared.json').read_text())['sources']
        original_refs = np.load(ORIGINAL / 'source_rows.npz', allow_pickle=False)['reference']
        if original_sources != sources or original_scores.shape != (n, 64) or not np.array_equal(refs, original_refs, equal_nan=True):
            raise RuntimeError('Original PCA64 provenance differs from exact current corpus')
        manifest.update(fixed_prefix_dimensions=64, original_model_path=str(ORIGINAL / 'global_pca_model.npz'),
                        original_projection_path=str(ORIGINAL / 'pca64.npy'), residual_dimensions=64,
                        residual_oversampling=32, method='Constrained orthogonal residual extension: exact original PCA64 prefix plus 64 randomized residual axes; not an independently diagonalized global PCA128')
        manifest['original_row_references_equal_including_unknown_headings'] = True
        save(out / 'input_manifest.json', manifest)
    model_path = out / 'global_pca128_model.npz'
    if not model_path.exists():
        @torch.no_grad()
        def covariance(x, q):
            gx = torch.from_numpy(x).cuda()
            gq = torch.from_numpy(q).cuda()
            return (gx.T @ (gx @ gq)).cpu().numpy()
        report(out, 'fitting', rows=n)
        model = (fit_fixed_extension(factory, original, out) if args.fixed_prefix else
                 atlas.streaming_pca(factory, 32768, 128, 32, 2, 42, covariance,
                                     lambda message: report(out, 'fitting', message=message)))
        atlas.atomic_npz(model_path, **model)
    else:
        model = dict(np.load(model_path, allow_pickle=False))
    if model['components'].shape != (128, 32768) or int(model['rows']) != n:
        raise RuntimeError('Existing PCA128 archive is incompatible')
    projection_path = out / 'pca128.npy'
    if not projection_path.exists():
        report(out, 'projecting', rows=n)
        temporary = projection_path.with_name(projection_path.name + '.tmp')
        scores = np.lib.format.open_memmap(temporary, mode='w+', dtype='float32', shape=(n, 128))
        first_tail = 64 if args.fixed_prefix else 0
        if args.fixed_prefix:
            scores[:, :64] = original_scores
        components = torch.from_numpy(model['components'][first_tail:]).cuda()
        mean = model['mean'].astype(np.float32)
        with torch.no_grad():
            for offset, x in factory():
                scores[offset:offset + len(x), first_tail:] = (torch.from_numpy(x - mean).cuda() @ components.T).cpu().numpy()
                if offset % 16384 == 0:
                    report(out, 'projecting', completed_rows=offset + len(x), rows=n)
        scores.flush()
        del scores, components
        torch.cuda.empty_cache()
        temporary.replace(projection_path)
    if atlas.inspect_sources(config) != sources:
        raise RuntimeError('Source files changed during fit/projection')
    atlas.atomic_npz(out / 'source_rows.npz', reference=refs)
    scores = np.load(projection_path, mmap_mode='r', allow_pickle=False)
    prefix_verification = None
    if args.fixed_prefix:
        prefix_verification = dict(mean_equal=bool(np.array_equal(model['mean'], original['mean'])),
            components_equal=bool(np.array_equal(model['components'][:64], original['components'])),
            eigenvalues_equal=bool(np.array_equal(model['eigenvalues'][:64], original['eigenvalues'])),
            projection_equal=bool(np.array_equal(scores[:, :64], original_scores)),
            maximum_projection_difference=float(np.max(np.abs(scores[:, :64] - original_scores))))
        if not all(prefix_verification[k] for k in ['mean_equal','components_equal','eigenvalues_equal','projection_equal']) or prefix_verification['maximum_projection_difference'] != 0:
            raise RuntimeError(f'Original PCA64 prefix changed: {prefix_verification}')
        save(out / 'prefix_verification.json', prefix_verification)
    measured_variance = np.var(scores, axis=0, ddof=1, dtype=np.float64)
    fractions = measured_variance / float(model['total_variance'])
    covariance = np.cov(scores, rowvar=False, ddof=1)
    deviations = model['components'].astype(np.float64) @ model['components'].astype(np.float64).T - np.eye(128)
    correlation = covariance / np.sqrt(np.outer(measured_variance, measured_variance))
    off_diagonal = correlation - np.diag(np.diag(correlation))
    sanity = dict(shape=list(scores.shape), all_finite=bool(np.isfinite(scores).all()),
                  decreasing_eigenvalues=bool(np.all(np.diff(model['eigenvalues']) <= 0)),
                  positive_projected_variances=bool(np.all(measured_variance > 0)),
                  maximum_orthonormality_error=float(np.abs(deviations).max()),
                  maximum_off_diagonal_score_correlation=float(np.abs(off_diagonal).max()),
                  maximum_prefix_tail_score_correlation=float(np.abs(correlation[:64, 64:]).max()),
                  maximum_tail_off_diagonal_score_correlation=float(np.abs(off_diagonal[64:, 64:]).max()),
                  decreasing_tail_eigenvalues=bool(np.all(np.diff(model['eigenvalues'][64:]) <= 0)),
                  maximum_relative_eigenvalue_projected_variance_error=float(np.max(np.abs(measured_variance / model['eigenvalues'] - 1))),
                  retained_variance_fraction=float(fractions.sum()))
    if (scores.shape != (156880, 128) or not sanity['all_finite'] or not sanity['decreasing_tail_eigenvalues']
            or not sanity['positive_projected_variances'] or sanity['maximum_orthonormality_error'] > 1e-4
            or (sanity['maximum_tail_off_diagonal_score_correlation'] if args.fixed_prefix else sanity['maximum_off_diagonal_score_correlation']) > .005):
        raise RuntimeError(f'PCA numerical sanity check failed: {sanity}')
    save(out / 'numerical_checks.json', sanity)
    report(out, 'projection_verified', **sanity)
    loadings = np.square(model['components'].astype(np.float64).reshape(128, 8, 4096)).sum(axis=2)
    loadings /= loadings.sum(axis=1, keepdims=True)
    probabilities = [0, .001, .01, .05, .25, .5, .75, .95, .99, .999, 1]
    axes = []
    def example(gid, j):
        return dict(source_row=int(gid), pano_id=int(refs[gid, 0]), lon=float(refs[gid, 1]),
                    lat=float(refs[gid, 2]), capture_date=float(refs[gid, 3]),
                    heading_degrees=float(refs[gid, 4]) if np.isfinite(refs[gid, 4]) else None,
                    score=float(scores[gid, j]))
    def diverse_tail(order):
        # Always include the exact extremum, then disperse strongest 1% examples.
        candidates = order[:max(4, int(np.ceil(n * .01)))]
        selected = [int(candidates[0])]
        used = {int(refs[selected[0], 0])}
        separations = [None]
        lat0 = np.deg2rad(float(refs[:, 2].mean()))
        xy = np.column_stack((np.deg2rad(refs[:, 1]) * np.cos(lat0), np.deg2rad(refs[:, 2]))) * 6371000
        for threshold in [100, 50, 0]:
            for gid in candidates:
                gid = int(gid)
                if gid in selected or int(refs[gid, 0]) in used:
                    continue
                distance = float(np.linalg.norm(xy[selected] - xy[gid], axis=1).min())
                if distance >= threshold:
                    selected.append(gid)
                    used.add(int(refs[gid, 0]))
                    separations.append(distance)
                    if len(selected) == 4:
                        return selected, separations
        raise RuntimeError('Fewer than four distinct panorama identities in strongest 1% tail')
    for j in range(128):
        order = np.argsort(scores[:, j], kind='stable')
        positive, positive_separations = diverse_tail(order[::-1])
        negative, negative_separations = diverse_tail(order)
        controls = np.argsort(np.abs(scores[:, j]), kind='stable')[:2]
        quantiles = np.quantile(scores[:, j], probabilities)
        axes.append(dict(axis=j + 1, variance_fraction=float(fractions[j]),
                         cumulative_variance_fraction=float(fractions[:j + 1].sum()),
                         eigenvalue=float(model['eigenvalues'][j]), projected_variance=float(measured_variance[j]),
                         score_mean=float(np.mean(scores[:, j], dtype=np.float64)),
                         score_quantiles={str(q): float(v) for q, v in zip(probabilities, quantiles)},
                         loading_energy_by_view=loadings[j].tolist(),
                         positive_examples=[example(gid, j) for gid in positive],
                         negative_examples=[example(gid, j) for gid in negative],
                         control_examples=[example(gid, j) for gid in controls],
                         selection_separation_meters=dict(positive=positive_separations, negative=negative_separations),
                         board=f'images/axis-{j + 1:03d}.jpg'))
    index = dict(status='preparing', corpus=manifest['dataset'], rows=n, input=manifest,
                 method=manifest['method'], elapsed_seconds=time.time() - started, total_axes=128,
                 total_centered_variance=float(model['total_variance']),
                 retained_variance_fraction=float(fractions.sum()),
                 sign_convention='Largest-absolute feature loading is made positive; mathematical sign remains arbitrary.',
                 numerical_checks=sanity,
                 selection='Exact high/low extremum plus three distinct panorama identities greedily separated by >=100m within strongest 1% tail; fallback >=50m then no distance constraint only if necessary. Two scores nearest zero. Distances use local equirectangular ground-meter approximation.',
                 caveats=CAVEATS, axes=[])
    if args.fixed_prefix:
        index.update(fixed_prefix_dimensions=64, prefix_verification=prefix_verification,
                     original_model_path=manifest['original_model_path'], original_projection_path=manifest['original_projection_path'])
        index['caveats'] = CAVEATS + ['The first 64 axes and scores are copied exactly from the existing PCA64 atlas. Additional axes are fitted in its orthogonal complement, so cross-covariance with the approximate original basis can remain nonzero. The combined frame is a constrained extension, not exact global PCA128 diagonalization.']
    save(out / 'axis_statistics.json', dict(index, axes=axes))
    wanted = {e['source_row'] for axis in axes for pole in ['positive_examples', 'negative_examples', 'control_examples'] for e in axis[pole]}
    pictures = NativePanoramas(sources, refs, wanted, out)
    report(out, 'preparing_native_images', unique_panoramas=len(wanted), variance_retained=float(fractions.sum()))
    with ThreadPoolExecutor(max_workers=8) as pool:
        for count, (gid, receipt) in enumerate(pool.map(pictures.prepare, sorted(wanted)), 1):
            pictures.receipts[str(gid)] = receipt
            if count % 64 == 0:
                report(out, 'preparing_native_images', completed=count, total=len(wanted))
    save(out / 'image_receipts.json', pictures.receipts)
    fontpath = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    font = ImageFont.truetype(fontpath, 25)
    smallfont = ImageFont.truetype(fontpath, 19)
    for j, axis in enumerate(axes):
        for pole in ['positive_examples', 'negative_examples', 'control_examples']:
            for item in axis[pole]:
                receipt = pictures.receipts[str(item['source_row'])]
                item['detail'] = receipt['detail']
                item['native'] = receipt['native']
                item['identity_verified'] = receipt['header_and_identity_verified']
        make_board(out, axis, font, smallfont)
        index['axes'].append(axis)
        if (j + 1) % 32 == 0:
            index['elapsed_seconds'] = time.time() - started
            save(out / 'viewer/index.json', index)
            save(out / 'viewer/review_index.json', index)
            html_index(out, index)
            report(out, 'boards_ready', completed_axes=j + 1, total_axes=128, seconds=time.time() - started)
    index['status'] = 'ready'
    index['elapsed_seconds'] = time.time() - started
    save(out / 'viewer/index.json', index)
    save(out / 'viewer/review_index.json', index)
    html_index(out, index)
    save(out / 'completion_summary.json', dict(status='complete', rows=n, axes=128,
         unique_native_panoramas=len(wanted), variance_fraction=float(fractions.sum()),
         seconds=time.time() - started, source_identity_verified=True,
         fixed_prefix_dimensions=64 if args.fixed_prefix else 0, prefix_verification=prefix_verification,
         method=manifest['method']))
    report(out, 'complete', axes=128, unique_native_panoramas=len(wanted), seconds=time.time() - started)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(traceback.format_exc(), flush=True)
        raise
