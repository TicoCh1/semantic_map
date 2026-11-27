import { Glass } from "@form-glass/react";
import type { ComponentProps } from "react";

/** Map chrome samples one surface; its controls share the same inset tint. */
export function MapGlassSurface(props: ComponentProps<typeof Glass>) {
  return <Glass {...props} data-map-glass-surface="" material="surface" />;
}
