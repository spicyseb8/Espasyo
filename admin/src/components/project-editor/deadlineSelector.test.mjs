import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("floor-plan publishing exposes a required Philippine date-time deadline selector", async () => {
    const source = await readFile(
        new URL("./AdminStructuralEditor.tsx", import.meta.url),
        "utf8"
    );
    assert.match(source, /type="datetime-local"/);
    assert.match(source, /Publish deadline \(Philippine time\)/);
    assert.match(source, /Required project deadline date and time before publishing, Philippine time/);
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
    assert.match(editor, /Deadline \(Philippine time\): \{deadline\.replace\("T", " "\)\}/);
    assert.match(service, /\.\.\.\(input\.deadline \? \{ deadline: input\.deadline \} : \{\}\)/);
});
