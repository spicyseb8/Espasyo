import {
    useNavigate
} from "react-router-dom";

import AdminProjectScene
    from "../project-loader/AdminProjectScene";

import type {
    AdminProject
} from "@/services/assets/projectService";

import type {
    SavedProjectData
} from "./ProjectTypes";


interface AdminProjectViewerProps {

    metadata:
        AdminProject;

    projectData:
        SavedProjectData;

}


export default function AdminProjectViewer({
    metadata,
    projectData
}: AdminProjectViewerProps) {

    const navigate =
        useNavigate();


    return (

        <div className="relative h-screen w-screen overflow-hidden bg-zinc-950">

            {/*==================================================
                3D PROJECT
            ==================================================*/}

            <AdminProjectScene
                projectData={
                    projectData
                }
            />


            {/*==================================================
                PROJECT INFORMATION
            ==================================================*/}

            <div className="pointer-events-none absolute left-4 top-4 z-30">

                <div className="pointer-events-auto rounded-lg border border-zinc-800 bg-zinc-950/90 px-4 py-3 shadow-xl backdrop-blur">

                    <p className="text-xs text-zinc-400">
                        Admin Project Viewer
                    </p>


                    <h1 className="mt-1 text-base font-semibold text-white">
                        {
                            projectData.projectName ||
                            metadata.projectName
                        }
                    </h1>


                    <p className="mt-1 text-xs text-zinc-500">
                        View-only
                    </p>

                </div>

            </div>


            {/*==================================================
                BACK BUTTON
            ==================================================*/}

            <button
                type="button"
                className="absolute right-4 top-4 z-30 rounded-md border border-zinc-700 bg-zinc-950/90 px-4 py-2 text-sm font-medium text-white shadow-xl backdrop-blur hover:bg-zinc-800"
                onClick={() =>
                    navigate(-1)
                }
            >
                Back
            </button>

        </div>

    );

}