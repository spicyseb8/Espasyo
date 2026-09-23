import {
    useEffect,
    useState
} from "react";

import {
    Plus,
    FolderOpen
} from "lucide-react";

import {
    useNavigate
} from "react-router-dom";

import {
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";
import {
    onAuthStateChanged
} from "firebase/auth";
import {
    auth,
    db
} from "../firebase/firebase";

import NavBar
    from "../pages/NavBar";

import "./Studio.css";


//==================================================
// PROJECT METADATA
//==================================================

interface UserProject {

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
// FORMAT FIRESTORE DATE
//==================================================

function formatProjectDate(
    value: unknown
): string {

    if (
        !value
    ) {

        return "Unknown date";

    }


    //--------------------------------------------------
    // Firestore Timestamp
    //--------------------------------------------------

    if (
        typeof value === "object" &&
        value !== null &&
        "toDate" in value &&
        typeof (
            value as {
                toDate:
                    unknown
            }
        ).toDate ===
            "function"
    ) {

        const date =
            (
                value as {
                    toDate:
                        () => Date
                }
            ).toDate();


        return date.toLocaleDateString(
            undefined,
            {
                year:
                    "numeric",

                month:
                    "long",

                day:
                    "numeric"
            }
        );
    }


    //--------------------------------------------------
    // JavaScript Date
    //--------------------------------------------------

    if (
        value instanceof Date
    ) {

        return value.toLocaleDateString(
            undefined,
            {
                year:
                    "numeric",

                month:
                    "long",

                day:
                    "numeric"
            }
        );
    }


    //--------------------------------------------------
    // ISO/string date
    //--------------------------------------------------

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

            return date.toLocaleDateString(
                undefined,
                {
                    year:
                        "numeric",

                    month:
                        "long",

                    day:
                        "numeric"
                }
            );
        }
    }


    return "Unknown date";
}


//==================================================
// STUDIO PAGE
//==================================================

