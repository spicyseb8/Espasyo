const DEFAULT_WALL_ROTATION_OFFSET_Y = Math.PI / 2;

// Placement yaw is atan2(dx, dz); this offset aligns local-X width with the wall plane.
export function getDefaultModelSettings(
    category: "doors" | "windows"
): {
    scale: number;
    rotationOffsetY: number;
} {
    if (category === "doors") {
        return {
            scale: 1,
            rotationOffsetY: DEFAULT_WALL_ROTATION_OFFSET_Y
        };
    }

    return {
        scale: 0.6,
        rotationOffsetY: DEFAULT_WALL_ROTATION_OFFSET_Y
    };
}

export function resolveRotationOffsetY(
    value: unknown,
    fallback: number
): number {
    const parsedValue = Number(value ?? Number.NaN);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
}
