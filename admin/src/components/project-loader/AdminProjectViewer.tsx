import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowLeft,
    ArrowUpRight,
    ChevronLeft,
    ChevronRight,
    MessageCircle,
    MousePointerClick,
    Send,
    X
} from "lucide-react";
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
import LoadingScreen from "@/components/LoadingScreen";

interface AdminProjectViewerProps {
    metadata: AdminProject;
    projectData: SavedProjectData;
    unavailableAssetIds?: string[];
}

const COMMENT_CURSOR =
    `url("data:image/svg+xml,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
            <path d="M6 5.5 C4.067 5.5 2.5 7.067 2.5 9 V18 C2.5 19.933 4.067 21.5 6 21.5 H12 L10 27 L16.5 21.5 H24 C25.933 21.5 27.5 19.933 27.5 18 V9 C27.5 7.067 25.933 5.5 24 5.5 Z"
                fill="white" stroke="#ff7a00" stroke-width="2" stroke-linejoin="round" />
            <circle cx="10" cy="13.5" r="1.4" fill="#ff7a00" />
            <circle cx="15" cy="13.5" r="1.4" fill="#ff7a00" />
            <circle cx="20" cy="13.5" r="1.4" fill="#ff7a00" />
        </svg>
    `)}") 5 5, crosshair`;

function formatCommentDate(value: unknown): string {
    const options: Intl.DateTimeFormatOptions = {
        dateStyle: "medium",
        timeStyle: "short"
    };

    if (
        value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof (value as { toDate: () => Date }).toDate === "function"
    ) {
        return (value as { toDate: () => Date }).toDate().toLocaleString(undefined, options);
    }

    if (value instanceof Date) {
        return value.toLocaleString(undefined, options);
    }

    if (typeof value === "string") {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString(undefined, options);
        }
    }

    return "Just now";
}

