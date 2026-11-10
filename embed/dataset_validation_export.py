"""Dataset-specific, source-paired validation export for each derived image.

Adapters never treat an absent target as an empty annotation. Expected hidden
test labels and cross-view targets have explicit status/scope. Other failures
propagate to the runner's durable source-error ledger.
"""
from __future__ import annotations

from collections import OrderedDict, defaultdict
from dataclasses import replace
import csv
from functools import lru_cache
import glob
import io
import json
from pathlib import Path, PurePosixPath
import zipfile

import numpy as np
from PIL import Image

from dataset_image_pipeline import file_metadata
from validation_projection import (transform_raster_target, transform_bbox_xyxy,
    transform_polygon, rasterize_coco_polygons, transform_polyline_segments, equirectangular_source_pixels)


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False).encode('utf-8')


def raster_bytes(image):
    """PNG for standard masks; NPY preserves 32-bit IDs/floats without clipping."""
    array = np.asarray(image)
    output = io.BytesIO()
    if array.dtype.kind == 'f' or (array.dtype.itemsize > 2 and
            (array.min(initial=0) < 0 or array.max(initial=0) > 65535)):
        np.save(output, array, allow_pickle=False)
        return '.npy', output.getvalue()
    if image.mode == 'I':
        image = Image.fromarray(array.astype(np.uint16))
    image.save(output, 'PNG', compress_level=3)
    return '.png', output.getvalue()


