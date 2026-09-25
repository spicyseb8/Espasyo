import {
    useEffect,
    useState
} from "react";

import {
    useParams
} from "react-router-dom";

import useEditor
    from "../../../context/editor/useEditor";

import {
    auth,
    db,
    storage
} from "../../../firebase/firebase";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "firebase/firestore";

import {
    getDownloadURL,
    ref,
    uploadString
} from "firebase/storage";
import "./ProjectPanel.css";

//==================================================
// PROJECT JSON
//==================================================
//
// Converts the complete editor state into JSON-safe
// project data.
//
// This panel is ONLY responsible for saving the project.
//==================================================

function createProjectData(
    state: ReturnType<typeof useEditor>["state"],
    projectId: string,
    projectName: string,
    ownerId: string
) {

    return {

        //==================================================
        // PROJECT INFO
        //==================================================

        projectId,

        projectName,

        ownerId,

        schemaVersion:
            1,

        savedAt:
            new Date().toISOString(),


        //==================================================
        // ROOM / WALL SETTINGS
        //==================================================

        wallHeight:
            state.wallHeight,

        wallThickness:
            state.wallThickness,

        gridSize:
            state.gridSize,

        snapEnabled:
            state.snapEnabled,

        layoutConfirmed:
            state.layoutConfirmed,


        //==================================================
        // WALLS
        //==================================================

        walls:
            state.walls.map(
                wall => ({

                    id:
                        wall.id,

                    start: {

                        id:
                            wall.start.id,

                        position: {

                            x:
                                wall.start.position.x,

                            y:
                                wall.start.position.y,

                            z:
                                wall.start.position.z

                        }

                    },

                    end: {

                        id:
                            wall.end.id,

                        position: {

                            x:
                                wall.end.position.x,

                            y:
                                wall.end.position.y,

                            z:
                                wall.end.position.z

                        }

                    }

                })
            ),


        //==================================================
        // CORNERS
        //==================================================

        corners:
            state.corners.map(
                corner => ({

                    id:
                        corner.id,

                    position: {

                        x:
                            corner.position.x,

                        y:
                            corner.position.y,

                        z:
                            corner.position.z

                    }

                })
            ),


        //==================================================
        // DOORS
        //==================================================

        doors:
            state.doors.map(
                door => ({

                    id:
                        door.id,

                    assetId:
                        door.assetId,

                    wallId:
                        door.wallId,

                    position: {

                        x:
                            door.position.x,

                        y:
                            door.position.y,

                        z:
                            door.position.z

                    },

                    rotationY:
                        door.rotationY,

                    width:
                        door.width,

                    height:
                        door.height,

                    depth:
                        door.depth

                })
            ),


        //==================================================
        // WINDOWS
        //==================================================

        windows:
            state.windows.map(
                window => ({

                    id:
                        window.id,

                    assetId:
                        window.assetId,

                    wallId:
                        window.wallId,

                    position: {

                        x:
                            window.position.x,

                        y:
                            window.position.y,

                        z:
                            window.position.z

                    },

                    rotationY:
                        window.rotationY,

                    width:
                        window.width,

                    height:
                        window.height,

                    depth:
                        window.depth

                })
            ),


        //==================================================
        // FURNITURE
        //==================================================

        furniture:
            state.furniture.map(
                item => ({

                    id:
                        item.id,

                    assetId:
                        item.assetId,

                    position: {

                        x:
                            item.position.x,

                        y:
                            item.position.y,

                        z:
                            item.position.z

                    },

                    rotationY:
                        item.rotationY,

                    modelOffset: {

                        x:
                            item.modelOffset.x,

                        y:
                            item.modelOffset.y,

                        z:
                            item.modelOffset.z

                    },

                    width:
                        item.width,

                    depth:
                        item.depth,

                    height:
                        item.height

                })
            ),


        //==================================================
        // OPENINGS
        //==================================================

        openings:
            state.openings.map(
                opening => ({

                    id:
                        opening.id,

                    wallId:
                        opening.wallId,

                    shape:
                        opening.shape,

                    position: {

                        x:
                            opening.position.x,

                        y:
                            opening.position.y,

                        z:
                            opening.position.z

                    },

                    width:
                        opening.width,

                    height:
                        opening.height,

                    depth:
                        opening.depth,

                    archRise:
                        opening.archRise

                })
            ),


        //==================================================
        // FLOOR FINISHES
        //==================================================

        floorFinishes:
            state.floorFinishes,


        //==================================================
        // WALL FINISHES
        //==================================================

        wallFinishes:
            state.wallFinishes,


        //==================================================
        // OPENING SETTINGS
        //==================================================

        archRise:
            state.archRise,

        openingWidth:
            state.openingWidth,

        openingHeight:
            state.openingHeight,


        //==================================================
        // BLUEPRINT
        //==================================================

        blueprint:
            state.blueprint
                ? {
                    ...state.blueprint
                }
                : null

    };
}


