import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("floor-plan publishing uses a date-only deadline with suggested time periods", async () => {
    const source = await readFile(
        new URL("./AdminStructuralEditor.tsx", import.meta.url),
        "utf8"
    );
    assert.match(source, /type="date"/);
    assert.doesNotMatch(source, /type="datetime-local"/);
    assert.match(source, /DEADLINE_PRESETS = \[7, 30, 60\]/);
    assert.match(source, /Required before the project can be published to the client\./);
    assert.match(source, /Due by 11:59 PM Philippine time\./);
    assert.match(source, /event\.target\.value \? `\$\{event\.target\.value\}T23:59` : ""/);
    assert.match(source, /setDeadline\(`\$\{presetDate\}T23:59`\)/);
    assert.match(source, /Choose a valid project deadline after today before publishing/);
    assert.match(source, /deadline,/);
});

test("draft saves carry a selected deadline and published projects display it", async () => {
    const editor = await readFile(
        new URL("./AdminStructuralEditor.tsx", import.meta.url),
        "utf8"
    );
    const service = await readFile(
        new URL("../../services/assets/projectStructureService.ts", import.meta.url),
        "utf8"
    );
    assert.match(editor, /revision: nextRevision,\s*\.\.\.\(deadline \? \{ deadline \} : \{\}\)/);
    assert.match(editor, /Deadline: \{formatEditorDeadline\(deadline\)\} \(11:59 PM Philippine time\)/);
    assert.match(service, /\.\.\.\(input\.deadline \? \{ deadline: input\.deadline \} : \{\}\)/);
});

test("floor rail offers confirmed deletion and editor removes invalid stair connections", async () => {
    const editor = await readFile(
        new URL("./AdminStructuralEditor.tsx", import.meta.url),
        "utf8"
    );
    const rail = await readFile(
        new URL("./Adminfloorrail.tsx", import.meta.url),
        "utf8"
    );
    assert.match(rail, /onDelete: \(\) => void/);
    assert.match(rail, /Delete selected floor/);
    assert.match(editor, /canDelete=\{!isReadOnly && savingAction === null && floorPlans\.length > 1\}/);
    assert.match(editor, /aria-labelledby="admin-editor-delete-floor-title"/);
    assert.match(editor, /stair\.destinationFloorId !== deletedFloor\.floorId/);
    assert.match(editor, /setFloorPlans\(nextFloors\)/);
});
