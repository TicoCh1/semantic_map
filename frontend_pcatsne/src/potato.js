const directory = './data/london_potato_20261002/';
const $ = (id) => document.getElementById(id);
const cache = new Map();
let manifest, nativeColors, groups, revision = 0;
const get = async (path, type='json') => {
  if (!cache.has(path)) cache.set(path, fetch(directory+path).then(async (r) => {
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return type === 'json' ? r.json() : r.arrayBuffer();
  }));
  return cache.get(path);
};
const escape = (v) => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function frame(points) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let i=0;i<points.length;i+=2) {
    minX=Math.min(minX,points[i]);maxX=Math.max(maxX,points[i]);minY=Math.min(minY,points[i+1]);maxY=Math.max(maxY,points[i+1]);
  }
  const size=Math.max(maxX-minX,maxY-minY)*1.08;
  return {size,x:(minX+maxX-size)/2,y:(minY+maxY-size)/2};
}
function drawPoints(id, points, area) {
  const canvas=$(`points-${id}`), width=canvas.clientWidth, dpr=devicePixelRatio||1;
  canvas.width=Math.round(width*dpr);canvas.height=canvas.width;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const pad=28, side=width-2*pad;
  ctx.strokeStyle='#273224';ctx.lineWidth=.6;ctx.fillStyle='#aabb9e';ctx.font='10px system-ui';
  for(let j=0;j<=4;j++) {
    const v=pad+j*side/4;ctx.beginPath();ctx.moveTo(v,pad);ctx.lineTo(v,pad+side);ctx.moveTo(pad,v);ctx.lineTo(pad+side,v);ctx.stroke();
    ctx.fillText((area.x+j*area.size/4).toFixed(0),v-5,width-9);
    ctx.fillText((area.y+area.size-j*area.size/4).toFixed(0),2,v+3);
  }
  const categorical=$('colors').value==='clusters';
  // Draw every source point. Opaque pixels show dense overlaps without category-alpha bias.
  for(let i=0;i<manifest.rows;i++) {
    const c=categorical?manifest.clusterColors[groups[i]]:nativeColors.subarray(i*3,i*3+3);
    ctx.fillStyle=`rgb(${c[0]} ${c[1]} ${c[2]})`;
    const x=pad+(points[i*2]-area.x)/area.size*side;
    const y=pad+(1-(points[i*2+1]-area.y)/area.size)*side;
    ctx.fillRect(x,y,.7,.7);
  }
}
function drawRegions(id, data, area) {
  const svg=$(`regions-${id}`), width=svg.clientWidth, pad=28, side=width-2*pad;
  svg.setAttribute('viewBox',`0 0 ${width} ${width}`);
  const x=(value)=>pad+(value-area.x)/area.size*side;
  const y=(value)=>pad+(1-(value-area.y)/area.size)*side;
  let paths='';
  for(const region of data.regions) {
    const path=region.xy.map((p,i)=>`${i?'L':'M'}${x(p[0]).toFixed(2)} ${y(p[1]).toFixed(2)}`).join(' ')+' Z';
    const c=region.color;
    paths+=`<path d="${path}" fill="rgb(${c.join(' ')})" fill-opacity=".7" stroke="#d5dec9" stroke-width=".35"><title>Semantic group ${region.cluster+1}; Gaussian density envelope</title></path>`;
  }
  svg.innerHTML=paths;
  // Label only the largest island for each group; never invent geographic names.
  const biggest=new Map();
  for(const region of data.regions) if(!biggest.has(region.cluster)||biggest.get(region.cluster).areaPixels<region.areaPixels) biggest.set(region.cluster,region);
  for(const [cluster,region] of biggest) {
    if(region.areaPixels<80) continue;
    const center=region.xy.reduce((s,p)=>[s[0]+p[0]/region.xy.length,s[1]+p[1]/region.xy.length],[0,0]);
    const text=document.createElementNS('http://www.w3.org/2000/svg','text');
    text.setAttribute('x',x(center[0]));text.setAttribute('y',y(center[1]));text.setAttribute('text-anchor','middle');text.setAttribute('paint-order','stroke');text.setAttribute('stroke','#0a0e0b');text.setAttribute('stroke-width','3');text.textContent=`S${cluster+1}`;svg.append(text);
  }
}
async function redraw() {
  if(!manifest) return;
  const current=++revision;
  const alpha=Number($('alpha').value)/4;
  $('alpha-value').textContent=`${Math.round(alpha*100)}%`;
  const linear=alpha===0?'semantic':alpha===1?'geography':`linear_${alpha}`;
  const selections={linear,joint:`joint_${$('lambda').value}`,previous:$('projection').value};
  $('projection-caption').textContent=$('projection').value==='geography'
    ? 'The geographic XY positions used by the current atlas map.'
    : `PCA projection retains ${(manifest.projection3dTo2dVariance*100).toFixed(1)}% of the existing 3D variance.`;
  $('status').textContent='Updating comparison…';
  const loaded=await Promise.all(Object.entries(selections).map(async ([id,key])=>{
    const layer=manifest.layouts.find(l=>l.id===key);
    return {id,layer,points:new Float32Array(await get(layer.bin,'binary')),regions:await get(layer.regions[$('bandwidth').value])};
  }));
  if(current!==revision) return;
  // The same axis frame across all three panels makes compression/expansion visible.
  const joined = new Float32Array(loaded.reduce((n,l)=>n+l.points.length,0));
  let offset=0;for(const l of loaded){joined.set(l.points,offset);offset+=l.points.length;}
  const area=frame(joined);
  for(const {id,layer,points,regions} of loaded) {
    drawPoints(id,points,area);drawRegions(id,regions,area);
    const m=layer.metrics;
    $(`metrics-${id}`).innerHTML=`Semantic 10-NN recall <b>${(m.semanticRecall10*100).toFixed(1)}%</b> · geographic 10-NN recall <b>${(m.geographicRecall10*100).toFixed(1)}%</b><br>Geographic displacement RMS <b>${m.geographyDisplacementRmsKm.toFixed(2)} km</b>`;
  }
  $('status').textContent=`${manifest.rows.toLocaleString()} points per panel · every panel uses the same source rows · ${manifest.diagnosticQueries} exact diagnostic queries`;
}
async function initialize() {
 try {
  manifest=await get('manifest.json');
  [nativeColors,groups]=await Promise.all([get('colors.rgb','binary').then(b=>new Uint8Array(b)),get('clusters.bin','binary').then(b=>new Uint16Array(b))]);
  if(nativeColors.length!==manifest.rows*3||groups.length!==manifest.rows) throw new Error('Inconsistent point/color rows');
  $('scope').textContent=`${manifest.rows.toLocaleString()} panoramas · historical BNG central ${manifest.selection.halfSideMeters*2/1000} × ${manifest.selection.halfSideMeters*2/1000} km test extent · raw 8 × 4096D → existing global PCA64`;
  for(const id of ['alpha','lambda','bandwidth','colors','projection']) $(id).addEventListener('input',()=>redraw().catch(showError));
  new ResizeObserver(()=>redraw().catch(showError)).observe(document.querySelector('.panels'));
  await redraw();
 } catch(error) { showError(error); }
}
function showError(error) {$('status').setAttribute('role','alert');$('status').textContent=`Cannot load experiment: ${escape(error.message)}`;}
void initialize();
