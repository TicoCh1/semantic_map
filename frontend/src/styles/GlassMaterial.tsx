import { type CSSProperties, type ReactNode, useLayoutEffect, useRef } from "react";
import { GLASS_SAMPLES, glassSurface, observeGlassGeometry } from "./glass";

/** Decoration only: both React and vendor controls use these same CSS layers. */
export function GlassMaterial() {
  const renderer = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const host = renderer.current?.parentElement;
    if (host) return observeGlassGeometry(host);
  }, []);
  return <span className="glass-renderer" ref={renderer} aria-hidden="true">
    {GLASS_SAMPLES.map((sample) => <span
      className="glass-blur-layer"
      key={sample}
      style={{ "--glass-sample": sample } as CSSProperties}
    />)}
  </span>;
}

/** Native inputs cannot own decoration children, so keep their glass in a wrapper. */
export function GlassField({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass-field ${className}`} {...glassSurface({ material: "control", fade: [] })}>
    <GlassMaterial />
    {children}
  </div>;
}
