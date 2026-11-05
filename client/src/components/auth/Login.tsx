import { useCallback, useEffect, useRef, useState } from "react";
import {
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { useAuth } from "@/context/AuthContext";
import { getUserProfileByAuthUid } from "@/firebase/user";
import LoadingScreen from "@/scene/LoadingScreen";
import { validateLoginForm } from "@/utils/validators";
import { ensureEmailVerified } from "../../../../shared/auth/loginVerification.mjs";
import { getLoginErrorMessage } from "../../../../shared/auth/loginErrors.mjs";
import {
  LegalDocumentContent,
  type LegalDocument,
} from "@/components/legal/LegalDocumentContent";
import {
  getLegalAcceptance,
  saveLegalAcceptance,
} from "@/services/legalAcceptance";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const { user: authenticatedUser, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
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
  const canSubmit = !loading && !pendingAcceptanceUser;

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
    navigate("/home", { replace: true });
    return true;
  }, [navigate]);

  const checkAuthenticatedClient = useCallback(async (
    user: User,
    isCancelled: () => boolean = () => false,
  ): Promise<boolean> => {
    await reload(user);
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
        setError(
          verification.verificationSent
            ? "A verification email has been sent. Verify your email, then sign in again."
            : "Your email is not verified, and a verification email could not be sent. Please try again or contact support.",
        );
      }
      return false;
    }

    const profile = await getUserProfileByAuthUid(user.uid);
    if (isCancelled() || auth.currentUser?.uid !== user.uid) return false;
    if (!profile || profile.account_status !== "active") {
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
      const accepted = await getLegalAcceptance(user);
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
          if (!await getLegalAcceptance(user)) {
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
      setPendingAcceptanceUser(user);
      setAcceptanceNeedsReview(false);
      setAcceptanceSaveError(
        verificationError instanceof Error
          ? verificationError.message
          : "We could not verify your agreement. Please retry.",
      );
      return false;
    }
  }, [continueToRequestedPath]);

  useEffect(() => {
    if (authLoading || !authenticatedUser || authenticationInFlight.current) return;

    let cancelled = false;
    setError("");
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
      let accepted = await getLegalAcceptance(pendingAcceptanceUser);
      if (auth.currentUser?.uid !== pendingAcceptanceUser.uid) {
        throw new Error("Your session changed. Please sign in again.");
      }
      if (!accepted) {
        if (!termsRead || !privacyPolicyRead || !agreedToPolicies) {
          setAcceptanceNeedsReview(true);
          return;
        }
        await saveLegalAcceptance(pendingAcceptanceUser);
        accepted = await getLegalAcceptance(pendingAcceptanceUser);
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

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (authenticationInFlight.current || !canSubmit) return;

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
            Welcome back
          </CardTitle>

          <CardDescription>
            Login with your Apple or Google account
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>

              {/* Apple */}
              <Field>
                <Button
                  variant="outline"
                  type="button"
                  className="w-full"
                  disabled={!canSubmit}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                      fill="currentColor"
                    />
                  </svg>

                  Login with Apple
                </Button>
              </Field>

              {/* Google */}
              <Field>
                <Button
                  variant="outline"
                  type="button"
                  className="w-full"
                  disabled={!canSubmit}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12.173 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>

                  Login with Google
                </Button>
              </Field>

              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>

              {/* Email */}
              <Field>
                <FieldLabel htmlFor="email">
                  Email
                </FieldLabel>

                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => {
                    const nextEmail = e.target.value;
                    setEmail(nextEmail);
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

              {/* Password */}
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">
                    Password
                  </FieldLabel>
                </div>

                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError("");
                  }}
                  autoComplete="current-password"
                  required
                />
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
                  disabled={!canSubmit}
                >
                  {loading
                    ? "Signing in..."
                    : "Login"}
                </Button>
              </Field>

            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {!pendingAcceptanceUser && (
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