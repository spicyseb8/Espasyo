import {
    calculateStaircaseDimensionsForFootprint,
    getStaircaseFootprintRun,
    getStaircaseFootprint,
    validateStaircaseDimensions
} from "../../../../shared/staircaseGeometry.ts";
import type {
    ManagedEditorFloor,
    ManagedStructure,
    StructureStaircase,
    StructureStaircaseLanding,
    StructureWall
} from "./structureTypes";
import { getFloorName } from "./structureTypes.ts";

export type StaircasePlacementAction = "place" | "move" | "duplicate";

export interface StaircaseCandidate {
    position: { x: number; y: number; z: number };
    rotationY: number;
}

export type StaircaseDrawingPhase =
    | "idle"
    | "selecting-start"
    | "sizing-footprint"
    | "configuring"
    | "confirmed"
    | "cancelled";

export function resolveStaircaseDestinationFloorId(
    floors: Array<Pick<ManagedEditorFloor, "floorId">>,
    activeFloorId: string | null
): string {
    const activeIndex = floors.findIndex(floor => floor.floorId === activeFloorId);
    return activeIndex >= 0 ? floors[activeIndex + 1]?.floorId ?? "" : "";
}

export interface StaircaseFootprintPreview {
    candidate: StaircaseCandidate;
    dimensions: ReturnType<typeof calculateStaircaseDimensionsForFootprint>;
    length: number;
    width: number;
}

export interface StaircasePlacementValidationInput {
    candidate: StaircaseCandidate;
    dimensions: Pick<
        StructureStaircase,
        "width" | "totalRise" | "riserCount" | "treadDepth" | "treadThickness" | "shape" | "turnDirection"
    >;
    activeFloorId: string;
    destinationFloorId: string;
    floors: Array<Pick<ManagedEditorFloor, "floorId">>;
    sourceStructure: ManagedStructure;
    sourceRegions: StaircaseFloorRegion[];
    destinationFloor: ManagedEditorFloor | undefined;
    destinationRegions: StaircaseFloorRegion[];
    pointerValid: boolean;
    regionId?: string | null;
    excludedStairId?: string;
}

export function validateStaircasePlacement(
    input: StaircasePlacementValidationInput
): string | null {
    if (!input.pointerValid) {
        return "Point to an actual room floor to position the staircase.";
    }
    if (
        input.regionId &&
        !input.sourceRegions.some(region => region.id === input.regionId)
    ) {
        return "The selected room is no longer available.";
    }
    if (!input.destinationFloorId || !input.destinationFloor) {
        const activeIndex = input.floors.findIndex(floor => floor.floorId === input.activeFloorId);
        return `Create the ${getFloorName(activeIndex + 1)} before placing stairs.`;
    }
    if (
        input.destinationFloorId !==
        resolveStaircaseDestinationFloorId(input.floors, input.activeFloorId)
    ) {
        return "Stairs must connect to the immediately following floor.";
    }
    const sourceError = validateStaircaseFootprint({
        ...input.candidate,
        ...input.dimensions
    }, input.sourceStructure.walls, input.sourceRegions, input.excludedStairId, input.sourceStructure.stairs);
    if (sourceError) return sourceError;

    if (input.destinationRegions.length === 0) {
        return "The destination floor needs an enclosed room for the arrival marker. Draw a room there or create another floor.";
    }
    const destinationError = validateStaircaseFootprint({
        ...input.candidate,
        ...input.dimensions
    }, input.destinationFloor.structure.walls,
    input.destinationRegions,
    input.excludedStairId,
    input.destinationFloor.structure.stairs);
    return destinationError ? `Destination landing: ${destinationError}` : null;
}

