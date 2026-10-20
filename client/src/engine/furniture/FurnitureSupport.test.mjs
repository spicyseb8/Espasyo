import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedFurnitureCategory } from "./FurnitureSupport.ts";

test("allows table, shelf, and cabinet category variants as supports", () => {
    for (const category of [
        "table",
        "Tables",
        " TABLES ",
        "shelf",
        "Shelves",
        "cabinet",
        "Cabinets"
    ]) {
        assert.equal(isSupportedFurnitureCategory(category), true, category);
    }
});

test("rejects other furniture categories and missing metadata as supports", () => {
    for (const category of [
        "sofa",
        "chairs",
        "decorations",
        "appliances",
        undefined,
        ""
    ]) {
        assert.equal(isSupportedFurnitureCategory(category), false, String(category));
    }
});
