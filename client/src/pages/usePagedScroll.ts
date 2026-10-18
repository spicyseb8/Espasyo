import { useCallback, useEffect, useRef, type RefObject } from "react";

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const DURATION = 1100; // ms per step
const WHEEL_IDLE = 100; // ms of silence needed before a new wheel gesture counts
const SWIPE_MIN = 40; // px

/** Panels are 0..lastPanel (0 = hero). One gesture moves exactly one panel. */
export function usePagedScroll(
  stageRef: RefObject<HTMLElement | null>,
  lastPanel: number,
  reduce: boolean | null
) {
  const goRef = useRef<(k: number) => void>(() => {});

  useEffect(() => {
    let animating = false;
    let raf = 0;
    let lastWheel = 0;
    let touchY: number | null = null;

    const stageTop = () =>
      stageRef.current!.getBoundingClientRect().top + window.scrollY;
    const rel = () => (window.scrollY - stageTop()) / window.innerHeight;
    const inStage = () =>
      !!stageRef.current && rel() > -0.5 && rel() < lastPanel + 0.5;
    const panelAt = () => Math.round(rel());
    const hasNext = (dir: number) => {
      const t = panelAt() + dir;
      return t >= 0 && t <= lastPanel;
    };

    const goToPanel = (k: number) => {
      if (!stageRef.current) return;
      const target = Math.min(Math.max(k, 0), lastPanel);
      const to = stageTop() + target * window.innerHeight;
      const from = window.scrollY;
      if (reduce || from === to) {
        window.scrollTo({ top: to, behavior: "instant" as ScrollBehavior });
        return;
      }
      cancelAnimationFrame(raf);
      animating = true;
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / DURATION);
        window.scrollTo({
          top: from + (to - from) * easeInOut(t),
          behavior: "instant" as ScrollBehavior,
        });
        if (t < 1) raf = requestAnimationFrame(tick);
        else animating = false;
      };
      raf = requestAnimationFrame(tick);
    };
    goRef.current = goToPanel;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || !inStage()) return;
      const dir = Math.sign(e.deltaY);
      if (!dir || !hasNext(dir)) return; // let the page behave normally at the ends
      e.preventDefault();
      const now = performance.now();
      const gap = now - lastWheel;
      lastWheel = now; // trackpad inertia keeps resetting this, so it can't re-trigger
      if (animating || gap < WHEEL_IDLE || Math.abs(e.deltaY) < 4) return;
      goToPanel(panelAt() + dir);
    };

    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchY === null || !inStage()) return;
      const dir = Math.sign(touchY - e.touches[0].clientY);
      if (dir && hasNext(dir)) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchY === null) return;
      const dy = touchY - e.changedTouches[0].clientY;
      touchY = null;
      if (animating || !inStage() || Math.abs(dy) < SWIPE_MIN) return;
      const dir = Math.sign(dy);
      if (hasNext(dir)) goToPanel(panelAt() + dir);
    };

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (!inStage() || tag === "INPUT" || tag === "TEXTAREA") return;
      let dir = 0;
      if (
        ["ArrowDown", "PageDown"].includes(e.key) ||
        (e.key === " " && !e.shiftKey && tag !== "BUTTON" && tag !== "A")
      )
        dir = 1;
      else if (["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey))
        dir = -1;
      if (!dir || !hasNext(dir)) return;
      e.preventDefault();
      if (!animating) goToPanel(panelAt() + dir);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [stageRef, lastPanel, reduce]);

  return useCallback((k: number) => goRef.current(k), []);
}