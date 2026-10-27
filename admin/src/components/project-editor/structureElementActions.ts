import type { BuildElementPlacementCandidate } from "./buildElementPlacement.ts";
import type { ManagedStructure, StructureElement } from "./structureTypes.ts";

export type StructureElementKind = "door" | "window";
export type StructureElementAction = "move" | "duplicate";

function collectionFor(
    structure: ManagedStructure,
    kind: StructureElementKind
): StructureElement[] {
    return kind === "door" ? structure.doors : structure.windows;
}

export function applyStructureElementPlacement(
    structure: ManagedStructure,
    kind: StructureElementKind,
    source: StructureElement,
    action: StructureElementAction,
    candidate: BuildElementPlacementCandidate,
    duplicateId: string
): ManagedStructure | null {
    const sourceCollection = collectionFor(structure, kind);
    if (
        !candidate.valid ||
        candidate.kind !== kind ||
        !structure.walls.some(wall => wall.id === candidate.wallId) ||
        !sourceCollection.some(element => element.id === source.id) ||
        ![candidate.position.x, candidate.position.y, candidate.position.z].every(Number.isFinite)
    ) {
        return null;
    }

    const id = action === "move" ? source.id : duplicateId;
    if (
        action === "duplicate" &&
        (
            !id ||
            structure.doors.some(element => element.id === id) ||
            structure.windows.some(element => element.id === id)
        )
    ) {
        return null;
    }

    const placedElement: StructureElement = {
        ...source,
        id,
        wallId: candidate.wallId,
        position: candidate.position,
        rotationY: candidate.rotationY,
        width: candidate.width,
        height: candidate.height,
        wallWidth: candidate.wallWidth,
        depth: candidate.depth
    };

    if (kind === "door") {
        return {
            ...structure,
            doors: action === "move"
                ? structure.doors.map(element => element.id === source.id ? placedElement : element)
                : [...structure.doors, placedElement]
        };
    }

    return {
        ...structure,
        windows: action === "move"
            ? structure.windows.map(element => element.id === source.id ? placedElement : element)
            : [...structure.windows, placedElement]
    };
}

export function removeStructureElement(
    structure: ManagedStructure,
    kind: StructureElementKind,
    id: string
): ManagedStructure | null {
    const elements = collectionFor(structure, kind);
    if (!elements.some(element => element.id === id)) return null;

    return kind === "door"
        ? { ...structure, doors: structure.doors.filter(element => element.id !== id) }
        : { ...structure, windows: structure.windows.filter(element => element.id !== id) };
}
