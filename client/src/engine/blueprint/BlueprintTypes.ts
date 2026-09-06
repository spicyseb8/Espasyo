export interface BlueprintState {
    id: "blueprint";
    name: string;
    url: string;
    aspectRatio: number;
    width: number;
    x: number;
    z: number;
    rotationY: number;
    opacity: number;
    locked: boolean;
    snapEnabled: boolean;
    calibrated: boolean;
    calibrationReferenceLength: number | null;
    selected: boolean;
}