import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import useEditor from "../../context/editor/useEditor";
import { placeOpening } from "../../engine/openings/PlaceOpening";
import type { OpeningShape } from "../../engine/openings/OpeningTypes";
import { buildInteraction } from "./BuildInteraction";
import { placeDoor } from "../../engine/doors/PlaceDoor";
import { placeWindow } from "../../engine/windows/PlaceWindow";
import { BuildTool } from "../../context/BuildTool";

export default function BuildInteractionEvents() {
  const { gl } = useThree();
  const { state, dispatch } = useEditor();

  useEffect(() => {
    const canvas = gl.domElement;

    function onPointerMove(e: PointerEvent) {
      buildInteraction.updatePointer(e, canvas);
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      if (state.buildTool === BuildTool.Furniture) return;
      if (state.buildTool === BuildTool.None) return;

      e.preventDefault();
      e.stopPropagation();
      buildInteraction.suppressPointerUp();
      buildInteraction.updatePointer(e, canvas);

      if (!state.selectedAsset) return;

      if (
        state.selectedAsset.type !== BuildTool.Door &&
        state.selectedAsset.type !== BuildTool.Window &&
        state.selectedAsset.type !== BuildTool.Opening
      ) {
        return;
      }

      const result = buildInteraction.pointerDown();
      if (!result) return;

      if (result.transform.kind !== "wall") return;

      if (state.selectedAsset.type === BuildTool.Door) {
        const door = placeDoor(
          state.selectedAsset,
          result.transform,
          result.bounds
        );
        dispatch({ type: "ADD_DOOR", payload: door });
      }

      if (state.selectedAsset.type === BuildTool.Window) {
        const window = placeWindow(
          state.selectedAsset,
          result.transform,
          result.bounds
        );
        dispatch({ type: "ADD_WINDOW", payload: window });
      }

      if (state.selectedAsset.type === BuildTool.Opening) {
        const shape: OpeningShape =
          state.selectedAsset.openingShape ?? "rectangle";
        const opening = placeOpening(
          result.transform,
          result.bounds,
          shape
        );
        dispatch({ type: "ADD_OPENING", payload: opening });
      }

      dispatch({ type: "SET_BUILD_TOOL", payload: BuildTool.None });
      dispatch({ type: "SET_SELECTED_ASSET", payload: null });
    }

    function onPointerUp(e: PointerEvent) {
      if (!buildInteraction.consumePointerUpSuppression()) return;
      e.preventDefault();
      e.stopPropagation();
    }

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp, true);

    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp, true);
    };
  }, [gl, state.selectedAsset, state.buildTool, dispatch]);

  return null;
}