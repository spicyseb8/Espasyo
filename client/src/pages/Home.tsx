import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useProgress } from "@react-three/drei";
import NavBar from "./NavBar";
import { WAYPOINTS } from "./Waypoints";
import { usePagedScroll } from "./usePagedScroll";
import { RoomWidget, type WidgetKind } from "./RoomWidgets";
import "./Home.css";

const RoomScene = lazy(() => import("./Roomscene"));

const SPRING = { type: "spring", bounce: 0, duration: 0.45 } as const;

// Lives at module level so it survives SPA route changes.
let hasLoadedOnce = false;

const FEATURES = [
  { title: "Draw and arrange", body: "Build room layouts wall by wall and place furniture in 3D." },
  { title: "Choose finishes", body: "Try floor finishes and wall colors before anything is built." },
  { title: "Know the cost", body: "Room areas and flooring estimates update as you design." },
];

/*
 * Content for each room panel, in the same order as WAYPOINTS.
 * The LAST waypoint is the footer, so it has no entry here.
 */
const ROOM_CONTENT: {
  nav: string;
  title: string;
  body: string;
  chips: string[];
  widget: WidgetKind;
}[] = [
  {
    nav: "Plan & build",
    title: "Draw walls. Arrange furniture.",
    body: "Sketch your room layout wall by wall, then drop in furniture and move it around until the space feels right.",
    chips: ["Room layouts", "Wall drawing", "Furniture placement"],
    widget: "plan",
  },
  {
    nav: "Finishes",
    title: "Try floors and wall colors.",
    body: "Swap floor finishes and repaint walls in a click, and see the result in 3D before anything is bought or built.",
    chips: ["Floor finishes", "Wall colors", "Live 3D preview"],
    widget: "finishes",
  },
  {
    nav: "Estimate",
    title: "Know the area and the cost.",
    body: "Espasyo measures each room, works out how much flooring you need and what it will cost, and updates as your design changes.",
    chips: ["Room area", "Flooring needed", "Cost estimate"],
    widget: "estimate",
  },
];

const OUTRO_POINTS = [
  "First-person walkthrough",
  "Area and flooring estimates",
  "All your projects in one workspace",
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0); // 0 → WAYPOINTS.length - 1, read by the 3D rig

  // active: -1 = hero, 0..n-1 = rooms
  const [active, setActive] = useState(-1);
  const [showDots, setShowDots] = useState(false);
  const [footerOn, setFooterOn] = useState(false);
  const [ready, setReady] = useState(hasLoadedOnce);

  const handleLoaded = useCallback(() => {
    hasLoadedOnce = true;
    setReady(true);
  }, []);

  // One wheel / swipe / key press = exactly one panel (0 = hero, 1..N = rooms).
  const goToPanel = usePagedScroll(stageRef, WAYPOINTS.length, reduce);
  const goTo = (index: number) => goToPanel(index + 1); // dots still work

  /*
   * Stage = (N + 1) viewport-heights. Panel 0 is the hero (camera parked on
   * room 1). Room i is reached when panel i + 1's top hits the viewport top.
   * The LAST room is the footer: instead of a caption card, a dark gradient
   * fades in over it as the camera arrives and the footer content appears.
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

  const heroOn = active === -1 && ready;
  const rise = reduce ? 0 : 14;
  const lastIndex = WAYPOINTS.length - 1;

  const navLabel = (i: number) =>
    i === lastIndex ? "Get started" : ROOM_CONTENT[i]?.nav ?? WAYPOINTS[i].name;

  return (
    <div className="home">
      <NavBar />

      <div className="home__stage" ref={stageRef}>
        {/* Sticky 3D canvas: pinned for the whole stage */}
        <div className="home__canvas" ref={canvasRef}>
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

          {/* Dark gradient that fades in over the last room (driven by scroll) */}
          <div className="home__outro-scrim" aria-hidden />

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
                  Espasyo is a 3D interior design and space planning system by Jocer
                  Construction. Draw walls, arrange furniture, pick finishes, and watch
                  your flooring cost update live.
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

          {/* ───────── One panel per room; the last one is the footer ───────── */}
          {WAYPOINTS.map((wp, i) => {
            if (i === lastIndex) {
              return (
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

                        <ul className="home__outro-points">
                          {OUTRO_POINTS.map((text, k) => (
                            <motion.li
                              key={text}
                              initial={false}
                              animate={{
                                opacity: footerOn ? 1 : 0,
                                x: footerOn ? 0 : -rise,
                              }}
                              transition={{ ...SPRING, delay: footerOn ? 0.12 + k * 0.09 : 0 }}
                            >
                              {text}
                            </motion.li>
                          ))}
                        </ul>

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
                        <p>
                          © {new Date().getFullYear()} Espasyo by Jocer Construction. All
                          rights reserved.
                        </p>
                        <nav aria-label="Footer">
                          <Link to="/library" tabIndex={footerOn ? 0 : -1}>Library</Link>
                          <Link to="/studio" tabIndex={footerOn ? 0 : -1}>Studio</Link>
                          <Link to="/signup" tabIndex={footerOn ? 0 : -1}>Sign up</Link>
                        </nav>
                      </footer>
                    </motion.div>
                  </div>
                </section>
              );
            }

            const content = ROOM_CONTENT[i];
            const isOn = active === i;

            return (
              <section key={wp.id} className="home__panel" aria-label={content?.nav ?? wp.name}>
                <div className="home__container">
                  <motion.div
                    className={`home__caption${content ? " home__caption--rich" : ""}${
                      isOn ? " is-on" : ""
                    }`}
                    initial={false}
                    animate={{ opacity: isOn ? 1 : 0, y: isOn ? 0 : rise }}
                    transition={SPRING}
                    aria-hidden={!isOn}
                  >
                    <p className="home__room-index">
                      {pad(i + 1)} <span>/ {pad(lastIndex)}</span>
                    </p>
                    <h2 className="home__heading-2">{content?.title ?? wp.name}</h2>
                    <p className="home__caption-body">{content?.body ?? wp.blurb}</p>

                    {content && (
                      <>
                        <ul className="home__chips">
                          {content.chips.map((chip) => (
                            <li key={chip}>{chip}</li>
                          ))}
                        </ul>
                        <RoomWidget kind={content.widget} active={isOn} />
                      </>
                    )}

                    <div className="home__caption-track" aria-hidden>
                      <div
                        className="home__caption-fill"
                        style={{ transform: `scaleX(${(i + 1) / lastIndex})` }}
                      />
                    </div>
                  </motion.div>
                </div>
              </section>
            );
          })}
        </div>
      </div>

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
            aria-label={i === lastIndex ? "Go to the end" : `Go to ${navLabel(i)}`}
            aria-current={active === i}
            tabIndex={showDots ? 0 : -1}
            onClick={() => goTo(i)}
          >
            <span className="home__dot-label">{navLabel(i)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}