export function createStaircaseFootprintPreview(
    first: { x: number; z: number },
    opposite: { x: number; z: number },
    totalRise = 2.8,
    preferredTreadDepth = 0.28,
    riserCount?: number
): StaircaseFootprintPreview {
    const deltaX = opposite.x - first.x;
    const deltaZ = opposite.z - first.z;
    const lengthX = Math.abs(deltaX);
    const lengthZ = Math.abs(deltaZ);
    const runAlongX = lengthX >= lengthZ;
    const run = runAlongX ? lengthX : lengthZ;
    const width = runAlongX ? lengthZ : lengthX;
    const centerX = (first.x + opposite.x) / 2;
    const centerZ = (first.z + opposite.z) / 2;
    let rotationY: number;
    let position: { x: number; y: number; z: number };
    if (runAlongX) {
        rotationY = deltaX >= 0 ? 0 : Math.PI;
        position = {
            x: deltaX >= 0 ? Math.min(first.x, opposite.x) : Math.max(first.x, opposite.x),
            y: 0,
            z: centerZ
        };
    } else {
        rotationY = deltaZ > 0 ? -Math.PI / 2 : Math.PI / 2;
        position = {
            x: centerX,
            y: 0,
            z: deltaZ > 0 ? Math.min(first.z, opposite.z) : Math.max(first.z, opposite.z)
        };
    }

    return {
        candidate: { position, rotationY },
        dimensions: calculateStaircaseDimensionsForFootprint(
            run,
            width,
            totalRise,
            preferredTreadDepth,
            0.175,
            riserCount
        ),
        length: run,
        width
    };
}

export interface StaircaseFloorRegion {
    id?: string;
    corners: Array<{ x: number; z: number }>;
    boundaryLoops?: Array<{ corners: Array<{ x: number; z: number }> }>;
}

function isPointInPolygon(point: { x: number; z: number }, polygon: Array<{ x: number; z: number }>): boolean {
    const epsilon = 1e-8;
    for (let index = 0; index < polygon.length; index += 1) {
        const start = polygon[index];
        const end = polygon[(index + 1) % polygon.length];
        const cross = (point.x - start.x) * (end.z - start.z)
            - (point.z - start.z) * (end.x - start.x);
        if (
            Math.abs(cross) <= epsilon &&
            point.x >= Math.min(start.x, end.x) - epsilon &&
            point.x <= Math.max(start.x, end.x) + epsilon &&
            point.z >= Math.min(start.z, end.z) - epsilon &&
            point.z <= Math.max(start.z, end.z) + epsilon
        ) return true;
    }

    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
        const currentPoint = polygon[index];
        const previousPoint = polygon[previous];
        const crosses = (currentPoint.z > point.z) !== (previousPoint.z > point.z)
            && point.x < (previousPoint.x - currentPoint.x) *
                (point.z - currentPoint.z) / (previousPoint.z - currentPoint.z) + currentPoint.x;
        if (crosses) inside = !inside;
    }
    return inside;
}

function isPointStrictlyInsidePolygon(
    point: { x: number; z: number },
    polygon: Array<{ x: number; z: number }>,
    tolerance = 1e-7
): boolean {
    for (let index = 0; index < polygon.length; index += 1) {
        const start = polygon[index];
        const end = polygon[(index + 1) % polygon.length];
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const lengthSquared = dx * dx + dz * dz;
        if (lengthSquared === 0) continue;
        const projection = Math.max(0, Math.min(1,
            ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared
        ));
        const distance = Math.hypot(
            point.x - (start.x + projection * dx),
            point.z - (start.z + projection * dz)
        );
        if (distance <= tolerance) return false;
    }
    return isPointInPolygon(point, polygon);
}

function segmentsProperlyIntersect(
    firstStart: { x: number; z: number },
    firstEnd: { x: number; z: number },
    secondStart: { x: number; z: number },
    secondEnd: { x: number; z: number }
): boolean {
    const epsilon = 1e-8;
    const firstA = orientation(firstStart, firstEnd, secondStart);
    const firstB = orientation(firstStart, firstEnd, secondEnd);
    const secondA = orientation(secondStart, secondEnd, firstStart);
    const secondB = orientation(secondStart, secondEnd, firstEnd);
    return firstA * firstB < -epsilon && secondA * secondB < -epsilon;
}

function orientation(
    first: { x: number; z: number },
    second: { x: number; z: number },
    third: { x: number; z: number }
): number {
    return (second.x - first.x) * (third.z - first.z)
        - (second.z - first.z) * (third.x - first.x);
}

