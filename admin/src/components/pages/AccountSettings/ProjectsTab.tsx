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
    Card,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";

import {
    getProjectsForUserAccount,
    type AdminProject
} from "../../../services/assets/projectService";


//==================================================
// PROJECTS TAB
//==================================================

export default function ProjectsTab() {

    const navigate =
        useNavigate();


    //==================================================
    // USER ACCOUNT ID
    //==================================================
    //
    // This comes from:
    //
    // /users/:id
    //
    // It represents the customer account whose
    // Account Settings page is currently open.
    //==================================================

    const {
        id: accountId
    } = useParams<{
        id?: string;
    }>();


    //==================================================
    // STATE
    //==================================================

    const [
        projects,
        setProjects
    ] = useState<AdminProject[]>([]);


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        error,
        setError
    ] = useState("");


    //==================================================
    // LOAD PROJECTS
    //==================================================

    useEffect(() => {

        let cancelled =
            false;


        const unsubscribe =
            onAuthStateChanged(
                auth,
                async user => {

                    //--------------------------------------------------
                    // ADMIN AUTH
                    //--------------------------------------------------

                    if (!user) {

                        if (!cancelled) {

                            setProjects([]);

                            setError(
                                "Please log in to view projects."
                            );

                            setLoading(
                                false
                            );

                        }

                        return;
                    }


                    //--------------------------------------------------
                    // CUSTOMER ACCOUNT ID
                    //--------------------------------------------------

                    if (
                        !accountId ||
                        accountId.trim() === ""
                    ) {

                        if (!cancelled) {

                            setProjects([]);

                            setError(
                                "No customer account was selected."
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


                        console.log(
                            "ProjectsTab account ID:",
                            accountId
                        );


                        console.log(
                            "ProjectsTab admin UID:",
                            user.uid
                        );


                        //--------------------------------------------------
                        // IMPORTANT
                        //
                        // Resolve the account ID to the actual
                        // ownerId used by project documents.
                        //--------------------------------------------------

                        const loadedProjects =
                            await getProjectsForUserAccount(
                                accountId
                            );


                        console.log(
                            "ProjectsTab projects loaded:",
                            loadedProjects
                        );


                        if (!cancelled) {

                            setProjects(
                                loadedProjects
                            );

                        }

                    } catch (
                        loadError
                    ) {

                        console.error(
                            "Failed to load customer projects:",
                            loadError
                        );


                        if (!cancelled) {

                            setProjects([]);

                            setError(

                                loadError instanceof Error

                                    ? loadError.message

                                    : "Failed to load projects."

                            );

                        }

                    } finally {

                        if (!cancelled) {

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

    }, [
        accountId
    ]);


    //==================================================
    // VIEW PROJECT
    //==================================================

    function handleViewProject(
        project:
            AdminProject
    ) {

        navigate(
            `/projects/view/${project.projectId}`
        );

    }


    //==================================================
    // FORMAT DATE
    //==================================================

    function formatProjectDate(
        value:
            unknown
    ): string {

        if (!value) {

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
                        unknown;
                }
            ).toDate === "function"
        ) {

            const date =
                (
                    value as {
                        toDate:
                            () => Date;
                    }
                ).toDate();


            return date.toLocaleDateString();

        }


        //--------------------------------------------------
        // JavaScript Date
        //--------------------------------------------------

        if (
            value instanceof Date
        ) {

            return value.toLocaleDateString();

        }


        //--------------------------------------------------
        // String date
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

                return date.toLocaleDateString();

            }

        }


        return "Unknown date";

    }


    //==================================================
    // LOADING
    //==================================================

    if (
        loading
    ) {

        return (

            <div className="p-6">

                <p className="text-sm text-zinc-400">

                    Loading projects...

                </p>

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

            <div className="p-6">

                <p className="text-sm text-red-400">

                    {error}

                </p>

            </div>

        );

    }


    //==================================================
    // EMPTY
    //==================================================

    if (
        projects.length === 0
    ) {

        return (

            <div className="p-6">

                <p className="text-sm text-zinc-400">

                    No projects found.

                </p>

            </div>

        );

    }


    //==================================================
    // PROJECT CARDS
    //==================================================

    return (

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">

            {
                projects.map(
                    project => (

                        <Card

                            key={
                                project.projectId
                            }

                            className="border-zinc-800 bg-zinc-900"

                        >

                            <CardHeader>

                                <CardTitle className="text-sm text-white">

                                    {
                                        project.projectName
                                    }

                                </CardTitle>


                                <CardDescription>

                                    Owner:{" "}

                                    {
                                        project.ownerId ||
                                        "Unknown"
                                    }

                                    <br />

                                    Updated:{" "}

                                    {
                                        formatProjectDate(
                                            project.updatedAt
                                        )
                                    }

                                </CardDescription>


                                <button

                                    type="button"

                                    className="mt-3 w-fit rounded-md bg-white px-4 py-2 text-sm font-medium text-black"

                                    onClick={() =>
                                        handleViewProject(
                                            project
                                        )
                                    }

                                >

                                    View Project

                                </button>

                            </CardHeader>

                        </Card>

                    )
                )
            }

        </div>

    );

}