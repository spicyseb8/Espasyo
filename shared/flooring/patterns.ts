export const DEFAULT_FLOOR_GROUT_WIDTH_M = 0.003;
export const DEFAULT_FLOOR_GROUT_COLOR = "#808080";
export const ASPECT_RATIO_WARNING_TOLERANCE = 0.1;
export const HERRINGBONE_TILE_LENGTH_WIDTH_RATIO = 2;
const HERRINGBONE_RATIO_TOLERANCE = 1e-6;

export const FLOOR_PATTERN_DEFINITIONS = [
    {
        id: "stack-bond",
        label: "Stack Bond",
        description: "Aligned rows and columns with continuous grout joints.",
    },
    {
        id: "brick-bond",
        label: "Brick Bond",
        description: "Alternating rows offset by half the tile length.",
    },
    {
        id: "diagonal",
        label: "Diagonal",
        description: "Stack Bond rotated 45 degrees relative to world axes.",
    },
    {
        id: "herringbone",
        label: "Herringbone",
        description: "Alternating horizontal and vertical tiles in a zigzag layout.",
    },
] as const;

export type FloorPattern = (typeof FLOOR_PATTERN_DEFINITIONS)[number]["id"];
export type FloorDimensionUnit = "cm" | "mm";

export function isFloorPattern(value: unknown): value is FloorPattern {
    return FLOOR_PATTERN_DEFINITIONS.some(({ id }) => id === value);
}

export function isHerringboneTileRatio(
    tileLengthM: number,
    tileWidthM: number,
): boolean {
    return Number.isFinite(tileLengthM) &&
        Number.isFinite(tileWidthM) &&
        tileLengthM > 0 &&
        tileWidthM > 0 &&
        Math.abs(
            tileLengthM / tileWidthM - HERRINGBONE_TILE_LENGTH_WIDTH_RATIO,
        ) <= HERRINGBONE_RATIO_TOLERANCE;
}

export interface FloorVector {
    x: number;
    y: number;
}

export interface FloorTilePlacement {
    center: FloorVector;
    rotationRadians: number;
}

export interface FloorPatternLayout {
    pattern: FloorPattern;
    tileLengthM: number;
    tileWidthM: number;
    groutWidthM: number;
    groutColor: string;
    tileFaceInsetM: number;
    repeatCell: {
        a: FloorVector;
        b: FloorVector;
    };
    tiles: FloorTilePlacement[];
}

export interface FloorAspectRatioCheck {
    imageAspectRatio: number;
    physicalAspectRatio: number;
    relativeDifference: number;
    mismatch: boolean;
}

export function getFloorPatternUV(
    x: number,
    y: number,
    layout: FloorPatternLayout,
): FloorVector {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new RangeError("Floor coordinates must be finite numbers.");
    }

    const { a, b } = layout.repeatCell;
    const determinant = a.x * b.y - a.y * b.x;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
        throw new RangeError("Floor pattern repeat cell must have a non-zero area.");
    }

    return {
        x: (x * b.y - y * b.x) / determinant,
        y: (y * a.x - x * a.y) / determinant,
    };
}

export function floorDimensionToMeters(value: number, unit: FloorDimensionUnit): number {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError("Tile dimensions must be finite positive numbers.");
    }

    switch (unit) {
        case "cm":
            return value / 100;
        case "mm":
            return value / 1000;
        default:
            throw new RangeError(`Unsupported tile dimension unit: ${String(unit)}.`);
    }
}

export function checkFloorImageAspectRatio(
    imageWidthPx: number,
    imageHeightPx: number,
    tileLengthM: number,
    tileWidthM: number,
    tolerance = ASPECT_RATIO_WARNING_TOLERANCE,
): FloorAspectRatioCheck {
    if (!Number.isFinite(imageWidthPx) || imageWidthPx <= 0 ||
        !Number.isFinite(imageHeightPx) || imageHeightPx <= 0) {
        throw new RangeError("Image dimensions must be finite positive numbers.");
    }
    validateTileDimensions(tileLengthM, tileWidthM);
    if (!Number.isFinite(tolerance) || tolerance < 0) {
        throw new RangeError("Aspect-ratio tolerance must be a finite non-negative number.");
    }

    const imageAspectRatio = imageWidthPx / imageHeightPx;
    const physicalAspectRatio = tileLengthM / tileWidthM;
    const relativeDifference = Math.abs(imageAspectRatio / physicalAspectRatio - 1);

    return {
        imageAspectRatio,
        physicalAspectRatio,
        relativeDifference,
        mismatch: relativeDifference > tolerance,
    };
}