class ValidationExporter:
    def __init__(self, catalog):
        # functools method decorators otherwise share one LRU across workers,
        # repeatedly evicting each other's large metadata tables.
        for name, maximum in [('mtsd_annotation', 1), ('mtsd_test_keys', 1),
                              ('msls_metadata', 1), ('coco', 3)]:
            original = getattr(type(self), name).__wrapped__.__get__(self, type(self))
            setattr(self, name, lru_cache(maxsize=maximum)(original))
        path = Path(catalog).resolve()
        raw = json.loads(path.read_text(encoding='utf-8'))
        self.rules = {}
        self.archives = OrderedDict()
        all_paths = set()
        for rule in raw['sources']:
            if not rule.get('include_in_embedding', True):
                continue
            spec = rule.get('validation', {'adapter': 'none'})
            paths = []
            for pattern in spec.get('archives', []):
                pattern = str(path.parent / pattern) if not Path(pattern).is_absolute() else pattern
                matches = sorted(glob.glob(pattern))
                if not matches:
                    raise FileNotFoundError(f'Validation archive not found: {pattern}')
                paths.extend(matches)
            self.rules[rule['dataset_id']] = {**spec, 'archives': list(dict.fromkeys(paths))}
            all_paths.update(paths)
        self.source_files = [file_metadata(p) for p in sorted(all_paths)]

    def archive(self, path):
        path = str(path)
        if path in self.archives:
            self.archives.move_to_end(path)
            return self.archives[path]
        archive = zipfile.ZipFile(path)
        self.archives[path] = archive
        if len(self.archives) > 6:
            _, old = self.archives.popitem(last=False)
            old.close()
        return archive

    def locate(self, paths, member, required=True):
        hits = [(path, member) for path in paths if member in self.archive(path).NameToInfo]
        if len(hits) > 1:
            raise ValueError(f'Ambiguous validation locator: {member}')
        if not hits and required:
            raise FileNotFoundError(f'Expected validation target missing: {member}')
        return hits[0] if hits else None

    def read_json(self, locator):
        return json.loads(self.archive(locator[0]).read(locator[1]))

    def raster(self, locator, size, transform):
        with self.archive(locator[0]).open(locator[1]) as handle, Image.open(handle) as target:
            target.load()
            if target.size != tuple(size):
                raise ValueError(f'Image/label dimension mismatch: {locator[1]} {target.size} != {size}')
            projected = transform_raster_target(target, transform)
        try:
            return raster_bytes(projected)
        finally:
            projected.close()

    def export(self, record, size, transforms):
        spec = self.rules[record.dataset_id]
        adapter = spec['adapter']
        if adapter not in {'none', 'cityscapes', 'vistas', 'mtsd', 'msls', 'omni_coco', 'omni_crossview', 'bdd'}:
            raise ValueError(f'Unknown validation adapter: {adapter}')
        result = []
        for transform in transforms:
            prefix = f'{record.dataset_id}/{record.source_index:09d}/view_{transform["view_index"]:02d}'
            document = {'version': 1, 'source_index': record.source_index,
                        'source_uri': record.source_uri, 'source_size': size,
                        'transform': transform, 'status': 'exported', 'scope': 'derived_view',
                        'targets': [], 'source_annotations': []}
            document['projection_policy'] = spec.get('projection_policy', 'catalog')
            files = []
            def add_raster(kind, locator):
                source = {'archive': locator[0], 'member': locator[1]}
                identity = (transform['method'] in {'center_crop_resize', 'horizontal_square_tile'}
                    and list(transform['crop_box']) == [0, 0, *size]
                    and list(transform['output_size']) == list(size))
                if identity:
                    # Keep original bytes/quality when no geometry changes. Still
                    # validate the pairing before publishing a usable reference.
                    with self.archive(locator[0]).open(locator[1]) as handle, Image.open(handle) as target:
                        target.load()
                        if target.size != tuple(size):
                            raise ValueError(f'Image/label dimension mismatch: {locator[1]}')
                    document['targets'].append({'kind': kind, 'source': source,
                        'storage': 'source_reference', 'geometry_changed': False})
                    return
                extension, payload = self.raster(locator, size, transform)
                name = f'{prefix}/{kind}{extension}'
                files.append((name, payload))
                document['targets'].append({'kind': kind, 'member': name,
                    'source': source, 'storage': 'derived', 'geometry_changed': True})
            if adapter == 'none':
                document.update(status='not_configured', scope='source')
            else:
                getattr(self, adapter)(record, size, transform, spec, document, files, prefix, add_raster)
            name = prefix + '/annotations.json'
            files.append((name, json_bytes(document)))
            result.append(({'status': document['status'], 'scope': document['scope'],
                            'members': [name for name, _ in files]}, files))
        return result

    def resolve_record(self, record, size):
        """Use publisher metadata, never aspect ratio, to select camera geometry.

        MTSD hidden-test images have no public per-image camera metadata; the
        explicitly declared catalog fallback remains visible in output policy.
        A true pano flag with incompatible dimensions is an error, not a crop.
        """
        spec = self.rules[record.dataset_id]
        if spec.get('projection_policy') != 'metadata_with_catalog_test_fallback':
            return record
        if spec['adapter'] == 'msls':
            group = record.member.rsplit('/images/', 1)[0]
            metadata = self.msls_metadata(tuple(spec['archives']), group)
            raw = metadata[PurePosixPath(record.member).stem]['raw.csv']['pano'].lower()
            if raw not in {'true', 'false'}:
                raise ValueError('Unknown MSLS pano metadata')
            is_pano = raw == 'true'
        elif spec['adapter'] == 'mtsd':
            stem = PurePosixPath(record.member).stem
            if stem in self.mtsd_test_keys(tuple(spec['archives'])):
                return record
            _, _, data = self.mtsd_annotation(tuple(spec['archives']), stem)
            if [data['width'], data['height']] != list(size):
                raise ValueError('MTSD image/annotation dimension mismatch')
            is_pano = data['ispano']
            if not isinstance(is_pano, bool):
                raise ValueError('Unknown MTSD ispano metadata')
        else:
            raise ValueError('Metadata projection policy requires a supported camera-metadata adapter')
        if is_pano and abs(size[0] / size[1] - 2.0) > 0.03:
            raise ValueError(f'Panorama metadata contradicts source dimensions {size}; camera review required')
        return replace(record, projection='equirectangular' if is_pano else 'perspective')

    def cityscapes(self, record, size, transform, spec, doc, files, prefix, add_raster):
        parts = PurePosixPath(record.member).parts
        split, city = parts[1:3]
        stem = PurePosixPath(record.member).name[:-len('_leftImg8bit.png')]
        if split == 'test':
            doc.update(status='unavailable_test_labels', scope='source'); return
        kinds = ['gtCoarse'] if split == 'train_extra' else ['gtFine', 'gtCoarse']
        for kind in kinds:
            base = f'{kind}/{split}/{city}/{stem}_{kind}'
            for suffix in ['labelIds', 'instanceIds']:
                add_raster(f'{kind}_{suffix}', self.locate(spec['archives'], base + f'_{suffix}.png'))
            locator = self.locate(spec['archives'], base + '_polygons.json')
            data = self.read_json(locator)
            if [data['imgWidth'], data['imgHeight']] != list(size):
                raise ValueError('Cityscapes polygon dimensions do not match source')
            objects = []
            for obj in data['objects']:
                if obj.get('deleted'):
                    continue
                polygon = transform_polygon([c for p in obj['polygon'] for c in p], transform)
                if polygon:
                    objects.append({**obj, 'polygon': list(zip(polygon[::2], polygon[1::2]))})
            doc['targets'].append({'kind': kind + '_polygons', 'objects': objects,
                                   'source': {'archive': locator[0], 'member': locator[1]}})
        if split in {'train', 'val'}:
            member = f'gtFinePanopticParts/{split}/{city}/{stem}_gtFinePanopticParts.tif'
            add_raster('panoptic_parts', self.locate(spec['archives'], member))

    def vistas(self, record, size, transform, spec, doc, files, prefix, add_raster):
        split = record.member.split('/')[0]
        if split == 'testing':
            doc.update(status='unavailable_test_labels', scope='source'); return
        stem = PurePosixPath(record.member).stem
        base = f'{split}/v2.0'
        for kind in ['labels', 'instances', 'panoptic']:
            add_raster(kind, self.locate([record.container], f'{base}/{kind}/{stem}.png'))
        locator = self.locate([record.container], f'{base}/polygons/{stem}.json')
        data = self.read_json(locator)
        objects = []
        for obj in data['objects']:
            polygon = transform_polygon([c for point in obj['polygon'] for c in point], transform)
            if polygon:
                objects.append({**obj, 'polygon': list(zip(polygon[::2], polygon[1::2]))})
        doc['targets'].append({'kind': 'polygons_v2.0', 'objects': objects})
        doc['label_schema'] = self.read_json((record.container, 'config_v2.0.json'))

    def mtsd(self, record, size, transform, spec, doc, files, prefix, add_raster):
        stem = PurePosixPath(record.member).stem
        if stem in self.mtsd_test_keys(tuple(spec['archives'])):
            doc.update(status='unavailable_test_labels', scope='source'); return
        version, locator, data = self.mtsd_annotation(tuple(spec['archives']), stem)
        if [data['width'], data['height']] != list(size) or \
                bool(data['ispano']) != (record.projection == 'equirectangular'):
            raise ValueError('MTSD annotation geometry disagrees with source')
        objects = []
        source_pixels = equirectangular_source_pixels(size, transform) if record.projection == 'equirectangular' else None
        for obj in data['objects']:
            if source_pixels is None:
                box = transform_bbox_xyxy(obj['bbox'], transform)
            else:
                x, y = source_pixels
                original = obj['bbox']
                inside = ((x >= original['xmin']) & (x < original['xmax']) &
                          (y >= original['ymin']) & (y < original['ymax']))
                yy, xx = np.nonzero(inside)
                box = dict(zip(['xmin','ymin','xmax','ymax'],
                    [int(xx.min()),int(yy.min()),int(xx.max())+1,int(yy.max())+1])) if len(xx) else None
            if box:
                objects.append({**obj, 'bbox': box, 'source_bbox': obj['bbox']})
        doc.update(annotation_coverage=version, source_tags={'ispano': data['ispano']})
        doc['targets'].append({'kind': 'traffic_sign_boxes', 'objects': objects,
            'projection': 'nearest_source_rectangle' if source_pixels is not None else 'affine_clip',
            'source': {'archive': locator[0], 'member': locator[1]}})

    @lru_cache(maxsize=1)
    def mtsd_annotation(self, paths, stem):
        candidates = []
        for version in ['fully', 'partially']:
            member = f'mtsd_v2_{version}_annotated/annotations/{stem}.json'
            hit = self.locate(paths, member, required=False)
            if hit:
                candidates.append((version, hit))
        if len(candidates) != 1:
            raise ValueError(f'Expected exactly one MTSD annotation: {stem}')
        version, locator = candidates[0]
        data = self.read_json(locator)
        return version, locator, data

    @lru_cache(maxsize=1)
    def mtsd_test_keys(self, paths):
        locator = self.locate(paths, 'mtsd_v2_fully_annotated/splits/test.txt')
        return set(self.archive(locator[0]).read(locator[1]).decode().splitlines())

    @lru_cache(maxsize=1)
    def msls_metadata(self, paths, group):
        rows = {}
        for filename in ['raw.csv', 'postprocessed.csv', 'seq_info.csv', 'subtask_index.csv', 'extra_data.csv']:
            member = group + '/' + filename
            # Later metadata packages override a previous package explicitly.
            hits = [(path, member) for path in paths if member in self.archive(path).NameToInfo]
            if not hits:
                if filename in {'raw.csv', 'postprocessed.csv'}:
                    raise FileNotFoundError(member)
                continue
            path, member = hits[-1]
            with self.archive(path).open(member) as handle:
                for row in csv.DictReader(io.TextIOWrapper(handle, encoding='utf-8-sig')):
                    if 'key' not in row:
                        raise ValueError(f'MSLS metadata lacks key: {member}')
                    rows.setdefault(row['key'], {})[filename] = {k: v for k, v in row.items() if k}
        return rows

    def msls(self, record, size, transform, spec, doc, files, prefix, add_raster):
        group = record.member.rsplit('/images/', 1)[0]
        metadata = self.msls_metadata(tuple(spec['archives']), group)
        key = PurePosixPath(record.member).stem
        if key not in metadata or 'raw.csv' not in metadata[key] or 'postprocessed.csv' not in metadata[key]:
            raise ValueError(f'MSLS image has no paired metadata: {record.member}')
        if (metadata[key]['raw.csv'].get('pano', '').lower() == 'true') != (record.projection == 'equirectangular'):
            raise ValueError('MSLS pano metadata contradicts resolved projection')
        doc.update(scope='source', source_tags=metadata[key])

    @lru_cache(maxsize=3)
    def coco(self, path, member):
        data = self.read_json((path, member))
        images, annotations = {}, defaultdict(list)
        for image in data['images']:
            name = PurePosixPath(image['file_name']).name
            if name in images:
                raise ValueError('Ambiguous COCO image basename')
            images[name] = image
        for annotation in data['annotations']:
            annotations[annotation['image_id']].append(annotation)
        return images, annotations, data['categories']

    def omni_coco(self, record, size, transform, spec, doc, files, prefix, add_raster):
        camera = 'panorama' if record.projection == 'equirectangular' else 'mono'
        split = PurePosixPath(record.nested_archive).stem.rsplit('-', 1)[-1]
        tasks = ['instance', 'landuse'] + (['plane'] if camera == 'mono' else [])
        for task in tasks:
            base = f'OmniCity-dataset/street-level/annotation-{camera}/annotation-{camera}-{task}'
            member = f'{base}/annotation-{camera}-{task}-{split}.json'
            images, annotations, categories = self.coco(record.container, member)
            image = images.get(PurePosixPath(record.member).name)
            if image is None or [image['width'], image['height']] != list(size):
                raise ValueError('OmniCity annotation image identity/dimensions mismatch')
            objects = annotations[image['id']]
            # Preserve instance identity independently of category. IDs in this
            # derived mask start at one; zero always means background.
            instances = [{**obj, '_mask_id': i + 1} for i, obj in enumerate(objects)]
            source_mask = rasterize_coco_polygons(tuple(size), instances, '_mask_id')
            try:
                projected = transform_raster_target(source_mask, transform)
            finally:
                source_mask.close()
            pixels = np.asarray(projected)
            extension, payload = raster_bytes(projected)
            name = f'{prefix}/{task}_instances{extension}'
            files.append((name, payload))
            visible = []
            for obj in instances:
                yy, xx = np.nonzero(pixels == obj['_mask_id'])
                if len(xx):
                    visible.append({'mask_id': obj['_mask_id'], 'annotation_id': obj['id'],
                        'category_id': obj['category_id'], 'iscrowd': obj.get('iscrowd', 0),
                        'area': len(xx), 'bbox_xyxy': [int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1]})
            projected.close()
            doc['targets'].append({'kind': task, 'member': name, 'objects': visible,
                'categories': categories, 'source': {'archive': record.container, 'member': member}})

    def omni_crossview(self, record, size, transform, spec, doc, files, prefix, add_raster):
        base, filename = record.member.split('/images/svi/')
        targets = []
        for kind in ['gt-landuse', 'gt_floor']:
            member = f'{base}/{kind}/{PurePosixPath(filename).stem}.png'
            locator = self.locate([record.container], member)
            targets.append({'kind': kind, 'archive': locator[0], 'member': locator[1],
                            'coordinate_system': 'satellite', 'projected': False})
        doc.update(status='associated_cross_view', scope='source', source_annotations=targets)

    def bdd(self, record, size, transform, spec, doc, files, prefix, add_raster):
        split = PurePosixPath(record.member).parts[-2]
        stem = PurePosixPath(record.member).stem
        if split == 'test':
            doc.update(status='unavailable_test_labels', scope='source'); return
        if record.dataset_id.endswith('10k'):
            add_raster('semantic_ids', self.locate(spec['archives'], f'labels/{split}/{stem}_train_id.png'))
            return
        add_raster('drivable_ids', self.locate(spec['archives'], f'labels/{split}/{stem}_drivable_id.png'))
        locator = self.locate(spec['archives'], f'100k/{split}/{stem}.json')
        data = self.read_json(locator)
        if data['name'] != stem or len(data['frames']) != 1:
            raise ValueError('BDD image/frame correspondence mismatch')
        doc['source_tags'] = data.get('attributes', {})
        objects = []
        for obj in data['frames'][0]['objects']:
            item = {k: v for k, v in obj.items() if k not in {'box2d', 'poly2d'}}
            if 'box2d' in obj:
                box = transform_bbox_xyxy([obj['box2d'][key] for key in ['x1', 'y1', 'x2', 'y2']], transform)
                if box:
                    item['box2d'] = dict(zip(['x1', 'y1', 'x2', 'y2'], box))
            if 'poly2d' in obj:
                points = flatten_bdd_path(obj['poly2d'], closed=obj['category'].startswith('area/'))
                if obj['category'].startswith('area/'):
                    polygon = transform_polygon(points, transform)
                    if polygon:
                        item['polygon'] = polygon
                else:
                    segments = transform_polyline_segments(points, transform)
                    if segments:
                        item['polylines'] = segments
                item['curve_flattening_tolerance_source_pixels'] = 0.25
            if any(key in item for key in ['box2d', 'polygon', 'polylines']):
                objects.append(item)
        doc['targets'].append({'kind': 'objects_and_lanes', 'objects': objects,
                               'source': {'archive': locator[0], 'member': locator[1]}})

    def close(self):
        for archive in self.archives.values():
            archive.close()
        self.archives.clear()
        self.msls_metadata.cache_clear()
        self.coco.cache_clear()
        self.mtsd_test_keys.cache_clear()
        self.mtsd_annotation.cache_clear()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


