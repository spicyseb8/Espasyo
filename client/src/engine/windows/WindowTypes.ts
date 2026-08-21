import { Vector3 } from "three";

export interface Window {
    id: string;

    assetId: string;

    wallId: string;

    position: Vector3;

    rotationY: number;

    width: number;

    height: number;

    depth: number;
}