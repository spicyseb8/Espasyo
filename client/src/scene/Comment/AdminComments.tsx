import {
    useEffect,
    useRef,
    useState
} from "react";
import {
    ArrowUpRight,
    ChevronDown,
    MessageCircle
} from "lucide-react";
import {
    emitAdminCommentMarkerClick
} from "../../services/adminCommentEvents";
import {
    subscribeToAdminComments,
    type AdminComment
} from "../../services/adminCommentService";
import "./AdminComments.css";

interface AdminCommentsProps {
    projectId:
        string | null;
}

function formatCommentDate(
    value: unknown
): string {
    if (
        value &&
        typeof value ===
            "object" &&
        "toDate" in value &&
        typeof (
            value as {
                toDate: () => Date;
            }
        ).toDate ===
            "function"
    ) {
        return (
            value as {
                toDate:
                    () => Date;
            }
        ).toDate().toLocaleString(
            undefined,
            {
                dateStyle:
                    "medium",
                timeStyle:
                    "short"
            }
        );
    }

    if (
        value instanceof Date
    ) {
        return value.toLocaleString(
            undefined,
            {
                dateStyle:
                    "medium",
                timeStyle:
                    "short"
            }
        );
    }

    return "Just now";
}

export default function AdminComments({
    projectId
}: AdminCommentsProps) {
    const [
        open,
        setOpen
    ] = useState(false);

    const [
        comments,
        setComments
    ] = useState<
        AdminComment[]
    >([]);

    const wrapperRef =
        useRef<HTMLDivElement | null>(
            null
        );

    useEffect(() => {
        if (!projectId) {
            setComments([]);
            return;
        }

        return subscribeToAdminComments(
            projectId,
            setComments,
            error => {
                console.error(
                    "Failed to load admin comments:",
                    error
                );
            }
        );
    }, [
        projectId
    ]);

    useEffect(() => {
        const handleOutsideClick =
            (
                event: MouseEvent
            ) => {
                if (
                    wrapperRef.current &&
                    !wrapperRef.current.contains(
                        event.target as Node
                    )
                ) {
                    setOpen(
                        false
                    );
                }
            };

        document.addEventListener(
            "mousedown",
            handleOutsideClick
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleOutsideClick
            );
        };
    }, []);

    const handleFocus =
        (
            commentId:
                string
        ) => {
            emitAdminCommentMarkerClick(
                commentId
            );
        };

    return (
        <div
            ref={wrapperRef}
            className="admin-comments"
        >
            <button
                type="button"
                className="admin-comments-button"
                onClick={() =>
                    setOpen(
                        value =>
                            !value
                    )
                }
                aria-expanded={
                    open
                }
                aria-label="Toggle admin comments"
            >
                <MessageCircle
                    size={17}
                />
                <span>
                    Admin Comments
                </span>
                {comments.length >
                    0 && (
                    <span className="admin-comments-count">
                        {
                            comments.length
                        }
                    </span>
                )}
                <ChevronDown
                    size={16}
                    className={
                        open
                            ? "admin-comments-chevron open"
                            : "admin-comments-chevron"
                    }
                />
            </button>

            {open && (
                <div className="admin-comments-dropdown">
                    <div className="admin-comments-header">
                        <strong>
                            Admin Comments
                        </strong>
                        <span>
                            Read-only project review
                        </span>
                    </div>

                    <div className="admin-comments-list">
                        {comments.length ===
                            0 && (
                            <div className="admin-comments-empty">
                                No admin comments yet.
                            </div>
                        )}

                        {comments.map(
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
                                                ? "admin-comment-card specific"
                                                : "admin-comment-card"
                                        }
                                    >
                                        <div className="admin-comment-top">
                                            <div className="admin-comment-author">
                                                <span className="admin-comment-name">
                                                    {
                                                        comment.adminName
                                                    }
                                                </span>
                                                <span className="admin-comment-date">
                                                    {
                                                        formatCommentDate(
                                                            comment.createdAt
                                                        )
                                                    }
                                                </span>
                                            </div>

                                            {specific && (
                                                <button
                                                    type="button"
                                                    className="admin-comment-focus"
                                                    title="Focus on comment"
                                                    aria-label="Focus on comment"
                                                    onClick={() =>
                                                        handleFocus(
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
                                            )}
                                        </div>

                                        {specific && (
                                            <div className="admin-comment-target">
                                                {
                                                    comment.targetLabel
                                                }
                                            </div>
                                        )}

                                        <p className="admin-comment-text">
                                            {
                                                comment.text
                                            }
                                        </p>
                                    </div>
                                );
                            }
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}