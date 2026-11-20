import { useCallback, useMemo, useState } from "react";
import {
    ArrowLeft,
    X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AdminProjectScene from "../project-loader/AdminProjectScene";
import type { AdminProject } from "@/services/assets/projectService";
import type { SavedProjectData } from "./ProjectTypes";
import AdminCostEstimator from "./engine/cost/AdminCostEstimator";
import LoadingScreen from "@/components/LoadingScreen";

interface AdminProjectViewerProps {
    metadata: AdminProject;
    projectData: SavedProjectData;
    unavailableAssetIds?: string[];
}

export default function AdminProjectViewer({
    metadata,
    projectData,
    unavailableAssetIds = []
}: AdminProjectViewerProps) {
    const navigate = useNavigate();

    //==================================================
    // FLOORS
    //==================================================
    const reviewFloors = useMemo(() => {
        if (projectData.floors?.length) {
            return projectData.floors.map((floor, index) => ({
                ...floor,
                floorId: floor.floorId ?? floor.id ?? (index === 0 ? "first-floor" : `floor-${index + 1}`)
            }));
        }
        return [{
            floorId: "first-floor",
            name: "1st Floor",
            structure: projectData
        }];
    }, [projectData]);

    const [activeFloorId, setActiveFloorId] = useState(
        projectData.activeFloorId ??
        projectData.floors?.[0]?.floorId ??
        projectData.floors?.[0]?.id ??
        "first-floor"
    );
    const activeFloorIndex = Math.max(
        0,
        reviewFloors.findIndex(floor => floor.floorId === activeFloorId)
    );
    const activeFloor = reviewFloors[activeFloorIndex];
    const activeProjectData = useMemo(() => ({
        ...projectData,
        ...activeFloor.structure,
        furniture: activeFloor.furniture ??
            activeFloor.structure.furniture ??
            (activeFloorIndex === 0 ? projectData.furniture : []),
        stairs: activeFloor.stairs ??
            activeFloor.structure.stairs ??
            (activeFloorIndex === 0 ? projectData.stairs : []),
        stairLandings: activeFloor.stairLandings ??
            activeFloor.structure.stairLandings ??
            (activeFloorIndex === 0 ? projectData.stairLandings : []),
        floorFinishes: activeFloor.floorFinishes ??
            activeFloor.structure.floorFinishes ??
            (activeFloorIndex === 0 ? projectData.floorFinishes : {}),
        wallFinishes: activeFloor.wallFinishes ??
            activeFloor.structure.wallFinishes ??
            (activeFloorIndex === 0 ? projectData.wallFinishes : {}),
        wallPaintSeparators: activeFloor.wallPaintSeparators ??
            activeFloor.structure.wallPaintSeparators ??
            (activeFloorIndex === 0 ? projectData.wallPaintSeparators : {}),
        floorPaintSeparators: activeFloor.floorPaintSeparators ??
            activeFloor.structure.floorPaintSeparators ??
            (activeFloorIndex === 0 ? projectData.floorPaintSeparators : {})
    }), [activeFloor, activeFloorIndex, projectData]);

    //==================================================
    // STATE
    //==================================================
    const [sceneReady, setSceneReady] = useState(false);
    const [runtimeAssetFailures, setRuntimeAssetFailures] = useState<string[]>([]);
    const [assetWarningDismissed, setAssetWarningDismissed] = useState(false);
    const reportedUnavailableAssetIds = [
        ...new Set([...unavailableAssetIds, ...runtimeAssetFailures])
    ];
    const handleSceneReady = useCallback(() => {
        setSceneReady(true);
    }, []);

    //==================================================
    // EFFECTS
    //==================================================
    //==================================================
    // DERIVED
    //==================================================
    const snapshotLabel = metadata.reviewSnapshotType === "submitted"
        ? `Submitted design · v${metadata.submittedVersionNumber ?? "legacy"}`
        : metadata.reviewSnapshotType === "approved"
            ? `Approved design · v${metadata.approvedVersionNumber ?? "legacy"}`
            : metadata.reviewSnapshotType === "latest-saved"
                ? `Latest saved design · v${metadata.currentDesignVersionNumber ?? "not versioned"} (not live)`
                : "Project design";

    const projectTitle = projectData.projectName || metadata.projectName;
    //==================================================
    // RENDER
    //==================================================
    return (
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#f5f5f3] text-[#222]">
            {/* ================= HEADER ================= */}
            <header className="relative z-50 flex h-14 shrink-0 items-center gap-3 border-b border-[#e4e4e1] bg-white px-4">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dededb] bg-white px-3 text-sm font-medium text-[#333] transition hover:bg-[#f5f5f3]"
                >
                    <ArrowLeft size={15} />
                    Back
                </button>

                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-sm font-semibold leading-tight">
                        {projectTitle}
                    </h1>
                    <p className="truncate text-xs text-[#888]">
                        {snapshotLabel} · View only
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <AdminCostEstimator projectData={projectData} />
                    </div>

                </div>
            </header>

            {/* ================= BODY ================= */}
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                {/* ---------- 3D SCENE ---------- */}
                <div
                    className="relative isolate min-h-0 min-w-0 flex-1 overflow-hidden"
                >
                    <AdminProjectScene
                        projectData={activeProjectData}
                        onReady={handleSceneReady}
                        onAssetError={assetId => setRuntimeAssetFailures(current =>
                            current.includes(assetId) ? current : [...current, assetId]
                        )}
                    />

                    {/* Floor buttons: right side, vertically centered (1F on top, 2F below) */}
                    {reviewFloors.length > 1 && (
                        <nav
                            className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2"
                            aria-label="Floors"
                        >
                            {reviewFloors.map((floor, index) => {
                                const active = floor.floorId === activeFloor.floorId;
                                return (
                                    <button
                                        key={floor.floorId}
                                        type="button"
                                        title={floor.name}
                                        aria-label={floor.name}
                                        aria-pressed={active}
                                        onClick={() => setActiveFloorId(floor.floorId)}
                                        className={`flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-semibold shadow-md transition ${
                                            active
                                                ? "border-[#333] bg-[#333] text-white"
                                                : "border-[#dededb] bg-white text-[#555] hover:bg-[#f5f5f3]"
                                        }`}
                                    >
                                        {index + 1}F
                                    </button>
                                );
                            })}
                        </nav>
                    )}

                    {/* Asset warning (dismissible, details collapsed) */}
                    {reportedUnavailableAssetIds.length > 0 && !assetWarningDismissed && (
                        <div
                            role="alert"
                            className="absolute bottom-4 left-4 z-20 max-w-[340px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 shadow"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <p>
                                    Some items could not be loaded. The rest of the design is still visible.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setAssetWarningDismissed(true)}
                                    aria-label="Dismiss warning"
                                    className="shrink-0 text-amber-900/70 hover:text-amber-950"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            <details className="mt-1">
                                <summary className="cursor-pointer text-amber-900/80">Show details</summary>
                                <p className="mt-1 break-words">
                                    Asset IDs: {reportedUnavailableAssetIds.join(", ")}
                                </p>
                            </details>
                        </div>
                    )}
                </div>

            </div>

            {!sceneReady && (
                <div className="fixed inset-0 z-[100000]">
                    <LoadingScreen label="Preparing 3D Scene" />
                </div>
            )}
        </div>
    );
}