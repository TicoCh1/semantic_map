from __future__ import annotations

import argparse
import json
import math
import sqlite3
import struct
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = ROOT / "frontend_pcatsne" / "public_pointcloud" / "data"
PATCH_ROOT = DATA_ROOT / "webmercator_grid_rgb48"
GROUP_ROOT = DATA_ROOT / "webmercator_grid_rgb48_grouped"
OUTPUT_ROOT = ROOT / "frontend_pcatsne" / "qgis_exports" / "webmercator_grid_rgb48_gpkg"

CENTER_LON = -0.11559
CENTER_LAT = 51.51024
WEB_MERCATOR_HALF_WORLD_METERS = 20_037_508.342789244
WEB_MERCATOR_WORLD_METERS = WEB_MERCATOR_HALF_WORLD_METERS * 2
WEB_MERCATOR_SRS_ID = 3857

POINT_RECORD = struct.Struct("<ffBBBB")
POINT_CHUNK_RECORDS = 100_000
INSERT_CHUNK_ROWS = 20_000

GPKG_APPLICATION_ID = 0x47504B47
GPKG_USER_VERSION = 10200

WEB_COLOR_MATRIX_BY_RADIUS = {
    2_000: "swap_rg_then_rb",
    4_000: "swap_rg_then_rb",
    8_000: "swap_rg_then_rb",
}

EPSG_3857_WKT = (
    'PROJCS["WGS 84 / Pseudo-Mercator",'
    'GEOGCS["WGS 84",'
    'DATUM["WGS_1984",'
    'SPHEROID["WGS 84",6378137,298.257223563,'
    'AUTHORITY["EPSG","7030"]],'
    'AUTHORITY["EPSG","6326"]],'
    'PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],'
    'UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],'
    'AUTHORITY["EPSG","4326"]],'
    'PROJECTION["Mercator_1SP"],'
    'PARAMETER["central_meridian",0],'
    'PARAMETER["scale_factor",1],'
    'PARAMETER["false_easting",0],'
    'PARAMETER["false_northing",0],'
    'UNIT["metre",1,AUTHORITY["EPSG","9001"]],'
    'AXIS["X",EAST],AXIS["Y",NORTH],'
    'EXTENSION["PROJ4","+proj=merc +a=6378137 +b=6378137 '
    '+lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs"],'
    'AUTHORITY["EPSG","3857"]]'
)


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_data_url(url: str) -> Path:
    if not url.startswith("./data/"):
        raise ValueError(f"Unsupported data url: {url}")
    return DATA_ROOT / url.removeprefix("./data/")


def format_scale(radius_m: int) -> str:
    return f"{radius_m // 1000:02d}km"


def web_color_matrix_name(radius_m: int, manifest_color_matrix: str | None) -> str:
    return WEB_COLOR_MATRIX_BY_RADIUS.get(int(radius_m), manifest_color_matrix or "identity")


def apply_color_matrix(matrix_name: str, r: int, g: int, b: int) -> tuple[int, int, int]:
    if matrix_name == "identity":
        return r, g, b
    if matrix_name == "swap_gb":
        return r, b, g
    if matrix_name == "swap_rg":
        return g, r, b
    if matrix_name == "swap_rg_then_gb":
        return g, b, r
    if matrix_name == "swap_rg_then_rb":
        return b, r, g
    raise ValueError(f"Unknown color matrix: {matrix_name}")


def color_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02X}{g:02X}{b:02X}"


def mercator_norm_to_meters(x_norm: float, y_norm: float) -> tuple[float, float]:
    x = x_norm * WEB_MERCATOR_WORLD_METERS - WEB_MERCATOR_HALF_WORLD_METERS
    y = WEB_MERCATOR_HALF_WORLD_METERS - y_norm * WEB_MERCATOR_WORLD_METERS
    return x, y


def lon_lat_to_web_mercator_meters(lon: float, lat: float) -> tuple[float, float]:
    clamped_lat = max(-85.05112878, min(85.05112878, lat))
    lat_radians = math.radians(clamped_lat)
    x = (lon / 180.0) * WEB_MERCATOR_HALF_WORLD_METERS
    y = (math.log(math.tan(math.pi / 4.0 + lat_radians / 2.0)) / math.pi) * WEB_MERCATOR_HALF_WORLD_METERS
    return x, y


def gpkg_geometry_blob(wkb: bytes, srs_id: int = WEB_MERCATOR_SRS_ID) -> bytes:
    return b"GP\x00\x01" + struct.pack("<i", srs_id) + wkb


