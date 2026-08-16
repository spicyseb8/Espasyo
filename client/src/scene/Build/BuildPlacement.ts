import type { Asset } from "../../assets/Asset";
import type { Wall } from "../../engine/walls";
import { PlacementRules } from "./PlacementRules";
import { Vector3 } from "three"; // Actually needed for the return type
import type { AssetBounds } from "./AssetBounds";


export interface PlacementTransform {
    kind: "wall";

    wall: Wall;
    position: Vector3;
    rotationY: number;
    modelOffset: Vector3;
    direction: Vector3;
    wallLength: number;
    wallNormal: Vector3;
}


export function buildPlacement(
    wall: Wall,
    hitPoint: Vector3,
    asset: Asset,
    wallHeight: number,
    bounds: AssetBounds
): PlacementTransform {
    const rule = PlacementRules[asset.type];
    const direction = new Vector3()
        .subVectors(wall.end.position, wall.start.position);
    const wallLength = direction.length();
    direction.normalize();

    // Calculate wall normal (perpendicular to direction, in the horizontal plane)
    const wallNormal = new Vector3(-direction.z, 0, direction.x).normalize();

    // Project mouse onto wall centerline
    const projected = wall.start.position.clone();
    const toHit = hitPoint.clone().sub(wall.start.position);
    let distance = toHit.dot(direction);

    // Clamp inside wall
    if (rule.clampToWall) {
        const halfWidth = bounds.width * 0.5;
        distance = Math.max(
            halfWidth,
            Math.min(distance, wallLength - halfWidth)
        );
    } else {
        distance = Math.max(
            0,
            Math.min(distance, wallLength)
        );
    }

    projected.add(direction.clone().multiplyScalar(distance));

    // Vertical Anchor
    switch (rule.anchor) {
        case "bottom":
            projected.y = 0;
            break;
        case "center":
            projected.y = wallHeight * 0.5;
            break;
    }

    // Wall Rotation
    const rotationY = Math.atan2(direction.x, direction.z);

    // Model Offset
    const modelOffset = new Vector3(
        0,
        bounds.height * 0.5,
        0
    );

    return {
        kind: "wall",
        wall,
        position: projected,
        rotationY,
        direction,
        wallNormal,
        wallLength,
        modelOffset
    };
}