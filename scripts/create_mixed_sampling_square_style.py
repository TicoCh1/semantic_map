"""Create true-distance, borderless squares using a sample_interval_m field."""

from pathlib import Path
import sys

from qgis.core import Qgis, QgsApplication, QgsMarkerSymbol, QgsProperty, QgsSingleSymbolRenderer, QgsVectorLayer
from qgis.PyQt.QtCore import Qt


def main(input_path: str, output_path: str) -> None:
    layer = QgsVectorLayer(input_path, "sampling", "ogr")
    if not layer.isValid() or "sample_interval_m" not in layer.fields().names():
        raise RuntimeError("Input point layer must have sample_interval_m")
    symbol = QgsMarkerSymbol.createSimple({
        "name": "square", "color": "#f28e2b", "outline_style": "no",
        "outline_width": "0", "size": "25",
    })
    symbol.setSizeUnit(Qgis.RenderUnit.MapUnits)
    symbol.setDataDefinedSize(QgsProperty.fromField("sample_interval_m"))
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
        main(sys.argv[1], sys.argv[2])
    finally:
        app.exitQgis()
