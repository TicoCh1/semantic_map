// Only one geometry task runs at a time; dragging replaces the pending task.
import PotatoGeometryWorker from './potato-live.worker.js?worker&inline';
export class LivePotatoRegions {
  constructor(points,bounds,groups){
    this.worker=new PotatoGeometryWorker();
    this.masks=new Set();this.nextId=0;this.active=null;this.pending=null;
    this.ready=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});
    // Cached views can render before the worker is needed. A later compute
    // still receives any initialization failure through this same promise.
    void this.ready.catch(()=>{});
    this.worker.onmessage=({data})=>{
      if(data.type==='ready'){this.resolveReady();return;}
      const job=this.active;
      if(!job||job.id!==data.id)return;
      this.active=null;
      if(data.type==='error')job.reject(new Error(data.message));else job.resolve(data.result);
      if(this.pending){const next=this.pending;this.pending=null;this.dispatch(next);}
    };
    this.worker.onerror=event=>{
      const error=new Error(event.message||'Geometry worker failed');this.rejectReady(error);
      this.active?.reject(error);this.pending?.reject(error);this.active=this.pending=null;
    };
    this.worker.postMessage({type:'init',points,bounds,groups},[points]);
  }
  async compute(frame,mask,maskKey,key){
    await this.ready;
    return new Promise((resolve,reject)=>{
      const job={frame,mask,maskKey,key,id:++this.nextId,resolve,reject};
      if(this.active){this.pending?.resolve(null);this.pending=job;}else this.dispatch(job);
    });
  }
  dispatch(job){
    this.active=job;
    const mask=this.masks.has(job.maskKey)?undefined:job.mask;
    this.masks.add(job.maskKey);
    this.worker.postMessage({type:'compute',id:job.id,frame:job.frame,mask,maskKey:job.maskKey,key:job.key});
  }
}
