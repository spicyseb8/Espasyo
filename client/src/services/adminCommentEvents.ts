export type AdminCommentTargetType =
    | "project"
    | "wall"
    | "floor"
    | "furniture"
    | "door"
    | "window"
    | "opening";

export const ADMIN_COMMENT_MARKER_CLICK_EVENT =
    "espasyo-client-admin-comment-marker-click";

export const ADMIN_COMMENT_FOCUS_COMPLETE_EVENT =
    "espasyo-client-admin-comment-focus-complete";

export function emitAdminCommentMarkerClick(
    commentId: string
): void {
    window.dispatchEvent(
        new CustomEvent<string>(
            ADMIN_COMMENT_MARKER_CLICK_EVENT,
            {
                detail:
                    commentId
            }
        )
    );
}

export function emitAdminCommentFocusComplete(
    commentId: string
): void {
    window.dispatchEvent(
        new CustomEvent<string>(
            ADMIN_COMMENT_FOCUS_COMPLETE_EVENT,
            {
                detail:
                    commentId
            }
        )
    );
}