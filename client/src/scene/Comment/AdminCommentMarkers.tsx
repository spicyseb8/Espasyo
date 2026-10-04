import {
    useEffect,
    useState
} from "react";
import {
    Html
} from "@react-three/drei";
import {
    MathUtils,
    Vector3
} from "three";
import type {
    AdminComment
} from "../../services/adminCommentService";
import {
    ADMIN_COMMENT_FOCUS_COMPLETE_EVENT,
    ADMIN_COMMENT_MARKER_CLICK_EVENT,
    emitAdminCommentMarkerClick
} from "../../services/adminCommentEvents";
import useEditor
    from "../../context/editor/useEditor";
import {
    getAdminCommentTargetPoint
} from "./AdminCommentTargetUtils";
import {
    useFrame,
    useThree
} from "@react-three/fiber";

interface AdminCommentMarkersProps {
    comments:
        AdminComment[];
}

interface MarkerProps {
    comment:
        AdminComment;
    position:
        Vector3;
    focused:
        boolean;
    visible:
        boolean;
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

function Marker({
    comment,
    position,
    focused,
    visible
}: MarkerProps) {
    const {
        camera
    } = useThree();

    const [
        scale,
        setScale
    ] = useState(1);

    useFrame(() => {
        const distance =
            camera.position.distanceTo(
                position
            );

        setScale(
            MathUtils.clamp(
                10 / distance,
                0.15,
                1
            )
        );
    });

    return (
        <Html
            position={
                position
            }
            center
            distanceFactor={
                undefined
            }
        >
            <div
                style={{
                    position:
                        "relative",
                    width:
                        "max-content",
                    transform:
                        `translate(-50%, -50%) scale(${scale})`,
                    transformOrigin:
                        "center center"
                }}
            >
                <button
                    type="button"
                    onClick={
                        event => {
                            event.stopPropagation();
                            emitAdminCommentMarkerClick(
                                comment.id
                            );
                        }
                    }
                    style={{
                        width:
                            28,
                        height:
                            28,
                        border:
                            focused
                                ? "3px solid #ff7a00"
                                : "2px solid #ffffff",
                        borderRadius:
                            "50%",
                        background:
                            "#ff7a00",
                        boxShadow:
                            "0 2px 7px rgba(0,0,0,0.22)",
                        display:
                            "flex",
                        alignItems:
                            "center",
                        justifyContent:
                            "center",
                        cursor:
                            "pointer",
                        padding:
                            0
                    }}
                    aria-label={`View comment by ${comment.adminName}`}
                >
                    <span
                        style={{
                            width:
                                7,
                            height:
                                7,
                            borderRadius:
                                "50%",
                            background:
                                "#ffffff"
                        }}
                    />
                </button>

                {visible && (
                    <div
                        style={{
                            position:
                                "absolute",
                            left:
                                36,
                            bottom:
                                18,
                            width:
                                220,
                            padding:
                                "10px 12px",
                            border:
                                "1px solid #e1e1de",
                            borderRadius:
                                10,
                            background:
                                "#ffffff",
                            boxShadow:
                                "0 8px 20px rgba(0,0,0,0.14)",
                            color:
                                "#333",
                            textAlign:
                                "left"
                        }}
                    >
                        <div
                            style={{
                                fontSize:
                                    10,
                                fontWeight:
                                    700
                            }}
                        >
                            {
                                comment.adminName
                            }
                        </div>
                        <div
                            style={{
                                marginTop:
                                    2,
                                fontSize:
                                    9,
                                color:
                                    "#999"
                            }}
                        >
                            {
                                formatCommentDate(
                                    comment.createdAt
                                )
                            }
                        </div>
                        <div
                            style={{
                                marginTop:
                                    6,
                                fontSize:
                                    9,
                                fontWeight:
                                    600,
                                color:
                                    "#d86d00"
                            }}
                        >
                            {
                                comment.targetLabel
                            }
                        </div>
                        <div
                            style={{
                                marginTop:
                                    4,
                                fontSize:
                                    10,
                                lineHeight:
                                    1.5
                            }}
                        >
                            {
                                comment.text
                            }
                        </div>
                    </div>
                )}
            </div>
        </Html>
    );
}

export default function AdminCommentMarkers({
    comments
}: AdminCommentMarkersProps) {
    const {
        state
    } = useEditor();

    const [
        visibleCommentId,
        setVisibleCommentId
    ] = useState<
        string | null
    >(null);

    const [
        focusedCommentId,
        setFocusedCommentId
    ] = useState<
        string | null
    >(null);

    useEffect(() => {
        const handleMarkerClick =
            (
                event: Event
            ) => {
                const customEvent =
                    event as CustomEvent<string>;

                if (
                    !customEvent.detail
                ) {
                    return;
                }

                setVisibleCommentId(
                    customEvent.detail
                );

                setFocusedCommentId(
                    customEvent.detail
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
        const handleFocusComplete =
            (
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

    return (
        <>
            {comments
                .filter(
                    comment =>
                        comment.targetType !==
                        "project"
                )
                .map(
                    comment => {
                        const position =
                            getAdminCommentTargetPoint(
                                state,
                                comment
                            );

                        if (!position) {
                            return null;
                        }

                        return (
                            <Marker
                                key={
                                    comment.id
                                }
                                comment={
                                    comment
                                }
                                position={
                                    position
                                }
                                focused={
                                    focusedCommentId ===
                                    comment.id
                                }
                                visible={
                                    visibleCommentId ===
                                    comment.id
                                }
                            />
                        );
                    }
                )}
        </>
    );
}