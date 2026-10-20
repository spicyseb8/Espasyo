import assert from "node:assert/strict";
import test from "node:test";
import { FURNITURE_CATEGORY_SECTIONS } from "./FurnitureCategory.ts";

test("furniture sections include new types and legacy room categories", () => {
  const categories = FURNITURE_CATEGORY_SECTIONS.map(
    ({ category }) => category
  );

  for (const category of [
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
  ]) {
    assert.ok(categories.includes(category), `${category} section is available`);
  }

  for (const category of [
    "livingRoom",
    "bedroom",
    "diningRoom",
    "kitchen",
    "bathroom",
    "office",
  ]) {
    assert.ok(categories.includes(category), `${category} legacy section remains`);
  }
});
