import type { FloorPatternLayout } from "./patterns";

const MAX_PIXELS_PER_METER = 1024;
const MAX_REPEAT_CELL_PIXELS = 4096;
const MIN_PIXELS_PER_TILE = 256;

export function getFloorCanvasImageSource(source: unknown): {
    image: CanvasImageSource;
    width: number;
    height: number;
} {
    if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) {
        return {
            image: source,
            width: source.naturalWidth,
            height: source.naturalHeight,
        };
    }

    if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) {
        return { image: source, width: source.width, height: source.height };
    }

    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
        return { image: source, width: source.width, height: source.height };
    }

    throw new TypeError("Loaded floor image cannot be drawn to a pattern canvas.");
}

export function createFloorPatternCanvas(
    source: CanvasImageSource,
    sourceWidthPx: number,
    sourceHeightPx: number,
    layout: FloorPatternLayout,
): HTMLCanvasElement {
    if (!Number.isFinite(sourceWidthPx) || sourceWidthPx <= 0 ||
        !Number.isFinite(sourceHeightPx) || sourceHeightPx <= 0) {
        throw new RangeError("Floor image dimensions must be finite positive numbers.");
    }

    const tileLength = layout.tileLengthM;
    const tileWidth = layout.tileWidthM;
    const cellWidth = Math.hypot(layout.repeatCell.a.x, layout.repeatCell.a.y);
    const cellHeight = Math.hypot(layout.repeatCell.b.x, layout.repeatCell.b.y);
    const minPixelsPerMeter = MIN_PIXELS_PER_TILE / Math.max(tileLength, tileWidth);
    const imagePixelsPerMeter = Math.min(
        sourceWidthPx / tileLength,
        sourceHeightPx / tileWidth,
    );
    const pixelsPerMeter = Math.min(
        MAX_PIXELS_PER_METER,
        Math.max(minPixelsPerMeter, imagePixelsPerMeter),
        MAX_REPEAT_CELL_PIXELS / Math.max(cellWidth, cellHeight),
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(cellWidth * pixelsPerMeter));
    canvas.height = Math.max(1, Math.round(cellHeight * pixelsPerMeter));

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Unable to create the floor pattern canvas context.");
    }

    context.fillStyle = layout.groutColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const { a, b } = layout.repeatCell;
    const determinant = a.x * b.y - a.y * b.x;
    const inverse00 = b.y / determinant;
    const inverse01 = -b.x / determinant;
    const inverse10 = -a.y / determinant;
    const inverse11 = a.x / determinant;

    context.save();
    context.beginPath();
    context.rect(0, 0, canvas.width, canvas.height);
    context.clip();
    context.setTransform(
        canvas.width * inverse00,
        -canvas.height * inverse10,
        canvas.width * inverse01,
        -canvas.height * inverse11,
        0,
        canvas.height,
    );

    for (let repeatA = -2; repeatA <= 2; repeatA += 1) {
        for (let repeatB = -2; repeatB <= 2; repeatB += 1) {
            for (const tile of layout.tiles) {
                drawTile(
                    context,
                    source,
                    sourceWidthPx,
                    sourceHeightPx,
                    layout,
                    {
                        x: tile.center.x + repeatA * a.x + repeatB * b.x,
                        y: tile.center.y + repeatA * a.y + repeatB * b.y,
                    },
                    tile.rotationRadians,
                );
            }
        }
    }

    context.restore();
    return canvas;
}

export function calculateFloorImageCoverCrop(
    sourceWidthPx: number,
    sourceHeightPx: number,
    destinationAspectRatio: number,
): { x: number; y: number; width: number; height: number } {
    if (
        !Number.isFinite(sourceWidthPx) ||
        sourceWidthPx <= 0 ||
        !Number.isFinite(sourceHeightPx) ||
        sourceHeightPx <= 0 ||
        !Number.isFinite(destinationAspectRatio) ||
        destinationAspectRatio <= 0
    ) {
        throw new RangeError("Image and tile aspect dimensions must be finite and positive.");
    }

    const sourceAspectRatio = sourceWidthPx / sourceHeightPx;
    if (sourceAspectRatio > destinationAspectRatio) {
        const width = sourceHeightPx * destinationAspectRatio;
        return {
            x: (sourceWidthPx - width) / 2,
            y: 0,
            width,
            height: sourceHeightPx,
        };
    }

    const height = sourceWidthPx / destinationAspectRatio;
    return {
        x: 0,
        y: (sourceHeightPx - height) / 2,
        width: sourceWidthPx,
        height,
    };
}

function drawTile(
    context: CanvasRenderingContext2D,
    source: CanvasImageSource,
    sourceWidthPx: number,
    sourceHeightPx: number,
    layout: FloorPatternLayout,
    center: { x: number; y: number },
    rotationRadians: number,
): void {
    const faceLength = layout.tileLengthM - layout.tileFaceInsetM * 2;
    const faceWidth = layout.tileWidthM - layout.tileFaceInsetM * 2;
    const faceAspect = faceLength / faceWidth;
    const crop = calculateFloorImageCoverCrop(
        sourceWidthPx,
        sourceHeightPx,
        faceAspect,
    );

    context.save();
    context.translate(center.x, center.y);
    context.rotate(rotationRadians);
    context.drawImage(
        source,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        -faceLength / 2,
        -faceWidth / 2,
        faceLength,
        faceWidth,
    );
    context.restore();
}
