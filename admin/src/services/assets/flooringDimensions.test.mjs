import assert from "node:assert/strict";
import test from "node:test";
import {
  centimetersToMeters,
  metersToCentimeters,
  resolveMeterDimension,
} from "./flooringDimensions.ts";

test("converts entered centimeters to stored meters", () => {
  assert.equal(centimetersToMeters(60), 0.6);
  assert.equal(centimetersToMeters(30), 0.3);
});

test("reopening and saving stored dimensions preserves their meter values", () => {
  for (const meters of [0.6, 0.3, 1.234, 1.23456789012345]) {
    assert.equal(resolveMeterDimension(metersToCentimeters(meters), meters), meters);
  }
});

test("changed centimeter values convert back to meters", () => {
  assert.equal(resolveMeterDimension(75, 0.6), 0.75);
});
