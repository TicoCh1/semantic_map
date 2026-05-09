HEAD_HTML = """
<link href="https://api.mapbox.com/mapbox-gl-js/v1.13.3/mapbox-gl.css" rel="stylesheet" />
<script src="https://api.mapbox.com/mapbox-gl-js/v1.13.3/mapbox-gl.js"></script>
"""


HTML_TEMPLATE = """
<div class="semantic-workbench">
  <section class="map-pane">
    <div class="map-toolbar">
      <div>
        <div class="eyebrow">Semantic Map</div>
        <div id="activeLayerTitle" class="active-title">Loading...</div>
      </div>
      <div id="mapStatus" class="status-pill">Starting</div>
    </div>
    <div id="semanticMap" class="map-canvas"></div>
  </section>

  <div id="paneResizer" class="pane-resizer" aria-label="Resize controls"></div>

  <aside id="sidePanel" class="side-panel">
    <section class="panel-section prompt-section">
      <label class="field-label" for="promptInput">Prompt</label>
      <div class="prompt-row">
        <textarea id="promptInput" class="prompt-input" placeholder="The scene contains an animal"></textarea>
        <button id="createLayerButton" class="primary-button">Create</button>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-header">
        <div>
          <div class="eyebrow">Layers</div>
          <h2>Display Order</h2>
        </div>
        <button id="refreshButton" class="icon-button" title="Reload state">Reload</button>
      </div>
      <div id="layerList" class="layer-list" aria-label="Map layers"></div>
    </section>

    <section class="panel-section grow-section">
      <div class="section-header">
        <div>
          <div class="eyebrow">Colour Scheme</div>
          <h2>Gradient</h2>
        </div>
        <button id="saveGradientButton" class="secondary-button">Save</button>
      </div>

      <label class="field-label" for="gradientNameInput">Preset name</label>
      <input id="gradientNameInput" class="text-input" type="text" />

      <div id="gradientStrip" class="gradient-strip" tabindex="0">
        <div id="gradientStops" class="gradient-stops"></div>
      </div>

      <div class="stop-tools">
        <button id="addStopButton" class="secondary-button">Add Stop</button>
        <button id="deleteStopButton" class="danger-button">Delete Stop</button>
      </div>

      <div class="position-row">
        <label class="field-label" for="stopPositionInput">Stop position</label>
        <div class="number-with-unit">
          <input id="stopPositionInput" class="number-input" type="number" min="0" max="100" step="0.1" />
          <span>%</span>
        </div>
      </div>

      <div class="color-editor">
        <div class="color-preview-block">
          <div id="currentColorPreview" class="current-color-preview"></div>
          <input id="nativeColorInput" class="native-color" type="color" />
          <input id="hexInput" class="hex-input" type="text" maxlength="7" spellcheck="false" />
        </div>

        <div class="tabs">
          <button class="tab-button active" data-tab="rgb">RGB</button>
          <button class="tab-button" data-tab="hsv">HSV</button>
        </div>

        <div id="rgbPanel" class="color-panel active">
          <div class="slider-row"><label>R</label><input id="rgbR" type="range" min="0" max="255" step="1" /><input id="rgbRNum" type="number" min="0" max="255" step="1" /></div>
          <div class="slider-row"><label>G</label><input id="rgbG" type="range" min="0" max="255" step="1" /><input id="rgbGNum" type="number" min="0" max="255" step="1" /></div>
          <div class="slider-row"><label>B</label><input id="rgbB" type="range" min="0" max="255" step="1" /><input id="rgbBNum" type="number" min="0" max="255" step="1" /></div>
        </div>

        <div id="hsvPanel" class="color-panel">
          <div class="hsv-layout">
            <canvas id="hsvWheel" class="hsv-wheel" width="190" height="190"></canvas>
            <div class="hsv-sliders">
              <div class="slider-row"><label>H</label><input id="hsvH" type="range" min="0" max="360" step="1" /><input id="hsvHNum" type="number" min="0" max="360" step="1" /></div>
              <div class="slider-row"><label>S</label><input id="hsvS" type="range" min="0" max="100" step="0.1" /><input id="hsvSNum" type="number" min="0" max="100" step="0.1" /></div>
              <div class="slider-row"><label>V</label><input id="hsvV" type="range" min="0" max="100" step="0.1" /><input id="hsvVNum" type="number" min="0" max="100" step="0.1" /></div>
            </div>
          </div>
        </div>

        <div class="style-row">
          <label class="field-label" for="opacityInput">Layer opacity</label>
          <input id="opacityInput" type="range" min="0" max="1" step="0.01" />
          <span id="opacityValue" class="mini-value">75%</span>
        </div>
      </div>
    </section>
  </aside>
</div>
"""


