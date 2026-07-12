import { Tool } from "./tools";
import type { Wall } from "../../engine/walls";
import type { Corner } from "../../engine/walls";
import { WallMode } from "./WallMode";
export interface EditorState {

    activeTab: string;

    activeTool: Tool;

    walls: Wall[];
    wallMode: WallMode;
    corners: Corner[];

    selectedWallId: string | null;

    selectedCornerId: string | null;

    wallHeight: number;

    wallThickness: number;

    snapEnabled: boolean;

    gridSize: number;

}