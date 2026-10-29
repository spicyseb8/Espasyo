import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/firebase/firebase";
import { getAdminProject } from "@/services/assets/projectService";
import type { AdminProject } from "@/services/assets/projectService";
import { filterUnavailableProjectAssets } from "@/services/assets/filterUnavailableProjectAssets";
import { preloadAdminProjectAssets } from "@/services/assets/projectAssetPreloader";
import { loadAdminManagedProjectForReview } from "@/services/assets/managedInteriorReview";

import type { SavedProjectData } from "./ProjectTypes";
import AdminProjectViewer from "./AdminProjectViewer";

import LoadingScreen from "@/components/LoadingScreen";

interface LoadedProject {
    metadata: AdminProject;
    data: SavedProjectData;
    unavailableAssetIds: string[];
}

export default function AdminProjectLoader() {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [loadedProject, setLoadedProject] = useState<LoadedProject | null>(null);

    useEffect(() => {
        let cancelled = false;
        let activeController: AbortController | null = null;

        const unsubscribe = onAuthStateChanged(auth, async user => {
            activeController?.abort();
            activeController = null;

            if (!projectId) {
                if (!cancelled) {
                    setError("No project was selected.");
                    setLoading(false);
                }
                return;
            }

            if (!user) {
                if (!cancelled) {
                    setError("Please log in before opening a project.");
                    setLoading(false);
                }
                return;
            }

            const controller = new AbortController();
            activeController = controller;

            try {
                if (!cancelled) {
                    setLoading(true);
                    setError("");
                }

                //==================================================
                // GET PROJECT METADATA
                //==================================================
                const metadata = await getAdminProject(projectId);
                if (cancelled || controller.signal.aborted) return;

                let data: unknown;
                if (metadata.workflowType === "admin-managed") {
                    data = await loadAdminManagedProjectForReview(metadata, (input, init) =>
                        fetch(input, { ...init, signal: controller.signal })
                    );
                } else {
                    // Legacy projects continue to load the JSON referenced by jsonUrl.
                    if (!metadata.jsonUrl || metadata.jsonUrl.trim() === "") {
                        throw new Error("This project does not have a valid JSON download URL.");
                    }
                    const response = await fetch(metadata.jsonUrl.trim(), {
                        method: "GET",
                        cache: "no-store",
                        signal: controller.signal
                    });
                    if (!response.ok) {
                        throw new Error(`Project JSON request failed with HTTP ${response.status}.`);
                    }
                    data = await response.json();
                }

                validateProjectData(data);
                if (cancelled || controller.signal.aborted) return;

                const projectData = metadata.workflowType === "admin-managed"
                    ? data as SavedProjectData
                    : await filterUnavailableProjectAssets(data as SavedProjectData);

                if (cancelled || controller.signal.aborted) return;

                //==================================================
                // PRELOAD THIS PROJECT'S ASSETS
                //==================================================
                const unavailableAssetIds = await preloadAdminProjectAssets(projectData);

                if (cancelled || controller.signal.aborted) return;

                //==================================================
                // STORE
                //==================================================
                setLoadedProject({
                    metadata,
                    data: projectData,
                    unavailableAssetIds
                });

                setLoading(false);
            } catch (loadError) {
                if (cancelled || controller.signal.aborted) return;

                console.error("Failed to load admin project:", loadError);

                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "Failed to load project."
                );

                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
            activeController?.abort();
            unsubscribe();
        };
    }, [projectId]);

    //==================================================
    // LOADING
    //==================================================
    if (
        !error &&
        (
            loading ||
            loadedProject?.metadata.projectId !== projectId
        )
    ) {
        return <LoadingScreen />;
    }

    //==================================================
    // ERROR
    //==================================================
    if (error) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white">
                <div className="max-w-lg text-center">
                    <h2 className="text-lg font-semibold">Unable to open project</h2>

                    <p className="mt-2 break-words text-sm text-zinc-400">{error}</p>

                    <button
                        type="button"
                        className="mt-5 rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                        onClick={() => navigate(-1)}
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
            metadata={loadedProject.metadata}
            projectData={loadedProject.data}
            unavailableAssetIds={loadedProject.unavailableAssetIds}
        />
    );
}

//==================================================
// VALIDATE PROJECT JSON
//==================================================
function validateProjectData(data: unknown): asserts data is SavedProjectData {
    if (!data || typeof data !== "object") {
        throw new Error("Project JSON is invalid.");
    }

    const project = data as Partial<SavedProjectData>;

    if (typeof project.projectId !== "string") {
        throw new Error("Project JSON is missing projectId.");
    }

    if (!Array.isArray(project.corners)) {
        throw new Error("Project JSON is missing corners.");
    }

    if (!Array.isArray(project.walls)) {
        throw new Error("Project JSON is missing walls.");
    }

    if (!Array.isArray(project.doors)) {
        throw new Error("Project JSON is missing doors.");
    }

    if (!Array.isArray(project.windows)) {
        throw new Error("Project JSON is missing windows.");
    }

    if (!Array.isArray(project.furniture)) {
        throw new Error("Project JSON is missing furniture.");
    }

    if (!Array.isArray(project.openings)) {
        throw new Error("Project JSON is missing openings.");
    }
}