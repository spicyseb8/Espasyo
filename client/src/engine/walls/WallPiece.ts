import { Vector3 } from "three";

export type WallPieceKind =
    | "full"
    | "header"
    | "left"
    | "right"
    | "arch";

export interface WallPiece {

    position: Vector3;

    rotationY: number;

    width: number;

    height: number;

    thickness: number;

    kind: WallPieceKind;

    /**
     * Used only for arch openings.
     */
    arch?: {
        openingWidth: number;
        openingHeight: number;
    };
}