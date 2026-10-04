import type { FeatureCollection, SemanticLayer } from "../api/types";

export type RegionManifest = {
  point_count: number; payload_bytes: number; model_id: string; run_id: string;
  source_label: string; source_dataset_id: string; target_dataset_id: string;
  source_points: number; source_center: [number, number]; source_radius_m: number;
  source_geometry: FeatureCollection | FeatureCollection["features"][number]; source_references: FeatureCollection;
  bounds: [[number, number], [number, number]]; axis_variances: number[];
  explained_variance_fraction: number; created_at: string;
  subsets: Record<string, { histogram: number[]; matched_points: number }>;
  regions: FeatureCollection;
};
export type RegionBundle = { meta: RegionManifest; coordinates: Float64Array; ids: Float64Array; atlas: Uint8Array };
const cache = new Map<string, Promise<RegionBundle>>();
export function loadRegion(id: string): Promise<RegionBundle> {
  const previous=cache.get(id); if(previous) return previous;
  const promise=(async()=>{
    const base=`${import.meta.env.BASE_URL}region-data/${id}`;
    const responses=await Promise.all([fetch(`${base}/manifest.json`),fetch(`${base}/intensity.bin.gz`)]);
    if(responses.some(response=>!response.ok))throw new Error("Region data unavailable. Run the region data preparation script first.");
    const meta=await responses[0].json() as RegionManifest;
    const downloaded=await responses[1].arrayBuffer();
    // Static servers may mark .gz assets with Content-Encoding, in which case
    // fetch has already decompressed the body. Other hosts serve gzip bytes.
    const buffer=downloaded.byteLength===meta.payload_bytes?downloaded:await new Response(new Blob([downloaded]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
    if(buffer.byteLength!==meta.payload_bytes||meta.source_references.features.length!==meta.source_points)throw new Error("Invalid cached region data");
    const n=meta.point_count;
    return {meta,coordinates:new Float64Array(buffer,0,n*2),ids:new Float64Array(buffer,n*16,n),atlas:new Uint8Array(buffer,n*24,n*255)};
  })();
  cache.set(id,promise); promise.catch(()=>cache.delete(id)); return promise;
}
// Display standardization of RunPod's cached product, using the complete target
// city. Colour-range changes and camera moves never change these statistics.
export function intensityZscores(histogram: number[]): Float64Array {
  const lookup=new Float64Array(256);
  const count=histogram.reduce((sum,n)=>sum+n,0);
  if(!count)return lookup;
  const mean=histogram.reduce((sum,n,i)=>sum+n*((i+.5)/256),0)/count;
  const variance=histogram.reduce((sum,n,i)=>sum+n*((i+.5)/256-mean)**2,0)/count;
  if(variance<=0)return lookup;
  const std=Math.sqrt(variance);
  for(let i=0;i<256;i++)lookup[i]=((i+.5)/256-mean)/std;
  return lookup;
}
export function targetPoints(bundle: RegionBundle, mask: number): FeatureCollection {
  if(!mask)return {type:"FeatureCollection",features:[]};
  const {meta,atlas,coordinates,ids}=bundle;
  const lookup=intensityZscores(meta.subsets[String(mask)].histogram);
  const features: FeatureCollection["features"]=[];
  for(let i=0;i<meta.point_count;i++){
    const bin=atlas[i*255+mask-1];
    features.push({type:"Feature",geometry:{type:"Point",coordinates:[coordinates[i*2],coordinates[i*2+1]]},properties:{id:String(ids[i]),pano_id:String(ids[i]),dataset_id:meta.target_dataset_id,score:(bin+.5)/256,zscore:lookup[bin]}});
  }
  return {type:"FeatureCollection",features};
}
export function sourceArea(meta: RegionManifest): FeatureCollection {
  const value=meta.source_geometry;
  return value.type==="Feature"?{type:"FeatureCollection",features:[value]}:value as unknown as FeatureCollection;
}
export function makeLayer(id: string, name: string, style: SemanticLayer["style"], revision: string, property="score"): SemanticLayer {
  return {id,name,prompt:name,visible:true,order:0,source_type:"geojson",source_path:`memory:${revision}`,score_property:property,style,status:"ready",created_at:"2026-10-01"};
}
