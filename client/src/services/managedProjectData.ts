import { isValidProjectBudget } from "../engine/cost/ProjectBudget.ts";
import {
    isWallPaintSeparatorMap,
    type FloorPaintSeparatorMap,
    type WallPaintSeparatorMap
} from "../../../shared/wallPaintSeparators.ts";

export interface ManagedInteriorPayload {
    projectId?: string;
    ownerId?: string;
    furniture?: unknown[];
    floorFinishes?: Record<string, string>;
    wallFinishes?: Record<string, Record<string, string>>;
    wallPaintSeparators?: WallPaintSeparatorMap;
    floorPaintSeparators?: FloorPaintSeparatorMap;
    floors?: ManagedInteriorFloor[];
    costEstimate?: unknown;
    maximumBudget?: number | null;
}

export interface ManagedInteriorFloor {
    floorId: string;
    furniture?: unknown[];
    floorFinishes?: Record<string, string>;
    wallFinishes?: Record<string, Record<string, string>>;
    wallPaintSeparators?: WallPaintSeparatorMap;
    floorPaintSeparators?: FloorPaintSeparatorMap;
}

export interface ManagedInteriorReference {
    projectId: string;
    ownerId: string;
    interiorJsonPath?: string;
    interiorJsonUrl?: string;
}

export interface ManagedInteriorSaveInput {
    projectId: string;
    ownerId: string;
    projectName: string;
    estimatedCost: number;
    interiorData: ManagedInteriorPayload;
    hasMeaningfulChanges: boolean;
    updatedAt: unknown;
    createdAt?: unknown;
    uploadJson: (storagePath: string, json: string) => Promise<string>;
    uploadThumbnail?: () => Promise<{
        thumbnailPath: string;
        thumbnailUrl: string;
    } | undefined>;
    updateMetadata: (metadata: Record<string, unknown>) => Promise<void>;
}

export function hasMeaningfulManagedInteriorChanges(
    payload: ManagedInteriorPayload
): boolean {
    const hasFurniture = Array.isArray(payload.furniture) &&
        payload.furniture.some(item =>
            isRecord(item) &&
            typeof item.id === "string" &&
            item.id.trim() !== "" &&
            typeof item.assetId === "string" &&
            item.assetId.trim() !== ""
        );
    const hasFloorFinishes = isNonEmptyStringRecord(payload.floorFinishes);
    const hasWallFinishes = isRecord(payload.wallFinishes) &&
        Object.values(payload.wallFinishes).some(isNonEmptyStringRecord);
    const hasFloorData = Array.isArray(payload.floors) && payload.floors.some(floor =>
        (floor.furniture?.length ?? 0) > 0 ||
        isNonEmptyStringRecord(floor.floorFinishes) ||
        Object.values(floor.wallFinishes ?? {}).some(isNonEmptyStringRecord) ||
        Object.keys(floor.wallPaintSeparators ?? {}).length > 0 ||
        Object.keys(floor.floorPaintSeparators ?? {}).length > 0
    );
    return hasFurniture || hasFloorFinishes || hasWallFinishes || hasFloorData ||
        Object.keys(payload.wallPaintSeparators ?? {}).length > 0 ||
        Object.keys(payload.floorPaintSeparators ?? {}).length > 0 ||
        isValidProjectBudget(payload.maximumBudget);
}

export function getClientDesignLifecycleUpdate(
    existingMetadata: Record<string, unknown>,
    hasMeaningfulChanges: boolean,
    timestamp: unknown
): Record<string, unknown> {
    if (!hasMeaningfulChanges) return {};
    const lifecycleUpdate: Record<string, unknown> = {
        clientDesignStarted: true
    };
    if (!existingMetadata.clientDesignStartedAt) {
        lifecycleUpdate.clientDesignStartedAt = timestamp;
    }
    return lifecycleUpdate;
}

