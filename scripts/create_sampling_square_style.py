"""Create a QGIS style for true 25 m borderless sample squares."""

from pathlib import Path
import sys

from qgis.core import Qgis, QgsApplication, QgsMarkerSymbol, QgsSingleSymbolRenderer, QgsVectorLayer
from qgis.PyQt.QtCore import Qt


def main(input_path: str, output_path: str, size_m: float = 25.0) -> None:
    layer = QgsVectorLayer(input_path, "sampling", "ogr")
    if not layer.isValid():
        raise RuntimeError(f"Could not open {input_path}")

    symbol = QgsMarkerSymbol.createSimple({
        "name": "square",
        "color": "#f28e2b",
        "outline_style": "no",
        "outline_width": "0",
        "size": str(size_m),
    })
    symbol.setSize(size_m)
    symbol.setSizeUnit(Qgis.RenderUnit.MapUnits)
    symbol.setOpacity(0.9)
    marker = symbol.symbolLayer(0)
    marker.setStrokeStyle(Qt.NoPen)
    marker.setStrokeWidth(0.0)
    layer.setRenderer(QgsSingleSymbolRenderer(symbol))

    success, message = layer.saveNamedStyle(output_path)
    if not success:
        raise RuntimeError(message)
    print(Path(output_path))


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        if len(sys.argv) not in {3, 4}:
            raise SystemExit("Usage: create_sampling_square_style.py INPUT OUTPUT [SIZE_METRES]")
        main(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) == 4 else 25.0)
    finally:
        app.exitQgis()
