import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Armchair, Loader2, LogOut } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { useAuth } from "@/context/AuthContext";
import { logout } from "../firebase/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import "./NavBar.css";

// Critically damped — this is chrome, not a flick.
const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;

// Module-level, so it survives route changes (the navbar remounts on every
// page) and only resets on a full page reload.
let introPlayed = false;

const LINKS = [
  { label: "Home", to: "/", end: true },
  { label: "Library", to: "/library", end: false },
  { label: "Studio", to: "/studio", end: false },
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function NavBar() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // The slide-down intro only plays the first time the navbar ever mounts.
  const [playIntro] = useState(() => !introPlayed);

  const [scrolled, setScrolled] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    introPlayed = true;
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const email = user?.email ?? "";
  const displayName = user?.displayName || email.split("@")[0] || "Account";
  const photoURL = user?.photoURL ?? undefined;

  const handleLogout = async (event: React.MouseEvent) => {
    // Keep the dialog open until sign-out finishes.
    event.preventDefault();
    setLoggingOut(true);
    setLogoutError(null);

    try {
      await logout();
      setConfirmOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Unable to log out:", error);
      setLogoutError("Something went wrong while logging out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  const fade = {
    initial: reduce ? false : { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 },
    transition: reduce ? { duration: 0 } : SPRING,
  } as const;

  return (
    <>
      <motion.header
        className="navbar"
        initial={reduce || !playIntro ? false : { y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={reduce ? { duration: 0 } : SPRING}
      >
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

          {/* Action: sign in, or the account menu once signed in */}
          <div className="navbar__action">
            <AnimatePresence mode="wait" initial={false}>
              {loading ? (
                <motion.span
                  key="loading"
                  className="navbar__avatar-skeleton"
                  aria-hidden="true"
                  {...fade}
                />
              ) : user ? (
                <motion.div key="user" {...fade}>
                  {/* modal={false} lets the confirmation dialog open cleanly from a menu item */}
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger
                      render={
                        <button
                          type="button"
                          className="navbar__avatar-btn"
                          aria-label="Open account menu"
                        />
                      }
                    >
                      <Avatar className="size-9">
                        <AvatarImage src={photoURL} alt="" referrerPolicy="no-referrer" />
                        <AvatarFallback className="bg-neutral-900 text-xs font-semibold text-white">
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                      align="end"
                      sideOffset={12}
                      className="w-64 rounded-2xl p-1.5 shadow-xl"
                    >
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="p-2.5 font-normal">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-10">
                              <AvatarImage src={photoURL} alt="" referrerPolicy="no-referrer" />
                              <AvatarFallback className="bg-neutral-900 text-xs font-semibold text-white">
                                {getInitials(displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold leading-tight">
                                {displayName}
                              </p>
                              {email && (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {email}
                                </p>
                              )}
                            </div>
                          </div>
                        </DropdownMenuLabel>
                      </DropdownMenuGroup>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onSelect={() => {
                          setLogoutError(null);
                          setConfirmOpen(true);
                        }}
                        className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                      >
                        <LogOut className="size-4" />
                        Log out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              ) : (
                <motion.div key="guest" whileTap={reduce ? undefined : { scale: 0.97 }} {...fade}>
                  <Link to="/auth" className="navbar__signin">
                    Sign in
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>

      {/* Logout confirmation (kept outside the menu so it stays mounted) */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!loggingOut) {
            setConfirmOpen(open);
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Log out of Espasyo?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to open your library and studio projects.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {logoutError && (
            <p role="alert" className="text-sm text-destructive">
              {logoutError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={loggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} disabled={loggingOut}>
              {loggingOut && <Loader2 className="size-4 animate-spin" />}
              {loggingOut ? "Logging out…" : "Log out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}