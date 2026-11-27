import { useState, useEffect } from "react";
import { Glass, GlassButton, GlassDialog, GlassContentSwitch, GlassScrollArea } from "@form-glass/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TUTORIAL_PAGES, type TutorialPage } from "../state/tutorialContent";

export function ExhibitIntroModal({ open, version, onClose, pages = TUTORIAL_PAGES }: { open: boolean; version: number; onClose: () => void; pages?: TutorialPage[] }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<TourHighlightRect | null>(null);
  useEffect(() => { if (open) setPageIndex(0); }, [open, version]);
  const page = pages[pageIndex];
  const isFirst = pageIndex === 0;


  useEffect(() => {
    if (!open) return;
    // The welcome page focuses on the introduction rather than a specific control.
    if (!page.target) {
      setHighlightRect(null);
      return;
    }
    let activeElement: HTMLElement | null = null;
    let settleTimer: number | undefined;

    const setActiveElement = (element: HTMLElement | null) => {
      if (activeElement === element) return;
      activeElement?.classList.remove("tour-target-active");
      activeElement = element;
      activeElement?.classList.add("tour-target-active");
    };

    const resolveTarget = () =>
      document.querySelector<HTMLElement>(`[data-tour-target="${page.target}"]`) ??
      document.querySelector<HTMLElement>('[data-tour-target="map"]');

    const updateHighlight = () => {
      const target = resolveTarget();
      setActiveElement(target);
      if (!target) {
        setHighlightRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = 8;
      const left = Math.max(8, rect.left - padding);
      const top = Math.max(8, rect.top - padding);
      const width = Math.min(window.innerWidth - left - 8, rect.width + padding * 2);
      const height = Math.min(window.innerHeight - top - 8, rect.height + padding * 2);
      setHighlightRect({ left, top, width, height });
    };

    const target = resolveTarget();
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    updateHighlight();
    settleTimer = window.setTimeout(updateHighlight, 360);
    window.addEventListener("resize", updateHighlight);
    window.addEventListener("scroll", updateHighlight, true);

    return () => {
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
      window.removeEventListener("resize", updateHighlight);
      window.removeEventListener("scroll", updateHighlight, true);
      activeElement?.classList.remove("tour-target-active");
      setHighlightRect(null);
    };
  }, [page.target, open]);

  return (
    <>
      {open && isFirst && <Glass className="tutorial-focus-backdrop" fade={[]} shape="flush" material="tutorial-focus" aria-hidden="true" />}
      {open && !isFirst && highlightRect && <div className="tour-highlight-frame" style={highlightRect} />}
      <GlassDialog open={open} onOpenChange={next => { if (!next) onClose(); }}
        title="UrbanFabric tutorial" closeLabel="Close tutorial" className="exhibit-modal">
        <GlassContentSwitch value={String(pageIndex)} render={key => {
          const displayed = pages[Number(key)];
          return <>
            <div className="intro-progress-row" aria-label={`Tutorial step ${Number(key) + 1} of ${pages.length}`}>
              {pages.map((item, index) => <GlassButton className={`intro-progress-dot${index === Number(key) ? " is-active" : ""}`}
                key={item.eyebrow} onClick={() => setPageIndex(index)} title={item.title} aria-label={`Step ${index + 1}: ${item.title}`} />)}
            </div>
            <GlassScrollArea maxHeight="48dvh" label="Tutorial content">
              <span className="intro-page-eyebrow">{displayed.eyebrow}</span>
              <h3>{displayed.title}</h3><p>{displayed.body}</p>
              {displayed.items.length > 0 && <ul className="intro-step-list">{displayed.items.map(item => <li key={item}>{item}</li>)}</ul>}
            </GlassScrollArea>
            <div className="intro-modal-footer">
              <GlassButton onClick={onClose}>Skip tutorial</GlassButton>
              <div className="intro-modal-actions">
                <GlassButton onClick={() => setPageIndex(index => Math.max(0, index - 1))} disabled={Number(key) === 0}><ChevronLeft size={16}/>Back</GlassButton>
                <GlassButton onClick={() => Number(key) === pages.length - 1 ? onClose() : setPageIndex(index => index + 1)}>
                  {Number(key) === pages.length - 1 ? "Start exploring" : "Next"}<ChevronRight size={16}/>
                </GlassButton>
              </div>
            </div>
          </>;
        }}/>
      </GlassDialog>
    </>
  );
}

type TourHighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};
