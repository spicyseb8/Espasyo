import {
    Object3D,
    Raycaster,
    Vector3
} from "three";

//----------------------------------------------------
// Floor raycast hit result
//----------------------------------------------------

export interface FloorRaycastHit {
    point: Vector3;
}

//----------------------------------------------------
// Find all floor objects in the scene
//----------------------------------------------------
// This should be called when the scene/floors are ready,
// NOT every frame.
//----------------------------------------------------

export function getFloorObjects(
    scene: Object3D
): Object3D[] {

    const floors: Object3D[] = [];

    scene.traverse((object) => {

        if (
            object.userData?.isFloor === true
        ) {
            floors.push(object);
        }

    });

    return floors;
}

//----------------------------------------------------
// Raycast ONLY against floor objects
//----------------------------------------------------

export function hitFloorByRaycast(
    raycaster: Raycaster,
    floorObjects: Object3D[]
): FloorRaycastHit | null {

    const intersects =
        raycaster.intersectObjects(
            floorObjects,
            true
        );

    for (const hit of intersects) {

        const point =
            hit.point.clone();

        point.y = 0;

        return {
            point
        };
    }

    return null;
}