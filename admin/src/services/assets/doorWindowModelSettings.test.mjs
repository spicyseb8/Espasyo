import assert from "node:assert/strict";
import test from "node:test";
import {
    getDefaultModelSettings,
    resolveRotationOffsetY
} from "./doorWindowModelSettings.ts";

test("doors and window categories use the shared wall-plane rotation fallback", () => {
    const cases = [
        { label: "door", category: "doors" },
        { label: "generic window", category: "windows" },
        { label: "glass window", category: "windows" },
        { label: "slim-intersection window", category: "windows" }
    ];

    for (const { label, category } of cases) {
        const defaults = getDefaultModelSettings(category);
        assert.equal(
            resolveRotationOffsetY(undefined, defaults.rotationOffsetY),
            Math.PI / 2,
            label
        );
    }
});

test("a finite asset rotation offset overrides the category fallback", () => {
    const fallback = getDefaultModelSettings("doors").rotationOffsetY;

    assert.equal(resolveRotationOffsetY(0, fallback), 0);
    assert.equal(resolveRotationOffsetY(Math.PI / 4, fallback), Math.PI / 4);
    assert.equal(resolveRotationOffsetY(undefined, fallback), fallback);
});
