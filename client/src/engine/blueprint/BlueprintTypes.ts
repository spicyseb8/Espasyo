export interface BlueprintState {

    // Only one blueprint can be uploaded.
    id: "blueprint";

    // Original filename.
    name: string;

    // Temporary browser object URL.
    url: string;

    // Image width / height.
    aspectRatio: number;

    // Physical width in meters.
    width: number;

    // Position on the floor.
    x: number;
    z: number;

    // Rotation around Y axis.
    rotationY: number;

    // 0 - 1.
    opacity: number;

    // Blueprint itself locked.
    locked: boolean;

    // Blueprint snapping.
    snapEnabled: boolean;

    // Currently visible/active in the scene.
    selected: boolean;
}