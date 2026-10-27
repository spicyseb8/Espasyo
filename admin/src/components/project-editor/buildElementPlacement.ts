import type { Asset } from "@/components/project-loader/engine/assets/Asset";
import type { ManagedStructure, StructureElement, StructureOpening, StructureWall } from "./structureTypes";
import { closestPointOnWall, type Point3 } from "./structureGeometry.ts";

export type BuildElementKind = "door" | "window" | "opening";

export interface BuildElementDimensions {
    width: number;
    height: number;
    depth: number;
}

export interface BuildElementPlacementCandidate extends BuildElementDimensions {
    kind: BuildElementKind;
    wallId: string;
    position: Point3;
    direction: { x: number; z: number };
    rotationY: number;
    wallRotationY: number;
    wallWidth: number;
    shape?: "rectangle" | "arch";
    archRise?: number;
    valid: boolean;
    reason: string;
}

interface BuildElementPlacementInput {
    structure: ManagedStructure;
    asset: Asset;
    point: Point3;
    placementWidth: number;
    placementHeight: number;
    placementDepth?: number;
    modelBounds?: Partial<BuildElementDimensions> | null;
    preferredWallId?: string | null;
    excludeElementId?: string | null;
}

function findTargetWall(
    walls: StructureWall[],
    point: Point3,
    preferredWallId: string | null | undefined,
    maxDistance: number
): { wall: StructureWall; point: Point3; distance: number } | null {
    const candidates = preferredWallId
        ? walls.filter(wall => wall.id === preferredWallId)
        : walls;
    let nearest: { wall: StructureWall; point: Point3; distance: number } | null = null;

    for (const wall of candidates) {
        const projected = closestPointOnWall(point, wall);
        const distance = Math.hypot(point.x - projected.x, point.z - projected.z);
        if (distance <= maxDistance && (!nearest || distance < nearest.distance)) {
            nearest = { wall, point: projected, distance };
        }
    }

    return nearest;
}

function projectedWidthOnWall(
    width: number,
    depth: number,
    modelRotationY: number,
    wallDirection: { x: number; z: number }
): number {
    const localXAxisDot = Math.cos(modelRotationY) * wallDirection.x
        - Math.sin(modelRotationY) * wallDirection.z;
    const localZAxisDot = Math.sin(modelRotationY) * wallDirection.x
        + Math.cos(modelRotationY) * wallDirection.z;

    return Math.max(
        width * Math.abs(localXAxisDot) + depth * Math.abs(localZAxisDot),
        0.001
    );
}

interface VerticalInterval {
    start: number;
    end: number;
}

function elementVerticalInterval(element: StructureElement | StructureOpening, kind: BuildElementKind): VerticalInterval {
    if (kind === "window") {
        return {
            start: element.position.y - element.height * 0.5,
            end: element.position.y + element.height * 0.5
        };
    }

    return { start: 0, end: element.height };
}

function intervalsOverlap(first: VerticalInterval, second: VerticalInterval): boolean {
    return first.start < second.end - 0.001 && second.start < first.end - 0.001;
}

function horizontalOverlap(
    firstCenter: number,
    firstWidth: number,
    secondCenter: number,
    secondWidth: number
): boolean {
    return Math.abs(firstCenter - secondCenter) < (firstWidth + secondWidth) * 0.5 - 0.001;
}

function offsetOnWall(point: Point3, wall: StructureWall, direction: { x: number; z: number }): number {
    return (point.x - wall.start.position.x) * direction.x
        + (point.z - wall.start.position.z) * direction.z;
}

function collides(
    structure: ManagedStructure,
    wall: StructureWall,
    candidate: BuildElementPlacementCandidate,
    excludeElementId?: string | null
): boolean {
    const startOffset = offsetOnWall(candidate.position, wall, candidate.direction);
    const currentVertical = candidate.kind === "window"
        ? { start: candidate.position.y - candidate.height * 0.5, end: candidate.position.y + candidate.height * 0.5 }
        : { start: 0, end: candidate.height };

    const existingElements: Array<{ element: StructureElement | StructureOpening; kind: BuildElementKind }> = [
        ...structure.doors.map(element => ({ element, kind: "door" as const })),
        ...structure.windows.map(element => ({ element, kind: "window" as const })),
        ...structure.openings.map(element => ({ element, kind: "opening" as const }))
    ];

    return existingElements.some(({ element, kind }) => {
        if (element.id === excludeElementId) return false;
        if (element.wallId !== wall.id) return false;
        const existingCenter = offsetOnWall(element.position, wall, candidate.direction);
        const existingWidth = "wallWidth" in element
            ? element.wallWidth ?? element.width
            : element.width;
        return horizontalOverlap(startOffset, candidate.wallWidth, existingCenter, existingWidth)
            && intervalsOverlap(currentVertical, elementVerticalInterval(element, kind));
    });
}

