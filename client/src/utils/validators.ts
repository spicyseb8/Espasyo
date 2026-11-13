export interface LoginFormData {
  email: string;
  password: string;
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

export function validatePassword(value: string): string {
  if (!value) return "Please enter your password.";

  if (value.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  return "";
}

export function validateLoginForm(
  data: LoginFormData
): string {
  return (
    validateEmail(data.email) ||
    validatePassword(data.password)
  );
}