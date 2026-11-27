import { useState, type ReactNode } from "react";
import { SemanticGlassProvider } from "../styles/SemanticGlassProvider";
import { MapView, type MapViewProps } from "./MapView";
import { SplitPane } from "./SplitPane";

type Props = Omit<MapViewProps, "attributionHost"> & {
  dark: boolean;
  sidebar: ReactNode;
  revealControls?: boolean;
  initiallyOpen?: boolean;
  controlsRequest?: { open: boolean };
  children?: ReactNode;
};

export function MapWorkspace({ dark, sidebar, revealControls, initiallyOpen, controlsRequest, children, ...mapProps }: Props) {
  const [attributionHost, setAttributionHost] = useState<HTMLDivElement | null>(null);
  return <SemanticGlassProvider dark={dark}>
    <SplitPane className={dark ? "theme-dark" : ""} revealControls={revealControls} controlsRequest={controlsRequest} initiallyOpen={initiallyOpen}
      left={<MapView {...mapProps} attributionHost={attributionHost} />}
      right={sidebar}
      footer={<div ref={setAttributionHost} className="map-attribution" data-glass-audit-ignore="vendor-attribution" aria-label="Map attribution" />}
    />
    {children}
  </SemanticGlassProvider>;
}
