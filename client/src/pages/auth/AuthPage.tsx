import { useState } from "react";

import { LoginForm } from "../../components/auth/Login";
import { SignupForm } from "../../components/auth/Register";
import { ForgotPasswordForm } from "../../components/auth/ForgotPassword";
import { VerifyEmailForm } from "../../components/auth/VerifyEmail";

// Put your image in /public (e.g. /public/auth-hero.jpg) and point this at it.
const AUTH_IMAGE = "/auth-hero.jpg";

type AuthMode = "login" | "signup" | "forgot" | "verify";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex min-h-svh flex-col">
        {/* Logo */}
        <header className="flex justify-center p-6 md:p-10">
          <div className="flex items-center gap-2 font-medium">
            <img src="/logo.png" alt="" aria-hidden="true" className="size-8 object-contain" />
            Espasyo
          </div>
        </header>

        {/* Form (switches by mode, same logic as before) */}
        <main className="flex flex-1 items-center justify-center px-6 pb-10">
          <div className="flex w-full max-w-sm flex-col gap-6">
            {mode === "login" && (
              <LoginForm
                onSignup={() => setMode("signup")}
                onForgotPassword={() => setMode("forgot")}
              />
            )}

            {mode === "signup" && (
              <SignupForm
                onLogin={() => setMode("login")}
                onVerify={() => setMode("verify")}
              />
            )}

            {mode === "forgot" && (
              <ForgotPasswordForm onLogin={() => setMode("login")} />
            )}

            {mode === "verify" && (
              <VerifyEmailForm onLogin={() => setMode("login")} />
            )}
          </div>
        </main>

        {/* Footer links: point these at your real pages */}
        <footer className="flex justify-center gap-4 p-6 text-xs text-muted-foreground">
          <a href="#" className="hover:text-foreground">Help</a>
          <span aria-hidden="true">/</span>
          <a href="#" className="hover:text-foreground">Terms</a>
          <span aria-hidden="true">/</span>
          <a href="#" className="hover:text-foreground">Privacy</a>
        </footer>
      </div>

      {/* Right: image (hidden on small screens, stays put if the form scrolls) */}
      <div className="relative hidden h-svh overflow-hidden bg-muted lg:sticky lg:top-0 lg:block">
        {!imageFailed && (
          <img
            src={AUTH_IMAGE}
            alt=""
            aria-hidden="true"
            draggable={false}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-out ${
              imageLoaded ? "scale-100 opacity-100" : "scale-105 opacity-0"
            }`}
          />
        )}

        {/* Soft shade so the caption stays readable on any image */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />

        {/* Caption (delete this block if you want the image on its own) */}
        <div className="absolute inset-x-0 bottom-0 p-10">
          <p className="max-w-md text-2xl font-semibold leading-snug text-white">
            Plan spaces with real materials.
          </p>
          <p className="mt-2 max-w-md text-sm text-white/80">
            Floors, walls and furniture, all in one library.
          </p>
        </div>
      </div>
    </div>
  );
}