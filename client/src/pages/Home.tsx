import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useProgress } from "@react-three/drei";
import NavBar from "./NavBar";
import { WAYPOINTS } from "./Waypoints";
import { usePagedScroll } from "./usePagedScroll";
import "./Home.css";

const RoomScene = lazy(() => import("./Roomscene"));

const SPRING = { type: "spring", bounce: 0, duration: 0.45 } as const;

// Lives at module level so it survives SPA route changes.
let hasLoadedOnce = false;

// Plain names for the side navigation, in camera order. These label the dots
// only; they are not used for any homepage copy.
const DOT_LABELS = ["Living room", "Bedroom", "Kitchen"];
const dotLabel = (i: number, fallback: string) => DOT_LABELS[i] ?? fallback;

/*
 * Text shown while the camera is in each room. This is its own content, not
 * read from WAYPOINTS: no counters, no room labels, no card. Each note sits on
 * an empty stretch of the view (see the placement rules in Home.css).
 *   place: "wall"  – the panelled wall, upper left
 *          "above" – the blank wall above the headboard
 *          "band"  – the plain front of the kitchen island, set as one row
 */
const NOTES = [
  {
    place: "wall",
    title: "Place every piece.",
    body: "Drop in a sofa, a rug, a floor lamp, and move them until the room works.",
  },
  {
    place: "above",
    title: "Change the finish, see the light.",
    body: "Swap wall colors and flooring, then check them under real lighting and shadows.",
  },
  {
    place: "band",
    title: "Watch the cost add up.",
    body: "Every item and material is priced, so the estimate updates as you design.",
  },
] as const;

