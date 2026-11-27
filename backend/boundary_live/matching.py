"""GPU boundary matching on the immutable Center4 descriptor/atlas release."""
from functools import cached_property
from pathlib import Path
import json
import os

import numpy as np
import torch
from engine import C, D, City, VARS, gpu, local, pool
from compute import groups

ROOT = D.parent / "atlas_150m_release"
BUILD = ROOT / "build"
WORK = Path(__file__).resolve().parent
FIXED = WORK / os.environ.get("BOUNDARY_FIXED_DIR", "fixed_v3")


class Target:
    def __init__(self, city):
        self.name = city
        self.data = City(city)
        self.white = np.load(D / "cache" / f"{city}_white.npy", mmap_mode="r")
        self.centers = self.data.xy[np.load(BUILD / f"{city}_rep.npy")]
        self.ll = np.fromfile(ROOT / "city" / f"{city}.bin", "<i4").reshape(-1, 2) / 1e5

    @cached_property
    def windows(self):
        return groups(self.data, self.centers)

    @cached_property
    def descriptors(self):
        features = np.load(D / "cache" / f"{self.name}_full.npy", mmap_mode="r")
        return torch.as_tensor(features, device="cuda", dtype=torch.bfloat16)

    def source(self, ids):
        xy = self.data.xy[ids]
        w = self.data.area[ids].astype("f4")
        return local((ids, gpu((xy - xy.mean(0)).astype("f4")), gpu(w / w.sum())), self.white, VARS["base"])

    def score(self, source):
        q, w = source
        sim = (self.descriptors @ q.T).float()
        out = np.empty(len(self.centers), "f4")
        for order, ids, weights in self.windows:
            size = max(1, 1200000 // (len(q) * ids.shape[1]))
            for start in range(0, len(order), size):
                sl = slice(start, start + size)
                out[order[sl]] = pool(sim[ids[sl]].transpose(1, 2), w[None], weights[sl], .2).cpu().numpy()
        if not np.isfinite(out).all():
            raise RuntimeError("Nonfinite score")
        return out


def pack(path, query, fields, excluded, targets):
    background = np.sort(np.concatenate([fields[k][~excluded[k]] for k in C]).astype("f8"))
    mean, sd = float(background.mean()), float(background.std())
    if sd <= 0:
        raise ValueError("No score variation")
    foreign = np.concatenate([fields[k] for k in C if k != query["city"]]).astype("f8")
    lo, hi = float(foreign.min()), float(foreign.max())
    query.update(reference=len(background), mean=mean, sd=sd, smart_range={
        "sim_z":dict(lower=(lo-mean)/sd, upper=(hi-mean)/sd), "sim_raw":dict(lower=lo, upper=hi)}, targets={})
    tmp = path.with_suffix(".part")
    with tmp.open("wb") as f:
        for k in C:
            target, values, own = targets[k], fields[k], excluded[k]
            pct = (np.searchsorted(background, values, "left") + np.searchsorted(background, values, "right")) * (50 / len(background))
            values.astype("<f4").tofile(f)
            (np.rint(100*pct).astype("<u2") | (own.astype("<u2") << 15)).tofile(f)
            hits, centers = [], []
            for i in np.argsort(-values, kind="stable"):
                xy = target.centers[i]
                if own[i] or any(np.linalg.norm(xy-p)<600 for p in centers):
                    continue
                centers.append(xy)
                val = float(values[i])
                hits.append(dict(rank=len(centers), coordinates=target.ll[i].tolist(), sim_z=(val-mean)/sd,
                                 sim_raw=val, sim_pct=float(pct[i]), district="", nearest_landmark="", dist_m=0,
                                 dist_from_source_m=None, top_shared_themes=[]))
                if len(hits)==5: break
            query["targets"][k] = dict(hits=hits, eligible=int((~own).sum()), hot=int(((values>=mean+2*sd)&~own).sum()))
    tmp.replace(path)
    return query


def circle_outline(city, center, ids):
    """An inscribed polygon with the exact capture membership of the 150 m disk."""
    from shapely import Polygon, contains_xy
    angles = np.arange(32)*np.pi/16
    def vertices():
        return center + 150*np.column_stack((np.cos(angles),np.sin(angles)))
    captures = city.xy[ids]
    missing = captures[~contains_xy(Polygon(vertices()), *captures.T)] - center
    if len(missing):
        angles = np.unique(np.sort(np.r_[angles, np.arctan2(missing[:,1],missing[:,0]) % (2*np.pi)]))
    assert len(angles)<=64 and contains_xy(Polygon(vertices()), *captures.T).all()
    ring = city.geo(vertices()).tolist()
    return [ring+[ring[0]]]


def main():
    """Rebuild the named regions and all associated scores without changing the published atlas."""
    from atlas_export import Geography
    from engine import O
    import time
    start = time.monotonic()
    anchors = json.loads((WORK / "boundary-anchors.json").read_text())
    index = json.loads((ROOT / "index.json").read_text())
    targets = {k:Target(k) for k in C}
    refs = json.loads((O/"references.json").read_text())
    refs["new_york"] = {**json.loads((O/"lpc_points.json").read_text()), **refs["new_york"]}
    geos = {k:Geography(k,t.data,refs[k]) for k,t in targets.items()}
    queries = []
    audit = []
    catalog = [r["prompt"] for r in json.loads((ROOT/"precheck/catalog.json").read_text())]
    scores = {k:np.load(ROOT/"precheck"/k/"catalog_z.npy",mmap_mode="r") for k in C}
    def theme(k, xy):
        ids=targets[k].data.nodes(xy,150)
        return np.average(scores[k][ids].astype("f4"),axis=0,weights=targets[k].data.area[ids])
    for old in index["queries"]:
        k, key = old["city"], old["id"]
        target, anchor = targets[k], anchors[key]
        city = target.data
        at = np.array(city.proj.transform(*anchor["xy"]))
        xy = at.copy()
        ids = city.nodes(xy,150)
        for step in range(5,126,5):
            if len(ids)>=8: break
            angles=np.arange(32)*np.pi/16
            offsets=at+step*np.column_stack((np.cos(angles),np.sin(angles)))
            candidates=[(len(ix),j,ix) for j,pt in enumerate(offsets) if len(ix:=city.nodes(pt,150))>=8]
            if candidates:
                _,j,ids=max(candidates,key=lambda a:a[0]);xy=offsets[j]
        if len(ids)<3: raise ValueError(f"{key}: only {len(ids)} captures near anchor")
        coordinates=city.geo(xy[None])[0].tolist()
        old_xy=np.array(city.proj.transform(*old["coordinates"]))
        audit.append(dict(id=key,anchor=anchor["anchor"],url=anchor["url"],anchor_xy=anchor["xy"],old=old["coordinates"],actual=coordinates,
                          old_to_anchor_m=float(np.linalg.norm(old_xy-at)),new_to_anchor_m=float(np.linalg.norm(xy-at)),
                          shift_m=float(np.linalg.norm(old_xy-xy)),nodes=len(ids)))
        query=dict(old,coordinates=coordinates,area=circle_outline(city,xy,ids),nodes=len(ids),shift_m=float(np.linalg.norm(xy-at)),
                   anchor=anchor["anchor"],anchor_url=anchor["url"],anchor_coordinates=anchor["xy"])
        # District labels describe a 150 m sample around the named, verifiable representative point.
        if np.linalg.norm(old_xy-at)>150: query["name"]=old["name"].split(" / ")[0]+" · "+anchor["anchor"]
        src=theme(k,xy)
        query["themes"]=[catalog[j] for j in np.argsort(-src)[:3]]
        queries.append((query,target.source(ids),xy,src))
    (FIXED/"query").mkdir(parents=True,exist_ok=True)
    (FIXED/"audit.json").write_text(json.dumps(audit,indent=2))
    fields={q["id"]:{} for q,*_ in queries}
    for k,t in targets.items():
        for q,A,_,_ in queries:fields[q["id"]][k]=t.score(A)
        del t.descriptors
        print("scores complete",k,round(time.monotonic()-start),flush=True)
    for q,A,xy,src in queries:
        exc={k:np.linalg.norm(t.centers-xy,axis=1)<300 if k==q["city"] else np.zeros(len(t.centers),bool) for k,t in targets.items()}
        pack(FIXED/"query"/(q["id"]+".bin"),q,fields[q["id"]],exc,targets)
        for k,t in targets.items():
            for h in q["targets"][k]["hits"]:
                center=np.array(t.data.proj.transform(*h["coordinates"]))
                dist,near,meters=geos[k].where(h["coordinates"],center)
                h.update(district=dist,nearest_landmark=near,dist_m=meters,dist_from_source_m=float(np.linalg.norm(center-xy)) if k==q["city"] else None,
                         top_shared_themes=[catalog[i] for i in np.argsort(-np.minimum(src,theme(k,center)))[:3]])
    index.update(version="atlas150-geocheck-v3",queries=[q for q,*_ in queries])
    p=FIXED/"index.part";p.write_text(json.dumps(index,separators=(",",":"),allow_nan=False));p.replace(FIXED/"index.json")
    print("published",len(queries),round(time.monotonic()-start),flush=True)

if __name__=="__main__": main()
