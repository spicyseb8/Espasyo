export interface PasswordRequirement {
  id: "length" | "uppercase" | "lowercase" | "number" | "special";
  label: string;
  satisfied: boolean;
}

export function normalizeFullName(value: string): string;
export function validateFullName(value: string): string;
export function validateEmail(value: string): string;
export function validatePhilippinePhone(value: string): string;
export function normalizePhilippinePhone(value: string): string;
export function sanitizePhilippineSubscriberNumber(value: string): string;
export function getPasswordRequirements(value: string): PasswordRequirement[];
export function validatePassword(value: string): string;
