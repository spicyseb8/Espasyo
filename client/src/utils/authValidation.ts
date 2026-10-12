
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
  if (!value) return "Please enter your contact number.";

  if (!/^\d{11}$/.test(value)) {
    return "Contact number must contain exactly 11 digits.";
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