function segmentsIntersect(
    firstStart: { x: number; z: number },
    firstEnd: { x: number; z: number },
    secondStart: { x: number; z: number },
    secondEnd: { x: number; z: number }
): boolean {
    const firstA = orientation(firstStart, firstEnd, secondStart);
    const firstB = orientation(firstStart, firstEnd, secondEnd);
    const secondA = orientation(secondStart, secondEnd, firstStart);
    const secondB = orientation(secondStart, secondEnd, firstEnd);
    const epsilon = 1e-8;
    const onSegment = (
        start: { x: number; z: number },
        point: { x: number; z: number },
        end: { x: number; z: number }
    ) => point.x >= Math.min(start.x, end.x) - epsilon
        && point.x <= Math.max(start.x, end.x) + epsilon
        && point.z >= Math.min(start.z, end.z) - epsilon
        && point.z <= Math.max(start.z, end.z) + epsilon;
    if (firstA * firstB < 0 && secondA * secondB < 0) return true;
    return Math.abs(firstA) <= epsilon && onSegment(firstStart, secondStart, firstEnd)
        || Math.abs(firstB) <= epsilon && onSegment(firstStart, secondEnd, firstEnd)
        || Math.abs(secondA) <= epsilon && onSegment(secondStart, firstStart, secondEnd)
        || Math.abs(secondB) <= epsilon && onSegment(secondStart, firstEnd, secondEnd);
}

export function validateStaircaseFootprint(
    staircase: Pick<StructureStaircase,
        "position" | "rotationY" | "width" | "totalRise" | "riserCount" | "treadDepth" | "shape" | "turnDirection">,
    walls: StructureWall[],
    regions: StaircaseFloorRegion[],
    excludedStairId?: string,
    otherStairs: StructureStaircase[] = []
): string | null {
    const dimensionError = validateStaircaseDimensions(staircase);
    if (dimensionError) return dimensionError;
    if (
        ![staircase.position.x, staircase.position.y, staircase.position.z, staircase.rotationY]
            .every(Number.isFinite)
    ) {
        return "Staircase position and rotation must be finite.";
    }
    const run = getStaircaseFootprintRun(staircase);
    const footprint = getStaircaseFootprint(
        staircase.position,
        staircase.width,
        run,
        staircase.rotationY
    );
    if (regions.length === 0) {
        return "Draw an enclosed room before placing a staircase.";
    }

    const footprintSamples = [
        ...footprint,
        ...footprint.map((point, index) => {
            const next = footprint[(index + 1) % footprint.length];
            return { x: (point.x + next.x) / 2, z: (point.z + next.z) / 2 };
        }),
        {
            x: footprint.reduce((sum, point) => sum + point.x, 0) / footprint.length,
            z: footprint.reduce((sum, point) => sum + point.z, 0) / footprint.length
        }
    ];
    const contained = regions.some(region => {
        const outer = region.boundaryLoops?.[0]?.corners ?? region.corners;
        const boundaries = region.boundaryLoops?.length
            ? region.boundaryLoops.map(loop => loop.corners)
            : [outer];
        if (
            !footprintSamples.every(point =>
                isPointInPolygon(point, outer) &&
                !boundaries.slice(1).some(hole => isPointInPolygon(point, hole))
            )
        ) return false;

        return !boundaries.some(boundary =>
            boundary.some((point, index) => {
                const next = boundary[(index + 1) % boundary.length];
                return footprint.some((corner, footprintIndex) =>
                    segmentsProperlyIntersect(
                        corner,
                        footprint[(footprintIndex + 1) % footprint.length],
                        point,
                        next
                    )
                );
            })
        );
    });
    if (!contained) {
        return "The complete staircase footprint must fit inside one room without crossing its boundaries.";
    }

    for (const wall of walls) {
        const start = { x: wall.start.position.x, z: wall.start.position.z };
        const end = { x: wall.end.position.x, z: wall.end.position.z };
        if (
            isPointStrictlyInsidePolygon(start, footprint) ||
            isPointStrictlyInsidePolygon(end, footprint) ||
            footprint.some((point, index) =>
                segmentsProperlyIntersect(
                    point,
                    footprint[(index + 1) % footprint.length],
                    start,
                    end
                )
            )
        ) {
            return "The staircase footprint overlaps a wall.";
        }
    }
    for (const other of otherStairs) {
        if (other.id === excludedStairId) continue;
        const otherFootprint = getStaircaseFootprint(
            other.position,
            other.width,
            getStaircaseFootprintRun(other),
            other.rotationY
        );
        if (
            footprint.some(point => isPointInPolygon(point, otherFootprint)) ||
            otherFootprint.some(point => isPointInPolygon(point, footprint)) ||
            footprint.some((point, index) =>
                segmentsIntersect(
                    point,
                    footprint[(index + 1) % footprint.length],
                    otherFootprint[0],
                    otherFootprint[1]
                ) ||
                segmentsIntersect(
                    point,
                    footprint[(index + 1) % footprint.length],
                    otherFootprint[1],
                    otherFootprint[2]
                ) ||
                segmentsIntersect(
                    point,
                    footprint[(index + 1) % footprint.length],
                    otherFootprint[2],
                    otherFootprint[3]
                ) ||
                segmentsIntersect(
                    point,
                    footprint[(index + 1) % footprint.length],
                    otherFootprint[3],
                    otherFootprint[0]
                )
            )
        ) {
            return "The staircase footprint overlaps another staircase.";
        }
    }
    return null;
}

