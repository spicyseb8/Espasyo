import { Vector3 } from "three";

import type { Wall } from "../../engine/walls/WallTypes";
import type { Furniture } from "../../engine/furniture/FurnitureTypes";
import type { FurnitureSnapTarget } from "../../assets/Asset";

import type { AssetBounds } from "../Build/AssetBounds";
import type { FurniturePlacement } from "./FurniturePlacement";

export const FURNITURE_SNAP_DISTANCE = 0.20;

export const FURNITURE_WALL_SNAP_GAP = 0.03;

export const FURNITURE_FURNITURE_SNAP_GAP = 0.01;

export const FURNITURE_WALL_MOUNT_GAP = 0.02;

//==================================================
// Axis
//==================================================

interface Axis2D {
    x: number;
    z: number;
}

//==================================================
// Snap candidate
//==================================================

interface SnapCandidate {
    position: Vector3;
    distance: number;
}

//==================================================
// Get local X axis
//==================================================

function getXAxis(
    rotationY: number
): Axis2D {
    return {
        x: Math.cos(rotationY),
        z: Math.sin(rotationY)
    };
}

//==================================================
// Get local Z axis
//==================================================

function getZAxis(
    rotationY: number
): Axis2D {
    return {
        x: -Math.sin(rotationY),
        z: Math.cos(rotationY)
    };
}

//==================================================
// Dot product
//==================================================

function dot(
    a: Axis2D,
    b: Axis2D
): number {
    return (
        a.x * b.x +
        a.z * b.z
    );
}

//==================================================
// Add offset
//==================================================

function offset(
    point: Vector3,
    axis: Axis2D,
    amount: number,
    y = 0
): Vector3 {
    return new Vector3(
        point.x + axis.x * amount,
        y,
        point.z + axis.z * amount
    );
}

//==================================================
// Distance X/Z
//==================================================

function distanceXZ(
    a: Vector3,
    b: Vector3
): number {
    const dx =
        a.x - b.x;

    const dz =
        a.z - b.z;

    return Math.sqrt(
        dx * dx +
        dz * dz
    );
}

//==================================================
// Furniture extent along an axis
//==================================================

function getFurnitureExtent(
    width: number,
    depth: number,
    rotationY: number,
    axis: Axis2D
): number {
    const localX =
        getXAxis(rotationY);

    const localZ =
        getZAxis(rotationY);

    return (
        width * 0.5 *
        Math.abs(
            dot(
                localX,
                axis
            )
        ) +

        depth * 0.5 *
        Math.abs(
            dot(
                localZ,
                axis
            )
        )
    );
}

//==================================================
// WALL CONNECTION HELPERS
//==================================================

function wallsShareCorner(
    a: Wall,
    b: Wall
): boolean {
    return (
        a.start.id === b.start.id ||
        a.start.id === b.end.id ||
        a.end.id === b.start.id ||
        a.end.id === b.end.id
    );
}

//==================================================
// Get connected wall component
//==================================================

function getConnectedWalls(
    source: Wall,
    walls: Wall[]
): Wall[] {
    const result: Wall[] = [];

    const visited =
        new Set<string>();

    const queue: Wall[] = [
        source
    ];

    while (
        queue.length > 0
    ) {
        const current =
            queue.shift();

        if (!current) {
            continue;
        }

        if (
            visited.has(
                current.id
            )
        ) {
            continue;
        }

        visited.add(
            current.id
        );

        result.push(
            current
        );

        for (
            const candidate of walls
        ) {
            if (
                visited.has(
                    candidate.id
                )
            ) {
                continue;
            }

            if (
                wallsShareCorner(
                    current,
                    candidate
                )
            ) {
                queue.push(
                    candidate
                );
            }
        }
    }

    return result;
}

//==================================================
// Get room reference point
//==================================================

function getRoomReferencePoint(
    sourceWall: Wall,
    walls: Wall[]
): Vector3 | null {
    const connectedWalls =
        getConnectedWalls(
            sourceWall,
            walls
        );

    if (
        connectedWalls.length === 0
    ) {
        return null;
    }

    const uniqueCorners =
        new Map<
            string,
            Vector3
        >();

    for (
        const wall of connectedWalls
    ) {
        uniqueCorners.set(
            wall.start.id,
            wall.start.position
        );

        uniqueCorners.set(
            wall.end.id,
            wall.end.position
        );
    }

    if (
        uniqueCorners.size === 0
    ) {
        return null;
    }

    const center =
        new Vector3();

    for (
        const position of
        uniqueCorners.values()
    ) {
        center.x +=
            position.x;

        center.z +=
            position.z;
    }

    center.x /=
        uniqueCorners.size;

    center.z /=
        uniqueCorners.size;

    center.y = 0;

    return center;
}

//==================================================
// WALL FRAME
//==================================================

