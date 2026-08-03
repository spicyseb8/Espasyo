import type { Wall } from "./WallTypes";
import type { Corner } from "./Corner";
import { Vector3 } from "three";

export interface MeasurementGroup {
    start: Corner;
    end: Corner;
    length: number;
    center: Vector3;
    direction: Vector3;
    perpendicular: Vector3;
    walls: Wall[];
}

function getWallDirection(wall: Wall): Vector3 {
    return new Vector3(
        wall.end.position.x - wall.start.position.x,
        0, // Ignore height differences for collinearity
        wall.end.position.z - wall.start.position.z
    ).normalize();
}

function isCollinear(dir1: Vector3, dir2: Vector3, tolerance = 0.01): boolean {
    // Check if directions are parallel (same or opposite)
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
    
    const direction = end.position
        .clone()
        .sub(start.position)
        .normalize();
    
    const perpendicular = new Vector3(
        -direction.z,
        0,
        direction.x
    );
    
    const center = start.position
        .clone()
        .add(end.position)
        .multiplyScalar(0.5);
    
    return {
        length,
        center,
        direction,
        perpendicular
    };
}

export function buildMeasurementGroups(
    walls: Wall[]
): MeasurementGroup[] {
    const groups: MeasurementGroup[] = [];
    const processedWalls = new Set<string>();

    // Build corner degree map: how many walls connect to each corner
    const cornerDegree = new Map<string, number>();
    for (const wall of walls) {
        cornerDegree.set(
            wall.start.id,
            (cornerDegree.get(wall.start.id) ?? 0) + 1
        );
        cornerDegree.set(
            wall.end.id,
            (cornerDegree.get(wall.end.id) ?? 0) + 1
        );
    }

    for (const wall of walls) {
        if (processedWalls.has(wall.id)) continue;

        let groupStart = wall.start;
        let groupEnd = wall.end;
        const groupWalls: Wall[] = [wall];
        let groupLength = wall.start.position.distanceTo(wall.end.position);

        processedWalls.add(wall.id);
        const groupDirection = getWallDirection(wall);

        // Try to extend the group by finding collinear connected walls
        // ONLY merge if the shared corner has degree 2 (simple bend, not an intersection)
        let extended = true;
        while (extended) {
            extended = false;

            for (const otherWall of walls) {
                if (processedWalls.has(otherWall.id)) continue;

                const otherDirection = getWallDirection(otherWall);

                // Check if otherWall connects to the end of current group (normal direction)
                // Only merge if this corner is NOT an intersection (degree === 2)
                if (
                    groupEnd.id === otherWall.start.id &&
                    cornerDegree.get(groupEnd.id) === 2 &&
                    isCollinear(groupDirection, otherDirection)
                ) {
                    groupEnd = otherWall.end;
                    groupWalls.push(otherWall);
                    processedWalls.add(otherWall.id);
                    groupLength += otherWall.start.position.distanceTo(
                        otherWall.end.position
                    );
                    extended = true;
                    break;
                }

                // Check if otherWall connects to the end of current group (reverse direction - both end at same point)
                if (
                    groupEnd.id === otherWall.end.id &&
                    cornerDegree.get(groupEnd.id) === 2 &&
                    isCollinear(groupDirection, otherDirection)
                ) {
                    groupEnd = otherWall.start;
                    groupWalls.push(otherWall);
                    processedWalls.add(otherWall.id);
                    groupLength += otherWall.start.position.distanceTo(
                        otherWall.end.position
                    );
                    extended = true;
                    break;
                }

                // Check if otherWall connects to the start of current group (normal direction)
                if (
                    groupStart.id === otherWall.end.id &&
                    cornerDegree.get(groupStart.id) === 2 &&
                    isCollinear(groupDirection, otherDirection)
                ) {
                    groupStart = otherWall.start;
                    groupWalls.unshift(otherWall);
                    processedWalls.add(otherWall.id);
                    groupLength += otherWall.start.position.distanceTo(
                        otherWall.end.position
                    );
                    extended = true;
                    break;
                }

                // Check if otherWall connects to the start of current group (reverse direction - both start at same point)
                if (
                    groupStart.id === otherWall.start.id &&
                    cornerDegree.get(groupStart.id) === 2 &&
                    isCollinear(groupDirection, otherDirection)
                ) {
                    groupStart = otherWall.end;
                    groupWalls.unshift(otherWall);
                    processedWalls.add(otherWall.id);
                    groupLength += otherWall.start.position.distanceTo(
                        otherWall.end.position
                    );
                    extended = true;
                    break;
                }
            }
        }

        const measurementData = calculateMeasurementData(groupStart, groupEnd);
        
        groups.push({
            start: groupStart,
            end: groupEnd,
            length: groupLength,
            center: measurementData.center,
            direction: measurementData.direction,
            perpendicular: measurementData.perpendicular,
            walls: groupWalls,
        });
    }

    return groups;
}