export default function AdminProjectViewer({
    metadata,
    projectData,
    unavailableAssetIds = []
}: AdminProjectViewerProps) {
    const navigate = useNavigate();
    const { role } = useAuth();
    const canComment = role === "admin";

    //==================================================
    // FLOORS
    //==================================================
    const reviewFloors = useMemo(() => {
        if (projectData.floors?.length) {
            return projectData.floors.map((floor, index) => ({
                ...floor,
                floorId: floor.floorId ?? floor.id ?? (index === 0 ? "first-floor" : `floor-${index + 1}`)
            }));
        }
        return [{
            floorId: "first-floor",
            name: "1st Floor",
            structure: projectData
        }];
    }, [projectData]);

    const [activeFloorId, setActiveFloorId] = useState(
        projectData.activeFloorId ??
        projectData.floors?.[0]?.floorId ??
        projectData.floors?.[0]?.id ??
        "first-floor"
    );
    const activeFloorIndex = Math.max(
        0,
        reviewFloors.findIndex(floor => floor.floorId === activeFloorId)
    );
    const activeFloor = reviewFloors[activeFloorIndex];
    const activeProjectData = useMemo(() => ({
        ...projectData,
        ...activeFloor.structure,
        furniture: activeFloor.furniture ??
            activeFloor.structure.furniture ??
            (activeFloorIndex === 0 ? projectData.furniture : []),
        stairs: activeFloor.stairs ??
            activeFloor.structure.stairs ??
            (activeFloorIndex === 0 ? projectData.stairs : []),
        stairLandings: activeFloor.stairLandings ??
            activeFloor.structure.stairLandings ??
            (activeFloorIndex === 0 ? projectData.stairLandings : []),
        floorFinishes: activeFloor.floorFinishes ??
            activeFloor.structure.floorFinishes ??
            (activeFloorIndex === 0 ? projectData.floorFinishes : {}),
        wallFinishes: activeFloor.wallFinishes ??
            activeFloor.structure.wallFinishes ??
            (activeFloorIndex === 0 ? projectData.wallFinishes : {}),
        wallPaintSeparators: activeFloor.wallPaintSeparators ??
            activeFloor.structure.wallPaintSeparators ??
            (activeFloorIndex === 0 ? projectData.wallPaintSeparators : {}),
        floorPaintSeparators: activeFloor.floorPaintSeparators ??
            activeFloor.structure.floorPaintSeparators ??
            (activeFloorIndex === 0 ? projectData.floorPaintSeparators : {})
    }), [activeFloor, activeFloorIndex, projectData]);

    //==================================================
    // STATE
    //==================================================
    const [sceneReady, setSceneReady] = useState(false);
    const [runtimeAssetFailures, setRuntimeAssetFailures] = useState<string[]>([]);
    const [assetWarningDismissed, setAssetWarningDismissed] = useState(false);
    const reportedUnavailableAssetIds = [
        ...new Set([...unavailableAssetIds, ...runtimeAssetFailures])
    ];
    const handleSceneReady = useCallback(() => {
        setSceneReady(true);
    }, []);

    const [comments, setComments] = useState<AdminComment[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<AdminCommentTargetDetail | null>(null);
    const [commentMode, setCommentMode] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [savingComment, setSavingComment] = useState(false);
    const [commentError, setCommentError] = useState("");
    const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
    const [visibleCommentId, setVisibleCommentId] = useState<string | null>(null);
    const [panelOpen, setPanelOpen] = useState(true);

    const chatRef = useRef<HTMLDivElement | null>(null);

    //==================================================
    // EFFECTS
    //==================================================
    useEffect(() => {
        return subscribeToAdminComments(
            projectData.projectId,
            setComments,
            error => {
                setCommentError("Unable to load comments.");
                console.error(error);
            }
        );
    }, [projectData.projectId]);

    useEffect(() => {
        const handleTarget = (event: Event) => {
            if (!canComment || !commentMode) return;

            const customEvent = event as CustomEvent<AdminCommentTargetDetail>;
            if (!customEvent.detail) return;

            setSelectedTarget(customEvent.detail);
            setCommentError("");
        };

        window.addEventListener(ADMIN_COMMENT_TARGET_EVENT, handleTarget);
        return () => window.removeEventListener(ADMIN_COMMENT_TARGET_EVENT, handleTarget);
    }, [canComment, commentMode]);

    useEffect(() => {
        const handleMarkerClick = (event: Event) => {
            const commentId = (event as CustomEvent<string>).detail;
            if (!commentId) return;

            setVisibleCommentId(commentId);
            setFocusedCommentId(commentId);
            requestAdminCommentFocus(commentId);
        };

        window.addEventListener(ADMIN_COMMENT_MARKER_CLICK_EVENT, handleMarkerClick);
        return () => window.removeEventListener(ADMIN_COMMENT_MARKER_CLICK_EVENT, handleMarkerClick);
    }, []);

    useEffect(() => {
        const handleFocusComplete = (event: Event) => {
            if ((event as CustomEvent<string>).detail === focusedCommentId) {
                setFocusedCommentId(null);
            }
        };

        window.addEventListener(ADMIN_COMMENT_FOCUS_COMPLETE_EVENT, handleFocusComplete);
        return () => window.removeEventListener(ADMIN_COMMENT_FOCUS_COMPLETE_EVENT, handleFocusComplete);
    }, [focusedCommentId]);

    // Leave "specific object" mode with a right-click or Escape.
    useEffect(() => {
        if (!commentMode) return;

        const exitMode = () => {
            setCommentMode(false);
            setSelectedTarget(null);
            setCommentError("");
        };

        const handlePointerDown = (event: PointerEvent) => {
            if (event.button !== 2) return;
            event.preventDefault();
            event.stopPropagation();
            exitMode();
        };

        const handleContextMenu = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") exitMode();
        };

        window.addEventListener("pointerdown", handlePointerDown, true);
        window.addEventListener("contextmenu", handleContextMenu, true);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("pointerdown", handlePointerDown, true);
            window.removeEventListener("contextmenu", handleContextMenu, true);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [commentMode]);

    useEffect(() => {
        const element = chatRef.current;
        if (!element) return;
        element.scrollTop = element.scrollHeight;
    }, [comments.length, panelOpen]);

    //==================================================
    // ACTIONS
    //==================================================
    const startSpecificComment = () => {
        if (!canComment) return;
        setCommentMode(true);
        setSelectedTarget(null);
        setCommentError("");
    };

    const cancelSpecificComment = () => {
        setCommentMode(false);
        setSelectedTarget(null);
        setCommentError("");
    };

    const handleSaveComment = async () => {
        if (!canComment) {
            setCommentError("Only admins can comment on projects.");
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            setCommentError("Admin authentication is required.");
            return;
        }

        const text = commentText.trim();
        if (!text) {
            setCommentError("Please enter a comment.");
            return;
        }

        if (commentMode && !selectedTarget) {
            setCommentError("Select an object in the scene first.");
            return;
        }

        try {
            setSavingComment(true);
            setCommentError("");

            const target = commentMode && selectedTarget
                ? selectedTarget
                : {
                    targetType: "project" as const,
                    targetId: null,
                    targetLabel: "Entire Project",
                    regionId: undefined
                };

            const createdCommentId = await createAdminComment({
                projectId: projectData.projectId,
                targetType: target.targetType,
                targetId: target.targetId,
                targetLabel: target.targetLabel,
                regionId: target.regionId,
                text
            });

            setCommentText("");

            if (commentMode) {
                setSelectedTarget(null);
                setVisibleCommentId(createdCommentId);
            }
        } catch (error) {
            console.error("Failed to save admin comment:", error);
            setCommentError(error instanceof Error ? error.message : "Failed to save comment.");
        } finally {
            setSavingComment(false);
        }
    };

    const handleFocusComment = (commentId: string) => {
        setVisibleCommentId(commentId);
        setFocusedCommentId(commentId);
        requestAdminCommentFocus(commentId);
    };

    //==================================================
    // DERIVED
    //==================================================
    const snapshotLabel = metadata.reviewSnapshotType === "submitted"
        ? `Submitted design · v${metadata.submittedVersionNumber ?? "legacy"}`
        : metadata.reviewSnapshotType === "approved"
            ? `Approved design · v${metadata.approvedVersionNumber ?? "legacy"}`
            : metadata.reviewSnapshotType === "latest-saved"
                ? `Latest saved design · v${metadata.currentDesignVersionNumber ?? "not versioned"} (not live)`
                : "Project design";

    const projectTitle = projectData.projectName || metadata.projectName;
    const sendDisabled =
        savingComment ||
        !commentText.trim() ||
        (commentMode && !selectedTarget);

    //==================================================
    // RENDER
    //==================================================
    return (
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#f5f5f3] text-[#222]">
            {/* ================= HEADER ================= */}
            <header className="relative z-50 flex h-14 shrink-0 items-center gap-3 border-b border-[#e4e4e1] bg-white px-4">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dededb] bg-white px-3 text-sm font-medium text-[#333] transition hover:bg-[#f5f5f3]"
                >
                    <ArrowLeft size={15} />
                    Back
                </button>

                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-sm font-semibold leading-tight">
                        {projectTitle}
                    </h1>
                    <p className="truncate text-xs text-[#888]">
                        {snapshotLabel} · View only
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <AdminCostEstimator projectData={projectData} />
                    </div>

                    <button
                        type="button"
                        onClick={() => setPanelOpen(open => !open)}
                        aria-expanded={panelOpen}
                        className="relative z-10 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dededb] bg-white px-3 text-sm font-medium text-[#333] transition hover:bg-[#f5f5f3]"
                    >
                        <MessageCircle size={15} />
                        Comments
                        {comments.length > 0 && (
                            <span className="rounded-full bg-[#ff7a00] px-1.5 text-[11px] font-semibold text-white">
                                {comments.length}
                            </span>
                        )}
                        {panelOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                </div>
            </header>

            {/* ================= BODY ================= */}
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                {/* ---------- 3D SCENE ---------- */}
                <div
                    className="relative isolate min-h-0 min-w-0 flex-1 overflow-hidden"
                    style={{ cursor: commentMode ? COMMENT_CURSOR : "default" }}
                >
                    <AdminProjectScene
                        projectData={activeProjectData}
                        onReady={handleSceneReady}
                        comments={comments}
                        activeTarget={selectedTarget}
                        visibleCommentId={visibleCommentId}
                        onAssetError={assetId => setRuntimeAssetFailures(current =>
                            current.includes(assetId) ? current : [...current, assetId]
                        )}
                    />

                    {/* Floor buttons: right side, vertically centered (1F on top, 2F below) */}
                    {reviewFloors.length > 1 && (
                        <nav
                            className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2"
                            aria-label="Floors"
                        >
                            {reviewFloors.map((floor, index) => {
                                const active = floor.floorId === activeFloor.floorId;
                                return (
                                    <button
                                        key={floor.floorId}
                                        type="button"
                                        title={floor.name}
                                        aria-label={floor.name}
                                        aria-pressed={active}
                                        onClick={() => setActiveFloorId(floor.floorId)}
                                        className={`flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-semibold shadow-md transition ${
                                            active
                                                ? "border-[#333] bg-[#333] text-white"
                                                : "border-[#dededb] bg-white text-[#555] hover:bg-[#f5f5f3]"
                                        }`}
                                    >
                                        {index + 1}F
                                    </button>
                                );
                            })}
                        </nav>
                    )}

                    {/* Comment-mode hint */}
                    {commentMode && (
                        <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2">
                            <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#222] px-4 py-2 text-sm text-white shadow-lg">
                                <MousePointerClick size={16} className="text-[#ff9a3d]" />
                                <span>
                                    {selectedTarget
                                        ? `Selected: ${selectedTarget.targetLabel}`
                                        : "Click an object in the scene to comment on it"}
                                </span>
                                <button
                                    type="button"
                                    onClick={cancelSpecificComment}
                                    className="rounded-full p-1 text-white/70 hover:bg-white/15 hover:text-white"
                                    title="Exit (Esc or right-click)"
                                    aria-label="Exit comment mode"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Asset warning (dismissible, details collapsed) */}
                    {reportedUnavailableAssetIds.length > 0 && !assetWarningDismissed && (
                        <div
                            role="alert"
                            className="absolute bottom-4 left-4 z-20 max-w-[340px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 shadow"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <p>
                                    Some items could not be loaded. The rest of the design is still visible.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setAssetWarningDismissed(true)}
                                    aria-label="Dismiss warning"
                                    className="shrink-0 text-amber-900/70 hover:text-amber-950"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            <details className="mt-1">
                                <summary className="cursor-pointer text-amber-900/80">Show details</summary>
                                <p className="mt-1 break-words">
                                    Asset IDs: {reportedUnavailableAssetIds.join(", ")}
                                </p>
                            </details>
                        </div>
                    )}
                </div>

                {/* ---------- COMMENTS PANEL ---------- */}
                {panelOpen && (
                    <aside
                        className="flex h-[45%] w-full shrink-0 flex-col border-t border-[#e4e4e1] bg-white md:h-auto md:w-[360px] md:border-l md:border-t-0"
                        aria-label="Comments"
                    >
                        <div className="flex items-center justify-between border-b border-[#eeeeea] px-4 py-3">
                            <h2 className="text-sm font-semibold">
                                Comments{comments.length > 0 ? ` (${comments.length})` : ""}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setPanelOpen(false)}
                                className="rounded-md p-1 text-[#888] hover:bg-[#f1f1ee] hover:text-[#222]"
                                aria-label="Close comments"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* List */}
                        <div ref={chatRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                            {comments.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center text-center">
                                    <MessageCircle size={28} className="text-[#ccc]" />
                                    <p className="mt-3 text-sm font-medium text-[#555]">No comments yet</p>
                                    <p className="mt-1 text-xs text-[#999]">
                                        {canComment
                                            ? "Write the first comment below to start the review."
                                            : "Comments from the admin will appear here."}
                                    </p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {comments.map(comment => {
                                        const specific = comment.targetType !== "project";

                                        return (
                                            <li
                                                key={comment.id}
                                                className={`rounded-xl border px-3.5 py-3 ${
                                                    comment.id === visibleCommentId
                                                        ? "border-[#ffb06e] bg-[#fff4e9]"
                                                        : "border-[#eeeeea] bg-[#fafaf8]"
                                                }`}
                                            >
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <p className="truncate text-sm font-medium">
                                                        {comment.adminName}
                                                    </p>
                                                    <time className="shrink-0 text-xs text-[#999]">
                                                        {formatCommentDate(comment.createdAt)}
                                                    </time>
                                                </div>

                                                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#444]">
                                                    {comment.text}
                                                </p>

                                                {specific && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleFocusComment(comment.id)}
                                                        className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#d86d00] ring-1 ring-[#ffd2a8] transition hover:bg-[#fff4e9]"
                                                        title="Show this object in the 3D view"
                                                    >
                                                        {comment.targetLabel}
                                                        <ArrowUpRight size={12} />
                                                    </button>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {/* Composer (admins only) */}
                        {canComment && (
                            <div className="border-t border-[#eeeeea] px-4 py-3">
                                <div
                                    className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-[#f1f1ee] p-1"
                                    role="group"
                                    aria-label="Comment target"
                                >
                                    <button
                                        type="button"
                                        aria-pressed={!commentMode}
                                        onClick={cancelSpecificComment}
                                        className={`rounded-md py-1.5 text-xs font-medium transition ${
                                            !commentMode
                                                ? "bg-white text-[#222] shadow-sm"
                                                : "text-[#777] hover:text-[#222]"
                                        }`}
                                    >
                                        Whole project
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={commentMode}
                                        onClick={startSpecificComment}
                                        className={`rounded-md py-1.5 text-xs font-medium transition ${
                                            commentMode
                                                ? "bg-[#ff7a00] text-white shadow-sm"
                                                : "text-[#777] hover:text-[#222]"
                                        }`}
                                    >
                                        Specific object
                                    </button>
                                </div>

                                {commentMode && (
                                    <p className="mb-2 text-xs text-[#d86d00]">
                                        {selectedTarget
                                            ? `Commenting on: ${selectedTarget.targetLabel}`
                                            : "Click an object in the 3D view first."}
                                    </p>
                                )}

                                {commentError && (
                                    <p role="alert" className="mb-2 text-xs text-red-600">
                                        {commentError}
                                    </p>
                                )}

                                <div className="flex items-end gap-2">
                                    <textarea
                                        value={commentText}
                                        onChange={event => setCommentText(event.target.value)}
                                        disabled={commentMode && !selectedTarget}
                                        placeholder={
                                            commentMode
                                                ? selectedTarget
                                                    ? "Write a comment about this object..."
                                                    : "Select an object first..."
                                                : "Write a comment about the project..."
                                        }
                                        rows={3}
                                        className="min-h-[72px] flex-1 resize-none rounded-xl border border-[#ddddda] bg-[#fafaf8] px-3 py-2.5 text-sm outline-none placeholder:text-[#aaa] focus:border-[#ffb06e] disabled:cursor-not-allowed disabled:opacity-60"
                                    />

                                    <button
                                        type="button"
                                        onClick={handleSaveComment}
                                        disabled={sendDisabled}
                                        title="Send comment"
                                        aria-label="Send comment"
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff7a00] text-white transition hover:bg-[#ea6f00] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Comment-error for non-admin loading failures */}
                        {!canComment && commentError && (
                            <p role="alert" className="border-t border-[#eeeeea] px-4 py-3 text-xs text-red-600">
                                {commentError}
                            </p>
                        )}
                    </aside>
                )}
            </div>

            {!sceneReady && (
                <div className="fixed inset-0 z-[100000]">
                    <LoadingScreen label="Preparing 3D Scene" />
                </div>
            )}
        </div>
    );
}