import type { ManagedEditorFloor, ManagedStructure } from "./structureTypes";

export interface StructureHistoryEntry {
    structure?: ManagedStructure;
    transactionId?: string;
    before?: Record<string, ManagedStructure>;
    after?: Record<string, ManagedStructure>;
}

export type StructureHistoryByFloor = Record<string, StructureHistoryEntry[]>;

export function createGroupedStructureHistoryEntry(
    beforeFloors: ManagedEditorFloor[],
    afterFloors: ManagedEditorFloor[],
    touchedFloorIds: string[],
    transactionId: string
): StructureHistoryEntry {
    return {
        transactionId,
        before: Object.fromEntries(
            beforeFloors
                .filter(floor => touchedFloorIds.includes(floor.floorId))
                .map(floor => [floor.floorId, floor.structure])
        ),
        after: Object.fromEntries(
            afterFloors
                .filter(floor => touchedFloorIds.includes(floor.floorId))
                .map(floor => [floor.floorId, floor.structure])
        )
    };
}

export interface StructureHistoryTransition {
    floors: ManagedEditorFloor[];
    historyByFloor: StructureHistoryByFloor;
    futureByFloor: StructureHistoryByFloor;
    error?: string;
}

export function undoStructureHistory(
    floors: ManagedEditorFloor[],
    historyByFloor: StructureHistoryByFloor,
    futureByFloor: StructureHistoryByFloor,
    activeFloorId: string
): StructureHistoryTransition | null {
    const activeHistory = historyByFloor[activeFloorId] ?? [];
    const entry = activeHistory.at(-1);
    if (!entry) return null;
    if (entry.transactionId && entry.before) {
        const floorIds = Object.keys(entry.before);
        if (!floorIds.every(floorId =>
            historyByFloor[floorId]?.at(-1)?.transactionId === entry.transactionId
        )) {
            return {
                floors,
                historyByFloor,
                futureByFloor,
                error: "Undo changes on the connected floor before undoing this stair connection."
            };
        }
        return {
            floors: floors.map(floor => ({
                ...floor,
                structure: entry.before?.[floor.floorId] ?? floor.structure
            })),
            historyByFloor: {
                ...historyByFloor,
                ...Object.fromEntries(floorIds.map(floorId => [
                    floorId,
                    (historyByFloor[floorId] ?? []).slice(0, -1)
                ]))
            },
            futureByFloor: {
                ...futureByFloor,
                ...Object.fromEntries(floorIds.map(floorId => [
                    floorId,
                    [entry, ...(futureByFloor[floorId] ?? [])]
                ]))
            }
        };
    }
    const previousStructure = entry.structure;
    if (!previousStructure) return null;
    return {
        floors: floors.map(floor =>
            floor.floorId === activeFloorId
                ? { ...floor, structure: previousStructure }
                : floor
        ),
        historyByFloor: {
            ...historyByFloor,
            [activeFloorId]: activeHistory.slice(0, -1)
        },
        futureByFloor: {
            ...futureByFloor,
            [activeFloorId]: [entry, ...(futureByFloor[activeFloorId] ?? [])]
        }
    };
}

export function redoStructureHistory(
    floors: ManagedEditorFloor[],
    historyByFloor: StructureHistoryByFloor,
    futureByFloor: StructureHistoryByFloor,
    activeFloorId: string
): StructureHistoryTransition | null {
    const activeFuture = futureByFloor[activeFloorId] ?? [];
    const entry = activeFuture[0];
    if (!entry) return null;
    if (entry.transactionId && entry.after) {
        const floorIds = Object.keys(entry.after);
        if (!floorIds.every(floorId =>
            futureByFloor[floorId]?.[0]?.transactionId === entry.transactionId
        )) {
            return {
                floors,
                historyByFloor,
                futureByFloor,
                error: "Redo changes on the connected floor before redoing this stair connection."
            };
        }
        return {
            floors: floors.map(floor => ({
                ...floor,
                structure: entry.after?.[floor.floorId] ?? floor.structure
            })),
            futureByFloor: {
                ...futureByFloor,
                ...Object.fromEntries(floorIds.map(floorId => [
                    floorId,
                    (futureByFloor[floorId] ?? []).slice(1)
                ]))
            },
            historyByFloor: {
                ...historyByFloor,
                ...Object.fromEntries(floorIds.map(floorId => [
                    floorId,
                    [...(historyByFloor[floorId] ?? []), entry]
                ]))
            }
        };
    }
    const nextStructure = entry.structure;
    if (!nextStructure) return null;
    return {
        floors: floors.map(floor =>
            floor.floorId === activeFloorId
                ? { ...floor, structure: nextStructure }
                : floor
        ),
        historyByFloor: {
            ...historyByFloor,
            [activeFloorId]: [...(historyByFloor[activeFloorId] ?? []), entry]
        },
        futureByFloor: {
            ...futureByFloor,
            [activeFloorId]: activeFuture.slice(1)
        }
    };
}
