import {
    Tool
} from "./tools";

import type {
    Wall
} from "../../engine/walls/WallTypes";

import type {
    Corner
} from "../../engine/walls/Corner";

import type {
    Asset
} from "../../assets/Asset";

import {
    BuildTool
} from "../BuildTool";

import type {
    Door
} from "../../engine/doors/DoorTypes";

import type {
    Furniture
} from "../../engine/furniture/FurnitureTypes";

import type {
    Window
} from "../../engine/windows/WindowTypes";

import type {
    Opening
} from "../../engine/openings/OpeningTypes";

import type {
    BlueprintState
} from "../../engine/blueprint/BlueprintTypes";

import type {
    BlueprintCalibrationPoint
} from "./types";
import type { SavedProjectData } from "./ProjectTypes";

export type EditorAction =

    | { type: "SET_ACTIVE_TAB"; payload: string; }
    | { type: "SET_ACTIVE_TOOL"; payload: Tool; }
    | { type: "SET_BUILD_TOOL"; payload: BuildTool; }

    | { type: "ADD_WALL"; payload: Wall; }
    | { type: "SET_WALLS"; payload: Wall[]; }
    | { type: "REMOVE_WALL"; payload: string; }

    | { type: "SET_WALL_HEIGHT"; payload: number; }
    | { type: "SET_WALL_THICKNESS"; payload: number; }

    | { type: "ADD_CORNER"; payload: Corner; }
    | { type: "SET_CORNERS"; payload: Corner[]; }
    | { type: "REMOVE_CORNER"; payload: string; }

    | { type: "SELECT_WALL"; payload: string | null; }
    | { type: "SELECT_REGION"; payload: string | null; }
    | { type: "SELECT_CORNER"; payload: string | null; }
    | { type: "SELECT_OPENING"; payload: string | null; }
    | { type: "SELECT_FURNITURE"; payload: string | null; }
    | { type: "SELECT_DOOR"; payload: string | null; }
    | { type: "SELECT_WINDOW"; payload: string | null; }
    | { type: "CLEAR_SELECTION"; }
    | { type: "SET_SELECTED_ASSET"; payload: Asset | null; }
    | { type: "SET_MOVING_FURNITURE"; payload: string | null;}
    | { type: "SET_GRID_SIZE"; payload: number; }
    | { type: "TOGGLE_SNAP"; }

    | { type: "SET_FLOOR_FINISH"; payload: { regionId: string; materialId: string; }; }
    | { type: "SET_FLOOR_FINISH_ALL"; payload: string; }
    | { type: "SET_WALL_FINISH"; payload: { regionId: string; wallId: string; materialId: string; }; }

    | { type: "CONFIRM_LAYOUT"; }
    | { type: "LOAD_PROJECT"; payload: SavedProjectData; }
    | { type: "ADD_DOOR"; payload: Door; }
    | { type: "UPDATE_DOOR"; payload: { id: string; changes: Partial<Door>; }; }
    | { type: "REMOVE_DOOR"; payload: string; }

    | { type: "ADD_WINDOW"; payload: Window; }
    | { type: "UPDATE_WINDOW"; payload: { id: string; changes: Partial<Window>; }; }
    | { type: "REMOVE_WINDOW"; payload: string; }

    | { type: "ADD_FURNITURE"; payload: Furniture; }
    | { type: "UPDATE_FURNITURE"; payload: { id: string; changes: Partial<Furniture>; }; }
    | { type: "REMOVE_FURNITURE"; payload: string; }

    | { type: "ADD_OPENING"; payload: Opening; }
    | { type: "SET_OPENING_WIDTH"; payload: number; }
    | { type: "SET_OPENING_HEIGHT"; payload: number; }
    | { type: "SET_ARCH_RISE"; payload: number; }

    | { type: "SET_DRAFT_WALL_LENGTH"; payload: number | null; }
    | { type: "SET_SHOW_WALL_MEASUREMENTS"; payload: boolean; }

    | { type: "APPLY_SELECTED_ASSET"; }

    | { type: "SET_BLUEPRINT"; payload: BlueprintState; }
    | { type: "REMOVE_BLUEPRINT"; }
    | { type: "HIDE_BLUEPRINT"; }
    | { type: "SHOW_BLUEPRINT"; }
    | { type: "UPDATE_BLUEPRINT"; payload: Partial<BlueprintState>; }
    | { type: "SET_BLUEPRINT_LOCKED"; payload: boolean; }
    | { type: "SET_BLUEPRINT_OPACITY"; payload: number; }
    | { type: "SET_BLUEPRINT_SELECTED"; payload: boolean; }

    | { type: "SET_BLUEPRINT_CALIBRATION_MODE"; payload: boolean; }
    | { type: "SET_BLUEPRINT_CALIBRATION_START"; payload: BlueprintCalibrationPoint | null; }
    | { type: "SET_BLUEPRINT_CALIBRATION_END"; payload: BlueprintCalibrationPoint | null; }
    | { type: "CLEAR_BLUEPRINT_CALIBRATION"; }
    | { type: "APPLY_BLUEPRINT_CALIBRATION"; payload: number; }

    | { type: "TOGGLE_WALKTHROUGH"; };
