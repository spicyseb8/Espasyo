export type PaintApplyTarget =
    | {
        kind: "wall";
        clientX: number;
        clientY: number;
        materialId: string;
        regionId: string;
        wallId: string;
        side: 1 | -1;
    }
    | {
        kind: "floor";
        clientX: number;
        clientY: number;
        materialId: string;
        regionId: string;
    };