def flatten_bdd_path(vertices, closed=False):
    """Match legacy BDD show_labels.py / Matplotlib Path command consumption.

    A CURVE4 command consumes three coordinates, including a legacy endpoint
    sometimes marked L. The first coordinate is always MOVETO regardless of tag.
    Reference: https://github.com/ucbdrive/bdd100k/blob/master/bdd100k/show_labels.py
    """
    if not vertices:
        return []
    vertices = list(vertices)
    if closed:
        vertices.append([*vertices[0][:2], 'L'])
    output = [np.asarray(vertices[0][:2], dtype=float)]
    def cubic(a, b, c, d, depth=0):
        chord = d - a
        length = np.linalg.norm(chord)
        def distance_to_chord(point):
            if length == 0:
                return np.linalg.norm(point-a)
            t = np.clip(np.dot(point-a, chord) / (length*length), 0, 1)
            return np.linalg.norm(point - (a+t*chord))
        distance = max(distance_to_chord(b), distance_to_chord(c))
        if distance <= 0.25 or depth >= 16:
            output.append(d); return
        ab, bc, cd = (a+b)/2, (b+c)/2, (c+d)/2
        abc, bcd = (ab+bc)/2, (bc+cd)/2
        midpoint = (abc+bcd)/2
        cubic(a, ab, abc, midpoint, depth+1)
        cubic(midpoint, bcd, cd, d, depth+1)
    index = 1
    while index < len(vertices):
        if vertices[index][2] == 'L':
            output.append(np.asarray(vertices[index][:2], dtype=float)); index += 1
        elif vertices[index][2] == 'C' and index + 2 < len(vertices):
            cubic(output[-1], *[np.asarray(v[:2], dtype=float) for v in vertices[index:index+3]])
            index += 3
        else:
            raise ValueError('Unsupported BDD poly2d command sequence')
    return [float(value) for point in output for value in point]
