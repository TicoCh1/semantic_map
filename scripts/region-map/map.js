/* Presentation only: all PCA scores and selection calibrations are embedded. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const meta = JSON.parse($('metadata').textContent);
  const product = meta.aggregation === 'axis_product';
  const n = meta.point_count;
  const targetCity = ({rome:'Rome',london:'London'}[meta.target_dataset_id?.split('_')[0]] || meta.target_dataset_id?.split('_')[0] || 'Rome');
  const origin = meta.bounds[0].map((value,i)=>(value+meta.bounds[1][i])/2);
  const mercator = (lon, lat) => [(lon + 180) / 360,
    (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2];
  const originWorld = mercator(...origin);
  let mask = 255, cutoff = 128, opacity = .85, footprint = 50, context = true;
  let colourMode = product ? 'percentile' : 'fixed', colourBounds = [0, 255];
  const colourLookup = new Uint8Array(256 * 4);
  let coordinates, ids, atlas, positions, values, map, popup;
  let currentLayer = null;
  let ready = false, basemapVersion = 0;
  const labels = active => active.length === 8 ? 'PCA 1–8' : active.map(axis => `PCA ${axis}`).join(' + ');
  const activeAxes = () => Array.from({length: 8}, (_, i) => i + 1).filter(axis => mask & (1 << (axis - 1)));
  const binLabel = bin => (bin / 256).toFixed(2);
  $('total').textContent = n.toLocaleString('en-US');
  $('colour-scale').value = colourMode;
  const totalAxisVariance = meta.axis_variances.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 8; i++) {
    const row = document.createElement('div');
    row.className = 'axis';
    const variance = meta.axis_variances[i] / totalAxisVariance * meta.explained_variance_fraction * 100;
    row.innerHTML = `<input type="checkbox" id="axis-${i}" checked aria-label="Include PCA ${i + 1}"><label for="axis-${i}">PCA ${i + 1}<small>${variance.toFixed(2)}% variance</small></label><button type="button" aria-label="Show only PCA ${i + 1}">Only</button>`;
    row.querySelector('input').addEventListener('change', event => {
      if (event.target.checked) mask |= 1 << i; else mask &= ~(1 << i);
      updateSelection();
    });
    row.querySelector('button').addEventListener('click', () => { mask = 1 << i; updateSelection(); });
    $('axes').append(row);
  }
  $('all').addEventListener('click', () => {mask = 255; updateSelection();});
  $('minimum').addEventListener('input', () => {cutoff = Number($('minimum').value); updateDisplay();});
  for (const button of document.querySelectorAll('[data-cut]')) button.addEventListener('click', () => {
    cutoff = Number(button.dataset.cut); $('minimum').value = cutoff; updateDisplay();
  });
  $('opacity').addEventListener('input', () => {opacity = Number($('opacity').value) / 100; updateDisplay();});
  $('footprint').addEventListener('input', () => {footprint = Number($('footprint').value); updateDisplay();});
  $('context').addEventListener('change', () => {context = $('context').checked; updateDisplay();});
  $('colour-scale').addEventListener('change', () => {colourMode = $('colour-scale').value; updateDisplay();});
  $('fit').addEventListener('click', () => map?.fitBounds(meta.bounds, {padding: 65, duration: 500}));
  $('basemap').addEventListener('change', () => setBasemap($('basemap').value));
  const regions = meta.regions?.features || [];
  if (!regions.length) $('candidate-section').hidden = true;
  for (const feature of regions) {
    const p=feature.properties, option=document.createElement('option');
    option.value=String(p.rank);option.textContent=`${p.rank} · score ${p.score.toFixed(5)} · ${p.center[1].toFixed(4)}, ${p.center[0].toFixed(4)}`;
    $('candidate').append(option);
  }
  $('candidate').addEventListener('change',()=>{
    popup?.remove();
    applyCandidate();
    const region=regions.find(f=>String(f.properties.rank)===$('candidate').value);
    if(region)map?.easeTo({center:region.properties.center,zoom:14.4,duration:500});
    else map?.fitBounds(meta.bounds,{padding:65,duration:500});
  });
  function applyCandidate(){
    const selected=mask===255?regions.find(f=>String(f.properties.rank)===$('candidate').value):null;
    const source=map?.getSource('candidate-area');
    source?.setData({type:'FeatureCollection',features:selected?[{type:'Feature',geometry:selected.geometry,properties:{}}]:[]});
    $('candidate').disabled=mask!==255;
    $('candidate-note').textContent=mask!==255?'Candidate ranking uses all eight axes. Select all 8 to inspect it.':selected?`Rank ${selected.properties.rank} · score ${selected.properties.score.toFixed(5)} · relative ranking, not probability`:`${product?'Product-based':'Original'} all-eight-axis ranking · approximate shortlist`;
  }

  function updateSelection() {
    for (let i = 0; i < 8; i++) $(`axis-${i}`).checked = !!(mask & (1 << i));
    const axes = activeAxes();
    $('selection').textContent = axes.length ? `${axes.length} ${axes.length === 1 ? 'axis' : 'axes'} · ${product?'fixed factors · direct product':'equal normalized weights'}` : 'Select at least one axis';
    $('map-selection').textContent = axes.length ? `${labels(axes)} / ${axes.length === 1 ? 'individual' : product?'product':'joint'} intensity` : 'No PCA axes selected';
    const axis = axes[0] - 1;
    $('response-note').textContent = axes.length === 1 && meta.axis_raw_means ? `Source raw response: mean ${meta.axis_raw_means[axis].toFixed(3)}, std ${meta.axis_source_stds[axis].toFixed(3)}. Intensity peaks at this mean; displayed intensity is not raw cosine.` : product && axes.length ? 'Joint intensity is at most each contributing single-axis intensity.' : '';
    if (ready) {
      for (let i = 0; i < n; i++) values[i] = mask ? atlas[i * 255 + mask - 1] : 0;
      currentLayer?.upload();
    }
    popup?.remove();
    applyCandidate();
    updateDisplay();
  }
  function updateDisplay() {
    $('minimum-value').textContent = binLabel(cutoff);
    $('opacity-value').textContent = `${Math.round(opacity * 100)}%`;
    $('footprint-value').textContent = `${footprint} m`;
    const subset = meta.subsets[String(mask)];
    const visible = subset ? subset.histogram.slice(cutoff).reduce((a, b) => a + b, 0) : 0;
    // Presentation bounds come from the already-computed atlas histogram.
    // Raw scores, filtering and geographic ranking are never rescaled here.
    colourBounds = [0, 255];
    if (colourMode !== 'fixed' && visible) {
      const histogram = subset.histogram;
      let low = cutoff, high = 255;
      while (!histogram[low]) low++;
      while (!histogram[high]) high--;
      colourBounds = [low, high];
    }
    // Histogram equalization for display only. Equal stored values share a
    // midrank; occupied end bins map exactly to the two ends of the ramp.
    colourLookup.fill(128);
    if (colourMode === 'percentile' && visible && colourBounds[0] !== colourBounds[1]) {
      const histogram=subset.histogram, [low,high]=colourBounds;
      const first=histogram[low]/2, last=visible-histogram[high]/2;
      let cumulative=0;
      for(let bin=low;bin<=high;bin++){
        const rank=cumulative+histogram[bin]/2;
        const coordinate=Math.round(255*Math.max(0,Math.min(1,(rank-first)/(last-first))));
        for(let channel=0;channel<3;channel++)colourLookup[bin*4+channel]=coordinate;
        colourLookup[bin*4+3]=255;
        cumulative+=histogram[bin];
      }
    }
    currentLayer?.uploadColours();
    const colourLabel = bin => ((bin + .5) / 256).toFixed(3);
    $('colour-low').textContent = colourMode === 'percentile' && visible ? '0% · lowest rank' : `${colourMode === 'fixed' ? '0' : visible ? colourLabel(colourBounds[0]) : '—'} · weaker fit`;
    $('colour-high').textContent = colourMode === 'percentile' && visible ? '100% · highest rank' : `${colourMode === 'fixed' ? '1' : visible ? colourLabel(colourBounds[1]) : '—'} · stronger fit`;
    $('colour-note').textContent = colourMode === 'fixed' ? 'Fixed colours allow comparisons across axis selections. Thresholds use raw intensity.' : !visible ? 'No visible samples to stretch.' : colourBounds[0] === colourBounds[1] ? 'Visible scores share one stored value; shown at the ramp midpoint. Thresholds use raw intensity.' : colourMode === 'percentile' ? `Colours show relative rank among visible samples. Raw intensity range ${colourLabel(colourBounds[0])}–${colourLabel(colourBounds[1])}; thresholds and popups remain raw.` : 'Colour stretch only · current axes and threshold · all target samples. Raw intensity is unchanged.';
    $('visible').textContent = visible.toLocaleString('en-US');
    $('visible-detail').textContent = `${(visible / n * 100).toFixed(2)}% of ${targetCity} samples · intensity ≥ ${binLabel(cutoff)}`;
    if (ready) $('status').textContent = `${labels(activeAxes()) || 'No axes'} · ${visible.toLocaleString('en-US')} samples in range · precomputed on RunPod`;
    for (const button of document.querySelectorAll('[data-cut]')) button.setAttribute('aria-pressed', String(Number(button.dataset.cut) === cutoff));
    map?.triggerRepaint();
    // Compact inspectable state for UI checks; it contains no numerical scorer.
    window.regionMapState = {ready, mask, cutoff, visible, opacity, footprint, sampleCount: n, colourMode, colourBounds: [...colourBounds], colourEndpoints: colourBounds.map(bin=>colourLookup[bin*4])};
  }

  function compile(gl, type, code) {
    const shader = gl.createShader(type); gl.shaderSource(shader, code); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function makeLayer() {
    const layer = {
      id: 'pca-intensity', type: 'custom', renderingMode: '2d',
      onAdd(_map, gl) {
        this.gl = gl;
        const vertex = compile(gl, gl.VERTEX_SHADER, `precision highp float;
          attribute vec2 a_position; attribute float a_intensity;
          uniform mat4 u_matrix; uniform float u_size; varying float v_intensity;
          void main(){gl_Position=u_matrix*vec4(a_position,0.,1.);gl_PointSize=u_size;v_intensity=a_intensity;}`);
        const fragment = compile(gl, gl.FRAGMENT_SHADER, `precision highp float;
          uniform float u_minimum; uniform float u_opacity; uniform float u_pass; uniform float u_enabled;
          uniform float u_colour_min; uniform float u_colour_max; uniform float u_colour_stretch;
          uniform sampler2D u_colour_lut;
          varying float v_intensity;
          vec3 ramp(float t){
            vec3 a=vec3(.208,.204,.416),b=vec3(.196,.408,.725),c=vec3(.039,.655,.706),d=vec3(.396,.780,.549),e=vec3(.945,.906,.471);
            if(t<.25)return mix(a,b,t*4.);if(t<.5)return mix(b,c,(t-.25)*4.);if(t<.75)return mix(c,d,(t-.5)*4.);return mix(d,e,(t-.75)*4.);
          }
          void main(){
            float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
            float edge=1.-smoothstep(.78,1.,r);float alpha=u_opacity*edge;
            if(u_pass<.5){gl_FragColor=vec4(vec3(.46,.50,.53),edge*.10);}
            else{
              if(u_enabled<.5||v_intensity+0.00001<u_minimum)discard;
              float score=v_intensity*255.;float t=min((score+.5)/256.,1.);
              if(u_colour_stretch>1.5)t=texture2D(u_colour_lut,vec2((score+.5)/256.,.5)).r;
              else if(u_colour_stretch>.5){float span=u_colour_max-u_colour_min;t=span>.5?clamp((score-u_colour_min)/span,0.,1.):.5;}
              gl_FragColor=vec4(ramp(t),alpha);
            }
          }`);
        this.program = gl.createProgram(); gl.attachShader(this.program, vertex); gl.attachShader(this.program, fragment); gl.linkProgram(this.program);
        gl.deleteShader(vertex); gl.deleteShader(fragment);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
        this.positionBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer); gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        this.valueBuffer = gl.createBuffer();
        this.positionAttribute = gl.getAttribLocation(this.program, 'a_position');
        this.valueAttribute = gl.getAttribLocation(this.program, 'a_intensity');
        this.uniforms = Object.fromEntries(['matrix','size','minimum','opacity','pass','enabled','colour_min','colour_max','colour_stretch','colour_lut'].map(key => [key, gl.getUniformLocation(this.program, `u_${key}`)]));
        this.colourTexture=gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.colourTexture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        currentLayer = this; this.upload(); this.uploadColours();
      },
      upload() {const gl = this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.valueBuffer);gl.bufferData(gl.ARRAY_BUFFER,values,gl.DYNAMIC_DRAW);},
      uploadColours(){const gl=this.gl;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.colourTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,colourLookup);},
      render(gl, matrix) {
        const translated = new Float32Array(matrix);
        // Translate in double precision before uploading, preserving street-scale accuracy.
        for (let i = 0; i < 4; i++) translated[12+i] = matrix[12+i]+matrix[i]*originWorld[0]+matrix[4+i]*originWorld[1];
        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.positionBuffer);gl.enableVertexAttribArray(this.positionAttribute);gl.vertexAttribPointer(this.positionAttribute,2,gl.FLOAT,false,0,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.valueBuffer);gl.enableVertexAttribArray(this.valueAttribute);gl.vertexAttribPointer(this.valueAttribute,1,gl.UNSIGNED_BYTE,true,0,0);
        gl.uniformMatrix4fv(this.uniforms.matrix,false,translated);
        const pixelRatio = map.getCanvas().width / map.getCanvas().clientWidth;
        const diameter = footprint / (40075016.6856 * Math.cos(origin[1] * Math.PI / 180)) * 512 * 2 ** map.getZoom();
        gl.uniform1f(this.uniforms.size,Math.max(2.2*pixelRatio,Math.min(64*pixelRatio,diameter*pixelRatio)));
        gl.uniform1f(this.uniforms.minimum,cutoff/255);gl.uniform1f(this.uniforms.opacity,opacity);
        gl.uniform1f(this.uniforms.enabled,mask?1:0);
        gl.uniform1f(this.uniforms.colour_min,colourBounds[0]);gl.uniform1f(this.uniforms.colour_max,colourBounds[1]);
        gl.uniform1f(this.uniforms.colour_stretch,colourMode==='percentile'?2:colourMode==='visible'?1:0);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.colourTexture);gl.uniform1i(this.uniforms.colour_lut,0);
        gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
        // Draw context first so faint excluded samples cannot obscure strong matches.
        if(context){gl.uniform1f(this.uniforms.pass,0);gl.drawArrays(gl.POINTS,0,n);}
        gl.uniform1f(this.uniforms.pass,1);gl.drawArrays(gl.POINTS,0,n);
      },
      onRemove(_map,gl){gl.deleteBuffer(this.positionBuffer);gl.deleteBuffer(this.valueBuffer);gl.deleteTexture(this.colourTexture);gl.deleteProgram(this.program);if(currentLayer===this)currentLayer=null;},
    };
    return layer;
  }
  const blankStyle = () => ({version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#edf1ef'}}]});
  function installLayers() {
    if (!ready) return;
    const features = [];
    const [lo,hi] = meta.bounds;
    for(let lon=Math.floor(lo[0]*10)/10;lon<=hi[0]+.1;lon+=.1)features.push({type:'Feature',geometry:{type:'LineString',coordinates:[[lon,lo[1]-.03],[lon,hi[1]+.03]]}});
    for(let lat=Math.floor(lo[1]*10)/10;lat<=hi[1]+.1;lat+=.1)features.push({type:'Feature',geometry:{type:'LineString',coordinates:[[lo[0]-.03,lat],[hi[0]+.03,lat]]}});
    if(!map.getSource('coordinate-grid'))map.addSource('coordinate-grid',{type:'geojson',data:{type:'FeatureCollection',features}});
    if(!map.getLayer('coordinate-grid'))map.addLayer({id:'coordinate-grid',type:'line',source:'coordinate-grid',paint:{'line-color':'#748a91','line-width':1,'line-opacity':.15,'line-dasharray':[2,3]}});
    if(!map.getLayer('pca-intensity'))map.addLayer(makeLayer());
    // Style diffing may preserve custom layers while removing ordinary overlays.
    // Restore each source/layer independently after every basemap style change.
    if(!map.getSource('candidate-area'))map.addSource('candidate-area',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    if(!map.getLayer('candidate-fill'))map.addLayer({id:'candidate-fill',type:'fill',source:'candidate-area',paint:{'fill-color':'#9d42ad','fill-opacity':.055}});
    if(!map.getLayer('candidate-outline'))map.addLayer({id:'candidate-outline',type:'line',source:'candidate-area',paint:{'line-color':'#9d42ad','line-width':2}});
    // Keep every basemap fill, road and label below the intensity points.
    // Candidate fill is also below points; only its boundary is drawn above.
    for(const id of ['coordinate-grid','candidate-fill','pca-intensity','candidate-outline'])map.moveLayer(id);
    applyCandidate();
  }
  async function setBasemap(name) {
    const version=++basemapVersion;
    $('offline').hidden=true;
    // A full swap emits style.load consistently; style diffs do not emit it.
    // Rebuild the small display overlays on each explicit basemap switch.
    if(name==='none'){map.setStyle(blankStyle(),{diff:false});return;}
    try{
      const url=`https://tiles.openfreemap.org/styles/${name==='dark'?'dark':'positron'}`;
      const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const style=await response.json();
      if(version===basemapVersion)map.setStyle(style,{diff:false});
    }catch(error){if(version===basemapVersion){$('offline').hidden=false;map.setStyle(blankStyle(),{diff:false});}}
  }
  function inspect(event) {
    if(!mask)return;
    const point=mercator(event.lngLat.lng,event.lngLat.lat);
    const x=point[0]-originWorld[0],y=point[1]-originWorld[1];
    let nearest=-1,distance=Infinity;
    for(let i=0;i<n;i++){
      if(values[i]<cutoff)continue;
      const dx=positions[2*i]-x,dy=positions[2*i+1]-y,d=dx*dx+dy*dy;
      if(d<distance){nearest=i;distance=d;}
    }
    if(nearest<0||Math.sqrt(distance)*512*2**map.getZoom()>Math.max(10,footprint/(40075016.6856*Math.cos(origin[1]*Math.PI/180))*512*2**map.getZoom()/2))return;
    const lon=coordinates[2*nearest],lat=coordinates[2*nearest+1];
    const rows=Array.from({length:8},(_,j)=>`<div class="${mask&(1<<j)?'selected':''}"><span>PCA ${j+1}</span><span>${((atlas[nearest*255+(1<<j)-1]+.5)/256).toFixed(3)}</span></div>`).join('');
    popup?.remove();
    popup=new maplibregl.Popup({maxWidth:'280px'}).setLngLat([lon,lat]).setHTML(`<div class="popup-title">${targetCity} sample ${ids[nearest]}</div><div class="popup-score">${((values[nearest]+.5)/256).toFixed(3)} joint intensity</div><div class="popup-coords">${lat.toFixed(6)}, ${lon.toFixed(6)} · <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" rel="noopener noreferrer">Open location</a></div><div class="popup-axes">${rows}</div><div class="popup-note">Individual axes are separately calibrated.<br>Highlighted axes contribute to the selected joint fit.</div>`).addTo(map);
  }
  async function boot() {
    if(typeof DecompressionStream==='undefined')throw new Error('Please open this file in a current Chrome or Edge browser.');
    const encoded=$('payload').textContent.trim();
    const compressed=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const buffer=await new Response(stream).arrayBuffer();
    if(buffer.byteLength!==meta.payload_bytes||meta.score_order!=='point-major')throw new Error('Invalid saved atlas layout');
    coordinates=new Float64Array(buffer,0,n*2);ids=new Float64Array(buffer,n*16,n);atlas=new Uint8Array(buffer,n*24,n*255);
    positions=new Float32Array(n*2);values=new Uint8Array(n);
    for(let i=0;i<n;i++){const xy=mercator(coordinates[i*2],coordinates[i*2+1]);positions[2*i]=xy[0]-originWorld[0];positions[2*i+1]=xy[1]-originWorld[1];values[i]=atlas[i*255+254];}
    $('payload').remove();$('metadata').remove();
    map=new maplibregl.Map({container:'map',style:blankStyle(),center:origin,zoom:11.2,pitch:0,bearing:0,dragRotate:false,renderWorldCopies:false,attributionControl:false});
    map.touchZoomRotate.disableRotation();map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    map.addControl(new maplibregl.ScaleControl({maxWidth:110,unit:'metric'}),'bottom-left');
    map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'Intensity data: UrbanFabric'}),'bottom-right');
    ready=true;
    map.on('style.load',installLayers);map.on('load',()=>map.fitBounds(meta.bounds,{padding:60,duration:0}));
    map.on('click',inspect);
    window.regionMapView = () => ({candidate:$('candidate').value,
      candidateSourceLoaded:!!map.getSource('candidate-area')&&map.isSourceLoaded('candidate-area'),
      renderedCandidateFeatures:map.getLayer('candidate-outline')?map.queryRenderedFeatures({layers:['candidate-outline']}).length:0,
      sourceFeatureCount:map.getStyle().sources['candidate-area']?.data?.features?.length,
      candidateLayers:map.getStyle().layers.filter(layer=>layer.id.startsWith('candidate-')).map(layer=>layer.id),
      layerOrder:map.getLayersOrder().map(id=>({id,type:map.getLayer(id).type})),
      center:map.getCenter().toArray(),zoom:map.getZoom()});
    map.on('error',event=>{if(event.error?.message?.includes('Failed to fetch'))$('offline').hidden=false;});
    updateSelection();
    await setBasemap($('basemap').value);
  }
  updateSelection();
  boot().catch(error=>{$('status').textContent=`Could not load map: ${error.message}`;$('status').style.color='#b22';console.error(error);});
})();
