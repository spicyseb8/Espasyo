
import { auth } from "@/firebase/firebase";
import { classifyProjectLifecycle } from "./projectLifecycle";
import { projectApi } from "./projectApi";

export interface AdminProject {
    projectId: string;
    projectName: string;
    ownerId: string;
    workflowType?: "legacy" | "admin-managed";
    structuralOwner?: "admin";
    structuralStatus?: "draft" | "published";
    structuralRevision?: number;
    publishedStructuralRevision?: number;
    structureInitialized?: boolean;
    createdBy?: string;
    creatorName?: string;
    intendedClientId?: string;
    intendedClientEmail?: string;
    recordType?: "project" | "draft";
    lifecycleAssignmentId?: string | null;
    ownerName?: string;
    jsonPath: string;
    jsonUrl: string;
    draftJsonPath?: string;
    draftJsonUrl?: string;
    interiorJsonPath?: string;
    interiorJsonUrl?: string;
    clientDesignStarted?: boolean;
    clientDesignStartedAt?: unknown;
    lifecycleStatus?: import("./projectLifecycle").ProjectLifecycleStatus;
    lifecycleError?: string;
    thumbnailPath?: string;
    thumbnailUrl?: string;
    schemaVersion: number;
    createdAt?: unknown;
    updatedAt?: unknown;
    totalCost?: number;
    estimatedCost?: number;

    // Calendar deadline stored as YYYY-MM-DD.
    deadline?: string | null;
}

//==================================================
// LOCAL DATE
//==================================================

export function getTodayLocalDate(): string {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const year = parts.find(part => part.type === "year")?.value;
    const month = parts.find(part => part.type === "month")?.value;
    const day = parts.find(part => part.type === "day")?.value;

    return `${year}-${month}-${day}`;
}

//==================================================
// DEADLINE VALIDATION
//==================================================

export function isValidProjectDeadline(
    deadline: string
): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
        return false;
    }

    const [year, month, day] = deadline.split("-").map(Number);
    const isLeapYear =
        year % 4 === 0 &&
        (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [
        31,
        isLeapYear ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31
    ];

    if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > daysInMonth[month - 1]
    ) {
        return false;
    }

    // YYYY-MM-DD strings can be compared chronologically.
    return deadline >= getTodayLocalDate();
}

//==================================================
// SAVE PROJECT DEADLINE
//==================================================

export async function updateProjectDeadline(
    projectId: string,
    deadline: string | null
): Promise<void> {
    const normalizedProjectId = projectId.trim();

    if (!normalizedProjectId) {
        throw new Error("Project ID is required.");
    }

    if (
        deadline !== null &&
        !isValidProjectDeadline(deadline)
    ) {
        throw new Error(
            "The deadline must be today or a future date."
        );
    }

    const currentUser = auth.currentUser;

    if (!currentUser) {
        throw new Error("Sign in with an admin account to update deadlines.");
    }

    const token = await currentUser.getIdToken();
    const response = await fetch(
        `http://localhost:5000/api/projects/${encodeURIComponent(normalizedProjectId)}/deadline`,
        {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ deadline })
        }
    );

    const result = await response.json() as {
        success?: boolean;
        message?: string;
    };

    if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update project deadline.");
    }
}

//==================================================
// GET ALL PROJECTS
//==================================================

export interface AdminClient {
    id: string;
    uid: string;
    name: string;
    email?: string;
}

