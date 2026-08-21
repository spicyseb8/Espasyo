import { Vector3 } from "three";

export type OpeningShape =
    | "rectangle"
    | "arch";

export interface Opening {

    id: string;

    wallId: string;

    shape: OpeningShape;

    position: Vector3;

    width: number;

    height: number;

    depth: number;

}