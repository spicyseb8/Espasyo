import { useCallback, useEffect, useRef, useState } from "react";
import {
  confirmPasswordReset,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
  verifyPasswordResetCode,
} from "firebase/auth";
import { Check } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

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
import PasswordField from "@/components/auth/PasswordField";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { auth } from "@/firebase/firebase";
import {
  resendVerificationEmail,
} from "@/firebase/auth";
import { useAuth } from "@/context/AuthContext";
import { getUserProfileByAuthUid } from "@/firebase/user";
import LoadingScreen from "@/scene/LoadingScreen";
import { validateEmail, validateLoginForm, validatePassword } from "@/utils/validators";
import { ensureEmailVerified } from "../../../../shared/auth/loginVerification.mjs";
import { getLoginErrorMessage } from "../../../../shared/auth/loginErrors.mjs";
import {
  LegalDocumentContent,
  type LegalDocument,
} from "@/components/legal/LegalDocumentContent";
import {
  saveLegalAcceptance,
} from "@/services/legalAcceptance";

type LoginMode = "login" | "forgot" | "reset";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const {
    user: authenticatedUser,
    loading: authLoading,
    verifyAgreement,
  } = useAuth();
  const location = useLocation();
  const locationState = location.state as {
    from?: unknown;
    accessError?: unknown;
  } | null;
  const from = locationState?.from;
  const fromPath = typeof from === "string"
    ? from
    : from && typeof from === "object" && "pathname" in from
      ? `${typeof from.pathname === "string" ? from.pathname : ""}${
          "search" in from && typeof from.search === "string" ? from.search : ""
        }${
          "hash" in from && typeof from.hash === "string" ? from.hash : ""
        }`
      : "";
  const requestedPath = fromPath.startsWith("/") && !fromPath.startsWith("//")
    ? fromPath
    : "/home";
  const initialResetParams = new URLSearchParams(location.search);
  const initialResetMode = initialResetParams.get("mode") === "resetPassword";
  const [mode, setMode] = useState<LoginMode>(() => {
    return initialResetMode ? "reset" : "login";
  });
  const [resetCode, setResetCode] = useState<string | null>(() => {
    return initialResetMode ? initialResetParams.get("oobCode") : null;
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [error, setError] = useState(
    typeof locationState?.accessError === "string"
      ? locationState.accessError
      : initialResetMode && !initialResetParams.get("oobCode")
        ? "This reset link is invalid or has expired."
        : "",
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [resetCooldownSeconds, setResetCooldownSeconds] = useState(0);
  const resetCooldownUntil = useRef(0);
  const [resetLoading, setResetLoading] = useState(() => mode === "reset" && Boolean(resetCode));
  const [resetSaving, setResetSaving] = useState(false);
  const [resetLinkInvalid, setResetLinkInvalid] = useState(
    () => mode === "reset" && !resetCode,
  );
  const [loading, setLoading] = useState(false);
  const [showSuspendedDialog, setShowSuspendedDialog] = useState(false);
  const [activeLegalDocument, setActiveLegalDocument] = useState<LegalDocument>("terms");
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const [privacyPolicyRead, setPrivacyPolicyRead] = useState(false);
  const [agreedToPolicies, setAgreedToPolicies] = useState(false);
  const [pendingAcceptanceUser, setPendingAcceptanceUser] = useState<User | null>(null);
  const [acceptanceSaveError, setAcceptanceSaveError] = useState("");
  const [savingAcceptance, setSavingAcceptance] = useState(false);
  const [acceptanceNeedsReview, setAcceptanceNeedsReview] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<LegalDocument, number>>({ terms: 0, privacy: 0 });
  const acceptanceChoice = useRef({
    termsRead: false,
    privacyPolicyRead: false,
    agreedToPolicies: false,
    email: "",
  });
  const acceptanceSaveInFlight = useRef(false);
  const authenticationInFlight = useRef(false);
  const canSubmit = !loading && !resendingVerification && !pendingAcceptanceUser;

  useEffect(() => {
    if (mode !== "reset") return;
    let cancelled = false;
    if (!resetCode) return;
    void verifyPasswordResetCode(auth, resetCode)
      .then(verifiedEmail => {
        if (!cancelled) {
          setResetEmail(verifiedEmail);
          setResetLinkInvalid(false);
          setError("");
        }
      })
      .catch(error => {
        if (cancelled) return;
        const code = typeof error === "object" && error !== null && "code" in error
          ? error.code
          : undefined;
        if (code === "auth/expired-action-code" || code === "auth/invalid-action-code") {
          setResetLinkInvalid(true);
          setError("This reset link is invalid or has expired.");
        } else {
          console.error("Unable to verify the password reset link:", error);
          setError("Unable to verify this reset link. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setResetLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, resetCode]);

  useEffect(() => {
    if (mode !== "forgot" || resetCooldownSeconds <= 0) return;
    const timeout = window.setTimeout(() => {
      const remaining = Math.max(
        0,
        Math.ceil((resetCooldownUntil.current - Date.now()) / 1000),
      );
      setResetCooldownSeconds(remaining);
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [mode, resetCooldownSeconds]);

  function openLegalDocument(document: LegalDocument) {
    if (scrollAreaRef.current) {
      scrollPositions.current[activeLegalDocument] = scrollAreaRef.current.scrollTop;
    }
    setActiveLegalDocument(document);
    setLegalModalOpen(true);
  }

  function switchLegalDocument(document: LegalDocument) {
    if (scrollAreaRef.current) {
      scrollPositions.current[activeLegalDocument] = scrollAreaRef.current.scrollTop;
    }
    setActiveLegalDocument(document);
  }

  useEffect(() => {
    if (!legalModalOpen) return;
    const scrollArea = scrollAreaRef.current;
    const content = contentRef.current;
    if (!scrollArea || !content) return;

    scrollArea.scrollTop = scrollPositions.current[activeLegalDocument];
    const markDocumentReadAtEnd = () => {
      scrollPositions.current[activeLegalDocument] = scrollArea.scrollTop;
      if (
        scrollArea.scrollTop > 0 &&
        scrollArea.scrollTop + scrollArea.clientHeight >= scrollArea.scrollHeight - 4
      ) {
        if (activeLegalDocument === "terms") {
          setTermsRead(true);
          acceptanceChoice.current.termsRead = true;
        } else {
          setPrivacyPolicyRead(true);
          acceptanceChoice.current.privacyPolicyRead = true;
        }
      }
    };

    scrollArea.addEventListener("scroll", markDocumentReadAtEnd, { passive: true });
    const resizeObserver = new ResizeObserver(markDocumentReadAtEnd);
    resizeObserver.observe(scrollArea);
    resizeObserver.observe(content);
    return () => {
      scrollArea.removeEventListener("scroll", markDocumentReadAtEnd);
      resizeObserver.disconnect();
    };
  }, [activeLegalDocument, legalModalOpen]);

  const continueToRequestedPath = useCallback(() => {
    setTermsRead(true);
    setPrivacyPolicyRead(true);
    setAgreedToPolicies(true);
    acceptanceChoice.current = {
      termsRead: true,
      privacyPolicyRead: true,
      agreedToPolicies: true,
      email: auth.currentUser?.email?.trim().toLowerCase() ?? "",
    };
    setPendingAcceptanceUser(null);
    setAcceptanceNeedsReview(false);
    setAcceptanceSaveError("");
    navigate(requestedPath, { replace: true });
    return true;
  }, [navigate, requestedPath]);

  const checkAuthenticatedClient = useCallback(async (
    user: User,
    isCancelled: () => boolean = () => false,
  ): Promise<boolean> => {
    try {
      await reload(user);
    } catch (reloadError) {
      if (auth.currentUser?.uid === user.uid) await signOut(auth);
      if (!isCancelled()) {
        console.error("Unable to refresh client authentication:", reloadError);
        setError("We could not verify your account. Please sign in again.");
      }
      return false;
    }
    if (isCancelled() || auth.currentUser?.uid !== user.uid) return false;

    if (!user.emailVerified) {
      const verification = await ensureEmailVerified(
        user,
        sendEmailVerification,
        () => auth.currentUser?.uid === user.uid
          ? signOut(auth)
          : Promise.resolve(),
      );
      if (verification.verificationError) {
        console.error(
          "Unable to send client email verification:",
          verification.verificationError,
        );
      }
      if (!isCancelled()) {
        setShowResendVerification(true);
        const verificationCode =
          typeof verification.verificationError === "object" &&
            verification.verificationError !== null &&
            "code" in verification.verificationError &&
            typeof verification.verificationError.code === "string"
            ? verification.verificationError.code
            : undefined;
        setError(verification.verificationSent
          ? `A verification email has been sent to ${user.email ?? "your email"}. Verify it, then sign in again.`
          : verificationCode === "auth/too-many-requests"
            ? "Too many verification emails were requested. Please wait before trying again."
            : "Your email is not verified, and a verification email could not be sent. Try again later or contact support.");
      }
      return false;
    }

    let profile: Awaited<ReturnType<typeof getUserProfileByAuthUid>>;
    try {
      profile = await getUserProfileByAuthUid(user.uid);
    } catch (profileError) {
      if (auth.currentUser?.uid === user.uid) await signOut(auth);
      if (!isCancelled()) {
        console.error("Unable to load the client profile:", profileError);
        setError("We could not verify your client profile. Please sign in again or contact support.");
      }
      return false;
    }
    if (isCancelled() || auth.currentUser?.uid !== user.uid) return false;
    const profileIsActive = profile?.isActive === true ||
      (profile?.isActive === undefined && profile?.account_status === "active");
    if (!profile || !profileIsActive) {
      if (auth.currentUser?.uid === user.uid) {
        await signOut(auth);
      }
      if (!isCancelled()) {
        setError(
          "We could not find an active client profile linked to this login. Contact support for help.",
        );
      }
      return false;
    }

    try {
      const accepted = await verifyAgreement(user);
      if (isCancelled() || auth.currentUser?.uid !== user.uid) return false;
      if (accepted) {
        return continueToRequestedPath();
      }

      setPendingAcceptanceUser(user);
      setAcceptanceNeedsReview(true);
      setAcceptanceSaveError("");
      const choice = acceptanceChoice.current;
      if (
        choice.termsRead &&
        choice.privacyPolicyRead &&
        choice.agreedToPolicies &&
        choice.email === user.email?.trim().toLowerCase()
      ) {
        try {
          await saveLegalAcceptance(user);
          if (!await verifyAgreement(user, true)) {
            throw new Error("We could not verify your agreement. Please retry.");
          }
          if (isCancelled() || auth.currentUser?.uid !== user.uid) return false;
          return continueToRequestedPath();
        } catch (saveError) {
          if (isCancelled() || auth.currentUser?.uid !== user.uid) return false;
          console.error("Unable to save client agreement acceptance:", saveError);
          setAcceptanceSaveError(
            saveError instanceof Error
              ? saveError.message
              : "We could not save your agreement. Please retry.",
          );
        }
        return false;
      }
      return false;
    } catch (verificationError) {
      if (isCancelled() || auth.currentUser?.uid !== user.uid) return false;
      console.error("Unable to verify client agreement acceptance:", verificationError);
      await signOut(auth);
      setPendingAcceptanceUser(null);
      setAcceptanceNeedsReview(false);
      setError("We could not verify your agreement. Please sign in again and retry.");
      return false;
    }
  }, [continueToRequestedPath, verifyAgreement]);

  useEffect(() => {
    if (authLoading || !authenticatedUser || authenticationInFlight.current) return;

    let cancelled = false;
    void checkAuthenticatedClient(authenticatedUser, () => cancelled).catch(error => {
      console.error("Unable to verify the signed-in client account:", error);
      if (!cancelled) {
        setError("We could not verify your account. Please retry.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authenticatedUser, authLoading, checkAuthenticatedClient]);

  async function retryAcceptanceSave() {
    if (!pendingAcceptanceUser || acceptanceSaveInFlight.current) return;
    acceptanceSaveInFlight.current = true;
    setSavingAcceptance(true);
    setAcceptanceSaveError("");
    try {
      let accepted = await verifyAgreement(pendingAcceptanceUser, true);
      if (auth.currentUser?.uid !== pendingAcceptanceUser.uid) {
        throw new Error("Your session changed. Please sign in again.");
      }

      if (!accepted) {
        if (!termsRead || !privacyPolicyRead || !agreedToPolicies) {
          setAcceptanceNeedsReview(true);
          return;
        }
        await saveLegalAcceptance(pendingAcceptanceUser);
        accepted = await verifyAgreement(pendingAcceptanceUser, true);
      }
      if (!accepted) {
        throw new Error("We could not verify your agreement. Please retry.");
      }
      continueToRequestedPath();
    } catch (saveError) {
      console.error("Unable to save client agreement acceptance:", saveError);
      setAcceptanceSaveError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save your agreement. Please retry.",
      );
    } finally {
      setSavingAcceptance(false);
      acceptanceSaveInFlight.current = false;
    }
  }

  async function handleResendVerification() {
    if (resendingVerification || !email.trim() || !password) {
      setError("Enter your email and password to resend the verification email.");
      return;
    }

    setResendingVerification(true);
    setError("");
    setStatusMessage("");
    try {
      const alreadyVerified = await resendVerificationEmail(email, password);
      setShowResendVerification(!alreadyVerified);
      setStatusMessage(alreadyVerified
        ? "Your email is already verified. You can sign in now."
        : `A verification email has been sent to ${email.trim()}.`);
    } catch (resendError) {
      console.error("Unable to resend the client verification email:", resendError);
      const errorCode = typeof resendError === "object" && resendError !== null &&
          "code" in resendError && typeof resendError.code === "string"
        ? resendError.code
        : undefined;
      setError(errorCode === "auth/too-many-requests"
        ? "Too many verification attempts. Please wait a while before trying again."
        : getLoginErrorMessage(errorCode, "Unable to resend the verification email. Please try again."));
      setShowResendVerification(true);
    } finally {
      setResendingVerification(false);
    }
  }

  function showForgotPassword() {
    setResetEmail(email);
    setMode("forgot");
    setError("");
    setStatusMessage("");
  }

  function returnToLogin() {
    setMode("login");
    setError("");
    setStatusMessage("");
  }

  async function handleForgotPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingPasswordReset || resetCooldownSeconds > 0) return;
    const emailError = validateEmail(resetEmail);
    if (emailError) {
      setError(emailError);
      return;
    }

    setSendingPasswordReset(true);
    setError("");
    setStatusMessage("");
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase(), {
        url: new URL(location.pathname, window.location.origin).toString(),
        handleCodeInApp: true,
      });
      setStatusMessage("If an account exists for that email, a password reset email has been sent.");
    } catch (resetError) {
      console.error("Unable to send a password reset email:", resetError);
      const errorCode = typeof resetError === "object" && resetError !== null &&
          "code" in resetError && typeof resetError.code === "string"
        ? resetError.code
        : undefined;
      if (errorCode === "auth/too-many-requests") {
        setError("Too many reset emails were requested. Please wait before trying again.");
      } else if (errorCode === "auth/network-request-failed") {
        setError("Network error. Please check your connection and try again.");
      } else {
        setStatusMessage("If an account exists for that email, a password reset email has been sent.");
      }
    } finally {
      setSendingPasswordReset(false);
      resetCooldownUntil.current = Date.now() + 30_000;
      setResetCooldownSeconds(30);
    }
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatusMessage("");
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (!resetCode) {
      setResetLinkInvalid(true);
      setError("This reset link is invalid or has expired.");
      return;
    }

    setResetSaving(true);
    try {
      await confirmPasswordReset(auth, resetCode, newPassword);
      window.history.replaceState(
        window.history.state,
        document.title,
        window.location.pathname,
      );
      setResetCode(null);
      setMode("login");
      setEmail(resetEmail);
      setPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setResetLinkInvalid(false);
      setStatusMessage("Password updated. You can now log in.");
    } catch (resetError) {
      console.error("Unable to update the client password:", resetError);
      const errorCode = typeof resetError === "object" && resetError !== null &&
          "code" in resetError && typeof resetError.code === "string"
        ? resetError.code
        : undefined;
      if (errorCode === "auth/expired-action-code" || errorCode === "auth/invalid-action-code") {
        setResetLinkInvalid(true);
        setError("This reset link is invalid or has expired.");
      } else if (errorCode === "auth/weak-password") {
        setError("Your password must be at least 8 characters.");
      } else if (errorCode === "auth/network-request-failed") {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError(getLoginErrorMessage(errorCode, "Unable to update your password. Please try again."));
      }
    } finally {
      setResetSaving(false);
    }
  }

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (authenticationInFlight.current || !canSubmit) return;

    setError("");
    setStatusMessage("");
    setShowResendVerification(false);

    const validationError = validateLoginForm({
      email,
      password,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    authenticationInFlight.current = true;

    let navigatingToHome = false;
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

      navigatingToHome = await checkAuthenticatedClient(userCredential.user);
    } catch (error: unknown) {
      console.error("Login error:", error);
      const errorCode = typeof error === "object" && error !== null &&
          "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;
      if (errorCode === "auth/user-disabled") {
        setShowSuspendedDialog(true);
      } else {
        setError(getLoginErrorMessage(errorCode));
      }
    } finally {
      if (!navigatingToHome) {
        setLoading(false);
        authenticationInFlight.current = false;
      }
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100]">
        <LoadingScreen label="Signing in" />
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {mode === "login"
              ? "Welcome back"
              : mode === "forgot"
                ? "Forgot password"
                : "Reset your password"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Sign in with your email and password."
              : mode === "forgot"
                ? "Enter your email and we’ll send you a password reset link."
                : resetEmail
                  ? `Resetting password for ${resetEmail}`
                  : "Verifying your password reset link."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {mode === "login" && (
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={event => {
                      const nextEmail = event.target.value;
                      setEmail(nextEmail);
                      setStatusMessage("");
                      setShowResendVerification(false);
                      if (nextEmail.trim().toLowerCase() !== acceptanceChoice.current.email) {
                        setAgreedToPolicies(false);
                        acceptanceChoice.current.agreedToPolicies = false;
                      }
                      setError("");
                    }}
                    autoComplete="email"
                    required
                  />
                </Field>

                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Button
                      type="button"
                      variant="link"
                      className="ml-auto h-auto px-0 py-0 text-xs"
                      disabled={loading}
                      onClick={showForgotPassword}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={event => {
                      setPassword(event.target.value);
                      setError("");
                      setStatusMessage("");
                    }}
                    autoComplete="current-password"
                    required
                  />
                </Field>

                {error && <FieldDescription className="text-destructive">{error}</FieldDescription>}
                {statusMessage && <FieldDescription role="status">{statusMessage}</FieldDescription>}
                {showResendVerification && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={resendingVerification || loading}
                    onClick={() => void handleResendVerification()}
                  >
                    {resendingVerification ? "Sending verification email..." : "Resend verification email"}
                  </Button>
                )}
                <Button type="submit" className="w-full" disabled={!canSubmit}>
                  {loading ? "Signing in..." : "Login"}
                </Button>
              </FieldGroup>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="reset-email">Email</FieldLabel>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={event => {
                      setResetEmail(event.target.value);
                      setError("");
                      setStatusMessage("");
                    }}
                    autoComplete="email"
                    required
                  />
                </Field>
                {error && <FieldDescription className="text-destructive" role="alert">{error}</FieldDescription>}
                {statusMessage && <FieldDescription role="status">{statusMessage}</FieldDescription>}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={sendingPasswordReset || resetCooldownSeconds > 0}
                >
                  {sendingPasswordReset
                    ? "Sending..."
                    : resetCooldownSeconds > 0
                      ? `Resend in ${resetCooldownSeconds}s`
                      : "Send reset link"}
                </Button>
                <Button type="button" variant="link" className="w-full" onClick={returnToLogin}>
                  Back to login
                </Button>
              </FieldGroup>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleResetPassword}>
              <FieldGroup>
                {resetLoading ? (
                  <FieldDescription role="status">Verifying reset link...</FieldDescription>
                ) : resetLinkInvalid ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setResetEmail(email);
                      setMode("forgot");
                      setError("");
                    }}
                  >
                    Request a new reset link
                  </Button>
                ) : (
                  <>
                    <FieldDescription>Resetting password for {resetEmail}</FieldDescription>
                    <PasswordField
                      id="reset-new-password"
                      label="New password"
                      value={newPassword}
                      onChange={value => {
                        setNewPassword(value);
                        setError("");
                      }}
                      autoComplete="new-password"
                      minLength={8}
                    />
                    <PasswordField
                      id="reset-confirm-password"
                      label="Confirm password"
                      value={confirmNewPassword}
                      onChange={value => {
                        setConfirmNewPassword(value);
                        setError("");
                      }}
                      autoComplete="new-password"
                      minLength={8}
                    />
                    <Button type="submit" className="w-full" disabled={resetSaving}>
                      {resetSaving ? "Updating password..." : "Update password"}
                    </Button>
                  </>
                )}
                {error && <FieldDescription className="text-destructive" role="alert">{error}</FieldDescription>}
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>

      {mode === "login" && !pendingAcceptanceUser && (
        <div className="space-y-3 px-6 text-center">
          <FieldDescription>
            Read the{" "}
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => openLegalDocument("terms")}
            >
              Terms of Service
            </button>
            {" and "}
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => openLegalDocument("privacy")}
            >
              Privacy Policy
            </button>
            {" before agreeing. If your account has already accepted the current versions, you can continue without reviewing them again."}
          </FieldDescription>
          <label className={`flex items-start gap-3 text-left text-sm leading-relaxed ${
            termsRead && privacyPolicyRead
              ? "cursor-pointer"
              : "cursor-not-allowed opacity-60"
          }`}>
            <input
              type="checkbox"
              checked={agreedToPolicies}
              disabled={!termsRead || !privacyPolicyRead}
              onChange={event => {
                const checked = event.target.checked;
                setAgreedToPolicies(checked);
                acceptanceChoice.current.agreedToPolicies = checked;
                acceptanceChoice.current.email = email.trim().toLowerCase();
              }}
              className="mt-1 size-4 accent-primary"
            />
            <span>I have read and agree to the Terms of Service and Privacy Policy.</span>
          </label>
        </div>
      )}

      {pendingAcceptanceUser && (
        <div className="space-y-3 px-6" role="status">
          {acceptanceNeedsReview ? (
            <>
              <p className="text-sm">
                Read both documents and confirm your agreement to continue.
              </p>
              <FieldDescription>
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={() => openLegalDocument("terms")}
                >
                  Terms of Service
                </button>
                {" and "}
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={() => openLegalDocument("privacy")}
                >
                  Privacy Policy
                </button>
              </FieldDescription>
              <label className={`flex items-start gap-3 text-left text-sm leading-relaxed ${
                termsRead && privacyPolicyRead
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-60"
              }`}>
                <input
                  type="checkbox"
                  checked={agreedToPolicies}
                  disabled={!termsRead || !privacyPolicyRead || savingAcceptance}
                  onChange={event => {
                    const checked = event.target.checked;
                    setAgreedToPolicies(checked);
                    acceptanceChoice.current.agreedToPolicies = checked;
                    acceptanceChoice.current.email = email.trim().toLowerCase();
                  }}
                  className="mt-1 size-4 accent-primary"
                />
                <span>I have read and agree to the Terms of Service and Privacy Policy.</span>
              </label>
            </>
          ) : (
            <p className="text-sm text-destructive">
              Your login succeeded, but we could not verify your agreement. Protected areas remain unavailable until verification succeeds.
            </p>
          )}
          {acceptanceSaveError && (
            <p className="text-sm text-destructive" role="alert">{acceptanceSaveError}</p>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={savingAcceptance || (
              acceptanceNeedsReview &&
              (!termsRead || !privacyPolicyRead || !agreedToPolicies)
            )}
            onClick={() => void retryAcceptanceSave()}
          >
            {savingAcceptance
              ? "Verifying..."
              : acceptanceNeedsReview
                ? acceptanceSaveError
                  ? "Retry saving agreement"
                  : "Agree and continue"
                : "Retry verification"}
          </Button>
        </div>
      )}

      {legalModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setLegalModalOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-legal-modal-title"
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border bg-background shadow-xl"
            onClick={event => event.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-4 border-b p-4">
              <div>
                <h2 id="login-legal-modal-title" className="text-lg font-semibold">
                  {activeLegalDocument === "terms" ? "Terms of Service" : "Privacy Policy"}
                </h2>
                <div className="mt-2 flex gap-4 text-sm">
                  <button
                    type="button"
                    className={activeLegalDocument === "terms" ? "font-semibold underline" : "underline"}
                    aria-current={activeLegalDocument === "terms" ? "page" : undefined}
                    onClick={() => switchLegalDocument("terms")}
                  >
                    Terms of Service
                    {termsRead && <Check className="ml-1 inline size-4" aria-label="Read" />}
                  </button>
                  <button
                    type="button"
                    className={activeLegalDocument === "privacy" ? "font-semibold underline" : "underline"}
                    aria-current={activeLegalDocument === "privacy" ? "page" : undefined}
                    onClick={() => switchLegalDocument("privacy")}
                  >
                    Privacy Policy
                    {privacyPolicyRead && <Check className="ml-1 inline size-4" aria-label="Read" />}
                  </button>
                </div>
              </div>
            </header>
            <div
              ref={scrollAreaRef}
              className="min-h-0 flex-1 overflow-y-auto p-5"
              tabIndex={0}
              aria-label={`${activeLegalDocument === "terms" ? "Terms of Service" : "Privacy Policy"} content`}
            >
              <div ref={contentRef}>
                <LegalDocumentContent document={activeLegalDocument} />
              </div>
            </div>
            <footer className="flex justify-end border-t p-4">
              <Button type="button" variant="outline" onClick={() => setLegalModalOpen(false)}>
                Close
              </Button>
            </footer>
          </section>
        </div>
      )}

      <AlertDialog
        open={showSuspendedDialog}
        onOpenChange={setShowSuspendedDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account suspended</AlertDialogTitle>
            <AlertDialogDescription>
              This account has been suspended by an administrator. Contact
              support if you believe this is a mistake.
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