import { Tool } from "./tools";
import type { Wall } from "../../engine/walls";
import type { Corner } from "../../engine/walls";

export interface EditorState {

    activeTab: string;

    activeTool: Tool;

    walls: Wall[];

    corners: Corner[];

    selectedWallId: string | null;

    selectedCornerId: string | null;

    wallHeight: number;

    wallThickness: number;

    snapEnabled: boolean;

    gridSize: number;

}