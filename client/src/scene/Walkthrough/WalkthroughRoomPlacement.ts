import { Vector3 } from "three";
import {
    pointInPolygon,
    polygonArea,
    type Region
} from "../../engine/regions/Polygon.ts";

export const WALKTHROUGH_GLB_SCALE = 0.7;
export const WALKTHROUGH_ROOM_LIGHT_MULTIPLIER = 1.5;

export function shouldShowWalkthroughCornerLights(
    walkthroughMode: boolean,
    spawnConfirmed: boolean
): boolean {
    return walkthroughMode && spawnConfirmed;
}

export interface RoomCornerPlacement {
    roomId: string;
    cornerIndex: number;
    position: { x: number; z: number };
}

const CORNER_INSET = 0.32;
const ROOM_BOUNDARY_PRECISION = 10000;
const PLACEMENT_PRECISION = 1000;

function pointKey(point: Vector3): string {
    return `${Math.round(point.x * ROOM_BOUNDARY_PRECISION)},${Math.round(point.z * ROOM_BOUNDARY_PRECISION)}`;
}

function canonicalRingKey(corners: Vector3[]): string {
    const points = corners.map(pointKey);
    if (points.length === 0) return "";

    const rotations = (sequence: string[]) =>
        sequence.map((_, index) =>
            [...sequence.slice(index), ...sequence.slice(0, index)].join(";")
        );
    const forward = rotations(points);
    const backward = rotations([...points].reverse());

    return [...forward, ...backward].sort()[0];
}

function roomBoundaryKey(region: Region): string {
    return region.boundaryLoops
        .map(loop => canonicalRingKey(loop.corners))
        .sort()
        .join("|");
}

export function getUniqueRoomRegions(regions: Region[]): Region[] {
    const seen = new Set<string>();

    return regions.filter(region => {
        const key = roomBoundaryKey(region);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function isInsideRoom(
    point: Vector3,
    region: Region
): boolean {
    const outer = region.boundaryLoops[0]?.corners ?? region.corners;
    return pointInPolygon(point, outer) &&
        !region.boundaryLoops.slice(1).some(loop =>
            pointInPolygon(point, loop.corners)
        );
}

function getInsetPosition(
    region: Region,
    cornerIndex: number
): { x: number; z: number } | null {
    const corners = region.boundaryLoops[0]?.corners ?? region.corners;
    const count = corners.length;
    const previous = corners[(cornerIndex + count - 1) % count];
    const current = corners[cornerIndex];
    const next = corners[(cornerIndex + 1) % count];
    const incoming = new Vector3(
        current.x - previous.x,
        0,
        current.z - previous.z
    );
    const outgoing = new Vector3(
        next.x - current.x,
        0,
        next.z - current.z
    );
    const shortestEdge = Math.min(incoming.length(), outgoing.length());

    if (shortestEdge <= 0.0001) return null;

    incoming.normalize();
    outgoing.normalize();

    const winding = Math.sign(polygonArea(corners)) || 1;
    const incomingNormal = new Vector3(
        -incoming.z * winding,
        0,
        incoming.x * winding
    );
    const outgoingNormal = new Vector3(
        -outgoing.z * winding,
        0,
        outgoing.x * winding
    );
    const directions = [
        incomingNormal.clone().add(outgoingNormal).normalize(),
        incomingNormal,
        outgoingNormal
    ];
    const inset = Math.min(CORNER_INSET, shortestEdge * 0.35);

    for (const direction of directions) {
        for (const distance of [inset, inset * 0.75, inset * 0.5]) {
            const candidate = new Vector3(
                current.x + direction.x * distance,
                current.y,
                current.z + direction.z * distance
            );
            if (isInsideRoom(candidate, region)) {
                return { x: candidate.x, z: candidate.z };
            }
        }
    }

    return null;
}

export function getRoomCornerPlacements(
    regions: Region[]
): RoomCornerPlacement[] {
    const placements: RoomCornerPlacement[] = [];
    const seenPositions = new Set<string>();

    for (const region of getUniqueRoomRegions(regions)) {
        const corners = region.boundaryLoops[0]?.corners ?? region.corners;
        for (let cornerIndex = 0; cornerIndex < corners.length; cornerIndex++) {
            const position = getInsetPosition(region, cornerIndex);
            if (!position) continue;

            const positionKey =
                `${Math.round(position.x * PLACEMENT_PRECISION)},${Math.round(position.z * PLACEMENT_PRECISION)}`;
            if (seenPositions.has(positionKey)) continue;
            seenPositions.add(positionKey);

            placements.push({
                roomId: region.id,
                cornerIndex,
                position
            });
        }
    }

    return placements;
}
