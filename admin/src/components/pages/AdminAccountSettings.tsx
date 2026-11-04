import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type StorageReference,
} from "firebase/storage";
import { Timestamp } from "firebase/firestore";
import {
  Camera,
  KeyRound,
  LoaderCircle,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { auth, storage } from "@/firebase/firebase";
import {
  getCurrentAdminProfile,
  saveCurrentAdminProfile,
  type AdminAccountProfile,
} from "@/services/adminAccountSettings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

function splitName(name: string) {
  const [firstName = "", ...lastNameParts] = name.trim().split(/\s+/);
  return {
    firstName,
    lastName: lastNameParts.join(" "),
  };
}

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "A"
  );
}

function formatAccountDate(value: unknown) {
  let date: Date | null = null;

  if (value instanceof Timestamp) {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) {
      date = parsedDate;
    }
  }

  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString()
    : "Not available";
}

function validateImageAvailability(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        resolve();
      } else {
        reject(new Error("The selected file is not a valid image."));
      }
    };
    image.onerror = () => {
      reject(new Error("The selected image could not be opened."));
    };
    image.src = url;
  });
}

function getPasswordError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : "";

  if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return "The current password is incorrect.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (code === "auth/weak-password") {
    return "Choose a stronger password with at least 6 characters.";
  }
  if (code === "auth/requires-recent-login") {
    return "Please sign in again before changing your password.";
  }

  return "Could not change your password. Check your current password and try again.";
}

