const CENTER_SNAP_DISTANCE = 0.25;

export interface BlueprintSnapResult {

    x: number;

    z: number;
}

//==================================================
// Blueprint-specific snapping
//==================================================

export function snapBlueprintPosition(
    x: number,
    z: number,
    gridSize: number,
    enabled: boolean
): BlueprintSnapResult {

    let snappedX = x;
    let snappedZ = z;

    //--------------------------------------------------
    // Grid snap
    //--------------------------------------------------

    if (
        enabled &&
        gridSize > 0
    ) {

        snappedX =
            Math.round(
                x / gridSize
            ) * gridSize;

        snappedZ =
            Math.round(
                z / gridSize
            ) * gridSize;
    }

    //--------------------------------------------------
    // Center snap
    //
    // Workspace center is (0, 0)
    //--------------------------------------------------

    if (
        Math.abs(snappedX) <=
        CENTER_SNAP_DISTANCE
    ) {

        snappedX = 0;

    }

    if (
        Math.abs(snappedZ) <=
        CENTER_SNAP_DISTANCE
    ) {

        snappedZ = 0;

    }

    return {
        x: snappedX,
        z: snappedZ
    };
}