def wkb_point(x: float, y: float) -> bytes:
    return struct.pack("<BIdd", 1, 1, x, y)


def wkb_linestring(points: list[tuple[float, float]]) -> bytes:
    payload = bytearray(struct.pack("<BII", 1, 2, len(points)))
    for x, y in points:
        payload.extend(struct.pack("<dd", x, y))
    return bytes(payload)


def now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def init_gpkg(path: Path, overwrite: bool) -> sqlite3.Connection:
    if path.exists():
        if not overwrite:
            raise FileExistsError(f"{path} exists; pass --overwrite to replace it")
        path.unlink()

    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute(f"PRAGMA application_id = {GPKG_APPLICATION_ID}")
    conn.execute(f"PRAGMA user_version = {GPKG_USER_VERSION}")
    conn.execute("PRAGMA journal_mode = OFF")
    conn.execute("PRAGMA synchronous = OFF")
    conn.execute("PRAGMA temp_store = MEMORY")
    create_gpkg_metadata_tables(conn)
    return conn


def create_gpkg_metadata_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE gpkg_spatial_ref_sys (
          srs_name TEXT NOT NULL,
          srs_id INTEGER NOT NULL PRIMARY KEY,
          organization TEXT NOT NULL,
          organization_coordsys_id INTEGER NOT NULL,
          definition TEXT NOT NULL,
          description TEXT
        );

        CREATE TABLE gpkg_contents (
          table_name TEXT NOT NULL PRIMARY KEY,
          data_type TEXT NOT NULL,
          identifier TEXT UNIQUE,
          description TEXT DEFAULT '',
          last_change DATETIME NOT NULL,
          min_x DOUBLE,
          min_y DOUBLE,
          max_x DOUBLE,
          max_y DOUBLE,
          srs_id INTEGER,
          CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
        );

        CREATE TABLE gpkg_geometry_columns (
          table_name TEXT NOT NULL,
          column_name TEXT NOT NULL,
          geometry_type_name TEXT NOT NULL,
          srs_id INTEGER NOT NULL,
          z TINYINT NOT NULL,
          m TINYINT NOT NULL,
          CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name),
          CONSTRAINT fk_gc_tn FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name),
          CONSTRAINT fk_gc_srs FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
        );
        """
    )
    conn.executemany(
        """
        INSERT INTO gpkg_spatial_ref_sys
          (srs_name, srs_id, organization, organization_coordsys_id, definition, description)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            ("Undefined Cartesian SRS", -1, "NONE", -1, "undefined", "undefined cartesian coordinate reference system"),
            ("Undefined Geographic SRS", 0, "NONE", 0, "undefined", "undefined geographic coordinate reference system"),
            ("WGS 84 geodetic", 4326, "EPSG", 4326, "EPSG:4326", "longitude/latitude coordinates in degrees"),
            ("WGS 84 / Pseudo-Mercator", 3857, "EPSG", 3857, EPSG_3857_WKT, "Web Mercator meters"),
        ],
    )