export default function Studio() {

    const navigate =
        useNavigate();


    //==================================================
    // PROJECTS
    //==================================================

    const [
        projects,
        setProjects
    ] = useState<UserProject[]>([]);


    //==================================================
    // LOADING PROJECT LIST
    //==================================================

    const [
        loading,
        setLoading
    ] = useState(true);


    //==================================================
    // ERROR
    //==================================================

    const [
        error,
        setError
    ] = useState("");


    //==================================================
    // LOADING PROJECTS
    //==================================================

    useEffect(() => {

    let cancelled = false;

    const unsubscribe =
        onAuthStateChanged(
            auth,
            async user => {

                //--------------------------------------------------
                // No logged-in user
                //--------------------------------------------------
              console.log("CURRENT FIREBASE USER:", user);
console.log("CURRENT USER UID:", user?.uid);
                if (!user) {

                    if (!cancelled) {

                        setProjects([]);

                        setError(
                            "Please log in to view your projects."
                        );

                        setLoading(false);
                    }

                    return;
                }


                //--------------------------------------------------
                // User is ready
                //--------------------------------------------------

                try {

                    setLoading(true);

                    setError("");


                    //--------------------------------------------------
                    // Query only this user's projects
                    //--------------------------------------------------

                    const projectsQuery =
                        query(

                            collection(
                                db,
                                "projects"
                            ),

                            where(
                                "ownerId",
                                "==",
                                user.uid
                            )

                        );


                    const snapshot =
                        await getDocs(
                            projectsQuery
                        );


                    //--------------------------------------------------
                    // Convert documents
                    //--------------------------------------------------

                    const loadedProjects:
                        UserProject[] = [];


                    snapshot.docs.forEach(
                        document => {

                            const data =
                                document.data();


                            loadedProjects.push({

                                projectId:
                                    typeof data.projectId ===
                                    "string"

                                        ? data.projectId

                                        : document.id,

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


                    //--------------------------------------------------
                    // Sort newest first
                    //--------------------------------------------------

                    loadedProjects.sort(
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


                    if (!cancelled) {

                        setProjects(
                            loadedProjects
                        );

                    }

                } catch (
                    loadError
                ) {

                    //--------------------------------------------------
                    // IMPORTANT:
                    // Show the actual Firebase error in console.
                    //--------------------------------------------------

                    console.error(
                        "Failed to load projects:",
                        loadError
                    );


                    if (!cancelled) {

                        const firebaseError =
                            loadError as {
                                code?: string;
                                message?: string;
                            };


                        setError(
                            firebaseError.code
                                ? `Failed to load projects: ${firebaseError.code}`
                                : "Failed to load your projects."
                        );

                    }

                } finally {

                    if (!cancelled) {

                        setLoading(false);

                    }

                }

            }
        );


    //--------------------------------------------------
    // Cleanup
    //--------------------------------------------------

    return () => {

        cancelled = true;

        unsubscribe();

    };

}, []);


    //==================================================
    // CREATE PROJECT
    //==================================================

    function handleCreateProject() {

        navigate(
            "/studio/editor"
        );

    }


    //==================================================
    // LOAD PROJECT
    //==================================================

    function handleLoadProject(
        project: UserProject
    ) {

        navigate(
            `/studio/load/${project.projectId}`
        );

    }


    //==================================================
    // RENDER
    //==================================================

    return (

        <div className="studio-layout">

            {/*==================================================
                EXISTING NAVBAR
            ==================================================*/}

            <NavBar />


            {/*==================================================
                STUDIO CONTENT
            ==================================================*/}

            <main className="studio-page">

                <div className="studio-container">


                    {/* ------------------------------------------
                        HEADER
                    ------------------------------------------ */}

                    <div className="studio-header">

                        <div>

                            <p className="studio-eyebrow">
                                Espasyo Studio
                            </p>

                            <h1>
                                Your Projects
                            </h1>

                            <p className="studio-description">
                                Create a new interior design
                                project or open one of your
                                existing projects.
                            </p>

                        </div>


                        {/* ------------------------------------------
                            CREATE PROJECT
                        ------------------------------------------ */}

                        <button
                            type="button"
                            className="studio-create-button"
                            onClick={
                                handleCreateProject
                            }
                        >

                            <Plus
                                size={18}
                            />

                            Create Project

                        </button>

                    </div>


                    {/* ------------------------------------------
                        PROJECTS
                    ------------------------------------------ */}

                    <section className="studio-projects">


                        <div className="studio-section-heading">

                            <h2>
                                My Projects
                            </h2>

                            <span>
                                {
                                    projects.length
                                }
                            </span>

                        </div>


                        {/* ------------------------------------------
                            LOADING
                        ------------------------------------------ */}

                        {
                            loading && (

                                <div className="studio-empty-state">

                                    Loading projects...

                                </div>

                            )
                        }


                        {/* ------------------------------------------
                            ERROR
                        ------------------------------------------ */}

                        {
                            !loading &&
                            error && (

                                <div className="studio-empty-state">

                                    {error}

                                </div>

                            )
                        }


                        {/* ------------------------------------------
                            NO PROJECTS
                        ------------------------------------------ */}

                        {
                            !loading &&
                            !error &&
                            projects.length === 0 && (

                                <div className="studio-empty-state">

                                    <FolderOpen
                                        size={34}
                                    />

                                    <p>
                                        You have no saved projects yet.
                                    </p>

                                    <button
                                        type="button"
                                        className="studio-create-button"
                                        onClick={
                                            handleCreateProject
                                        }
                                    >
                                        <Plus
                                            size={18}
                                        />
                                        Create Project
                                    </button>

                                </div>

                            )
                        }


                        {/* ------------------------------------------
                            PROJECT GRID
                        ------------------------------------------ */}

                        {
                            !loading &&
                            !error &&
                            projects.length > 0 && (

                                <div className="studio-project-grid">

                                    {
                                        projects.map(
                                            project => (

                                                <article
                                                    key={
                                                        project.projectId
                                                    }
                                                    className="studio-project-card"
                                                >


                                                    {/* ------------------------------
                                                        PROJECT PREVIEW
                                                    ------------------------------ */}

                                                    <div className="studio-project-preview">

                                                        <FolderOpen
                                                            size={28}
                                                        />

                                                    </div>


                                                    {/* ------------------------------
                                                        PROJECT INFO
                                                    ------------------------------ */}

                                                    <div className="studio-project-info">

                                                        <h3>
                                                            {
                                                                project.projectName
                                                            }
                                                        </h3>


                                                        <p>
                                                            Last updated:{" "}

                                                            {
                                                                formatProjectDate(
                                                                    project.updatedAt
                                                                )
                                                            }
                                                        </p>

                                                    </div>


                                                    {/* ------------------------------
                                                        LOAD PROJECT
                                                    ------------------------------ */}

                                                    <button
                                                        type="button"
                                                        className="studio-load-button"
                                                        onClick={
                                                            () =>
                                                                handleLoadProject(
                                                                    project
                                                                )
                                                        }
                                                    >

                                                        Load Project

                                                    </button>

                                                </article>

                                            )
                                        )
                                    }

                                </div>

                            )
                        }

                    </section>

                </div>

            </main>

        </div>

    );

}


//==================================================
// GET PROJECT TIMESTAMP
//==================================================

function getProjectTime(
    value: unknown
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