export function getWallFrame(
    wall: Wall,
    walls: Wall[]
): {
    tangent: Axis2D;
    interiorNormal: Axis2D;
    wallLength: number;
} | null {
    const start =
        wall.start.position;

    const end =
        wall.end.position;

    const dx =
        end.x - start.x;

    const dz =
        end.z - start.z;

    const wallLength =
        Math.sqrt(
            dx * dx +
            dz * dz
        );

    if (
        wallLength <= 0.001
    ) {
        return null;
    }

    const tangent: Axis2D = {
        x:
            dx / wallLength,

        z:
            dz / wallLength
    };

    const leftNormal: Axis2D = {
        x:
            -tangent.z,

        z:
            tangent.x
    };

    const roomCenter =
        getRoomReferencePoint(
            wall,
            walls
        );

    let interiorNormal =
        leftNormal;

    if (
        roomCenter
    ) {
        const wallCenterX =
            (
                start.x +
                end.x
            ) * 0.5;

        const wallCenterZ =
            (
                start.z +
                end.z
            ) * 0.5;

        const wallToCenterX =
            roomCenter.x -
            wallCenterX;

        const wallToCenterZ =
            roomCenter.z -
            wallCenterZ;

        const sideValue =
            wallToCenterX *
                leftNormal.x +

            wallToCenterZ *
                leftNormal.z;

        if (
            sideValue < 0
        ) {
            interiorNormal = {
                x:
                    -leftNormal.x,

                z:
                    -leftNormal.z
            };
        }
    }

    return {
        tangent,
        interiorNormal,
        wallLength
    };
}

//==================================================
// Closest point on wall
//==================================================

function getClosestPointOnWall(
    point: Vector3,
    start: Vector3,
    end: Vector3
): Vector3 {
    const dx =
        end.x -
        start.x;

    const dz =
        end.z -
        start.z;

    const lengthSquared =
        dx * dx +
        dz * dz;

    if (
        lengthSquared <=
        0.000001
    ) {
        return start.clone();
    }

    let t =
        (
            (
                point.x -
                start.x
            ) * dx +

            (
                point.z -
                start.z
            ) * dz
        ) /
        lengthSquared;

    t =
        Math.max(
            0,
            Math.min(
                1,
                t
            )
        );

    return new Vector3(
        start.x +
            dx * t,

        0,

        start.z +
            dz * t
    );
}

//==================================================
// WALL SNAP
//==================================================

function getWallSnapCandidate(
    floorPoint: Vector3,
    bounds: AssetBounds,
    rotationY: number,
    wall: Wall,
    walls: Wall[],
    wallThickness: number
): SnapCandidate | null {
    const start =
        wall.start.position;

    const end =
        wall.end.position;

    const frame =
        getWallFrame(
            wall,
            walls
        );

    if (!frame) {
        return null;
    }

    const {
        tangent,
        interiorNormal,
        wallLength
    } = frame;

    const closest =
        getClosestPointOnWall(
            floorPoint,
            start,
            end
        );

    const normalExtent =
        getFurnitureExtent(
            bounds.width,
            bounds.depth,
            rotationY,
            interiorNormal
        );

    const tangentExtent =
        getFurnitureExtent(
            bounds.width,
            bounds.depth,
            rotationY,
            tangent
        );

    const relativeX =
        closest.x -
        start.x;

    const relativeZ =
        closest.z -
        start.z;

    let alongWall =
        relativeX *
            tangent.x +

        relativeZ *
            tangent.z;

    if (
        wallLength <
        tangentExtent * 2
    ) {
        return null;
    }

    alongWall =
        Math.max(
            tangentExtent,
            Math.min(
                wallLength -
                    tangentExtent,
                alongWall
            )
        );

    const wallPoint =
        offset(
            start,
            tangent,
            alongWall
        );

    const targetPosition =
        offset(
            wallPoint,
            interiorNormal,
            wallThickness * 0.5 +
            normalExtent +
            FURNITURE_WALL_SNAP_GAP,
            0
        );

    const distance =
        distanceXZ(
            floorPoint,
            targetPosition
        );

    if (
        distance >
        FURNITURE_SNAP_DISTANCE
    ) {
        return null;
    }

    return {
        position:
            targetPosition,

        distance
    };
}

//==================================================
// FURNITURE SNAP
//==================================================

