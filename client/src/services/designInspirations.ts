import { projectApi, projectApiBlob } from "./projectApi";

export interface DesignInspiration {
    publicId: string;
    title: string;
    thumbnailUrl?: string;
    thumbnailObjectUrl?: string;
}

export interface DesignInspirationPage {
    designs: DesignInspiration[];
    nextCursor: string | null;
    hasMore: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isDesignInspiration(value: unknown): value is DesignInspiration {
    if (!isRecord(value)) return false;
    const design = value;
    return typeof design.publicId === "string" &&
        design.publicId.length > 0 &&
        typeof design.title === "string" &&
        /^Design Inspiration #\d+$/.test(design.title) &&
        (design.thumbnailUrl === undefined || typeof design.thumbnailUrl === "string");
}

export async function getDesignInspirationPage(
    limit = 12,
    cursor?: string | null,
    signal?: AbortSignal,
): Promise<DesignInspirationPage> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    const result = await projectApi<{
        designs: unknown;
        nextCursor: unknown;
        hasMore: unknown;
    }>(`/projects/public?${params}`, {
        cache: "no-store",
        signal,
    });
    if (
        !Array.isArray(result.designs) ||
        !result.designs.every(isDesignInspiration) ||
        (result.nextCursor !== null && typeof result.nextCursor !== "string") ||
        typeof result.hasMore !== "boolean"
    ) {
        throw new Error("The design inspiration response is invalid.");
    }
    return {
        designs: result.designs,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
    };
}

export async function getDesignInspirationThumbnail(
    publicId: string,
    signal?: AbortSignal,
): Promise<Blob> {
    return projectApiBlob(
        `/projects/public/${encodeURIComponent(publicId)}/thumbnail`,
        { cache: "no-store", signal },
    );
}
