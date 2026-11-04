export function isAvailableStudioProject(
    metadata: Record<string, unknown>
): boolean {
    if (metadata.workflowType !== "admin-managed") {
        return true;
    }

    return metadata.structuralStatus === "published" &&
        typeof metadata.publishedStructuralRevision === "number" &&
        metadata.publishedStructuralRevision >= 1;
}
