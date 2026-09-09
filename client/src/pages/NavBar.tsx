import { useState } from "react";
import { Link } from "react-router-dom";
import { Armchair } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import "./NavBar.css";

const NAV_LINKS = ["Home", "Library", "Studio"];

// Critically damped by default (no overshoot) — this is chrome, not a flick.
const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;

export default function NavBar() {
  const [activeIndex, setActiveIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  return (
    <header className="navbar">
      <div className="navbar__inner">
        {/* Logo - Left */}
        <div className="navbar__logo">
          <Armchair className="navbar__logo-icon" strokeWidth={1.5} />
          <span className="navbar__logo-text">Espasyo</span>
        </div>

        {/* Navigation Links - Center */}
        <nav className="navbar__links">
          {NAV_LINKS.map((label, index) => (
            <a
              key={label}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveIndex(index);
              }}
              className="navbar__link"
              data-active={index === activeIndex}
            >
              {label}
              {index === activeIndex && (
                // Shared layoutId = Motion animates this span FROM its previous
                // position TO here automatically (a "magic move"), interruptible
                // mid-flight if the user clicks again before it settles.
                <motion.span
                  layoutId="navIndicator"
                  className="navbar__indicator"
                  transition={prefersReducedMotion ? { duration: 0 } : SPRING}
                />
              )}
            </a>
          ))}
        </nav>

        {/* Sign In - Right. whileTap fires on pointer-down, not release. */}
        <motion.div
          whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
          transition={SPRING}
          style={{ display: "inline-flex" }}
        >
          <Link to="/auth" className="navbar__signin-button"></Link>
        </motion.div>
      </div>
    </header>
  );
}