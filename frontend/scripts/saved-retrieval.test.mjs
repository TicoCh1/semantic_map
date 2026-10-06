import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../src/state/localProject.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source.slice(source.indexOf('async function submitRemoteScoringJob('),
  source.indexOf('async function submitRemoteReferenceScoringJob(')),
  {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;

function fixture(savedStatus=200,hit=true,mode='gpu') {
  const calls=[];
  const context=vm.createContext({
    remoteDatasetIds:()=>['london','rome'],priorityTilesForRequest:()=>[],
    DEFAULT_REMOTE_DATASET_GROUP_ID:'four-cities',DEFAULT_REMOTE_ZOOMS:[12],
    REMOTE_SUBMIT_TIMEOUT_MS:1000,resolveRemoteUrl:(_,p)=>p,remoteJsonHeaders:()=>({}),
    reportRemoteRequestFailure(){},
    acceptedJobFromBatchResponse:raw=>raw.queries.find(q=>q.status==='accepted').job,
    fetchRemoteWithTimeout:async(path,options)=>{
      calls.push({path,body:JSON.parse(options.body)});
      const saved=path.includes('/saved/');
      return {ok:!saved||savedStatus===200,status:saved?savedStatus:200,
        json:async()=>({queries:[saved&&!hit?{status:'rejected',error:'No saved prompt'}:
          {status:'accepted',job:{job_id:saved?'saved':'native',status:saved?'ready':'queued',
            results:[{prompt_id:saved?'saved-0':'live'}]}}]})};
    }
  });
  vm.runInContext(code,context);
  return {calls,run:()=>context.submitRemoteScoringJob({mode},'trees')};
}

test('Saved GPU queries preserve their calibration cohort and never submit native scoring',async()=>{
  const f=fixture(),job=await f.run();
  assert.equal(job.job_id,'saved');assert.equal(job.results[0].prompt_id,'saved-0');
  assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].body.queries[0].dataset_ids,['london','rome']);
});
for(const [status,hit] of [[200,false],[404,false]])test(`Native fallback for saved miss ${status}`,async()=>{
  const f=fixture(status,hit);assert.equal((await f.run()).job_id,'native');assert.equal(f.calls.length,2);
});
test('Saved service failures do not silently start expensive new inference',async()=>{
  const f=fixture(503,false);await assert.rejects(f.run(),/503/);assert.equal(f.calls.length,1);
});
test('CPU mode preserves its existing saved-query endpoint',async()=>{
  const f=fixture(200,true,'cpu');assert.equal((await f.run()).job_id,'native');
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/api/scoring/jobs/batch');
});
