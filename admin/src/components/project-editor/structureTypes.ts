export interface SavedPoint {
    x: number;
    y: number;
    z: number;
}

export interface StructureCorner {
    id: string;
    position: SavedPoint;
}

export interface StructureWall {
    id: string;
    start: { id: string; position: SavedPoint };
    end: { id: string; position: SavedPoint };
}

export interface StructureElement {
    id: string;
    assetId: string;
    wallId: string;
    position: SavedPoint;
    rotationY: number;
    width: number;
    height: number;
    wallWidth?: number;
    depth: number;
}

export interface StructureOpening {
    id: string;
    wallId: string;
    position: SavedPoint;
    rotationY: number;
    width: number;
    height: number;
    depth: number;
    shape: "rectangle" | "arch";
    archRise?: number;
}

export interface ManagedStructure {
    projectId: string;
    projectName: string;
    ownerId: string;
    schemaVersion: number;
    structuralRevision?: number;
    savedAt: string;
    wallHeight: number;
    wallThickness: number;
    gridSize: number;
    snapEnabled: boolean;
    layoutConfirmed: boolean;
    corners: StructureCorner[];
    walls: StructureWall[];
    doors: StructureElement[];
    windows: StructureElement[];
    openings: StructureOpening[];
    furniture: unknown[];
    floorFinishes: Record<string, string>;
    wallFinishes: Record<string, Record<string, string>>;
    archRise: number;
    openingWidth: number;
    openingHeight: number;
    blueprint: null;
}

export type ManagedFloorStructure = Omit<
    ManagedStructure,
    "projectId" | "projectName" | "ownerId" | "schemaVersion" | "structuralRevision" | "savedAt"
>;

export interface ManagedStructureFloor {
    floorId: string;
    name: string;
    structure: ManagedFloorStructure;
}

export interface ManagedStructureProjectData extends ManagedStructure {
    floors: ManagedStructureFloor[];
    activeFloorId: string;
}

export interface ManagedEditorFloor {
    floorId: string;
    name: string;
    structure: ManagedStructure;
}

export function getFloorName(index: number): string {
    const number = index + 1;
    const suffix = number % 100 >= 11 && number % 100 <= 13
        ? "th"
        : number % 10 === 1
            ? "st"
            : number % 10 === 2
                ? "nd"
                : number % 10 === 3
                    ? "rd"
                    : "th";
    return `${number}${suffix} Floor`;
}

export function createManagedEditorFloor(
    structure: ManagedStructure,
    index: number,
    floorId = crypto.randomUUID()
): ManagedEditorFloor {
    return { floorId, name: getFloorName(index), structure };
}

function toManagedFloorStructure(structure: ManagedStructure): ManagedFloorStructure {
    const {
        wallHeight,
        wallThickness,
        gridSize,
        snapEnabled,
        layoutConfirmed,
        corners,
        walls,
        doors,
        windows,
        openings,
        furniture,
        floorFinishes,
        wallFinishes,
        archRise,
        openingWidth,
        openingHeight,
        blueprint
    } = structure;
    return {
        wallHeight,
        wallThickness,
        gridSize,
        snapEnabled,
        layoutConfirmed,
        corners,
        walls,
        doors,
        windows,
        openings,
        furniture,
        floorFinishes,
        wallFinishes,
        archRise,
        openingWidth,
        openingHeight,
        blueprint: blueprint ?? null
    };
}

export function loadManagedEditorFloors(
    projectData: ManagedStructure
): { floors: ManagedEditorFloor[]; activeFloorId: string } {
    const project = projectData as ManagedStructure & {
        floors?: Array<ManagedStructureFloor & { id?: string }>;
        activeFloorId?: string;
    };
    if (!Array.isArray(project.floors) || project.floors.length === 0) {
        const firstFloor = createManagedEditorFloor(projectData, 0);
        return { floors: [firstFloor], activeFloorId: firstFloor.floorId };
    }

    const floors = project.floors.map(floor => ({
        floorId: floor.floorId ?? floor.id ?? crypto.randomUUID(),
        name: floor.name,
        structure: {
            ...projectData,
            ...floor.structure,
            projectId: projectData.projectId,
            projectName: projectData.projectName,
            ownerId: projectData.ownerId,
            schemaVersion: projectData.schemaVersion,
            structuralRevision: projectData.structuralRevision,
            savedAt: projectData.savedAt,
            blueprint: null
        }
    }));
    const activeFloorId = floors.find(floor => floor.floorId === project.activeFloorId)?.floorId
        ?? floors[0].floorId;
    return { floors, activeFloorId };
}

export function serializeManagedStructureProject(
    floors: ManagedEditorFloor[],
    activeFloorId: string,
    projectName: string,
    savedAt: string
): ManagedStructureProjectData {
    if (floors.length === 0) {
        throw new Error("A managed structural project must contain at least one floor.");
    }
    const serializedFloors = floors.map(floor => ({
        floorId: floor.floorId,
        name: floor.name,
        structure: toManagedFloorStructure({
            ...floor.structure,
            projectName,
            savedAt,
            blueprint: null
        })
    }));
    const primaryFloor = floors[0].structure;
    return {
        ...primaryFloor,
        projectName,
        savedAt,
        blueprint: null,
        floors: serializedFloors,
        activeFloorId: serializedFloors.some(floor => floor.floorId === activeFloorId)
            ? activeFloorId
            : serializedFloors[0].floorId
    };
}

export function createManagedStructure(projectId: string, projectName: string, ownerId: string): ManagedStructure {
    return {
        projectId,
        projectName,
        ownerId,
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        wallHeight: 3,
        wallThickness: 0.15,
        gridSize: 0.25,
        snapEnabled: true,
        layoutConfirmed: false,
        corners: [],
        walls: [],
        doors: [],
        windows: [],
        openings: [],
        furniture: [],
        floorFinishes: {},
        wallFinishes: {},
        archRise: 0.5,
        openingWidth: 1,
        openingHeight: 2,
        blueprint: null
    };
}
