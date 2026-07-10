import { Tool } from "./tools";

import type { Wall } from "../../types/Walls";

export interface EditorState {

    activeTab: string;

    activeTool: Tool;

    walls: Wall[];

    wallHeight: number;

    wallThickness: number;

    snapEnabled: boolean;

    gridSize: number;

}