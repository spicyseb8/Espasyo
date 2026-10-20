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

export function validateFullName(value: string): string {
  const name = value.trim();

  if (!name) return "Please enter your full name.";

  if (!/^[\p{L}\s]+$/u.test(name)) {
    return "Use letters and spaces only.";
  }

  if (!/\p{L}/u.test(name)) {
    return "Please enter a valid full name.";
  }

  return "";
}

export function validateEmail(value: string): string {
  const email = value.trim();

  if (!email) return "Please enter your email.";

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return "Please enter a valid email address.";
  }

  return "";
}

export function validateContact(value: string): string {
  const contact = value.trim();
  if (!contact) return "Please enter your contact number.";

  if (!/^\+?\d+(?:[ -]\d+)*$/.test(contact)) {
    return "Enter a valid Philippine mobile number.";
  }

  const normalized = contact.replace(/[ -]/g, "");
  if (!/^(09\d{9}|\+639\d{9})$/.test(normalized)) {
    return "Enter a valid Philippine mobile number starting with 09 or +639.";
  }

  return "";
}

export function validatePassword(value: string): string {
  if (!value) return "Please enter your password.";

  if (value.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  return "";
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
  return (
    validateEmail(data.email) ||
    validatePassword(data.password)
  );
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
  if (!data.name.trim()) {
    return "Please enter the person's name.";
  }

  if (!data.email.trim()) {
    return "Please enter an email address.";
  }

  const emailError = validateEmail(data.email);
  if (emailError) return emailError;

  if (!data.password) {
    return "Please enter a password.";
  }

  if (data.password.length < 6) {
    return "Password must be at least 6 characters.";
  }

  if (!data.phoneNumber.trim()) {
    return "Please enter a phone number.";
  }

  if (accountType === "user" && !data.address.trim()) {
    return "Please enter an address.";
  }

  if (accountType !== "user" && !data.role.trim()) {
    return "Please select an employee role.";
  }

  return "";
}