//==================================================
// PROJECT PANEL
//==================================================
//
// ONLY SAVES THE CURRENT PROJECT.
//
// CREATE MODE:
//
// /studio/editor
//     ↓
// generates a new project ID
//
// EXISTING PROJECT MODE:
//
// /studio/load/:projectId
//     ↓
// uses that existing project ID
//
//==================================================

export default function ProjectPanel() {

    const {
        state
    } = useEditor();


    //==================================================
    // ROUTE
    //==================================================

    const {
        projectId:
            routeProjectId
    } = useParams<{
        projectId?: string;
    }>();


    //==================================================
    // PROJECT NAME
    //==================================================

    const [
        projectName,
        setProjectName
    ] = useState("");


    //==================================================
    // PROJECT ID
    //==================================================
    //
    // Used for NEW projects.
    //
    // Existing loaded projects use routeProjectId.
    //==================================================

    const [
        projectId,
        setProjectId
    ] = useState<string | null>(
        null
    );


    //==================================================
    // SAVING STATE
    //==================================================

    const [
        saving,
        setSaving
    ] = useState(false);


    //==================================================
    // MESSAGE
    //==================================================

    const [
        message,
        setMessage
    ] = useState("");


    //==================================================
    // EXISTING PROJECT
    //==================================================

    const isExistingProject =
        Boolean(
            routeProjectId
        );


    //==================================================
    // LOAD EXISTING PROJECT METADATA
    //==================================================
    //
    // This loads only the project metadata.
    //
    // StudioLoadProject is responsible for loading
    // the actual saved JSON into the editor.
    //==================================================

    useEffect(() => {

        //--------------------------------------------------
        // IMPORTANT:
        //
        // useParams() returns:
        //
        //     string | undefined
        //
        // Create a local constant AFTER the check so
        // TypeScript permanently knows this value is
        // a string inside the async function.
        //--------------------------------------------------

        if (
            !routeProjectId
        ) {

            return;

        }


        const existingProjectId =
            routeProjectId;


        //--------------------------------------------------
        // Keep the existing project ID in local state.
        //--------------------------------------------------

        setProjectId(
            existingProjectId
        );


        //--------------------------------------------------
        // Load project name.
        //--------------------------------------------------

        async function loadExistingProjectName() {

            try {

                const projectRef =
                    doc(
                        db,
                        "projects",
                        existingProjectId
                    );


                const projectSnapshot =
                    await getDoc(
                        projectRef
                    );


                if (
                    !projectSnapshot.exists()
                ) {

                    return;

                }


                const data =
                    projectSnapshot.data();


                if (
                    typeof data.projectName === "string" &&
                    data.projectName.trim() !== ""
                ) {

                    setProjectName(
                        data.projectName
                    );

                }

            } catch (
                error: unknown
            ) {

                console.error(
                    "Failed to load existing project:",
                    error
                );

            }

        }


        loadExistingProjectName();

    }, [
        routeProjectId
    ]);


    //==================================================
    // SAVE PROJECT
    //==================================================

    async function handleSave() {

        //--------------------------------------------------
        // AUTHENTICATION
        //--------------------------------------------------
        //
        // auth.currentUser may be null.
        // After this check TypeScript knows that `user`
        // is a valid Firebase user.
        //--------------------------------------------------

        const user =
            auth.currentUser;


        if (
            !user
        ) {

            setMessage(
                "Please log in before saving a project."
            );

            return;

        }


        //--------------------------------------------------
        // PROJECT NAME
        //--------------------------------------------------

        const trimmedName =
            projectName.trim();


        if (
            trimmedName === ""
        ) {

            setMessage(
                "Please enter a project name."
            );

            return;

        }


        //--------------------------------------------------
        // PREVENT DUPLICATE CLICKS
        //--------------------------------------------------

        if (
            saving
        ) {

            return;

        }


        try {

            setSaving(
                true
            );

            setMessage(
                "Saving..."
            );


            //==================================================
            // DETERMINE PROJECT ID
            //==================================================
            //
            // PRIORITY:
            //
            // 1. Existing route project ID
            // 2. Existing local project ID
            // 3. Generate a new ID
            //==================================================

            const currentProjectId =
                routeProjectId ??
                projectId ??
                crypto.randomUUID();


            //--------------------------------------------------
            // Remember generated ID for NEW projects.
            //--------------------------------------------------

            if (
                !routeProjectId &&
                !projectId
            ) {

                setProjectId(
                    currentProjectId
                );

            }


            //==================================================
            // DETERMINE WHETHER THIS IS A NEW PROJECT
            //==================================================

            const isNewProject =
                !routeProjectId &&
                !projectId;


            //==================================================
            // CREATE PROJECT DATA
            //==================================================

            const projectData =
                createProjectData(

                    state,

                    currentProjectId,

                    trimmedName,

                    user.uid

                );


            //==================================================
            // CONVERT TO JSON
            //==================================================

            const json =
                JSON.stringify(
                    projectData,
                    null,
                    2
                );


            //==================================================
            // STORAGE PATH
            //==================================================

            const storagePath =
                `projects/${user.uid}/${currentProjectId}.json`;


            const storageRef =
                ref(
                    storage,
                    storagePath
                );


            //==================================================
            // UPLOAD / UPDATE JSON
            //==================================================
            //
            // If this is an existing project, this writes
            // to the same Storage file.
            //==================================================

            await uploadString(

                storageRef,

                json,

                "raw",

                {
                    contentType:
                        "application/json"
                }

            );


            //==================================================
            // GET DOWNLOAD URL
            //==================================================

            const downloadUrl =
                await getDownloadURL(
                    storageRef
                );


            //==================================================
            // FIRESTORE PROJECT METADATA
            //==================================================

            const projectMetadata:
                Record<string, unknown> = {

                    projectId:
                        currentProjectId,

                    projectName:
                        trimmedName,

                    ownerId:
                        user.uid,

                    jsonPath:
                        storagePath,

                    jsonUrl:
                        downloadUrl,

                    schemaVersion:
                        1,

                    updatedAt:
                        serverTimestamp()

                };


            //==================================================
            // CREATED AT
            //==================================================
            //
            // Only add createdAt for a genuinely NEW
            // project.
            //==================================================

            if (
                isNewProject
            ) {

                projectMetadata.createdAt =
                    serverTimestamp();

            }


            //==================================================
            // SAVE / UPDATE FIRESTORE
            //==================================================
            //
            // Same project ID = same Firestore document.
            // merge:true updates its existing fields.
            //==================================================

            await setDoc(

                doc(
                    db,
                    "projects",
                    currentProjectId
                ),

                projectMetadata,

                {
                    merge:
                        true
                }

            );


            //==================================================
            // SUCCESS
            //==================================================

            setMessage(

                isExistingProject

                    ? "Project updated successfully."

                    : "Project saved successfully."

            );


        } catch (
            error: unknown
        ) {

            console.error(
                "Failed to save project:",
                error
            );


            const firebaseError =
                error as {

                    code?:
                        string;

                    message?:
                        string;

                };


            setMessage(

                `Save failed: ${
                    firebaseError.code ??
                    "unknown"
                } - ${
                    firebaseError.message ??
                    "Unknown error"
                }`

            );

        } finally {

            setSaving(
                false
            );

        }

    }


    //==================================================
    // UI
    //==================================================

    return (

        <aside className="design-sidebar">


            {/* ==================================================
                SAVE PROJECT CARD
            ================================================== */}

            <div className="panel-card">


                <h3 className="section-title">

                    {
                        isExistingProject

                            ? "Edit Project"

                            : "Save Project"
                    }

                </h3>


                {/* ==================================================
                    PROJECT NAME
                ================================================== */}

                <div className="setting-group">

                    <label
                        className="setting-label"
                        htmlFor="project-name"
                    >
                        Project Name
                    </label>


                    <input
                        id="project-name"
                        className="setting-input project-name-input"
                        type="text"
                        placeholder="Enter project name"
                        value={
                            projectName
                        }
                        onChange={
                            event =>
                                setProjectName(
                                    event.target.value
                                )
                        }
                        disabled={
                            saving
                        }
                    />

                </div>


                {/* ==================================================
                    PROJECT ID
                ================================================== */}

                {
                    (
                        routeProjectId ??
                        projectId
                    ) && (

                        <div
                            className="project-id-display"
                        >

                            <span>
                                Project ID
                            </span>

                            <span>
                                {
                                    routeProjectId ??
                                    projectId
                                }
                            </span>

                        </div>

                    )
                }


                {/* ==================================================
                    SAVE BUTTON
                ================================================== */}

                <button
                    type="button"
                    className="confirm-layout-button"
                    onClick={
                        handleSave
                    }
                    disabled={
                        saving
                    }
                >

                    {
                        saving

                            ? "Saving..."

                            : isExistingProject

                                ? "Save Changes"

                                : "Save Project"
                    }

                </button>


                {/* ==================================================
                    MESSAGE
                ================================================== */}

                {
                    message && (

                        <div
                            className="save-message"
                            role="status"
                        >
                            {message}
                        </div>

                    )
                }

            </div>

        </aside>

    );

}