function LoadingOverlay({ ready }: { ready: boolean }) {
  const { progress } = useProgress();
  return (
    <AnimatePresence>
      {!ready && (
        <motion.div
          className="home__loader"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="home__eyebrow">Loading your space</p>
          <div className="home__loader-bar">
            <div
              className="home__loader-fill"
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </div>
          <p className="home__loader-pct">{Math.round(progress)}%</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Home() {
  const reduce = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0); // 0 → WAYPOINTS.length - 1, read by the 3D rig

  // active: -1 = opening section, 0..n-1 = camera waypoints (scene navigation only)
  const [active, setActive] = useState(-1);
  const [showDots, setShowDots] = useState(false);
  const [footerOn, setFooterOn] = useState(false);
  const [ready, setReady] = useState(hasLoadedOnce);

  const handleLoaded = useCallback(() => {
    hasLoadedOnce = true;
    setReady(true);
  }, []);

  // One wheel / swipe / key press = exactly one panel (0 = opening, 1..N = rooms).
  const goToPanel = usePagedScroll(stageRef, WAYPOINTS.length, reduce);
  const goTo = (index: number) => goToPanel(index + 1); // dots still work

  /*
   * Stage = (N + 1) viewport-heights. Panel 0 is the opening section (camera
   * parked on room 1). Room i is reached when panel i + 1's top hits the
   * viewport top. The LAST waypoint is the footer: a dark gradient fades in
   * over it as the camera arrives and the footer content appears.
   *
   * The waypoints only drive the camera and the dots. The intro text is its
   * own section and just scrolls away; --hero-fade only softens it (and the
   * light wash behind it) as it leaves.
   */
  useEffect(() => {
    let raf = 0;
    const N = WAYPOINTS.length;

    const update = () => {
      raf = 0;
      const stage = stageRef.current;
      if (!stage) return;

      const vh = window.innerHeight;
      const stageTop = stage.getBoundingClientRect().top + window.scrollY;
      const rel = (window.scrollY - stageTop) / vh;

      const p = Math.min(Math.max(rel - 1, 0), N - 1);
      progress.current = p;

      const next = rel < 0.5 ? -1 : Math.round(p);
      setActive((prev) => (prev === next ? prev : next));

      const dots = rel > 0.5 && rel < N + 0.4;
      setShowDots((prev) => (prev === dots ? prev : dots));

      // Opening section fades as it scrolls off.
      const heroFade = Math.min(1, Math.max(0, 1 - rel * 1.4));
      stage.style.setProperty("--hero-fade", String(heroFade));

      // Dark gradient: starts a little way into the last camera move and is
      // fully in place when the camera lands on the last room.
      const fade = Math.min(1, Math.max(0, (p - (N - 2) - 0.35) / 0.65));
      canvasRef.current?.style.setProperty("--outro-fade", String(fade));

      // Footer content appears once the gradient is dark enough to read on.
      const footerVisible = p > N - 1.15;
      setFooterOn((prev) => (prev === footerVisible ? prev : footerVisible));
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const rise = reduce ? 0 : 14;
  const lastIndex = WAYPOINTS.length - 1;

  return (
    <div className="home">
      <NavBar />

      <div className="home__stage" ref={stageRef}>
        {/* Sticky 3D canvas: pinned for the whole stage */}
        <div className="home__canvas" ref={canvasRef}>
          <Suspense fallback={null}>
            <RoomScene progress={progress} onLoaded={handleLoaded} />
          </Suspense>

          {/* Light wash behind the intro text; fades out as you scroll */}
          <div className="home__scrim" aria-hidden />
          <div className="home__vignette" aria-hidden />

          {/* Dark gradient that fades in over the last room (driven by scroll) */}
          <div className="home__outro-scrim" aria-hidden />

          <LoadingOverlay ready={ready} />
        </div>

        <div className="home__stage-panels">
          {/* ───────── Opening section (independent of the waypoints) ───────── */}
          <section className="home__panel home__panel--hero" aria-labelledby="home-title">
            <div className="home__container">
              <div className="home__hero">
                <motion.div
                  initial={false}
                  animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : rise }}
                  transition={SPRING}
                >
                  <h1 id="home-title" className="home__large-title">
                    Walk through your
                    <br className="home__br" />
                    home before it exists.
                  </h1>
                  <p className="home__hero-subhead">
                    Build your rooms in 3D, place real furniture, choose
                    materials, and watch the estimate update as you design.
                  </p>

                  <div className="home__cta-row">
                    <Link to="/signup" className="home__cta">
                      Start designing
                      <ArrowRight className="home__cta-icon" strokeWidth={2} />
                    </Link>
                    <button
                      type="button"
                      className="home__cta-ghost"
                      onClick={() => goToPanel(1)}
                    >
                      Explore the experience
                    </button>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className="home__scroll-cue" aria-hidden>
              <span>Scroll to step inside</span>
              <i />
            </div>
          </section>

          {/* ───────── One empty panel per camera waypoint; the last is the footer ───────── */}
          {WAYPOINTS.map((wp, i) =>
            i === lastIndex ? (
              <section
                key={wp.id}
                className="home__panel home__panel--outro"
                aria-label="Get started"
              >
                <div className="home__container">
                  <motion.div
                    className="home__outro"
                    initial={false}
                    animate={{ opacity: footerOn ? 1 : 0, y: footerOn ? 0 : rise }}
                    transition={SPRING}
                    style={{ pointerEvents: footerOn ? "auto" : "none" }}
                    aria-hidden={!footerOn}
                  >
                    <div className="home__outro-cta">
                      <p className="home__eyebrow home__eyebrow--light">Your turn</p>
                      <h2 className="home__footer-title">
                        Ready to design
                        <br />
                        the real thing?
                      </h2>
                      <Link
                        to="/signup"
                        className="home__cta home__cta--light"
                        tabIndex={footerOn ? 0 : -1}
                      >
                        Start designing
                        <ArrowRight className="home__cta-icon" strokeWidth={2} />
                      </Link>
                    </div>

                    <footer className="home__footer-bottom">
                      <p>© {new Date().getFullYear()} Espasyo. All rights reserved.</p>
                      <nav aria-label="Footer">
                        <Link to="/library" tabIndex={footerOn ? 0 : -1}>Library</Link>
                        <Link to="/studio" tabIndex={footerOn ? 0 : -1}>Studio</Link>
                        <Link to="/signup" tabIndex={footerOn ? 0 : -1}>Sign up</Link>
                      </nav>
                    </footer>
                  </motion.div>
                </div>
              </section>
            ) : (
              <section
                key={wp.id}
                className="home__panel"
                aria-label={NOTES[i]?.title}
                aria-hidden={active !== i}
              >
                {NOTES[i] && (
                  <div className={`home__note home__note--${NOTES[i].place}`}>
                    <motion.h2
                      className="home__note-title"
                      initial={false}
                      animate={{ opacity: active === i ? 1 : 0, y: active === i ? 0 : rise }}
                      transition={SPRING}
                    >
                      {NOTES[i].title}
                    </motion.h2>
                    <motion.p
                      className="home__note-body"
                      initial={false}
                      animate={{ opacity: active === i ? 1 : 0, y: active === i ? 0 : rise }}
                      transition={{ ...SPRING, delay: active === i && !reduce ? 0.08 : 0 }}
                    >
                      {NOTES[i].body}
                    </motion.p>
                  </div>
                )}
              </section>
            ),
          )}
        </div>
      </div>

      {/* Camera navigation (only while inside the rooms) */}
      <nav
        className={`home__dots${showDots ? "" : " is-hidden"}`}
        aria-label="Rooms"
        aria-hidden={!showDots}
      >
        {WAYPOINTS.map((wp, i) => (
          <button
            key={wp.id}
            type="button"
            className={`home__dot${active === i ? " is-active" : ""}`}
            aria-label={i === lastIndex ? "Go to the end" : `Go to ${dotLabel(i, wp.name)}`}
            aria-current={active === i}
            tabIndex={showDots ? 0 : -1}
            onClick={() => goTo(i)}
          >
            <span className="home__dot-label">
              {i === lastIndex ? "Get started" : dotLabel(i, wp.name)}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}