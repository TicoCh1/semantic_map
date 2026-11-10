#!/usr/bin/env python3
"""Bounded CPU-only smoke check using real source/annotation pairs.

No model is loaded and no production inventory/shards are written. Nested ZIPs
use a disposable cache. Report one train/validation source per enabled rule.
"""
import argparse
import json
from pathlib import Path
import tempfile
import numpy as np

from dataset_image_pipeline import ImageReader, NestedZipCache, iter_rule_records, load_catalog, transform_image
from dataset_validation_export import ValidationExporter
from dataset_package_store import PackageWriter, committed_packages


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', default=str(Path(__file__).with_name('dataset_catalog_runpod.json')))
    parser.add_argument('--dataset', action='append')
    args = parser.parse_args()
    _, rules = load_catalog(args.catalog)
    with tempfile.TemporaryDirectory(prefix='uf-label-smoke-') as cache_root, \
            NestedZipCache(cache_root) as inventory_cache, ImageReader(cache_root) as reader, \
            ValidationExporter(args.catalog) as labels:
        for rule in rules:
            if args.dataset and rule.dataset_id not in args.dataset:
                continue
            iterator = iter_rule_records(rule, nested_cache=inventory_cache)
            try:
                # Exercise real labels rather than selecting a hidden test split.
                def labeled(row):
                    if '/test/' in '/' + row.member or row.member.startswith('testing/'):
                        return False
                    if row.dataset_id == 'mapillary_mtsd':
                        return Path(row.member).stem not in labels.mtsd_test_keys(
                            tuple(labels.rules[row.dataset_id]['archives']))
                    return True
                record = next(row for row in iterator if labeled(row))
            finally:
                iterator.close()
            source = reader.read(record)
            try:
                record = labels.resolve_record(record, list(source.size))
                views = transform_image(source, record.projection, perspective_mode=record.perspective_mode)
                exported = labels.export(record, list(source.size), [meta for _, meta in views])
                documents = [json.loads(payload) for _, files in exported
                             for name, payload in files if name.endswith('/annotations.json')]
                writer = PackageWriter(Path(cache_root)/rule.dataset_id, 'smoke', checkpoint_sources=1)
                rows = []
                for (image, transform), (meta, files) in zip(views, exported):
                    rows.append({**record.json(), 'original_size': list(source.size),
                         'transform': transform, 'source_views': len(views),
                         'view_id': f'{rule.dataset_id}/{record.source_index:09d}/view_{transform["view_index"]:02d}',
                         'validation': meta, '_validation_files': files})
                writer.write([(np.ones((len(rows), 4), dtype=np.float16)/2, rows)])
                writer.close()
                assert committed_packages(writer.root) == {record.source_index}
                print(json.dumps({'dataset_id': rule.dataset_id, 'source': record.source_uri,
                    'views': len(views), 'status': [meta['status'] for meta, _ in exported],
                    'target_kinds': [target['kind'] for target in documents[0]['targets']],
                    'files': sum(len(files) for _, files in exported),
                    'native_package_integrity': 'passed',
                    'bytes': sum(len(payload) for _, files in exported for _, payload in files)},
                    ensure_ascii=False), flush=True)
            finally:
                source.close()
                for image, _ in locals().get('views', []):
                    image.close()


if __name__ == '__main__':
    main()
