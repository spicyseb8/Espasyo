import type { EditorState } from "../context/editor/types";
import { calculateCostEstimate } from "../engine/cost/CostEstimator";

export function createProjectData(
    state: EditorState,
    projectId: string,
    projectName: string,
    ownerId: string
) {
    return {
        projectId,
        projectName,
        ownerId,
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        wallHeight: state.wallHeight,
        wallThickness: state.wallThickness,
        gridSize: state.gridSize,
        snapEnabled: state.snapEnabled,
        layoutConfirmed: state.layoutConfirmed,
        walls: state.walls.map(wall => ({
            id: wall.id,
            start: {
                id: wall.start.id,
                position: {
                    x: wall.start.position.x,
                    y: wall.start.position.y,
                    z: wall.start.position.z
                }
            },
            end: {
                id: wall.end.id,
                position: {
                    x: wall.end.position.x,
                    y: wall.end.position.y,
                    z: wall.end.position.z
                }
            }
        })),
        corners: state.corners.map(corner => ({
            id: corner.id,
            position: {
                x: corner.position.x,
                y: corner.position.y,
                z: corner.position.z
            }
        })),
        doors: state.doors.map(door => ({
            id: door.id,
            assetId: door.assetId,
            wallId: door.wallId,
            position: {
                x: door.position.x,
                y: door.position.y,
                z: door.position.z
            },
            rotationY: door.rotationY,
            width: door.width,
            height: door.height,
            depth: door.depth
        })),
        windows: state.windows.map(window => ({
            id: window.id,
            assetId: window.assetId,
            wallId: window.wallId,
            position: {
                x: window.position.x,
                y: window.position.y,
                z: window.position.z
            },
            rotationY: window.rotationY,
            width: window.width,
            height: window.height,
            depth: window.depth
        })),
        furniture: state.furniture.map(item => ({
            id: item.id,
            assetId: item.assetId,
            position: {
                x: item.position.x,
                y: item.position.y,
                z: item.position.z
            },
            rotationY: item.rotationY,
            modelOffset: {
                x: item.modelOffset.x,
                y: item.modelOffset.y,
                z: item.modelOffset.z
            },
            width: item.width,
            depth: item.depth,
            height: item.height
        })),
        openings: state.openings.map(opening => ({
            id: opening.id,
            wallId: opening.wallId,
            shape: opening.shape,
            position: {
                x: opening.position.x,
                y: opening.position.y,
                z: opening.position.z
            },
            width: opening.width,
            height: opening.height,
            depth: opening.depth,
            archRise: opening.archRise
        })),
        floorFinishes: {
            ...state.floorFinishes
        },
        wallFinishes: Object.fromEntries(
            Object.entries(state.wallFinishes).map(
                ([regionId, walls]) => [
                    regionId,
                    {
                        ...walls
                    }
                ]
            )
        ),
        archRise: state.archRise,
        openingWidth: state.openingWidth,
        openingHeight: state.openingHeight,
        blueprint: state.blueprint
            ? {
                ...state.blueprint
            }
            : null,
        costEstimate: calculateCostEstimate(state)
    };
}

export type ProjectData = ReturnType<typeof createProjectData>;