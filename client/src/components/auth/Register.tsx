
import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";

import { cn } from "cn";
import { auth } from "@/firebase/firebase";
import {
  validateConfirmPassword,
  validateContact,
  validateEmail,
  validateFullName,
  validatePassword,
} from "@/utils/authValidation";

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

interface SignupFormProps
  extends React.ComponentProps<"div"> {
  onLogin: () => void;
  onVerify: () => void;
}

export function SignupForm({
  onLogin,
  onVerify,
  className,
  ...props
}: SignupFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const validationError =
      validateFullName(name) ||
      validateEmail(email) ||
      validateContact(contact) ||
      validatePassword(password) ||
      validateConfirmPassword(password, confirmPassword);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const credential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

      try {
        localStorage.setItem(
          "pendingEspasyoProfile",
          JSON.stringify({
            full_name: name.trim(),
            email: normalizedEmail,
            contact,
          })
        );

        await sendEmailVerification(credential.user);
      } catch (verificationError) {
        // Avoid leaving a signed-in, unverified account.
        await credential.user.delete().catch(() => undefined);
        throw verificationError;
      }

      onVerify();
    } catch (err: unknown) {
      const code =
        typeof err === "object" &&
        err !== null &&
        "code" in err
          ? String(err.code)
          : "";

      switch (code) {
        case "auth/email-already-in-use":
          setError("An account with this email already exists.");
          break;
        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;
        case "auth/weak-password":
          setError("Please choose a stronger password.");
          break;
        case "auth/network-request-failed":
          setError("Network error. Check your connection.");
          break;
        case "auth/too-many-requests":
          setError("Too many requests. Please try again later.");
          break;
        default:
          setError(
            "Unable to complete registration. Please try again."
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
            Enter your information to join Espasyo
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="signup-name">
                  Full Name
                </FieldLabel>
                <Input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[\p{L}\s]*$/u.test(value)) {
                      setName(value);
                    }
                  }}
                  required
                />
                <FieldDescription>
                  Letters and spaces only.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="signup-email">
                  Email
                </FieldLabel>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="signup-contact">
                  Contact Number
                </FieldLabel>
                <Input
                  id="signup-contact"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="09123456789"
                  maxLength={11}
                  value={contact}
                  onChange={(e) =>
                    setContact(
                      e.target.value.replace(/\D/g, "").slice(0, 11)
                    )
                  }
                  required
                />
                <FieldDescription>
                  Enter exactly 11 digits.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="signup-password">
                  Password
                </FieldLabel>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <FieldDescription>
                  At least 8 characters.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="confirm-password">
                  Confirm Password
                </FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  minLength={8}
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
                  {loading ? "Creating account..." : "Create Account"}
                </Button>

                <FieldDescription className="text-center">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={onLogin}
                    className="underline underline-offset-4"
                  >
                    Sign in
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