export function calculateBuildElementPlacement({
    structure,
    asset,
    point,
    placementWidth,
    placementHeight,
    placementDepth,
    modelBounds,
    preferredWallId,
    excludeElementId
}: BuildElementPlacementInput): BuildElementPlacementCandidate | null {
    if (asset.type !== "door" && asset.type !== "window" && asset.type !== "opening") return null;
    if (![point.x, point.y, point.z].every(Number.isFinite)) return null;

    const target = findTargetWall(
        structure.walls,
        point,
        preferredWallId,
        Math.max(0.6, structure.wallThickness * 2)
    );
    if (!target) return null;

    const wall = target.wall;
    const direction = {
        x: wall.end.position.x - wall.start.position.x,
        z: wall.end.position.z - wall.start.position.z
    };
    const length = Math.hypot(direction.x, direction.z);
    if (length <= 0.001) return null;
    direction.x /= length;
    direction.z /= length;

    const kind = asset.type;
    const isOpening = kind === "opening";
    const width = isOpening
        ? structure.openingWidth
        : placementWidth > 0
            ? placementWidth
            : asset.width ?? modelBounds?.width ?? 0;
    const height = isOpening
        ? structure.openingHeight
        : placementHeight > 0
            ? placementHeight
            : asset.height ?? modelBounds?.height ?? 0;
    const depth = isOpening
        ? structure.wallThickness
        : placementDepth ?? asset.depth ?? modelBounds?.depth ?? structure.wallThickness;

    if (![width, height, depth].every(value => Number.isFinite(value) && value > 0)) {
        return null;
    }

    const wallRotationY = -Math.atan2(direction.z, direction.x);
    const rotationY = isOpening
        ? Math.atan2(direction.z, direction.x)
        : Math.atan2(direction.x, direction.z);
    const assetRotationOffset = kind === "door"
        ? asset.rotationOffsetY ?? Math.PI / 2
        : asset.rotationOffsetY ?? 0;
    const wallWidth = isOpening
        ? width
        : projectedWidthOnWall(width, depth, rotationY + assetRotationOffset, direction);
    const fitsWall = wallWidth <= length + 0.001;
    const requestedOffset = offsetOnWall(target.point, wall, direction);
    const centerOffset = fitsWall
        ? Math.max(wallWidth * 0.5, Math.min(requestedOffset, length - wallWidth * 0.5))
        : length * 0.5;
    const position: Point3 = {
        x: wall.start.position.x + direction.x * centerOffset,
        y: kind === "window" ? point.y : 0,
        z: wall.start.position.z + direction.z * centerOffset
    };
    const candidate: BuildElementPlacementCandidate = {
        kind,
        wallId: wall.id,
        position,
        direction,
        rotationY,
        wallRotationY,
        width,
        height,
        depth,
        wallWidth,
        shape: isOpening ? asset.openingShape ?? "rectangle" : undefined,
        archRise: isOpening && asset.openingShape === "arch" ? structure.archRise : undefined,
        valid: true,
        reason: ""
    };

    if (!fitsWall) {
        candidate.valid = false;
        candidate.reason = "The selected wall is too short for this asset.";
        return candidate;
    }
    if (height > structure.wallHeight) {
        candidate.valid = false;
        candidate.reason = "The asset height cannot exceed the wall height.";
        return candidate;
    }
    if (
        kind === "window" &&
        (
            position.y - height * 0.5 < -0.001 ||
            position.y + height * 0.5 > structure.wallHeight + 0.001
        )
    ) {
        candidate.valid = false;
        candidate.reason = "The window must fit between the wall's bottom and top edges.";
        return candidate;
    }
    if (collides(structure, wall, candidate, excludeElementId)) {
        candidate.valid = false;
        candidate.reason = "This placement would overlap another opening on the wall.";
    }

    return candidate;
}