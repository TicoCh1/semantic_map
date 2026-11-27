import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.semantic_map.region_atlas_api import local_app, precheck_index


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("REGION_ATLAS_ROOT", str(tmp_path))
    folder = tmp_path / "precheck"
    folder.mkdir()
    labels = ["Glass curtain wall", "Reflective glass curtain-wall façade"] + ["Concept %d" % i for i in range(498)]
    (folder / "catalog.json").write_text(json.dumps([dict(prompt=p, group="building_functions") for p in labels]))
    city = folder / "rome"
    city.mkdir()
    np.save(city / "positions.npy", [[12.46,41.90,.1,0],[12.4601,41.90,.1,1],[12.4603,41.90,.8,2],[12.49,41.90,1,3]])
    z = np.zeros((4,500), "f2")
    z[2,:2] = 2
    z[0,2] = 1.5
    np.save(city / "catalog_z.npy", z)
    np.save(city / "catalog_corr.npy", np.eye(500, dtype="f4"))
    (tmp_path / "index.json").write_text("{}")
    (tmp_path / "query").mkdir()
    (tmp_path / "query/test.bin").write_bytes(b"abc")
    with TestClient(local_app()) as c:
        yield c
    precheck_index.cache_clear()


area = dict(city="rome", lon=12.46, lat=41.90, radius=400)
prefix = "/api/region-atlas"


def test_composition_uses_area_and_short_labels(client):
    response = client.post(prefix + "/precheck", json=area)
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 3 and data["effective_count"] == 1.5 and data["warning"]
    assert data["themes"][0]["coverage"] == pytest.approx(.8)
    assert data["themes"][0]["z"] == pytest.approx(1.6)
    assert [x["label"] for x in data["themes"]].count("Glass façades") == 1
    assert data["themes"][0]["prompt"] != data["themes"][0]["label"]


def test_empty_and_invalid_circles(client):
    assert client.post(prefix + "/precheck", json={**area, "lat": 0}).json()["count"] == 0
    assert client.post(prefix + "/precheck", json={**area, "radius": 0}).status_code == 422
    assert client.post(prefix + "/search", json=area).status_code == 404


def test_atlas_conditional_get_and_missing_id(client):
    assert client.get(prefix + "/index").json() == {}
    path = prefix + "/query/test"
    response = client.get(path)
    assert response.content == b"abc"
    cached = client.get(path, headers={"If-None-Match": response.headers["ETag"]})
    assert cached.status_code == 304 and not cached.content
    assert client.get(prefix + "/query/bad.id").status_code == 404
    assert client.get(prefix + "/query/missing").status_code == 404
