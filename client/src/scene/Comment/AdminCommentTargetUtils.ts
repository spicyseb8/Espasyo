import {
    Vector3
} from "three";
import type {
    EditorState
} from "../../context/editor/types";
import type {
    AdminComment
} from "../../services/adminCommentService";
import {
    solveRegions
} from "../../engine/regions/RegionSolver";

export function getAdminCommentTargetPoint(
    state: EditorState,
    comment: AdminComment
): Vector3 | null {
    if (
        comment.targetType !==
        "project" &&
        !comment.targetId
    ) {
        return null;
    }

    if (
        comment.targetType ===
        "project"
    ) {
        const corners =
            state.corners;

        if (
            corners.length ===
            0
        ) {
            return new Vector3(
                0,
                state.wallHeight *
                    0.5,
                0
            );
        }

        const center =
            corners.reduce(
                (
                    total,
                    corner
                ) => {
                    total.x +=
                        corner.position.x;
                    total.y +=
                        corner.position.y;
                    total.z +=
                        corner.position.z;

                    return total;
                },
                new Vector3()
            );

        center.divideScalar(
            corners.length
        );

        center.y =
            state.wallHeight *
            0.5;

        return center;
    }

    if (
        comment.targetType ===
        "wall"
    ) {
        const wall =
            state.walls.find(
                item =>
                    item.id ===
                    comment.targetId
            );

        if (!wall) {
            return null;
        }

        return new Vector3(
            (
                wall.start.position.x +
                wall.end.position.x
            ) *
                0.5,
            state.wallHeight *
                0.6,
            (
                wall.start.position.z +
                wall.end.position.z
            ) *
                0.5
        );
    }

    if (
        comment.targetType ===
        "floor"
    ) {
        const regions =
            solveRegions(
                state.corners,
                state.walls
            );

        const region =
            regions.find(
                item =>
                    item.id ===
                    comment.targetId
            );

        if (!region) {
            return null;
        }

        const corners =
            region.corners ??
            [];

        if (
            corners.length ===
            0
        ) {
            return null;
        }

        const center =
            corners.reduce(
                (
                    total,
                    point
                ) =>
                    total.add(
                        point
                    ),
                new Vector3()
            );

        center.divideScalar(
            corners.length
        );

        center.y +=
            0.08;

        return center;
    }

    if (
        comment.targetType ===
        "furniture"
    ) {
        const furniture =
            state.furniture.find(
                item =>
                    item.id ===
                    comment.targetId
            );

        if (!furniture) {
            return null;
        }

        return new Vector3(
            furniture.position.x,
            furniture.position.y +
                furniture.height +
                0.25,
            furniture.position.z
        );
    }

    if (
        comment.targetType ===
        "door"
    ) {
        const door =
            state.doors.find(
                item =>
                    item.id ===
                    comment.targetId
            );

        if (!door) {
            return null;
        }

        return new Vector3(
            door.position.x,
            door.position.y +
                door.height +
                0.15,
            door.position.z
        );
    }

    if (
        comment.targetType ===
        "window"
    ) {
        const window =
            state.windows.find(
                item =>
                    item.id ===
                    comment.targetId
            );

        if (!window) {
            return null;
        }

        return new Vector3(
            window.position.x,
            window.position.y +
                window.height *
                    0.5,
            window.position.z
        );
    }

    if (
        comment.targetType ===
        "opening"
    ) {
        const opening =
            state.openings.find(
                item =>
                    item.id ===
                    comment.targetId
            );

        if (!opening) {
            return null;
        }

        return new Vector3(
            opening.position.x,
            opening.position.y +
                opening.height +
                0.15,
            opening.position.z
        );
    }

    return null;
}