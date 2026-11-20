import assert from "node:assert/strict";
import test from "node:test";

import {
  getPasswordRequirements,
  normalizeFullName,
  normalizePhilippinePhone,
  sanitizePhilippineSubscriberNumber,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePhilippinePhone,
} from "./formValidation.mjs";

test("full names accept international names and normalize whitespace", () => {
  assert.equal(validateFullName("  Mary-Jane   O'Connor  "), "");
  assert.equal(validateFullName("José Álvarez"), "");
  assert.equal(validateFullName("山田 太郎"), "");
  assert.equal(validateFullName("O’Connor Smith"), "");
  assert.equal(normalizeFullName("  Mary-Jane   O'Connor  "), "Mary-Jane O'Connor");
});

test("full names distinguish missing components from invalid characters", () => {
  assert.equal(validateFullName("   "), "Full name is required.");
  assert.equal(validateFullName("Madonna"), "Please enter both your first and last name.");
  assert.equal(validateFullName("Jane Doe2"), "Please enter a valid full name.");
});

test("email validation rejects malformed local parts and domains", () => {
  assert.equal(validateEmail(" person@example.co "), "");
  assert.equal(validateEmail("person..name@example.com"), "Please enter a valid email address.");
  assert.equal(validateEmail("person@example"), "Please enter a valid email address.");
  assert.equal(validateEmail("person@-example.com"), "Please enter a valid email address.");
});

test("password requirements update independently and require every rule", () => {
  const states = getPasswordRequirements("Abcdefg1");
  assert.deepEqual(states.map((requirement) => requirement.satisfied), [
    true, true, true, true, false,
  ]);
  assert.equal(validatePassword("Abcdefg1"), "Password must satisfy all listed requirements.");
  assert.equal(validatePassword("Abcdefg1é"), "Password must satisfy all listed requirements.");
  assert.equal(validatePassword("Abcdefg1!"), "");
});

test("Philippine phone numbers require ten subscriber digits and normalize once", () => {
  assert.equal(validatePhilippinePhone(""), "Phone number is required.");
  assert.equal(validatePhilippinePhone("912345678"), "Please enter all 10 digits of your Philippine mobile number.");
  assert.equal(validatePhilippinePhone("91234567890"), "Please enter all 10 digits of your Philippine mobile number.");
  assert.equal(validatePhilippinePhone("91234ABCDE"), "Please enter all 10 digits of your Philippine mobile number.");
  assert.equal(validatePhilippinePhone("9123456789"), "");
  assert.equal(normalizePhilippinePhone("9123456789"), "+639123456789");
  assert.equal(sanitizePhilippineSubscriberNumber("91234ABCDE"), "91234");
  assert.equal(sanitizePhilippineSubscriberNumber("9123456789012"), "9123456789");
});
