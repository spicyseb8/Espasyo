import { Tool } from "./tools";

import type { Wall } from "../../types/Wall";

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

      };