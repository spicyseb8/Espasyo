import assert from "node:assert/strict";
import test from "node:test";

const {
    getDesignInspirationsState,
    NO_DESIGN_INSPIRATIONS_MESSAGE
} = await import("./designInspirationsState.ts");

test("design inspirations show the loading state while loading", () => {
    assert.deepEqual(getDesignInspirationsState(true, false, []), { kind: "loading" });
});

test('design inspirations show the required empty state when no designs are eligible', () => {
    assert.deepEqual(getDesignInspirationsState(false, false, []), { kind: "empty" });
    assert.equal(NO_DESIGN_INSPIRATIONS_MESSAGE, "No design inspirations yet");
});

test("design inspirations show an error state that can expose retry", () => {
    assert.deepEqual(getDesignInspirationsState(false, true, []), { kind: "error" });
});

test("design inspirations show only the returned safe card data when populated", () => {
    const design = {
        publicId: "opaque-public-id",
        title: "Design Inspiration #12",
        thumbnailObjectUrl: "blob:thumbnail",
    };
    assert.deepEqual(
        getDesignInspirationsState(false, false, [design]),
        { kind: "populated", designs: [design] },
    );
});
