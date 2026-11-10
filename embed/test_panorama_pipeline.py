"""Isolated synthetic integration tests; no production data or model loading."""
import io
import json
from pathlib import Path
import tempfile
import threading
import time
from types import SimpleNamespace
import unittest
import subprocess
import sys
from unittest.mock import patch
import tarfile

import numpy as np
from PIL import Image

from pipeline_state import RunState, RunLock, parse_identity, ref_key, read_selection
from pipeline_runtime import Stats, PreparedStream, NativeProjector, prepare, process_city, spherical_image, FailurePolicy, write_with_retries
from run_panorama_embedding import safe_root, capacity


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="urbanfabric-pipeline-test-")
        self.root = Path(self.tmp.name)
        self.panos = self.root/"sources"
        self.panos.mkdir()
        self.stats = Stats(emit=lambda _:None)
        self.stop = threading.Event()

    def tearDown(self):
        self.tmp.cleanup()

    def make_state(self, count=5, city="rome", invalid=None):
        path = self.panos/"sample.tar"
        with tarfile.open(path,"w",format=tarfile.PAX_FORMAT) as tar:
            for i in range(count):
                buffer = io.BytesIO()
                Image.new("RGB", (128,64), (20+i*20,60,100)).save(buffer,"JPEG")
                payload = b"not an image" if i==invalid else buffer.getvalue()
                name = "nested/"+"x"*110+f"/{i+1}_12.123456789_41.987654321_202507_heading45.jpg"
                member = tarfile.TarInfo(name)
                member.size = len(payload)
                tar.addfile(member,io.BytesIO(payload))
        st=path.stat()
        config=dict(cities=[city],sources=[dict(name=path.name,city=city,namespace=city,size=st.st_size,mtime_ns=st.st_mtime_ns)],dimension=3,jpeg_quality=90)
        return RunState(self.root/"output",config)

    def inventory(self,state,selection=None):
        return state.inventory(self.panos,selection or set(),self.stats,self.stop)

    def items(self,state):
        with PreparedStream(state.pending(state.config["cities"][0]),self.panos,2,3,90,self.stats,self.stop) as stream:
            return list(stream)

    def test_names_and_selection(self):
        self.assertEqual(parse_identity("123_121.2,31.2_202503.jpg"), (123,121.2,31.2,202503,None))
        self.assertEqual(parse_identity("123_-73.2_40.7_202504_heading23.jpg")[-1],23)
        self.assertEqual(ref_key(1,12.123456789,41.987654321,202501),ref_key(1,float(np.float32(12.123456789)),float(np.float32(41.987654321)),202501))

    def test_inventory_interrupt_pax_resume(self):
        state=self.make_state()
        original=self.stats.add
        def interrupt(**values):
            original(**values)
            if self.stats.values.get("inventory_headers",0)==2:
                self.stop.set()
        self.stats.add=interrupt
        self.assertFalse(self.inventory(state))
        self.assertEqual(state.counts(),{"rome":2})
        self.stop.clear();self.stats.add=original
        self.assertTrue(self.inventory(state))
        self.assertEqual(state.counts(),{"rome":5})
        items=self.items(state)
        self.assertEqual([i.record["pano_id"] for i in items],list(range(1,6)))
        self.assertEqual(items[0].image.size,(128,64))
        with Image.open(io.BytesIO(items[0].jpeg)) as im:
            self.assertEqual(im.size,(2048,1024))

    def test_london_missing_and_exact_filter(self):
        state=self.make_state(city="london")
        selection={ref_key(2,12.123456789,41.987654321,202507)}
        self.assertTrue(self.inventory(state,selection))
        self.assertEqual(state.counts(),{"london":1})
        with self.assertRaisesRegex(RuntimeError,"missing=1"):
            self.inventory(state,selection|{ref_key(9,12,41,202507)})

    def test_crashes_each_publish_stage(self):
        state=self.make_state(count=2);self.inventory(state)
        items=self.items(state);emb=np.ones((2,8,3),np.float16)
        for phase in ("embedding","reference","identities","pano","marker"):
            def fault(actual):
                if actual==phase:
                    raise RuntimeError("simulated process loss")
            with self.assertRaisesRegex(RuntimeError,"simulated"):
                state.write_shard("rome",0,0,items,emb,self.stats,fault)
            resumed=RunState(state.root,state.config)
            next_shards=resumed.recover()
            if phase=="marker":
                self.assertEqual(next_shards,{"rome":1})
                self.assertEqual(list(resumed.pending("rome")),[])
            else:
                self.assertEqual(next_shards,{"rome":0})
                self.assertEqual(len(list(resumed.pending("rome"))),2)
        with self.assertRaisesRegex(RuntimeError,"overwrite"):
            state.write_shard("rome",0,0,items,emb,self.stats)
        paths=state.paths("rome",0)
        self.assertEqual(np.load(paths["reference"]).dtype,np.float64)
        identities=[json.loads(line) for line in paths["identities"].read_text().splitlines()]
        with tarfile.open(paths["pano"]) as tar:
            self.assertEqual(tar.getnames(),[row["pano_member"] for row in identities])
        with paths["pano"].open("ab") as f:f.write(b"corruption")
        with self.assertRaisesRegex(RuntimeError,"Incomplete"):
            state.recover()

    def test_geometry_native_and_verified_wrap(self):
        rng=np.random.default_rng(1)
        pixels=rng.integers(0,256,(1664,3328,3),dtype=np.uint8)
        native=Image.fromarray(pixels)
        self.assertIs(spherical_image(native)[0],native)
        wrapped=np.concatenate((pixels,pixels[:,:256]),axis=1)
        for extra in (0,1):
            raw=np.concatenate((wrapped,np.zeros((extra,3584,3),dtype=np.uint8)),axis=0)
            corrected,geometry=spherical_image(Image.fromarray(raw))
            self.assertEqual(corrected.size,(3328,1664))
            self.assertTrue(np.array_equal(np.asarray(corrected),pixels))
            self.assertEqual(geometry["discarded_bottom_rows"],extra)
        with self.assertRaisesRegex(ValueError,"Unverified"):
            spherical_image(Image.new("RGB",(3584,1664)))
        with self.assertRaises(ValueError):spherical_image(Image.new("RGB",(3000,1664)))

    def test_fixed_wall_clock(self):
        rows=[]
        with Stats(.05,emit=rows.append) as stats:
            for count in (1,128,7):
                stats.add(computed_panos=count)
                time.sleep(.06)
        self.assertGreaterEqual(len(rows),4)
        for left,right in zip(rows[:2],rows[1:3]):
            self.assertAlmostEqual(right["elapsed_seconds"]-left["elapsed_seconds"],.05,delta=.04)

    def test_legacy_report_has_all_original_sections(self):
        from contextlib import redirect_stdout
        output=io.StringIO()
        stats=Stats()
        stats.set(stage='embedding',city='rome')
        with redirect_stdout(output):stats.snapshot()
        for key in ('decode_from_tar','jpeg_decode','pil_to_cuda','stack_panos',
                    'reproject_gpu','qwen_embed','parse_ref','io_write',
                    'gpu_wait_get','cpu_wait_put','decoded_bad','PERF (async-aware)'):
            self.assertIn(key,output.getvalue())

    def test_repack_preserves_full_groups_and_requeues_tail(self):
        from repack_committed import build
        state=self.make_state(count=9);self.inventory(state)
        items=self.items(state)
        values=np.arange(9*8*3,dtype=np.float16).reshape(9,8,3)
        start=0
        for shard,count in enumerate((3,2,4)):
            state.write_shard('rome',shard,start,items[start:start+count],values[start:start+count],self.stats)
            start+=count
        target=self.root/'repacked'
        report=build(state.root,target,4)
        new=RunState(target,state.config)
        self.assertEqual(report['rome'],dict(previous=9,retained=8,requeued=1))
        self.assertEqual(new.counts(True),{'rome':8})
        self.assertEqual([r['pano_id'] for r in new.pending('rome')],[9])
        result=np.concatenate([np.load(new.paths('rome',i)['embedding']) for i in range(2)])
        np.testing.assert_array_equal(result,values[:8])
        self.assertEqual(state.counts(True),{'rome':9})

    def test_end_to_end_resume_fake_model(self):
        import torch
        torch.set_num_threads(1)
        state=self.make_state();self.inventory(state)
        class Embedder:
            calls=0
            def process(self,inputs,normalize=True):
                self.calls+=1
                return np.array([np.asarray(i["image"]).mean(axis=(0,1)) for i in inputs])
        embedder=Embedder()
        args=SimpleNamespace(decode_workers=2,prefetch_panos=3,embed_batch=8,pano_batch=2,checkpoint_panos=2)
        process_city(state,"rome",0,self.panos,NativeProjector("cpu",32),embedder,args,self.stats,self.stop)
        self.assertEqual(state.counts(True),{"rome":5})
        self.assertEqual(state.recover(),{"rome":3})
        calls=embedder.calls
        process_city(state,"rome",3,self.panos,NativeProjector("cpu",32),embedder,args,self.stats,self.stop)
        self.assertEqual(calls,embedder.calls)
        values=np.concatenate([np.load(state.paths("rome",i)["embedding"]) for i in range(3)])
        self.assertEqual(values.shape,(5,8,3))
        self.assertTrue(np.all(np.diff(values[:,0,0])>0))

    def test_bad_image_propagates_without_hang(self):
        state=self.make_state(invalid=2);self.inventory(state)
        with self.assertRaisesRegex(RuntimeError,"Cannot prepare"):
            self.items(state)

    def test_legacy_tensor_path_microbatches_preserve_order(self):
        import torch
        from pipeline_runtime import compute_batch
        torch.set_num_threads(1)
        state=self.make_state(count=3);self.inventory(state)
        items=self.items(state)
        projector=NativeProjector("cpu",32)
        expected=np.array([np.asarray(v).mean(axis=(0,1)) for v in projector(items)])
        class Embedder:
            batches=[]
            def process(self,inputs,normalize=True):
                self.batches.append(len(inputs))
                return np.array([np.asarray(i['image']).mean(axis=(0,1)) for i in inputs])
        embedder=Embedder()
        result=compute_batch(items,projector,embedder,10,self.stats)
        self.assertEqual(embedder.batches,[10,10,4])
        np.testing.assert_array_equal(result.reshape(24,3),expected.astype(np.float16))
        self.assertGreater(self.stats.values['views_to_pil_seconds'],0)

    def test_real_process_exit_after_marker(self):
        state=self.make_state(count=1);self.inventory(state)
        script='''
import json,os,sys,threading
import numpy as np
from pathlib import Path
from pipeline_state import RunState
from pipeline_runtime import PreparedStream,Stats
root=Path(sys.argv[1]);state=RunState(root,json.loads((root/'run.json').read_text())['config'])
stats=Stats(emit=lambda _:None)
with PreparedStream(state.pending('rome'),sys.argv[2],1,1,90,stats,threading.Event()) as stream:
 items=list(stream)
def fault(phase):
 if phase=='marker':os._exit(37)
state.write_shard('rome',0,0,items,np.ones((1,8,3)),stats,fault)
'''
        result=subprocess.run([sys.executable,"-c",script,str(state.root),str(self.panos)],timeout=30)
        self.assertEqual(result.returncode,37)
        self.assertEqual(state.counts(True),{})
        self.assertEqual(state.recover(),{"rome":1})
        self.assertEqual(state.counts(True),{"rome":1})

    def test_projection_mixed_native_sizes_and_orientation(self):
        import torch
        torch.set_num_threads(1)
        from pipeline_runtime import Prepared
        items=[]
        for w,h in [(256,128),(128,64),(256,128)]:
            pixels=np.zeros((h,w,3),np.uint8)
            pixels[:,:,0]=np.arange(w)[None,:]*255/(w-1)
            pixels[:,:,1]=np.arange(h)[:,None]*255/(h-1)
            items.append(Prepared({},Image.fromarray(pixels),b"",(w,h),{}))
        views=NativeProjector("cpu",33)(items)
        self.assertEqual(len(views),24)
        # yaw=0 faces the center of the panorama, with no vertical pitch.
        for index in (7,15,23):
            center=np.asarray(views[index])[16,16]
            self.assertTrue(np.all(np.abs(center[:2].astype(float)-127)<2))
        # Mixed-size grouping must not reorder panorama rows or yaw slots.
        self.assertTrue(np.array_equal(np.asarray(views[0]),np.asarray(views[16])))
        self.assertGreater(np.asarray(views[0])[16,16,0],np.asarray(views[7])[16,16,0])

    def test_reader_prefetch_overlaps_consumer(self):
        state=self.make_state(count=8);self.inventory(state)
        with PreparedStream(state.pending("rome"),self.panos,2,3,90,self.stats,self.stop) as stream:
            first=next(iter(stream))
            deadline=time.monotonic()+2
            while self.stats.values.get("decoded_panos",0)<4 and time.monotonic()<deadline:
                time.sleep(.01)
            self.assertGreater(self.stats.values["decoded_panos"],1)
            self.assertLessEqual(len(stream.futures),3)
            first.image.close()

    def test_owner_lock_and_source_change(self):
        state=self.make_state()
        with RunLock(state.root):
            with self.assertRaises(RuntimeError):
                with RunLock(state.root):pass
        with self.assertRaises(ValueError):RunState(state.root,dict(state.config,dimension=5))
        with (self.panos/"sample.tar").open("ab") as f:f.write(b"x")
        with self.assertRaisesRegex(RuntimeError,"Source changed"):self.inventory(state)

    def test_production_root_and_quota_guards(self):
        args=SimpleNamespace(output_root="/workspace/embedding/rome_224_8_45",pano_root="/workspace/pano",model_dir="/workspace/models/model",repo_dir="/workspace/Qwen")
        with self.assertRaises(ValueError):safe_root(args)
        args=SimpleNamespace(output_root=str(self.root/"output"),volume_capacity_gb=None,volume_root=None,jpeg_quality=90)
        with patch("subprocess.check_output",return_value=json.dumps({"filesystems":[{"target":str(self.root),"fstype":"fuse"}]})):
            with self.assertRaisesRegex(ValueError,"shared-pool"):capacity(args,10)

    def test_sparse_thousand_errors_do_not_stop(self):
        policy=FailurePolicy()
        for i in range(120000):policy.outcome('prepare',i%100!=0)
        with self.assertRaisesRegex(RuntimeError,'Sustained'):
            for i in range(100):policy.outcome('prepare',False)
        policy=FailurePolicy(consecutive=100,window=20,fraction=.5)
        with self.assertRaisesRegex(RuntimeError,'Sustained'):
            for i in range(20):policy.outcome('inference',i%2==0)

    def test_skip_bad_image_and_retry_failed_only(self):
        state=self.make_state(count=5,invalid=2);self.inventory(state)
        class Projector:
            def __call__(self,items):return [Image.new('RGB',(2,2)) for _ in range(len(items)*8)]
        class Model:
            def process(self,inputs,normalize=True):return np.ones((len(inputs),3))
        args=SimpleNamespace(decode_workers=2,prefetch_panos=3,embed_batch=16,pano_batch=2,checkpoint_panos=2)
        process_city(state,'rome',0,self.panos,Projector(),Model(),args,self.stats,self.stop)
        self.assertEqual(state.counts(True),{'rome':4})
        self.assertEqual(state.completion()['remaining'],0)
        self.assertEqual(state.completion()['failed_panos'],1)
        self.assertEqual(list(state.pending('rome')),[])
        state.failure_report()
        import zipfile
        with zipfile.ZipFile(state.root/'error_report.zip') as bundle:
            self.assertIn('failures.jsonl',bundle.namelist())
        state=RunState(state.root,state.config);state.recover();state.reset_failed()
        self.assertEqual([r['pano_id'] for r in state.pending('rome')],[3])

    def test_batch_split_recovers_good_images_and_oom(self):
        state=self.make_state(count=5);self.inventory(state)
        class Projector:
            def __call__(self,items):
                return [Image.new('RGB',(2,2),(i.record['pano_id'],0,0)) for i in items for _ in range(8)]
        class Model:
            def process(self,inputs,normalize=True):
                if len(inputs)>8:raise RuntimeError('simulated OOM')
                if any(i['image'].getpixel((0,0))[0]==3 for i in inputs):raise ValueError('one bad panorama')
                return np.ones((len(inputs),3))
        args=SimpleNamespace(decode_workers=2,prefetch_panos=5,embed_batch=40,pano_batch=5,checkpoint_panos=5)
        process_city(state,'rome',0,self.panos,Projector(),Model(),args,self.stats,self.stop)
        self.assertEqual(state.counts(True),{'rome':4})
        self.assertEqual(state.completion()['failed_panos'],1)
        with state.connect() as con:
            self.assertEqual(con.execute('SELECT record_id FROM failures').fetchone()[0],3)
            self.assertGreater(con.execute('SELECT count(*) FROM retry_events').fetchone()[0],0)

    def test_transient_disk_write_retries(self):
        state=self.make_state(count=1);self.inventory(state)
        items=self.items(state)
        original=state.write_shard
        attempts=[]
        def flaky(*args,**kwargs):
            attempts.append(1)
            if len(attempts)<3:raise OSError('temporary storage failure')
            return original(*args,**kwargs)
        with patch.object(state,'write_shard',side_effect=flaky),patch('pipeline_runtime.time.sleep'):
            write_with_retries(state,'rome',0,0,items,np.ones((1,8,3)),self.stats)
        self.assertEqual(len(attempts),3)
        self.assertEqual(state.counts(True),{'rome':1})

    def test_sustained_inference_failure_keeps_completed_work(self):
        state=self.make_state(count=6);self.inventory(state)
        class Projector:
            def __call__(self,items):
                return [Image.new('RGB',(2,2),(i.record['pano_id'],0,0)) for i in items for _ in range(8)]
        class Model:
            def process(self,inputs,normalize=True):
                if inputs[0]['image'].getpixel((0,0))[0]>1:raise RuntimeError('persistent model failure')
                return np.ones((len(inputs),3))
        args=SimpleNamespace(decode_workers=2,prefetch_panos=3,embed_batch=1,pano_batch=1,checkpoint_panos=4,
                             failure_policy=FailurePolicy(consecutive=3))
        with self.assertRaisesRegex(RuntimeError,'Sustained'):
            process_city(state,'rome',0,self.panos,Projector(),Model(),args,self.stats,self.stop)
        self.assertEqual(state.counts(True),{'rome':1})
        self.assertEqual(state.completion()['failed_panos'],3)
        self.assertEqual(state.completion()['remaining'],2)
        state.recover()

    def test_complete_with_errors_is_explicit(self):
        from run_panorama_embedding import finish
        state=self.make_state(count=1);self.inventory(state)
        state.failure(next(state.pending('rome')),'prepare','unknown geometry')
        finish(state,self.stats)
        report=json.loads((state.root/'complete.json').read_text())
        self.assertEqual(report['status'],'complete_with_errors')
        self.assertEqual(report['failed_panos'],1)


if __name__=="__main__":unittest.main(verbosity=2)