def register_feature_table(
    conn: sqlite3.Connection,
    table_name: str,
    geometry_type: str,
    description: str,
    bounds: tuple[float, float, float, float] | None,
) -> None:
    min_x, min_y, max_x, max_y = bounds if bounds else (None, None, None, None)
    conn.execute(
        """
        INSERT INTO gpkg_contents
          (table_name, data_type, identifier, description, last_change, min_x, min_y, max_x, max_y, srs_id)
        VALUES (?, 'features', ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (table_name, table_name, description, now_utc(), min_x, min_y, max_x, max_y, WEB_MERCATOR_SRS_ID),
    )
    conn.execute(
        """
        INSERT INTO gpkg_geometry_columns
          (table_name, column_name, geometry_type_name, srs_id, z, m)
        VALUES (?, 'geom', ?, ?, 0, 0)
        """,
        (table_name, geometry_type.upper(), WEB_MERCATOR_SRS_ID),
    )


def update_gpkg_bounds(
    conn: sqlite3.Connection,
    table_name: str,
    bounds: tuple[float, float, float, float] | None,
) -> None:
    min_x, min_y, max_x, max_y = bounds if bounds else (None, None, None, None)
    conn.execute(
        """
        UPDATE gpkg_contents
        SET min_x = ?, min_y = ?, max_x = ?, max_y = ?, last_change = ?
        WHERE table_name = ?
        """,
        (min_x, min_y, max_x, max_y, now_utc(), table_name),
    )


def create_point_table(conn: sqlite3.Connection, table_name: str) -> None:
    table = quote_identifier(table_name)
    conn.execute(
        f"""
        CREATE TABLE {table} (
          fid INTEGER PRIMARY KEY NOT NULL,
          geom BLOB NOT NULL,
          scale_km INTEGER NOT NULL,
          radius_m INTEGER NOT NULL,
          patch_id TEXT,
          grid_x INTEGER,
          grid_y INTEGER,
          point_index INTEGER NOT NULL,
          R INTEGER NOT NULL,
          G INTEGER NOT NULL,
          B INTEGER NOT NULL,
          A INTEGER NOT NULL,
          color_hex TEXT NOT NULL
        )
        """
    )
    conn.execute(f"CREATE INDEX {quote_identifier('idx_' + table_name + '_patch')} ON {table} (patch_id)")


def create_grid_table(conn: sqlite3.Connection, table_name: str) -> None:
    table = quote_identifier(table_name)
    conn.execute(
        f"""
        CREATE TABLE {table} (
          fid INTEGER PRIMARY KEY NOT NULL,
          geom BLOB NOT NULL,
          scale_km INTEGER NOT NULL,
          radius_m INTEGER NOT NULL,
          edge_key TEXT NOT NULL,
          node_x1 INTEGER NOT NULL,
          node_y1 INTEGER NOT NULL,
          node_x2 INTEGER NOT NULL,
          node_y2 INTEGER NOT NULL
        )
        """
    )


def iter_point_records(path: Path) -> Iterable[tuple[float, float, int, int, int, int]]:
    with path.open("rb") as file:
        while True:
            data = file.read(POINT_RECORD.size * POINT_CHUNK_RECORDS)
            if not data:
                break
            if len(data) % POINT_RECORD.size != 0:
                raise ValueError(f"Corrupt point bin length in {path}")
            for offset in range(0, len(data), POINT_RECORD.size):
                yield POINT_RECORD.unpack_from(data, offset)


def bounds_add_point(
    bounds: tuple[float, float, float, float] | None,
    x: float,
    y: float,
) -> tuple[float, float, float, float]:
    if bounds is None:
        return x, y, x, y
    min_x, min_y, max_x, max_y = bounds
    return min(min_x, x), min(min_y, y), max(max_x, x), max(max_y, y)


def load_manifests() -> tuple[list[dict], dict[int, dict]]:
    patch_manifest_path = PATCH_ROOT / "manifest.json"
    grouped_manifest_path = GROUP_ROOT / "manifest.json"
    if not patch_manifest_path.exists():
        raise FileNotFoundError(patch_manifest_path)
    if not grouped_manifest_path.exists():
        raise FileNotFoundError(grouped_manifest_path)

    patch_manifest = load_json(patch_manifest_path)
    grouped_manifest = load_json(grouped_manifest_path)
    groups = sorted(
        patch_manifest.get("groups", []),
        key=lambda item: int(item.get("radiusMeters", 0)),
    )
    grouped_by_radius = {
        int(layer.get("radiusMeters", 0)): layer
        for layer in grouped_manifest.get("layers", [])
        if int(layer.get("radiusMeters", 0)) > 0
    }
    return groups, grouped_by_radius


def selected_groups(groups: list[dict], scales_km: set[int] | None) -> list[dict]:
    if scales_km is None:
        return groups
    return [group for group in groups if int(group.get("radiusMeters", 0)) // 1000 in scales_km]


def export_points_gpkg(
    group: dict,
    grouped_layer: dict | None,
    output_dir: Path,
    overwrite: bool,
    limit_points: int | None = None,
) -> dict:
    radius_m = int(group["radiusMeters"])
    scale_km = radius_m // 1000
    scale_label = format_scale(radius_m)
    table_name = f"points_{scale_label}"
    output_path = output_dir / f"{scale_label}_points.gpkg"
    color_matrix = web_color_matrix_name(radius_m, (grouped_layer or {}).get("colorMatrix"))

    conn = init_gpkg(output_path, overwrite=overwrite)
    create_point_table(conn, table_name)
    register_feature_table(
        conn,
        table_name,
        "POINT",
        f"{scale_km}km PCA/t-SNE points with web-display RGB channel mapping ({color_matrix})",
        None,
    )

    insert_sql = f"""
        INSERT INTO {quote_identifier(table_name)}
          (fid, geom, scale_km, radius_m, patch_id, grid_x, grid_y, point_index, R, G, B, A, color_hex)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    rows = []
    fid = 1
    bounds = None
    patch_count = 0
    points_written = 0

    with conn:
        for patch in group.get("patches", []):
            patch_url = patch.get("url")
            if not patch_url:
                continue
            patch_bin = resolve_data_url(patch_url)
            if not patch_bin.exists():
                raise FileNotFoundError(patch_bin)

            patch_count += 1
            patch_id = patch.get("id")
            grid = patch.get("grid") or {}
            grid_x = grid.get("x")
            grid_y = grid.get("y")

            for point_index, (x_norm, y_norm, raw_r, raw_g, raw_b, alpha) in enumerate(iter_point_records(patch_bin)):
                x, y = mercator_norm_to_meters(x_norm, y_norm)
                r, g, b = apply_color_matrix(color_matrix, raw_r, raw_g, raw_b)
                rows.append(
                    (
                        fid,
                        sqlite3.Binary(gpkg_geometry_blob(wkb_point(x, y))),
                        scale_km,
                        radius_m,
                        patch_id,
                        grid_x,
                        grid_y,
                        point_index,
                        r,
                        g,
                        b,
                        alpha,
                        color_hex(r, g, b),
                    )
                )
                fid += 1
                points_written += 1
                bounds = bounds_add_point(bounds, x, y)

                if len(rows) >= INSERT_CHUNK_ROWS:
                    conn.executemany(insert_sql, rows)
                    rows.clear()

                if limit_points is not None and points_written >= limit_points:
                    break

            if limit_points is not None and points_written >= limit_points:
                break

        if rows:
            conn.executemany(insert_sql, rows)

    update_gpkg_bounds(conn, table_name, bounds)
    conn.commit()
    conn.execute("VACUUM")
    conn.close()

    return {
        "scale_km": scale_km,
        "type": "points",
        "path": str(output_path.relative_to(ROOT)),
        "table": table_name,
        "patch_count": patch_count,
        "point_count": points_written,
        "color_matrix": color_matrix,
        "srs": "EPSG:3857",
        "bytes": output_path.stat().st_size,
    }


def normalize_edge(
    start: tuple[int, int],
    end: tuple[int, int],
) -> tuple[tuple[int, int], tuple[int, int]]:
    return (start, end) if start <= end else (end, start)


def patch_edges(grid_x: int, grid_y: int) -> list[tuple[tuple[int, int], tuple[int, int]]]:
    west = 2 * grid_x - 1
    east = 2 * grid_x + 1
    south = 2 * grid_y - 1
    north = 2 * grid_y + 1
    return [
        normalize_edge((west, south), (east, south)),
        normalize_edge((east, south), (east, north)),
        normalize_edge((east, north), (west, north)),
        normalize_edge((west, north), (west, south)),
    ]


def grid_node_to_web_mercator_meters(
    center: tuple[float, float],
    radius_m: int,
    node: tuple[int, int],
) -> tuple[float, float]:
    return center[0] + node[0] * radius_m, center[1] + node[1] * radius_m


def build_unique_grid_edges(group: dict) -> dict[str, tuple[tuple[int, int], tuple[int, int]]]:
    edges: dict[str, tuple[tuple[int, int], tuple[int, int]]] = {}
    for patch in group.get("patches", []):
        grid = patch.get("grid") or {}
        if "x" not in grid or "y" not in grid:
            continue
        for start, end in patch_edges(int(grid["x"]), int(grid["y"])):
            key = f"{start[0]},{start[1]}|{end[0]},{end[1]}"
            edges.setdefault(key, (start, end))
    return edges


def export_grid_gpkg(
    group: dict,
    output_dir: Path,
    overwrite: bool,
) -> dict:
    radius_m = int(group["radiusMeters"])
    scale_km = radius_m // 1000
    scale_label = format_scale(radius_m)
    table_name = f"grid_{scale_label}"
    output_path = output_dir / f"{scale_label}_grid_lines.gpkg"

    conn = init_gpkg(output_path, overwrite=overwrite)
    create_grid_table(conn, table_name)
    register_feature_table(
        conn,
        table_name,
        "LINESTRING",
        f"{scale_km}km deduplicated WebMercator patch grid lines",
        None,
    )

    center = lon_lat_to_web_mercator_meters(CENTER_LON, CENTER_LAT)
    edges = build_unique_grid_edges(group)
    insert_sql = f"""
        INSERT INTO {quote_identifier(table_name)}
          (fid, geom, scale_km, radius_m, edge_key, node_x1, node_y1, node_x2, node_y2)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    rows = []
    bounds = None
    with conn:
        for fid, (edge_key, (start_node, end_node)) in enumerate(edges.items(), start=1):
            start = grid_node_to_web_mercator_meters(center, radius_m, start_node)
            end = grid_node_to_web_mercator_meters(center, radius_m, end_node)
            bounds = bounds_add_point(bounds, *start)
            bounds = bounds_add_point(bounds, *end)
            rows.append(
                (
                    fid,
                    sqlite3.Binary(gpkg_geometry_blob(wkb_linestring([start, end]))),
                    scale_km,
                    radius_m,
                    edge_key,
                    start_node[0],
                    start_node[1],
                    end_node[0],
                    end_node[1],
                )
            )
            if len(rows) >= INSERT_CHUNK_ROWS:
                conn.executemany(insert_sql, rows)
                rows.clear()
        if rows:
            conn.executemany(insert_sql, rows)

    update_gpkg_bounds(conn, table_name, bounds)
    conn.commit()
    conn.execute("VACUUM")
    conn.close()

    return {
        "scale_km": scale_km,
        "type": "grid_lines",
        "path": str(output_path.relative_to(ROOT)),
        "table": table_name,
        "line_count": len(edges),
        "srs": "EPSG:3857",
        "bytes": output_path.stat().st_size,
    }


def parse_scales(value: str | None) -> set[int] | None:
    if not value:
        return None
    scales = set()
    for item in value.split(","):
        item = item.strip().lower().removesuffix("km")
        if not item:
            continue
        scales.add(int(item))
    return scales


def write_summary(output_dir: Path, results: list[dict]) -> None:
    summary = {
        "created_at": now_utc(),
        "source": {
            "patch_manifest": str((PATCH_ROOT / "manifest.json").relative_to(ROOT)),
            "grouped_manifest": str((GROUP_ROOT / "manifest.json").relative_to(ROOT)),
            "point_record_format": "mercator_xy_float32_rgba_uint8",
        },
        "output_srs": "EPSG:3857",
        "center": {"lon": CENTER_LON, "lat": CENTER_LAT},
        "color_policy": {
            "2km": "swap_rg_then_rb -> output RGB = source B,R,G",
            "4km": "swap_rg_then_rb -> output RGB = source B,R,G",
            "8km": "swap_rg_then_rb -> output RGB = source B,R,G",
            "16km": "swap_rg -> output RGB = source G,R,B",
            "32km": "swap_rg -> output RGB = source G,R,B",
        },
        "outputs": results,
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export WebMercator PCA/t-SNE patch point clouds and deduplicated grid lines to QGIS-readable GeoPackage files."
    )
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_ROOT, help="Separate output folder for generated GPKG files.")
    parser.add_argument("--scales", help="Comma-separated km scales to export, e.g. 2,4,8,16,32. Default: all.")
    parser.add_argument("--overwrite", action="store_true", help="Replace existing GPKG files in the output folder.")
    parser.add_argument(
        "--limit-points",
        type=int,
        help="Debug only: cap exported points per scale. Do not use for final exports.",
    )
    args = parser.parse_args()

    groups, grouped_by_radius = load_manifests()
    groups = selected_groups(groups, parse_scales(args.scales))
    if not groups:
        raise RuntimeError("No matching scales found.")

    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for group in groups:
        radius_m = int(group["radiusMeters"])
        scale_km = radius_m // 1000
        print(f"Exporting {scale_km}km points...")
        point_result = export_points_gpkg(
            group=group,
            grouped_layer=grouped_by_radius.get(radius_m),
            output_dir=output_dir,
            overwrite=args.overwrite,
            limit_points=args.limit_points,
        )
        print(
            f"  wrote {point_result['path']} "
            f"({point_result['point_count']:,} points, {point_result['bytes'] / 1024 / 1024:.1f} MiB)"
        )
        results.append(point_result)

        print(f"Exporting {scale_km}km grid lines...")
        grid_result = export_grid_gpkg(group=group, output_dir=output_dir, overwrite=args.overwrite)
        print(
            f"  wrote {grid_result['path']} "
            f"({grid_result['line_count']:,} lines, {grid_result['bytes'] / 1024 / 1024:.1f} MiB)"
        )
        results.append(grid_result)

    write_summary(output_dir, results)
    print(f"Summary: {(output_dir / 'summary.json').relative_to(ROOT)}")


if __name__ == "__main__":
    main()
