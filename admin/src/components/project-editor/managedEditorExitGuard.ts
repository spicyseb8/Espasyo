import {
    serializeManagedStructureProject,
    type ManagedEditorFloor
} from "./structureTypes.ts";

export function createManagedEditorExitFingerprint(input: {
    floors: ManagedEditorFloor[];
    activeFloorId: string | null;
    projectName: string;
    deadline: string;
}): string {
    return JSON.stringify({
        projectData: serializeManagedStructureProject(
            input.floors,
            input.activeFloorId ?? input.floors[0]?.floorId ?? "",
            input.projectName,
            ""
        ),
        deadline: input.deadline
    });
}
