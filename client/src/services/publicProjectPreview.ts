import type { SavedProjectData } from "../context/editor/ProjectTypes";
import { projectApi } from "./projectApi";

export type PublicProjectSceneData = Omit<
    SavedProjectData,
    "projectId" | "ownerId" | "savedAt" | "blueprint"
>;

export interface PublicProjectPreview {
    publicId: string;
    title: string;
    projectData: PublicProjectSceneData;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPublicProjectSceneData(value: unknown): value is PublicProjectSceneData {
    if (
        !isRecord(value) ||
        typeof value.projectName !== "string" ||
        !Number.isFinite(value.schemaVersion) ||
        !Number.isFinite(value.wallHeight) ||
        !Number.isFinite(value.wallThickness) ||
        !Number.isFinite(value.gridSize) ||
        typeof value.snapEnabled !== "boolean" ||
        typeof value.layoutConfirmed !== "boolean" ||
        !Number.isFinite(value.archRise) ||
        !Number.isFinite(value.openingWidth) ||
        !Number.isFinite(value.openingHeight) ||
        !isRecord(value.floorFinishes) ||
        !Object.values(value.floorFinishes).every(item => typeof item === "string") ||
        !isRecord(value.wallFinishes) ||
        !Object.values(value.wallFinishes).every(item =>
            isRecord(item) && Object.values(item).every(material => typeof material === "string")
        )
    ) {
        return false;
    }
    const hasValidSceneArrays = (scene: Record<string, unknown>) =>
        ["walls", "corners", "doors", "windows", "furniture", "openings"]
            .every(field => scene[field] === undefined || Array.isArray(scene[field]));
    if (!hasValidSceneArrays(value)) return false;
    return value.floors === undefined || (
        Array.isArray(value.floors) &&
        value.floors.every(floor =>
            isRecord(floor) &&
            typeof floor.floorId === "string" &&
            typeof floor.name === "string" &&
            isRecord(floor.structure) &&
            hasValidSceneArrays(floor.structure)
        )
    );
}

export async function getPublicProjectPreview(
    publicId: string,
    signal?: AbortSignal
): Promise<PublicProjectPreview> {
    const result = await projectApi<{
        publicId: string;
        title: string;
        projectData: unknown;
    }>(
        `/projects/public/${encodeURIComponent(publicId)}`,
        { cache: "no-store", signal }
    );
    if (
        result.publicId !== publicId ||
        typeof result.title !== "string" ||
        !/^Design Inspiration #\d+$/.test(result.title) ||
        !isPublicProjectSceneData(result.projectData)
    ) {
        throw new Error("The public design response is invalid.");
    }
    return {
        publicId: result.publicId,
        title: result.title,
        projectData: result.projectData
    };
}

export function toEditorProjectData(
    preview: PublicProjectPreview
): SavedProjectData {
    return {
        ...preview.projectData,
        projectId: "public-preview",
        ownerId: "public-preview",
        projectName: preview.title,
        savedAt: "",
        blueprint: null
    };
}
