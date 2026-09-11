import { useState } from "react";
import {
  reload,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { cn } from "cn";

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

import { auth } from "@/firebase/firebase";

interface LoginFormProps extends React.ComponentProps<"div"> {}

function LoginForm({ className, ...props }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

      const user = userCredential.user;

      // Get the latest email verification status.
      await reload(user);

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError("Unable to sign in. Please try again.");
        return;
      }

      // Admin and Superadmin accounts must have verified emails.
      if (!currentUser.emailVerified) {
        await signOut(auth);

        setError(
          "Please verify your email before signing in."
        );

        return;
      }

      // Login successful — go to the dashboard.
      window.location.href = "/";
    } catch (error: unknown) {
      console.error("Login error:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error
      ) {
        const errorCode = (error as { code: string }).code;

        switch (errorCode) {
          case "auth/invalid-credential":
            setError("Invalid email or password.");
            break;

          case "auth/user-not-found":
            setError("Invalid email or password.");
            break;

          case "auth/wrong-password":
            setError("Invalid email or password.");
            break;

          case "auth/invalid-email":
            setError("Please enter a valid email address.");
            break;

          case "auth/too-many-requests":
            setError(
              "Too many login attempts. Please try again later."
            );
            break;

          case "auth/user-disabled":
            setError("This account has been disabled.");
            break;

          case "auth/network-request-failed":
            setError(
              "Network error. Please check your internet connection."
            );
            break;

          default:
            setError(
              "Unable to sign in. Please check your credentials and try again."
            );
        }
      } else {
        setError(
          "Unable to sign in. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center p-6",
        className
      )}
      {...props}
    >
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>

            <CardDescription>
              Sign in to access the Espasyo admin dashboard.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">
                    Email
                  </FieldLabel>

                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    disabled={loading}
                    autoComplete="email"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="password">
                    Password
                  </FieldLabel>

                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </Field>

                {error && (
                  <FieldDescription className="text-destructive">
                    {error}
                  </FieldDescription>
                )}

                <Field>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default LoginForm;