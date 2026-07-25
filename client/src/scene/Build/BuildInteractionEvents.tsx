import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import useEditor from "../../context/editor/useEditor";

import { buildInteraction } from "./BuildInteraction";

import { placeDoor } from "../../engine/doors/PlaceDoor";

import { BuildTool } from "../../context/BuildTool";

export default function BuildInteractionEvents() {

    const { gl } = useThree();

    const { state, dispatch } = useEditor();

    useEffect(() => {

        const canvas = gl.domElement;

        //--------------------------------------------------
        // Pointer Move
        //--------------------------------------------------

        function onPointerMove(
            e: PointerEvent
        ) {

            buildInteraction.updatePointer(
                e,
                canvas
            );

        }

        //--------------------------------------------------
        // Pointer Down
        //--------------------------------------------------

        function onPointerDown(
            e: PointerEvent
        ) {

            //--------------------------------------------------
            // Left Click only
            //--------------------------------------------------

            if (e.button !== 0)
                return;

            buildInteraction.updatePointer(
                e,
                canvas
            );

            //--------------------------------------------------
            // Selected Asset
            //--------------------------------------------------

            if (!state.selectedAsset)
                return;

            //--------------------------------------------------
            // Only doors for now
            //--------------------------------------------------

            if (state.selectedAsset.type !== BuildTool.Door)
                return;

            //--------------------------------------------------
            // Current preview placement
            //--------------------------------------------------

            const result =
                buildInteraction.pointerDown();

            if (!result)
                return;

            //--------------------------------------------------
            // Create Door
            //--------------------------------------------------

            const door = placeDoor(

                state.selectedAsset,

                result.transform,

                result.bounds

            );

            //--------------------------------------------------
            // Store Door
            //--------------------------------------------------
            console.log(door);
            dispatch({

                type: "ADD_DOOR",

                payload: door

            });

        }

        canvas.addEventListener(
            "pointermove",
            onPointerMove
        );

        canvas.addEventListener(
            "pointerdown",
            onPointerDown
        );

        return () => {

            canvas.removeEventListener(
                "pointermove",
                onPointerMove
            );

            canvas.removeEventListener(
                "pointerdown",
                onPointerDown
            );

        };

    }, [

        gl,

        state.selectedAsset,

        dispatch

    ]);

    return null;

}