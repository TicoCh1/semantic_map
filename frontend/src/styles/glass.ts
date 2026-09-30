import { DEFAULT_GLASS_FADE_CURVE, GLASS_SAMPLES, setGlassFadeCurve, syncGlassFadeMode } from "./glassFade";
export { GLASS_SAMPLES } from "./glassFade";

setGlassFadeCurve(DEFAULT_GLASS_FADE_CURVE);
syncGlassFadeMode();

/** Controls select a named material; all numerical recipes live in glass.css. */
export type GlassShape = "rectangle" | "square" | "capsule" | "flush";
export type GlassEdge = "top" | "right" | "bottom" | "left";
export type GlassGeometry = { shape?: GlassShape; fade?: readonly GlassEdge[]; material?: "surface" | "control" | "tutorial-focus" };

const ALL_EDGES: readonly GlassEdge[] = ["top", "right", "bottom", "left"];
const geometryObservers = new WeakMap<Element, () => void>();

/** Measure the actual core, so rounded masks stay anchored to the control,
 * including capsules and short rulers. Changing fade never changes its radius. */
export function observeGlassGeometry(element: HTMLElement) {
  geometryObservers.get(element)?.();
  const measure = () => {
    const { width, height } = element.getBoundingClientRect();
    element.style.setProperty("--glass-core-width", `${width}px`);
    element.style.setProperty("--glass-core-height", `${height}px`);
  };
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(element);
  const disconnect = () => { observer.disconnect(); geometryObservers.delete(element); };
  geometryObservers.set(element, disconnect);
  return disconnect;
}

export function glassSurface({ shape = "rectangle", fade = ALL_EDGES, material = "surface" }: GlassGeometry = {}) {
  return {
    "data-glass": "",
    "data-glass-material": material,
    "data-glass-shape": shape,
    "data-glass-fade": fade.join(" ")
  };
}

/** Bridge for controls owned by MapLibre or other DOM-based libraries. */
export function applyGlassSurface(element: Element | null, geometry: GlassGeometry = {}) {
  if (!element) return;
  for (const [name, value] of Object.entries(glassSurface(geometry))) element.setAttribute(name, value);
  // Vendor controls do not have a React owner. Give them the identical renderer.
  if (!element.querySelector(":scope > .glass-renderer")) {
    const renderer = document.createElement("span");
    renderer.className = "glass-renderer";
    renderer.setAttribute("aria-hidden", "true");
    for (const sample of GLASS_SAMPLES) {
      const layer = document.createElement("span");
      layer.className = "glass-blur-layer";
      layer.style.setProperty("--glass-sample", String(sample));
      renderer.append(layer);
    }
    element.prepend(renderer);
  }
  if (element instanceof HTMLElement && !geometryObservers.has(element)) observeGlassGeometry(element);
}

/** Vendor controls can replace their own children (e.g. the scale on every resize).
 * Restore decoration after those updates, without touching their foreground DOM. */
function observeVendorGlass(container: HTMLElement, selector: string, geometry: (element: Element) => GlassGeometry) {
  const scan = (element: Element) => {
    if (element.matches(selector)) applyGlassSurface(element, geometry(element));
    element.querySelectorAll(selector).forEach((control) => applyGlassSurface(control, geometry(control)));
  };
  scan(container);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.target instanceof Element && mutation.target.matches(selector)) scan(mutation.target);
      for (const node of mutation.addedNodes) if (node instanceof Element) scan(node);
      for (const node of mutation.removedNodes) if (node instanceof Element && !node.isConnected) {
        geometryObservers.get(node)?.();
        node.querySelectorAll("[data-glass]").forEach((control) => geometryObservers.get(control)?.());
      }
    }
  });
  observer.observe(container, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    container.querySelectorAll("[data-glass]").forEach((control) => geometryObservers.get(control)?.());
  };
}

export function observeMapGlass(container: HTMLElement) {
  // Attribution lives in the sidebar; the scale is plain foreground information.
  return observeVendorGlass(container, ".maplibregl-ctrl-group", () => ({ fade: ALL_EDGES }));
}

/** Panorama controls are created dynamically by the viewer, including tooltips. */
export function observePanoramaGlass(container: HTMLElement) {
  return observeVendorGlass(container, ".psv-navbar, .psv-panel, .psv-tooltip, .psv-notification-content", (element) => ({
    fade: element.classList.contains("psv-navbar") ? ["top"]
      : element.classList.contains("psv-panel") ? ["left"] : ALL_EDGES
  }));
}
