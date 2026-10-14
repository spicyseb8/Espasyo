import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Armchair } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import "./NavBar.css";

// Critically damped — this is chrome, not a flick.
const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;

const LINKS = [
  { label: "Home", to: "/", end: true },
  { label: "Library", to: "/library", end: false },
  { label: "Studio", to: "/studio", end: false },
] as const;

export default function NavBar() {
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="navbar">
      <div className={`navbar__inner${scrolled ? " is-scrolled" : ""}`}>
        {/* Logo */}
        <Link to="/" className="navbar__logo" aria-label="Espasyo home">
          <span className="navbar__logo-badge">
            <Armchair className="navbar__logo-icon" strokeWidth={1.75} />
          </span>
          <span className="navbar__logo-text">Espasyo</span>
        </Link>

        {/* Links */}
        <nav className="navbar__links" aria-label="Primary">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className="navbar__link">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="navPill"
                      className="navbar__pill"
                      transition={reduce ? { duration: 0 } : SPRING}
                    />
                  )}
                  <span className="navbar__link-text">{link.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Action */}
        <motion.div
          className="navbar__action"
          whileTap={reduce ? undefined : { scale: 0.97 }}
          transition={SPRING}
        >
          <Link to="/auth" className="navbar__signin">
            Sign in
          </Link>
        </motion.div>
      </div>
    </header>
  );
}