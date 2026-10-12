export const ADMIN_COMMENT_TARGET_EVENT = "espasyo-admin-comment-target";
export const ADMIN_COMMENT_FOCUS_REQUEST_EVENT = "espasyo-admin-comment-focus-request";
export const ADMIN_COMMENT_FOCUS_EVENT = "espasyo-admin-comment-focus";
export const ADMIN_COMMENT_FOCUS_COMPLETE_EVENT = "espasyo-admin-comment-focus-complete";
export const ADMIN_COMMENT_MARKER_CLICK_EVENT = "espasyo-admin-comment-marker-click";

export type AdminCommentTargetType = "project" | "wall" | "floor" | "furniture" | "door" | "window" | "opening";

export interface AdminCommentTargetDetail {
    targetType: AdminCommentTargetType;
    targetId: string | null;
    targetLabel: string;
    regionId?: string;
}

export interface AdminCommentFocusRequest {
    commentId: string;
}

export interface AdminCommentFocusDetail {
    commentId: string;
    position: {
        x: number;
        y: number;
        z: number;
    };
}

export function emitAdminCommentTarget(
    detail: AdminCommentTargetDetail
) {
    window.dispatchEvent(
        new CustomEvent<AdminCommentTargetDetail>(
            ADMIN_COMMENT_TARGET_EVENT,
            {
                detail
            }
        )
    );
}

export function requestAdminCommentFocus(
    commentId: string
) {
    window.dispatchEvent(
        new CustomEvent<AdminCommentFocusRequest>(
            ADMIN_COMMENT_FOCUS_REQUEST_EVENT,
            {
                detail: {
                    commentId
                }
            }
        )
    );
}

export function emitAdminCommentFocus(
    detail: AdminCommentFocusDetail
) {
    window.dispatchEvent(
        new CustomEvent<AdminCommentFocusDetail>(
            ADMIN_COMMENT_FOCUS_EVENT,
            {
                detail
            }
        )
    );
}

export function emitAdminCommentFocusComplete(
    commentId: string
) {
    window.dispatchEvent(
        new CustomEvent<string>(
            ADMIN_COMMENT_FOCUS_COMPLETE_EVENT,
            {
                detail: commentId
            }
        )
    );
}

export function emitAdminCommentMarkerClick(
    commentId: string
) {
    window.dispatchEvent(
        new CustomEvent<string>(
            ADMIN_COMMENT_MARKER_CLICK_EVENT,
            {
                detail: commentId
            }
        )
    );
}