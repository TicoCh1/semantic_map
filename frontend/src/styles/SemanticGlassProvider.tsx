import { Glass, GlassProvider, type GlassValues } from "@form-glass/react";
import { type ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getVendorGlass, subscribeVendorGlass } from "./glass";

// FORM owns the material defaults and channel curves; app surfaces select edges.
const values: Partial<GlassValues> = {
  "fade-distance": 32,
  "brightness-fade-distance": 32,
  "contrast-fade-distance": 32
};
function VendorGlassSurfaces() {
  const surfaces = useSyncExternalStore(subscribeVendorGlass, getVendorGlass);
  return <>{surfaces.map(surface => createPortal(
    <Glass {...surface.geometry} className="vendor-glass-surface" />,
    surface.mount, String(surface.id)
  ))}</>;
}
export function SemanticGlassProvider({ dark, children }: { dark: boolean; children: ReactNode }) {
  return <GlassProvider theme={dark ? "dark" : "light"} values={values} fadeContents diagnostics={import.meta.env.DEV}
    refractionEnabled={false} className="semantic-glass-app">
    {children}
    <VendorGlassSurfaces />
  </GlassProvider>;
}