export interface ManagedInteriorState {
    projectBudget?: number | null;
    furniture: Array<{
        id: string;
        assetId: string;
        position: { x: number; y: number; z: number };
        rotationY: number;
        modelOffset: { x: number; y: number; z: number };
        width: number;
        depth: number;
        height: number;
    }>;
    floorFinishes: Record<string, string>;
    wallFinishes: Record<string, Record<string, string>>;
    wallPaintSeparators?: WallPaintSeparatorMap;
    floorPaintSeparators?: FloorPaintSeparatorMap;
    floors?: Array<{
        floorId: string;
        furniture: ManagedInteriorState["furniture"];
        floorFinishes: Record<string, string>;
        wallFinishes: Record<string, Record<string, string>>;
        wallPaintSeparators?: WallPaintSeparatorMap;
        floorPaintSeparators?: FloorPaintSeparatorMap;
    }>;
}

function cloneWallPaintSeparators(
    separators: WallPaintSeparatorMap | undefined
): WallPaintSeparatorMap | undefined {
    if (!separators) {
        return undefined;
    }

    return Object.fromEntries(
        Object.entries(separators).map(([faceKey, face]) => [
            faceKey,
            {
                ...face,
                separators: face.separators.map(separator => ({ ...separator })),
                sectionMaterials: { ...face.sectionMaterials }
            }
        ])
    );
}

function serializeFurniture(items: ManagedInteriorState["furniture"]) {
    return items.map(item => ({
        id: item.id,
        assetId: item.assetId,
        position: { x: item.position.x, y: item.position.y, z: item.position.z },
        rotationY: item.rotationY,
        modelOffset: { x: item.modelOffset.x, y: item.modelOffset.y, z: item.modelOffset.z },
        width: item.width,
        depth: item.depth,
        height: item.height
    }));
}

export function serializeManagedInteriorData(
    state: ManagedInteriorState,
    projectId: string,
    ownerId: string,
    costEstimate: unknown
): ManagedInteriorPayload {
    const firstFloor = state.floors?.[0];
    return {
        projectId,
        ownerId,
        furniture: serializeFurniture(firstFloor?.furniture ?? state.furniture),
        floorFinishes: { ...(firstFloor?.floorFinishes ?? state.floorFinishes) },
        wallFinishes: Object.fromEntries(
            Object.entries(firstFloor?.wallFinishes ?? state.wallFinishes).map(([regionId, walls]) => [
                regionId,
                { ...walls }
            ])
        ),
        ...(cloneWallPaintSeparators(
            firstFloor?.wallPaintSeparators ?? state.wallPaintSeparators
        )
            ? {
                wallPaintSeparators: cloneWallPaintSeparators(
                    firstFloor?.wallPaintSeparators ?? state.wallPaintSeparators
                )
            }
            : {}),
        ...(cloneWallPaintSeparators(
            firstFloor?.floorPaintSeparators ?? state.floorPaintSeparators
        )
            ? {
                floorPaintSeparators: cloneWallPaintSeparators(
                    firstFloor?.floorPaintSeparators ?? state.floorPaintSeparators
                )
            }
            : {}),
        ...(state.floors ? {
            floors: state.floors.map(floor => ({
                floorId: floor.floorId,
                furniture: serializeFurniture(floor.furniture),
                floorFinishes: { ...floor.floorFinishes },
                wallFinishes: Object.fromEntries(
                    Object.entries(floor.wallFinishes).map(([regionId, walls]) => [
                        regionId,
                        { ...walls }
                    ])
                ),
                ...(cloneWallPaintSeparators(floor.wallPaintSeparators)
                    ? {
                        wallPaintSeparators: cloneWallPaintSeparators(
                            floor.wallPaintSeparators
                        )
                    }
                    : {})
                ,
                ...(cloneWallPaintSeparators(floor.floorPaintSeparators)
                    ? {
                        floorPaintSeparators: cloneWallPaintSeparators(
                            floor.floorPaintSeparators
                        )
                    }
                    : {})
            }))
        } : {}),
        costEstimate,
        ...(isValidProjectBudget(state.projectBudget)
            ? { maximumBudget: state.projectBudget }
            : {})
    };
}

export function getManagedInteriorStoragePath(
    ownerId: string,
    projectId: string
): string {
    const normalizedOwnerId = ownerId.trim();
    const normalizedProjectId = projectId.trim();
    if (!normalizedOwnerId || !normalizedProjectId) {
        throw new Error("Project ID and client owner UID are required.");
    }

    return `projects/${normalizedOwnerId}/${normalizedProjectId}.interior.json`;
}

