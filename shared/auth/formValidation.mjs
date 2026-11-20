/**
 * @typedef {{
 *   id: "length" | "uppercase" | "lowercase" | "number" | "special",
 *   label: string,
 *   satisfied: boolean
 * }} PasswordRequirement
 */

/**
 * @param {string} value
 */
export function normalizeFullName(value) {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * @param {string} value
 */
export function validateFullName(value) {
  const name = normalizeFullName(value);
  if (!name) return "Full name is required.";
  if (name.split(" ").length < 2) {
    return "Please enter both your first and last name.";
  }
  if (!/^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*(?: [\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*)+$/u.test(name)) {
    return "Please enter a valid full name.";
  }
  return "";
}

/**
 * @param {string} value
 */
export function validateEmail(value) {
  const email = value.trim();
  if (!email) return "Email address is required.";

  const parts = email.split("@");
  if (parts.length !== 2) return "Please enter a valid email address.";
  const [localPart, domain] = parts;
  const domainLabels = domain.split(".");
  const validLocalPart =
    localPart.length <= 64 &&
    /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(localPart);
  const tld = domainLabels[domainLabels.length - 1] ?? "";
  const validDomain =
    domain.length <= 253 &&
    domainLabels.length >= 2 &&
    domainLabels.every((label) =>
      label.length <= 63 &&
      /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label)
    ) &&
    (/^[A-Za-z]{2,}$/.test(tld) || /^xn--[A-Za-z0-9-]{2,}$/i.test(tld));

  if (email.length > 254 || !validLocalPart || !validDomain) {
    return "Please enter a valid email address.";
  }
  return "";
}

/**
 * @param {string} value
 */
export function validatePhilippinePhone(value) {
  if (!value) return "Phone number is required.";
  return /^9\d{9}$/.test(value)
    ? ""
    : "Please enter all 10 digits of your Philippine mobile number.";
}

/**
 * @param {string} value
 */
export function normalizePhilippinePhone(value) {
  return `+63${value}`;
}

/**
 * @param {string} value
 */
export function sanitizePhilippineSubscriberNumber(value) {
  return value.replace(/\D/g, "").slice(0, 10);
}

/**
 * @param {string} value
 * @returns {PasswordRequirement[]}
 */
export function getPasswordRequirements(value) {
  return [
    { id: "length", label: "At least 8 characters", satisfied: value.length >= 8 },
    { id: "uppercase", label: "One uppercase letter", satisfied: /\p{Lu}/u.test(value) },
    { id: "lowercase", label: "One lowercase letter", satisfied: /\p{Ll}/u.test(value) },
    { id: "number", label: "One number", satisfied: /\p{N}/u.test(value) },
    { id: "special", label: "One special character", satisfied: /[\p{P}\p{S}]/u.test(value) },
  ];
}

/**
 * @param {string} value
 */
export function validatePassword(value) {
  if (!value) return "Password is required.";
  return getPasswordRequirements(value).some((requirement) => !requirement.satisfied)
    ? "Password must satisfy all listed requirements."
    : "";
}
