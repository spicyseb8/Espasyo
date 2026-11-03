import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";

const vite = await createServer({
    appType: "custom",
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    root: process.cwd(),
    server: { middlewareMode: true, hmr: false }
});

const {
    getProjectBudgetSummary,
    parseProjectBudget,
    PROJECT_BUDGET_NOTICE_DURATION_MS,
    shouldShowBudgetStatusNotice
} =
    await vite.ssrLoadModule("/src/engine/cost/ProjectBudget.ts");
const { editorReducer } =
    await vite.ssrLoadModule("/src/context/editor/editorReducer.ts");
const { initialState } =
    await vite.ssrLoadModule("/src/context/editor/initialState.ts");
const { createProjectData } =
    await vite.ssrLoadModule("/src/services/projectSerializer.ts");

after(async () => {
    await vite.close();
});

test("validates Philippine peso budgets and rejects invalid values", () => {
    assert.equal(parseProjectBudget("₱ 500,000.25"), 500000.25);
    assert.equal(parseProjectBudget("500000"), 500000);
    assert.equal(parseProjectBudget(""), null);
    assert.equal(parseProjectBudget("-100"), null);
    assert.equal(parseProjectBudget("1,00"), null);
    assert.equal(parseProjectBudget("100.001"), null);
});

test("uses the project total to return all three budget states", () => {
    assert.equal(getProjectBudgetSummary(1000, 899.99).status, "within");
    assert.equal(getProjectBudgetSummary(1000, 900).status, "near");
    assert.equal(getProjectBudgetSummary(1000, 999.99).status, "near");
    assert.equal(getProjectBudgetSummary(1000, 1000).status, "over");
    assert.equal(getProjectBudgetSummary(null, 1000), null);
});

test("budget notices require a user-action status transition and fade on schedule", () => {
    assert.equal(shouldShowBudgetStatusNotice(undefined, "near", true), false);
    assert.equal(shouldShowBudgetStatusNotice("near", "near", true), false);
    assert.equal(shouldShowBudgetStatusNotice("within", "near", false), false);
    assert.equal(shouldShowBudgetStatusNotice("near", "over", true), true);
    assert.equal(shouldShowBudgetStatusNotice("over", null, true), false);
    assert.equal(PROJECT_BUDGET_NOTICE_DURATION_MS, 4500);
});

test("editor budget can be set, edited, and removed", () => {
    const set = editorReducer(initialState, {
        type: "SET_PROJECT_BUDGET",
        payload: 500000
    });
    assert.equal(set.projectBudget, 500000);

    const edited = editorReducer(set, {
        type: "SET_PROJECT_BUDGET",
        payload: 750000
    });
    assert.equal(edited.projectBudget, 750000);

    const removed = editorReducer(edited, {
        type: "SET_PROJECT_BUDGET",
        payload: null
    });
    assert.equal(removed.projectBudget, null);
});

test("project budget loads from interior data but stays out of structural serialization", () => {
    const structure = createProjectData(
        initialState,
        "PRJ-00126",
        "Project",
        "client-uid"
    );
    assert.equal("maximumBudget" in structure, false);
    assert.equal("incompleteItems" in structure.costEstimate, false);

    const loaded = editorReducer(initialState, {
        type: "LOAD_PROJECT",
        payload: { ...structure, maximumBudget: 425000 }
    });
    assert.equal(loaded.projectBudget, 425000);

    const legacy = editorReducer(initialState, {
        type: "LOAD_PROJECT",
        payload: structure
    });
    assert.equal(legacy.projectBudget, null);
});
