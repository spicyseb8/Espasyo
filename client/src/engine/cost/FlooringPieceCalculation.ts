export interface FlooringPieceCost {
    pieceArea: number;
    piecesNeeded: number;
    rate: number;
    subtotal: number;
}

export function calculateFlooringPieceCost(
    roomArea: number,
    length: number,
    width: number,
    pricePerPiece: number
): FlooringPieceCost | null {
    if (
        !Number.isFinite(roomArea) ||
        roomArea <= 0 ||
        !Number.isFinite(length) ||
        length <= 0 ||
        !Number.isFinite(width) ||
        width <= 0 ||
        !Number.isFinite(pricePerPiece) ||
        pricePerPiece < 0
    ) {
        return null;
    }

    const pieceArea = length * width;

    if (!Number.isFinite(pieceArea) || pieceArea <= 0) {
        return null;
    }

    const exactQuantity = roomArea / pieceArea;
    const nearestWholeQuantity = Math.round(exactQuantity);
    const roundingTolerance =
        Number.EPSILON * Math.max(1, Math.abs(exactQuantity));
    const piecesNeeded =
        Math.abs(exactQuantity - nearestWholeQuantity) <= roundingTolerance
            ? nearestWholeQuantity
            : Math.ceil(exactQuantity);

    if (!Number.isFinite(piecesNeeded) || piecesNeeded <= 0) {
        return null;
    }

    return {
        pieceArea,
        piecesNeeded,
        rate: pricePerPiece,
        subtotal: piecesNeeded * pricePerPiece
    };
}
