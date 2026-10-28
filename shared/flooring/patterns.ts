export const DEFAULT_FLOOR_GROUT_WIDTH_M = 0.003;
export const DEFAULT_FLOOR_GROUT_COLOR = "#808080";
export const ASPECT_RATIO_WARNING_TOLERANCE = 0.1;

const MAX_HERRINGBONE_TILES_PER_CELL = 512;

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
        description: "Alternating horizontal and perpendicular tile courses.",
    },
] as const;

export type FloorPattern = (typeof FLOOR_PATTERN_DEFINITIONS)[number]["id"];
export type FloorDimensionUnit = "cm" | "mm";

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
            return herringboneLayout(layout);
        default:
            throw new RangeError(`Unsupported floor pattern: ${String(pattern)}.`);
    }
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

function herringboneLayout(
    layout: Omit<FloorPatternLayout, "repeatCell" | "tiles">,
): FloorPatternLayout {
    const dimensions = toCommonDecimalUnits(layout.tileLengthM, layout.tileWidthM);
    const { lengthUnits, widthUnits } = dimensions;
    const commonUnits = leastCommonMultiple(lengthUnits, widthUnits);
    const periodUnits = commonUnits * 2;
    const horizontalCount = periodUnits / lengthUnits;
    const verticalCount = periodUnits / widthUnits;

    if (horizontalCount + verticalCount > MAX_HERRINGBONE_TILES_PER_CELL) {
        throw new RangeError(
            "The herringbone repeat cell is too large for these tile dimensions; choose a different pattern or simpler tile dimensions.",
        );
    }

    const repeatWidthM = periodUnits * dimensions.metersPerUnit;
    const tiles: FloorTilePlacement[] = [];

    for (let index = 0; index < horizontalCount; index += 1) {
        tiles.push({
            center: {
                x: (index + 0.5) * layout.tileLengthM,
                y: layout.tileWidthM / 2,
            },
            rotationRadians: 0,
        });
    }

    for (let index = 0; index < verticalCount; index += 1) {
        tiles.push({
            center: {
                x: index * layout.tileWidthM,
                y: layout.tileWidthM + layout.tileLengthM / 2,
            },
            rotationRadians: Math.PI / 2,
        });
    }

    return {
        ...layout,
        repeatCell: {
            a: { x: repeatWidthM, y: 0 },
            b: { x: 0, y: layout.tileWidthM + layout.tileLengthM },
        },
        tiles,
    };
}

function validateTileDimensions(tileLengthM: number, tileWidthM: number): void {
    if (!Number.isFinite(tileLengthM) || tileLengthM <= 0 ||
        !Number.isFinite(tileWidthM) || tileWidthM <= 0) {
        throw new RangeError("Tile dimensions must be finite positive numbers.");
    }
}

function toCommonDecimalUnits(
    lengthM: number,
    widthM: number,
): { lengthUnits: number; widthUnits: number; metersPerUnit: number } {
    const length = decimalParts(lengthM);
    const width = decimalParts(widthM);
    const commonPower = Math.min(length.power, width.power);
    const lengthUnits = length.coefficient * 10 ** (length.power - commonPower);
    const widthUnits = width.coefficient * 10 ** (width.power - commonPower);
    const metersPerUnit = 10 ** commonPower;

    if (!Number.isSafeInteger(lengthUnits) || !Number.isSafeInteger(widthUnits) ||
        !Number.isFinite(metersPerUnit) || metersPerUnit <= 0) {
        throw new RangeError("Tile dimensions are outside the supported precision range.");
    }

    return { lengthUnits, widthUnits, metersPerUnit };
}

function decimalParts(value: number): { coefficient: number; power: number } {
    const [significand, exponent = "0"] = value.toString().toLowerCase().split("e");
    const [integerPart, fractionalPart = ""] = significand.split(".");

    return {
        coefficient: Number(`${integerPart}${fractionalPart}`),
        power: Number(exponent) - fractionalPart.length,
    };
}

function leastCommonMultiple(left: number, right: number): number {
    const gcd = greatestCommonDivisor(left, right);
    const lcm = (left / gcd) * right;
    if (!Number.isSafeInteger(lcm)) {
        throw new RangeError("Tile dimensions produce an unrepresentable repeat cell.");
    }
    return lcm;
}

function greatestCommonDivisor(left: number, right: number): number {
    let a = left;
    let b = right;
    while (b !== 0) {
        [a, b] = [b, a % b];
    }
    return a;
}
