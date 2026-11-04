export type WallPaintSide = 1 | -1;
export type WallPaintSeparatorOrientation = "vertical" | "horizontal";

export interface WallPaintSeparator {
    id: string;
    orientation: WallPaintSeparatorOrientation;
    position: number;
}

export interface WallPaintSection {
    id: string;
    leftBoundaryId: string;
    rightBoundaryId: string;
    bottomBoundaryId: string;
    topBoundaryId: string;
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
}

export interface WallPaintFace {
    separators: WallPaintSeparator[];
    sectionMaterials: Record<string, string>;
    floorId?: string;
    surfaceType?: "wall" | "floor";
    surfaceId?: string;
    wallSide?: WallPaintSide;
}

export type WallPaintSeparatorMap = Record<string, WallPaintFace>;
export type FloorPaintSeparatorMap = Record<string, WallPaintFace>;

export interface FloorPoint {
    x: number;
    y: number;
}

export function clipFloorTriangleToSection(
    triangle: [FloorPoint, FloorPoint, FloorPoint],
    section: Pick<WallPaintSection, "xStart" | "xEnd" | "yStart" | "yEnd">
): FloorPoint[] {
    let polygon = triangle.slice();
    const boundaries: Array<{
        inside: (point: FloorPoint) => boolean;
        intersect: (start: FloorPoint, end: FloorPoint) => FloorPoint;
    }> = [
        {
            inside: point => point.x >= section.xStart,
            intersect: (start, end) => intersectFloorEdge(start, end, "x", section.xStart)
        },
        {
            inside: point => point.x <= section.xEnd,
            intersect: (start, end) => intersectFloorEdge(start, end, "x", section.xEnd)
        },
        {
            inside: point => point.y >= section.yStart,
            intersect: (start, end) => intersectFloorEdge(start, end, "y", section.yStart)
        },
        {
            inside: point => point.y <= section.yEnd,
            intersect: (start, end) => intersectFloorEdge(start, end, "y", section.yEnd)
        }
    ];

    for (const boundary of boundaries) {
        const output: FloorPoint[] = [];
        for (let index = 0; index < polygon.length; index += 1) {
            const start = polygon[index];
            const end = polygon[(index + 1) % polygon.length];
            const startInside = boundary.inside(start);
            const endInside = boundary.inside(end);
            if (startInside && endInside) {
                output.push(end);
            } else if (startInside && !endInside) {
                output.push(boundary.intersect(start, end));
            } else if (!startInside && endInside) {
                output.push(boundary.intersect(start, end), end);
            }
        }
        polygon = output;
    }

    return polygon;
}

export function calculateFloorSectionArea(
    positions: ArrayLike<number>,
    section: Pick<WallPaintSection, "xStart" | "xEnd" | "yStart" | "yEnd">
): number {
    let area = 0;
    for (let index = 0; index + 8 < positions.length; index += 9) {
        const clipped = clipFloorTriangleToSection([
            { x: positions[index], y: positions[index + 1] },
            { x: positions[index + 3], y: positions[index + 4] },
            { x: positions[index + 6], y: positions[index + 7] }
        ], section);
        for (let pointIndex = 0; pointIndex < clipped.length; pointIndex += 1) {
            const current = clipped[pointIndex];
            const next = clipped[(pointIndex + 1) % clipped.length];
            area += current.x * next.y - next.x * current.y;
        }
    }
    return Math.abs(area) * 0.5;
}

function intersectFloorEdge(
    start: FloorPoint,
    end: FloorPoint,
    axis: "x" | "y",
    value: number
): FloorPoint {
    const delta = end[axis] - start[axis];
    const amount = Math.abs(delta) < 1e-12
        ? 0
        : (value - start[axis]) / delta;
    return {
        x: start.x + (end.x - start.x) * amount,
        y: start.y + (end.y - start.y) * amount
    };
}

export interface WallPaintMergeConflict {
    sectionId: string;
    materialIds: string[];
}

export function getWallPaintFaceKey(
    wallId: string,
    side: WallPaintSide
): string {
    return `${wallId}::side:${side}`;
}

