import type { Wall } from "./WallTypes";
import type { Corner } from "./Corner";
import { Vector3 } from "three";

export interface MeasurementGroup {
    start: Corner;
    end: Corner;
    length: number;
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

        const group: MeasurementGroup = {
            start: wall.start,
            end: wall.end,
            length: wall.start.position.distanceTo(wall.end.position),
            walls: [wall],
        };

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
                    group.end.id === otherWall.start.id &&
                    cornerDegree.get(group.end.id) === 2 &&
                    isCollinear(groupDirection, otherDirection)
                ) {
                    group.end = otherWall.end;
                    group.walls.push(otherWall);
                    processedWalls.add(otherWall.id);
                    group.length += otherWall.start.position.distanceTo(
                        otherWall.end.position
                    );
                    extended = true;
                    break;
                }

                // Check if otherWall connects to the end of current group (reverse direction - both end at same point)
                if (
                    group.end.id === otherWall.end.id &&
                    cornerDegree.get(group.end.id) === 2 &&
                    isCollinear(groupDirection, otherDirection)
                ) {
                    group.end = otherWall.start;
                    group.walls.push(otherWall);
                    processedWalls.add(otherWall.id);
                    group.length += otherWall.start.position.distanceTo(
                        otherWall.end.position
                    );
                    extended = true;
                    break;
                }

                // Check if otherWall connects to the start of current group (normal direction)
                if (
                    group.start.id === otherWall.end.id &&
                    cornerDegree.get(group.start.id) === 2 &&
                    isCollinear(groupDirection, otherDirection)
                ) {
                    group.start = otherWall.start;
                    group.walls.unshift(otherWall);
                    processedWalls.add(otherWall.id);
                    group.length += otherWall.start.position.distanceTo(
                        otherWall.end.position
                    );
                    extended = true;
                    break;
                }

                // Check if otherWall connects to the start of current group (reverse direction - both start at same point)
                if (
                    group.start.id === otherWall.start.id &&
                    cornerDegree.get(group.start.id) === 2 &&
                    isCollinear(groupDirection, otherDirection)
                ) {
                    group.start = otherWall.end;
                    group.walls.unshift(otherWall);
                    processedWalls.add(otherWall.id);
                    group.length += otherWall.start.position.distanceTo(
                        otherWall.end.position
                    );
                    extended = true;
                    break;
                }
            }
        }

        groups.push(group);
    }

    return groups;
}
