import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserPlus,
  Mail,
  Lock,
  MapPin,
  Shield,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isAdminRole } from "@/lib/adminRole";
import {
  getPasswordRequirements,
  normalizeFullName,
  normalizePhilippinePhone,
  sanitizePhilippineSubscriberNumber,
  validateAccountCreationForm,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePhilippinePhone,
} from "@/utils/validators";
import { createAccount } from "./createAccount";
import { createClientAccount } from "@/firebase/clientAccounts";

export type CreateAccountType =
  | "user"
  | "employee"
  | "superadmin";

interface CreateAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountType: CreateAccountType;
  onCreated?: () => void;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  address: string;
  role: string;
}

const initialForm: FormData = {
  name: "",
  email: "",
  password: "",
  phoneNumber: "",
  address: "",
  role: "admin",
};

export default function CreateAccountModal({
  open,
  onOpenChange,
  accountType,
  onCreated,
}: CreateAccountModalProps) {
  const { role } = useAuth();
  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordToShare, setPasswordToShare] = useState("");
  const [cleanupWarning, setCleanupWarning] = useState("");
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    if (!open) {
      setForm(initialForm);
      setLoading(false);
      setError("");
      setSuccess("");
      setPasswordToShare("");
      setCleanupWarning("");
      setTouched({});
      setSubmitted(false);
    }

    if (open) {
      setError("");
      setSuccess("");
      setPasswordToShare("");
      setCleanupWarning("");
      setTouched({});
      setSubmitted(false);

      setForm((previous) => ({
        ...previous,
        role:
          accountType === "superadmin"
            ? "superadmin"
            : "admin",
      }));
    }
  }, [open, accountType]);

  const isEmployee =
    accountType === "employee" ||
    accountType === "superadmin";

  const title =
    accountType === "user"
      ? "Create Client Account"
      : accountType === "superadmin"
        ? "Create Super Admin Account"
        : "Create Employee Account";

  const description =
    accountType === "user"
      ? "Create a new customer account for Espasyo."
      : accountType === "superadmin"
        ? "Create a new super admin account."
        : "Create a new employee account for the admin system.";

  const updateField = (
    field: keyof FormData,
    value: string
  ) => {
    setTouched((previous) => ({ ...previous, [field]: true }));
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    if (error) setError("");
    if (success) setSuccess("");
  };

  const fieldError = (
    field: keyof FormData,
    value: string,
    validator: (value: string) => string
  ) => submitted || touched[field] ? validator(value) : "";

  const nameError = fieldError("name", form.name, validateFullName);
  const emailError = fieldError("email", form.email, validateEmail);
  const passwordError = fieldError("password", form.password, validatePassword);
  const phoneError = fieldError("phoneNumber", form.phoneNumber, validatePhilippinePhone);
  const passwordRequirements = getPasswordRequirements(form.password);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const canCreate = accountType === "user"
      ? isAdminRole(role)
      : role === "superadmin";
    if (!canCreate || submitLock.current) {
      if (!canCreate) {
        setError(accountType === "user"
          ? "Only admins and superadmins can create client accounts."
          : "Only superadmins can create accounts.");
      }
      return;
    }

    setError("");
    setSuccess("");
    setSubmitted(true);

    const validationError = validateAccountCreationForm(
      form,
      accountType
    );

    if (validationError) {
      if (![
        validateFullName(form.name),
        validateEmail(form.email),
        validatePassword(form.password),
        validatePhilippinePhone(form.phoneNumber),
      ].includes(validationError)) {
        setError(validationError);
      }
      return;
    }

    submitLock.current = true;
    setLoading(true);

    try {
      if (accountType === "user") {
        const result = await createClientAccount({
          name: normalizeFullName(form.name),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          phoneNumber: normalizePhilippinePhone(form.phoneNumber),
          address: form.address,
        }, role);
        setCleanupWarning(result.cleanupWarning ?? "");
        setPasswordToShare(form.password);
        setSuccess(
          `Client created. A verification email was sent to ${form.email.trim()}. The client must verify before signing in.`,
        );
      } else {
        const result = await createAccount({
          accountType: "employee",
          name: normalizeFullName(form.name),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          phoneNumber: normalizePhilippinePhone(form.phoneNumber),
          address: form.address.trim(),
          role: form.role,
        });

        const createdId = result.account?.id || "";
        setSuccess(
          result.activityRecorded === false
            ? result.message
            : createdId
            ? `Account ${createdId} was created successfully.`
            : "Account was created successfully."
        );
      }

      setForm(initialForm);
      setTouched({});
      setSubmitted(false);
      onCreated?.();

      if (accountType !== "user") {
        setTimeout(() => onOpenChange(false), 1200);
      }
    } catch (err) {
      console.error(
        "Create account error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create account."
      );
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!loading) onOpenChange(value);
      }}
    >
      <DialogContent
        className="
          max-h-[90vh]
          w-[95vw]
          max-w-[850px]
          overflow-y-auto
          p-0
          sm:max-w-[850px]
        "
      >
        <div className="flex flex-col">
          {/* HEADER */}
          <DialogHeader className="border-b border-border/60 px-8 py-7">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40">
                <UserPlus
                  size={21}
                  className="text-muted-foreground"
                />
              </div>

              <div>
                <DialogTitle className="text-xl">
                  {title}
                </DialogTitle>

                <DialogDescription className="mt-1">
                  {description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* FORM */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col"
          >
            <div className="space-y-8 px-8 py-8">
              {/* ACCOUNT INFORMATION */}
              <div>
                <div className="mb-5">
                  <p className="text-sm font-semibold">
                    Account Information
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter the login and contact information for this account.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {/* NAME */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="account-name">
                      Full Name
                    </Label>

                    <Input
                      id="account-name"
                      value={form.name}
                      onChange={(event) =>
                        updateField(
                          "name",
                          event.target.value
                        )
                      }
                      onBlur={() => setTouched((previous) => ({ ...previous, name: true }))}
                      placeholder="Enter full name"
                      disabled={loading}
                      required
                      aria-invalid={Boolean(nameError)}
                      aria-describedby={nameError ? "account-name-error" : undefined}
                      className={!nameError && (touched.name || submitted) && form.name.trim()
                        ? "border-emerald-600 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/30"
                        : ""}
                    />
                    <p id="account-name-error" className="min-h-5 text-xs text-destructive" aria-live="polite">
                      {nameError}
                    </p>
                  </div>

                  {/* EMAIL */}
                  <div className="space-y-2">
                    <Label htmlFor="account-email">
                      Email
                    </Label>

                    <div className="relative">
                      <Mail
                        size={16}
                        className="
                          pointer-events-none
                          absolute
                          left-3
                          top-1/2
                          -translate-y-1/2
                          text-muted-foreground
                        "
                      />

                      <Input
                        id="account-email"
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                          updateField(
                            "email",
                            event.target.value
                          )
                        }
                        onBlur={() => setTouched((previous) => ({ ...previous, email: true }))}
                        placeholder="example@email.com"
                        className={`pl-9 ${!emailError && (touched.email || submitted) && form.email.trim()
                          ? "border-emerald-600 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/30"
                          : ""}`}
                        disabled={loading}
                        required
                        aria-invalid={Boolean(emailError)}
                        aria-describedby={emailError ? "account-email-error" : undefined}
                      />
                    </div>
                    <p id="account-email-error" className="min-h-5 text-xs text-destructive" aria-live="polite">
                      {emailError}
                    </p>
                  </div>

                  {/* PASSWORD */}
                  <div className="space-y-2">
                    <Label htmlFor="account-password">
                      Password
                    </Label>

                    <div className="flex gap-2">
                      <div className="relative min-w-0 flex-1">
                        <Lock
                          size={16}
                          className="
                            pointer-events-none
                            absolute
                            left-3
                            top-1/2
                            -translate-y-1/2
                            text-muted-foreground
                          "
                        />

                        <Input
                          id="account-password"
                          type="password"
                          value={form.password}
                          onChange={(event) =>
                            updateField(
                              "password",
                              event.target.value
                            )
                          }
                          onBlur={() => setTouched((previous) => ({ ...previous, password: true }))}
                          placeholder="Choose a secure password"
                          className={`pl-9 ${!passwordError && (touched.password || submitted) && form.password
                            ? "border-emerald-600 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/30"
                            : ""}`}
                          disabled={loading}
                          required
                          aria-invalid={Boolean(passwordError)}
                          aria-describedby={touched.password || submitted
                            ? "account-password-requirements account-password-error"
                            : undefined}
                        />
                      </div>
                      {accountType === "user" && (
                        <Button
                          type="button"
                          variant="outline"
                          aria-label="Generate password"
                          title="Generate password"
                          disabled={loading}
                          onClick={() => {
                            const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
                            const lower = "abcdefghijkmnopqrstuvwxyz";
                            const numbers = "23456789";
                            const special = "!@#$%";
                            const alphabet = `${upper}${lower}${numbers}${special}`;
                            const randomValues = crypto.getRandomValues(new Uint32Array(32));
                            let randomIndex = 0;
                            const pick = (characters: string) =>
                              characters[randomValues[randomIndex++] % characters.length];
                            const characters = [
                              pick(upper),
                              pick(lower),
                              pick(numbers),
                              pick(special),
                              ...Array.from({ length: 12 }, () => pick(alphabet)),
                            ];
                            for (let index = characters.length - 1; index > 0; index--) {
                              const swapIndex = randomValues[randomIndex++] % (index + 1);
                              [characters[index], characters[swapIndex]] =
                                [characters[swapIndex], characters[index]];
                            }
                            const generated = characters.join("");
                            updateField("password", generated);
                          }}
                        >
                          <RefreshCw size={16} />
                          Generate
                        </Button>
                      )}
                    </div>

                    {(touched.password || submitted) && (
                      <>
                        <ul id="account-password-requirements" className="space-y-1 text-xs" aria-live="polite">
                          {passwordRequirements.map((requirement) => (
                            <li
                              key={requirement.id}
                              className={requirement.satisfied ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}
                            >
                              <span aria-hidden="true">{requirement.satisfied ? "✓" : "○"} </span>
                              {requirement.label}
                            </li>
                          ))}
                        </ul>
                        <p id="account-password-error" className="min-h-5 text-xs text-destructive" aria-live="polite">
                          {passwordError}
                        </p>
                      </>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {accountType === "user"
                        ? "Choose a secure initial password and share it with the client."
                          : "Use a secure password for Firebase Authentication."}
                    </p>
                  </div>

                  {/* PHONE */}
                  <div className="space-y-2">
                    <Label htmlFor="account-phone">
                      Phone Number
                    </Label>

                    <div className={`flex h-10 items-center overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                      phoneError
                        ? "border-destructive"
                        : (touched.phoneNumber || submitted) && form.phoneNumber
                          ? "border-emerald-600"
                          : "border-input"
                    }`}>
                      <span className="flex h-full shrink-0 items-center border-r border-input px-3 text-sm text-muted-foreground" aria-hidden="true">
                        +63
                      </span>
                      <Input
                        id="account-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={10}
                        value={form.phoneNumber}
                        onChange={(event) => updateField(
                          "phoneNumber",
                          sanitizePhilippineSubscriberNumber(event.target.value)
                        )}
                        onBlur={() => setTouched((previous) => ({ ...previous, phoneNumber: true }))}
                        placeholder="9123456789"
                        className="h-full rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:border-0 focus-visible:ring-0"
                        disabled={loading}
                        required
                        aria-label="Philippine mobile number, 10 digit subscriber number"
                        aria-invalid={Boolean(phoneError)}
                        aria-describedby={phoneError ? "account-phone-error" : undefined}
                      />
                    </div>
                    <p id="account-phone-error" className="min-h-5 text-xs text-destructive" aria-live="polite">
                      {phoneError}
                    </p>
                  </div>

                  {/* ADDRESS (moved here, right after phone) */}
                  <div className="space-y-2">
                    <Label htmlFor="account-address">
                      Address
                    </Label>

                    <div className="relative">
                      <MapPin
                        size={16}
                        className="
                          pointer-events-none
                          absolute
                          left-3
                          top-1/2
                          -translate-y-1/2
                          text-muted-foreground
                        "
                      />

                      <Input
                        id="account-address"
                        value={form.address}
                        onChange={(event) =>
                          updateField(
                            "address",
                            event.target.value
                          )
                        }
                        placeholder="Enter address"
                        className="pl-9"
                        disabled={loading}
                        required={accountType === "user"}
                      />
                    </div>
                  </div>

                  {/* ROLE (employees / superadmins only) */}
                  {isEmployee && (
                    <div className="space-y-2">
                      <Label htmlFor="account-role">
                        Role
                      </Label>

                      <div className="relative">
                        <Shield
                          size={16}
                          className="
                            pointer-events-none
                            absolute
                            left-3
                            top-1/2
                            -translate-y-1/2
                            text-muted-foreground
                          "
                        />

                        <select
                          id="account-role"
                          value={form.role}
                          onChange={(event) =>
                            updateField(
                              "role",
                              event.target.value
                            )
                          }
                          disabled={
                            loading ||
                            accountType === "superadmin"
                          }
                          className="
                            flex
                            h-10
                            w-full
                            rounded-md
                            border
                            border-input
                            bg-background
                            px-9
                            py-2
                            text-sm
                            ring-offset-background
                            focus-visible:outline-none
                            focus-visible:ring-2
                            focus-visible:ring-ring
                            focus-visible:ring-offset-2
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                          "
                        >
                          {accountType === "superadmin" ? (
                            <option value="superadmin">
                              Super Admin
                            </option>
                          ) : (
                            <option value="admin">
                              Admin
                            </option>
                          )}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ERROR / SUCCESS */}
              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-sm text-destructive">
                    {error}
                  </p>
                </div>
              )}

              {success && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3">
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {success}
                  </p>
                  {passwordToShare && (
                    <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                      Temporary password: <span className="select-all font-mono font-semibold">{passwordToShare}</span>
                    </p>
                  )}
                  {cleanupWarning && (
                    <p className="mt-2 text-sm text-destructive" role="alert">
                      {cleanupWarning}
                    </p>
                  )}
                </div>
              )}

              {/* ACCOUNT ID INFO */}
              <div className="rounded-xl border border-border/60 bg-muted/20 px-5 py-4">
                <p className="text-xs font-medium">
                  Account ID
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {accountType === "user"
                    ? "The Firebase Authentication UID will also identify the client profile."
                    : "The system will automatically generate a unique account ID when the account is created."}
                </p>

                {accountType !== "user" && (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {`U-${String(new Date().getFullYear()).slice(-2)}XXX`}
                </p>
                )}
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex items-center justify-end gap-3 border-t border-border/60 px-8 py-5">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onOpenChange(false)
                }
                disabled={loading}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Create Account
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}