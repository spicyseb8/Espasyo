import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useProgress } from "@react-three/drei";
import NavBar from "./NavBar";
import { WAYPOINTS } from "./Waypoints";
import "./Home.css";

const RoomScene = lazy(() => import("./Roomscene"));

const SPRING = { type: "spring", bounce: 0, duration: 0.45 } as const;

// Lives at module level so it survives SPA route changes.
let hasLoadedOnce = false;

const FEATURES = [
  { title: "See it in 3D", body: "Walk through every room before anything is built or bought." },
  { title: "Arrange and choose", body: "Move furniture and try materials and finishes." },
  { title: "Know the cost", body: "Your estimate updates as you change the design." },
];

const pad = (n: number) => String(n).padStart(2, "0");

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
  const progress = useRef(0); // 0 → WAYPOINTS.length - 1, read by the 3D rig

  // active: -1 = hero, 0..n-1 = rooms
  const [active, setActive] = useState(-1);
  const [showDots, setShowDots] = useState(false);
  const [ready, setReady] = useState(hasLoadedOnce);

  const handleLoaded = useCallback(() => {
    hasLoadedOnce = true;
    setReady(true);
  }, []);

  /*
   * Stage = (N + 1) viewport-heights. Panel 0 is the hero (camera parked on
   * room 1). Room i is reached when panel i + 1's top hits the viewport top.
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

  const goTo = (index: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageTop = stage.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: stageTop + (index + 1) * window.innerHeight,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  const heroOn = active === -1 && ready;
  const rise = reduce ? 0 : 14;

  return (
    <div className="home">
      <NavBar />

      <div className="home__stage" ref={stageRef}>
        {/* Sticky 3D canvas: pinned for the whole stage, hero included */}
        <div className="home__canvas">
          <Suspense fallback={null}>
            <RoomScene progress={progress} onLoaded={handleLoaded} />
          </Suspense>

          <motion.div
            className="home__scrim"
            aria-hidden
            animate={{ opacity: heroOn ? 1 : 0 }}
            transition={{ duration: 0.5 }}
          />
          <div className="home__vignette" aria-hidden />
          <LoadingOverlay ready={ready} />
        </div>

        <div className="home__stage-panels">
          {/* ───────── Hero (over room 1) ───────── */}
          <section className="home__panel home__panel--hero" aria-label="Introduction">
            <div className="home__container">
              <motion.div
                className="home__hero"
                initial={false}
                animate={{ opacity: heroOn ? 1 : 0, y: heroOn ? 0 : -rise }}
                transition={SPRING}
                style={{ pointerEvents: heroOn ? "auto" : "none" }}
                aria-hidden={!heroOn}
              >
                <p className="home__eyebrow">Design. Plan. Estimate.</p>
                <h1 className="home__large-title">
                  Walk through your
                  <br />
                  home before it exists.
                </h1>
                <p className="home__hero-subhead">
                  Lay out rooms in 3D, place real furniture, pick materials, and
                  watch your project cost update live.
                </p>

                <div className="home__cta-row">
                  <Link to="/signup" className="home__cta" tabIndex={heroOn ? 0 : -1}>
                    Start designing
                    <ArrowRight className="home__cta-icon" strokeWidth={2} />
                  </Link>
                  <Link to="/library" className="home__cta-ghost" tabIndex={heroOn ? 0 : -1}>
                    Browse the library
                  </Link>
                </div>

                <ul className="home__feature-grid">
                  {FEATURES.map((f) => (
                    <li key={f.title} className="home__feature">
                      <h2 className="home__feature-title">{f.title}</h2>
                      <p className="home__feature-body">{f.body}</p>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            <div className="home__scroll-cue" aria-hidden>
              <span>Scroll to step inside</span>
              <i />
            </div>
          </section>

          {/* ───────── One panel per room ───────── */}
          {WAYPOINTS.map((wp, i) => (
            <section key={wp.id} className="home__panel" aria-label={wp.name}>
              <div className="home__container">
                <motion.div
                  className="home__caption"
                  initial={false}
                  animate={{ opacity: active === i ? 1 : 0, y: active === i ? 0 : rise }}
                  transition={SPRING}
                >
                  <p className="home__room-index">
                    {pad(i + 1)} <span>/ {pad(WAYPOINTS.length)}</span>
                  </p>
                  <h2 className="home__heading-2">{wp.name}</h2>
                  <p className="home__caption-body">{wp.blurb}</p>
                  <div className="home__caption-track" aria-hidden>
                    <div
                      className="home__caption-fill"
                      style={{ transform: `scaleX(${(i + 1) / WAYPOINTS.length})` }}
                    />
                  </div>
                </motion.div>
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* ───────── Footer ───────── */}
      <footer className="home__footer">
        <div className="home__container">
          <div className="home__footer-cta">
            <p className="home__eyebrow home__eyebrow--light">Your turn</p>
            <h2 className="home__footer-title">
              Ready to design
              <br />
              the real thing?
            </h2>
            <Link to="/signup" className="home__cta home__cta--light">
              Start designing
              <ArrowRight className="home__cta-icon" strokeWidth={2} />
            </Link>
          </div>

          <div className="home__footer-bottom">
            <p>© {new Date().getFullYear()} Espasyo. All rights reserved.</p>
            <nav aria-label="Footer">
              <Link to="/library">Library</Link>
              <Link to="/studio">Studio</Link>
              <Link to="/signup">Sign up</Link>
            </nav>
          </div>
        </div>
      </footer>

      {/* Room navigation (only while inside the rooms) */}
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
            aria-label={`Go to ${wp.name}`}
            aria-current={active === i}
            tabIndex={showDots ? 0 : -1}
            onClick={() => goTo(i)}
          >
            <span className="home__dot-label">{wp.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}