import { GlassScrollArea } from "@form-glass/react";
import { GlassSwitch, Glass } from "@form-glass/react";
import { type CSSProperties, type ReactNode, useCallback, useRef, useState } from "react";

type SplitPaneProps = {
  left: ReactNode;
  right: ReactNode;
  footer?: ReactNode;
  className?: string;
  revealControls?: boolean;
};

export function SplitPane({ left, right, footer, className = "", revealControls = false }: SplitPaneProps) {
  const dock = useRef<HTMLDivElement>(null);
  const [rightWidth, setRightWidth] = useState(430);
  const [dragging, setDragging] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [shown, setShown] = useState(false);
  const open = revealControls || dragging || pinned;
  const present = open || shown;

  const blurControls = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && dock.current?.contains(active)) active.blur();
  }, []);
  const closeControls = useCallback(() => {
    setPinned(false);
    blurControls();
  }, [blurControls]);

  const prepareReveal = useCallback((opening: boolean) => {
    if (opening) setShown(true);
  }, []);
  const revealOriginBox = useCallback(() => ({
    width: 32,
    height: window.matchMedia("(min-width: 1024px)").matches ? (dock.current?.offsetHeight ?? window.innerHeight) : 44
  }), []);

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
        className={`sidebar-dock${open ? " is-open" : ""}${present ? " is-present" : ""}${pinned ? " is-pinned" : ""}`}
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
        <Glass className="sidebar-drawer" fade={["left"]} shape="flush"
          reveal={open} onRevealPrepare={prepareReveal} onRevealCommit={setShown}
          revealOriginBox={revealOriginBox} aria-hidden={!open}>
          <div className="split-resizer" onPointerDown={startDrag} title="Resize controls" />
          <aside id="map-controls" className="split-side" aria-label="Map controls"><GlassScrollArea className="control-scroll" viewportClassName="control-scroll-viewport" label="Scroll map controls">{right}</GlassScrollArea></aside>
          {footer && <footer className="sidebar-footer">{footer}</footer>}
        </Glass>
      </div>
    </div>
  );
}
