import {
    useEffect,
    useState
} from "react";

import {
    useNavigate
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
    getAdminProjects,
    type AdminProject
} from "../../../services/assets/projectService";


export default function ProjectsTab() {

    const navigate =
        useNavigate();


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

                    if (!user) {

                        if (!cancelled) {

                            setError(
                                "Please log in to view projects."
                            );

                            setLoading(false);

                        }

                        return;

                    }


                    try {

                        setLoading(true);
                        setError("");


                        const loadedProjects =
                            await getAdminProjects();


                        if (!cancelled) {

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


                        if (!cancelled) {

                            setError(
                                loadError instanceof Error
                                    ? loadError.message
                                    : "Failed to load projects."
                            );

                        }

                    } finally {

                        if (!cancelled) {

                            setLoading(false);

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


    //==================================================
    // VIEW PROJECT
    //==================================================

    function handleViewProject(
        project: AdminProject
    ) {

        navigate(
            `/projects/view/${project.projectId}`
        );

    }


    //==================================================
    // FORMAT DATE
    //==================================================

    function formatProjectDate(
        value: unknown
    ): string {

        if (!value) {

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
            ).toDate === "function"
        ) {

            const date =
                (
                    value as {
                        toDate:
                            () => Date
                    }
                ).toDate();


            return date.toLocaleDateString();

        }


        return "Unknown date";

    }


    //==================================================
    // LOADING
    //==================================================

    if (loading) {

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

    if (error) {

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

    if (projects.length === 0) {

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

            {projects.map(
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
            )}

        </div>

    );

}