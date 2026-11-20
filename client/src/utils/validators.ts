import {
  validateEmail as validateEmailFormat,
  validateFullName as validateNameFormat,
  validatePassword as validateStrongPassword,
} from "../../../shared/auth/formValidation.mjs";

export interface LoginFormData {
  email: string;
  password: string;
}

export {
  getPasswordRequirements,
  normalizeFullName,
} from "../../../shared/auth/formValidation.mjs";

export function validateEmail(value: string): string {
  return validateEmailFormat(value);
}

export function validatePassword(value: string): string {
  return validateStrongPassword(value);
}

export function validateFullName(value: string): string {
  return validateNameFormat(value);
}

export function validateLoginForm(
  data: LoginFormData
): string {
  return validateEmail(data.email) || (data.password ? "" : "Password is required.");
}