import assert from "node:assert/strict";
import test from "node:test";
import { calculateFlooringPieceCost } from "./FlooringPieceCalculation.ts";

test("computes piece count and total from 60 cm tiles and per-tile price", () => {
    const result = calculateFlooringPieceCost(20, 0.6, 0.6, 185);

    assert.deepEqual(result, {
        pieceArea: 0.36,
        piecesNeeded: 56,
        rate: 185,
        subtotal: 10360
    });
});

test("does not round up when the room area divides exactly into tiles", () => {
    const result = calculateFlooringPieceCost(1.08, 0.6, 0.6, 185);

    assert.equal(result?.piecesNeeded, 3);
    assert.equal(result?.subtotal, 555);
});

test("rounds up when the room area requires a partial tile", () => {
    const result = calculateFlooringPieceCost(1, 0.6, 0.6, 185);

    assert.equal(result?.piecesNeeded, 3);
    assert.equal(result?.subtotal, 555);
});

test("rejects missing, non-finite, zero, or negative tile dimensions", () => {
    for (const [length, width] of [
        [undefined, 0.6],
        [Number.NaN, 0.6],
        [0, 0.6],
        [-0.6, 0.6],
        [0.6, undefined],
        [0.6, Number.POSITIVE_INFINITY],
        [0.6, 0],
        [0.6, -0.6]
    ]) {
        assert.equal(
            calculateFlooringPieceCost(20, length, width, 185),
            null
        );
    }
});
