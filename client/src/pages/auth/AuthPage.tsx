import { GalleryVerticalEnd } from "lucide-react";
import { useState } from "react";

import { LoginForm } from "../../components/auth/Login";
import { SignupForm } from "../../components/auth/Register";
import { ForgotPasswordForm } from "../../components/auth/ForgotPassword";
import { VerifyEmailForm } from "../../components/auth/VerifyEmail";

type AuthMode = "login" | "signup" | "forgot" | "verify";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="size-4" />
          </div>

          Espasyo
        </div>

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
          <ForgotPasswordForm
            onLogin={() => setMode("login")}
          />
        )}

        {mode === "verify" && (
          <VerifyEmailForm
            onLogin={() => setMode("login")}
          />
        )}
      </div>
    </div>
  );
}