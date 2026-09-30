import { GlassMaterial } from "../styles/GlassMaterial";
import { glassSurface } from "../styles/glass";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

type SplitPaneProps = {
  left: ReactNode;
  right: ReactNode;
  footer?: ReactNode;
  className?: string;
  revealControls?: boolean;
};

export function SplitPane({ left, right, footer, className = "", revealControls = false }: SplitPaneProps) {
  const dock = useRef<HTMLDivElement>(null);
  const keyboardInput = useRef(false);
  const [rightWidth, setRightWidth] = useState(430);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = revealControls || dragging || (!dismissed && (hovered || focused || pinned));

  const blurControls = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && dock.current?.contains(active)) active.blur();
  }, []);
  const closeControls = useCallback(() => {
    setPinned(false);
    setHovered(false);
    setFocused(false);
    // Explicit close wins over hover until the pointer leaves and enters again.
    setDismissed(true);
    blurControls();
  }, [blurControls]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Tab") keyboardInput.current = true; };
    const onPointer = (event: PointerEvent) => {
      keyboardInput.current = false;
      if (!dock.current?.contains(event.target as Node)) closeControls();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [closeControls]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onLayoutChange = () => { setHovered(false); setFocused(false); };
    desktop.addEventListener("change", onLayoutChange);
    return () => desktop.removeEventListener("change", onLayoutChange);
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
        className={`sidebar-dock${open ? " is-open" : ""}${pinned ? " is-pinned" : ""}`}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse" || !window.matchMedia("(min-width: 1024px)").matches) return;
          setDismissed(false); setHovered(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return;
          setHovered(false);
          setDismissed(false);
          if (!keyboardInput.current) {
            setFocused(false);
            if (!pinned) blurControls();
          }
        }}
        onFocusCapture={() => {
          setFocused(keyboardInput.current);
          if (keyboardInput.current) setDismissed(false);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          closeControls();
        }}
      >
        <button
          className="sidebar-rail"
          {...glassSurface({ shape: "flush", fade: [] })}
          type="button"
          aria-label={pinned ? "Close map controls" : "Pin map controls open"}
          aria-expanded={open}
          aria-controls="map-controls"
          aria-pressed={pinned}
          title={pinned ? "Click to close controls · Esc to close" : "Hover to explore · Click to pin controls"}
          onClick={() => {
            if (pinned) closeControls();
            else { setDismissed(false); setPinned(true); }
          }}
        ><GlassMaterial />
          {pinned ? <X size={16} strokeWidth={1.5} /> : <SlidersHorizontal size={16} strokeWidth={1.5} />}
          <span>{pinned ? "Close" : "Controls"}</span>
          <i aria-hidden="true" />
        </button>
        <div className="sidebar-drawer" {...glassSurface({ shape: "flush", fade: ["left"] })}><GlassMaterial />
          <div className="split-resizer" onPointerDown={startDrag} title="Resize controls" />
          <aside id="map-controls" className="split-side" aria-label="Map controls">{right}</aside>
          {footer && <footer className="sidebar-footer">{footer}</footer>}
        </div>
      </div>
    </div>
  );
}
