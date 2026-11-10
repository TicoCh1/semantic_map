"""Install a viewer-only export, rejecting archive escapes and link entries."""
import argparse
import json
from pathlib import Path
import shutil
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument("archive", type=Path)
parser.add_argument("--dataset-dir", choices=["london_4096_pca64_pacmap", "london_4096_pca64_pacmap_edge", "london_4096_pca64_pacmap_whole16"], default="london_4096_pca64_pacmap")
args = parser.parse_args()
base = Path(__file__).resolve().parents[1] / "public_pointcloud/data"
target = (base / args.dataset_dir).resolve()
with tarfile.open(args.archive, "r:gz") as archive:
    members = archive.getmembers()
    for member in members:
        path = (base / member.name).resolve()
        if (path != target and target not in path.parents) or not (member.isfile() or member.isdir()):
            raise ValueError(f"Invalid archive entry: {member.name}")
    for member in members:
        path = (base / member.name).resolve()
        if member.isdir():
            path.mkdir(parents=True, exist_ok=True)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(member) as source, path.open("wb") as output:
                shutil.copyfileobj(source, output)
manifest = json.loads((target / "manifest.json").read_text())
assert manifest["dataset"] == "london_512_8_45_8B" and manifest["readyScalesKm"][0] == 2
assert set(manifest["readyScalesKm"]).issubset({2,4,8,16,32})
for layer in manifest["layers"]:
    assert (target / layer["bin"]).stat().st_size == layer["count"] * 12
    assert sum(p["count"] for p in layer["patches"]) == layer["count"]
    for patch in layer["patches"]:
        assert (target / layer["id"] / patch["bin"]).stat().st_size == patch["byteLength"]
print(json.dumps({"dataset": manifest["dataset"], "rows": manifest["sourceRows"],
                  "bounds": manifest["layers"][0]["bounds"], "destination": str(target)}, indent=2))
