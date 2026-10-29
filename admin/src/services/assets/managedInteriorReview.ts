export interface AdminManagedInteriorPayload {
    projectId?: string;
    ownerId?: string;
    furniture?: unknown[];
    floorFinishes?: Record<string, string>;
    wallFinishes?: Record<string, Record<string, string>>;
    floors?: Array<{
        floorId: string;
        furniture: unknown[];
        floorFinishes: Record<string, string>;
        wallFinishes: Record<string, Record<string, string>>;
    }>;
    costEstimate?: unknown;
}

export interface AdminManagedProjectMetadata {
    projectId: string;
    ownerId: string;
    workflowType?: string;
    structuralStatus?: string;
    structuralRevision?: number;
    publishedStructuralRevision?: number;
    jsonUrl: string;
    interiorJsonPath?: string;
    interiorJsonUrl?: string;
}

export interface AdminReviewProjectData extends Record<string, unknown> {
    projectId: string;
    ownerId: string;
    workflowType: "admin-managed";
    structuralStatus: "published";
    structuralRevision: number;
    publishedStructuralRevision: number;
    corners: unknown[];
    walls: unknown[];
    doors: unknown[];
    windows: unknown[];
    openings: unknown[];
}

export function mergeManagedInteriorData<T extends Record<string, unknown>>(
    publishedStructure: T,
    interiorPayload: AdminManagedInteriorPayload | null
): T & Omit<AdminManagedInteriorPayload, "floors"> {
    const projectFloors = Array.isArray(publishedStructure.floors)
        ? publishedStructure.floors as Array<Record<string, unknown> & { floorId?: string; id?: string }>
        : undefined;
    const interiorFloors = new Map(
        (interiorPayload?.floors ?? []).map(floor => [floor.floorId, floor])
    );
    const floors = projectFloors?.map((floor, index) => {
        const floorId = floor.floorId ?? floor.id ?? (index === 0 ? "first-floor" : "");
        const interiorFloor = interiorFloors.get(floorId);
        return interiorFloor
            ? {
                ...floor,
                floorId,
                furniture: interiorFloor.furniture,
                floorFinishes: interiorFloor.floorFinishes,
                wallFinishes: interiorFloor.wallFinishes
            }
            : floor;
    });
    const firstFloor = floors?.[0];
    const firstInteriorFloor = firstFloor
        ? interiorFloors.get(String(firstFloor.floorId))
        : undefined;
    return {
        ...publishedStructure,
        ...(floors ? { floors } : {}),
        furniture: interiorPayload?.furniture ?? firstInteriorFloor?.furniture ?? [],
        floorFinishes: interiorPayload?.floorFinishes ?? firstInteriorFloor?.floorFinishes ?? {},
        wallFinishes: interiorPayload?.wallFinishes ?? firstInteriorFloor?.wallFinishes ?? {},
        costEstimate: interiorPayload
            ? interiorPayload.costEstimate
            : publishedStructure.costEstimate
    };
}

export async function loadAdminManagedProjectForReview(
    metadata: AdminManagedProjectMetadata,
    fetcher: typeof fetch = fetch
): Promise<AdminReviewProjectData> {
    if (
        metadata.workflowType !== "admin-managed" ||
        metadata.structuralStatus !== "published" ||
        !Number.isSafeInteger(metadata.publishedStructuralRevision) ||
        (metadata.publishedStructuralRevision ?? 0) < 1
    ) {
        throw new Error("Only a published admin-managed project can be reviewed.");
    }

    const structureResponse = await fetcher(metadata.jsonUrl.trim(), {
        method: "GET",
        cache: "no-store"
    });
    if (!structureResponse.ok) {
        throw new Error(`Project JSON request failed with HTTP ${structureResponse.status}.`);
    }

    const structure: unknown = await structureResponse.json();
    if (!isRecord(structure)) {
        throw new Error("Published project JSON is invalid.");
    }
    if (
        structure.projectId !== metadata.projectId ||
        structure.ownerId !== metadata.ownerId ||
        structure.workflowType !== "admin-managed" ||
        structure.structuralStatus !== "published" ||
        structure.structuralRevision !== metadata.publishedStructuralRevision ||
        structure.publishedStructuralRevision !== metadata.publishedStructuralRevision
    ) {
        throw new Error("The published structure does not match this project's owner, ID, or revision.");
    }
    for (const field of ["corners", "walls", "doors", "windows", "openings"]) {
        if (!Array.isArray(structure[field])) {
            throw new Error(`Published project JSON is missing ${field}.`);
        }
    }
    if (structure.floors !== undefined) {
        if (!Array.isArray(structure.floors) || structure.floors.length === 0) {
            throw new Error("Published project floors are invalid.");
        }
        const floorIds = new Set<string>();
        for (const [index, floorValue] of structure.floors.entries()) {
            if (!isRecord(floorValue)) {
                throw new Error(`Published project floor ${index + 1} is invalid.`);
            }
            const floorId = floorValue.floorId ?? floorValue.id;
            const floorStructure = floorValue.structure;
            if (
                typeof floorId !== "string" ||
                !floorId.trim() ||
                floorIds.has(floorId) ||
                typeof floorValue.name !== "string" ||
                !floorValue.name.trim() ||
                !isRecord(floorStructure)
            ) {
                throw new Error(`Published project floor ${index + 1} is invalid.`);
            }
            floorIds.add(floorId);
            for (const field of ["corners", "walls", "doors", "windows", "openings"]) {
                if (!Array.isArray(floorStructure[field])) {
                    throw new Error(`Published project floor ${index + 1} is missing ${field}.`);
                }
            }
        }
    }

    const interiorPayload = await loadInteriorPayload(metadata, fetcher);
    return mergeManagedInteriorData(
        structure as AdminReviewProjectData,
        interiorPayload
    );
}

