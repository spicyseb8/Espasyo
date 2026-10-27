import assert from "node:assert/strict";
import test from "node:test";
import { createManagedStructure } from "../../components/project-editor/structureTypes.ts";
import {
    loadLocalManagedProjectDraft,
    removeLocalManagedProjectDraft,
    saveLocalManagedProjectDraft
} from "./localManagedProjectDraft.ts";

test("local managed drafts restore per client without persisting blueprint data", () => {
    const values = new Map();
    const previousWindow = globalThis.window;
    globalThis.window = {
        localStorage: {
            getItem: key => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
            removeItem: key => values.delete(key)
        }
    };

    try {
        const clientA = createManagedStructure("local-a", "Client A plan", "client-a");
        clientA.walls.push({
            id: "wall-a",
            start: { id: "corner-a1", position: { x: 0, y: 0, z: 0 } },
            end: { id: "corner-a2", position: { x: 2, y: 0, z: 0 } }
        });
        clientA.corners.push(
            { id: "corner-a1", position: { x: 0, y: 0, z: 0 } },
            { id: "corner-a2", position: { x: 2, y: 0, z: 0 } }
        );
        clientA.windows.push({
            id: "window-a",
            assetId: "asset-window",
            wallId: "wall-a",
            position: { x: 1, y: 2.1, z: 0 },
            rotationY: Math.PI / 2,
            width: 1,
            height: 0.8,
            depth: 0.1
        });
        clientA.blueprint = { url: "blob:runtime-only-blueprint" };
        saveLocalManagedProjectDraft({
            schemaVersion: 1,
            draftId: "local-a",
            ownerId: "client-a",
            projectName: "Client A plan",
            structure: clientA,
            revision: 0,
            updatedAt: new Date().toISOString()
        });

        const clientB = createManagedStructure("local-b", "Client B plan", "client-b");
        saveLocalManagedProjectDraft({
            schemaVersion: 1,
            draftId: "local-b",
            ownerId: "client-b",
            projectName: "Client B plan",
            structure: clientB,
            revision: 0,
            updatedAt: new Date().toISOString()
        });

        const restoredA = loadLocalManagedProjectDraft("client-a");
        const restoredB = loadLocalManagedProjectDraft("client-b");
        assert.equal(restoredA?.draftId, "local-a");
        assert.equal(restoredA?.structure.walls.length, 1);
        assert.equal(restoredA?.structure.windows[0].position.y, 2.1);
        assert.equal(restoredA?.structure.blueprint, null);
        assert.equal(restoredB?.draftId, "local-b");
        assert.equal(restoredB?.ownerId, "client-b");

        removeLocalManagedProjectDraft("client-a");
        assert.equal(loadLocalManagedProjectDraft("client-a"), null);
        assert.equal(loadLocalManagedProjectDraft("client-b")?.draftId, "local-b");
    } finally {
        if (previousWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = previousWindow;
        }
    }
});

test("corrupted or outdated local draft data is discarded safely", () => {
    const values = new Map([
        ["espasyo.adminManagedProjectDraft.v1:client-a", "{invalid"]
    ]);
    const previousWindow = globalThis.window;
    globalThis.window = {
        localStorage: {
            getItem: key => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
            removeItem: key => values.delete(key)
        }
    };

    const originalWarn = console.warn;
    try {
        console.warn = () => {};
        assert.equal(loadLocalManagedProjectDraft("client-a"), null);
        assert.equal(values.has("espasyo.adminManagedProjectDraft.v1:client-a"), false);
    } finally {
        console.warn = originalWarn;
        if (previousWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = previousWindow;
        }
    }
});
