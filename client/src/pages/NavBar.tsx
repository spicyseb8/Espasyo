import { Link, NavLink } from "react-router-dom";
import { Armchair } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import "./NavBar.css";

// Critically damped by default (no overshoot) — this is chrome, not a flick.
const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;

export default function NavBar() {
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

          <NavLink to="/" className="navbar__link">
            {({ isActive }) => (
              <>
                Home

                {isActive && (
                  <motion.span
                    layoutId="navIndicator"
                    className="navbar__indicator"
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : SPRING
                    }
                  />
                )}
              </>
            )}
          </NavLink>

          <NavLink to="/library" className="navbar__link">
            {({ isActive }) => (
              <>
                Library

                {isActive && (
                  <motion.span
                    layoutId="navIndicator"
                    className="navbar__indicator"
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : SPRING
                    }
                  />
                )}
              </>
            )}
          </NavLink>

          <NavLink to="/studio" className="navbar__link">
            {({ isActive }) => (
              <>
                Studio

                {isActive && (
                  <motion.span
                    layoutId="navIndicator"
                    className="navbar__indicator"
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : SPRING
                    }
                  />
                )}
              </>
            )}
          </NavLink>

        </nav>

        {/* Sign In - Right */}
        <motion.div
          whileTap={
            prefersReducedMotion ? undefined : { scale: 0.96 }
          }
          transition={SPRING}
          style={{ display: "inline-flex" }}
        >
          <Link
            to="/auth"
            className="navbar__signin-button"
          >
            Sign In
          </Link>
        </motion.div>

      </div>
    </header>
  );
}
