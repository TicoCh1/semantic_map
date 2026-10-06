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
  // The expanded view is not a compact view's foreground. Keep it out of paint
  // until FORM has hidden the old view and prepared the expansion geometry.
  const present = shown;

  const blurControls = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && dock.current?.contains(active)) active.blur();
  }, []);
  const closeControls = useCallback(() => {
    setPinned(false);
    blurControls();
    dock.current?.querySelector<HTMLElement>(".controls-launcher")?.focus({ preventScroll: true });
  }, [blurControls]);

  const prepareReveal = useCallback((opening: boolean) => {
    if (opening) setShown(true);
  }, []);
  const commitReveal = useCallback((opening: boolean) => {
    // FORM may reveal compact contents after contraction. This drawer has only
    // an external launcher, so there is no compact foreground to show again.
    if (!opening) setShown(false);
  }, []);
  // A fixed external launcher and persistent, resizable contents require the
  // public low-level reveal API; FORM still owns all phase/geometry animation.
  const revealOriginBox = useCallback(() => {
    const rect = dock.current?.querySelector(".controls-launcher")?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height, left: rect.left, top: rect.top } : null;
  }, []);

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
          reveal={open} onRevealPrepare={prepareReveal} onRevealCommit={commitReveal}
          revealOriginBox={revealOriginBox} aria-hidden={!open}>
          <div className="split-resizer" onPointerDown={startDrag} title="Resize controls" />
          <aside id="map-controls" className="split-side" aria-label="Map controls"><GlassScrollArea className="control-scroll" viewportClassName="control-scroll-viewport" label="Scroll map controls" height="100%">{right}</GlassScrollArea></aside>
          {footer && <footer className="sidebar-footer">{footer}</footer>}
        </Glass>
      </div>
    </div>
  );
}
