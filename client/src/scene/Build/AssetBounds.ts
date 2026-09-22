export interface AssetBounds {

    //--------------------------------------------------
    // Actual visual dimensions
    //--------------------------------------------------

    width: number;

    height: number;

    depth: number;


    //--------------------------------------------------
    // Actual GLB bounding-box position
    //
    // These are measured relative to the GLB origin.
    //--------------------------------------------------

    minX?: number;

    maxX?: number;

    minY?: number;

    maxY?: number;

    minZ?: number;

    maxZ?: number;


    //--------------------------------------------------
    // Bounding-box center relative to GLB origin
    //--------------------------------------------------

    centerX?: number;

    centerZ?: number;

}