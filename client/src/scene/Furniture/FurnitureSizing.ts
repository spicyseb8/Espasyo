import {
    Box3,
    Object3D,
    Vector3
} from "three";


//==================================================
// NATIVE FURNITURE BOUNDS
//==================================================

export interface FurnitureNativeBounds {

    width: number;

    depth: number;

    height: number;

}




export function getFurnitureNativeBounds(

    model: Object3D

): FurnitureNativeBounds {


    const box =
        new Box3()
            .setFromObject(
                model
            );


    const size =
        new Vector3();


    box.getSize(
        size
    );


    return {

        width:
            Math.max(
                size.x,
                0
            ),

        depth:
            Math.max(
                size.z,
                0
            ),

        height:
            Math.max(
                size.y,
                0
            )

    };

}