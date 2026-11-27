"""Validate geometry and complete saved score fields before the local gateway selects a release."""
import json
from pathlib import Path
import numpy as np
from pyproj import Transformer
from shapely import Polygon, Point, contains_xy

work=Path(__file__).resolve().parent
fixed=work/"fixed_v3"
original=work.parent/"atlas_150m_release"
idx=json.loads((fixed/"index.json").read_text())
audit=json.loads((fixed/"audit.json").read_text())
assert len(idx["queries"])==len(audit)==40
zones={"london":32630,"rome":32633,"new_york":32618,"shanghai":32651}
ordered=list(zones)
centers={k:np.fromfile(original/"city"/(k+".bin"),"<i4").reshape(-1,2)/1e5 for k in zones}
projs={k:Transformer.from_crs(4326,s,always_xy=True) for k,s in zones.items()}
source_rows={k:np.load(original/"precheck"/k/"positions.npy",mmap_mode="r") for k in zones}
def project(k,ll):
    return np.column_stack(projs[k].transform(*np.asarray(ll).T))
report=[]
for q,a in zip(idx["queries"],audit):
    key=q["id"];city=q["city"]
    assert key==a["id"] and q["nodes"]>=8
    polygon=Polygon(q["area"][0])
    assert polygon.is_valid and polygon.covers(Point(a["anchor_xy"]))
    xy=project(city,[q["coordinates"]])[0]
    radii=np.linalg.norm(project(city,q["area"][0])-xy,axis=1)
    assert np.abs(radii-150).max()<.5
    projected=project(city,source_rows[city][:,:2])
    disk=np.linalg.norm(projected-xy,axis=1)<=150
    assert disk.sum()==q["nodes"]
    assert np.array_equal(disk,contains_xy(Polygon(project(city,q["area"][0])),*projected.T))
    buf=(fixed/"query"/(key+".bin")).read_bytes()
    old=(original/"query"/(key+".bin")).read_bytes()
    assert len(buf)==len(old)==6*sum(idx["cities"].values())
    offset=0; foreign=[]; ref=[]; delta=[]
    for k in ordered:
        n=idx["cities"][k];v=np.frombuffer(buf,"<f4",n,offset);v0=np.frombuffer(old,"<f4",n,offset)
        flags=np.frombuffer(buf,"<u2",n,offset+4*n)
        assert np.isfinite(v).all() and (flags%32768<=10000).all()
        delta.append(float(np.abs(v-v0).max()))
        mask=flags<32768
        if k!=city:assert mask.all();foreign.extend([v.min(),v.max()])
        ref.append(v[mask]);offset+=6*n
        hits=q["targets"][k]["hits"]
        assert len(hits)==5
        hxy=project(k,[h["coordinates"] for h in hits])
        assert np.linalg.norm(hxy[:,None]-hxy,axis=2)[np.triu_indices(5,1)].min()>598
        assert abs(hits[0]["sim_raw"]-v[mask].max())<1e-7
        if k==city:assert np.linalg.norm(hxy-xy,axis=1).min()>=298
    assert np.allclose([min(foreign),max(foreign)],list(q["smart_range"]["sim_raw"].values()),rtol=0,atol=1e-8)
    r=np.concatenate(ref).astype("f8")
    assert abs(r.mean()-q["mean"])<1e-9 and abs(r.std()-q["sd"])<1e-9
    report.append(dict(**a,max_score_change=max(delta)))
(work/"fixed_v3/verification.json").write_text(json.dumps(report,indent=2))
print("PASS",len(report),sum(idx["cities"].values()),"outside_old",sum(r["old_to_anchor_m"]>150 for r in report),
      "new_max_offset",max(r["new_to_anchor_m"] for r in report),"capture_range",min(r["nodes"] for r in report),max(r["nodes"] for r in report))
