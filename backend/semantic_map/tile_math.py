from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass


WEB_MERCATOR_MAX_LAT = 85.05112878


@dataclass(frozen=True, slots=True)
class TileKey:
    z: int
    x: int
    y: int

    @property
    def id(self) -> str:
        return f"{self.z}/{self.x}/{self.y}"


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def lon_to_wrapped_180(lon_deg: float) -> float:
    return ((lon_deg + 180.0) % 360.0) - 180.0


def latlon_to_tile(lat_deg: float, lon_deg: float, z: int) -> TileKey:
    lat = clamp(lat_deg, -WEB_MERCATOR_MAX_LAT, WEB_MERCATOR_MAX_LAT)
    lon = lon_to_wrapped_180(lon_deg)
    lat_rad = math.radians(lat)
    n = 2**z

    x = math.floor((lon + 180.0) / 360.0 * n)
    y = math.floor((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)

    return TileKey(
        z=z,
        x=int(clamp(x, 0, n - 1)),
        y=int(clamp(y, 0, n - 1)),
    )


def stable_hash_u64(*parts: object) -> int:
    raw = "\x1f".join(str(part) for part in parts)
    digest = hashlib.blake2b(raw.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, byteorder="big", signed=False)