export function validateManagedInteriorPayload(
    value: unknown,
    reference: ManagedInteriorReference
): ManagedInteriorPayload {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Interior design file is not a valid JSON object.");
    }

    const payload = value as ManagedInteriorPayload;
    if (payload.projectId !== undefined && payload.projectId !== reference.projectId) {
        throw new Error("Interior design project ID does not match the selected project.");
    }
    if (payload.ownerId !== undefined && payload.ownerId !== reference.ownerId) {
        throw new Error("Interior design owner UID does not match the client project.");
    }
    if (payload.furniture !== undefined && !Array.isArray(payload.furniture)) {
        throw new Error("Interior design furniture data is invalid.");
    }
    if (
        payload.floorFinishes !== undefined &&
        !isStringRecord(payload.floorFinishes)
    ) {
        throw new Error("Interior design floor finishes are invalid.");
    }
    if (
        payload.wallFinishes !== undefined &&
        !isStringRecordOfStringRecords(payload.wallFinishes)
    ) {
        throw new Error("Interior design wall finishes are invalid.");
    }
    if (
        payload.wallPaintSeparators !== undefined &&
        !isWallPaintSeparatorMap(payload.wallPaintSeparators)
    ) {
        throw new Error("Interior design wall paint separators are invalid.");
    }
    if (
        payload.floorPaintSeparators !== undefined &&
        !isWallPaintSeparatorMap(payload.floorPaintSeparators)
    ) {
        throw new Error("Interior design floor separators are invalid.");
    }
    if (payload.floors !== undefined && (
        !Array.isArray(payload.floors) ||
        payload.floors.some(floor =>
            !isRecord(floor) ||
            typeof floor.floorId !== "string" ||
            !floor.floorId.trim() ||
            (floor.furniture !== undefined &&
                !Array.isArray(floor.furniture)) ||
            (floor.floorFinishes !== undefined &&
                !isStringRecord(floor.floorFinishes)) ||
            (floor.wallFinishes !== undefined &&
                !isStringRecordOfStringRecords(floor.wallFinishes)) ||
            (floor.wallPaintSeparators !== undefined &&
                !isWallPaintSeparatorMap(floor.wallPaintSeparators)) ||
            (floor.floorPaintSeparators !== undefined &&
                !isWallPaintSeparatorMap(floor.floorPaintSeparators))
        )
    )) {
        throw new Error("Interior design floor data is invalid.");
    }
    if (
        payload.maximumBudget !== undefined &&
        payload.maximumBudget !== null &&
        !isValidProjectBudget(payload.maximumBudget)
    ) {
        throw new Error("Interior design project budget is invalid.");
    }

    return payload;
}

