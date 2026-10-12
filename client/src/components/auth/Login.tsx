
import { useState, type FormEvent } from "react";
import {
  reload,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { cn } from "cn";
import { auth } from "@/firebase/firebase";
import { validateLoginForm } from "@/utils/authValidation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface LoginFormProps
  extends React.ComponentProps<"div"> {
  onSignup: () => void;
  onForgotPassword: () => void;
}

export function LoginForm({
  onSignup,
  onForgotPassword,
  className,
  ...props
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const validationError = validateLoginForm({
      email,
      password,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

      await reload(credential.user);

      if (!credential.user.emailVerified) {
        await signOut(auth);
        setError("Please verify your email before signing in.");
        return;
      }

      // Redirect to the existing home route.
      window.location.assign("/home");
    } catch (err: unknown) {
      const code =
        typeof err === "object" &&
        err !== null &&
        "code" in err
          ? String(err.code)
          : "";

      switch (code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          setError("Incorrect email or password.");
          break;
        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;
        case "auth/too-many-requests":
          setError("Too many attempts. Please try again later.");
          break;
        case "auth/network-request-failed":
          setError("Network error. Check your connection.");
          break;
        default:
          setError("Unable to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            Welcome back
          </CardTitle>
          <CardDescription>
            Sign in to your Espasyo account
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="login-email">
                  Email
                </FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="login-password">
                    Password
                  </FieldLabel>
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-sm underline underline-offset-4"
                  >
                    Forgot password?
                  </button>
                </div>

                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>

              {error && (
                <FieldDescription
                  role="alert"
                  className="text-destructive"
                >
                  {error}
                </FieldDescription>
              )}

              <Field>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>

                <FieldDescription className="text-center">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={onSignup}
                    className="underline underline-offset-4"
                  >
                    Sign up
                  </button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
