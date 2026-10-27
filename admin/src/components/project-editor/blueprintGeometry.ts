export interface BlueprintCalibration {
    measuredLength: number;
    realLength: number;
    currentWidth: number;
}

export function calculateCalibratedBlueprintWidth(input: BlueprintCalibration): number {
    if (!Number.isFinite(input.measuredLength) || input.measuredLength <= 0) {
        throw new Error("Measured blueprint length must be positive.");
    }
    if (!Number.isFinite(input.realLength) || input.realLength <= 0) {
        throw new Error("Real-world blueprint length must be positive.");
    }
    if (!Number.isFinite(input.currentWidth) || input.currentWidth <= 0) {
        throw new Error("Current blueprint width must be positive.");
    }

    return input.currentWidth * (input.realLength / input.measuredLength);
}

export function distanceBetween2D(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

export function snapGrid(value: number, gridSize: number): number {
    return Math.round(value / gridSize) * gridSize;
}

export function svgPointToWorld(
    svgPoint: { x: number; y: number },
    worldSize: number
): { x: number; y: number } {
    const halfWorld = worldSize / 2;
    return {
        x: svgPoint.x - halfWorld,
        y: svgPoint.y - halfWorld
    };
}

export function blueprintDisplayBounds(width: number, aspectRatio: number) {
    if (!Number.isFinite(width) || width <= 0) throw new Error("Blueprint width must be positive.");
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) throw new Error("Blueprint aspect ratio must be positive.");
    const height = width / aspectRatio;
    return { x: -width / 2, y: -height / 2, width, height };
}
