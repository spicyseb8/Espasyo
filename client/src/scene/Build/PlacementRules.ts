import type { BuildTool } from "../../context/BuildTool";

export type VerticalAnchor =
    | "bottom"
    | "center";

export interface PlacementRule {

    //--------------------------------------------------
    // Where the asset sits vertically on the wall
    //--------------------------------------------------

    anchor: VerticalAnchor;

    //--------------------------------------------------
    // Can the asset rotate to match the wall?
    //--------------------------------------------------

    rotateWithWall: boolean;

    //--------------------------------------------------
    // Must this asset remain completely inside
    // the wall length?
    //--------------------------------------------------

    clampToWall: boolean;

    //--------------------------------------------------
    // Does this asset require a wall?
    //--------------------------------------------------

    requiresWall: boolean;

}

export const PlacementRules: Record<BuildTool, PlacementRule> = {

    none: {

        anchor: "bottom",

        rotateWithWall: false,

        clampToWall: false,

        requiresWall: false

    },

    door: {

        anchor: "bottom",

        rotateWithWall: true,

        clampToWall: true,

        requiresWall: true

    },

    opening: {

        anchor: "bottom",

        rotateWithWall: true,

        clampToWall: true,

        requiresWall: true

    },

    window: {

        anchor: "center",

        rotateWithWall: true,

        clampToWall: true,

        requiresWall: true

    }

};