function getFurnitureSnapCandidate(
    floorPoint: Vector3,
    bounds: AssetBounds,
    rotationY: number,
    existing: Furniture
): SnapCandidate | null {
    /*
     * Only horizontal/floor furniture is used
     * as a floor snapping reference.
     *
     * This prevents wall-mounted or elevated
     * furniture from interfering with floor snapping.
     */
    if (
        Math.abs(
            existing.position.y
        ) > 0.02
    ) {
        return null;
    }

    let dx =
        floorPoint.x -
        existing.position.x;

    let dz =
        floorPoint.z -
        existing.position.z;

    let length =
        Math.sqrt(
            dx * dx +
            dz * dz
        );

    if (
        length < 0.0001
    ) {
        const axis =
            getXAxis(
                rotationY
            );

        dx =
            axis.x;

        dz =
            axis.z;

        length = 1;
    }

    dx /=
        length;

    dz /=
        length;

    const direction: Axis2D = {
        x:
            dx,

        z:
            dz
    };

    const existingExtent =
        getFurnitureExtent(
            existing.width,
            existing.depth,
            existing.rotationY,
            direction
        );

    const oppositeDirection: Axis2D = {
        x:
            -direction.x,

        z:
            -direction.z
    };

    const previewExtent =
        getFurnitureExtent(
            bounds.width,
            bounds.depth,
            rotationY,
            oppositeDirection
        );

    const separation =
        existingExtent +
        previewExtent +
        FURNITURE_FURNITURE_SNAP_GAP;

    const targetPosition =
        new Vector3(
            existing.position.x +
                direction.x *
                separation,

            0,

            existing.position.z +
                direction.z *
                separation
        );

    const distance =
        distanceXZ(
            floorPoint,
            targetPosition
        );

    if (
        distance >
        FURNITURE_SNAP_DISTANCE
    ) {
        return null;
    }

    return {
        position:
            targetPosition,

        distance
    };
}

//==================================================
// WALL MOUNT POSITION
//==================================================

export function buildWallMountPlacement(
    wallPoint: Vector3,
    bounds: AssetBounds,
    rotationY: number,
    wall: Wall,
    walls: Wall[],
    wallThickness: number
): Vector3 | null {
    const frame =
        getWallFrame(
            wall,
            walls
        );

    if (!frame) {
        return null;
    }

    const {
        tangent,
        interiorNormal
    } = frame;

    const normalExtent =
        getFurnitureExtent(
            bounds.width,
            bounds.depth,
            rotationY,
            interiorNormal
        );

    const mountedPosition =
        wallPoint.clone();

    /*
     * Move the furniture inward from the wall
     * so its footprint starts just inside the room.
     */
    mountedPosition.add(
        new Vector3(
            interiorNormal.x *
                (
                    wallThickness * 0.5 +
                    normalExtent +
                    FURNITURE_WALL_MOUNT_GAP
                ),

            0,

            interiorNormal.z *
                (
                    wallThickness * 0.5 +
                    normalExtent +
                    FURNITURE_WALL_MOUNT_GAP
                )
        )
    );

    /*
     * Keep the requested rotation.
     *
     * tangent is calculated here so the wall frame
     * remains the same whether the asset is rotated.
     */
    void tangent;

    return mountedPosition;
}

//==================================================
// MAIN SNAP
//==================================================

export function snapFurniturePlacement(
    floorPoint: Vector3,
    placement: FurniturePlacement,
    bounds: AssetBounds,
    walls: Wall[],
    furniture: Furniture[],
    wallThickness: number,
    snapTargets: FurnitureSnapTarget[] = [
        "wall",
        "furniture"
    ]
): FurniturePlacement {
    const candidates:
        SnapCandidate[] = [];

    //--------------------------------------------------
    // WALL SNAP
    //--------------------------------------------------

    if (
        snapTargets.includes(
            "wall"
        )
    ) {
        for (
            const wall of walls
        ) {
            const candidate =
                getWallSnapCandidate(
                    floorPoint,
                    bounds,
                    placement.rotationY,
                    wall,
                    walls,
                    wallThickness
                );

            if (candidate) {
                candidates.push(
                    candidate
                );
            }
        }
    }

    //--------------------------------------------------
    // FURNITURE SNAP
    //--------------------------------------------------

    if (
        snapTargets.includes(
            "furniture"
        )
    ) {
        for (
            const existing of furniture
        ) {
            const candidate =
                getFurnitureSnapCandidate(
                    floorPoint,
                    bounds,
                    placement.rotationY,
                    existing
                );

            if (candidate) {
                candidates.push(
                    candidate
                );
            }
        }
    }

    //--------------------------------------------------
    // No snap
    //--------------------------------------------------

    if (
        candidates.length === 0
    ) {
        return placement;
    }

    //--------------------------------------------------
    // Closest snap wins
    //--------------------------------------------------

    candidates.sort(
        (a, b) =>
            a.distance -
            b.distance
    );

    const best =
        candidates[0];

    //--------------------------------------------------
    // IMPORTANT
    //
    // Preserve the original Y.
    // Preserve the original rotation.
    //--------------------------------------------------

    return {
        ...placement,

        position:
            new Vector3(
                best.position.x,
                placement.position.y,
                best.position.z
            ),

        rotationY:
            placement.rotationY
    };
}