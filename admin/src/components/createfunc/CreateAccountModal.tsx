import { useEffect, useState } from "react";
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
  Phone,
  MapPin,
  Shield,
  Loader2,
} from "lucide-react";

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
  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open) {
      setForm(initialForm);
      setLoading(false);
      setError("");
      setSuccess("");
    }

    if (open) {
      setError("");
      setSuccess("");

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
      ? "Create User Account"
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
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    if (error) setError("");
    if (success) setSuccess("");
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      return "Please enter the person's name.";
    }

    if (!form.email.trim()) {
      return "Please enter an email address.";
    }

    if (!form.email.includes("@")) {
      return "Please enter a valid email address.";
    }

    if (!form.password) {
      return "Please enter a password.";
    }

    if (form.password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    if (!form.phoneNumber.trim()) {
      return "Please enter a phone number.";
    }

    if (accountType === "user" && !form.address.trim()) {
      return "Please enter an address.";
    }

    if (isEmployee && !form.role.trim()) {
      return "Please select an employee role.";
    }

    return null;
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/accounts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountType:
              accountType === "user"
                ? "user"
                : "employee",

            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            phoneNumber: form.phoneNumber.trim(),
            address: form.address.trim(),

            role: isEmployee
              ? form.role
              : undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            "Failed to create account."
        );
      }

      const createdId =
        result.account?.id || "";

      setSuccess(
        createdId
          ? `Account ${createdId} was created successfully.`
          : "Account was created successfully."
      );

      setForm(initialForm);
      onCreated?.();

      setTimeout(() => {
        onOpenChange(false);
      }, 1200);
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
                      placeholder="Enter full name"
                      disabled={loading}
                    />
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
                        placeholder="example@email.com"
                        className="pl-9"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* PASSWORD */}
                  <div className="space-y-2">
                    <Label htmlFor="account-password">
                      Password
                    </Label>

                    <div className="relative">
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
                        placeholder="Minimum 6 characters"
                        className="pl-9"
                        disabled={loading}
                      />
                    </div>

                    <p className="text-xs text-muted-foreground">
                      This password will be used for Firebase Authentication.
                    </p>
                  </div>

                  {/* PHONE */}
                  <div className="space-y-2">
                    <Label htmlFor="account-phone">
                      Phone Number
                    </Label>

                    <div className="relative">
                      <Phone
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
                        id="account-phone"
                        value={form.phoneNumber}
                        onChange={(event) =>
                          updateField(
                            "phoneNumber",
                            event.target.value
                          )
                        }
                        placeholder="09123456789"
                        className="pl-9"
                        disabled={loading}
                      />
                    </div>
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
                </div>
              )}

              {/* ACCOUNT ID INFO */}
              <div className="rounded-xl border border-border/60 bg-muted/20 px-5 py-4">
                <p className="text-xs font-medium">
                  Account ID
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  The system will automatically generate a unique
                  account ID when the account is created.
                </p>

                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {accountType === "user"
                    ? "U-26XXX"
                    : "AE-26XXX"}
                </p>
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