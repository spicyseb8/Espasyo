import { GalleryVerticalEnd } from "lucide-react";
import { useState } from "react";

import { LoginForm } from "../../components/auth/Login";
import { SignupForm } from "../../components/auth/Register";
import { ForgotPasswordForm } from "../../components/auth/ForgotPassword";
import { VerifyEmailForm } from "../../components/auth/VerifyEmail";
// Adjust this path to wherever you put FlatLay.tsx / FlatLay.css
import FlatLay from "./FlatLay";

type AuthMode = "login" | "signup" | "forgot" | "verify";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex min-h-svh flex-col">
        {/* Logo */}
        <header className="flex justify-center p-6 md:p-10">
          <div className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEnd className="size-4" />
            </div>
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

      {/* Right: flat lay (hidden on small screens, stays put if the form scrolls) */}
      <div className="relative hidden h-svh overflow-hidden lg:sticky lg:top-0 lg:block">
        <FlatLay />
      </div>
    </div>
  );
}