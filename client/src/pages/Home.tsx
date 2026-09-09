import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import NavBar from "./NavBar";
import "./Home.css";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=2000&auto=format&fit=crop";

const RESULT_IMAGE =
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1800&auto=format&fit=crop";

const PROCESS_STEPS = [
  {
    title: "Design Your Space",
    description:
      "Sketch your room's layout and drag-and-drop furniture, materials, and fixtures into place.",
    image:
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=300&auto=format&fit=crop",
  },
  {
    title: "Visualize in 3D",
    description:
      "Walk through a photorealistic 3D render of your design before anything is built.",
    image:
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=300&auto=format&fit=crop",
  },
  {
    title: "Get a Cost Estimate",
    description:
      "Our parametric algorithm instantly estimates the total project cost from your design.",
    image:
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=300&auto=format&fit=crop",
  },
];

// Critically damped default — everything below is chrome/reveal, not a flick.
const SPRING = { type: "spring", bounce: 0, duration: 0.4 } as const;

export default function Home() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="home">
      <NavBar />

      {/* One orchestrated reveal on load — not a fade-up on every section. */}
      <motion.section
        className="home__hero-section"
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
      >
        <div className="home__container">
          <div className="home__hero-frame">
            <img
              src={HERO_IMAGE}
              alt="Interior design showcase"
              className="home__hero-image"
            />
          </div>

          <p className="home__eyebrow">Design. Plan. Estimate.</p>
          <h1 className="home__large-title">
            3D Interior Design,
            <br />
            Planned Smarter.
          </h1>
          <p className="home__hero-subhead">
            Visualize room layouts in 3D, arrange furniture, choose
            materials, and instantly see an estimated project cost before
            bringing your design to life.
          </p>
        </div>
      </motion.section>

      <section className="home__process-section">
        <div className="home__container">
          <p className="home__eyebrow">From Concept to Reality</p>
          <h2 className="home__heading-2">See the Process</h2>
          <p className="home__section-subhead">
            Every finished space starts as a sketch. Here's what it looks
            like to go from an empty room to a fully designed, cost-estimated
            interior.
          </p>

          <div className="home__result-frame">
            <img
              src={RESULT_IMAGE}
              alt="Finished interior design render"
              className="home__result-image"
            />
          </div>

          {/* Grouped list — hairline separators, no card shadows. Pressed
              state is instant via CSS :active (fires on pointer-down). */}
          <div className="home__group">
            {PROCESS_STEPS.map((step) => (
              <div key={step.title} className="home__row">
                <img
                  src={step.image}
                  alt=""
                  aria-hidden="true"
                  className="home__row-thumb"
                />
                <div className="home__row-text">
                  <p className="home__row-title">{step.title}</p>
                  <p className="home__row-desc">{step.description}</p>
                </div>
                <ChevronRight className="home__row-chevron" strokeWidth={2} />
              </div>
            ))}
          </div>

          {/* Chevron nudges toward the destination on hover — hints the
              direction of the interaction rather than just sitting still. */}
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
    </div>
  );
}