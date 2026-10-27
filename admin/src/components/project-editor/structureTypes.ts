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
