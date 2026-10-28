import assert from "node:assert/strict";
import test from "node:test";
import {
    ASPECT_RATIO_WARNING_TOLERANCE,
    DEFAULT_FLOOR_GROUT_COLOR,
    DEFAULT_FLOOR_GROUT_WIDTH_M,
    FLOOR_PATTERN_DEFINITIONS,
    checkFloorImageAspectRatio,
    createFloorPatternLayout,
    floorDimensionToMeters,
    getFloorPatternUV,
} from "./patterns.ts";
import {
    calculateFloorImageCoverCrop,
} from "./patternCanvas.ts";

const closeTo = (actual, expected, tolerance = 1e-9) => {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `expected ${actual} to be within ${tolerance} of ${expected}`,
    );
};

function nominalCoverageCount(layout, point) {
    const { a, b } = layout.repeatCell;
    let count = 0;

    for (const tile of layout.tiles) {
        for (let repeatA = -2; repeatA <= 2; repeatA += 1) {
            for (let repeatB = -2; repeatB <= 2; repeatB += 1) {
                const centerX = tile.center.x + repeatA * a.x + repeatB * b.x;
                const centerY = tile.center.y + repeatA * a.y + repeatB * b.y;
                const deltaX = point.x - centerX;
                const deltaY = point.y - centerY;
                const cos = Math.cos(tile.rotationRadians);
                const sin = Math.sin(tile.rotationRadians);
                const localX = cos * deltaX + sin * deltaY;
                const localY = -sin * deltaX + cos * deltaY;

                if (Math.abs(localX) < layout.tileLengthM / 2 - 1e-9 &&
                    Math.abs(localY) < layout.tileWidthM / 2 - 1e-9) {
                    count += 1;
                }
            }
        }
    }

    return count;
}

function assertCellHasNoTileGapsOrOverlaps(layout) {
    const { a, b } = layout.repeatCell;

    for (let row = 0; row < 31; row += 1) {
        for (let column = 0; column < 31; column += 1) {
            const u = (column + 0.37) / 31;
            const v = (row + 0.61) / 31;
            const point = {
                x: u * a.x + v * b.x,
                y: u * a.y + v * b.y,
            };
            assert.equal(nominalCoverageCount(layout, point), 1);
        }
    }
}

function cellArea(layout) {
    const { a, b } = layout.repeatCell;
    return Math.abs(a.x * b.y - a.y * b.x);
}

test("defines only Stack Bond, Brick Bond, and Diagonal patterns", () => {
    assert.deepEqual(FLOOR_PATTERN_DEFINITIONS.map(({ id }) => id), [
        "stack-bond",
        "brick-bond",
        "diagonal",
    ]);
    assert.throws(() => createFloorPatternLayout("herringbone", 0.6, 0.3), RangeError);
});

test("converts cm and mm dimensions to meters and rejects invalid dimensions", () => {
    assert.equal(floorDimensionToMeters(60, "cm"), 0.6);
    assert.equal(floorDimensionToMeters(600, "mm"), 0.6);
    assert.throws(() => floorDimensionToMeters(0, "mm"), RangeError);
    assert.throws(() => floorDimensionToMeters(Number.NaN, "cm"), RangeError);
});

test("Stack Bond uses one physical tile per aligned repeat cell", () => {
    const layout = createFloorPatternLayout("stack-bond", 0.6, 0.3);

    assert.deepEqual(layout.repeatCell, {
        a: { x: 0.6, y: 0 },
        b: { x: 0, y: 0.3 },
    });
    assert.equal(layout.tiles.length, 1);
    assertCellHasNoTileGapsOrOverlaps(layout);
});

test("Brick Bond offsets alternate rows by half a tile length", () => {
    const layout = createFloorPatternLayout("brick-bond", 0.6, 0.3);
    const secondRow = layout.tiles.slice(2);

    assert.deepEqual(secondRow.map(({ center }) => center.x), [0, 0.6]);
    assert.equal(layout.repeatCell.a.x, 1.2);
    assert.equal(layout.repeatCell.b.y, 0.6);
    assertCellHasNoTileGapsOrOverlaps(layout);
});

