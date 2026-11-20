import {
  validateEmail as validateEmailFormat,
  validateFullName as validateNameFormat,
  validatePassword as validateStrongPassword,
  validatePhilippinePhone,
} from "../../../shared/auth/formValidation.mjs";

export interface SignupFormData {
  fullName: string;
  email: string;
  contact: string;
  password: string;
  confirmPassword: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface AccountCreationFormData {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  address: string;
  role: string;
}

export {
  getPasswordRequirements,
  normalizeFullName,
  normalizePhilippinePhone,
  sanitizePhilippineSubscriberNumber,
  validatePhilippinePhone,
} from "../../../shared/auth/formValidation.mjs";

export function validateFullName(value: string): string {
  return validateNameFormat(value);
}

export function validateEmail(value: string): string {
  return validateEmailFormat(value);
}

export function validateContact(value: string): string {
  const contact = value.trim();
  if (!contact) return "Phone number is required.";

  const digits = contact.replace(/\D/g, "");
  const subscriberNumber = digits.startsWith("63")
    ? digits.slice(2)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  return validatePhilippinePhone(subscriberNumber);
}

export function validatePassword(value: string): string {
  return validateStrongPassword(value);
}

export function validateConfirmPassword(
  password: string,
  confirmPassword: string
): string {
  if (!confirmPassword) {
    return "Please confirm your password.";
  }

  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }

  return "";
}

export function validateSignupForm(
  data: SignupFormData
): string {
  return (
    validateFullName(data.fullName) ||
    validateEmail(data.email) ||
    validateContact(data.contact) ||
    validatePassword(data.password) ||
    validateConfirmPassword(
      data.password,
      data.confirmPassword
    )
  );
}

export function validateLoginForm(
  data: LoginFormData
): string {
  return validateEmail(data.email) || (data.password ? "" : "Password is required.");
}

export function validateAdminLoginForm(
  data: LoginFormData
): string {
  if (!data.email.trim()) {
    return "Please enter your email address.";
  }

  const emailError = validateEmail(data.email);
  if (emailError) return emailError;

  if (!data.password) {
    return "Please enter your password.";
  }

  return "";
}

export function validateAccountCreationForm(
  data: AccountCreationFormData,
  accountType: "user" | "employee" | "superadmin"
): string {
  const nameError = validateFullName(data.name);
  if (nameError) return nameError;

  const emailError = validateEmail(data.email);
  if (emailError) return emailError;

  const passwordError = validatePassword(data.password);
  if (passwordError) return passwordError;

  const phoneError = validatePhilippinePhone(data.phoneNumber);
  if (phoneError) return phoneError;

  if (accountType === "user" && !data.address.trim()) {
    return "Please enter an address.";
  }

  if (accountType !== "user" && !data.role.trim()) {
    return "Please select an employee role.";
  }

  return "";
}