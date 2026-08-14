import type { Wall } from "./WallTypes";
import type { Corner } from "./Corner";
import { Vector3 } from "three";

import { solveRegions } from "../regions/RegionSolver";

export interface MeasurementGroup {
    id: string;
    start: Vector3;
    end: Vector3;
    length: number;
    area?: number;
    center: Vector3;
    walls: Wall[];
}

function getWallDirection(wall: Wall): Vector3 {
    return new Vector3(
        wall.end.position.x - wall.start.position.x,
        0,
        wall.end.position.z - wall.start.position.z
    ).normalize();
}

function isCollinear(dir1: Vector3, dir2: Vector3, tolerance = 0.01): boolean {
    const cross = new Vector3().crossVectors(dir1, dir2);
    return cross.length() < tolerance;
}

function calculateMeasurementData(start: Corner, end: Corner): {
    length: number;
    center: Vector3;
    direction: Vector3;
    perpendicular: Vector3;
} {
    const length = start.position.distanceTo(end.position);
    const direction = end.position.clone().sub(start.position).normalize();
    const perpendicular = new Vector3(-direction.z, 0, direction.x);
    const center = start.position.clone().add(end.position).multiplyScalar(0.5);

    return { length, center, direction, perpendicular };
}

export function buildWallMeasurementGroups(walls: Wall[], wallHeight = 3): MeasurementGroup[] {
    const groups: MeasurementGroup[] = [];
    const processedWalls = new Set<string>();
    const cornerDegree = new Map<string, number>();

    for (const wall of walls) {
        cornerDegree.set(wall.start.id, (cornerDegree.get(wall.start.id) ?? 0) + 1);
        cornerDegree.set(wall.end.id, (cornerDegree.get(wall.end.id) ?? 0) + 1);
    }

    for (const wall of walls) {
        if (processedWalls.has(wall.id)) continue;

        let groupStart = wall.start;
        let groupEnd = wall.end;
        const groupWalls: Wall[] = [wall];
        let groupLength = wall.start.position.distanceTo(wall.end.position);

        processedWalls.add(wall.id);
        const groupDirection = getWallDirection(wall);

        let extended = true;
        while (extended) {
            extended = false;

            for (const otherWall of walls) {
                if (processedWalls.has(otherWall.id)) continue;

                const otherDirection = getWallDirection(otherWall);

                if (
                    groupEnd.id === otherWall.start.id &&
                    cornerDegree.get(groupEnd.id) === 2 &&
                    isCollinear(groupDirection, otherDirection)
                ) {
                    groupEnd = otherWall.end;
                    groupWalls.push(otherWall);
                    processedWalls.add(otherWall.id);
                    groupLength += otherWall.start.position.distanceTo(otherWall.end.position);
                    extended = true;
                    break;
                }

                if (
                    groupEnd.id === otherWall.end.id &&
                    cornerDegree.get(groupEnd.id) === 2 &&
                    isCollinear(groupDirection, otherDirection)
                ) {
                    groupEnd = otherWall.start;
                    groupWalls.push(otherWall);
                    processedWalls.add(otherWall.id);
                    groupLength += otherWall.start.position.distanceTo(otherWall.end.position);
                    extended = true;
                    break;
                }

                if (
                    groupStart.id === otherWall.end.id &&
                    cornerDegree.get(groupStart.id) === 2 &&
                    isCollinear(groupDirection, otherDirection)
                ) {
                    groupStart = otherWall.start;
                    groupWalls.unshift(otherWall);
                    processedWalls.add(otherWall.id);
                    groupLength += otherWall.start.position.distanceTo(otherWall.end.position);
                    extended = true;
                    break;
                }

                if (
                    groupStart.id === otherWall.start.id &&
                    cornerDegree.get(groupStart.id) === 2 &&
                    isCollinear(groupDirection, otherDirection)
                ) {
                    groupStart = otherWall.end;
                    groupWalls.unshift(otherWall);
                    processedWalls.add(otherWall.id);
                    groupLength += otherWall.start.position.distanceTo(otherWall.end.position);
                    extended = true;
                    break;
                }
            }
        }

        const measurementData = calculateMeasurementData(groupStart, groupEnd);

        groups.push({
            id: `${groupStart.id}-${groupEnd.id}`,
            start: measurementData.center.clone(),
            end: measurementData.center.clone(),
            length: groupLength,
            area: groupLength * wallHeight,
            center: measurementData.center,
            walls: groupWalls,
        });
    }

    return groups;
}

export function buildRegionMeasurements(
    corners: Corner[],
    walls: Wall[]
): MeasurementGroup[] {
    return solveRegions(corners, walls)
        .filter(region => region.corners.length >= 3 && region.area > 0.01)
        .map(region => {
            const center = getPolygonCenter(region.corners);
            const start = region.corners[0]?.clone() ?? center.clone();
            const end = region.corners[1]?.clone() ?? center.clone();

            return {
                id: region.id,
                start,
                end,
                length: region.perimeter,
                center,
                walls: region.walls,
            };
        });
}

function getPolygonCenter(points: Vector3[]): Vector3 {
    if (points.length === 0) {
        return new Vector3();
    }

    const total = points.reduce(
        (acc, point) => {
            acc.x += point.x;
            acc.z += point.z;
            return acc;
        },
        { x: 0, z: 0 }
    );

    return new Vector3(
        total.x / points.length,
        0,
        total.z / points.length
    );
}

export function buildMeasurementGroups(
    walls: Wall[],
    wallHeight = 3
): MeasurementGroup[] {
    return buildWallMeasurementGroups(walls, wallHeight);
}