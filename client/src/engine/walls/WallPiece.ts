import { Vector3 } from "three";

export interface WallPiece {

    position: Vector3;

    rotationY: number;

    width: number;

    height: number;
    
    thickness: number;

    kind: "full" | "header" | "left" | "right";

}