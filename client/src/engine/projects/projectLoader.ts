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


        if (
            typeof data.jsonUrl !==
            "string"
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

            jsonPath:
                typeof data.jsonPath ===
                "string"

                    ? data.jsonPath

                    : "",

            jsonUrl:
                data.jsonUrl,

            schemaVersion:
                typeof data.schemaVersion ===
                "number"

                    ? data.schemaVersion

                    : 1,

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

    const response =
        await fetch(
            project.jsonUrl,
            {
                method:
                    "GET"
            }
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `Failed to download project JSON (${response.status}).`
        );
    }


    //--------------------------------------------------
    // Parse JSON.
    //--------------------------------------------------

    const data =
        await response.json();


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


    //--------------------------------------------------
    // Return typed project data.
    //--------------------------------------------------

    return data as
        SavedProjectData;
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