export async function loadManagedInteriorData(
    reference: ManagedInteriorReference,
    fetcher: typeof fetch = fetch
): Promise<ManagedInteriorPayload | null> {
    const url = reference.interiorJsonUrl?.trim();
    if (!url) {
        if (reference.interiorJsonPath) {
            throw new Error("Interior design metadata has a path but no download URL.");
        }
        return null;
    }

    const expectedPath = getManagedInteriorStoragePath(
        reference.ownerId,
        reference.projectId
    );
    if (
        reference.interiorJsonPath &&
        reference.interiorJsonPath !== expectedPath
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

    return validateManagedInteriorPayload(await response.json(), reference);
}

export async function saveManagedInteriorData(
    input: ManagedInteriorSaveInput
): Promise<{ storagePath: string; downloadUrl: string }> {
    const ownerId = input.ownerId.trim();
    const projectId = input.projectId.trim();
    const storagePath = getManagedInteriorStoragePath(ownerId, projectId);
    const interiorData = validateManagedInteriorPayload(input.interiorData, {
        projectId,
        ownerId
    });
    if (
        input.hasMeaningfulChanges !==
        hasMeaningfulManagedInteriorChanges(interiorData)
    ) {
        throw new Error("Interior design lifecycle state does not match the saved changes.");
    }
    const downloadUrl = await input.uploadJson(
        storagePath,
        JSON.stringify(interiorData, null, 2)
    );
    if (!downloadUrl.trim()) {
        throw new Error("Interior design upload did not return a download URL.");
    }

    const thumbnail = await input.uploadThumbnail?.();
    const metadata: Record<string, unknown> = {
        projectId,
        ownerId,
        schemaVersion: 1,
        estimatedCost: input.estimatedCost,
        updatedAt: input.updatedAt,
        interiorJsonPath: storagePath,
        interiorJsonUrl: downloadUrl
    };
    if (input.hasMeaningfulChanges) {
        metadata.clientDesignStarted = true;
    }
    if (input.createdAt !== undefined) {
        metadata.createdAt = input.createdAt;
    }
    if (thumbnail) {
        metadata.thumbnailPath = thumbnail.thumbnailPath;
        metadata.thumbnailUrl = thumbnail.thumbnailUrl;
    }

    await input.updateMetadata(metadata);
    return { storagePath, downloadUrl };
}

export function mergeManagedInteriorData<T extends object>(
    publishedStructure: T,
    interiorPayload: ManagedInteriorPayload | null | undefined
): T & Omit<ManagedInteriorPayload, "floors"> {
    const publishedInteriorFields = publishedStructure as T & Partial<ManagedInteriorPayload>;
    const project = publishedStructure as T & {
        floors?: Array<Record<string, unknown> & { floorId?: string; id?: string }>;
    };
    const interiorFloors = new Map(
        (interiorPayload?.floors ?? []).map(floor => [floor.floorId, floor])
    );
    const structuralFloors = Array.isArray(project.floors)
        ? project.floors.map((floor, index) => {
            const floorId = floor.floorId ?? floor.id ?? (index === 0 ? "first-floor" : "");
            const interior = interiorFloors.get(floorId);
            return interior
                ? {
                    ...floor,
                    floorId,
                    ...(interior.furniture !== undefined
                        ? { furniture: interior.furniture }
                        : {}),
                    ...(interior.floorFinishes !== undefined
                        ? { floorFinishes: interior.floorFinishes }
                        : {}),
                    ...(interior.wallFinishes !== undefined
                        ? { wallFinishes: interior.wallFinishes }
                        : {}),
                    wallPaintSeparators: interior.wallPaintSeparators ?? {},
                    floorPaintSeparators: interior.floorPaintSeparators ?? {}
                }
                : floor;
        })
        : undefined;
    const firstFloor = structuralFloors?.[0];
    const firstInteriorFloor = firstFloor
        ? interiorFloors.get(String(firstFloor.floorId))
        : undefined;
    return {
        ...publishedStructure,
        ...(structuralFloors ? { floors: structuralFloors } : {}),
        furniture: Array.isArray(interiorPayload?.furniture)
            ? interiorPayload.furniture
            : firstInteriorFloor?.furniture ??
                publishedInteriorFields.furniture ??
                [],
        floorFinishes: interiorPayload?.floorFinishes ??
            firstInteriorFloor?.floorFinishes ??
            publishedInteriorFields.floorFinishes ??
            {},
        wallFinishes: interiorPayload?.wallFinishes ??
            firstInteriorFloor?.wallFinishes ??
            publishedInteriorFields.wallFinishes ??
            {},
        wallPaintSeparators:
            interiorPayload?.wallPaintSeparators ??
            firstInteriorFloor?.wallPaintSeparators ??
            publishedInteriorFields.wallPaintSeparators ??
            {},
        floorPaintSeparators:
            interiorPayload?.floorPaintSeparators ??
            firstInteriorFloor?.floorPaintSeparators ??
            publishedInteriorFields.floorPaintSeparators ??
            {},
        maximumBudget: isValidProjectBudget(interiorPayload?.maximumBudget)
            ? interiorPayload.maximumBudget
            : null
    };
}

export function canMutateManagedStructure(workflowType: string | undefined): boolean {
    return workflowType !== "admin-managed";
}

function isStringRecord(value: unknown): value is Record<string, string> {
    return Boolean(
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.values(value).every(item => typeof item === "string")
    );
}

function isNonEmptyStringRecord(value: unknown): boolean {
    return Boolean(
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length > 0 &&
        Object.values(value).every(item => typeof item === "string" && item.trim() !== "")
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isStringRecordOfStringRecords(
    value: unknown
): value is Record<string, Record<string, string>> {
    return Boolean(
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.values(value).every(isStringRecord)
    );
}
