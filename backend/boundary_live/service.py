"""Loopback-only service for GPU matching of user-drawn WGS84 polygons."""
import json
import re
import sys
import time
import uuid
from threading import Lock
from typing import Literal
from functools import lru_cache

import numpy as np
import torch
from shapely import Polygon, contains_xy
from shapely.ops import transform
from matching import C, ROOT, WORK, Target, pack

# The existing CPU service's pure web dependencies are on the shared volume.
sys.path.append("/workspace/semantic_backend/cpu_map_runtime/lib/python3.12/site-packages")
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI(docs_url=None, redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=["https://ticoch1.github.io"],
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
lock = Lock()
targets = {}
# Distinct visible street functions. These are catalog500 prompt indices and
# expected prompt substrings; fail startup if the catalog changes underneath us.
CLASSES = {
    "residential": ("Residential blocks", "#bd87df", {19:"residential apartment",54:"residential apartment tower",104:"quiet residential",140:"predominantly residential"}),
    "commercial": ("Commercial frontage", "#ef9552", {115:"street-facing shopfront",124:"retail shopfronts",125:"restaurants",148:"office buildings"}),
    "parks": ("Parks and gardens", "#50ae73", {126:"public park"}),
    "civic": ("Civic spaces", "#e3c457", {14:"community venue",20:"educational",25:"cultural building",147:"museum"}),
    "waterfront": ("Waterfront", "#4daee4", {85:"river is visible",469:"waterfront promenade",488:"riverside or canal"}),
    "industrial": ("Industrial land", "#b77968", {15:"industrial manufacturing",24:"warehouse",264:"industrial yard"}),
}
DISPLAY = {key: (label, color) for key, (label, color, _) in CLASSES.items()}
DISPLAY["other"] = ("Other / low evidence", "#959ba0")
catalog=json.loads((ROOT/"precheck/catalog.json").read_text())
for name,(_,_,prompts) in CLASSES.items():
    assert all(text in catalog[j]["prompt"].lower() for j,text in prompts.items()), name


class Boundary(BaseModel):
    model_config=ConfigDict(extra="forbid",allow_inf_nan=False)
    city: Literal["london","rome","new_york","shanghai"]
    points: list[tuple[float,float]]=Field(min_length=3,max_length=64)
    theme: str | None=None
    theme_id: str | None=None


@app.on_event("startup")
def warm():
    for k in C:
        target=Target(k)
        target.descriptors
        target.windows
        targets[k]=target
        print("GPU ready",k,len(target.centers),flush=True)


@app.get("/ready")
def ready():
    return dict(online=True,device=torch.cuda.get_device_name(),centers=sum(len(t.centers) for t in targets.values()))


@lru_cache(maxsize=4)
def semantic(city):
    return np.load(ROOT/"precheck"/city/"catalog_z.npy",mmap_mode="r")


def analyze(b):
    coords=np.array(b.points)
    if np.any(abs(coords)>[180,90]) or len(set(b.points))!=len(coords):
        raise HTTPException(422,"Use distinct WGS84 corners.")
    city=targets[b.city].data
    poly=Polygon(list(zip(*city.proj.transform(*coords.T))))
    if not poly.is_valid or poly.is_empty or poly.area<1 or poly.area>16e6:
        raise HTTPException(422,"Use a non-crossing boundary up to 16 square kilometres.")
    lo,bt,hi,tp=poly.bounds
    candidates=np.flatnonzero(((city.xy>=[lo,bt])&(city.xy<=[hi,tp])).all(axis=1))
    ids=candidates[contains_xy(poly,*city.xy[candidates].T)]
    if len(ids)>2500:raise HTTPException(422,"Over 2,500 panoramas. Reduce the boundary.")
    z=semantic(b.city)[ids].astype("f4")
    # Within each theme average its two strongest city-standardized signals.
    evidence=np.column_stack([np.sort(z[:,list(prompts)],axis=1)[:,-2:].mean(1) for _,_,prompts in CLASSES.values()])
    labels=np.array([*CLASSES,"other"])
    assigned=np.where(evidence.max(1,initial=-np.inf)>=.5,evidence.argmax(1),len(CLASSES))
    weights=city.area[ids].astype("f8")
    shares=np.bincount(assigned,weights=weights,minlength=len(labels))/max(weights.sum(),1e-15)
    counts=np.bincount(assigned,minlength=len(labels))
    themes=[dict(id=str(labels[i]),label=DISPLAY[labels[i]][0],color=DISPLAY[labels[i]][1],coverage=float(shares[i]),count=int(counts[i]))
            for i in np.argsort(-shares,kind="stable") if counts[i]]
    points=[dict(xy=xy.tolist(),id=str(key),label=DISPLAY[key][0]) for xy,key in zip(city.ll[ids],labels[assigned])]
    return dict(count=len(ids),themes=themes,points=points),ids,labels[assigned],poly


@app.post("/analyze")
def inspect(b: Boundary):
    return analyze(b)[0]


def query_source(city, ids, selected):
    """Keep each panorama's full-boundary spatial context when selecting a class."""
    if not len(ids) or (selected is not None and not selected.any()):
        raise HTTPException(422, "No matching panoramas in this boundary.")
    descriptors, weights = city.source(ids)
    if selected is None or selected.all():
        return descriptors, weights
    mask = torch.as_tensor(selected, device=descriptors.device)
    weights = weights[mask]
    return descriptors[mask], weights / weights.sum()


@app.post("/search")
def search(b: Boundary):
    if not lock.acquire(blocking=False):raise HTTPException(429,"Another GPU query is running. Retry after it finishes.")
    try:
        start=time.perf_counter()
        info,ids,assigned,poly=analyze(b)
        class_id = b.theme_id
        if b.theme is not None:
            legacy = next((k for k, (name, _) in DISPLAY.items() if name == b.theme), None)
            if legacy is None or (class_id is not None and class_id != legacy):
                raise HTTPException(422, "Unknown or conflicting boundary class.")
            class_id = legacy
        if class_id is not None and class_id not in DISPLAY:
            raise HTTPException(422, "Unknown boundary class.")
        selected = None if class_id is None else assigned == class_id
        title = DISPLAY[class_id][0] if class_id is not None else "Whole boundary"
        city=targets[b.city]
        A=query_source(city,ids,selected)
        fields={k:t.score(A) for k,t in targets.items()}
        exc={k:(contains_xy(poly.buffer(150),*t.centers.T) if k==b.city else np.zeros(len(t.centers),bool)) for k,t in targets.items()}
        key="live_"+uuid.uuid4().hex
        center=city.data.geo(np.array(poly.representative_point().coords)).tolist()[0]
        query=dict(id=key,city=b.city,category="live",name=title,coordinates=center,
                   area=[[list(p) for p in [*b.points,b.points[0]]]],radius_m=0,nodes=len(A[0]),themes=[r["label"] for r in info["themes"]])
        pack(WORK/"sessions"/(key+".bin"),query,fields,exc,targets)
        query["elapsed_ms"]=round((time.perf_counter()-start)*1000)
        (WORK/"sessions"/(key+".json")).write_text(json.dumps(query))
        return query
    finally:lock.release()


@app.get("/query/{key}")
def result(key:str):
    if not re.fullmatch(r"live_[0-9a-f]{32}",key):raise HTTPException(404)
    p=WORK/"sessions"/(key+".bin")
    if not p.is_file():raise HTTPException(404)
    return FileResponse(p,media_type="application/octet-stream")
