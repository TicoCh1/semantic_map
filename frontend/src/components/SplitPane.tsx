import { type CSSProperties, type ReactNode, useCallback, useState } from "react";

type SplitPaneProps = {
  left: ReactNode;
  right: ReactNode;
  className?: string;
};

export function SplitPane({ left, right, className = "" }: SplitPaneProps) {
  const [rightWidth, setRightWidth] = useState(430);
  const [dragging, setDragging] = useState(false);

  const startDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
    const shell = event.currentTarget.parentElement;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();

    const onMove = (moveEvent: PointerEvent) => {
      const width = Math.max(340, Math.min(760, rect.right - moveEvent.clientX));
      setRightWidth(width);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  return (
    <div className={`split-pane ${className}${dragging ? " is-dragging" : ""}`} style={{ "--right-width": `${rightWidth}px` } as CSSProperties}>
      <main className="split-main">{left}</main>
      <div className="split-resizer" onPointerDown={startDrag} />
      <aside className="split-side">{right}</aside>
    </div>
  );
}
