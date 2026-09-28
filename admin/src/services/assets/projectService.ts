import {
    collection,
    doc,
    getDoc,
    getDocs
} from "firebase/firestore";

import {
    db
} from "@/firebase/firebase";


export interface AdminProject {

    projectId: string;

    projectName: string;

    ownerId: string;

    jsonPath: string;

    jsonUrl: string;

    schemaVersion: number;

    createdAt?: unknown;

    updatedAt?: unknown;
}


//==================================================
// GET ALL PROJECTS
//==================================================

export async function getAdminProjects(): Promise<AdminProject[]> {

    const snapshot =
        await getDocs(
            collection(
                db,
                "projects"
            )
        );


    const projects:
        AdminProject[] = [];


    snapshot.docs.forEach(
        projectDocument => {

            const data =
                projectDocument.data();


            projects.push({

                projectId:
                    typeof data.projectId ===
                    "string"
                        ? data.projectId
                        : projectDocument.id,

                projectName:
                    typeof data.projectName ===
                    "string"
                        ? data.projectName
                        : "Unnamed Project",

                ownerId:
                    typeof data.ownerId ===
                    "string"
                        ? data.ownerId
                        : "",

                jsonPath:
                    typeof data.jsonPath ===
                    "string"
                        ? data.jsonPath
                        : "",

                jsonUrl:
                    typeof data.jsonUrl ===
                    "string"
                        ? data.jsonUrl
                        : "",

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
    );


    //==================================================
    // SORT NEWEST UPDATED FIRST
    //==================================================

    projects.sort(
        (
            first,
            second
        ) => {

            return (
                getProjectTime(
                    second.updatedAt
                ) -
                getProjectTime(
                    first.updatedAt
                )
            );

        }
    );


    return projects;

}


//==================================================
// GET ONE PROJECT
//==================================================

export async function getAdminProject(
    projectId: string
): Promise<AdminProject> {

    const projectReference =
        doc(
            db,
            "projects",
            projectId
        );


    const snapshot =
        await getDoc(
            projectReference
        );


    if (!snapshot.exists()) {

        throw new Error(
            "Project does not exist."
        );

    }


    const data =
        snapshot.data();


    return {

        projectId:
            typeof data.projectId === "string"
                ? data.projectId
                : snapshot.id,

        projectName:
            typeof data.projectName === "string"
                ? data.projectName
                : "Unnamed Project",

        ownerId:
            typeof data.ownerId === "string"
                ? data.ownerId
                : "",

        jsonPath:
            typeof data.jsonPath === "string"
                ? data.jsonPath
                : "",

        jsonUrl:
            typeof data.jsonUrl === "string"
                ? data.jsonUrl
                : "",

        schemaVersion:
            typeof data.schemaVersion === "number"
                ? data.schemaVersion
                : 1,

        createdAt:
            data.createdAt,

        updatedAt:
            data.updatedAt

    };

}


//==================================================
// GET PROJECT TIMESTAMP
//==================================================

function getProjectTime(
    value: unknown
): number {

    if (!value) {

        return 0;

    }


    if (
        typeof value === "object" &&
        value !== null &&
        "toMillis" in value &&
        typeof (
            value as {
                toMillis:
                    unknown
            }
        ).toMillis === "function"
    ) {

        return (
            value as {
                toMillis:
                    () => number
            }
        ).toMillis();

    }


    if (
        value instanceof Date
    ) {

        return value.getTime();

    }


    if (
        typeof value === "string"
    ) {

        const date =
            new Date(
                value
            );


        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            return date.getTime();

        }

    }


    return 0;

}