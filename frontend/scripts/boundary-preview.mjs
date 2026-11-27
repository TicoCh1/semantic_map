// Development-only four-city fixture. Both the capture locations and class
// probabilities are illustrative. No production service or GPU is involved.
const centers = { london: [-.119,51.51], rome: [12.49,41.902], new_york: [-74.006,40.713], shanghai: [121.478,31.233] };
const classes = ["Residential blocks","Commercial frontage","Parks and gardens","Civic spaces","Waterfront","Industrial land"];
const classColors = ["#bd87df","#ef9552","#50ae73","#e3c457","#4daee4","#b77968"];
const cities = Object.keys(centers);
const meters = lat => [111320*Math.cos(lat*Math.PI/180),111320];
const distance = (a,b) => Math.hypot(...meters(b[1]).map((s,i)=>(a[i]-b[i])*s));
const sum = a => a.reduce((v,x)=>v+x,0);

function sampleCity(city, phase) {
  const origin = centers[city], scale = meters(origin[1]);
  const rows = [];
  for(let x=-48;x<=48;x++) for(let y=-48;y<=48;y++){
    const xx=x+.23*Math.sin(y/4+phase), yy=y+.21*Math.sin(x/5);
    const xy=origin.map((v,i)=>Number((v+[xx,yy][i]*90/scale[i]).toFixed(5)));
    const values=classes.map((_,j)=>Math.exp(1.7*Math.cos(xx/(2.7+j*.3)+j*2+phase)+1.3*Math.sin(yy/(2.2+j*.4)-j+phase*.6)));
    const total=sum(values);
    rows.push({xy,vector:values.map(v=>v/total),kind:values.indexOf(Math.max(...values))});
  }
  return rows;
}

function intersects(a,b,c,d) {
  const turn=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const overlaps=(i)=>Math.max(Math.min(a[i],b[i]),Math.min(c[i],d[i]))<=Math.min(Math.max(a[i],b[i]),Math.max(c[i],d[i]));
  return overlaps(0)&&overlaps(1)&&turn(a,b,c)*turn(a,b,d)<=0&&turn(c,d,a)*turn(c,d,b)<=0;
}

export function validateBoundary(city, points) {
  if(!cities.includes(city)||!Array.isArray(points)||points.length<3||points.length>64||
    !points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90)) throw Error("Use 3–64 corners in one city.");
  const n=points.length;
  const area=Math.abs(sum(points.map((a,i)=>{const b=points[(i+1)%n];return (a[0]-points[0][0])*(b[1]-points[0][1])-(b[0]-points[0][0])*(a[1]-points[0][1]);})));
  if(area<1e-12||new Set(points.map(p=>p.join(","))).size!==n)throw Error("Draw a boundary with distinct corners and a non-zero area.");
  for(let i=0;i<n;i++)for(let j=i+2;j<n;j++)if(!(i===0&&j===n-1)&&intersects(points[i],points[(i+1)%n],points[j],points[(j+1)%n]))throw Error("The boundary crosses itself. Move or undo a corner.");
}

function inside([x,y], ps) {
  let hit=false;
  for(let i=0,j=ps.length-1;i<ps.length;j=i++){
    const [ax,ay]=ps[i],[bx,by]=ps[j];
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)hit=!hit;
  }
  return hit;
}