export function createFloorPatternLayout(
    pattern: FloorPattern,
    tileLengthM: number,
    tileWidthM: number,
    groutWidthM = DEFAULT_FLOOR_GROUT_WIDTH_M,
): FloorPatternLayout {
    validateTileDimensions(tileLengthM, tileWidthM);
    if (!Number.isFinite(groutWidthM) || groutWidthM < 0 ||
        groutWidthM >= Math.min(tileLengthM, tileWidthM)) {
        throw new RangeError("Grout width must be non-negative and smaller than both tile dimensions.");
    }

    const layout = {
        pattern,
        tileLengthM,
        tileWidthM,
        groutWidthM,
        groutColor: DEFAULT_FLOOR_GROUT_COLOR,
        tileFaceInsetM: groutWidthM / 2,
    };

    switch (pattern) {
        case "stack-bond":
            return {
                ...layout,
                repeatCell: {
                    a: { x: tileLengthM, y: 0 },
                    b: { x: 0, y: tileWidthM },
                },
                tiles: [{ center: { x: tileLengthM / 2, y: tileWidthM / 2 }, rotationRadians: 0 }],
            };
        case "brick-bond":
            return {
                ...layout,
                repeatCell: {
                    a: { x: tileLengthM * 2, y: 0 },
                    b: { x: 0, y: tileWidthM * 2 },
                },
                tiles: [
                    { center: { x: tileLengthM / 2, y: tileWidthM / 2 }, rotationRadians: 0 },
                    { center: { x: tileLengthM * 1.5, y: tileWidthM / 2 }, rotationRadians: 0 },
                    { center: { x: 0, y: tileWidthM * 1.5 }, rotationRadians: 0 },
                    { center: { x: tileLengthM, y: tileWidthM * 1.5 }, rotationRadians: 0 },
                ],
            };
        case "diagonal":
            return diagonalLayout(layout);
        case "herringbone":
            if (!isHerringboneTileRatio(tileLengthM, tileWidthM)) {
                throw new RangeError(
                    "Herringbone requires the tile length to be twice its width.",
                );
            }
            return herringboneLayout(layout);
        default:
            throw new RangeError(`Unsupported floor pattern: ${String(pattern)}.`);
    }
}

function herringboneLayout(
    layout: Omit<FloorPatternLayout, "repeatCell" | "tiles">,
): FloorPatternLayout {
    const tileLength = layout.tileLengthM;
    const tileWidth = layout.tileWidthM;
    const unit = tileWidth;

    return {
        ...layout,
        repeatCell: {
            a: { x: tileLength * 2, y: 0 },
            b: { x: 0, y: tileWidth * 4 },
        },
        tiles: [
            {
                center: { x: unit, y: unit / 2 },
                rotationRadians: 0,
            },
            {
                center: { x: tileLength + unit, y: unit / 2 },
                rotationRadians: 0,
            },
            {
                center: { x: tileLength + unit, y: unit * 1.5 },
                rotationRadians: 0,
            },
            {
                center: { x: unit, y: unit * 3.5 },
                rotationRadians: 0,
            },
            {
                center: { x: unit / 2, y: unit * 2 },
                rotationRadians: Math.PI / 2,
            },
            {
                center: { x: unit * 1.5, y: unit * 2 },
                rotationRadians: Math.PI / 2,
            },
            {
                center: { x: unit * 2.5, y: unit * 3 },
                rotationRadians: Math.PI / 2,
            },
            {
                center: { x: unit * 3.5, y: unit * 3 },
                rotationRadians: Math.PI / 2,
            },
        ],
    };
}

function diagonalLayout(
    layout: Omit<FloorPatternLayout, "repeatCell" | "tiles">,
): FloorPatternLayout {
    const angle = Math.PI / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return {
        ...layout,
        repeatCell: {
            a: { x: layout.tileLengthM * cos, y: layout.tileLengthM * sin },
            b: { x: -layout.tileWidthM * sin, y: layout.tileWidthM * cos },
        },
        tiles: [{ center: { x: 0, y: 0 }, rotationRadians: angle }],
    };
}

function validateTileDimensions(tileLengthM: number, tileWidthM: number): void {
    if (!Number.isFinite(tileLengthM) || tileLengthM <= 0 ||
        !Number.isFinite(tileWidthM) || tileWidthM <= 0) {
        throw new RangeError("Tile dimensions must be finite positive numbers.");
    }
}
