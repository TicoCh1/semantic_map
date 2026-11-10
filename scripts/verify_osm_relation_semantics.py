"""Verify the named OSM administrative sources before rebuilding boundaries."""

from __future__ import annotations

import time

import requests

from build_osm_study_boundaries import SPECS


URL = "https://nominatim.openstreetmap.org/lookup"
HEADERS = {"User-Agent": "urbanfabric-semantic-boundary-audit/1.0 (research use)"}


def main() -> None:
    session = requests.Session()
    session.headers.update(HEADERS)
    for spec in SPECS:
        if spec.ring_query:
            print({"city": spec.city, "kind": "road_ring", "basis": spec.basis})
            continue
        relation_ids = (*spec.relation_ids, *spec.subtract_relation_ids)
        response = session.get(
            URL,
            params={"format": "jsonv2", "osm_ids": ",".join(f"R{relation_id}" for relation_id in relation_ids)},
            timeout=120,
        )
        response.raise_for_status()
        items = {int(item["osm_id"]): item for item in response.json()}
        missing = sorted(set(relation_ids) - set(items))
        if missing:
            raise RuntimeError(f"{spec.city}: Nominatim did not return {missing}")
        print({
            "city": spec.city,
            "basis": spec.basis,
            "relations": [
                {
                    "id": relation_id,
                    "name": items[relation_id].get("name"),
                    "category": items[relation_id].get("category"),
                    "type": items[relation_id].get("type"),
                    "addresstype": items[relation_id].get("addresstype"),
                    "role": "subtract" if relation_id in spec.subtract_relation_ids else "include",
                }
                for relation_id in relation_ids
            ],
        })
        time.sleep(1.1)


if __name__ == "__main__":
    main()
