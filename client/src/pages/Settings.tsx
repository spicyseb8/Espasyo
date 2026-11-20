import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import {
  Globe2,
  UserRound,
} from "lucide-react";
import NavBar from "./NavBar";
import { useAuth } from "../context/AuthContext";
import { storage } from "../firebase/firebase";
import {
  getUserProfileByAuthUid,
} from "../firebase/user";
import { saveUserProfile } from "../services/userSettings";
import {
  LegalDocumentContent,
  type LegalDocument,
} from "../components/legal/LegalDocumentContent";
import PasswordField from "../components/auth/PasswordField";
import {
  getPasswordRequirements,
  normalizeFullName,
  validateFullName,
  validatePassword,
} from "../utils/validators";

type SettingsSection = "account" | "legal";

const SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: typeof UserRound;
}[] = [
  { id: "account", label: "Account Settings", icon: UserRound },
  { id: "legal", label: "Legal & Privacy", icon: Globe2 },
];

function SettingField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="grid gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

function Feedback({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  if (!message) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`text-sm ${error ? "text-destructive" : "text-emerald-700"}`}
    >
      {message}
    </p>
  );
}

function AccountSettings() {
  const { user, loading: authLoading } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentPasswordTouched, setCurrentPasswordTouched] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [passwordSubmitted, setPasswordSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fullName = normalizeFullName(`${firstName} ${lastName}`);
  const nameValidationError = nameTouched || nameSubmitted
    ? validateFullName(fullName)
    : "";
  const currentPasswordValidationError = (currentPasswordTouched || passwordSubmitted) && !currentPassword
    ? "Current password is required."
    : "";
  const newPasswordValidationError = newPasswordTouched || passwordSubmitted
    ? validatePassword(newPassword)
    : "";
  const confirmPasswordValidationError = confirmPasswordTouched || passwordSubmitted
    ? !confirmPassword
      ? "Please confirm your password."
      : confirmPassword !== newPassword
        ? "Passwords do not match."
        : ""
    : "";
  const passwordRequirements = getPasswordRequirements(newPassword);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    void getUserProfileByAuthUid(user.uid)
      .then(profile => {
        if (cancelled) return;
        const fullName = user.displayName?.trim() ||
          (typeof profile?.full_name === "string" ? profile.full_name.trim() : "");
        const nameParts = fullName.split(/\s+/).filter(Boolean);
        setFirstName(nameParts[0] ?? "");
        setLastName(nameParts.slice(1).join(" "));
        setProfileEmail(user.email ?? "");
        setProfilePhoto(
          user.photoURL ??
          (typeof profile?.photo_url === "string" ? profile.photo_url : null)
        );
      })
      .catch(loadError => {
        console.error("Failed to load account profile:", loadError);
        if (!cancelled) setError("Could not load your account profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const hasPasswordProvider =
    user?.providerData.some(provider => provider.providerId === "password") ?? false;

  useEffect(() => {
    if (!profilePhoto?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(profilePhoto);
  }, [profilePhoto]);

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    clearFeedback();
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for your profile picture.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile pictures must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setPhotoFile(file);
    setProfilePhoto(URL.createObjectURL(file));
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setNameSubmitted(true);
    if (!user) {
      setError("Sign in to update your profile.");
      return;
    }

    if (validateFullName(fullName)) {
      return;
    }

    try {
      setSavingProfile(true);
      let photoUrl = user.photoURL;
      if (photoFile) {
        const imageRef = ref(storage, `users/${user.uid}/profile/avatar`);
        await uploadBytes(imageRef, photoFile, { contentType: photoFile.type });
        photoUrl = await getDownloadURL(imageRef);
      }

      await updateProfile(user, { displayName: fullName, photoURL: photoUrl });
      await saveUserProfile(user.uid, {
        fullName,
        email: user.email ?? profileEmail,
        photoUrl,
      });
      setPhotoFile(null);
      setProfilePhoto(photoUrl);
      setMessage("Your profile has been updated.");
    } catch (saveError) {
      console.error("Failed to update account profile:", saveError);
      setError("Could not update your profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function reauthenticate() {
    if (!user?.email || !currentPassword) {
      throw new Error("Enter your current password to continue.");
    }
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, currentPassword)
    );
  }

  async function handlePasswordSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setPasswordSubmitted(true);
    setCurrentPasswordTouched(true);
    setNewPasswordTouched(true);
    setConfirmPasswordTouched(true);
    if (!user || !hasPasswordProvider) return;
    if (validatePassword(newPassword) || !currentPassword || !confirmPassword || newPassword !== confirmPassword) {
      return;
    }

    try {
      setSavingPassword(true);
      await reauthenticate();
      await updatePassword(user, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPasswordTouched(false);
      setNewPasswordTouched(false);
      setConfirmPasswordTouched(false);
      setPasswordSubmitted(false);
      setMessage("Your password has been changed.");
    } catch (saveError) {
      console.error("Failed to change password:", saveError);
      setError(
        saveError instanceof Error && saveError.message.startsWith("Enter")
          ? saveError.message
          : "Could not change your password. Check your current password and try again."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    if (authLoading) {
      return <p className="py-8 text-sm text-muted-foreground">Loading account information…</p>;
    }
    if (!user) {
      return <p className="py-8 text-sm text-muted-foreground">Sign in to manage your account settings.</p>;
    }
    return <p className="py-8 text-sm text-muted-foreground">Loading account information…</p>;
  }

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Profile information</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Update the name and picture shown on your account.
          </p>
        </div>
        <form className="space-y-5" onSubmit={handleProfileSave} noValidate>
          <div className="flex items-center gap-4">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="size-16 rounded-full object-cover" />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {(firstName[0] ?? "") + (lastName[0] ?? "")}
              </div>
            )}
            <SettingField label="Profile picture" htmlFor="profile-picture">
              <input
                id="profile-picture"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="max-w-full text-sm font-normal file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium"
              />
            </SettingField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingField label="First name" htmlFor="first-name">
              <input
                id="first-name"
                autoComplete="given-name"
                value={firstName}
                onChange={event => {
                  setFirstName(event.target.value);
                  setNameTouched(true);
                  clearFeedback();
                }}
                onBlur={() => setNameTouched(true)}
                className={`h-10 rounded-md border bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 ${
                  nameValidationError
                    ? "border-destructive focus-visible:ring-destructive"
                    : (nameTouched || nameSubmitted) && fullName
                      ? "border-emerald-600 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/30"
                      : "border-input focus-visible:ring-ring"
                }`}
                required
                aria-invalid={Boolean(nameValidationError)}
                aria-describedby={nameValidationError ? "client-profile-name-error" : undefined}
              />
            </SettingField>
            <SettingField label="Last name" htmlFor="last-name">
              <input
                id="last-name"
                autoComplete="family-name"
                value={lastName}
                onChange={event => {
                  setLastName(event.target.value);
                  setNameTouched(true);
                  clearFeedback();
                }}
                onBlur={() => setNameTouched(true)}
                className={`h-10 rounded-md border bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 ${
                  nameValidationError
                    ? "border-destructive focus-visible:ring-destructive"
                    : (nameTouched || nameSubmitted) && fullName
                      ? "border-emerald-600 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/30"
                      : "border-input focus-visible:ring-ring"
                }`}
                required
                aria-invalid={Boolean(nameValidationError)}
                aria-describedby={nameValidationError ? "client-profile-name-error" : undefined}
              />
            </SettingField>
          </div>
          <p id="client-profile-name-error" className="min-h-5 text-xs text-destructive" aria-live="polite">
            {nameValidationError}
          </p>
          <Feedback message={error} error />
          <Feedback message={message} />
          <button type="submit" disabled={savingProfile} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85 disabled:opacity-50">
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <div>
          <h2 className="text-lg font-semibold">Account information</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your account identity and sign-in details.</p>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Account ID</dt>
            <dd className="mt-1 break-all font-medium">{user?.uid}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email address</dt>
            <dd className="mt-1 break-all font-medium">{profileEmail || user?.email || "Not set"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sign-in method</dt>
            <dd className="mt-1 font-medium">
              {user?.providerData.map(provider => provider.providerId).join(", ") || "Unknown"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email verification</dt>
            <dd className="mt-1 font-medium">{user?.emailVerified ? "Verified" : "Not verified"}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <div>
          <h2 className="text-lg font-semibold">Change password</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your password is handled only by Firebase Authentication and is never saved in your profile.
          </p>
        </div>
        {hasPasswordProvider ? (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handlePasswordSave} noValidate>
            <PasswordField
              id="password-current"
              label="Current password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={value => {
                setCurrentPassword(value);
                setCurrentPasswordTouched(true);
              }}
              onBlur={() => setCurrentPasswordTouched(true)}
              ariaInvalid={Boolean(currentPasswordValidationError)}
              ariaDescribedBy={currentPasswordValidationError ? "client-current-password-error" : undefined}
              inputClassName={!currentPasswordValidationError && (currentPasswordTouched || passwordSubmitted) && currentPassword
                ? "border-emerald-600 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/30"
                : ""}
              description={<p id="client-current-password-error" className="min-h-5 text-xs text-destructive" aria-live="polite">
                {currentPasswordValidationError}
              </p>}
            />
            <span />
            <div className="space-y-2">
              <PasswordField
                id="new-password"
                label="New password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={value => {
                  setNewPassword(value);
                  setNewPasswordTouched(true);
                }}
                onBlur={() => setNewPasswordTouched(true)}
                ariaInvalid={Boolean(newPasswordValidationError)}
                ariaDescribedBy={newPasswordTouched || passwordSubmitted
                  ? "client-password-requirements client-new-password-error"
                  : undefined}
                inputClassName={!newPasswordValidationError && (newPasswordTouched || passwordSubmitted) && newPassword
                  ? "border-emerald-600 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/30"
                  : ""}
              />
              {(newPasswordTouched || passwordSubmitted) && (
                <>
                  <ul id="client-password-requirements" className="space-y-1 text-xs" aria-live="polite">
                    {passwordRequirements.map(requirement => (
                      <li
                        key={requirement.id}
                        className={requirement.satisfied ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}
                      >
                        <span aria-hidden="true">{requirement.satisfied ? "✓" : "○"} </span>
                        {requirement.label}
                      </li>
                    ))}
                  </ul>
                  <p id="client-new-password-error" className="min-h-5 text-xs text-destructive" aria-live="polite">
                    {newPasswordValidationError}
                  </p>
                </>
              )}
            </div>
            <PasswordField
              id="confirm-password"
              label="Confirm new password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={value => {
                setConfirmPassword(value);
                setConfirmPasswordTouched(true);
              }}
              onBlur={() => setConfirmPasswordTouched(true)}
              ariaInvalid={Boolean(confirmPasswordValidationError)}
              ariaDescribedBy={confirmPasswordValidationError ? "client-confirm-password-error" : undefined}
              inputClassName={!confirmPasswordValidationError && (confirmPasswordTouched || passwordSubmitted) && confirmPassword
                ? "border-emerald-600 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/30"
                : ""}
              description={<p id="client-confirm-password-error" className="min-h-5 text-xs text-destructive" aria-live="polite">
                {confirmPasswordValidationError}
              </p>}
            />
            <button type="submit" disabled={savingPassword} className="h-10 w-fit rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">
              {savingPassword ? "Changing…" : "Change password"}
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Password changes are not available for this sign-in provider.</p>
        )}
      </section>
    </div>
  );
}

