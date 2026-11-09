import type { EditorAction } from "./editorActions";

const VIEW_ONLY_ALLOWED_ACTIONS = new Set<EditorAction["type"]>([
    "LOAD_PROJECT",
    "CLEAR_PROJECT",
    "SWITCH_FLOOR"
]);

export function canDispatchInViewOnly(
    actionType: EditorAction["type"]
): boolean {
    return VIEW_ONLY_ALLOWED_ACTIONS.has(actionType);
}

export function canPerformProjectWrite(
    viewOnly: boolean,
    operation: "save" | "submit"
): boolean {
    return !viewOnly && (operation === "save" || operation === "submit");
}
