import { Glass, GlassProvider, type GlassValues } from "@form-glass/react";
import { type ReactNode, useLayoutEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getVendorGlass, subscribeVendorGlass } from "./glass";

// FORM owns the material defaults and channel curves; app surfaces select edges.
const values: Partial<GlassValues> = {
  blur: 14,
  "fade-distance": 32,
  "brightness-fade-distance": 32,
  "contrast-fade-distance": 32
};
// Bound the glass core on white panoramas (dark UI) and black maps (light UI).
const darkValues = { ...values, brightness: -55, contrast: .85 };
const lightValues = { ...values, brightness: 72, contrast: .30 };
function VendorGlassSurfaces() {
  const surfaces = useSyncExternalStore(subscribeVendorGlass, getVendorGlass);
  return <>{surfaces.map(surface => createPortal(
    <Glass {...surface.geometry} className="vendor-glass-surface" />,
    surface.mount, String(surface.id)
  ))}</>;
}
export function SemanticGlassProvider({ dark, children }: { dark: boolean; children: ReactNode }) {
  useLayoutEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#191b1e" : "#eceeeb");
  }, [dark]);
  return <GlassProvider theme={dark ? "dark" : "light"} values={dark ? darkValues : lightValues} fadeContents={false} diagnostics={import.meta.env.DEV}
    refractionEnabled={false} className="semantic-glass-app">
    {children}
    <VendorGlassSurfaces />
  </GlassProvider>;
}
