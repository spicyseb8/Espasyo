import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
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

interface SignupFormProps {
  onLogin: () => void;
  onVerify: () => void;
}

export function SignupForm({
  onLogin,
  onVerify,
  className,
  ...props
}: SignupFormProps & React.ComponentProps<"div">) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    setError("");

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!contact.trim()) {
      setError("Please enter your contact number.");
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters long."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          email.trim().toLowerCase(),
          password
        );

      const user = userCredential.user;

      /*
       * Temporarily store signup information.
       * The Firestore profile will only be created
       * after email verification.
       */
      localStorage.setItem(
        "pendingEspasyoProfile",
        JSON.stringify({
          full_name: name.trim(),
          email: email.trim().toLowerCase(),
          contact: contact.trim(),
        })
      );

      await sendEmailVerification(user);

      /*
       * Switch the AuthPage to the verification form.
       */
      onVerify();
    } catch (error: any) {
      console.error("Signup error:", error);

      switch (error.code) {
        case "auth/email-already-in-use":
          setError(
            "An account with this email already exists."
          );
          break;

        case "auth/invalid-email":
          setError(
            "Please enter a valid email address."
          );
          break;

        case "auth/weak-password":
          setError(
            "Password must be at least 8 characters."
          );
          break;

        case "auth/network-request-failed":
          setError(
            "Network error. Please check your connection."
          );
          break;

        case "auth/too-many-requests":
          setError(
            "Too many requests. Please try again later."
          );
          break;

        default:
          setError(
            "Unable to create your account. Please try again."
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
            Create your account
          </CardTitle>

          <CardDescription>
            Enter your information to create your
            Espasyo account
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>

              {/* Full Name */}
              <Field>
                <FieldLabel htmlFor="name">
                  Full Name
                </FieldLabel>

                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  autoComplete="name"
                  required
                />
              </Field>

              {/* Email */}
              <Field>
                <FieldLabel htmlFor="signup-email">
                  Email
                </FieldLabel>

                <Input
                  id="signup-email"
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

              {/* Contact */}
              <Field>
                <FieldLabel htmlFor="contact">
                  Contact
                </FieldLabel>

                <Input
                  id="contact"
                  type="tel"
                  placeholder="09XXXXXXXXX"
                  value={contact}
                  onChange={(e) =>
                    setContact(e.target.value)
                  }
                  autoComplete="tel"
                  required
                />
              </Field>

              {/* Passwords */}
              <Field>
                <Field className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="signup-password">
                      Password
                    </FieldLabel>

                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      autoComplete="new-password"
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="confirm-password">
                      Confirm Password
                    </FieldLabel>

                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) =>
                        setConfirmPassword(
                          e.target.value
                        )
                      }
                      autoComplete="new-password"
                      required
                    />
                  </Field>
                </Field>

                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              </Field>

              {/* Error */}
              {error && (
                <FieldDescription className="text-destructive">
                  {error}
                </FieldDescription>
              )}

              {/* Submit */}
              <Field>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading
                    ? "Creating account..."
                    : "Create Account"}
                </Button>

                <FieldDescription className="text-center">
                  Already have an account?{" "}

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
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{" "}
        <a
          href="#"
          className="underline underline-offset-4"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="#"
          className="underline underline-offset-4"
        >
          Privacy Policy
        </a>
        .
      </FieldDescription>
    </div>
  );
}