CSS_TEMPLATE = """
* {
  box-sizing: border-box;
}

:host {
  --panel-width: 430px;
  display: block;
}

.semantic-workbench {
  --panel-width: 430px;
  height: min(84vh, 900px);
  min-height: 640px;
  display: grid;
  grid-template-columns: minmax(460px, 1fr) 8px var(--panel-width);
  overflow: hidden;
  border: 1px solid #cfd5dc;
  border-radius: 6px;
  background: #f5f6f7;
  color: #18202a;
}

.map-pane {
  position: relative;
  min-width: 0;
  background: #e9edf0;
}

.map-canvas {
  position: absolute;
  inset: 0;
}

.map-toolbar {
  position: absolute;
  z-index: 2;
  left: 12px;
  top: 12px;
  right: 56px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;
}

.map-toolbar > * {
  pointer-events: auto;
}

.eyebrow {
  color: #667085;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0;
  text-transform: uppercase;
}

.active-title,
.status-pill {
  border: 1px solid rgba(24, 32, 42, 0.12);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 6px 18px rgba(24, 32, 42, 0.12);
}

.active-title {
  margin-top: 4px;
  padding: 8px 10px;
  max-width: 460px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 650;
}

.status-pill {
  align-self: flex-start;
  padding: 7px 9px;
  font-size: 12px;
}

.pane-resizer {
  width: 8px;
  cursor: col-resize;
  background: linear-gradient(90deg, #d8dde3, #f7f8f9, #d8dde3);
  border-left: 1px solid #cfd5dc;
  border-right: 1px solid #cfd5dc;
}

.pane-resizer:hover,
.semantic-workbench.resizing .pane-resizer {
  background: #aeb8c4;
}

.side-panel {
  min-width: 320px;
  overflow: auto;
  background: #ffffff;
  padding: 12px;
}

.panel-section {
  border-bottom: 1px solid #e2e6ea;
  padding: 0 0 14px;
  margin-bottom: 14px;
}

.panel-section:last-child {
  border-bottom: 0;
  margin-bottom: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.section-header h2 {
  margin: 1px 0 0;
  font-size: 16px;
  line-height: 1.2;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  color: #4b5563;
  font-size: 12px;
  font-weight: 650;
}

.prompt-row {
  display: grid;
  grid-template-columns: 1fr 76px;
  gap: 8px;
}

.prompt-input,
.text-input,
.number-input,
.hex-input {
  width: 100%;
  border: 1px solid #cfd5dc;
  border-radius: 5px;
  background: #ffffff;
  color: #111827;
  font: inherit;
}

.prompt-input {
  min-height: 62px;
  max-height: 120px;
  resize: vertical;
  padding: 8px;
}

.text-input,
.number-input,
.hex-input {
  height: 34px;
  padding: 6px 8px;
}

button {
  border: 1px solid #c5cbd3;
  border-radius: 5px;
  background: #f8fafc;
  color: #111827;
  font: inherit;
  cursor: pointer;
}

button:hover {
  background: #edf2f7;
}

.primary-button {
  border-color: #1f5f9e;
  background: #256aa8;
  color: #ffffff;
  font-weight: 650;
}

.primary-button:hover {
  background: #1f5f9e;
}

.secondary-button,
.danger-button,
.icon-button {
  height: 32px;
  padding: 0 10px;
}

.danger-button {
  border-color: #d6a3a3;
  color: #9b1c1c;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 80px;
}

.layer-row {
  display: grid;
  grid-template-columns: 30px 20px 1fr 28px;
  gap: 8px;
  align-items: center;
  padding: 7px 8px;
  border: 1px solid #d6dce3;
  border-radius: 6px;
  background: #fbfcfd;
  cursor: grab;
  user-select: none;
}

.layer-row.dragging {
  opacity: 0.48;
}

.layer-row.drop-target {
  border-color: #256aa8;
  background: #edf6ff;
}

.layer-row.selected {
  border-color: #256aa8;
  background: #eef6ff;
}

.visibility-button {
  width: 26px;
  height: 26px;
  padding: 0;
  display: grid;
  place-items: center;
}

.visibility-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid #475467;
  background: #2f80ed;
}

.visibility-button.off .visibility-dot {
  background: transparent;
  border-color: #98a2b3;
}

.row-delete-button {
  width: 26px;
  height: 26px;
  padding: 0;
  color: #9b1c1c;
}

.drag-grip {
  width: 18px;
  height: 22px;
  border-radius: 4px;
  background-image: radial-gradient(#98a2b3 1.3px, transparent 1.3px);
  background-size: 6px 6px;
  background-position: 1px 2px;
}

.layer-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 650;
}

.layer-subtitle {
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #667085;
  font-size: 11px;
}

.gradient-strip {
  position: relative;
  height: 72px;
  margin: 12px 0 10px;
  border: 1px solid #cfd5dc;
  border-radius: 6px;
  background: #d7dce2;
}

.gradient-strip::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 5px;
  background-image:
    linear-gradient(45deg, rgba(255,255,255,0.4) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255,255,255,0.4) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.4) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.4) 75%);
  background-size: 14px 14px;
  background-position: 0 0, 0 7px, 7px -7px, -7px 0;
}

.gradient-stops {
  position: absolute;
  inset: 0;
  border-radius: 5px;
}

.gradient-stop {
  position: absolute;
  bottom: -8px;
  width: 18px;
  height: 22px;
  transform: translateX(-50%);
  cursor: ew-resize;
}

.gradient-stop::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 0;
  width: 12px;
  height: 12px;
  transform: rotate(45deg);
  border: 2px solid #ffffff;
  background: var(--stop-color);
  box-shadow: 0 0 0 1px #344054;
}

.gradient-stop.selected::before {
  box-shadow: 0 0 0 2px #256aa8;
}

.stop-tools,
.position-row,
.color-preview-block,
.style-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 9px 0;
}

.position-row {
  justify-content: space-between;
}

.number-with-unit {
  display: grid;
  grid-template-columns: 96px 22px;
  gap: 4px;
  align-items: center;
}

.current-color-preview {
  width: 44px;
  height: 34px;
  border: 1px solid #cfd5dc;
  border-radius: 5px;
  background: #ffffff;
}

.native-color {
  width: 44px;
  height: 34px;
  padding: 0;
  border: 1px solid #cfd5dc;
  border-radius: 5px;
  background: #ffffff;
}

.hex-input {
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

.tabs {
  display: flex;
  gap: 4px;
  margin: 10px 0;
}

.tab-button {
  height: 30px;
  padding: 0 12px;
}

.tab-button.active {
  border-color: #256aa8;
  background: #e8f2fc;
  color: #164c7f;
  font-weight: 650;
}

.color-panel {
  display: none;
}

.color-panel.active {
  display: block;
}

.slider-row {
  display: grid;
  grid-template-columns: 18px 1fr 66px;
  gap: 8px;
  align-items: center;
  margin: 8px 0;
}

.slider-row label {
  color: #4b5563;
  font-size: 12px;
  font-weight: 650;
}

.slider-row input[type="number"] {
  width: 66px;
  height: 28px;
  border: 1px solid #cfd5dc;
  border-radius: 4px;
  padding: 3px 5px;
}

input[type="range"] {
  width: 100%;
}

.hsv-layout {
  display: grid;
  grid-template-columns: 190px 1fr;
  gap: 12px;
  align-items: center;
}

.hsv-wheel {
  width: 190px;
  height: 190px;
  border: 1px solid #cfd5dc;
  border-radius: 50%;
  cursor: crosshair;
}

.mini-value {
  min-width: 42px;
  color: #667085;
  font-size: 12px;
  text-align: right;
}

.mapboxgl-popup-content {
  border-radius: 6px;
  color: #111827;
  font-size: 12px;
}

.popup-title {
  font-weight: 700;
  margin-bottom: 5px;
}

.popup-row {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 8px;
  margin-top: 2px;
}

@media (max-width: 980px) {
  .semantic-workbench {
    height: auto;
    min-height: 0;
    display: block;
  }

  .map-pane {
    height: 58vh;
    min-height: 420px;
  }

  .pane-resizer {
    display: none;
  }

  .side-panel {
    max-height: none;
  }

  .hsv-layout {
    grid-template-columns: 1fr;
  }
}
"""


