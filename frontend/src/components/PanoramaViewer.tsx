import { Viewer } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";
import { useEffect, useRef, type ReactNode } from "react";

type PanoramaViewerProps = {
  panoramaUrl?: string | null;
  className?: string;
  children?: ReactNode;
};

export function PanoramaViewer({ panoramaUrl, className = "", children }: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !panoramaUrl) {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      return;
    }

    viewerRef.current?.destroy();
    viewerRef.current = new Viewer({
      container,
      panorama: panoramaUrl,
      navbar: ["zoom", "move", "fullscreen"],
      mousewheel: true,
      defaultZoomLvl: 45,
      loadingTxt: "Loading"
    });

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [panoramaUrl]);

  return (
    <div className={className} ref={containerRef}>
      {children}
    </div>
  );
}
