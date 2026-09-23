import {
    useEffect,
    useState
} from "react";

import {
    useNavigate,
    useParams
} from "react-router-dom";

import {
    doc,
    getDoc
} from "firebase/firestore";

import {
    auth,
    db
} from "../firebase/firebase";

import EditorProvider
    from "../context/EditorProvider";

import useEditor
    from "../context/editor/useEditor";

import Editor
    from "../Studio/Editor/Editor";


function LoadProjectContent() {

    const {
        projectId
    } = useParams<{
        projectId: string;
    }>();


    const {
        dispatch
    } = useEditor();


    const navigate =
        useNavigate();


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        error,
        setError
    ] = useState("");


    useEffect(() => {

        let cancelled =
            false;


        async function loadProject() {

            //--------------------------------------------------
            // Check project ID
            //--------------------------------------------------

            if (
                !projectId
            ) {

                setError(
                    "No project was selected."
                );

                setLoading(
                    false
                );

                return;
            }


            //--------------------------------------------------
            // Authentication
            //--------------------------------------------------

            const user =
                auth.currentUser;


            if (
                !user
            ) {

                setError(
                    "Please log in before opening a project."
                );

                setLoading(
                    false
                );

                return;
            }


            try {

                setLoading(
                    true
                );

                setError(
                    ""
                );


                //==================================================
                // GET PROJECT METADATA
                //==================================================

                const projectReference =
                    doc(
                        db,
                        "projects",
                        projectId
                    );


                const projectSnapshot =
                    await getDoc(
                        projectReference
                    );


                if (
                    !projectSnapshot.exists()
                ) {

                    throw new Error(
                        "Project does not exist."
                    );
                }


                const projectMetadata =
                    projectSnapshot.data();


                //==================================================
                // OWNERSHIP CHECK
                //==================================================

                if (
                    projectMetadata.ownerId !==
                    user.uid
                ) {

                    throw new Error(
                        "You do not have access to this project."
                    );
                }


                //==================================================
                // JSON URL
                //==================================================

                const jsonUrl =
                    projectMetadata.jsonUrl;


                if (
                    typeof jsonUrl !==
                    "string" ||
                    jsonUrl.trim() === ""
                ) {

                    throw new Error(
                        "This project does not have a valid JSON URL."
                    );
                }


                //==================================================
                // DOWNLOAD PROJECT JSON
                //==================================================

                const response =
                    await fetch(
                        jsonUrl
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        `Failed to download project JSON (${response.status}).`
                    );
                }


                const projectData =
                    await response.json();


                //==================================================
                // CANCEL CHECK
                //==================================================

                if (
                    cancelled
                ) {

                    return;
                }


                //==================================================
                // RECONSTRUCT EDITOR
                //==================================================

                dispatch({

                    type:
                        "LOAD_PROJECT",

                    payload:
                        projectData

                });


                //==================================================
                // Finished
                //==================================================

                setLoading(
                    false
                );

            } catch (
                loadError
            ) {

                console.error(
                    "Failed to load project:",
                    loadError
                );


                if (
                    cancelled
                ) {

                    return;
                }


                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "Failed to load project."
                );


                setLoading(
                    false
                );

            }

        }


        void loadProject();


        return () => {

            cancelled =
                true;

        };

    }, [
        projectId,
        dispatch
    ]);


    //==================================================
    // LOADING
    //==================================================

    if (
        loading
    ) {

        return (

            <div className="project-loading">

                <div>

                    <h2>
                        Opening Project
                    </h2>

                    <p>
                        Reconstructing your interior...
                    </p>

                </div>

            </div>

        );

    }


    //==================================================
    // ERROR
    //==================================================

    if (
        error
    ) {

        return (

            <div className="project-loading">

                <div>

                    <h2>
                        Unable to open project
                    </h2>

                    <p>
                        {error}
                    </p>


                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                "/studio"
                            )
                        }
                    >
                        Back to Projects
                    </button>

                </div>

            </div>

        );

    }


    //==================================================
    // ACTUAL EDITOR
    //==================================================

    return (
        <Editor />
    );
}


//==================================================
// STUDIO LOAD PROJECT
//==================================================

export default function StudioLoadProject() {

    return (

        <EditorProvider>

            <LoadProjectContent />

        </EditorProvider>

    );

}