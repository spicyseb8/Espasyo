import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";

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

interface ForgotPasswordFormProps {
  onLogin: () => void;
}

export function ForgotPasswordForm({
  onLogin,
  className,
  ...props
}: ForgotPasswordFormProps &
  React.ComponentProps<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    e: React.SubmitEvent
  ) => {
    e.preventDefault();

    setError("");
    setSuccess(false);

    const trimmedEmail =
      email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }

    if (!trimmedEmail.includes("@")) {
      setError(
        "Please enter a valid email address."
      );
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(
        auth,
        trimmedEmail
      );

      setSuccess(true);
    } catch (error: any) {
      console.error(
        "Password reset error:",
        error
      );

      switch (error.code) {
        case "auth/invalid-email":
          setError(
            "Please enter a valid email address."
          );
          break;

        case "auth/user-not-found":
          setError(
            "No account was found with this email."
          );
          break;

        case "auth/too-many-requests":
          setError(
            "Too many requests. Please try again later."
          );
          break;

        default:
          setError(
            "Unable to send the password reset email. Please try again."
          );
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
            Forgot Password?
          </CardTitle>

          <CardDescription>
            Enter your email and we'll send you a
            password reset link.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success ? (
            <FieldGroup>

              <FieldDescription className="text-center">
                We've sent a password reset link to{" "}
                <strong>{email}</strong>.
              </FieldDescription>

              <FieldDescription className="text-center">
                Check your email and follow the link
                to create a new password.
              </FieldDescription>

              <Field>
                <Button
                  type="button"
                  className="w-full"
                  onClick={onLogin}
                >
                  Back to Login
                </Button>
              </Field>

            </FieldGroup>
          ) : (
            <form onSubmit={handleSubmit}>
              <FieldGroup>

                <Field>
                  <FieldLabel htmlFor="reset-email">
                    Email
                  </FieldLabel>

                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    autoComplete="email"
                    required
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
                    {loading
                      ? "Sending..."
                      : "Send Reset Link"}
                  </Button>

                  <FieldDescription className="text-center">
                    Remember your password?{" "}

                    <button
                      type="button"
                      onClick={onLogin}
                      className="cursor-pointer ml-auto text-sm underline-offset-4 hover:underline"
                    >
                      Sign in
                    </button>
                  </FieldDescription>
                </Field>

              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}