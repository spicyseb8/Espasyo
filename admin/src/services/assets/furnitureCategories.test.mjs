import assert from "node:assert/strict";
import test from "node:test";
import {
  FURNITURE_CATEGORY_OPTIONS,
  FURNITURE_LEGACY_CATEGORIES,
  FURNITURE_SPECIAL_CATEGORIES,
  isOptionalFurniturePrice,
} from "./furnitureCategories.ts";

test("offers revised furniture categories while preserving special and legacy values", () => {
  assert.deepEqual(
    FURNITURE_CATEGORY_OPTIONS.map(([value]) => value),
    [
      "tables",
      "beds",
      "decorations",
      "toilets",
      "vanity",
      "cabinets",
      "appliances",
      "chairs",
      "sofas",
      "lavatory",
      "shelves",
    ]
  );
  assert.deepEqual(
    FURNITURE_SPECIAL_CATEGORIES.map(([value]) => value),
    ["doors", "windows"]
  );
  assert.deepEqual(
    FURNITURE_LEGACY_CATEGORIES.map(([value]) => value),
    ["livingroom", "bedroom", "diningroom", "kitchen", "bathroom", "office"]
  );
});

test("only decorations and appliances have optional prices", () => {
  assert.equal(isOptionalFurniturePrice("decorations"), true);
  assert.equal(isOptionalFurniturePrice("Appliances"), true);
  assert.equal(isOptionalFurniturePrice("chairs"), false);
  assert.equal(isOptionalFurniturePrice("doors"), false);
  assert.equal(isOptionalFurniturePrice("floors"), false);
});
