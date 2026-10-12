import {
    useEffect,
    useRef,
    useState
} from "react";

import {
    useLocation,
    useNavigate,
    useParams,
    useSearchParams
} from "react-router-dom";

import {
    X
} from "lucide-react";

import useEditor
    from "../../context/editor/useEditor";

import {
    auth
} from "../../firebase/firebase";

import {
    createProjectData
} from "../../services/projectSerializer";

import {
    saveDraft,
    getDraft
} from "../../services/projectDraftService";

import {
    captureSceneThumbnail
} from "../../services/projectThumbnail";

import {
    clearProjectSession,
    getActiveSavedProjectId,
    getProjectBaseline,
    getProjectFingerprint
} from "../../services/projectEditSessionService";

export default function EditorExitGuard() {
    const {
        state
    } = useEditor();

    const location =
        useLocation();

    const navigate =
        useNavigate();

    const {
        projectId:
            routeProjectId
    } = useParams<{
        projectId?:
            string;
    }>();

    const [
        searchParams
    ] = useSearchParams();

    const [
        open,
        setOpen
    ] = useState(false);

    const [
        saving,
        setSaving
    ] = useState(false);

    const [
        pendingDestination,
        setPendingDestination
    ] = useState(
        "/studio"
    );

    const allowExit =
        useRef(false);

    const stateRef =
        useRef(state);

    const locationRef =
        useRef(location);

    const routeProjectIdRef =
        useRef(
            routeProjectId
        );

    const draftId =
        searchParams.get(
            "draft"
        );

    const draftIdRef =
        useRef(draftId);

    stateRef.current =
        state;

    locationRef.current =
        location;

    routeProjectIdRef.current =
        routeProjectId;

    draftIdRef.current =
        draftId;

    function getProjectName():
        string {
        return (
            localStorage.getItem(
                "espasyo_project_name"
            )?.trim() ??
            ""
        );
    }

    function getSavedProjectId():
        string | null {
        return (
            routeProjectIdRef.current ??
            getActiveSavedProjectId()
        );
    }

    function hasSavedBaseline():
        boolean {
        const savedProjectId =
            getSavedProjectId();

        if (
            !savedProjectId
        ) {
            return false;
        }

        return (
            getProjectBaseline(
                savedProjectId
            ) !== null
        );
    }

    function hasDesign():
        boolean {
        const currentState =
            stateRef.current;

        return (
            currentState.walls.length >
                0 ||
            currentState.corners.length >
                0 ||
            currentState.doors.length >
                0 ||
            currentState.windows.length >
                0 ||
            currentState.furniture.length >
                0 ||
            currentState.openings.length >
                0 ||
            Object.keys(
                currentState.floorFinishes
            ).length >
                0 ||
            Object.keys(
                currentState.wallFinishes
            ).length >
                0 ||
            Boolean(
                currentState.blueprint
            ) ||
            currentState.layoutConfirmed
        );
    }

    function hasUnsavedChanges():
        boolean {
        const savedProjectId =
            getSavedProjectId();

        if (
            savedProjectId
        ) {
            const baseline =
                getProjectBaseline(
                    savedProjectId
                );

            if (
                baseline !==
                null
            ) {
                const user =
                    auth.currentUser;

                if (
                    user
                ) {
                    const currentProjectData =
                        createProjectData(
                            stateRef.current,
                            savedProjectId,
                            getProjectName() ||
                                "Untitled Project",
                            user.uid
                        );

                    return (
                        getProjectFingerprint(
                            currentProjectData
                        ) !==
                        getProjectFingerprint(
                            baseline
                        )
                    );
                }
            }
        }

        return Boolean(
            draftIdRef.current ||
            getProjectName() ||
            hasDesign()
        );
    }

    function isSavedProjectMode():
        boolean {
        return hasSavedBaseline();
    }

    useEffect(() => {
        const currentUrl =
            window.location.href;

        const guardState = {
            ...(window.history.state ??
                {}),
            __espasyoEditorGuard:
                true
        };

        window.history.pushState(
            guardState,
            "",
            currentUrl
        );

        const handlePopState =
            () => {
                if (
                    allowExit.current
                ) {
                    return;
                }

                if (
                    !hasUnsavedChanges()
                ) {
                    allowExit.current =
                        true;

                    window.history.back();

                    return;
                }

                window.history.pushState(
                    guardState,
                    "",
                    currentUrl
                );

                setPendingDestination(
                    "/studio"
                );

                setOpen(
                    true
                );
            };

        const handleBeforeUnload =
            (
                event:
                    BeforeUnloadEvent
            ) => {
                if (
                    !hasUnsavedChanges()
                ) {
                    return;
                }

                event.preventDefault();

                event.returnValue =
                    "";
            };

        const handleClick =
            (
                event:
                    MouseEvent
            ) => {
                if (
                    event.defaultPrevented ||
                    !hasUnsavedChanges()
                ) {
                    return;
                }

                const target =
                    event.target as
                        HTMLElement |
                        null;

                const link =
                    target?.closest(
                        "a"
                    ) as
                        HTMLAnchorElement |
                        null;

                if (
                    !link ||
                    link.target ===
                        "_blank" ||
                    link.hasAttribute(
                        "download"
                    )
                ) {
                    return;
                }

                const url =
                    new URL(
                        link.href,
                        window.location.origin
                    );

                if (
                    url.origin !==
                    window.location.origin
                ) {
                    return;
                }

                const destination =
                    `${url.pathname}${url.search}${url.hash}`;

                const current =
                    `${locationRef.current.pathname}${locationRef.current.search}${locationRef.current.hash}`;

                if (
                    destination ===
                    current
                ) {
                    return;
                }

                event.preventDefault();

                event.stopPropagation();

                setPendingDestination(
                    destination
                );

                setOpen(
                    true
                );
            };

        window.addEventListener(
            "popstate",
            handlePopState
        );

        window.addEventListener(
            "beforeunload",
            handleBeforeUnload
        );

        document.addEventListener(
            "click",
            handleClick,
            true
        );

        return () => {
            window.removeEventListener(
                "popstate",
                handlePopState
            );

            window.removeEventListener(
                "beforeunload",
                handleBeforeUnload
            );

            document.removeEventListener(
                "click",
                handleClick,
                true
            );
        };
    }, [
        location.pathname,
        location.search,
        location.hash
    ]);

    async function saveDraftAndExit() {
        const user =
            auth.currentUser;

        if (
            !user
        ) {
            allowExit.current =
                true;

            navigate(
                pendingDestination
            );

            return;
        }

        try {
            setSaving(
                true
            );

            const existingDraft =
                draftId
                    ? getDraft(
                        user.uid,
                        draftId
                    )
                    : null;

            const draftProjectId =
                existingDraft?.projectId ??
                crypto.randomUUID();

            const name =
                getProjectName() ||
                existingDraft?.projectName ||
                "Untitled Project";

            const projectData =
                createProjectData(
                    stateRef.current,
                    draftProjectId,
                    name,
                    user.uid
                );

            const thumbnail =
                captureSceneThumbnail();

            const draft = {
                draftId:
                    existingDraft?.draftId ??
                    crypto.randomUUID(),
                projectId:
                    draftProjectId,
                ownerId:
                    user.uid,
                projectName:
                    name,
                savedAt:
                    new Date().toISOString(),
                thumbnail,
                projectData
            };

            saveDraft(
                draft
            );

            clearProjectSession();

            allowExit.current =
                true;

            navigate(
                pendingDestination
            );
        } finally {
            setSaving(
                false
            );
        }
    }

    function discardChanges() {
        if (
            !isSavedProjectMode()
        ) {
            clearProjectSession();

            localStorage.removeItem(
                "espasyo_project_name"
            );
        }

        allowExit.current =
            true;

        navigate(
            pendingDestination
        );
    }

    function closeModal() {
        if (
            saving
        ) {
            return;
        }

        setOpen(
            false
        );
    }

    if (
        !open
    ) {
        return null;
    }

    const savedProject =
        isSavedProjectMode();

    return (
        <div
            style={{
                position:
                    "fixed",
                inset:
                    0,
                zIndex:
                    9999,
                display:
                    "flex",
                alignItems:
                    "center",
                justifyContent:
                    "center",
                padding:
                    16,
                background:
                    "rgba(15, 15, 15, 0.45)",
                backdropFilter:
                    "blur(3px)"
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="unsaved-changes-title"
                style={{
                    position:
                        "relative",
                    width:
                        "min(460px, 100%)",
                    borderRadius:
                        18,
                    background:
                        "#ffffff",
                    padding:
                        24,
                    boxShadow:
                        "0 24px 70px rgba(0, 0, 0, 0.22)"
                }}
            >
                <button
                    type="button"
                    aria-label="Close"
                    onClick={
                        closeModal
                    }
                    disabled={
                        saving
                    }
                    style={{
                        position:
                            "absolute",
                        top:
                            14,
                        right:
                            14,
                        width:
                            34,
                        height:
                            34,
                        display:
                            "flex",
                        alignItems:
                            "center",
                        justifyContent:
                            "center",
                        border:
                            "none",
                        borderRadius:
                            "50%",
                        background:
                            "transparent",
                        color:
                            "#777777",
                        cursor:
                            saving
                                ? "default"
                                : "pointer"
                    }}
                >
                    <X
                        size={
                            19
                        }
                    />
                </button>

                <div
                    style={{
                        paddingRight:
                            36
                    }}
                >
                    <h2
                        id="unsaved-changes-title"
                        style={{
                            margin:
                                0,
                            fontSize:
                                19,
                            lineHeight:
                                1.3,
                            fontWeight:
                                700,
                            color:
                                "#222222"
                        }}
                    >
                        Unsaved Changes
                    </h2>

                    <p
                        style={{
                            margin:
                                "8px 0 0",
                            fontSize:
                                13,
                            lineHeight:
                                1.6,
                            color:
                                "#777777"
                        }}
                    >
                        {
                            savedProject
                                ? "You have unsaved changes to this project."
                                : "This project hasn't been saved to your account yet."
                        }
                    </p>
                </div>

                <div
                    style={{
                        display:
                            "flex",
                        justifyContent:
                            savedProject
                                ? "flex-end"
                                : "stretch",
                        gap:
                            10,
                        marginTop:
                            24
                    }}
                >
                    <button
                        type="button"
                        onClick={
                            discardChanges
                        }
                        disabled={
                            saving
                        }
                        style={{
                            width:
                                savedProject
                                    ? 130
                                    : "auto",
                            flex:
                                savedProject
                                    ? "0 0 130px"
                                    : 1,
                            height:
                                42,
                            padding:
                                "0 16px",
                            border:
                                "1px solid #dededb",
                            borderRadius:
                                9,
                            background:
                                "#f5f5f2",
                            color:
                                "#444444",
                            cursor:
                                saving
                                    ? "default"
                                    : "pointer",
                            fontSize:
                                14,
                            fontWeight:
                                500,
                            whiteSpace:
                                "nowrap"
                        }}
                    >
                        Discard
                    </button>

                    {
                        !savedProject && (
                            <button
                                type="button"
                                onClick={
                                    saveDraftAndExit
                                }
                                disabled={
                                    saving
                                }
                                style={{
                                    flex:
                                        1,
                                    minWidth:
                                        0,
                                    height:
                                        42,
                                    padding:
                                        "0 16px",
                                    border:
                                        "none",
                                    borderRadius:
                                        9,
                                    background:
                                        "#ff7a00",
                                    color:
                                        "#ffffff",
                                    cursor:
                                        saving
                                            ? "default"
                                            : "pointer",
                                    fontSize:
                                        14,
                                    fontWeight:
                                        600,
                                    whiteSpace:
                                        "nowrap",
                                    boxShadow:
                                        "0 2px 6px rgba(255, 122, 0, 0.18)"
                                }}
                            >
                                {
                                    saving
                                        ? "Saving..."
                                        : "Save Draft & Exit"
                                }
                            </button>
                        )
                    }
                </div>
            </div>
        </div>
    );
}