test("Diagonal rotates the tile and both repeat axes by 45 degrees", () => {
    const layout = createFloorPatternLayout("diagonal", 0.6, 0.3);
    const rootHalf = Math.SQRT1_2;

    closeTo(layout.tiles[0].rotationRadians, Math.PI / 4);
    closeTo(layout.repeatCell.a.x, 0.6 * rootHalf);
    closeTo(layout.repeatCell.a.y, 0.6 * rootHalf);
    closeTo(layout.repeatCell.b.x, -0.3 * rootHalf);
    closeTo(layout.repeatCell.b.y, 0.3 * rootHalf);
    assertCellHasNoTileGapsOrOverlaps(layout);
});

test("all patterns keep configured physical tile area independent of image size", () => {
    for (const { id } of FLOOR_PATTERN_DEFINITIONS) {
        const layout = createFloorPatternLayout(id, 0.6, 0.3);
        const nominalTileArea = layout.tiles.length * layout.tileLengthM * layout.tileWidthM;

        closeTo(nominalTileArea, cellArea(layout));
    }
});

test("maps world coordinates into repeat-cell UVs for all patterns", () => {
    for (const { id } of FLOOR_PATTERN_DEFINITIONS) {
        const layout = createFloorPatternLayout(id, 0.6, 0.3);
        const { a, b } = layout.repeatCell;

        assert.deepEqual(getFloorPatternUV(0, 0, layout), { x: 0, y: 0 });
        const uvA = getFloorPatternUV(a.x, a.y, layout);
        const uvB = getFloorPatternUV(b.x, b.y, layout);
        closeTo(uvA.x, 1);
        closeTo(uvA.y, 0);
        closeTo(uvB.x, 0);
        closeTo(uvB.y, 1);
    }

    const layout = createFloorPatternLayout("stack-bond", 0.6, 0.3);
    assert.throws(() => getFloorPatternUV(Number.NaN, 0, layout), RangeError);
});

test("grout defaults to 3 mm and remains an independent centered gap", () => {
    const layout = createFloorPatternLayout("stack-bond", 0.6, 0.3);

    assert.equal(DEFAULT_FLOOR_GROUT_WIDTH_M, 0.003);
    assert.equal(layout.groutWidthM, 0.003);
    assert.equal(layout.groutColor, DEFAULT_FLOOR_GROUT_COLOR);
    assert.equal(layout.tileFaceInsetM, 0.0015);
    assert.throws(() => createFloorPatternLayout("stack-bond", 0.6, 0.3, 0.3), RangeError);
    assert.throws(() => createFloorPatternLayout("stack-bond", 0.6, 0.3, -0.001), RangeError);
});

test("image resolution does not affect physical dimensions; aspect mismatch is reported", () => {
    const lowResolution = checkFloorImageAspectRatio(512, 256, 0.6, 0.3);
    const highResolution = checkFloorImageAspectRatio(2048, 1024, 0.6, 0.3);
    const mismatched = checkFloorImageAspectRatio(512, 512, 0.6, 0.3);

    assert.equal(lowResolution.mismatch, false);
    assert.equal(highResolution.mismatch, false);
    assert.equal(lowResolution.physicalAspectRatio, highResolution.physicalAspectRatio);
    assert.equal(lowResolution.imageAspectRatio, highResolution.imageAspectRatio);
    assert.ok(mismatched.relativeDifference > ASPECT_RATIO_WARNING_TOLERANCE);
    assert.equal(mismatched.mismatch, true);
});

test("cover-crops uploaded images to fill the configured tile face", () => {
    const wideImage = calculateFloorImageCoverCrop(1200, 600, 1);
    assert.deepEqual(wideImage, {
        x: 300,
        y: 0,
        width: 600,
        height: 600,
    });

    const tallImage = calculateFloorImageCoverCrop(600, 1200, 2);
    assert.deepEqual(tallImage, {
        x: 0,
        y: 450,
        width: 600,
        height: 300,
    });
    assert.throws(() => calculateFloorImageCoverCrop(0, 200, 1), RangeError);
});
