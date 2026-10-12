import { useState } from "react";
import {
  reload,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { cn } from "cn";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

import { isAdminRole } from "@/lib/adminRole";
import { auth, db } from "@/firebase/firebase";

// Served from admin/public/images/white-brackground.jpg
const BACKGROUND_IMAGE = "/images/white-brackground.jpg";

type LoginFormProps = React.ComponentProps<"div">;

function LoginForm({ className, ...props }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [unauthorizedOpen, setUnauthorizedOpen] = useState(false);

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

      const employeeSnapshot = await getDocs(
        query(
          collection(db, "adminEmployees"),
          where("uid", "==", user.uid)
        )
      );
      const isAuthorized = employeeSnapshot.docs.some((document) =>
        isAdminRole(document.data().role)
      );

      if (!isAuthorized) {
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error(
            "Unable to sign out an unauthorized account:",
            signOutError
          );
        }

        setUnauthorizedOpen(true);
        return;
      }

      // Only authorized admin accounts may continue past this point.
      await reload(user);

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError("Unable to sign in. Please try again.");
        return;
      }

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

  const glassInput =
    "h-10 border-black/10 bg-white/50 text-neutral-900 placeholder:text-neutral-500 " +
    "dark:bg-white/50 focus-visible:border-neutral-900/40 focus-visible:ring-neutral-900/10";

  return (
    <div
      className={cn(
        "relative flex min-h-screen items-center justify-center overflow-hidden bg-white bg-cover bg-center bg-no-repeat p-6",
        className
      )}
      style={{ backgroundImage: `url("${BACKGROUND_IMAGE}")` }}
      {...props}
    >
      {/* Light wash so the card and text stay readable on any part of the image */}
      <div className="pointer-events-none absolute inset-0 bg-white/20" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-sm">
        <Card
          className={cn(
            "rounded-2xl border border-white/70 bg-white/40 text-neutral-900 ring-0",
            "shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]",
            "backdrop-blur-xl backdrop-saturate-150"
          )}
        >
          <CardHeader>
            <CardTitle className="text-neutral-900">Admin Login</CardTitle>

            <CardDescription className="text-neutral-600">
              Sign in to access the Espasyo admin dashboard.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email" className="text-neutral-800">
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
                    className={glassInput}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="password" className="text-neutral-800">
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
                    className={glassInput}
                  />
                </Field>

                {error && (
                  <FieldDescription className="text-red-600">
                    {error}
                  </FieldDescription>
                )}

                <Field>
                  <Button
                    type="submit"
                    className="w-full bg-neutral-900 font-semibold text-white shadow-lg shadow-black/20 hover:bg-neutral-800"
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

      <AlertDialog
        open={unauthorizedOpen}
        onOpenChange={setUnauthorizedOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Access denied</AlertDialogTitle>
            <AlertDialogDescription>
              youre not authorized to access this page
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default LoginForm;