export default function AdminAccountSettings() {
  const { user, role } = useAuth();
  const [loadedProfile, setLoadedProfile] = useState<{
    uid: string;
    profile: AdminAccountProfile;
  } | null>(null);
  const [profileLoadFailure, setProfileLoadFailure] = useState<{
    uid: string;
    message: string;
  } | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [validatingPhoto, setValidatingPhoto] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photoPreview) {
      return;
    }

    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  useEffect(() => {
    if (!user || !role) {
      return;
    }

    let cancelled = false;

    void getCurrentAdminProfile(user, role)
      .then((loadedProfile) => {
        if (cancelled) {
          return;
        }

        setLoadedProfile({ uid: user.uid, profile: loadedProfile });
        setProfileLoadFailure(null);
        setProfileError("");
        setProfileMessage("");
        const name = splitName(loadedProfile.name);
        setFirstName(name.firstName);
        setLastName(name.lastName);
      })
      .catch((error: unknown) => {
        console.error("Failed to load admin account profile:", error);
        if (!cancelled) {
          setProfileLoadFailure({
            uid: user.uid,
            message:
              error instanceof Error
                ? error.message
                : "Could not load your admin profile.",
          });
        }
      })
      .catch((error: unknown) => {
        console.error("Unexpected admin profile loading failure:", error);
        if (!cancelled) {
          setProfileLoadFailure({
            uid: user.uid,
            message: "Could not load your admin profile.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, role]);

  const profile =
    loadedProfile && user && loadedProfile.uid === user.uid
      ? loadedProfile.profile
      : null;
  const profileLoadError =
    profileLoadFailure && user && profileLoadFailure.uid === user.uid
      ? profileLoadFailure.message
      : "";
  const loadingProfile =
    Boolean(user && role) && !profile && !profileLoadError;
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const hasProfileChanges =
    Boolean(profile) &&
    (fullName !== profile?.name.trim() || Boolean(photoFile));
  const avatarUrl = photoPreview || profile?.avatar || "";
  const hasPasswordProvider =
    user?.providerData.some((provider) => provider.providerId === "password") ??
    false;

  function clearProfileFeedback() {
    setProfileError("");
    setProfileMessage("");
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    clearProfileFeedback();

    if (!PROFILE_IMAGE_TYPES.has(file.type)) {
      setProfileError("Choose a JPEG, PNG, WebP, or GIF image.");
      input.value = "";
      return;
    }
    if (file.size === 0) {
      setProfileError("The selected image is empty.");
      input.value = "";
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      setProfileError("Profile pictures must be 5 MB or smaller.");
      input.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setValidatingPhoto(true);

    void validateImageAvailability(previewUrl)
      .then(() => {
        setPhotoFile(file);
        setPhotoPreview(previewUrl);
      })
      .catch((error: unknown) => {
        URL.revokeObjectURL(previewUrl);
        input.value = "";
        setProfileError(
          error instanceof Error
            ? error.message
            : "The selected image could not be opened."
        );
      })
      .finally(() => setValidatingPhoto(false));
  }

  function cancelProfileChanges() {
    if (!profile) {
      return;
    }

    const name = splitName(profile.name);
    setFirstName(name.firstName);
    setLastName(name.lastName);
    setPhotoFile(null);
    setPhotoPreview("");
    clearProfileFeedback();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearProfileFeedback();

    if (!user || !role || !profile) {
      setProfileError("Your admin profile is not available. Reload and try again.");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setProfileError("Enter both your first and last name.");
      return;
    }

    setSavingProfile(true);
    let uploadedImage: StorageReference | null = null;

    try {
      let avatar = profile.avatar;

      if (photoFile) {
        const extension = PROFILE_IMAGE_TYPES.get(photoFile.type);
        if (!extension) {
          throw new Error("Choose a JPEG, PNG, WebP, or GIF image.");
        }

        uploadedImage = ref(
          storage,
          `adminEmployees/${user.uid}/profile/avatar-${Date.now()}-${crypto.randomUUID()}.${extension}`
        );
        await uploadBytes(uploadedImage, photoFile, {
          contentType: photoFile.type,
        });
        avatar = await getDownloadURL(uploadedImage);
      }

      const savedProfile = await saveCurrentAdminProfile(user, role, {
        name: fullName,
        avatar,
      });
      setLoadedProfile({ uid: user.uid, profile: savedProfile });
      setPhotoFile(null);
      setPhotoPreview("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setProfileMessage("Your profile information has been updated.");

      try {
        const currentUser = auth.currentUser;
        if (!currentUser || currentUser.uid !== user.uid) {
          throw new Error("Your signed-in account changed.");
        }
        await updateProfile(currentUser, {
          displayName: fullName,
          photoURL: avatar || null,
        });
      } catch (syncError) {
        console.error("Failed to sync Firebase Auth profile:", syncError);
        setProfileError(
          "Your admin profile was saved, but Firebase sign-in profile details could not be synchronized."
        );
      }
    } catch (error) {
      if (uploadedImage) {
        try {
          await deleteObject(uploadedImage);
        } catch (cleanupError) {
          console.error("Failed to remove an unused profile image:", cleanupError);
        }
      }
      console.error("Failed to save admin account profile:", error);
      setProfileError(
        error instanceof Error
          ? error.message
          : "Could not update your profile. Please try again."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (!user || !hasPasswordProvider) {
      setPasswordError("Password changes are unavailable for this sign-in method.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Your new password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== user.uid || !currentUser.email) {
        throw new Error("Your signed-in account could not be verified.");
      }

      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Your password has been changed.");
    } catch (error) {
      console.error("Failed to change admin password:", error);
      setPasswordError(
        error instanceof Error &&
          error.message === "Your signed-in account could not be verified."
          ? error.message
          : getPasswordError(error)
      );
    } finally {
      setSavingPassword(false);
    }
  }

  const displayEmail =
    user?.email ?? profile?.email ?? "Not available";
  const accountStatus = profile?.accountStatus ?? "Not available";
  const isActive = accountStatus.toLowerCase() === "active";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Account Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your admin profile and sign-in security.
        </p>
      </header>

      {!user || !role ? (
        <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
          Sign in with an admin account to manage account settings.
        </p>
      ) : loadingProfile ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading your account information…
          </CardContent>
        </Card>
      ) : profileLoadError ? (
        <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
          {profileLoadError}
        </p>
      ) : profile ? (
        <>
          <Card>
            <CardHeader className="border-b border-border/60">
              <div className="flex items-start gap-3">
                <UserRound className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Profile information</CardTitle>
                  <CardDescription className="mt-1">
                    Update the name and picture shown across the admin app.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <form className="space-y-5" onSubmit={handleProfileSave}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarUrl} alt={fullName || profile.name} />
                    <AvatarFallback>{getInitials(fullName || profile.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="admin-profile-photo">Profile picture</Label>
                    <Input
                      ref={fileInputRef}
                      id="admin-profile-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handlePhotoChange}
                      disabled={validatingPhoto || savingProfile}
                      aria-describedby="admin-profile-photo-help"
                      className="h-auto min-h-9 py-1.5 file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1 file:text-sm file:font-medium"
                    />
                    <p id="admin-profile-photo-help" className="text-xs text-muted-foreground">
                      JPEG, PNG, WebP, or GIF. Maximum file size: 5 MB.
                    </p>
                    {validatingPhoto && (
                      <p role="status" className="text-xs text-muted-foreground">
                        Checking image…
                      </p>
                    )}
                  </div>
                  <Camera className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="admin-first-name">First name</Label>
                    <Input
                      id="admin-first-name"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(event) => {
                        setFirstName(event.target.value);
                        clearProfileFeedback();
                      }}
                      disabled={savingProfile}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-last-name">Last name</Label>
                    <Input
                      id="admin-last-name"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(event) => {
                        setLastName(event.target.value);
                        clearProfileFeedback();
                      }}
                      disabled={savingProfile}
                      required
                    />
                  </div>
                </div>

                {profileError && (
                  <p role="alert" className="text-sm text-destructive">
                    {profileError}
                  </p>
                )}
                {profileMessage && (
                  <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
                    {profileMessage}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    disabled={
                      savingProfile ||
                      validatingPhoto ||
                      !hasProfileChanges ||
                      !firstName.trim() ||
                      !lastName.trim()
                    }
                  >
                    {savingProfile ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    {savingProfile ? "Saving…" : "Save changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelProfileChanges}
                    disabled={savingProfile || validatingPhoto || !hasProfileChanges}
                  >
                    <X />
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Account information</CardTitle>
                  <CardDescription className="mt-1">
                    Your account identity and access details. These fields are read-only.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <div className="space-y-1">
                  <dt className="text-sm text-muted-foreground">Full name</dt>
                  <dd className="break-words font-medium">{profile.name || "Not available"}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm text-muted-foreground">Email address</dt>
                  <dd className="break-all font-medium">{displayEmail}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm text-muted-foreground">Admin role</dt>
                  <dd>
                    <Badge variant="secondary" className="capitalize">
                      {profile.role}
                    </Badge>
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm text-muted-foreground">Account status</dt>
                  <dd>
                    <Badge variant={isActive ? "secondary" : "outline"} className="capitalize">
                      {accountStatus}
                    </Badge>
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm text-muted-foreground">Account created</dt>
                  <dd className="font-medium">{formatAccountDate(profile.createdAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Change password</CardTitle>
                  <CardDescription className="mt-1">
                    Confirm your current password before choosing a new one.
                    Passwords are handled only by Firebase Authentication.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {hasPasswordProvider ? (
                <form className="space-y-4" onSubmit={handlePasswordSave}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="admin-current-password">Current password</Label>
                      <Input
                        id="admin-current-password"
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(event) => {
                          setCurrentPassword(event.target.value);
                          setPasswordError("");
                          setPasswordMessage("");
                        }}
                        disabled={savingPassword}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-new-password">New password</Label>
                      <Input
                        id="admin-new-password"
                        type="password"
                        autoComplete="new-password"
                        minLength={6}
                        value={newPassword}
                        onChange={(event) => {
                          setNewPassword(event.target.value);
                          setPasswordError("");
                          setPasswordMessage("");
                        }}
                        disabled={savingPassword}
                        required
                      />
                      <p className="text-xs text-muted-foreground">At least 6 characters.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-confirm-password">Confirm new password</Label>
                      <Input
                        id="admin-confirm-password"
                        type="password"
                        autoComplete="new-password"
                        minLength={6}
                        value={confirmPassword}
                        onChange={(event) => {
                          setConfirmPassword(event.target.value);
                          setPasswordError("");
                          setPasswordMessage("");
                        }}
                        disabled={savingPassword}
                        required
                      />
                    </div>
                  </div>
                  {passwordError && (
                    <p role="alert" className="text-sm text-destructive">
                      {passwordError}
                    </p>
                  )}
                  {passwordMessage && (
                    <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
                      {passwordMessage}
                    </p>
                  )}
                  <Button type="submit" disabled={savingPassword}>
                    {savingPassword ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <KeyRound />
                    )}
                    {savingPassword ? "Updating…" : "Update password"}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Password changes are not available for this sign-in method.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