export interface AdminClientSearchResult {
    clients: AdminClient[];
    hasIneligibleMatches: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function getAdminClients(search = ""): Promise<AdminClientSearchResult> {
    const response = await projectApi<AdminClientSearchResult>(
        `/admin/floor-plan-clients?search=${encodeURIComponent(search.trim())}`
    );
    return {
        clients: response.clients,
        hasIneligibleMatches: response.hasIneligibleMatches
    };
}

async function finalizeManagedProjectLifecycle(projects: AdminProject[]): Promise<AdminProject[]> {
    await Promise.all(projects.map(async project => {
        if (project.recordType === "draft") {
            project.lifecycleStatus = "unverified";
            return;
        }
        if (project.workflowType !== "admin-managed") {
            project.lifecycleStatus = "legacy";
            return;
        }

        try {
            let interiorData: unknown;
            if (
                project.clientDesignStarted === undefined &&
                (project.interiorJsonPath || project.interiorJsonUrl)
            ) {
                const expectedPath = `projects/${project.ownerId}/${project.projectId}.interior.json`;
                if (project.interiorJsonPath && project.interiorJsonPath !== expectedPath) {
                    throw new Error("Interior design path does not match the designated project.");
                }
                if (!project.interiorJsonUrl?.trim()) {
                    throw new Error("Interior design URL is missing.");
                }
                const response = await fetch(project.interiorJsonUrl, {
                    method: "GET",
                    cache: "no-store"
                });
                if (response.status !== 404) {
                    if (!response.ok) {
                        throw new Error(`Interior design request failed with HTTP ${response.status}.`);
                    }
                    interiorData = await response.json();
                    if (!isRecord(interiorData)) {
                        throw new Error("Interior design JSON is invalid.");
                    }
                    if (interiorData.projectId !== undefined && interiorData.projectId !== project.projectId) {
                        throw new Error("Interior design project ID does not match.");
                    }
                    if (interiorData.ownerId !== undefined && interiorData.ownerId !== project.ownerId) {
                        throw new Error("Interior design owner UID does not match.");
                    }
                }
            }

            project.lifecycleStatus = classifyProjectLifecycle(
                project,
                project.lifecycleAssignmentId === project.projectId ? project.projectId : null,
                interiorData
            );
        } catch (error) {
            project.lifecycleStatus = "unverified";
            project.lifecycleError = error instanceof Error
                ? error.message
                : "Unable to verify saved client design data.";
            console.error(`Unable to classify managed project ${project.projectId}:`, error);
        }
    }));

    return projects.sort(
        (first, second) =>
            getProjectTime(second.updatedAt) - getProjectTime(first.updatedAt)
    );
}

export async function getAdminProjects(): Promise<AdminProject[]> {
    const response = await projectApi<{ projects: AdminProject[] }>("/admin/projects");
    return finalizeManagedProjectLifecycle(response.projects);
}

export async function getAdminFloorPlans(): Promise<AdminProject[]> {
    const response = await projectApi<{ projects: AdminProject[] }>("/admin/floor-plans");
    return response.projects
        .filter(project => project.structuralStatus === "draft")
        .sort(
            (first, second) =>
                getProjectTime(second.updatedAt) - getProjectTime(first.updatedAt)
        );
}

//==================================================
// GET PROJECTS FOR USER
//==================================================

export async function getUserProjects(
    ownerId: string
): Promise<AdminProject[]> {
    const normalizedOwnerId = ownerId.trim();

    if (!normalizedOwnerId) {
        return [];
    }
    const response = await projectApi<{ projects: AdminProject[] }>(
        `/admin/users/${encodeURIComponent(normalizedOwnerId)}/projects`
    );
    return response.projects;
}

//==================================================
// GET PROJECTS FOR ACCOUNT
//==================================================

export async function getProjectsForUserAccount(
    accountId: string
): Promise<AdminProject[]> {
    const normalizedAccountId = accountId.trim();

    if (!normalizedAccountId) {
        return [];
    }

    return getUserProjects(normalizedAccountId);
}

//==================================================
// GET ONE PROJECT
//==================================================

export async function getAdminProject(
    projectId: string
): Promise<AdminProject> {
    const normalizedProjectId = projectId.trim();

    if (!normalizedProjectId) {
        throw new Error("Project ID is required.");
    }

    const response = await projectApi<{ project: AdminProject }>(
        `/admin/projects/${encodeURIComponent(normalizedProjectId)}`
    );
    return response.project;
}

//==================================================
// TIMESTAMP HELPER
//==================================================

function getProjectTime(value: unknown): number {
    if (!value) {
        return 0;
    }

    if (
        typeof value === "object" &&
        value !== null &&
        "toMillis" in value &&
        typeof (
            value as { toMillis: unknown }
        ).toMillis === "function"
    ) {
        return (
            value as { toMillis: () => number }
        ).toMillis();
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    if (typeof value === "string") {
        const date = new Date(value);

        if (!Number.isNaN(date.getTime())) {
            return date.getTime();
        }
    }

    return 0;
}