function getIds(floors: ManagedEditorFloor[]): Set<string> {
    const ids = new Set<string>();
    for (const floor of floors) {
        const structure = floor.structure;
        const candidates: unknown[] = [
            ...structure.corners,
            ...structure.walls,
            ...structure.doors,
            ...structure.windows,
            ...structure.openings,
            ...structure.stairs,
            ...structure.stairLandings,
            ...structure.furniture
        ];
        for (const candidate of candidates) {
            if (
                typeof candidate === "object" &&
                candidate !== null &&
                "id" in candidate &&
                typeof candidate.id === "string"
            ) {
                ids.add(candidate.id);
            }
        }
    }
    return ids;
}

function updateFloor(
    floors: ManagedEditorFloor[],
    floorId: string,
    update: (structure: ManagedStructure) => ManagedStructure
): ManagedEditorFloor[] | null {
    if (!floors.some(floor => floor.floorId === floorId)) return null;
    return floors.map(floor =>
        floor.floorId === floorId
            ? { ...floor, structure: update(floor.structure) }
            : floor
    );
}

export function applyStaircasePlacement(
    floors: ManagedEditorFloor[],
    sourceFloorId: string,
    destinationFloorId: string,
    candidate: StaircaseCandidate,
    dimensions: Pick<StructureStaircase,
        "width" | "totalRise" | "riserCount" | "treadDepth" | "treadThickness" | "railings" | "shape" | "turnDirection">,
    action: StaircasePlacementAction,
    source: StructureStaircase | null,
    staircaseId: string,
    landingId: string,
    connectionId: string
): ManagedEditorFloor[] | null {
    const sourceFloor = floors.find(floor => floor.floorId === sourceFloorId);
    if (!sourceFloor || !floors.some(floor => floor.floorId === destinationFloorId)) return null;
    if (sourceFloorId === destinationFloorId) return null;
    if (
        ![candidate.position.x, candidate.position.y, candidate.position.z, candidate.rotationY]
            .every(Number.isFinite)
    ) {
        return null;
    }
    if (validateStaircaseDimensions(dimensions)) return null;

    if (action === "move" || action === "duplicate") {
        if (
            !source ||
            source.floorId !== sourceFloorId ||
            !sourceFloor.structure.stairs.some(stair => stair.id === source.id) ||
            source.destinationFloorId !== destinationFloorId
        ) {
            return null;
        }
    }

    const ids = getIds(floors);
    if (
        action !== "move" &&
        (!staircaseId || !landingId || !connectionId || ids.has(staircaseId) || ids.has(landingId))
    ) {
        return null;
    }
    const stairId = action === "move" && source ? source.id : staircaseId;
    const stairConnectionId = action === "move" && source ? source.stairConnectionId : connectionId;
    const nextStair: StructureStaircase = {
        ...(action === "move" && source ? source : {}),
        id: stairId,
        floorId: sourceFloorId,
        destinationFloorId,
        stairConnectionId,
        position: candidate.position,
        rotationY: candidate.rotationY,
        ...dimensions,
        treadThickness: dimensions.treadThickness ?? 0.04,
        railings: dimensions.railings ?? true,
        shape: dimensions.shape ?? (action === "move" && source ? source.shape : "straight"),
        turnDirection: dimensions.turnDirection ?? (action === "move" && source ? source.turnDirection : undefined)
    };
    let nextFloors = updateFloor(floors, sourceFloorId, structure => ({
        ...structure,
        stairs: action === "move"
            ? structure.stairs.map(stair => stair.id === stairId ? nextStair : stair)
            : [...structure.stairs, nextStair]
    }));
    if (!nextFloors) return null;

    const run = getStaircaseFootprintRun(nextStair);
    if (action === "move") {
        nextFloors = updateFloor(nextFloors, destinationFloorId, structure => ({
            ...structure,
            stairLandings: structure.stairLandings.map(landing =>
                landing.stairConnectionId === stairConnectionId
                    ? {
                        ...landing,
                        position: { ...candidate.position, y: 0 },
                        rotationY: candidate.rotationY,
                        width: dimensions.width,
                        run
                    }
                    : landing
            )
        }));
    } else {
        const landing: StructureStaircaseLanding = {
            id: landingId,
            stairId,
            stairConnectionId,
            floorId: destinationFloorId,
            position: { ...candidate.position, y: 0 },
            rotationY: candidate.rotationY,
            width: dimensions.width,
            run
        };
        nextFloors = updateFloor(nextFloors, destinationFloorId, structure => ({
            ...structure,
            stairLandings: [...structure.stairLandings, landing]
        }));
    }
    return nextFloors;
}