function LegalSettings() {
  const [document, setDocument] = useState<LegalDocument>("terms");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b border-border">
        {([
          ["terms", "Terms of Service"],
          ["privacy", "Privacy Policy"],
          ["project-participation", "Participation Agreement"],
          ["project-adjustment", "Adjustment Policy"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setDocument(value)}
            aria-pressed={document === value}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              document === value
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <article
        aria-labelledby="legal-document-title"
        className="max-h-[55vh] min-h-56 overflow-y-auto rounded-md border border-border p-5"
      >
        <LegalDocumentContent document={document} />
      </article>
    </div>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const { user } = useAuth();
  const active = SECTIONS.find(section => section.id === activeSection)!;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-28 sm:px-8">
        <header className="mb-8 border-b border-border pb-5">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage your account and legal documents.</p>
        </header>
        <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Settings categories" className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
            {SECTIONS.map(section => {
              const Icon = section.icon;
              const selected = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  aria-current={selected ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition ${
                    selected
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                  {section.label}
                </button>
              );
            })}
          </nav>
          <section aria-labelledby="settings-section-title" className="min-w-0 border-t border-border pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
            <h2 id="settings-section-title" className="mb-6 text-xl font-semibold">{active.label}</h2>
            {activeSection === "account" && <AccountSettings key={user?.uid ?? "anonymous"} />}
            {activeSection === "legal" && <LegalSettings />}
          </section>
        </div>
      </main>
    </div>
  );
}