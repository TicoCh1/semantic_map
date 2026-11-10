// Pure manifest adapter; importing it never fetches data or starts computation.
export function atlasDatasets(manifest, manifestUrl) {
  if (manifest.dataset !== "london_512_8_45_8B" || !Number.isInteger(manifest.sourceRows) || manifest.sourceRows < 1 ||
      !Array.isArray(manifest.layers) || !manifest.layers.length) {
    throw new Error("Expected a completed London 4096D atlas export");
  }
  const base = new URL("./", manifestUrl);
  const resolve = (path) => {
    if (typeof path !== "string" || !path || path.split("/").includes("..")) {
      throw new Error("Invalid atlas binary path");
    }
    const url = new URL(path, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
      throw new Error("Atlas binaries must stay inside the exported data directory");
    }
    return url.href;
  };
  const layers = [...manifest.layers].sort((a, b) => Number(a.id.slice(0, -2)) - Number(b.id.slice(0, -2)));
  const seen = new Set();
  const center = [], grouped = [], groups = [];
  layers.forEach((layer, index) => {
    const scale = Number(layer.id.slice(0, -2));
    if (![2, 4, 8, 16, 32].includes(scale) || seen.has(scale) || layer.id !== `${scale}km`) {
      throw new Error("Invalid or duplicate atlas scale");
    }
    seen.add(scale);
    if (layer.colorMatrix !== "identity" || layer.recordBytes !== 12 || layer.count !== manifest.sourceRows ||
        layer.byteLength !== layer.count * 12) {
      throw new Error("Atlas grouped records or native palette are inconsistent");
    }
    const patch = layer.patches?.find((p) => p.grid?.x === 0 && p.grid?.y === 0);
    if (!patch || patch.colorMatrix !== "identity" || patch.byteLength !== patch.count * 12) {
      throw new Error("Atlas central patch is missing or inconsistent");
    }
    const whole = layer.coverageMode === "whole_dataset" || scale === 32;
    if (whole && (layer.patches.length !== 1 || patch.count !== manifest.sourceRows)) {
      throw new Error("Whole-city layer must contain one central patch covering every source row");
    }
    const shared = { label: whole ? "Whole city" : `${scale} km grid`, wholeDataset: whole,
      radiusMeters: scale * 1000, boundaryMeters: scale * 1800, scaleIndex: index,
      colorMatrix: "identity" };
    center.push({ ...shared, id: `webmercator-center:atlas-${scale}km`, datasetId: "webmercator-center",
      url: resolve(`${scale}km/${patch.bin}`), count: patch.count, byteLength: patch.byteLength, bounds: patch.bounds });
    grouped.push({ ...shared, id: `webmercator-grid:atlas-${scale}km`, datasetId: "webmercator-grid",
      url: resolve(layer.bin), count: layer.count, byteLength: layer.byteLength, bounds: layer.bounds,
      patchCount: layer.patches.length });
    groups.push({ radiusMeters: whole ? null : scale * 1000, patches: layer.patches });
  });
  if (!seen.has(2) || !Array.isArray(manifest.readyScalesKm) ||
      manifest.readyScalesKm.length !== seen.size || new Set(manifest.readyScalesKm).size !== seen.size ||
      manifest.readyScalesKm.some((s) => !seen.has(s))) {
    throw new Error("Atlas readiness metadata must include 2 km and match exported scales");
  }
  return { center, grouped, groups };
}

export function scaleOpacities(layers, meters, activeFraction = .8) {
  const result = new Array(layers.length).fill(0);
  if (!layers.length) return result;
  if (layers.length === 1 || meters <= layers[0].boundaryMeters) {
    result[0] = 1;
    return result;
  }
  for (let index = 0; index < layers.length - 1; index += 1) {
    const start = layers[index].boundaryMeters, end = layers[index + 1].boundaryMeters;
    if (meters > end) continue;
    const fadeEnd = start + (end - start) * activeFraction;
    const t = Math.min(1, Math.max(0, (meters - start) / Math.max(fadeEnd - start, 1)));
    const energy = Math.hypot(1 - t, t) || 1;
    result[index] = (1 - t) / energy;
    result[index + 1] = t / energy;
    return result;
  }
  result[result.length - 1] = 1;
  return result;
}
