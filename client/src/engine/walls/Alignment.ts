import { Vector3 } from "three";
import type { Corner } from "./Corner";

export interface AlignmentGuide {
    start: Vector3;
    end: Vector3;
    direction: "horizontal" | "vertical";
    cornerId: string;
    aligned: boolean;
}

export function getAlignmentGuides(
    currentPoint: Vector3,
    corners: Corner[],
    snapRadius = 0.5
    
): AlignmentGuide[] {
    const guides: AlignmentGuide[] = [];
    const previewRadius = 0.5;
    const alignedRadius = 0.05;

    for (const corner of corners) {
        const dx = Math.abs(currentPoint.x - corner.position.x);
        const dz = Math.abs(currentPoint.z - corner.position.z);

        // Check for horizontal alignment (same Z)
        if (dz < previewRadius) {
            guides.push({
                start: new Vector3(corner.position.x, 0, corner.position.z),
                end: new Vector3(currentPoint.x, 0, corner.position.z),
                direction: "horizontal",
                cornerId: corner.id,
                aligned: dz < alignedRadius
            });
        }

        // Check for vertical alignment (same X)
        if (dx < previewRadius) {
            guides.push({
                start: new Vector3(corner.position.x, 0, corner.position.z),
                end: new Vector3(corner.position.x, 0, currentPoint.z),
                direction: "vertical",
                cornerId: corner.id,
                aligned: dx < alignedRadius
            });
        }
    }

    return guides;
}
