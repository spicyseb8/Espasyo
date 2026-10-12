
export interface SignupFormData {
  firstName: string;
  middleInitial: string;
  surname: string;
  email: string;
  contact: string;
  password: string;
  confirmPassword: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

// Allows letters, spaces, hyphens, and apostrophes.
const NAME_REGEX = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;

export function validateFirstName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");

  if (!name) return "Please enter your first name.";
  if (name.length > 50) {
    return "First name must not exceed 50 characters.";
  }
  if (!NAME_REGEX.test(name)) {
    return "Use valid letters, spaces, hyphens, or apostrophes.";
  }

  return "";
}

export function validateMiddleInitial(value: string): string {
  const initial = value.trim().replace(/\./g, "");

  // Middle initial is optional.
  if (!initial) return "";

  if (!/^\p{L}$/u.test(initial)) {
    return "Enter only one letter for your middle initial.";
  }

  return "";
}

export function validateSurname(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");

  if (!name) return "Please enter your surname.";
  if (name.length > 50) {
    return "Surname must not exceed 50 characters.";
  }
  if (!NAME_REGEX.test(name)) {
    return "Use valid letters, spaces, hyphens, or apostrophes.";
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

  if (!/^\d{11}$/.test(contact)) {
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
    validateFirstName(data.firstName) ||
    validateMiddleInitial(data.middleInitial) ||
    validateSurname(data.surname) ||
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
