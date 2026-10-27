
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where
} from "firebase/firestore";

import { auth, db } from "@/firebase/firebase";

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
    ownerName?: string;
    jsonPath: string;
    jsonUrl: string;
    draftJsonPath?: string;
    draftJsonUrl?: string;
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
// MAP PROJECT
//==================================================

function mapProject(
    projectDocument: {
        id: string;
        data(): Record<string, unknown>;
    }
): AdminProject {
    const data = projectDocument.data();

    const totalCost = Number(data.totalCost);
    const estimatedCost = Number(data.estimatedCost);

    return {
        projectId:
            typeof data.projectId === "string"
                ? data.projectId
                : projectDocument.id,

        projectName:
            typeof data.projectName === "string"
                ? data.projectName
                : "Unnamed Project",

        ownerId:
            typeof data.ownerId === "string"
                ? data.ownerId
                : "",

        workflowType:
            data.workflowType === "admin-managed"
                ? "admin-managed"
                : data.workflowType === "legacy"
                    ? "legacy"
                    : undefined,

        structuralOwner:
            data.structuralOwner === "admin"
                ? "admin"
                : undefined,

        structuralStatus:
            data.structuralStatus === "draft" || data.structuralStatus === "published"
                ? data.structuralStatus
                : undefined,

        structuralRevision:
            typeof data.structuralRevision === "number"
                ? data.structuralRevision
                : undefined,

        publishedStructuralRevision:
            typeof data.publishedStructuralRevision === "number"
                ? data.publishedStructuralRevision
                : undefined,

        structureInitialized:
            typeof data.structureInitialized === "boolean"
                ? data.structureInitialized
                : undefined,

        ownerName:
            typeof data.ownerName === "string"
                ? data.ownerName
                : undefined,

        jsonPath:
            typeof data.jsonPath === "string"
                ? data.jsonPath
                : "",

        jsonUrl:
            typeof data.jsonUrl === "string"
                ? data.jsonUrl
                : "",

        draftJsonPath:
            typeof data.draftJsonPath === "string"
                ? data.draftJsonPath
                : undefined,

        draftJsonUrl:
            typeof data.draftJsonUrl === "string"
                ? data.draftJsonUrl
                : undefined,

        thumbnailPath:
            typeof data.thumbnailPath === "string"
                ? data.thumbnailPath
                : undefined,

        thumbnailUrl:
            typeof data.thumbnailUrl === "string"
                ? data.thumbnailUrl
                : undefined,

        schemaVersion:
            typeof data.schemaVersion === "number"
                ? data.schemaVersion
                : 1,

        createdAt: data.createdAt,
        updatedAt: data.updatedAt,

        deadline:
            typeof data.deadline === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(data.deadline)
                ? data.deadline
                : null,

        totalCost:
            Number.isFinite(totalCost)
                ? totalCost
                : undefined,

        estimatedCost:
            Number.isFinite(estimatedCost)
                ? estimatedCost
                : undefined
    };
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

export async function getAdminClients(): Promise<AdminClient[]> {
    const snapshot = await getDocs(collection(db, "users"));

    return snapshot.docs.map(document => {
        const data = document.data();
        const uid = typeof data.uid === "string" && data.uid.trim() !== ""
            ? data.uid.trim()
            : document.id;

        return {
            id: document.id,
            uid,
            name: typeof data.full_name === "string"
                ? data.full_name
                : typeof data.name === "string"
                    ? data.name
                    : "Unknown User",
            email: typeof data.email === "string" ? data.email : undefined
        };
    });
}

export async function getAdminProjects():
    Promise<AdminProject[]> {
    const [
        projectsSnapshot,
        usersSnapshot,
        employeesSnapshot
    ] = await Promise.all([
        getDocs(collection(db, "projects")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "adminEmployees"))
    ]);

    const owners = new Map<string, string>();

    usersSnapshot.docs.forEach(document => {
        const data = document.data();

        const uid =
            typeof data.uid === "string" &&
            data.uid.trim() !== ""
                ? data.uid.trim()
                : document.id;

        const name =
            typeof data.full_name === "string" &&
            data.full_name.trim() !== ""
                ? data.full_name.trim()
                : typeof data.name === "string" &&
                    data.name.trim() !== ""
                    ? data.name.trim()
                    : typeof data.email === "string" &&
                        data.email.trim() !== ""
                        ? data.email.trim()
                        : "Unknown User";

        owners.set(uid, name);
    });

    employeesSnapshot.docs.forEach(document => {
        const data = document.data();

        const uid =
            typeof data.uid === "string" &&
            data.uid.trim() !== ""
                ? data.uid.trim()
                : document.id;

        const name =
            typeof data.name === "string" &&
            data.name.trim() !== ""
                ? data.name.trim()
                : typeof data.full_name === "string" &&
                    data.full_name.trim() !== ""
                    ? data.full_name.trim()
                    : typeof data.email === "string" &&
                        data.email.trim() !== ""
                        ? data.email.trim()
                        : "Unknown Employee";

        owners.set(uid, name);
    });

    const projects: AdminProject[] = [];

    projectsSnapshot.docs.forEach(projectDocument => {
        const project = mapProject(projectDocument);

        projects.push({
            ...project,
            ownerName:
                owners.get(project.ownerId) ??
                project.ownerName ??
                "Unknown User"
        });
    });

    projects.sort(
        (first, second) =>
            getProjectTime(second.updatedAt) -
            getProjectTime(first.updatedAt)
    );

    return projects;
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

    const projectsQuery = query(
        collection(db, "projects"),
        where("ownerId", "==", normalizedOwnerId)
    );

    const snapshot = await getDocs(projectsQuery);

    const projects = snapshot.docs.map(
        projectDocument => mapProject(projectDocument)
    );

    projects.sort(
        (first, second) =>
            getProjectTime(second.updatedAt) -
            getProjectTime(first.updatedAt)
    );

    return projects;
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

    const userReference = doc(
        db,
        "users",
        normalizedAccountId
    );

    const userSnapshot = await getDoc(userReference);

    let ownerId = normalizedAccountId;

    if (userSnapshot.exists()) {
        const userData = userSnapshot.data();

        if (
            typeof userData.uid === "string" &&
            userData.uid.trim() !== ""
        ) {
            ownerId = userData.uid.trim();
        }
    }

    return getUserProjects(ownerId);
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

    const projectReference = doc(
        db,
        "projects",
        normalizedProjectId
    );

    const snapshot = await getDoc(projectReference);

    if (!snapshot.exists()) {
        throw new Error("Project does not exist.");
    }

    return mapProject(snapshot);
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
