import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useProgress } from "@react-three/drei";
import NavBar from "./NavBar";
import { WAYPOINTS } from "./Waypoints";
import "./Home.css";

const RoomScene = lazy(() => import("./Roomscene"));

const SPRING = { type: "spring", bounce: 0, duration: 0.4 } as const;

// Lives at module level, so it survives navigating away and back (SPA route changes).
let hasLoadedOnce = false;

function LoadingOverlay({ ready }: { ready: boolean }) {
  const { progress } = useProgress();
  return (
    <AnimatePresence>
      {!ready && (
        <motion.div
          className="home__loader"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
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
  const prefersReducedMotion = useReducedMotion();
  const progress = useRef(0); // 0 → WAYPOINTS.length - 1, read by the 3D rig
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(hasLoadedOnce);

  const handleLoaded = useCallback(() => {
    hasLoadedOnce = true;
    setReady(true);
  }, []);

  // Section 0 is the hero; sections 1..N map to waypoints 0..N-1.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const p = Math.min(
        Math.max(window.scrollY / vh - 1, 0),
        WAYPOINTS.length - 1
      );
      progress.current = p;
      setActive((prev) => {
        const next = Math.round(p);
        return prev === next ? prev : next;
      });
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
    window.scrollTo({
      top: (index + 1) * window.innerHeight,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className="home">
      <div className="home__canvas">
        <Suspense fallback={null}>
          <RoomScene progress={progress} onLoaded={handleLoaded} />
        </Suspense>
        <div className="home__vignette" />
      </div>

      <LoadingOverlay ready={ready} />
      <NavBar />

      {/* Hero */}
      <section className="home__panel home__panel--hero">
        <div className="home__container">
          <motion.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
            animate={ready ? { opacity: 1, y: 0 } : undefined}
            transition={SPRING}
          >
            <p className="home__eyebrow">Design. Plan. Estimate.</p>
            <h1 className="home__large-title">
              3D Interior Design,
              <br />
              Planned Smarter.
            </h1>
            <p className="home__hero-subhead">
              Visualize room layouts in 3D, arrange furniture, choose
              materials, and instantly see an estimated project cost.
            </p>
            <p className="home__scroll-hint">Scroll to walk through</p>
          </motion.div>
        </div>
      </section>

      {/* One full-height section per waypoint (drives the scroll length) */}
      {WAYPOINTS.map((wp, i) => (
        <section key={wp.id} className="home__panel" aria-label={wp.name}>
          <div className="home__container">
            <motion.div
              className="home__caption"
              animate={{
                opacity: active === i ? 1 : 0,
                y: active === i ? 0 : prefersReducedMotion ? 0 : 16,
              }}
              transition={SPRING}
            >
              <p className="home__eyebrow">
                {String(i + 1).padStart(2, "0")} / {String(WAYPOINTS.length).padStart(2, "0")}
              </p>
              <h2 className="home__heading-2">{wp.name}</h2>
              <p className="home__section-subhead">{wp.blurb}</p>
            </motion.div>
          </div>
        </section>
      ))}

      {/* Closing CTA */}
      <section className="home__panel home__panel--end">
        <div className="home__container">
          <h2 className="home__heading-2">Ready to design yours?</h2>
          <Link to="/signup" className="home__cta-link">
            <span>Start designing your space</span>
            <motion.span
              className="home__cta-icon-wrap"
              whileHover={prefersReducedMotion ? undefined : { x: 4 }}
              transition={SPRING}
            >
              <ChevronRight className="home__cta-icon" strokeWidth={2} />
            </motion.span>
          </Link>
        </div>
      </section>

      {/* Room navigation dots */}
      <nav className="home__dots" aria-label="Rooms">
        {WAYPOINTS.map((wp, i) => (
          <button
            key={wp.id}
            type="button"
            className={`home__dot${active === i ? " is-active" : ""}`}
            aria-label={`Go to ${wp.name}`}
            aria-current={active === i}
            onClick={() => goTo(i)}
          >
            <span className="home__dot-label">{wp.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}