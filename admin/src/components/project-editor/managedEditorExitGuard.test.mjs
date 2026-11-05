import assert from "node:assert/strict";
import test from "node:test";
import {
    createManagedEditorFloor,
    createManagedStructure
} from "./structureTypes.ts";
import { createManagedEditorExitFingerprint } from "./managedEditorExitGuard.ts";

function createFloorPlan() {
    const structure = createManagedStructure("project-1", "Plan", "client-1");
    return createManagedEditorFloor(structure, 0);
}

function fingerprint(floors, activeFloorId = floors[0].floorId) {
    return createManagedEditorExitFingerprint({
        floors,
        activeFloorId,
        projectName: "Plan",
        deadline: ""
    });
}

test("managed editor fingerprints ignore save timestamps", () => {
    const floor = createFloorPlan();
    const updatedFloor = {
        ...floor,
        structure: {
            ...floor.structure,
            savedAt: "later"
        }
    };

    assert.equal(fingerprint([floor]), fingerprint([updatedFloor]));
});

test("managed editor fingerprints include structural and floor changes", () => {
    const floor = createFloorPlan();
    const changedStructure = {
        ...floor,
        structure: {
            ...floor.structure,
            wallHeight: floor.structure.wallHeight + 0.1
        }
    };
    const secondFloor = createManagedEditorFloor(
        createManagedStructure("project-1", "Plan", "client-1"),
        1
    );

    assert.notEqual(fingerprint([floor]), fingerprint([changedStructure]));
    assert.notEqual(fingerprint([floor]), fingerprint([floor, secondFloor]));
});

test("managed editor fingerprints include project name, deadline, and active floor", () => {
    const first = createFloorPlan();
    const second = createManagedEditorFloor(
        createManagedStructure("project-1", "Plan", "client-1"),
        1
    );
    const baseline = fingerprint([first, second], first.floorId);

    assert.notEqual(fingerprint([first, second], second.floorId), baseline);
    assert.notEqual(
        createManagedEditorExitFingerprint({
            floors: [first],
            activeFloorId: first.floorId,
            projectName: "Renamed",
            deadline: ""
        }),
        baseline
    );
    assert.notEqual(
        createManagedEditorExitFingerprint({
            floors: [first],
            activeFloorId: first.floorId,
            projectName: "Plan",
            deadline: "2030-01-01T10:00"
        }),
        fingerprint([first])
    );
});
