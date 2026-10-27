import assert from "node:assert/strict";
import test from "node:test";
import { blueprintDisplayBounds, calculateCalibratedBlueprintWidth, distanceBetween2D, snapGrid, svgPointToWorld } from "./blueprintGeometry.ts";

test("uses the existing blueprint scale formula", () => {
    assert.equal(calculateCalibratedBlueprintWidth({ measuredLength: 2, realLength: 6, currentWidth: 10 }), 30);
});

test("calculates 2D blueprint distance", () => {
    assert.equal(distanceBetween2D({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test("snaps values to the configured grid", () => {
    assert.equal(snapGrid(0.64, 0.25), 0.75);
});

test("projects SVG viewport coordinates into world space", () => {
    assert.deepEqual(svgPointToWorld({ x: 15, y: 5 }, 20), { x: 5, y: -5 });
});

test("uses calibrated width and image aspect ratio for display bounds", () => {
    assert.deepEqual(blueprintDisplayBounds(12, 2), { x: -6, y: -3, width: 12, height: 6 });
});