export function previewData() {
  const rows=Object.fromEntries(cities.map((c,i)=>[c,sampleCity(c,i)]));
  const queries=new Map();
  let serial=0;
  function analyze({city,points}) {
    validateBoundary(city,points);
    const samples=rows[city].filter(r=>inside(r.xy,points));
    const counts=classes.map((_,j)=>samples.filter(r=>r.kind===j).length);
    const themes=classes.map((label,j)=>({label,color:classColors[j],count:counts[j],coverage:counts[j]/(samples.length||1)}))
      .filter(t=>t.count).sort((a,b)=>b.count-a.count);
    return {samples,themes};
  }
  function search({city,points,theme=null},seed=false) {
    const {samples,themes}=analyze({city,points});
    if(!samples.length)throw Error("No preview samples in this boundary. Draw around visible map points.");
    if(theme!==null&&!themes.some(t=>t.label===theme))throw Error("Select a class from the latest analysis.");
    const j=classes.indexOf(theme);
    const sourceSamples=j<0?samples:samples.filter(row=>row.kind===j);
    const profile=classes.map((_,k)=>sum(sourceSamples.map(r=>r.vector[k]))/sourceSamples.length);
    const norm=Math.hypot(...profile), center=[0,1].map(k=>sum(points.map(p=>p[k]))/points.length);
    const field={},background=[],foreign=[];
    for(const c of cities)field[c]=rows[c].map(r=>{
      const self=city===c && distance(r.xy,center)<300;
      const similarity=sum(profile.map((w,k)=>w*r.vector[k]))/(norm*Math.hypot(...r.vector));
      // A class query matches its local examples and discounts target samples
      // in proportion to their membership in the requested class.
      const raw=Math.fround(j<0?similarity:similarity*r.vector[j]);
      if(!self)background.push(raw);
      if(c!==city)foreign.push(raw);
      return {raw,self};
    });
    background.sort((a,b)=>a-b);
    const mean=sum(background)/background.length,sd=Math.sqrt(sum(background.map(v=>(v-mean)**2))/background.length)||1;
    const lo=Math.min(...foreign),hi=Math.max(...foreign);
    const id=seed?"sample_"+city:"boundary_"+(++serial);
    const name=seed?"Sample area":(theme??"Whole boundary")+" · "+serial;
    const query={id,name,city,category:"preview",coordinates:center,area:[[...points,points[0]]],nodes:sourceSamples.length,radius_m:0,
      smart_range:{sim_raw:{lower:lo,upper:hi},sim_z:{lower:(lo-mean)/sd,upper:(hi-mean)/sd}},mean,sd,reference:0,themes:themes.map(t=>t.label),targets:{}};
    const parts=[];
    for(const c of cities){
      const values=field[c],raw=Buffer.alloc(values.length*4),flags=Buffer.alloc(values.length*2);
      const indices=values.map((_,i)=>i).sort((a,b)=>values[b].raw-values[a].raw);
      const hits=[];
      for(let i=0;i<values.length;i++){
        const v=values[i];let l=0,h=background.length;
        while(l<h){const m=(l+h)>>>1;if(background[m]<=v.raw)l=m+1;else h=m}
        v.pct=Math.round(l/background.length*10000);
        raw.writeFloatLE(v.raw,i*4);flags.writeUInt16LE(v.pct+(v.self?32768:0),i*2);
      }
      for(const i of indices){
        const xy=rows[c][i].xy,v=values[i];
        if(v.self||hits.some(h=>distance(h.coordinates,xy)<600))continue;
        hits.push({rank:hits.length+1,coordinates:xy,nearest_landmark:"",district:"",dist_m:0,dist_from_source_m:c===city?distance(center,xy):null,sim_z:(v.raw-mean)/sd,sim_raw:v.raw,sim_pct:v.pct/100,top_shared_themes:[]});
        if(hits.length===5)break;
      }
      query.targets[c]={hits,hot:values.filter(v=>(v.raw-mean)/sd>=2).length,eligible:values.filter(v=>!v.self).length};
      parts.push(raw,flags);
    }
    if(!seed && queries.size>=cities.length+64)queries.delete([...queries.keys()].find(k=>k.startsWith("boundary_")));
    queries.set(id,{query,bytes:Buffer.concat(parts)});
    return query;
  }
  for(const c of cities){
    const [x,y]=centers[c];
    search({city:c,points:[[x-.003,y-.002],[x+.003,y-.002],[x+.003,y+.002],[x-.003,y+.002]]},true);
  }
  return {rows,queries,analyze,search};
}

export function boundaryPreview() {
  return {name:"local-boundary-preview",apply:"serve",configureServer(server){
    let data;
    server.middlewares.use("/__area-preview",async(req,res)=>{
      try{
        data??=previewData();
        const path=req.url.split("?")[0];
        const json=v=>{res.setHeader("Content-Type","application/json");res.end(JSON.stringify(v))};
        res.setHeader("Cache-Control","no-store");
        if(req.method==="POST"&&["/analyze","/search"].includes(path)){
          let body="";for await(const chunk of req){body+=chunk;if(body.length>16000)throw Error("Boundary is too large.")}
          const input=JSON.parse(body);
          if(path==="/search")return json(data.search(input));
          const {samples,themes}=data.analyze(input);
          return json({count:samples.length,themes,points:samples.map(row=>({xy:row.xy,label:classes[row.kind]}))});
        }
        if(req.method==="GET"&&path==="/index")return json({version:"boundary-preview",cities:Object.fromEntries(cities.map(c=>[c,data.rows[c].length])),queries:[...data.queries.values()].map(v=>v.query)});
        const [,resource,key]=path.split("/");
        if(req.method==="GET"){
          res.setHeader("Content-Type","application/octet-stream");
          if(resource==="query"&&data.queries.has(key))return res.end(data.queries.get(key).bytes);
          if(cities.includes(key)&&["city","panoramas"].includes(resource)){
            const wide=resource==="panoramas",stride=wide?5:2,bytes=Buffer.alloc(data.rows[key].length*stride*4);
            data.rows[key].forEach(({xy},i)=>{
              const values=wide?[i,...xy.map(v=>Math.round(v*1e7)),0,i|(1<<30)]:xy.map(v=>Math.round(v*1e5));
              values.forEach((v,k)=>bytes.writeInt32LE(v,(i*stride+k)*4));
            });
            return res.end(bytes);
          }
        }
        res.statusCode=404;json({detail:"Preview layer unavailable."});
      }catch(error){res.statusCode=422;res.setHeader("Content-Type","application/json");res.end(JSON.stringify({detail:error.message}));}
    });
  }};
}
