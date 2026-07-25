import { Vector3 } from "three";
import type { Wall } from "./WallTypes";
import type { Door } from "../doors/DoorTypes";
import type { WallPiece } from "./WallPiece";

export function buildWallMeshes(
    wall: Wall,
    wallHeight: number,
    wallThickness: number,
    doors: Door[] = []
): WallPiece[] {
    //--------------------------------------------------
    // Wall direction
    //--------------------------------------------------
    const direction = new Vector3()
        .subVectors(
            wall.end.position,
            wall.start.position
        );
    const wallLength = direction.length();
    direction.normalize();

    //--------------------------------------------------
    // Rotation
    //--------------------------------------------------
    const rotationY = Math.atan2(
        direction.z,
        direction.x
    );

    //--------------------------------------------------
    // Center
    //--------------------------------------------------
    const center = new Vector3(
        (wall.start.position.x + wall.end.position.x) / 2,
        wallHeight * 0.5,
        (wall.start.position.z + wall.end.position.z) / 2
    );

    //--------------------------------------------------
    // Find doors belonging to this wall
    //--------------------------------------------------
    const wallDoors = doors.filter(
        door => door.wallId === wall.id
    );

    //--------------------------------------------------
    // No doors → one full wall
    //--------------------------------------------------
    if (wallDoors.length === 0) {
        return [
            {
                position: center,
                rotationY,
                width: wallLength,
                height: wallHeight,
                thickness: wallThickness,
                kind: "full"
            }
        ];
    }

    //--------------------------------------------------
    // First door
    //--------------------------------------------------
    const door = wallDoors[0];
    const doorDistance =
        door.position
            .clone()
            .sub(wall.start.position)
            .dot(direction);

    const leftWidth =
        doorDistance -
        door.width * 0.5;

    const rightWidth =
        wallLength -
        doorDistance -
        door.width * 0.5;

    const headerHeight =
        wallHeight -
        door.height;

    const pieces: WallPiece[] = [];

    //--------------------------------------------------
    // Left Piece
    //--------------------------------------------------
    if (leftWidth > 0.001) {
        const leftCenter = wall.start.position
            .clone()
            .add(
                direction.clone()
                    .multiplyScalar(leftWidth * 0.5)
            );
        leftCenter.y = wallHeight * 0.5;

        pieces.push({
            position: leftCenter,
            rotationY,
            width: leftWidth,
            height: wallHeight,
            thickness: wallThickness,
            kind: "left"
        });
    }

    //--------------------------------------------------
    // Right Piece
    //--------------------------------------------------
    if (rightWidth > 0.001) {
        const rightCenter = wall.start.position
            .clone()
            .add(
                direction.clone().multiplyScalar(
                    doorDistance +
                    door.width * 0.5 +
                    rightWidth * 0.5
                )
            );
        rightCenter.y = wallHeight * 0.5;

        pieces.push({
            position: rightCenter,
            rotationY,
            width: rightWidth,
            height: wallHeight,
            thickness: wallThickness,
            kind: "right"
        });
    }

    //--------------------------------------------------
    // Header
    //--------------------------------------------------
    const headerCenter = door.position.clone();
    headerCenter.y =
        door.height +
        headerHeight * 0.5;

    pieces.push({
        position: headerCenter,
        rotationY,
        width: door.width,
        height: headerHeight,
        thickness: wallThickness,
        kind: "header"
    });

    return pieces;
}