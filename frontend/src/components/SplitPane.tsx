import { GlassScrollArea } from "@form-glass/react";
import { GlassSwitch, Glass } from "@form-glass/react";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from "react";

type SplitPaneProps = {
  left: ReactNode;
  right: ReactNode;
  footer?: ReactNode;
  className?: string;
  revealControls?: boolean;
  controlsRequest?: { open: boolean };
};

export function SplitPane({ left, right, footer, className = "", revealControls = false, controlsRequest }: SplitPaneProps) {
  const dock = useRef<HTMLDivElement>(null);
  const [rightWidth, setRightWidth] = useState(430);
  const [dragging, setDragging] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [sheet, setSheet] = useState(() => matchMedia("(max-width: 1023px)").matches);
  useEffect(() => {
    const media = matchMedia("(max-width: 1023px)");
    const update = () => setSheet(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const open = revealControls || dragging || pinned;
  useEffect(() => { if (controlsRequest) setPinned(controlsRequest.open); }, [controlsRequest]);

  useEffect(() => {
    const drawer = dock.current?.querySelector<HTMLElement>(".sidebar-drawer");
    if (drawer) drawer.inert = !open;
  }, [open]);

  const blurControls = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && dock.current?.contains(active)) active.blur();
  }, []);
  const closeControls = useCallback(() => {
    setPinned(false);
    blurControls();
    dock.current?.querySelector<HTMLElement>(".controls-launcher")?.focus({ preventScroll: true });
  }, [blurControls]);

  const startDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const shell = event.currentTarget.closest(".split-pane");
    if (!shell) return;
    setDragging(true);
    const rect = shell.getBoundingClientRect();

    const onMove = (moveEvent: PointerEvent) => {
      const width = Math.max(340, Math.min(760, rect.right - moveEvent.clientX));
      setRightWidth(width);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, []);

  return (
    <div className={`split-pane ${className}${dragging ? " is-dragging" : ""}`} style={{ "--right-width": `${rightWidth}px` } as CSSProperties}>
      <main className="split-main">{left}</main>
      <div
        ref={dock}
        className={`sidebar-dock${open ? " is-open" : ""}${pinned ? " is-pinned" : ""}`}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          // A select handles its own Escape at the trigger as well as the list.
          if (event.target instanceof Element && (event.target.closest(".glass-select-popover") ||
            event.target.closest('.glass-select')?.querySelector('[aria-expanded="true"]'))) return;
          event.preventDefault();
          closeControls();
        }}
      >
        <GlassSwitch className="controls-launcher controls-state-switch" label="Controls"
          ariaLabel="Map controls" checked={open}
          onChange={(next) => { if (next) setPinned(true); else closeControls(); }} />
        <Glass className="sidebar-drawer" fade={[sheet ? "top" : "left"]} shape="flush" aria-hidden={!open}>
          <div className="split-resizer" onPointerDown={startDrag} title="Resize controls" />
          <aside id="map-controls" className="split-side" aria-label="Map controls">
            <GlassScrollArea className="control-scroll" viewportClassName="control-scroll-viewport" label="Scroll map controls" height="100%">
              {right}
              {footer && <footer className="sidebar-footer">{footer}</footer>}
            </GlassScrollArea>
          </aside>
        </Glass>
      </div>
    </div>
  );
}
