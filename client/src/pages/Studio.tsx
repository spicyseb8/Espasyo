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
import {
    getDrafts
} from "../services/projectDraftService";
import type {
    DraftProject
} from "../services/projectDraftService";
import "./Studio.css";

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
    thumbnailPath?:
        string;
    thumbnailUrl?:
        string;
    createdAt?:
        unknown;
    updatedAt?:
        unknown;
}

function formatProjectDate(
    value: unknown
): string {
    if (
        !value
    ) {
        return "Unknown date";
    }

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

    if (
        typeof value ===
        "string"
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
        typeof value ===
        "string"
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

export default function Studio() {
    const navigate =
        useNavigate();

    const [
        projects,
        setProjects
    ] = useState<UserProject[]>([]);

    const [
        drafts,
        setDrafts
    ] = useState<DraftProject[]>([]);

    const [
        loading,
        setLoading
    ] = useState(true);

    const [
        error,
        setError
    ] = useState("");

    useEffect(() => {
        let cancelled = false;

        const unsubscribe =
            onAuthStateChanged(
                auth,
                async user => {
                    if (
                        !user
                    ) {
                        if (
                            !cancelled
                        ) {
                            setProjects([]);
                            setDrafts([]);

                            setError(
                                "Please log in to view your projects."
                            );

                            setLoading(
                                false
                            );
                        }

                        return;
                    }

                    localStorage.setItem(
                        "espasyo_current_user_uid",
                        user.uid
                    );

                    try {
                        setLoading(
                            true
                        );

                        setError("");

                        const localDrafts =
                            getDrafts(
                                user.uid
                            );

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

                                    thumbnailPath:
                                        typeof data.thumbnailPath ===
                                        "string"
                                            ? data.thumbnailPath
                                            : undefined,

                                    thumbnailUrl:
                                        typeof data.thumbnailUrl ===
                                        "string"
                                            ? data.thumbnailUrl
                                            : undefined,

                                    createdAt:
                                        data.createdAt,

                                    updatedAt:
                                        data.updatedAt
                                });
                            }
                        );

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

                        if (
                            !cancelled
                        ) {
                            setDrafts(
                                localDrafts
                            );

                            setProjects(
                                loadedProjects
                            );
                        }
                    } catch (
                        loadError
                    ) {
                        console.error(
                            "Failed to load projects:",
                            loadError
                        );

                        if (
                            !cancelled
                        ) {
                            const firebaseError =
                                loadError as {
                                    code?:
                                        string;
                                    message?:
                                        string;
                                };

                            setError(
                                firebaseError.code
                                    ? `Failed to load projects: ${firebaseError.code}`
                                    : "Failed to load your projects."
                            );
                        }
                    } finally {
                        if (
                            !cancelled
                        ) {
                            setLoading(
                                false
                            );
                        }
                    }
                }
            );

        return () => {
            cancelled =
                true;

            unsubscribe();
        };
    }, []);

    function handleCreateProject() {
        localStorage.removeItem(
            "espasyo_project_name"
        );

        navigate(
            "/studio/editor"
        );
    }

    function handleLoadProject(
        project:
            UserProject
    ) {
        navigate(
            `/studio/load/${project.projectId}`
        );
    }

    function handleContinueDraft(
        draft:
            DraftProject
    ) {
        localStorage.setItem(
            "espasyo_project_name",
            draft.projectName
        );

        navigate(
            `/studio/editor?draft=${encodeURIComponent(
                draft.draftId
            )}`
        );
    }

    return (
        <div className="studio-layout">
            <NavBar />

            <main className="studio-page">
                <div className="studio-container">
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

                        <button
                            type="button"
                            className="studio-create-button"
                            onClick={
                                handleCreateProject
                            }
                        >
                            <Plus
                                size={
                                    18
                                }
                            />

                            Create Project
                        </button>
                    </div>

                    {
                        loading && (
                            <section className="studio-projects">
                                <div className="studio-empty-state">
                                    Loading projects...
                                </div>
                            </section>
                        )
                    }

                    {
                        !loading &&
                        error && (
                            <section className="studio-projects">
                                <div className="studio-empty-state">
                                    {
                                        error
                                    }
                                </div>
                            </section>
                        )
                    }

                    {
                        !loading &&
                        !error && (
                            <>
                                <section className="studio-projects">
                                    <div className="studio-section-heading">
                                        <h2>
                                            Drafts
                                        </h2>

                                        <span>
                                            {
                                                drafts.length
                                            }
                                        </span>
                                    </div>

                                    {
                                        drafts.length ===
                                        0 && (
                                            <div className="studio-empty-state">
                                                <p>
                                                    You have no saved drafts.
                                                </p>
                                            </div>
                                        )
                                    }

                                    {
                                        drafts.length >
                                        0 && (
                                            <div className="studio-project-grid">
                                                {
                                                    drafts.map(
                                                        draft => (
                                                            <article
                                                                key={
                                                                    draft.draftId
                                                                }
                                                                className="studio-project-card"
                                                            >
                                                                <div className="studio-project-preview">
                                                                    {
                                                                        draft.thumbnail ? (
                                                                            <img
                                                                                src={
                                                                                    draft.thumbnail
                                                                                }
                                                                                alt={
                                                                                    `${draft.projectName} draft preview`
                                                                                }
                                                                                className="studio-project-thumbnail"
                                                                            />
                                                                        ) : (
                                                                            <FolderOpen
                                                                                size={
                                                                                    28
                                                                                }
                                                                            />
                                                                        )
                                                                    }
                                                                </div>

                                                                <div className="studio-project-info">
                                                                    <h3>
                                                                        {
                                                                            draft.projectName
                                                                        }
                                                                    </h3>

                                                                    <p>
                                                                        Last saved:{" "}
                                                                        {
                                                                            formatProjectDate(
                                                                                draft.savedAt
                                                                            )
                                                                        }
                                                                    </p>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    className="studio-load-button"
                                                                    onClick={() =>
                                                                        handleContinueDraft(
                                                                            draft
                                                                        )
                                                                    }
                                                                >
                                                                    Continue Draft
                                                                </button>
                                                            </article>
                                                        )
                                                    )
                                                }
                                            </div>
                                        )
                                    }
                                </section>

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

                                    {
                                        projects.length ===
                                        0 && (
                                            <div className="studio-empty-state">
                                                <FolderOpen
                                                    size={
                                                        34
                                                    }
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
                                                        size={
                                                            18
                                                        }
                                                    />

                                                    Create Project
                                                </button>
                                            </div>
                                        )
                                    }

                                    {
                                        projects.length >
                                        0 && (
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
                                                                <div className="studio-project-preview">
                                                                    {
                                                                        project.thumbnailUrl ? (
                                                                            <img
                                                                                src={
                                                                                    project.thumbnailUrl
                                                                                }
                                                                                alt={
                                                                                    `${project.projectName} project preview`
                                                                                }
                                                                                className="studio-project-thumbnail"
                                                                            />
                                                                        ) : (
                                                                            <FolderOpen
                                                                                size={
                                                                                    28
                                                                                }
                                                                            />
                                                                        )
                                                                    }
                                                                </div>

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

                                                                <button
                                                                    type="button"
                                                                    className="studio-load-button"
                                                                    onClick={() =>
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
                            </>
                        )
                    }
                </div>
            </main>
        </div>
    );
}