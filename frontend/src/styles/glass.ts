import type { GlassGeometry } from "@form-glass/react";
export type { GlassGeometry } from "@form-glass/react";

/** Vendor DOM keeps its events; React portals supply the package material. */
export type VendorSurface = { id: number; host: Element; mount: HTMLElement; geometry: GlassGeometry };
const surfaces = new Map<Element, VendorSurface>();
const listeners = new Set<() => void>();
let snapshot: VendorSurface[] = [];
let nextId = 0;
function publish() { snapshot = [...surfaces.values()]; listeners.forEach(listener => listener()); }
export const subscribeVendorGlass = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getVendorGlass = () => snapshot;

export function applyGlassSurface(host: Element | null, geometry: GlassGeometry = {}) {
  if (!host || surfaces.has(host)) return;
  const mount = document.createElement("span");
  mount.className = "vendor-glass-mount";
  mount.setAttribute("aria-hidden", "true");
  host.setAttribute("data-vendor-glass", "");
  host.setAttribute("data-glass-audit-ignore", "vendor-adapter");
  host.prepend(mount);
  surfaces.set(host, { id: ++nextId, host, mount, geometry: { ...geometry, fade: [] } });
  publish();
}
function forgetSurface(host: Element) {
  const surface = surfaces.get(host);
  if (!surface) return;
  surfaces.delete(host); surface.mount.remove(); host.removeAttribute("data-vendor-glass"); host.removeAttribute("data-glass-audit-ignore");
}
function observeVendorGlass(container: HTMLElement, selector: string, geometry: (element: Element) => GlassGeometry) {
  const scan = (element: Element) => {
    if (element.matches(selector)) applyGlassSurface(element, geometry(element));
    element.querySelectorAll(selector).forEach(control => applyGlassSurface(control, geometry(control)));
  };
  scan(container);
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) if (node instanceof Element && !node.closest(".vendor-glass-mount")) scan(node);
    }
    let changed = false;
    for (const surface of surfaces.values()) {
      if (!surface.host.isConnected) { forgetSurface(surface.host); changed = true; }
    }
    if (changed) publish();
  });
  observer.observe(container, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    for (const surface of surfaces.values()) if (container.contains(surface.host)) forgetSurface(surface.host);
    publish();
  };
}
export function observeMapGlass(container: HTMLElement) {
  return observeVendorGlass(container, ".maplibregl-ctrl-group", () => ({ material: "control" }));
}
export function observePanoramaGlass(container: HTMLElement) {
  return observeVendorGlass(container, ".psv-navbar, .psv-panel, .psv-tooltip, .psv-notification-content", element => ({
    shape: element.classList.contains("psv-navbar") ? "flush" : "rectangle"
  }));
}
