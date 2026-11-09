
import { auth } from "@/firebase/firebase";
import { classifyProjectLifecycle } from "./projectLifecycle";
import { API_BASE_URL, projectApi } from "./projectApi";

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
    hasPublishedStructure?: boolean;
    hasDraftStructure?: boolean;
    hasInterior?: boolean;
    jsonPath?: string;
    jsonUrl?: string;
    clientDesignStarted?: boolean;
    clientDesignStartedAt?: unknown;
    projectStatus?: "available" | "ongoing" | "submitted" | "revision-requested" | "approved";
    publicConsent?: boolean;
    publicConsentAt?: string | null;
    isPublic?: boolean;
    currentDesignVersionId?: string;
    currentDesignVersionNumber?: number;
    submittedVersionId?: string;
    submittedVersionNumber?: number;
    submittedAt?: unknown;
    submittedSubmissionId?: string;
    approvedAt?: unknown;
    approvedBy?: string;
    approvedByName?: string;
    approvedVersionNumber?: number;
    approvedSubmissionId?: string;
    reviewSnapshotType?: "latest-saved" | "submitted" | "approved";
    revisionFeedback?: string;
    revisionRequestedAt?: unknown;
    lifecycleStatus?: import("./projectLifecycle").ProjectLifecycleStatus;
    lifecycleError?: string;
    thumbnailPath?: string;
    thumbnailUrl?: string;
    schemaVersion: number;
    createdAt?: unknown;
    updatedAt?: unknown;
    totalCost?: number;
    estimatedCost?: number;

    // Manila local deadline; legacy records may contain only YYYY-MM-DD.
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
    const date = deadline.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
    }

    if (
        deadline !== date &&
        !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(deadline)
    ) {
        return false;
    }

    const [year, month, day] = date.split("-").map(Number);
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
    return date > getTodayLocalDate();
}

export function getTomorrowLocalDateTime(): string {
    const [year, month, day] = getTodayLocalDate().split("-").map(Number);
    const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
    const date = [
        tomorrow.getUTCFullYear(),
        String(tomorrow.getUTCMonth() + 1).padStart(2, "0"),
        String(tomorrow.getUTCDate()).padStart(2, "0")
    ].join("-");
    return `${date}T00:00`;
}

export function normalizeProjectDeadlineForInput(value: string | null | undefined): string {
    if (!value) return "";
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59` : value;
}

//==================================================
// SAVE PROJECT DEADLINE
//==================================================

export async function updateProjectDeadline(
    projectId: string,
    deadline: string,
    reason = ""
): Promise<void> {
    const normalizedProjectId = projectId.trim();

    if (!normalizedProjectId) {
        throw new Error("Project ID is required.");
    }

    if (
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
        `${API_BASE_URL}/projects/${encodeURIComponent(normalizedProjectId)}/deadline`,
        {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ deadline, reason })
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
    eligible: boolean;
    existingProjectId?: string;
    existingDraftId?: string;
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
                project.hasInterior === true
            ) {
                interiorData = await projectApi<unknown>(
                    `/admin/projects/${encodeURIComponent(project.projectId)}/files/interior`
                );
                if (isRecord(interiorData)) {
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

export async function reviewAdminProject(
    projectId: string,
    action: "approve" | "request-revision",
    reason?: string
): Promise<void> {
    await projectApi(
        `/admin/projects/${encodeURIComponent(projectId)}/review`,
        {
            method: "POST",
            body: JSON.stringify({ action, reason })
        }
    );
}

export async function setAdminProjectPublicVisibility(
    projectId: string,
    isPublic: boolean
): Promise<{ isPublic: boolean; publicId: string | null }> {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
        throw new Error("Project ID is required.");
    }

    const response = await projectApi<{
        isPublic: boolean;
        publicId: string | null;
    }>(
        `/admin/projects/${encodeURIComponent(normalizedProjectId)}/public-visibility`,
        {
            method: "PATCH",
            body: JSON.stringify({ isPublic })
        }
    );
    return {
        isPublic: response.isPublic,
        publicId: response.publicId
    };
}

export async function getAdminProjectActivity(projectId: string): Promise<{
    id: string;
    action: string;
    actorId: string;
    actorRole: string;
    actorName?: string;
    description?: string;
    versionId?: string;
    previousValue?: unknown;
    newValue?: unknown;
    createdAt: unknown;
}[]> {
    const response = await projectApi<{
        activities: {
            id: string;
            action: string;
            actorId: string;
            actorRole: string;
            actorName?: string;
            description?: string;
            versionId?: string;
            previousValue?: unknown;
            newValue?: unknown;
            createdAt: unknown;
        }[];
    }>(`/admin/projects/${encodeURIComponent(projectId)}/activity`);
    return response.activities;
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