export function isWallPaintSeparatorMap(
    value: unknown
): value is WallPaintSeparatorMap {
    if (!isRecord(value)) {
        return false;
    }

    return Object.values(value).every(face =>
        isRecord(face) &&
        Array.isArray(face.separators) &&
        (face.floorId === undefined || typeof face.floorId === "string") &&
        (face.surfaceType === undefined ||
            face.surfaceType === "wall" || face.surfaceType === "floor") &&
        (face.surfaceId === undefined || typeof face.surfaceId === "string") &&
        (face.wallSide === undefined || face.wallSide === 1 || face.wallSide === -1) &&
        face.separators.every(separator =>
            isRecord(separator) &&
            typeof separator.id === "string" &&
            separator.id.trim() !== "" &&
            (separator.orientation === "vertical" ||
                separator.orientation === "horizontal") &&
            typeof separator.position === "number" &&
            Number.isFinite(separator.position) &&
            separator.position > 0 &&
            separator.position < 1
        ) &&
        isStringRecord(face.sectionMaterials)
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isStringRecord(value: unknown): value is Record<string, string> {
    return isRecord(value) &&
        Object.values(value).every(item => typeof item === "string");
}

export function getWallPaintSections(
    face?: WallPaintFace
): WallPaintSection[] {
    const separators = face?.separators ?? [];
    const vertical = separators
        .filter(separator => separator.orientation === "vertical")
        .slice()
        .sort((a, b) => a.position - b.position);
    const horizontal = separators
        .filter(separator => separator.orientation === "horizontal")
        .slice()
        .sort((a, b) => a.position - b.position);
    const xBounds = [
        { id: "edge:left", position: 0 },
        ...vertical.map(separator => ({
            id: `separator:${separator.id}`,
            position: separator.position
        })),
        { id: "edge:right", position: 1 }
    ];
    const yBounds = [
        { id: "edge:bottom", position: 0 },
        ...horizontal.map(separator => ({
            id: `separator:${separator.id}`,
            position: separator.position
        })),
        { id: "edge:top", position: 1 }
    ];
    const sections: WallPaintSection[] = [];

    for (let y = 0; y < yBounds.length - 1; y++) {
        for (let x = 0; x < xBounds.length - 1; x++) {
            const left = xBounds[x];
            const right = xBounds[x + 1];
            const bottom = yBounds[y];
            const top = yBounds[y + 1];
            sections.push({
                id: `section:${JSON.stringify([
                    left.id,
                    right.id,
                    bottom.id,
                    top.id
                ])}`,
                leftBoundaryId: left.id,
                rightBoundaryId: right.id,
                bottomBoundaryId: bottom.id,
                topBoundaryId: top.id,
                xStart: left.position,
                xEnd: right.position,
                yStart: bottom.position,
                yEnd: top.position
            });
        }
    }

    return sections;
}

export function getWallPaintSectionAt(
    sections: WallPaintSection[],
    x: number,
    y: number
): WallPaintSection | undefined {
    return sections.find(section =>
        x >= section.xStart &&
        x <= section.xEnd &&
        y >= section.yStart &&
        y <= section.yEnd
    );
}

export function isValidWallPaintSeparatorPosition(
    separators: WallPaintSeparator[],
    orientation: WallPaintSeparatorOrientation,
    position: number,
    minGap = 0.05
): boolean {
    if (
        !Number.isFinite(position) ||
        position < minGap ||
        position > 1 - minGap
    ) {
        return false;
    }

    return separators.every(separator =>
        separator.orientation !== orientation ||
        Math.abs(separator.position - position) >= minGap
    );
}

export function addWallPaintSeparator(
    face: WallPaintFace | undefined,
    separator: WallPaintSeparator,
    fallbackMaterialId?: string
): WallPaintFace | null {
    const existing = face ?? {
        separators: [],
        sectionMaterials: {}
    };

    if (
        !separator.id ||
        !isValidWallPaintSeparatorPosition(
            existing.separators,
            separator.orientation,
            separator.position
        )
    ) {
        return null;
    }

    const oldSections = getWallPaintSections(existing);
    const nextFace: WallPaintFace = {
        separators: [...existing.separators, separator],
        sectionMaterials: {}
    };

    for (const section of getWallPaintSections(nextFace)) {
        const centerX = (section.xStart + section.xEnd) * 0.5;
        const centerY = (section.yStart + section.yEnd) * 0.5;
        const parent = oldSections.find(oldSection =>
            centerX >= oldSection.xStart &&
            centerX <= oldSection.xEnd &&
            centerY >= oldSection.yStart &&
            centerY <= oldSection.yEnd
        );
        const materialId = parent
            ? existing.sectionMaterials[parent.id] ?? fallbackMaterialId
            : fallbackMaterialId;
        if (materialId) {
            nextFace.sectionMaterials[section.id] = materialId;
        }
    }

    return nextFace;
}

export function removeWallPaintSeparator(
    face: WallPaintFace,
    separatorId: string,
    fallbackMaterialId?: string,
    choices: Record<string, string> = {}
): {
    face: WallPaintFace | null;
    conflicts: WallPaintMergeConflict[];
} {
    if (!face.separators.some(separator => separator.id === separatorId)) {
        return { face: null, conflicts: [] };
    }

    const oldSections = getWallPaintSections(face);
    const nextFace: WallPaintFace = {
        separators: face.separators.filter(separator => separator.id !== separatorId),
        sectionMaterials: {}
    };
    const conflicts: WallPaintMergeConflict[] = [];

    for (const section of getWallPaintSections(nextFace)) {
        const overlappingMaterials = new Set(
            oldSections
                .filter(oldSection =>
                    Math.min(section.xEnd, oldSection.xEnd) >
                        Math.max(section.xStart, oldSection.xStart) &&
                    Math.min(section.yEnd, oldSection.yEnd) >
                        Math.max(section.yStart, oldSection.yStart)
                )
                .map(oldSection =>
                    face.sectionMaterials[oldSection.id] ?? fallbackMaterialId
                )
                .filter((materialId): materialId is string => Boolean(materialId))
        );
        const materialIds = Array.from(overlappingMaterials);

        if (materialIds.length > 1) {
            const selectedMaterial = choices[section.id];
            if (!selectedMaterial || !overlappingMaterials.has(selectedMaterial)) {
                conflicts.push({ sectionId: section.id, materialIds });
                continue;
            }
            nextFace.sectionMaterials[section.id] = selectedMaterial;
        } else if (materialIds.length === 1) {
            nextFace.sectionMaterials[section.id] = materialIds[0];
        }
    }

    if (conflicts.length > 0) {
        return { face: null, conflicts };
    }

    return { face: nextFace, conflicts: [] };
}
