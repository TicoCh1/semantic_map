import json
import os
import sqlite3
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

from backend.semantic_map.backend_config import get_backend_settings
from backend.semantic_map.pano_service import PanoService, PanoServiceRegistry


class PreparedPanoIndexTests(unittest.TestCase):
    def test_prepared_lookup_preserves_source_and_rejects_changed_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);tar=root/'shard.tar';tar.write_bytes(b'\xff\xd8hi\xff\xd9')
            db=root/'index.sqlite'
            with sqlite3.connect(db) as c:
                c.execute('CREATE TABLE panos(entry_key,pano_id,tar_id,member_name,lon,lat,capture_date,offset_data,byte_size)')
                c.execute('INSERT INTO panos VALUES(?,?,?,?,?,?,?,?,?)',('key',7,str(tar),'ny/7.jpg',1.,2.,202601,0,6))
                c.execute('CREATE TABLE provenance(entry_key,source_tar)')
                c.execute("INSERT INTO provenance VALUES('key','New_York_Manhattan_chunk_0.tar')")
                c.execute('CREATE TABLE meta(key,value)')
                c.execute("INSERT INTO meta VALUES('namespace','new_york')")
            c.close()
            dataset='new_york_512_8_45_8B';st=tar.stat();manifest=root/'manifest.json'
            manifest.write_text(json.dumps({'cache_root':str(root/'cache'),'datasets':{dataset:{'index_path':str(db),'namespace':'new_york','archives':[{'path':str(tar),'size':st.st_size,'mtime_ns':st.st_mtime_ns}]}}}))
            settings=replace(get_backend_settings(),default_dataset_id=dataset,default_dataset_ids=(dataset,))
            with patch.dict(os.environ,{'PANO_PREPARED_MANIFEST':str(manifest)}):
                registry=PanoServiceRegistry(settings)
                service=registry.service_for(dataset)
                self.assertEqual(service.warmup()['pano_index_status'],'prepared')
                entry,image=service.ensure_pano_image('7',lon=1.,lat=2.)
                self.assertEqual(entry.source_id,'new_york_manhattan')
                self.assertEqual(image.read_bytes(),tar.read_bytes())
                registry.close()
                tar.write_bytes(b'changed')
                with self.assertRaisesRegex(RuntimeError,'archive changed'):
                    PanoService(settings,dataset).warmup()

if __name__=='__main__':unittest.main()
