import {
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";

import {
    db
} from "../../firebase/firebase";

import type {
    SavedProjectData
} from "../../context/editor/ProjectTypes";
import {
    loadManagedInteriorData,
    mergeManagedInteriorData
} from "../../services/managedProjectData";
import { getClientManagedProjectFile } from "../../services/clientProjectWorkflow";


//==================================================
// PROJECT METADATA
//==================================================

export interface UserProject {

    projectId:
        string;

    projectName:
        string;

    ownerId:
        string;

    jsonPath:
        string;

    jsonUrl:
        string;

    schemaVersion:
        number;

    interiorJsonPath?:
        string;

    interiorJsonUrl?:
        string;

    workflowType?:
        "legacy" |
        "admin-managed";

    structuralStatus?:
        "draft" |
        "published";

    publishedStructuralRevision?:
        number;

    structuralRevision?:
        number;

    createdAt?:
        unknown;

    updatedAt?:
        unknown;
}


//==================================================
// GET USER PROJECTS
//==================================================
//
// Only project metadata is loaded here.
//
// The large project JSON is NOT downloaded yet.
//
// This keeps the "My Projects" page fast.
//==================================================

export async function getUserProjects(
    userId: string
): Promise<UserProject[]> {

    const projectsQuery =
        query(

            collection(
                db,
                "projects"
            ),

            where(
                "ownerId",
                "==",
                userId
            )

        );


    const snapshot =
        await getDocs(
            projectsQuery
        );


    const projects:
        UserProject[] = [];


    for (
        const document
        of snapshot.docs
    ) {

        const data =
            document.data() as
            Partial<UserProject>;

        if (
            data.workflowType === "admin-managed" &&
            (
                data.structuralStatus !== "published" ||
                typeof data.publishedStructuralRevision !== "number" ||
                data.publishedStructuralRevision < 1
            )
        ) {
            continue;
        }


        //--------------------------------------------------
        // Only accept valid project documents.
        //--------------------------------------------------

        if (
            typeof data.projectName !==
            "string"
        ) {
            continue;
        }


        if (
            typeof data.ownerId !==
            "string"
        ) {
            continue;
        }


        const workflowType = data.workflowType === "admin-managed"
            ? "admin-managed"
            : data.workflowType === "legacy"
                ? "legacy"
                : undefined;
        if (
            workflowType !== "admin-managed" &&
            (typeof data.jsonUrl !== "string" || data.jsonUrl.trim() === "")
        ) {
            continue;
        }


        projects.push({

            projectId:
                typeof data.projectId ===
                "string"

                    ? data.projectId

                    : document.id,

            projectName:
                data.projectName,

            ownerId:
                data.ownerId,

            jsonPath: workflowType === "admin-managed"
                ? ""
                : typeof data.jsonPath === "string" ? data.jsonPath : "",

            jsonUrl:
                workflowType === "admin-managed"
                    ? ""
                    : typeof data.jsonUrl === "string" ? data.jsonUrl : "",

            schemaVersion:
                typeof data.schemaVersion ===
                "number"

                    ? data.schemaVersion

                    : 1,

            workflowType,

            structuralStatus:
                data.structuralStatus === "published" || data.structuralStatus === "draft"
                    ? data.structuralStatus
                    : undefined,

            publishedStructuralRevision:
                typeof data.publishedStructuralRevision === "number"
                    ? data.publishedStructuralRevision
                    : undefined,

            structuralRevision:
                typeof data.structuralRevision === "number"
                    ? data.structuralRevision
                    : undefined,

            interiorJsonPath:
                workflowType !== "admin-managed" && typeof data.interiorJsonPath === "string"
                    ? data.interiorJsonPath
                    : undefined,

            interiorJsonUrl:
                workflowType !== "admin-managed" && typeof data.interiorJsonUrl === "string"
                    ? data.interiorJsonUrl
                    : undefined,

            createdAt:
                data.createdAt,

            updatedAt:
                data.updatedAt

        });

    }


    //--------------------------------------------------
    // Sort newest first.
    //
    // updatedAt may be a Firestore Timestamp.
    //--------------------------------------------------

    projects.sort(
        (
            first,
            second
        ) => {

            const firstTime =
                getTimestampMillis(
                    first.updatedAt
                );

            const secondTime =
                getTimestampMillis(
                    second.updatedAt
                );

            return (
                secondTime -
                firstTime
            );
        }
    );


    return projects;
}


//==================================================
// OPEN PROJECT JSON
//==================================================
//
// Downloads the actual saved project only when the
// user clicks Open.
//==================================================

export async function loadProjectData(
    project: UserProject
): Promise<SavedProjectData> {

    //--------------------------------------------------
    // Fetch saved JSON.
    //--------------------------------------------------

    let data: Record<string, unknown>;
    if (project.workflowType === "admin-managed") {
        data = await getClientManagedProjectFile(
            project.projectId,
            "structure"
        );
    } else {
        const response = await fetch(project.jsonUrl, { method: "GET" });
        if (!response.ok) {
            throw new Error(`Failed to download project JSON (${response.status}).`);
        }
        data = await response.json();
    }


    //--------------------------------------------------
    // Basic validation.
    //--------------------------------------------------

    if (
        !data ||
        typeof data !== "object"
    ) {

        throw new Error(
            "Project file is not valid JSON."
        );
    }


    if (
        typeof data.projectId !==
        "string"
    ) {

        throw new Error(
            "Project file is missing projectId."
        );
    }


    if (
        !Array.isArray(
            data.walls
        )
    ) {

        throw new Error(
            "Project file is missing walls."
        );
    }


    if (
        !Array.isArray(
            data.corners
        )
    ) {

        throw new Error(
            "Project file is missing corners."
        );
    }

    if (
        data.projectId !== project.projectId ||
        data.ownerId !== project.ownerId
    ) {
        throw new Error("Project JSON does not match the selected project owner and ID.");
    }

    let projectData = data as unknown as SavedProjectData;
    if (project.workflowType === "admin-managed") {
        if (
            project.structuralStatus !== "published" ||
            typeof project.publishedStructuralRevision !== "number" ||
            projectData.workflowType !== "admin-managed" ||
            projectData.structuralStatus !== "published" ||
            projectData.structuralRevision !== project.publishedStructuralRevision ||
            projectData.publishedStructuralRevision !== project.publishedStructuralRevision
        ) {
            throw new Error("The published structure does not match this project's revision.");
        }

        const interiorPayload = await loadManagedInteriorData({
            ...project,
            workflowType: "admin-managed"
        });
        projectData = mergeManagedInteriorData(
            projectData,
            interiorPayload
        ) as SavedProjectData;
    } else if (project.interiorJsonUrl || project.interiorJsonPath) {
        const interiorPayload = await loadManagedInteriorData(project);
        projectData.maximumBudget = interiorPayload?.maximumBudget ?? null;
        projectData.wallPaintSeparators =
            interiorPayload?.wallPaintSeparators ?? {};
    }

    //--------------------------------------------------
    // Return typed project data.
    //--------------------------------------------------

    return projectData;
}


//==================================================
// FIRESTORE TIMESTAMP HELPER
//==================================================

function getTimestampMillis(
    value: unknown
): number {

    if (
        !value
    ) {

        return 0;
    }


    //--------------------------------------------------
    // Firestore Timestamp
    //--------------------------------------------------

    if (
        typeof value === "object" &&
        value !== null &&
        "toMillis" in value &&
        typeof (
            value as {
                toMillis:
                    unknown
            }
        ).toMillis ===
            "function"
    ) {

        return (
            value as {
                toMillis:
                    () => number
            }
        ).toMillis();
    }


    //--------------------------------------------------
    // JS Date
    //--------------------------------------------------

    if (
        value instanceof Date
    ) {

        return value.getTime();
    }


    return 0;
}