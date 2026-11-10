import {pointIndex,clipLiveRegions} from './potato-live-geometry.js';
let countPoints;
const masks=new Map(),results=new Map();
self.onmessage=({data})=>{
  try {
    if(data.type==='init'){
      countPoints=pointIndex(data.points,data.bounds,data.groups);
      self.postMessage({type:'ready'});return;
    }
    if(data.mask)masks.set(data.maskKey,data.mask);
    let result=results.get(data.key);
    if(!result){
      result=clipLiveRegions(data.frame,masks.get(data.maskKey)||[],countPoints);
      results.set(data.key,result);
      if(results.size>12)results.delete(results.keys().next().value);
    }
    self.postMessage({type:'result',id:data.id,result});
  }catch(error){self.postMessage({type:'error',id:data.id,message:error.message});}
};
