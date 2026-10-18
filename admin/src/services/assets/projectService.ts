
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    updateDoc,
    serverTimestamp
} from "firebase/firestore";

import {
    db
} from "@/firebase/firebase";

export interface AdminProject {
    projectId: string;
    projectName: string;
    ownerId: string;
    ownerName?: string;
    jsonPath: string;
    jsonUrl: string;
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
    const today = new Date();

    const year = today.getFullYear();
    const month = String(
        today.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        today.getDate()
    ).padStart(2, "0");

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

    const parsed = new Date(
        `${deadline}T00:00:00`
    );

    if (
        Number.isNaN(parsed.getTime()) ||
        parsed.getFullYear() !== Number(deadline.slice(0, 4)) ||
        parsed.getMonth() + 1 !== Number(deadline.slice(5, 7)) ||
        parsed.getDate() !== Number(deadline.slice(8, 10))
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

    const projectReference = doc(
        db,
        "projects",
        normalizedProjectId
    );

    // Verify the document exists before updating it.
    const snapshot = await getDoc(projectReference);

    if (!snapshot.exists()) {
        throw new Error("Project does not exist.");
    }

    await updateDoc(projectReference, {
        deadline,
        updatedAt: serverTimestamp()
    });
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
