import {
    useEffect,
    useState
} from "react";

import {
    useNavigate,
    useParams
} from "react-router-dom";

import {
    onAuthStateChanged
} from "firebase/auth";

import {
    auth
} from "@/firebase/firebase";

import {
    getAdminProject
} from "@/services/assets/projectService";

import type {
    AdminProject
} from "@/services/assets/projectService";

import type {
    SavedProjectData
} from "./ProjectTypes";

import AdminProjectViewer
    from "./AdminProjectViewer";


interface LoadedProject {

    metadata:
        AdminProject;

    data:
        SavedProjectData;

}


export default function AdminProjectLoader() {

    const {
        projectId
    } = useParams<{
        projectId:
            string;
    }>();


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


    const [
        loadedProject,
        setLoadedProject
    ] = useState<LoadedProject | null>(
        null
    );


    useEffect(() => {

        let cancelled =
            false;


        const unsubscribe =
            onAuthStateChanged(
                auth,
                async user => {

                    //--------------------------------------------------
                    // PROJECT ID
                    //--------------------------------------------------

                    if (!projectId) {

                        if (!cancelled) {

                            setError(
                                "No project was selected."
                            );

                            setLoading(
                                false
                            );

                        }

                        return;

                    }


                    //--------------------------------------------------
                    // AUTH
                    //--------------------------------------------------

                    if (!user) {

                        if (!cancelled) {

                            setError(
                                "Please log in before opening a project."
                            );

                            setLoading(
                                false
                            );

                        }

                        return;

                    }


                    try {

                        if (!cancelled) {

                            setLoading(
                                true
                            );

                            setError("");

                        }


                        //--------------------------------------------------
                        // GET FIRESTORE PROJECT METADATA
                        //--------------------------------------------------

                        const metadata =
                            await getAdminProject(
                                projectId
                            );


                        //--------------------------------------------------
                        // CHECK JSON URL
                        //--------------------------------------------------

                        if (
                            !metadata.jsonUrl ||
                            metadata.jsonUrl.trim() === ""
                        ) {

                            throw new Error(
                                "This project does not have a valid JSON URL."
                            );

                        }


                        //--------------------------------------------------
                        // DOWNLOAD PROJECT JSON
                        //--------------------------------------------------

                        const response =
                            await fetch(
                                metadata.jsonUrl
                            );


                        if (!response.ok) {

                            throw new Error(
                                `Failed to download project JSON (${response.status}).`
                            );

                        }


                        const data =
                            await response.json();


                        //--------------------------------------------------
                        // BASIC VALIDATION
                        //--------------------------------------------------

                        validateProjectData(
                            data
                        );


                        //--------------------------------------------------
                        // CANCEL CHECK
                        //--------------------------------------------------

                        if (cancelled) {

                            return;

                        }


                        //--------------------------------------------------
                        // SAVE LOADED PROJECT
                        //--------------------------------------------------

                        setLoadedProject({

                            metadata,

                            data:
                                data as SavedProjectData

                        });


                        setLoading(
                            false
                        );

                    } catch (loadError) {

                        console.error(
                            "Failed to load admin project:",
                            loadError
                        );


                        if (cancelled) {

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
            );


        return () => {

            cancelled =
                true;

            unsubscribe();

        };

    }, [
        projectId
    ]);


    //==================================================
    // LOADING
    //==================================================

    if (loading) {

        return (

            <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white">

                <div className="text-center">

                    <h2 className="text-lg font-semibold">
                        Opening Project
                    </h2>

                    <p className="mt-2 text-sm text-zinc-400">
                        Loading project data...
                    </p>

                </div>

            </div>

        );

    }


    //==================================================
    // ERROR
    //==================================================

    if (error) {

        return (

            <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white">

                <div className="max-w-md text-center">

                    <h2 className="text-lg font-semibold">
                        Unable to open project
                    </h2>


                    <p className="mt-2 text-sm text-zinc-400">
                        {error}
                    </p>


                    <button
                        type="button"
                        className="mt-5 rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                        onClick={() =>
                            navigate(-1)
                        }
                    >
                        Back to Projects
                    </button>

                </div>

            </div>

        );

    }


    //==================================================
    // NO PROJECT
    //==================================================

    if (!loadedProject) {

        return null;

    }


    //==================================================
    // VIEWER
    //==================================================

    return (

        <AdminProjectViewer

            metadata={
                loadedProject.metadata
            }

            projectData={
                loadedProject.data
            }

        />

    );

}


//======================================================
// PROJECT JSON VALIDATION
//======================================================

function validateProjectData(
    data: unknown
): asserts data is SavedProjectData {

    if (
        !data ||
        typeof data !== "object"
    ) {

        throw new Error(
            "Project JSON is invalid."
        );

    }


    const project =
        data as Partial<SavedProjectData>;


    if (
        typeof project.projectId !==
        "string"
    ) {

        throw new Error(
            "Project JSON is missing projectId."
        );

    }


    if (
        !Array.isArray(
            project.corners
        )
    ) {

        throw new Error(
            "Project JSON is missing corners."
        );

    }


    if (
        !Array.isArray(
            project.walls
        )
    ) {

        throw new Error(
            "Project JSON is missing walls."
        );

    }


    if (
        !Array.isArray(
            project.doors
        )
    ) {

        throw new Error(
            "Project JSON is missing doors."
        );

    }


    if (
        !Array.isArray(
            project.windows
        )
    ) {

        throw new Error(
            "Project JSON is missing windows."
        );

    }


    if (
        !Array.isArray(
            project.furniture
        )
    ) {

        throw new Error(
            "Project JSON is missing furniture."
        );

    }


    if (
        !Array.isArray(
            project.openings
        )
    ) {

        throw new Error(
            "Project JSON is missing openings."
        );

    }

}