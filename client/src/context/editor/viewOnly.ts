import type { EditorAction } from "./editorActions";

export function isProjectStatusViewOnly(
    projectStatus: string | null | undefined
): boolean {
    return projectStatus === "submitted" || projectStatus === "approved";
}

export function shouldShowDeadlinePassedNotice(
    projectStatus: string | null | undefined,
    deadlinePassed: boolean
): boolean {
    return deadlinePassed && !isProjectStatusViewOnly(projectStatus);
}

const VIEW_ONLY_ALLOWED_ACTIONS = new Set<EditorAction["type"]>([
    "LOAD_PROJECT",
    "CLEAR_PROJECT",
    "SWITCH_FLOOR",
    "TOGGLE_WALKTHROUGH"
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
