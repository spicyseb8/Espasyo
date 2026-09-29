import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where
} from "firebase/firestore";

import {
    db
} from "@/firebase/firebase";


export interface AdminProject {

    projectId:
        string;

    projectName:
        string;

    ownerId:
        string;

    ownerName?:
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

    totalCost?:
        number;

    estimatedCost?:
        number;

}


//==================================================
// MAP PROJECT
//==================================================

function mapProject(
    projectDocument: {
        id:
            string;

        data():
            Record<string, unknown>;
    }
): AdminProject {

    const data =
        projectDocument.data();


    const totalCost =
        Number(
            data.totalCost
        );


    const estimatedCost =
        Number(
            data.estimatedCost
        );


    return {

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


        ownerName:
            typeof data.ownerName ===
            "string"
                ? data.ownerName
                : undefined,


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
            data.updatedAt,


        totalCost:
            Number.isFinite(
                totalCost
            )
                ? totalCost
                : undefined,


        estimatedCost:
            Number.isFinite(
                estimatedCost
            )
                ? estimatedCost
                : undefined,


    };

}


//==================================================
// GET ALL PROJECTS
//==================================================
//
// Used by ProjectManagement.
// Returns every project.
//==================================================

//==================================================
// GET ALL PROJECTS
//==================================================
//
// Used by:
// ProjectManagement
//
// Returns every project and resolves ownerName from:
// 1. users
// 2. adminEmployees
//==================================================

export async function getAdminProjects():
    Promise<AdminProject[]> {

    const [
        projectsSnapshot,
        usersSnapshot,
        employeesSnapshot
    ] = await Promise.all([

        getDocs(
            collection(
                db,
                "projects"
            )
        ),

        getDocs(
            collection(
                db,
                "users"
            )
        ),

        getDocs(
            collection(
                db,
                "adminEmployees"
            )
        )

    ]);


    //==================================================
    // BUILD OWNER LOOKUP
    //==================================================

    const owners =
        new Map<
            string,
            string
        >();


    //--------------------------------------------------
    // USERS
    //--------------------------------------------------

    usersSnapshot.docs.forEach(
        document => {

            const data =
                document.data();


            const uid =
                typeof data.uid === "string" &&
                data.uid.trim() !== ""

                    ? data.uid.trim()

                    : document.id;


            const name =

                typeof data.full_name ===
                    "string" &&
                data.full_name.trim() !== ""

                    ? data.full_name.trim()

                    :

                typeof data.name ===
                    "string" &&
                data.name.trim() !== ""

                    ? data.name.trim()

                    :

                typeof data.email ===
                    "string" &&
                data.email.trim() !== ""

                    ? data.email.trim()

                    : "Unknown User";


            owners.set(
                uid,
                name
            );

        }
    );


    //--------------------------------------------------
    // ADMIN EMPLOYEES
    //--------------------------------------------------

    employeesSnapshot.docs.forEach(
        document => {

            const data =
                document.data();


            const uid =
                typeof data.uid === "string" &&
                data.uid.trim() !== ""

                    ? data.uid.trim()

                    : document.id;


            const name =

                typeof data.name ===
                    "string" &&
                data.name.trim() !== ""

                    ? data.name.trim()

                    :

                typeof data.full_name ===
                    "string" &&
                data.full_name.trim() !== ""

                    ? data.full_name.trim()

                    :

                typeof data.email ===
                    "string" &&
                data.email.trim() !== ""

                    ? data.email.trim()

                    : "Unknown Employee";


            owners.set(
                uid,
                name
            );

        }
    );


    //==================================================
    // BUILD PROJECT LIST
    //==================================================

    const projects:
        AdminProject[] = [];


    projectsSnapshot.docs.forEach(
        projectDocument => {

            const data =
                projectDocument.data();


            const ownerId =
                typeof data.ownerId ===
                    "string"

                    ? data.ownerId

                    : "";


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


                ownerId,


                ownerName:
                    owners.get(
                        ownerId
                    ) ??
                    "Unknown User",


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
                    data.updatedAt,


                totalCost:

                    typeof data.totalCost ===
                        "number"

                        ? data.totalCost

                        : undefined,


                estimatedCost:

                    typeof data.estimatedCost ===
                        "number"

                        ? data.estimatedCost

                        : undefined

            });

        }
    );


    //==================================================
    // SORT
    //==================================================

    projects.sort(

        (
            first,
            second
        ) =>

            getProjectTime(
                second.updatedAt
            ) -

            getProjectTime(
                first.updatedAt
            )

    );


    return projects;

}


//==================================================
// GET USER PROJECTS
//==================================================

export async function getUserProjects(
    ownerId:
        string
): Promise<AdminProject[]> {

    const normalizedOwnerId =
        ownerId.trim();


    if (
        normalizedOwnerId === ""
    ) {

        return [];

    }


    const projectsQuery =
        query(
            collection(
                db,
                "projects"
            ),
            where(
                "ownerId",
                "==",
                normalizedOwnerId
            )
        );


    const snapshot =
        await getDocs(
            projectsQuery
        );


    const projects:
        AdminProject[] = [];


    snapshot.docs.forEach(
        projectDocument => {

            projects.push(
                mapProject(
                    projectDocument
                )
            );

        }
    );


    projects.sort(
        (
            first,
            second
        ) =>
            getProjectTime(
                second.updatedAt
            ) -
            getProjectTime(
                first.updatedAt
            )
    );


    return projects;

}


//==================================================
// GET PROJECTS FOR ACCOUNT
//==================================================

export async function getProjectsForUserAccount(
    accountId:
        string
): Promise<AdminProject[]> {

    const normalizedAccountId =
        accountId.trim();


    if (
        normalizedAccountId === ""
    ) {

        return [];

    }


    const userReference =
        doc(
            db,
            "users",
            normalizedAccountId
        );


    const userSnapshot =
        await getDoc(
            userReference
        );


    let ownerId =
        normalizedAccountId;


    if (
        userSnapshot.exists()
    ) {

        const userData =
            userSnapshot.data();


        if (
            typeof userData.uid ===
            "string" &&
            userData.uid.trim() !== ""
        ) {

            ownerId =
                userData.uid.trim();

        }

    }


    return getUserProjects(
        ownerId
    );

}


//==================================================
// GET ONE PROJECT
//==================================================
//
// Used by AdminProjectLoader.
// IMPORTANT:
// This only reads Firestore metadata.
// It does NOT attempt to read Storage.
//==================================================

export async function getAdminProject(
    projectId:
        string
): Promise<AdminProject> {

    const normalizedProjectId =
        projectId.trim();


    if (
        normalizedProjectId === ""
    ) {

        throw new Error(
            "Project ID is required."
        );

    }


    const projectReference =
        doc(
            db,
            "projects",
            normalizedProjectId
        );


    const snapshot =
        await getDoc(
            projectReference
        );


    if (
        !snapshot.exists()
    ) {

        throw new Error(
            "Project does not exist."
        );

    }


    return mapProject(
        snapshot
    );

}


//==================================================
// TIMESTAMP
//==================================================

function getProjectTime(
    value:
        unknown
): number {

    if (
        !value
    ) {

        return 0;

    }


    if (
        typeof value === "object" &&
        value !== null &&
        "toMillis" in value &&
        typeof (
            value as {
                toMillis:
                    unknown;
            }
        ).toMillis === "function"
    ) {

        return (
            value as {
                toMillis:
                    () => number;
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