"""Read the committed Qwen panorama archive set as independent CORE inputs."""
import json
from pathlib import Path
import sqlite3

from pipeline_state import DATASETS


def source_manifest(run_root, cities):
    root = Path(run_root).resolve()
    owner = json.loads((root / 'run.json').read_text())
    complete = json.loads((root / 'complete.json').read_text())
    if owner['run_id'] != complete['run_id'] or complete['remaining'] != 0:
        raise RuntimeError('Source Qwen run must be complete and owned')
    expected = {city: complete['committed_counts'][city] for city in cities}
    sources = []
    for city in cities:
        retained = 0
        for path in sorted((root / 'checkpoints' / DATASETS[city]).glob('checkpoint_*.json')):
            marker = json.loads(path.read_text())
            if marker['run_id'] != owner['run_id'] or marker['city'] != city:
                raise RuntimeError(f'Foreign source marker: {path}')
            name = f"{DATASETS[city]}/panos_shard_{marker['shard']:05d}.tar"
            archive = root / 'pano' / name
            stat = archive.stat()
            if stat.st_size != marker['file_sizes']['pano']:
                raise RuntimeError(f'Incomplete retained panorama TAR: {archive}')
            retained += len(marker['record_ids'])
            sources.append({'city': city, 'namespace': city, 'name': name,
                            'size': stat.st_size, 'mtime_ns': stat.st_mtime_ns})
        if retained != expected[city]:
            raise RuntimeError(f'Retained {city} archive count mismatch')
    database = root / 'inventory.sqlite3'
    selection = set()
    if 'london' in cities:
        with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True) as con:
            selection = {tuple(json.loads(row[0])) for row in con.execute(
                "SELECT selection_key FROM records WHERE city='london' AND shard IS NOT NULL")}
        if len(selection) != expected['london']:
            raise RuntimeError('Source London committed selection mismatch')
    provenance = {'root': str(root), 'run_id': owner['run_id'],
        'input_pixels': 'retained_jpeg_actual_dimensions_validated_at_decode_not_inferred_from_legacy_manifest',
        'source_counts': expected, 'original_failed_panos_excluded': complete['failed_panos'],
        'inventory_size': database.stat().st_size, 'inventory_mtime_ns': database.stat().st_mtime_ns}
    return str(root / 'pano'), sources, selection, expected, provenance
