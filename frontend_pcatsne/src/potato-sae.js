const root='./data/london_sae_20261003/';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function saeInspector({activate,onSelect,onFocus,isAligned}){
  let data,selected,loading,currentFeature,request=0;
  const panel=document.createElement('aside');
  panel.className='sae-panel';panel.setAttribute('aria-label','Bubble semantics');
  panel.innerHTML=`<div class="sae-heading"><strong>Bubble semantics</strong><button id="sae-close" aria-label="Close interpretations">×</button></div>
    <p class="sae-caution">Click a potato bubble to see its visual meaning and supporting street views.</p>
    <div id="sae-summary" role="status">Loading bubble explanations…</div>
    <label class="sae-filter">Find a bubble<input id="sae-search" type="search" placeholder="Search description, feature or S group" disabled></label>
    <label class="sae-filter">Independent bubble<select id="sae-bubbles" aria-label="Evidence selection" disabled><option value="">Choose a bubble on the map</option></select></label>
    <div class="sae-nav"><button id="sae-prev" disabled>Previous</button><button id="sae-next" disabled>Next</button><a href="${root}report.md" target="_blank" rel="noopener">All explanations</a></div>
    <div id="sae-alignment" role="status"></div>
    <p id="sae-group-status" class="sae-meta" role="status"></p>
    <button id="sae-restore" class="sae-explore" hidden>Restore interpreted bubbles</button>
    <button id="sae-focus" class="sae-explore" hidden>Zoom to selected bubble</button>
    <article id="sae-detail"><h2>Select a bubble</h2><p>Each semantic bubble has its own reviewed description. A bubble can contain several visual features.</p></article>`;
  document.getElementById('app').append(panel);
  const $=id=>panel.querySelector('#'+id);
  $('sae-close').onclick=()=>{request++;panel.hidden=true;onSelect(null);};
  function options(){
    if(!data)return;
    const q=$('sae-search').value.trim().toLowerCase();
    const rows=data.bubbles.filter(b=>`${b.id} s${b.group} ${b.interpretation.title} ${b.interpretation.description} ${b.features.map(f=>`f${f.feature_id} ${f.interpretation.title}`).join(' ')}`.toLowerCase().includes(q));
    $('sae-bubbles').innerHTML='<option value="">Choose a bubble on the map</option>'+rows.map(b=>`<option value="${escape(b.id)}">${escape(b.id)} · S${b.group} · ${escape(b.interpretation.title)}</option>`).join('');
    $('sae-bubbles').value=rows.some(b=>b.id===selected)?selected:'';
    $('sae-summary').textContent=q?`${rows.length} matching bubbles`:`${data.bubbles.length} reviewed semantic bubbles · central 20 × 20 km`;
    $('sae-prev').disabled=!rows.length;$('sae-next').disabled=!rows.length;
  }
  function alignment(){
    const aligned=isAligned();
    $('sae-alignment').textContent=aligned?'Explained geometry: 500 m smoothing · 100% density · 80 m separation · parks ≥ 3 ha':'Geometry changed. Stored explanations apply only to the original 500 m bubbles.';
    $('sae-restore').hidden=aligned;
    $('sae-focus').hidden=(!currentFeature&&!selected)||(!aligned&&!!selected);
  }
  function prompt(){currentFeature=null;onSelect(null);$('sae-focus').hidden=true;$('sae-detail').innerHTML='<h2>Select a bubble</h2><p>Click a bubble on the map to read its semantic description.</p>';}
  function show(id){
    const b=data?.bubbles.find(b=>b.id===id);if(!b)return;
    selected=id;currentFeature=null;
    const it=b.interpretation;
    const status=b.status==='supported'?'Interior image evidence':b.status==='limited_evidence'?'Limited interior evidence':'No interior evidence';
    $('sae-detail').innerHTML=`<h2>${escape(it.title)}</h2><p>${escape(it.description)}</p>
      <p class="sae-meta">Bubble ${escape(b.id)} · S${b.group} · ${b.area_km2.toFixed(3)} km²<br>${escape(it.confidence)} confidence · ${status}<br>${b.inside_panoramas.toLocaleString()} interior panoramas · ${b.matching_panoramas.toLocaleString()} matching group</p>
      ${b.board?`<a href="${root+b.board}" target="_blank" rel="noopener"><img class="sae-board" src="${root+b.board}" alt="Representative street views inside bubble ${escape(b.id)}"></a>`:''}
      <ul>${(Array.isArray(it.evidence)?it.evidence:[it.evidence]).map(v=>`<li>${escape(v)}</li>`).join('')}</ul><p class="sae-caution">${escape(it.uncertainty)}</p>
      <p class="sae-caution">Candidate description from independent agent image review; not a human annotation. Analysis uses ${escape(b.sample_basis)}.</p>
      ${b.features.length?`<h3>Supporting visual features</h3>${b.features.map(f=>`<details class="sae-feature"><summary>F${f.feature_id} · ${escape(f.interpretation.title)}<small>${f.activation_enrichment.toFixed(2)}× city mean · ${(f.view_prevalence*100).toFixed(1)}% of analysed views · ${escape(f.interpretation.confidence)} confidence</small></summary>
        <p>${escape(f.interpretation.description)}</p><a href="${root+f.board}" target="_blank" rel="noopener"><img loading="lazy" class="sae-board" src="${root+f.board}" alt="Feature ${f.feature_id}: high activation examples on top; random controls below"></a>
        <p class="sae-caution">Top row: high activation. Bottom row: random controls. ${escape(f.interpretation.uncertainty)}</p></details>`).join('')}`:''}`;
    $('sae-bubbles').value=id;alignment();onSelect(isAligned()?id:null);panel.scrollTop=0;
    if(!isAligned())$('sae-detail').innerHTML='<h2>Geometry changed</h2><p>Restore interpreted bubbles to read this bubble’s explanation.</p>';
  }
  function showCurrent(feature,park=false){
    selected=null;currentFeature=feature;options();
    const p=feature.properties;
    $('sae-detail').innerHTML=park?`<h2>Park / green space</h2><p>A geographic green-space bubble derived from OpenStreetMap park polygons.</p><p class="sae-meta">${Number(p.areaKm2).toFixed(3)} km² display footprint</p><p class="sae-caution">This GIS region has no SAE semantic assignment.</p>`:
      `<h2>Semantic group S${Number(p.group)}</h2><p>This bubble uses a different geometry from the reviewed set. Restore interpreted bubbles to inspect their individual semantic descriptions.</p><p class="sae-meta">${Number(p.areaKm2).toFixed(3)} km² display footprint<br>${Number(p.matchingPoints).toLocaleString()} matching panoramas inside</p>`;
    alignment();onSelect(null,feature);panel.scrollTop=0;
  }
  $('sae-search').oninput=options;
  $('sae-bubbles').onchange=()=>{if($('sae-bubbles').value)show($('sae-bubbles').value);};
  function step(delta){const s=$('sae-bubbles');s.selectedIndex=Math.max(1,Math.min(s.options.length-1,s.selectedIndex+delta));show(s.value);}
  $('sae-prev').onclick=()=>step(-1);$('sae-next').onclick=()=>step(1);
  $('sae-restore').onclick=()=>void activate().then(()=>{if(selected)show(selected);else prompt();}).catch(error=>{$('sae-alignment').textContent=error.message;});
  $('sae-focus').onclick=()=>onFocus(selected,currentFeature);
  async function load(){
    if(data)return data;
    loading??=fetch(root+'bubble-interpretations.json').then(r=>{if(!r.ok)throw new Error(`Bubble explanations unavailable (HTTP ${r.status})`);return r.json();}).then(value=>{
      data=value;$('sae-search').disabled=false;$('sae-bubbles').disabled=false;options();alignment();return data;
    }).catch(error=>{loading=null;$('sae-summary').textContent=error.message;throw error;});
    return loading;
  }
  return {
    async open(feature,park=false){
      const version=++request;panel.hidden=false;await load();if(version!==request)return;
      $('sae-search').value='';options();
      const id=String(feature.id);
      if(!park&&isAligned()&&data.bubbles.some(b=>b.id===id))show(id);else showCurrent(feature,park);
    },
    async explore(){panel.hidden=false;await load();await activate();if(selected)show(selected);},
    async initialize(){await load();},
    update(){alignment();if(!isAligned()){onSelect(null);if(selected)$('sae-detail').innerHTML='<h2>Geometry changed</h2><p>Restore interpreted bubbles to read the selected bubble’s explanation. Its stored label is not assigned to the new shape.</p>';else if(currentFeature)prompt();}else if(selected)show(selected);else if(currentFeature)prompt();},
  };
}
