import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, MessageCircle, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AdminProjectScene from "../project-loader/AdminProjectScene";
import type { AdminProject } from "@/services/assets/projectService";
import type { SavedProjectData } from "./ProjectTypes";
import { auth } from "@/firebase/firebase";
import AdminCostEstimator from "./engine/cost/AdminCostEstimator";
import {
    ADMIN_COMMENT_FOCUS_COMPLETE_EVENT,
    ADMIN_COMMENT_MARKER_CLICK_EVENT,
    ADMIN_COMMENT_TARGET_EVENT,
    type AdminCommentTargetDetail
} from "@/services/assets/adminCommentEvents";
import {
    createAdminComment,
    subscribeToAdminComments,
    type AdminComment
} from "@/services/assets/adminCommentService";
import { requestAdminCommentFocus } from "@/services/assets/adminCommentEvents";
import { useAuth } from "@/context/AuthContext";

interface AdminProjectViewerProps {
    metadata: AdminProject;
    projectData: SavedProjectData;
}
const COMMENT_CURSOR =
    `url("data:image/svg+xml,${encodeURIComponent(`
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 32 32"
        >
            <path
                d="M6 5.5
                   C4.067 5.5 2.5 7.067 2.5 9
                   V18
                   C2.5 19.933 4.067 21.5 6 21.5
                   H12
                   L10 27
                   L16.5 21.5
                   H24
                   C25.933 21.5 27.5 19.933 27.5 18
                   V9
                   C27.5 7.067 25.933 5.5 24 5.5
                   Z"
                fill="white"
                stroke="#ff7a00"
                stroke-width="2"
                stroke-linejoin="round"
            />

            <circle
                cx="10"
                cy="13.5"
                r="1.4"
                fill="#ff7a00"
            />

            <circle
                cx="15"
                cy="13.5"
                r="1.4"
                fill="#ff7a00"
            />

            <circle
                cx="20"
                cy="13.5"
                r="1.4"
                fill="#ff7a00"
            />
        </svg>
    `)}") 5 5, crosshair`;
function formatCommentDate(
    value: unknown
): string {
    if (
        value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof (
            value as {
                toDate: () => Date;
            }
        ).toDate === "function"
    ) {
        return (
            value as {
                toDate: () => Date;
            }
        ).toDate().toLocaleString(
            undefined,
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );
    }

    if (
        value instanceof Date
    ) {
        return value.toLocaleString(
            undefined,
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );
    }

    return "Just now";
}

