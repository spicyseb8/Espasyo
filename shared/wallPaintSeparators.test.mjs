import assert from "node:assert/strict";
import test from "node:test";
import * as separators from "./wallPaintSeparators.ts";

test("vertical and horizontal separators create the expected section grid", () => {
    const face = {
        separators: [
            { id: "v1", orientation: "vertical", position: 0.4 },
            { id: "h1", orientation: "horizontal", position: 0.6 },
            { id: "v2", orientation: "vertical", position: 0.7 }
        ],
        sectionMaterials: {}
    };

    assert.equal(separators.getWallPaintSections(face).length, 6);
});

test("adding a separator inherits the source section material", () => {
    const initial = separators.addWallPaintSeparator(
        undefined,
        { id: "v1", orientation: "vertical", position: 0.5 },
        "paint-blue"
    );
    assert.ok(initial);

    const divided = separators.addWallPaintSeparator(
        initial,
        { id: "h1", orientation: "horizontal", position: 0.5 }
    );
    assert.ok(divided);
    assert.equal(
        new Set(Object.values(divided.sectionMaterials)).size,
        1
    );
    assert.ok(
        Object.values(divided.sectionMaterials).every(id => id === "paint-blue")
    );
});

test("separator position rejects edges and near-duplicate lines", () => {
    const existing = [
        { id: "v1", orientation: "vertical", position: 0.5 }
    ];
    assert.equal(
        separators.isValidWallPaintSeparatorPosition(existing, "vertical", 0.52),
        false
    );
    assert.equal(
        separators.isValidWallPaintSeparatorPosition(existing, "horizontal", 0.52),
        true
    );
    assert.equal(
        separators.isValidWallPaintSeparatorPosition(existing, "vertical", 0.1),
        true
    );
});

test("floor section clipping preserves the triangulated surface area", () => {
    const squareTriangles = [
        0, 0, 0, 1, 0, 0, 1, 1, 0,
        0, 0, 0, 1, 1, 0, 0, 1, 0
    ];
    const sections = separators.getWallPaintSections({
        separators: [
            { id: "middle", orientation: "vertical", position: 0.5 }
        ],
        sectionMaterials: {}
    });

    assert.deepEqual(
        sections.map(section =>
            separators.calculateFloorSectionArea(squareTriangles, section)
        ),
        [0.5, 0.5]
    );
});

test("removing a separator reports differing colors and accepts an explicit merge choice", () => {
    let face = separators.addWallPaintSeparator(
        undefined,
        { id: "v1", orientation: "vertical", position: 0.5 },
        "paint-blue"
    );
    assert.ok(face);
    const [left, right] = separators.getWallPaintSections(face);
    face = {
        ...face,
        sectionMaterials: {
            [left.id]: "paint-blue",
            [right.id]: "paint-red"
        }
    };

    const pending = separators.removeWallPaintSeparator(face, "v1");
    assert.equal(pending.face, null);
    assert.equal(pending.conflicts.length, 1);
    const merged = separators.removeWallPaintSeparator(
        face,
        "v1",
        undefined,
        { [pending.conflicts[0].sectionId]: "paint-red" }
    );
    assert.ok(merged.face);
    assert.deepEqual(Object.values(merged.face.sectionMaterials), ["paint-red"]);
});
