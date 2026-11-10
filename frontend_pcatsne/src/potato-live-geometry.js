import polygonClipping from 'polygon-clipping';
import polylabel from 'polylabel';
import {toWgs84} from './potato-bng.js';

export function polygonBounds(rings) {
  const b=[Infinity,Infinity,-Infinity,-Infinity];
  for(const [x,y] of rings[0]){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);}
  return b;
}
const overlaps=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
export function polygonArea(rings) {
  const area=ring=>{
    const [x0,y0]=ring[0];let sum=0;
    for(let i=0;i<ring.length-1;i++)sum+=(ring[i][0]-x0)*(ring[i+1][1]-y0)-(ring[i+1][0]-x0)*(ring[i][1]-y0);
    return Math.abs(sum)/2;
  };
  return Math.max(0,area(rings[0])-rings.slice(1).reduce((s,r)=>s+area(r),0));
}
export function insidePolygon(x,y,rings) {
  const inside=ring=>{
    let hit=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[i],b=ring[j];
      if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
    }
    return hit;
  };
  return inside(rings[0])&&!rings.slice(1).some(inside);
}
export function pointIndex(bytes,bounds,groups) {
  const buckets=Array.from({length:groups},()=>new Map());
  const cell=(x,y)=>[Math.floor(x/1000),Math.floor(y/1000)];
  const view=new DataView(bytes);
  if(bytes.byteLength%18)throw new Error('Invalid live point records');
  for(let offset=0;offset<bytes.byteLength;offset+=18){
    const x=view.getFloat64(offset,true),y=view.getFloat64(offset+8,true),group=view.getUint16(offset+16,true);
    if(!Number.isFinite(x)||!Number.isFinite(y)||group>=groups)throw new Error('Invalid BNG point');
    const [ix,iy]=cell(x,y),key=`${ix},${iy}`;
    if(!buckets[group].has(key))buckets[group].set(key,[]);
    buckets[group].get(key).push(x,y);
  }
  return (rings,group)=>{
    const b=polygonBounds(rings),lo=cell(b[0],b[1]),hi=cell(b[2],b[3]);let count=0;
    for(let iy=lo[1];iy<=hi[1];iy++)for(let ix=lo[0];ix<=hi[0];ix++){
      const points=buckets[group-1].get(`${ix},${iy}`)||[];
      for(let k=0;k<points.length;k+=2){
        const x=points[k],y=points[k+1];
        if(x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]&&insidePolygon(x,y,rings))count++;
      }
    }
    return count;
  };
}
export function clipLiveRegions(frame,masks,countPoints=()=>0) {
  if(frame.coordinateSystem!=='EPSG:27700')throw new Error('Live geometry must use British National Grid');
  const started=performance.now(),features=[];
  for(const source of frame.features){
    const rings=source.geometry.coordinates,bounds=polygonBounds(rings);
    const near=masks.filter(m=>overlaps(bounds,m.bbox));
    const pieces=near.length?polygonClipping.difference(rings,...near.map(m=>m.coordinates)):[rings];
    for(const [index,coordinates] of pieces.entries()){
      const area=polygonArea(coordinates);
      // Merge small semantic islands before contouring; no positive-area
      // fragment deletion after GIS cuts, where it would leave unfilled holes.
      if(!(area>0))continue;
      features.push({type:'Feature',id:`${source.id}-${index}`,geometry:{type:'Polygon',coordinates},
        properties:{...source.properties,areaKm2:area/1e6,areaCrs:'EPSG:27700',matchingPoints:countPoints(coordinates,source.properties.group)}});
    }
  }
  const largest=new Map();
  for(const f of features){const previous=largest.get(f.properties.group);if(!previous||f.properties.areaKm2>previous.properties.areaKm2)largest.set(f.properties.group,f);}
  const labels=[];
  for(const f of largest.values()){
    const label=polylabel(f.geometry.coordinates,1);
    f.properties.labelPoint=label.slice(0,2);f.properties.showLabel=true;
    labels.push({type:'Feature',geometry:{type:'Point',coordinates:label.slice(0,2)},properties:f.properties});
  }
  // Convert only at the standard GeoJSON / MapLibre display boundary.
  const displayFeatures=features.map(f=>({...f,geometry:{...f.geometry,coordinates:f.geometry.coordinates.map(r=>r.map(toWgs84))},
    properties:{...f.properties,...(f.properties.labelPoint?{labelPoint:toWgs84(f.properties.labelPoint)}:{})}}));
  const displayLabels=labels.map(f=>({...f,geometry:{type:'Point',coordinates:toWgs84(f.geometry.coordinates)},
    properties:{...f.properties,labelPoint:toWgs84(f.geometry.coordinates)}}));
  return {geo:{type:'FeatureCollection',features:displayFeatures},labels:{type:'FeatureCollection',features:displayLabels},
    metric:{type:'FeatureCollection',coordinateSystem:'EPSG:27700',features},elapsedMs:performance.now()-started};
}
