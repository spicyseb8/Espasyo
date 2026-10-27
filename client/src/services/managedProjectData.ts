export interface ManagedInteriorPayload {
    furniture?: unknown[];
    floorFinishes?: Record<string, string>;
    wallFinishes?: Record<string, Record<string, string>>;
}

export function mergeManagedInteriorData<T extends Record<string, unknown>>(
    publishedStructure: T,
    interiorPayload: ManagedInteriorPayload | null | undefined
): T & ManagedInteriorPayload {
    return {
        ...publishedStructure,
        furniture: Array.isArray(interiorPayload?.furniture)
            ? interiorPayload.furniture
            : [],
        floorFinishes: interiorPayload?.floorFinishes ?? {},
        wallFinishes: interiorPayload?.wallFinishes ?? {}
    };
}

export function canMutateManagedStructure(workflowType: string | undefined): boolean {
    return workflowType !== "admin-managed";
}
