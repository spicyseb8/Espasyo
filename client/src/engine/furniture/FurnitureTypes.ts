import { Vector3 } from "three";

export interface Furniture {
    id: string;
    assetId: string;
    position: Vector3;
    rotationY: number;
    modelOffset: Vector3;
    width: number;
    depth: number;
    height: number;
}