"""KDE-weighted area composition from memory-mapped catalog scores."""
from pathlib import Path
import json
import re
from functools import lru_cache
from typing import Literal

import numpy as np
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

CITIES = {"london": 32630, "rome": 32633, "new_york": 32618, "shanghai": 32651}
City = Literal["london", "rome", "new_york", "shanghai"]


class Circle(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    city: City
    lon: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)
    radius: int = Field(ge=50, le=600)


# Each displayed percentage belongs to the ranked catalog prompt behind its label.
THEMES = [
    (r"minimalist wall", "Minimalist walls"),
    (r"glass (?:curtain|facade|façade)|reflective glass", "Glass façades"),
    (r"historic.*(?:skyscraper|modern tower)|skyscraper.*historic", "Historic and modern buildings"),
    (r"plaza|civic square|public square", "Plazas and squares"),
    (r"cyberpunk|neon (?:sign|reflect)", "Neon signage and towers"),
    (r"monumental (?:scale|vista)|awe-inspiring", "Monumental streetscape"),
    (r"postmodern", "Postmodern architecture"),
    (r"skyscraper|office tower|tall buildings|visible floors", "High-rise buildings"),
    (r"office buildings", "Office district"),
    (r"bridge.*(?:water|river)|(?:river|water).*bridge", "Bridges over water"),
    (r"waterfront|riverbank|riverside|canal", "Waterfront and canals"),
    (r"public garden|parkland|public park", "Parks and gardens"),
    (r"broad avenue|wide (?:avenue|road)|arterial", "Wide arterial roads"),
    (r"red.brick", "Red brick façades"),
    (r"market stall|street market", "Street markets"),
]


GROUP_LABELS = {
    "architectural_style_aging": "Architecture and age",
    "atmosphere_aesthetics_composition": "Visual composition",
    "boundaries_security_territoriality": "Boundaries and security",
    "building_functions": "Building uses",
    "building_height_massing": "Building massing",
    "cinematic_fictional_vibes": "Cinematic settings",
    "cleanliness_maintenance_disorder": "Street maintenance",
    "color_chromatic_streets": "Street colours",
    "curbside_parking_occupancy": "Curbside parking",
    "emotional_liminal_moods": "Atmosphere and mood",
    "facade_materials": "Façade materials",
    "green_infra_sustainability": "Green infrastructure",
    "greenery_open_space_water": "Green and blue space",
    "ground_paving_curbs": "Paving and curbs",
    "lifestyle_roleplay_scenarios": "Everyday activities",
    "micro_stories_traces_of_life": "Traces of daily life",
    "people_animals_street_life": "Street life",
    "road_types_geometry": "Road geometry",
    "signage_advertising_clutter": "Signs and advertising",
    "street_oddities_quirks": "Street curiosities",
    "synesthetic_sounds_smells": "Sounds and smells",
    "temporary_events_informal_economy": "Events and markets",
    "time_warp_pop_nostalgia": "Period character",
    "topography_spatial_enclosure": "Terrain and enclosure",
    "transport_structures_junctions": "Transport junctions",
    "urban_critters_whimsical_cuteness": "Urban wildlife",
    "vehicles_traffic_events": "Vehicles and traffic",
    "visual_irony_optical_fun": "Visual contrasts",
    "walkability_accessibility": "Walking and access",
    "weather_time_seasonality": "Weather and seasons",
}


def concept_label(prompt, group):
    for pattern, label in THEMES:
        if re.search(pattern, prompt, re.IGNORECASE):
            return label
    return GROUP_LABELS[group]


class RegionIndex:
    def __init__(self, root):
        self.root = Path(root)
        catalog = json.loads((self.root / "catalog.json").read_text(encoding="utf8"))
        if len(catalog) != 500:
            raise ValueError("Expected 500 catalog concepts")
        self.labels = [entry["prompt"] for entry in catalog]
        self.short_labels = [concept_label(entry["prompt"], entry["group"]) for entry in catalog]

    @lru_cache(maxsize=4)
    def city(self, name):
        folder = self.root / name
        positions, semantics, corr = (np.load(folder / f"{key}.npy", mmap_mode="r")
                                     for key in ("positions", "catalog_z", "catalog_corr"))
        if semantics.shape != (len(positions), 500) or positions.shape[1] != 4 or corr.shape != (500, 500):
            raise ValueError("Catalog and panorama rows disagree")
        return positions, semantics, corr

    def inspect(self, circle):
        positions, semantics, corr = self.city(circle.city)
        # WGS84 local metric over the selected circle. Latitude sorting bounds the I/O.
        lat = np.deg2rad(circle.lat)
        denom = 1 - 0.00669437999014 * np.sin(lat)**2
        north = np.pi / 180 * 6378137 * (1 - 0.00669437999014) / denom**1.5
        east = np.pi / 180 * 6378137 * np.cos(lat) / np.sqrt(denom)
        delta = circle.radius / north
        lo = positions[:, 1].searchsorted(circle.lat-delta, "left")
        hi = positions[:, 1].searchsorted(circle.lat+delta, "right")
        rows = positions[lo:hi]
        keep = ((rows[:, 0]-circle.lon)*east)**2 + ((rows[:, 1]-circle.lat)*north)**2 <= circle.radius**2
        rows = rows[keep]
        ids = rows[:, 3].astype(np.intp)
        if len(ids) > 2500:
            raise HTTPException(422, "This circle contains over 2,500 captures. Reduce its radius.")
        w = rows[:, 2].astype("f4")
        if len(ids):
            w /= w.sum()
        if not len(ids):
            return dict(count=0, effective_count=0, themes=[], warning="No captures here. Move or enlarge the circle.")
        z = np.asarray(semantics[ids], dtype="f4")
        mean = np.sum(w[:, None] * z, axis=0)
        coverage = np.sum(w[:, None] * (z >= 1), axis=0)
        # A concept needs both elevated local scores and area coverage. Citywide
        # score correlations suppress near-synonymous catalog entries.
        ordered = np.argsort(-(coverage * np.maximum(mean, 0)), kind="stable")
        chosen = []
        for j in ordered:
            if mean[j] <= 0 or coverage[j] <= 0:
                break
            if all(corr[j, k] < 0.75 and self.short_labels[j] != self.short_labels[k] for k in chosen):
                chosen.append(int(j))
            if len(chosen) == 6:
                break
        themes = [dict(label=self.short_labels[j], prompt=self.labels[j], coverage=float(coverage[j]), z=float(mean[j])) for j in chosen]
        warning = ""
        if len(ids) < 3:
            warning = "Too few captures to match. Move or enlarge the circle."
        elif not themes or max(t["coverage"] for t in themes) < .35:
            warning = "No leading feature covers 35% of the area. Try a smaller circle or move its center."
        elif circle.radius > 300:
            warning = "This circle spans several blocks. Reduce the radius to isolate a landmark."
        return dict(count=len(ids), effective_count=round(1 / float(w @ w), 1), themes=themes, warning=warning)
