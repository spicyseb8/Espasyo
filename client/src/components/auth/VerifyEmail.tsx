import { useEffect, useState } from "react";
import {
  reload,
  sendEmailVerification,
} from "firebase/auth";
import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

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
} from "@/components/ui/field";

import { auth, db } from "@/firebase/firebase";

interface VerifyEmailFormProps {
  onLogin: () => void;
}

export function VerifyEmailForm({
  onLogin,
  className,
  ...props
}: VerifyEmailFormProps & React.ComponentProps<"div">) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  /*
   * Automatically check whether the email
   * has been verified.
   */
  useEffect(() => {
    const checkVerification = async () => {
      const user = auth.currentUser;

      if (!user) {
        onLogin();
        return;
      }

      try {
        await reload(user);

        const updatedUser = auth.currentUser;

        if (!updatedUser?.emailVerified) {
          return;
        }

        const pendingProfile =
          localStorage.getItem(
            "pendingEspasyoProfile"
          );

        if (!pendingProfile) {
          setError(
            "Your email is verified, but your profile information could not be found."
          );
          return;
        }

        const profile = JSON.parse(pendingProfile);

        await setDoc(
          doc(db, "users", updatedUser.uid),
          {
            id: updatedUser.uid,
            full_name: profile.full_name,
            email: updatedUser.email,
            phone_number: profile.contact,
            address: "",
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          }
        );

        localStorage.removeItem(
          "pendingEspasyoProfile"
        );

        setMessage(
          "Your email has been verified successfully."
        );

        setTimeout(() => {
          onLogin();
        }, 1000);
      } catch (error) {
        console.error(
          "Email verification check error:",
          error
        );
      }
    };

    /*
     * Check immediately, then every 3 seconds.
     */
    checkVerification();

    const interval = setInterval(
      checkVerification,
      3000
    );

    return () => clearInterval(interval);
  }, [onLogin]);

  /*
   * 60-second resend countdown.
   */
  useEffect(() => {
    if (resendTimer <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendTimer((previous) =>
        previous > 0 ? previous - 1 : 0
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [resendTimer]);

  const resendVerification = async () => {
    if (!auth.currentUser) {
      onLogin();
      return;
    }

    if (resendTimer > 0) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await sendEmailVerification(
        auth.currentUser
      );

      setMessage(
        "A new verification email has been sent to your email."
      );

      setResendTimer(60);
    } catch (error: any) {
      console.error(
        "Resend verification error:",
        error
      );

      if (
        error.code ===
        "auth/too-many-requests"
      ) {
        setError(
          "Too many requests. Please wait before requesting another email."
        );

        setResendTimer(60);
      } else {
        setError(
          "Unable to send the verification email. Please try again later."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const email =
    auth.currentUser?.email;

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        className
      )}
      {...props}
    >
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            Verify your email
          </CardTitle>

          <CardDescription>
            {email
              ? `We sent a verification link to ${email}.`
              : "We sent a verification link to your email."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <FieldGroup>

            {message && (
              <FieldDescription>
                {message}
              </FieldDescription>
            )}

            {error && (
              <FieldDescription className="text-destructive">
                {error}
              </FieldDescription>
            )}

            <Field>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={resendVerification}
                disabled={
                  loading || resendTimer > 0
                }
              >
                {loading
                  ? "Sending..."
                  : resendTimer > 0
                  ? `Resend Verification Email (${resendTimer}s)`
                  : "Resend Verification Email"}
              </Button>
            </Field>
            <FieldDescription className="text-center">
              Can't find the email? Please check
              your <strong>Spam</strong>,{" "}
              <strong>Junk</strong>, or{" "}
              <strong>Promotions</strong> folder.
            </FieldDescription>

            <FieldDescription className="text-center">
              Want to go back?{" "}

              <button
                type="button"
                onClick={onLogin}
                className="cursor-pointer underline underline-offset-4 hover:underline"
              >
                Sign in
              </button>
            </FieldDescription>

          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}