async function loadInteriorPayload(
    metadata: AdminManagedProjectMetadata,
    fetcher: typeof fetch
): Promise<AdminManagedInteriorPayload | null> {
    const url = metadata.interiorJsonUrl?.trim();
    if (!url) {
        if (metadata.interiorJsonPath) {
            throw new Error("Interior design metadata has a path but no download URL.");
        }
        return null;
    }

    const expectedPath = `projects/${metadata.ownerId}/${metadata.projectId}.interior.json`;
    if (
        metadata.interiorJsonPath &&
        metadata.interiorJsonPath !== expectedPath
    ) {
        throw new Error("Interior design storage path does not match the selected client project.");
    }

    const response = await fetcher(url, {
        method: "GET",
        cache: "no-store"
    });
    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        throw new Error(`Interior design request failed with HTTP ${response.status}.`);
    }

    const value: unknown = await response.json();
    if (!isRecord(value)) {
        throw new Error("Interior design JSON is invalid.");
    }
    if (
        value.projectId !== undefined &&
        value.projectId !== metadata.projectId
    ) {
        throw new Error("Interior design project ID does not match the selected project.");
    }
    if (
        value.ownerId !== undefined &&
        value.ownerId !== metadata.ownerId
    ) {
        throw new Error("Interior design owner UID does not match the client project.");
    }
    if (
        value.furniture !== undefined &&
        (!Array.isArray(value.furniture) || !value.furniture.every(isSavedFurniture))
    ) {
        throw new Error("Interior design furniture placements are invalid.");
    }
    if (value.floorFinishes !== undefined && !isStringRecord(value.floorFinishes)) {
        throw new Error("Interior design floor finishes are invalid.");
    }
    if (
        value.wallFinishes !== undefined &&
        !isStringRecordOfStringRecords(value.wallFinishes)
    ) {
        throw new Error("Interior design wall finishes are invalid.");
    }
    if (value.floors !== undefined && (
        !Array.isArray(value.floors) ||
        !value.floors.every(floor =>
            isRecord(floor) &&
            typeof floor.floorId === "string" &&
            floor.floorId.trim() !== "" &&
            Array.isArray(floor.furniture) &&
            floor.furniture.every(isSavedFurniture) &&
            isStringRecord(floor.floorFinishes) &&
            isStringRecordOfStringRecords(floor.wallFinishes)
        )
    )) {
        throw new Error("Interior design floor data is invalid.");
    }
    if (
        value.costEstimate !== undefined &&
        !isSavedCostEstimate(value.costEstimate)
    ) {
        throw new Error("Interior design cost estimate is invalid.");
    }

    return value as AdminManagedInteriorPayload;
}

function isSavedCostEstimate(value: unknown): boolean {
    if (
        !isRecord(value) ||
        !Array.isArray(value.items) ||
        !Number.isFinite(value.subtotal) ||
        !Number.isFinite(value.total)
    ) {
        return false;
    }

    return value.items.every(item =>
        isRecord(item) &&
        ["furniture", "flooring", "wallFinish", "doors", "windows"].includes(
            String(item.category)
        ) &&
        typeof item.name === "string" &&
        Number.isFinite(item.quantity) &&
        typeof item.unit === "string" &&
        Number.isFinite(item.rate) &&
        Number.isFinite(item.subtotal)
    );
}

function isSavedFurniture(value: unknown): boolean {
    if (!isRecord(value)) return false;
    return (
        typeof value.id === "string" &&
        typeof value.assetId === "string" &&
        isPoint(value.position) &&
        isPoint(value.modelOffset) &&
        Number.isFinite(value.rotationY) &&
        Number.isFinite(value.width) &&
        Number.isFinite(value.depth) &&
        Number.isFinite(value.height)
    );
}

function isPoint(value: unknown): boolean {
    return (
        isRecord(value) &&
        Number.isFinite(value.x) &&
        Number.isFinite(value.y) &&
        Number.isFinite(value.z)
    );
}

function isStringRecord(value: unknown): value is Record<string, string> {
    return Boolean(
        isRecord(value) &&
        Object.values(value).every(item => typeof item === "string")
    );
}

function isStringRecordOfStringRecords(
    value: unknown
): value is Record<string, Record<string, string>> {
    return Boolean(
        isRecord(value) &&
        Object.values(value).every(isStringRecord)
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
