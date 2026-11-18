import { useState } from "react";

import { LoginForm } from "../../components/auth/Login";

// Files in client/public are served from the site root, so
// client/public/background/login-hero.jpg becomes /background/login-hero.jpg.
const AUTH_IMAGE = "/background/login-hero.jpg";
const SUPPORT_EMAIL = "jocerconstructionservices@gmail.com";

export default function AuthPage() {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Left: sign in */}
      <div className="relative flex min-h-svh items-center justify-center px-6 py-28">
        <header className="absolute inset-x-0 top-0 flex items-center justify-center gap-2.5 px-6 py-6 md:px-10 md:py-8">
          <img src="/logo.png" alt="" aria-hidden="true" className="size-8 object-contain" />
          <span className="text-base font-semibold tracking-tight">Espasyo</span>
        </header>

        <main className="w-full max-w-md">
          <LoginForm />
        </main>

        <footer className="absolute inset-x-0 bottom-0 px-6 pb-6 text-center text-xs leading-relaxed text-muted-foreground md:px-10 md:pb-8">
          <p>
            Trouble signing in?{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              Contact us
            </a>
          </p>
          <p className="mt-1">© 2026 JOCER Construction Services</p>
        </footer>
      </div>

      {/* Right: photo (desktop only, stays fixed while the page scrolls) */}
      <div className="hidden h-svh p-3 lg:sticky lg:top-0 lg:block">
        <div className="relative h-full overflow-hidden rounded-3xl bg-muted">
          {!imageFailed && (
            <img
              src={AUTH_IMAGE}
              alt=""
              aria-hidden="true"
              draggable={false}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-out motion-reduce:transition-none ${
                imageLoaded ? "scale-100 opacity-100" : "scale-105 opacity-0"
              }`}
            />
          )}

          {/* Shade keeps the caption readable on any photo */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 p-10 xl:p-12">
            <p className="max-w-md text-balance text-3xl font-semibold leading-tight tracking-tight text-white">
              Plan spaces with real materials.
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
              Draw your floor plan, choose floors, walls and furniture from one library, and walk
              through the result in 3D.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}