JS_ON_LOAD = r"""
const root = element.querySelector(".semantic-workbench");
const els = {
  map: element.querySelector("#semanticMap"),
  status: element.querySelector("#mapStatus"),
  activeTitle: element.querySelector("#activeLayerTitle"),
  resizer: element.querySelector("#paneResizer"),
  sidePanel: element.querySelector("#sidePanel"),
  promptInput: element.querySelector("#promptInput"),
  createLayerButton: element.querySelector("#createLayerButton"),
  refreshButton: element.querySelector("#refreshButton"),
  layerList: element.querySelector("#layerList"),
  gradientNameInput: element.querySelector("#gradientNameInput"),
  gradientStrip: element.querySelector("#gradientStrip"),
  gradientStops: element.querySelector("#gradientStops"),
  addStopButton: element.querySelector("#addStopButton"),
  deleteStopButton: element.querySelector("#deleteStopButton"),
  stopPositionInput: element.querySelector("#stopPositionInput"),
  currentColorPreview: element.querySelector("#currentColorPreview"),
  nativeColorInput: element.querySelector("#nativeColorInput"),
  hexInput: element.querySelector("#hexInput"),
  rgbR: element.querySelector("#rgbR"),
  rgbG: element.querySelector("#rgbG"),
  rgbB: element.querySelector("#rgbB"),
  rgbRNum: element.querySelector("#rgbRNum"),
  rgbGNum: element.querySelector("#rgbGNum"),
  rgbBNum: element.querySelector("#rgbBNum"),
  hsvH: element.querySelector("#hsvH"),
  hsvS: element.querySelector("#hsvS"),
  hsvV: element.querySelector("#hsvV"),
  hsvHNum: element.querySelector("#hsvHNum"),
  hsvSNum: element.querySelector("#hsvSNum"),
  hsvVNum: element.querySelector("#hsvVNum"),
  hsvWheel: element.querySelector("#hsvWheel"),
  opacityInput: element.querySelector("#opacityInput"),
  opacityValue: element.querySelector("#opacityValue"),
  saveGradientButton: element.querySelector("#saveGradientButton")
};

const app = {
  payload: null,
  map: null,
  drawnIds: new Set(),
  selectedStopIndex: 0,
  draftGradient: null,
  saveTimer: null,
  draggedLayerId: null,
  mapReady: false,
  suppressInputs: false
};

function setStatus(message) {
  els.status.textContent = message;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeHex(value) {
  const raw = String(value || "").trim();
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toLowerCase();
  return null;
}

function hexToRgb(hex) {
  const clean = normalizeHex(hex) || "#000000";
  return {
    r: parseInt(clean.slice(1, 3), 16),
    g: parseInt(clean.slice(3, 5), 16),
    b: parseInt(clean.slice(5, 7), 16)
  };
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s: s * 100, v: max * 100 };
}

function hsvToRgb(h, s, v) {
  h = ((Number(h) % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  v = clamp(v, 0, 100) / 100;
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
}

function layerById(id) {
  return app.payload.state.layers.find((layer) => layer.id === id) || null;
}

function selectedLayer() {
  return layerById(app.payload.state.selected_layer_id) || app.payload.state.layers[0] || null;
}

function gradientById(id) {
  return app.payload.gradients.find((gradient) => gradient.id === id) || app.payload.gradients[0];
}

function selectedGradient() {
  const layer = selectedLayer();
  const gradientId = layer?.style?.gradient_id || app.payload.gradients[0]?.id;
  return gradientById(gradientId);
}

function sortedStops(gradient) {
  return [...(gradient?.stops || [])].sort((a, b) => a.value - b.value);
}

function gradientCss(gradient) {
  const stops = sortedStops(gradient);
  if (!stops.length) return "#d7dce2";
  return `linear-gradient(90deg, ${stops.map((stop) => `${stop.color} ${clamp(stop.value, 0, 1) * 100}%`).join(", ")})`;
}

function colorExpression(gradient, layer) {
  const stops = sortedStops(gradient);
  const style = layer.style || {};
  const scoreMin = Number(style.score_min ?? gradient.score_min ?? 0);
  const scoreMax = Number(style.score_max ?? gradient.score_max ?? 1);
  const sourceMin = stops[0]?.value ?? 0;
  const sourceMax = stops[stops.length - 1]?.value ?? 1;
  const expression = ["interpolate", ["linear"], ["get", layer.score_property || "score"]];
  stops.forEach((stop) => {
    const denom = sourceMax === sourceMin ? 1 : sourceMax - sourceMin;
    const normalized = (stop.value - sourceMin) / denom;
    expression.push(scoreMin + normalized * (scoreMax - scoreMin), stop.color);
  });
  return expression;
}

function popupHtml(layerName, props) {
  const score = Number(props.score);
  const zscore = Number(props.zscore);
  return `
    <div class="popup-title">${layerName}</div>
    <div class="popup-row"><span>ID</span><span>${props.id || ""}</span></div>
    <div class="popup-row"><span>score</span><span>${Number.isFinite(score) ? score.toFixed(4) : ""}</span></div>
    <div class="popup-row"><span>zscore</span><span>${Number.isFinite(zscore) ? zscore.toFixed(3) : ""}</span></div>
  `;
}

function bootMap() {
  if (!window.mapboxgl) {
    setStatus("Mapbox GL JS failed to load");
    return;
  }

  mapboxgl.accessToken = "";
  app.map = new mapboxgl.Map({
    container: els.map,
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors"
        }
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }]
    },
    center: [-0.1276, 51.5072],
    zoom: 10.45,
    minZoom: 8,
    maxZoom: 18
  });

  app.map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
  app.map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");
  app.map.on("load", () => {
    app.mapReady = true;
    renderMapLayers();
  });
  app.map.on("error", (event) => {
    const message = event?.error?.message || "Map error";
    setStatus(message);
  });
}

function renderMapLayers() {
  if (!app.mapReady || !app.payload) return;

  app.drawnIds.forEach((id) => {
    if (app.map.getLayer(id)) app.map.removeLayer(id);
    if (app.map.getSource(id)) app.map.removeSource(id);
  });
  app.drawnIds.clear();

  const dataById = new Map((app.payload.layers || []).map((item) => [item.id, item]));
  const drawLayers = [...app.payload.state.layers].reverse().filter((layer) => layer.visible);

  drawLayers.forEach((layer) => {
    const dataLayer = dataById.get(layer.id);
    if (!dataLayer?.geojson) return;
    const gradient = gradientById(layer.style?.gradient_id);
    const opacity = Number(layer.style?.opacity ?? gradient.opacity ?? 0.75);

    app.map.addSource(layer.id, { type: "geojson", data: dataLayer.geojson });
    app.map.addLayer({
      id: layer.id,
      type: "circle",
      source: layer.id,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 13, 5.5, 16, 9.5],
        "circle-color": colorExpression(gradient, layer),
        "circle-opacity": opacity,
        "circle-stroke-color": "#1f2937",
        "circle-stroke-width": 0.45,
        "circle-stroke-opacity": 0.55
      }
    });

    app.map.on("mouseenter", layer.id, () => { app.map.getCanvas().style.cursor = "pointer"; });
    app.map.on("mouseleave", layer.id, () => { app.map.getCanvas().style.cursor = ""; });
    app.map.on("click", layer.id, (event) => {
      const feature = event.features && event.features[0];
      if (!feature) return;
      new mapboxgl.Popup({ closeButton: true, closeOnClick: true })
        .setLngLat(event.lngLat)
        .setHTML(popupHtml(layer.name, feature.properties || {}))
        .addTo(app.map);
    });
    app.drawnIds.add(layer.id);
  });

  const visibleCount = drawLayers.length;
  setStatus(`${visibleCount} visible / ${app.payload.state.layers.length} total`);
}

function renderLayerList() {
  els.layerList.innerHTML = "";
  const selectedId = app.payload.state.selected_layer_id;

  app.payload.state.layers.forEach((layer) => {
    const row = document.createElement("div");
    row.className = `layer-row${layer.id === selectedId ? " selected" : ""}`;
    row.draggable = true;
    row.dataset.layerId = layer.id;

    const visibility = document.createElement("button");
    visibility.className = `visibility-button${layer.visible ? "" : " off"}`;
    visibility.title = layer.visible ? "Hide layer" : "Show layer";
    visibility.innerHTML = '<span class="visibility-dot"></span>';
    visibility.addEventListener("click", (event) => {
      event.stopPropagation();
      layer.visible = !layer.visible;
      renderAll();
      scheduleSave();
    });

    const grip = document.createElement("div");
    grip.className = "drag-grip";

    const text = document.createElement("div");
    text.innerHTML = `<div class="layer-title">${escapeHtml(layer.name || layer.id)}</div><div class="layer-subtitle">${escapeHtml(layer.prompt || "")}</div>`;

    const deleteButton = document.createElement("button");
    deleteButton.className = "row-delete-button";
    deleteButton.title = "Delete layer";
    deleteButton.textContent = "x";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteLayer(layer.id, layer.name || layer.id);
    });

    row.append(visibility, grip, text, deleteButton);
    row.addEventListener("click", () => {
      app.payload.state.selected_layer_id = layer.id;
      app.draftGradient = null;
      app.selectedStopIndex = 0;
      renderAll();
      scheduleSave();
    });
    row.addEventListener("dragstart", (event) => {
      app.draggedLayerId = layer.id;
      row.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", layer.id);
    });
    row.addEventListener("dragend", () => {
      app.draggedLayerId = null;
      row.classList.remove("dragging");
      element.querySelectorAll(".layer-row.drop-target").forEach((el) => el.classList.remove("drop-target"));
    });
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (app.draggedLayerId && app.draggedLayerId !== layer.id) row.classList.add("drop-target");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      row.classList.remove("drop-target");
      const rect = row.getBoundingClientRect();
      const placeAfter = event.clientY > rect.top + rect.height / 2;
      reorderLayer(app.draggedLayerId, layer.id, placeAfter);
    });

    els.layerList.append(row);
  });
}

function reorderLayer(draggedId, targetId, placeAfter) {
  if (!draggedId || !targetId || draggedId === targetId) return;
  const layers = app.payload.state.layers;
  const from = layers.findIndex((layer) => layer.id === draggedId);
  const to = layers.findIndex((layer) => layer.id === targetId);
  if (from < 0 || to < 0) return;
  const [moved] = layers.splice(from, 1);
  let insertAt = layers.findIndex((layer) => layer.id === targetId);
  if (placeAfter) insertAt += 1;
  layers.splice(insertAt, 0, moved);
  layers.forEach((layer, index) => { layer.order = index; });
  renderAll();
  scheduleSave();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function currentDraftGradient() {
  if (!app.draftGradient) {
    app.draftGradient = deepCopy(selectedGradient());
  }
  app.draftGradient.stops = sortedStops(app.draftGradient);
  if (app.selectedStopIndex >= app.draftGradient.stops.length) app.selectedStopIndex = app.draftGradient.stops.length - 1;
  if (app.selectedStopIndex < 0) app.selectedStopIndex = 0;
  return app.draftGradient;
}

function selectedStop() {
  const gradient = currentDraftGradient();
  return gradient.stops[app.selectedStopIndex] || null;
}

function renderGradientEditor() {
  const layer = selectedLayer();
  if (!layer) {
    els.activeTitle.textContent = "No layer selected";
    return;
  }
  els.activeTitle.textContent = layer.name || layer.id;

  const gradient = currentDraftGradient();
  els.gradientNameInput.value = gradient.name || gradient.id;
  els.gradientStops.style.background = gradientCss(gradient);
  els.gradientStops.innerHTML = "";

  gradient.stops.forEach((stop, index) => {
    const marker = document.createElement("button");
    marker.className = `gradient-stop${index === app.selectedStopIndex ? " selected" : ""}`;
    marker.style.left = `${clamp(stop.value, 0, 1) * 100}%`;
    marker.style.setProperty("--stop-color", stop.color);
    marker.title = `${Math.round(stop.value * 1000) / 10}% ${stop.color}`;
    marker.addEventListener("click", (event) => {
      event.stopPropagation();
      app.selectedStopIndex = index;
      renderGradientEditor();
    });
    marker.addEventListener("pointerdown", (event) => startStopDrag(event, index));
    els.gradientStops.append(marker);
  });

  const stop = selectedStop();
  if (stop) updateColorInputs(stop.color, stop.value);

  const opacity = Number(layer.style?.opacity ?? gradient.opacity ?? 0.75);
  els.opacityInput.value = opacity;
  els.opacityValue.textContent = `${Math.round(opacity * 100)}%`;
  drawHsvWheel();
}

function startStopDrag(event, index) {
  event.preventDefault();
  app.selectedStopIndex = index;
  const move = (moveEvent) => {
    const rect = els.gradientStrip.getBoundingClientRect();
    const x = clamp((moveEvent.clientX - rect.left) / rect.width, 0, 1);
    const stop = selectedStop();
    if (!stop) return;
    stop.value = x;
    app.draftGradient.stops = sortedStops(app.draftGradient);
    app.selectedStopIndex = app.draftGradient.stops.indexOf(stop);
    applyDraftGradientLive();
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function updateColorInputs(color, position) {
  app.suppressInputs = true;
  const hex = normalizeHex(color) || "#000000";
  const rgb = hexToRgb(hex);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

  els.currentColorPreview.style.background = hex;
  els.nativeColorInput.value = hex;
  els.hexInput.value = hex;
  els.stopPositionInput.value = Math.round(clamp(position, 0, 1) * 1000) / 10;

  els.rgbR.value = els.rgbRNum.value = rgb.r;
  els.rgbG.value = els.rgbGNum.value = rgb.g;
  els.rgbB.value = els.rgbBNum.value = rgb.b;

  els.hsvH.value = els.hsvHNum.value = Math.round(hsv.h);
  els.hsvS.value = els.hsvSNum.value = Math.round(hsv.s * 10) / 10;
  els.hsvV.value = els.hsvVNum.value = Math.round(hsv.v * 10) / 10;
  app.suppressInputs = false;
}

function setSelectedStopColor(hex) {
  if (app.suppressInputs) return;
  const normalized = normalizeHex(hex);
  if (!normalized) return;
  const stop = selectedStop();
  if (!stop) return;
  stop.color = normalized;
  applyDraftGradientLive();
}

function setSelectedStopPosition(percent) {
  if (app.suppressInputs) return;
  const stop = selectedStop();
  if (!stop) return;
  stop.value = clamp(Number(percent) / 100, 0, 1);
  app.draftGradient.stops = sortedStops(app.draftGradient);
  app.selectedStopIndex = app.draftGradient.stops.indexOf(stop);
  applyDraftGradientLive();
}

function applyDraftGradientLive() {
  const layer = selectedLayer();
  if (!layer) return;
  const gradient = currentDraftGradient();
  const existingIndex = app.payload.gradients.findIndex((item) => item.id === gradient.id);
  if (existingIndex >= 0) app.payload.gradients[existingIndex] = deepCopy(gradient);
  else app.payload.gradients.push(deepCopy(gradient));
  layer.style = layer.style || {};
  layer.style.gradient_id = gradient.id;
  renderGradientEditor();
  renderMapLayers();
}

function saveDraftGradient() {
  const layer = selectedLayer();
  if (!layer) return;
  const gradient = currentDraftGradient();
  const name = els.gradientNameInput.value.trim() || gradient.name || "Custom gradient";
  gradient.name = name;
  gradient.id = slugify(name);
  gradient.opacity = Number(layer.style?.opacity ?? gradient.opacity ?? 0.75);
  gradient.score_min = Number(layer.style?.score_min ?? gradient.score_min ?? 0);
  gradient.score_max = Number(layer.style?.score_max ?? gradient.score_max ?? 1);
  gradient.updated_at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const existingIndex = app.payload.gradients.findIndex((item) => item.id === gradient.id);
  if (existingIndex >= 0) app.payload.gradients[existingIndex] = deepCopy(gradient);
  else app.payload.gradients.push(deepCopy(gradient));

  layer.style = layer.style || {};
  layer.style.gradient_id = gradient.id;
  layer.style.opacity = Number(els.opacityInput.value);
  app.draftGradient = deepCopy(gradient);
  renderAll();
  saveNow("Gradient saved");
}

function slugify(value) {
  const slug = String(value || "gradient").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return slug || "gradient";
}

function addStop() {
  const gradient = currentDraftGradient();
  const stop = selectedStop() || { value: 0.5, color: "#ffffff" };
  const newStop = { value: clamp(stop.value + 0.08, 0, 1), color: stop.color };
  gradient.stops.push(newStop);
  gradient.stops = sortedStops(gradient);
  app.selectedStopIndex = gradient.stops.indexOf(newStop);
  applyDraftGradientLive();
}

function deleteStop() {
  const gradient = currentDraftGradient();
  if (gradient.stops.length <= 2) {
    setStatus("Gradient needs at least two stops");
    return;
  }
  gradient.stops.splice(app.selectedStopIndex, 1);
  app.selectedStopIndex = Math.max(0, Math.min(app.selectedStopIndex, gradient.stops.length - 1));
  applyDraftGradientLive();
}

function drawHsvWheel() {
  const canvas = els.hsvWheel;
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 2;
  const v = Number(els.hsvV.value || 100);
  const image = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const index = (y * width + x) * 4;
      if (dist <= radius) {
        let hue = Math.atan2(dy, dx) * 180 / Math.PI;
        if (hue < 0) hue += 360;
        const sat = dist / radius * 100;
        const rgb = hsvToRgb(hue, sat, v);
        image.data[index] = rgb.r;
        image.data[index + 1] = rgb.g;
        image.data[index + 2] = rgb.b;
        image.data[index + 3] = 255;
      } else {
        image.data[index + 3] = 0;
      }
    }
  }

  ctx.clearRect(0, 0, width, height);
  ctx.putImageData(image, 0, 0);

  const h = Number(els.hsvH.value || 0) * Math.PI / 180;
  const s = clamp(els.hsvS.value || 0, 0, 100) / 100;
  const px = cx + Math.cos(h) * s * radius;
  const py = cy + Math.sin(h) * s * radius;
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#111827";
  ctx.stroke();
}

function setHsvFromWheel(event) {
  const rect = els.hsvWheel.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const dx = event.clientX - rect.left - cx;
  const dy = event.clientY - rect.top - cy;
  const radius = Math.min(cx, cy) - 2;
  const dist = Math.min(Math.sqrt(dx * dx + dy * dy), radius);
  let hue = Math.atan2(dy, dx) * 180 / Math.PI;
  if (hue < 0) hue += 360;
  const sat = dist / radius * 100;
  const rgb = hsvToRgb(hue, sat, Number(els.hsvV.value || 100));
  setSelectedStopColor(rgbToHex(rgb.r, rgb.g, rgb.b));
}

function bindColorInputs() {
  els.nativeColorInput.addEventListener("input", () => setSelectedStopColor(els.nativeColorInput.value));
  els.hexInput.addEventListener("input", () => setSelectedStopColor(els.hexInput.value));
  els.stopPositionInput.addEventListener("input", () => setSelectedStopPosition(els.stopPositionInput.value));

  [["rgbR", "rgbRNum"], ["rgbG", "rgbGNum"], ["rgbB", "rgbBNum"]].forEach(([rangeId, numId]) => {
    const range = els[rangeId];
    const num = els[numId];
    const update = () => {
      if (app.suppressInputs) return;
      const rgb = {
        r: Number(els.rgbR.value),
        g: Number(els.rgbG.value),
        b: Number(els.rgbB.value)
      };
      setSelectedStopColor(rgbToHex(rgb.r, rgb.g, rgb.b));
    };
    range.addEventListener("input", () => { num.value = range.value; update(); });
    num.addEventListener("input", () => { range.value = num.value; update(); });
  });

  [["hsvH", "hsvHNum"], ["hsvS", "hsvSNum"], ["hsvV", "hsvVNum"]].forEach(([rangeId, numId]) => {
    const range = els[rangeId];
    const num = els[numId];
    const update = () => {
      if (app.suppressInputs) return;
      const rgb = hsvToRgb(Number(els.hsvH.value), Number(els.hsvS.value), Number(els.hsvV.value));
      setSelectedStopColor(rgbToHex(rgb.r, rgb.g, rgb.b));
    };
    range.addEventListener("input", () => { num.value = range.value; update(); });
    num.addEventListener("input", () => { range.value = num.value; update(); });
  });

  els.opacityInput.addEventListener("input", () => {
    const layer = selectedLayer();
    if (!layer) return;
    layer.style = layer.style || {};
    layer.style.opacity = Number(els.opacityInput.value);
    els.opacityValue.textContent = `${Math.round(layer.style.opacity * 100)}%`;
    renderMapLayers();
    scheduleSave();
  });

  els.hsvWheel.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setHsvFromWheel(event);
    const move = (moveEvent) => setHsvFromWheel(moveEvent);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });

  element.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      element.querySelectorAll(".tab-button").forEach((item) => item.classList.remove("active"));
      element.querySelectorAll(".color-panel").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      element.querySelector(`#${button.dataset.tab}Panel`).classList.add("active");
      drawHsvWheel();
    });
  });
}

function bindPaneResizer() {
  els.resizer.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    root.classList.add("resizing");
    const rect = root.getBoundingClientRect();
    const move = (moveEvent) => {
      const panelWidth = clamp(rect.right - moveEvent.clientX, 320, Math.min(720, rect.width - 460));
      root.style.setProperty("--panel-width", `${panelWidth}px`);
      if (app.map) app.map.resize();
    };
    const up = () => {
      root.classList.remove("resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

function renderAll() {
  renderLayerList();
  renderGradientEditor();
  renderMapLayers();
}

function scheduleSave() {
  clearTimeout(app.saveTimer);
  app.saveTimer = setTimeout(() => saveNow(), 350);
}

async function saveNow(message) {
  if (!app.payload) return;
  try {
    const result = await server.save_frontend_payload({
      state: app.payload.state,
      gradients: app.payload.gradients
    });
    if (result?.payload) app.payload = result.payload;
    if (message) setStatus(message);
  } catch (error) {
    setStatus(`Save failed: ${error.message || error}`);
  }
}

async function reloadPayload(message) {
  try {
    app.payload = await server.get_frontend_payload();
    app.draftGradient = null;
    app.selectedStopIndex = 0;
    renderAll();
    if (message) setStatus(message);
  } catch (error) {
    setStatus(`Load failed: ${error.message || error}`);
  }
}

async function createLayer() {
  const prompt = els.promptInput.value.trim();
  if (!prompt) {
    setStatus("Prompt is empty");
    return;
  }
  setStatus("Creating mock layer...");
  try {
    app.payload = await server.create_layer_from_prompt(prompt);
    els.promptInput.value = "";
    app.draftGradient = null;
    app.selectedStopIndex = 0;
    renderAll();
    setStatus("Layer created");
  } catch (error) {
    setStatus(`Create failed: ${error.message || error}`);
  }
}

async function deleteLayer(layerId, layerName) {
  if (!window.confirm(`Delete layer "${layerName}"?`)) return;
  setStatus("Deleting layer...");
  try {
    app.payload = await server.delete_layer_by_id(layerId);
    app.draftGradient = null;
    app.selectedStopIndex = 0;
    renderAll();
    setStatus("Layer deleted");
  } catch (error) {
    setStatus(`Delete failed: ${error.message || error}`);
  }
}

function bindActions() {
  els.createLayerButton.addEventListener("click", createLayer);
  els.promptInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") createLayer();
  });
  els.refreshButton.addEventListener("click", () => reloadPayload("Reloaded"));
  els.addStopButton.addEventListener("click", addStop);
  els.deleteStopButton.addEventListener("click", deleteStop);
  els.saveGradientButton.addEventListener("click", saveDraftGradient);
  els.gradientNameInput.addEventListener("input", () => {
    const gradient = currentDraftGradient();
    gradient.name = els.gradientNameInput.value;
  });
  els.gradientStrip.addEventListener("dblclick", (event) => {
    const rect = els.gradientStrip.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const gradient = currentDraftGradient();
    const color = selectedStop()?.color || "#ffffff";
    const newStop = { value: x, color };
    gradient.stops.push(newStop);
    gradient.stops = sortedStops(gradient);
    app.selectedStopIndex = gradient.stops.indexOf(newStop);
    applyDraftGradientLive();
  });
}

async function boot() {
  setStatus("Loading state");
  bindPaneResizer();
  bindColorInputs();
  bindActions();
  bootMap();
  await reloadPayload("Ready");
}

boot();
"""
