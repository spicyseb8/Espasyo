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
} from "./patterns.ts";

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

test("defines exactly the four requested editable patterns", () => {
    assert.deepEqual(FLOOR_PATTERN_DEFINITIONS.map(({ id }) => id), [
        "stack-bond",
        "brick-bond",
        "diagonal",
        "herringbone",
    ]);
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

test("Herringbone alternates perpendicular courses with a seamless repeat cell", () => {
    const layout = createFloorPatternLayout("herringbone", 0.6, 0.3);
    const horizontalTiles = layout.tiles.filter(({ rotationRadians }) => rotationRadians === 0);
    const verticalTiles = layout.tiles.filter(({ rotationRadians }) => rotationRadians !== 0);

    assert.equal(horizontalTiles.length, 2);
    assert.equal(verticalTiles.length, 4);
    assert.ok(verticalTiles.every(({ rotationRadians }) => rotationRadians === Math.PI / 2));
    closeTo(layout.repeatCell.a.x, 1.2);
    closeTo(layout.repeatCell.b.y, 0.9);
    closeTo(
        layout.tiles.length * layout.tileLengthM * layout.tileWidthM,
        cellArea(layout),
    );
    assertCellHasNoTileGapsOrOverlaps(layout);
});

test("Herringbone supports square and non-2:1 rectangular tile dimensions", () => {
    for (const [length, width] of [[0.4, 0.4], [0.6, 0.4], [0.6000004, 0.3000002]]) {
        const layout = createFloorPatternLayout("herringbone", length, width);

        assert.ok(layout.tiles.some(({ rotationRadians }) => rotationRadians === 0));
        assert.ok(layout.tiles.some(({ rotationRadians }) => rotationRadians === Math.PI / 2));
        closeTo(
            layout.tiles.length * layout.tileLengthM * layout.tileWidthM,
            cellArea(layout),
        );
        assertCellHasNoTileGapsOrOverlaps(layout);
    }

    const preciseDimensions = createFloorPatternLayout("herringbone", 0.6000004, 0.3000002);
    closeTo(preciseDimensions.repeatCell.a.x, 1.2000008);
});

test("all patterns keep configured physical tile area independent of image size", () => {
    for (const { id } of FLOOR_PATTERN_DEFINITIONS) {
        const layout = createFloorPatternLayout(id, 0.6, 0.3);
        const nominalTileArea = layout.tiles.length * layout.tileLengthM * layout.tileWidthM;

        closeTo(nominalTileArea, cellArea(layout));
    }
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
