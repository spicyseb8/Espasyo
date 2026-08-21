import { Tool } from "./tools";

import type { Wall } from "../../engine/walls/WallTypes";
import type { Corner } from "../../engine/walls/Corner";
import type { Asset } from "../../assets/Asset";
import { BuildTool } from "../BuildTool";
import type { Door } from "../../engine/doors/DoorTypes";
import type { Furniture } from "../../engine/furniture/FurnitureTypes";
import type { Window } from "../../engine/windows/WindowTypes";
import type { Opening } from "../../engine/openings/OpeningTypes";

export type EditorAction =
    | {
          type: "SET_ACTIVE_TAB";
          payload: string;
      }
    | {
          type: "SET_ACTIVE_TOOL";
          payload: Tool;
      }
    | {
          type: "ADD_WALL";
          payload: Wall;
      }
    | {
          type: "SET_WALL_HEIGHT";
          payload: number;
      }
    | {
          type: "SET_WALL_THICKNESS";
          payload: number;
      }
    | {
          type: "SET_GRID_SIZE";
          payload: number;
      }
    | {
          type: "TOGGLE_SNAP";
      }
    | { type: "REMOVE_WALL"; payload: string }
    | {
          type: "ADD_CORNER";
          payload: Corner;
      }
    | {
          type: "REMOVE_CORNER";
          payload: string;
      }
    | {
          type: "SELECT_WALL";
          payload: string | null;
      }
    | {
          type: "SELECT_REGION";
          payload: string | null;
      }
    | {
          type: "SET_WALLS";
          payload: Wall[];
      }
    | {
          type: "SET_CORNERS";
          payload: Corner[];
      }
    | {
          type: "SELECT_CORNER";
          payload: string | null;
      }
    | {
          type: "CONFIRM_LAYOUT";
      }
    | {
          type: "SET_BUILD_TOOL";
          payload: BuildTool;
      }
    | {
          type: "SET_SELECTED_ASSET";
          payload: Asset | null;
      }
    | {
          type: "ADD_DOOR";
          payload: Door;
      }
      | {
            type: "ADD_WINDOW";
            payload: Window;
        }
            | {
                  type: "ADD_FURNITURE";
                  payload: Furniture;
              }
        | {
    type: "ADD_OPENING";
    payload: Opening;
}
| {
    type: "UPDATE_OPENING";
    payload: Opening;
}
| {
    type: "REMOVE_OPENING";
    payload: string;
}
| {
    type: "SELECT_OPENING";
    payload: string | null;
}
    | {
          type: "SET_DRAFT_WALL_LENGTH";
          payload: number | null;
      }
      | {
          type: "APPLY_SELECTED_ASSET";
      }
    | {
          type: "SET_SHOW_WALL_MEASUREMENTS";
          payload: boolean;
      };
      