import {
    Box3,
    Object3D,
    Vector3
} from "three";

import type {
    FurnitureDimensions
} from "../../assets/Asset";

export function getFurnitureScale(
    model: Object3D,
    target: FurnitureDimensions
): Vector3 {

    const box =
        new Box3()
            .setFromObject(model);

    const nativeSize =
        new Vector3();

    box.getSize(
        nativeSize
    );

    //--------------------------------------------------
    // Prevent invalid scaling
    //--------------------------------------------------

    if (
        nativeSize.x <= 0 ||
        nativeSize.y <= 0 ||
        nativeSize.z <= 0
    ) {
        return new Vector3(
            1,
            1,
            1
        );
    }

    //--------------------------------------------------
    // Scale each axis to target real-world dimensions
    //--------------------------------------------------

    return new Vector3(

        target.width /
            nativeSize.x,

        target.height /
            nativeSize.y,

        target.depth /
            nativeSize.z

    );
}