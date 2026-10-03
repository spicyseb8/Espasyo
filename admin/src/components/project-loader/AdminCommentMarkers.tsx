import { useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Vector3 } from "three";
import type { SavedProjectData } from "./ProjectTypes";
import type { AdminComment } from "@/services/assets/adminCommentService";
import {
    emitAdminCommentMarkerClick,
   
} from "@/services/assets/adminCommentEvents";
import { getAdminCommentTargetPoint } from "./loader-components/AdminCommentTargetUtils";

interface AdminCommentMarkersProps {
    projectData: SavedProjectData;
    comments: AdminComment[];
    focusedCommentId: string | null;
    visibleCommentId: string | null;
    activeTarget: {
        targetType:
            | "project"
            | "wall"
            | "floor"
            | "furniture"
            | "door"
            | "window"
            | "opening";
        targetId: string | null;
        targetLabel: string;
        regionId?: string;
    } | null;
}

function formatCommentDate(
    value: unknown
): string {
    if (
        value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof (value as { toDate: () => Date }).toDate === "function"
    ) {
        return (
            value as { toDate: () => Date }
        ).toDate().toLocaleString(
            undefined,
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );
    }

    if (value instanceof Date) {
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

function Marker({
    position,
    comment,
    focused,
    visible
}: {
    position: Vector3;
    comment: AdminComment;
    focused: boolean;
    visible: boolean;
}) {
    const { camera } = useThree();
    const markerRef = useRef<HTMLDivElement | null>(null);

    useFrame(() => {
        const marker = markerRef.current;

        if (!marker) {
            return;
        }

        const distance =
            camera.position.distanceTo(
                position
            );

        const scale =
            MathUtils.clamp(
                10 / distance,
                0.15,
                1
            );

        marker.style.transform =
            `translate(-50%, -50%) scale(${scale})`;
    });

    return (
        <Html
            position={position}
            center={false}
            distanceFactor={undefined}
            zIndexRange={[100, 0]}
        >
            <div
                ref={markerRef}
                style={{
                    transform:
                        "translate(-50%, -50%) scale(1)",
                    transformOrigin:
                        "center center",
                    position:
                        "relative"
                }}
            >
                <button
                    type="button"
                    title="Show comment"
                    onClick={event => {
                        event.stopPropagation();

                        emitAdminCommentMarkerClick(
                            comment.id
                        );
                    }}
                    className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#ff7a00] text-white shadow-lg"
                >
                    <span className="text-[11px] font-bold">
                        💬
                    </span>

                    {focused && (
                        <span className="absolute -inset-1 rounded-full border-2 border-[#ff7a00] opacity-60" />
                    )}

                    {visible && (
                        <div
                            className="absolute left-10 top-1/2 w-[190px] -translate-y-1/2 rounded-lg border border-[#e5e5e1] bg-white px-3 py-2 text-left shadow-xl"
                            onPointerDown={event =>
                                event.stopPropagation()
                            }
                        >
                            <div className="text-[10px] font-semibold text-[#222]">
                                {comment.adminName}
                            </div>

                            <div className="mt-0.5 text-[9px] text-[#999]">
                                {formatCommentDate(
                                    comment.createdAt
                                )}
                            </div>

                            <div className="mt-1 text-[10px] leading-4 text-[#444]">
                                {comment.text}
                            </div>
                        </div>
                    )}
                </button>
            </div>
        </Html>
    );
}

function ActiveTargetMarker({
    position,
    label
}: {
    position: Vector3;
    label: string;
}) {
    const { camera } = useThree();
    const markerRef = useRef<HTMLDivElement | null>(null);

    useFrame(() => {
        const marker = markerRef.current;

        if (!marker) {
            return;
        }

        const distance =
            camera.position.distanceTo(
                position
            );

        const scale =
            MathUtils.clamp(
                10 / distance,
                0.15,
                1
            );

        marker.style.transform =
            `translate(-50%, -50%) scale(${scale})`;
    });

    return (
        <Html
            position={position}
            center={false}
            distanceFactor={undefined}
            zIndexRange={[90, 0]}
        >
            <div
                ref={markerRef}
                style={{
                    transform:
                        "translate(-50%, -50%) scale(1)",
                    transformOrigin:
                        "center center",
                    position:
                        "relative"
                }}
            >
                <div className="pointer-events-none flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#ff7a00] bg-[#ff7a00]/15 shadow-[0_0_0_6px_rgba(255,122,0,0.16)]">
                    <span className="h-2 w-2 rounded-full bg-[#ff7a00]" />
                </div>

                <div className="absolute left-10 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[10px] font-medium text-[#333] shadow-md">
                    {label}
                </div>
            </div>
        </Html>
    );
}

export default function AdminCommentMarkers({
    projectData,
    comments,
    focusedCommentId,
    visibleCommentId,
    activeTarget
}: AdminCommentMarkersProps) {
    const activePoint =
        activeTarget &&
        getAdminCommentTargetPoint(
            projectData,
            activeTarget
        );

    return (
        <>
            {comments
                .filter(
                    comment =>
                        comment.targetType !== "project" &&
                        comment.targetId
                )
                .map(comment => {
                    const point =
                        getAdminCommentTargetPoint(
                            projectData,
                            {
                                targetType:
                                    comment.targetType,
                                targetId:
                                    comment.targetId,
                                regionId:
                                    comment.regionId
                            }
                        );

                    if (!point) {
                        return null;
                    }

                    return (
                        <Marker
                            key={comment.id}
                            position={point}
                            comment={comment}
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
                })}

            {activePoint && (
                <ActiveTargetMarker
                    position={activePoint}
                    label={
                        activeTarget?.targetLabel ??
                        "Selected"
                    }
                />
            )}
        </>
    );
}