export function moveStaircaseLanding(
    floors: ManagedEditorFloor[],
    landing: StructureStaircaseLanding,
    candidate: StaircaseCandidate
): ManagedEditorFloor[] | null {
    const destination = floors.find(floor => floor.floorId === landing.floorId);
    if (!destination || !destination.structure.stairLandings.some(item => item.id === landing.id)) {
        return null;
    }
    return updateFloor(floors, landing.floorId, structure => ({
        ...structure,
        stairLandings: structure.stairLandings.map(item =>
            item.id === landing.id
                ? { ...item, position: { ...candidate.position, y: 0 }, rotationY: candidate.rotationY }
                : item
        )
    }));
}

export function removeStaircase(
    floors: ManagedEditorFloor[],
    sourceFloorId: string,
    staircaseId: string
): ManagedEditorFloor[] | null {
    const source = floors.find(floor => floor.floorId === sourceFloorId);
    const stair = source?.structure.stairs.find(item => item.id === staircaseId);
    if (!source || !stair) return null;
    return floors.map(floor => {
        if (floor.floorId === sourceFloorId) {
            return {
                ...floor,
                structure: {
                    ...floor.structure,
                    stairs: floor.structure.stairs.filter(item => item.id !== staircaseId)
                }
            };
        }
        if (floor.floorId === stair.destinationFloorId) {
            return {
                ...floor,
                structure: {
                    ...floor.structure,
                    stairLandings: floor.structure.stairLandings.filter(item =>
                        item.stairConnectionId !== stair.stairConnectionId
                    )
                }
            };
        }
        return floor;
    });
}

export function updateStaircaseDimensions(
    structure: ManagedStructure,
    source: StructureStaircase,
    dimensions: Pick<StructureStaircase, "width" | "totalRise" | "riserCount" | "treadDepth" | "shape" | "turnDirection">
        & Pick<StructureStaircase, "treadThickness" | "railings">
): ManagedStructure | null {
    if (
        !structure.stairs.some(stair => stair.id === source.id) ||
        validateStaircaseDimensions(dimensions)
    ) {
        return null;
    }
    const updated = { ...source, ...dimensions };
    if (validateStaircaseFootprint(updated, structure.walls, [])) return null;
    const run = getStaircaseFootprintRun(dimensions);
    return {
        ...structure,
        stairs: structure.stairs.map(stair => stair.id === source.id ? updated : stair),
        stairLandings: structure.stairLandings.map(landing =>
            landing.stairConnectionId === source.stairConnectionId
                ? { ...landing, width: dimensions.width, run }
                : landing
        )
    };
}