export default function AdminProjectViewer({
    metadata,
    projectData
}: AdminProjectViewerProps) {
    const navigate = useNavigate();
    const { role } = useAuth();
    const canComment = role === "admin";

    const [
        comments,
        setComments
    ] = useState<AdminComment[]>(
        []
    );

    const [
        selectedTarget,
        setSelectedTarget
    ] = useState<AdminCommentTargetDetail | null>(
        null
    );

    const [
        commentMode,
        setCommentMode
    ] = useState(false);

    const [
        commentText,
        setCommentText
    ] = useState("");

    const [
        savingComment,
        setSavingComment
    ] = useState(false);

    const [
        commentError,
        setCommentError
    ] = useState("");

    const [
        focusedCommentId,
        setFocusedCommentId
    ] = useState<string | null>(
        null
    );

    const [
        visibleCommentId,
        setVisibleCommentId
    ] = useState<string | null>(
        null
    );

    const chatRef =
        useRef<HTMLDivElement | null>(
            null
        );

    useEffect(() => {
        return subscribeToAdminComments(
            projectData.projectId,
            setComments,
            error => {
                setCommentError(
                    "Unable to load comments."
                );

                console.error(
                    error
                );
            }
        );
    }, [
        projectData.projectId
    ]);

    useEffect(() => {
        const handleTarget = (
            event: Event
        ) => {
            if (!canComment || !commentMode) {
                return;
            }

            const customEvent =
                event as CustomEvent<AdminCommentTargetDetail>;

            if (!customEvent.detail) {
                return;
            }

            setSelectedTarget(
                customEvent.detail
            );

            setCommentError(
                ""
            );
        };

        window.addEventListener(
            ADMIN_COMMENT_TARGET_EVENT,
            handleTarget
        );

        return () => {
            window.removeEventListener(
                ADMIN_COMMENT_TARGET_EVENT,
                handleTarget
            );
        };
    }, [
        canComment,
        commentMode
    ]);

    useEffect(() => {
        const handleMarkerClick = (
            event: Event
        ) => {
            const customEvent =
                event as CustomEvent<string>;

            const commentId =
                customEvent.detail;

            if (!commentId) {
                return;
            }

            setVisibleCommentId(
                commentId
            );

            setFocusedCommentId(
                commentId
            );

            requestAdminCommentFocus(
                commentId
            );
        };

        window.addEventListener(
            ADMIN_COMMENT_MARKER_CLICK_EVENT,
            handleMarkerClick
        );

        return () => {
            window.removeEventListener(
                ADMIN_COMMENT_MARKER_CLICK_EVENT,
                handleMarkerClick
            );
        };
    }, []);

    useEffect(() => {
        const handleFocusComplete = (
            event: Event
        ) => {
            const customEvent =
                event as CustomEvent<string>;

            if (
                customEvent.detail ===
                focusedCommentId
            ) {
                setFocusedCommentId(
                    null
                );
            }
        };

        window.addEventListener(
            ADMIN_COMMENT_FOCUS_COMPLETE_EVENT,
            handleFocusComplete
        );

        return () => {
            window.removeEventListener(
                ADMIN_COMMENT_FOCUS_COMPLETE_EVENT,
                handleFocusComplete
            );
        };
    }, [
        focusedCommentId
    ]);

    useEffect(() => {
        if (!commentMode) {
            return;
        }

        const handlePointerDown = (
            event: PointerEvent
        ) => {
            if (
                event.button !==
                2
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            setCommentMode(
                false
            );

            setSelectedTarget(
                null
            );

            setCommentError(
                ""
            );
        };

        const handleContextMenu = (
            event: MouseEvent
        ) => {
            event.preventDefault();
            event.stopPropagation();
        };

        window.addEventListener(
            "pointerdown",
            handlePointerDown,
            true
        );

        window.addEventListener(
            "contextmenu",
            handleContextMenu,
            true
        );

        return () => {
            window.removeEventListener(
                "pointerdown",
                handlePointerDown,
                true
            );

            window.removeEventListener(
                "contextmenu",
                handleContextMenu,
                true
            );
        };
    }, [
        commentMode
    ]);

    useEffect(() => {
        const element =
            chatRef.current;

        if (!element) {
            return;
        }

        element.scrollTop =
            element.scrollHeight;
    }, [
        comments.length
    ]);

    const startSpecificComment = () => {
        if (!canComment) {
            return;
        }

        setCommentMode(
            true
        );

        setSelectedTarget(
            null
        );

        setCommentText(
            ""
        );

        setCommentError(
            ""
        );
    };

    const cancelSpecificComment = () => {
        setCommentMode(
            false
        );

        setSelectedTarget(
            null
        );

        setCommentError(
            ""
        );
    };

    const handleSaveComment = async () => {
        if (!canComment) {
            setCommentError("Only admins can comment on projects.");
            return;
        }

        const user =
            auth.currentUser;

        if (!user) {
            setCommentError(
                "Admin authentication is required."
            );

            return;
        }

        const text =
            commentText.trim();

        if (!text) {
            setCommentError(
                "Please enter a comment."
            );

            return;
        }

        if (
            commentMode &&
            !selectedTarget
        ) {
            setCommentError(
                "Select an object in the scene first."
            );

            return;
        }

        try {
            setSavingComment(
                true
            );

            setCommentError(
                ""
            );

            const target =
                commentMode &&
                selectedTarget
                    ? selectedTarget
                    : {
                        targetType:
                            "project" as const,
                        targetId:
                            null,
                        targetLabel:
                            "Entire Project"
                    };

            const createdCommentId =
                await createAdminComment({
                    projectId:
                        projectData.projectId,
                    targetType:
                        target.targetType,
                    targetId:
                        target.targetId,
                    targetLabel:
                        target.targetLabel,
                    regionId:
                        target.regionId,
                    text
                });

            setCommentText(
                ""
            );

            if (
                commentMode
            ) {
                setSelectedTarget(
                    null
                );

                setVisibleCommentId(
                    createdCommentId
                );
            }
        } catch (error) {
            console.error(
                "Failed to save admin comment:",
                error
            );

            setCommentError(
                error instanceof Error
                    ? error.message
                    : "Failed to save comment."
            );
        } finally {
            setSavingComment(
                false
            );
        }
    };

    const handleFocusComment = (
        commentId: string
    ) => {
        setVisibleCommentId(
            commentId
        );

        setFocusedCommentId(
            commentId
        );

        requestAdminCommentFocus(
            commentId
        );
    };

    const commentTargetLabel =
        selectedTarget?.targetLabel ??
        "";

    return (
        <div
    className="relative h-screen w-screen overflow-hidden bg-[#f5f5f3]"
    style={{
        cursor: commentMode
            ? COMMENT_CURSOR
            : "default"
    }}
>
            <AdminProjectScene
                projectData={
                    projectData
                }
                comments={
                    comments
                }
                activeTarget={
                    selectedTarget
                }
                visibleCommentId={
                    visibleCommentId
                }
            />
          
            <div className="pointer-events-none absolute left-4 top-4 z-30">
                <div className="pointer-events-auto w-[220px] rounded-xl border border-[#e4e4e1] bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#5c8f62]" />

                        <p className="text-[10px] font-medium text-[#777]">
                            Admin Project Viewer
                        </p>
                    </div>

                    <h1 className="mt-1 truncate text-sm font-semibold text-[#222]">
                        {
                            projectData.projectName ||
                            metadata.projectName
                        }
                    </h1>

                    <p className="mt-0.5 text-[10px] text-[#999]">
                        View-only
                    </p>
                </div>
            </div>

           <div
    style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 99999,
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        pointerEvents: "auto"
    }}
>
    <AdminCostEstimator
        projectData={projectData}
    />

    <button
        type="button"
        style={{
            height: "36px",
            padding: "0 16px",
            borderRadius: "8px",
            border: "1px solid #dededb",
            background: "#ffffff",
            color: "#333333",
            fontSize: "12px",
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
            cursor: "pointer"
        }}
        onClick={() =>
            navigate(-1)
        }
    >
        Back
    </button>
</div>

            <div className="absolute bottom-4 left-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#dfdfdb] bg-white shadow-xl">
                <div
                    ref={chatRef}
                    className="max-h-[260px] overflow-y-auto px-3 py-3"
                >
                    {
                        comments.length ===
                        0 && (
                            <div className="py-8 text-center">
                                <p className="text-xs font-medium text-[#555]">
                                    No comments yet
                                </p>

                                <p className="mt-1 text-[10px] text-[#999]">
                                    Start the project review.
                                </p>
                            </div>
                        )
                    }

                    {
                        commentError && (
                            <p className="mb-2 text-[10px] text-red-500">
                                {
                                    commentError
                                }
                            </p>
                        )
                    }

                    <div className="space-y-2">
                        {
                            comments.map(
                                comment => {
                                    const specific =
                                        comment.targetType !==
                                        "project";

                                    return (
                                        <div
                                            key={
                                                comment.id
                                            }
                                            className={
                                                specific
                                                    ? "rounded-xl border border-[#ffd2a8] bg-[#fff4e9] px-3 py-2.5"
                                                    : "rounded-xl border border-[#e7e7e3] bg-[#f7f7f5] px-3 py-2.5"
                                            }
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-[10px] font-semibold text-[#333]">
                                                        {
                                                            comment.adminName
                                                        }
                                                    </p>

                                                    <p className="text-[9px] text-[#999]">
                                                        {
                                                            formatCommentDate(
                                                                comment.createdAt
                                                            )
                                                        }
                                                    </p>
                                                </div>

                                                {
                                                    specific && (
                                                        <button
                                                            type="button"
                                                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#ff7a00] text-white transition hover:bg-[#ea6f00]"
                                                            title="Focus on object"
                                                            onClick={() =>
                                                                handleFocusComment(
                                                                    comment.id
                                                                )
                                                            }
                                                        >
                                                            <ArrowUpRight
                                                                size={
                                                                    13
                                                                }
                                                            />
                                                        </button>
                                                    )
                                                }
                                            </div>

                                            {
                                                specific && (
                                                    <p className="mt-2 text-[9px] font-medium text-[#d86d00]">
                                                        {
                                                            comment.targetLabel
                                                        }
                                                    </p>
                                                )
                                            }

                                            <p className="mt-1 text-[11px] leading-4 text-[#333]">
                                                {
                                                    comment.text
                                                }
                                            </p>
                                        </div>
                                    );
                                }
                            )
                        }
                    </div>
                </div>

                {canComment && (
                <div className="border-t border-[#e7e7e3] bg-white px-3 py-3">
                    {
                        commentMode && (
                            <div className="mb-2 flex items-center justify-between rounded-lg bg-[#fff4e9] px-2.5 py-2">
                                <div className="min-w-0">
                                    <p className="text-[9px] font-semibold uppercase tracking-wide text-[#d86d00]">
                                        Specific Comment
                                    </p>

                                    <p className="truncate text-[10px] font-medium text-[#555]">
                                        {
                                            selectedTarget
                                                ? commentTargetLabel
                                                : "Click an object in the scene"
                                        }
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="text-[10px] font-medium text-[#d86d00] hover:text-[#b95b00]"
                                    onClick={
                                        cancelSpecificComment
                                    }
                                >
                                    Cancel
                                </button>
                            </div>
                        )
                    }

                    <div className="flex items-end gap-2">
                        <button
                            type="button"
                            className={
                                commentMode
                                    ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff7a00] text-white transition hover:bg-[#ea6f00]"
                                    : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#ddddda] bg-[#fafaf8] text-[#666] transition hover:bg-[#f1f1ee]"
                            }
                            onClick={
                                commentMode
                                    ? cancelSpecificComment
                                    : startSpecificComment
                            }
                            title={
                                commentMode
                                    ? "Exit specific comment mode"
                                    : "Comment on a specific object"
                            }
                        >
                            <MessageCircle
                                size={
                                    16
                                }
                            />
                        </button>

                        <textarea
                            value={
                                commentText
                            }
                            onChange={
                                event =>
                                    setCommentText(
                                        event.target.value
                                    )
                            }
                            disabled={
                                commentMode &&
                                !selectedTarget
                            }
                            placeholder={
                                commentMode
                                    ? (
                                        selectedTarget
                                            ? "Write a comment about this object..."
                                            : "Select an object in the scene..."
                                    )
                                    : "Write a project comment..."
                            }
                            rows={
                                2
                            }
                            className="min-h-[40px] flex-1 resize-none rounded-xl border border-[#ddddda] bg-[#fafaf8] px-3 py-2.5 text-[11px] text-[#333] outline-none placeholder:text-[#aaa] focus:border-[#ffb06e] disabled:cursor-not-allowed disabled:opacity-60"
                        />

                        <button
                            type="button"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff7a00] text-white transition hover:bg-[#ea6f00] disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={
                                handleSaveComment
                            }
                            disabled={
                                savingComment ||
                                !commentText.trim() ||
                                (
                                    commentMode &&
                                    !selectedTarget
                                )
                            }
                            title="Send comment"
                        >
                            <Send
                                size={
                                    15
                                }
                            />
                        </button>
                    </div>

                    {
                        commentMode && (
                            <p className="mt-1.5 text-[9px] text-[#aaa]">
                                Right-click anywhere to exit specific comment mode.
                            </p>
                        )
                    }
                </div>
                )}
            </div>
        </div>
    );
}