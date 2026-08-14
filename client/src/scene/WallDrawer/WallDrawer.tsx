import { useFrame, useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector3 } from "three";
import { useCallback, useEffect, useRef, useState } from "react";

import useEditor from "../../context/editor/useEditor";
import { Tool } from "../../context/editor/tools";


import PreviewWall from "../Preview/PreviewWall";
import WallMeasurement from "../Preview/WallMeasurement";

import AlignmentGuides from "../Guides/AlignmentGuides";
import CornerHighlight from "../Corners/CornerHighlight";




import {
    snapToGrid,
    snap90Degrees,
    snapToWall,
    snapToWallEndpoint
} from "../../engine/walls/wallSnapping";

import { getAlignmentGuides } from "../../engine/walls/Alignment";

import { placeWall } from "../../engine/walls/PlaceWalls";

import { hitWallByRaycast } from "../../engine/walls/wallHit";

const raycaster = new Raycaster();

const groundPlane = new Plane(
    new Vector3(0, 1, 0),
    0
);

export default function WallDrawer() {

    const { state, dispatch } = useEditor();

    const { camera, pointer, gl, scene } = useThree();

    const mouseDown = useRef({
        x: 0,
        y: 0
    });

    const moved = useRef(false);

    // Which mouse button started the current gesture. Right-click toggles
    // the wall tool on/off (replacing the old "Start/Stop Drawing"
    // button); left-click does the actual point-placement/drawing. We
    // capture this on pointerdown rather than re-reading e.button on
    // pointerup, since not all browsers populate PointerEvent.button
    // reliably on release.
    const pointerButton = useRef(0);

    // Tracks whether the current pointer gesture actually started on the
    // canvas. We listen on `window` (not the canvas element) so that
    // dragging off-canvas still works mid-drag -- but that also means
    // clicks on the sidebar, toolbar, "Confirm Layout", inputs, tabs,
    // etc. would otherwise reach this listener too and get misread as
    // wall clicks. Gating on where the gesture *began* fixes that.
    const startedOnCanvas = useRef(false);

    const [startPoint, setStartPoint] =
        useState<Vector3 | null>(null);

    const currentPoint = useRef(
        new Vector3()
    );

    const guides = useRef<
        ReturnType<typeof getAlignmentGuides>
    >([]);

    const [, forceUpdate] = useState(0);

    //----------------------------------------------------
    // Mouse Position
    //----------------------------------------------------
    // Picking order is wall-first, ground-plane as fallback:
    //
    //   raycast scene
    //     -> hit a wall?  use the hit point, projected onto the ground
    //     -> otherwise    fall back to intersecting the ground plane
    //
    // This makes the wall mesh itself intercept the click instead of
    // the ray always passing through to the floor first.
    //----------------------------------------------------

    useFrame(() => {

        if (state.activeTool !== Tool.Wall)
            return;

        raycaster.setFromCamera(
            pointer,
            camera
        );

        const wallHit = hitWallByRaycast(
            raycaster,
            scene.children,
            state.walls
        );

        let point: Vector3;

        if (wallHit) {

            // Ray hit a wall -- use that point (already projected to
            // the ground by hitWallByRaycast) instead of continuing on
            // to the floor.
            point = wallHit.point;

        } else {

            // No wall in the way -- fall back to the ground plane.
            point = new Vector3();

            raycaster.ray.intersectPlane(
                groundPlane,
                point
            );

        }

        let snapped = point.clone();

        if (state.snapEnabled) {

            snapped = snapToGrid(
                snapped,
                state.gridSize
            );

        }

        snapped = snapToWallEndpoint(
            snapped,
            state.walls
        );

        snapped = snapToWall(
            snapped,
            state.walls
        );

        if (startPoint) {

            snapped = snap90Degrees(
                startPoint,
                snapped
            );

        }

        currentPoint.current.copy(
            snapped
        );

        guides.current =
            getAlignmentGuides(
                snapped,
                state.corners
            );

        forceUpdate(v => v + 1);

    });

    //----------------------------------------------------
    // Mouse Down
    //----------------------------------------------------

    const handlePointerDown = useCallback(

        (e: PointerEvent) => {

            mouseDown.current = {

                x: e.clientX,
                y: e.clientY

            };

            moved.current = false;

            pointerButton.current = e.button;

            // Only treat this gesture as a viewport interaction if it
            // actually began on the canvas. This is what stops UI
            // clicks (sidebar, toolbar, Confirm Layout, inputs, ...)
            // from being picked up as wall placement clicks, since the
            // pointerup listener below is registered on `window`.
            const target = e.target as Node | null;

            startedOnCanvas.current =

                target !== null &&

                (
                    target === gl.domElement ||
                    gl.domElement.contains(target)
                );

        },

        [gl]

    );

    //----------------------------------------------------
    // Mouse Move
    //----------------------------------------------------

    const handlePointerMove = useCallback(

        (e: PointerEvent) => {

            const dx =
                e.clientX -
                mouseDown.current.x;

            const dy =
                e.clientY -
                mouseDown.current.y;

            if (

                Math.sqrt(
                    dx * dx +
                    dy * dy
                ) > 5

            ) {

                moved.current = true;

            }

        },

        []

    );

    //----------------------------------------------------
    // Mouse Up
    //----------------------------------------------------

    const handlePointerUp = useCallback(() => {

        // Ignore any gesture that didn't start on the canvas -- this is
        // what stops UI clicks from placing wall points or toggling
        // the tool.
        if (!startedOnCanvas.current)
            return;

        if (moved.current)
            return;

        //--------------------------------
        // Right click -> toggle drawing on/off
        //--------------------------------
        // Replaces the old "Start/Stop Drawing" button: right-clicking
        // the viewport starts wall drawing if it's off, and stops it
        // (cancelling any in-progress point) if it's already on.
        if (pointerButton.current === 2) {

            if (state.layoutConfirmed)
                return;

            dispatch({

                type: "SET_ACTIVE_TOOL",

                // NOTE: swap Tool.Select for whatever your actual idle /
                // off-state tool is called if it isn't "Select".
                payload:
                    state.activeTool === Tool.Wall
                        ? Tool.Select
                        : Tool.Wall

            });

            setStartPoint(null);

            // Drop any stale alignment/corner guides from the last
            // active session so nothing lingers on screen once the
            // tool is off.
            guides.current = [];

            return;

        }

        //--------------------------------
        // Left click -> existing placement flow
        //--------------------------------
        if (pointerButton.current !== 0)
            return;

        if (state.activeTool !== Tool.Wall)
            return;

        //--------------------------------
        // First Click
        //--------------------------------

      if (startPoint === null) {

    setStartPoint(
        currentPoint.current.clone()
    );

    return;

}

        //--------------------------------
        // Place Wall
        //--------------------------------

        //--------------------------------

        const result = placeWall(
            state.corners,
            state.walls,
            startPoint,
            currentPoint.current
        );

        dispatch({
            type: "SET_CORNERS",
            payload: result.corners
        });

        dispatch({
            type: "SET_WALLS",
            payload: result.walls
        });

        //--------------------------------
        // Set next start point or finish
        //--------------------------------
        if (result.shouldFinish) {
            setStartPoint(null);
        } else {
            setStartPoint(
                result.endCorner.position.clone()
            );
        }

    }, [
        startPoint,
        state.activeTool,
        state.layoutConfirmed,
        state.corners,
        state.walls,
        dispatch
    ]);

    //----------------------------------------------------
    // Suppress Right-Click Context Menu
    //----------------------------------------------------
    // Right-click now toggles the wall tool, so the browser's native
    // context menu needs to be suppressed whenever the click lands on
    // the canvas -- otherwise every right-click pops up the menu
    // instead of toggling drawing on/off.
    //----------------------------------------------------

    const handleContextMenu = useCallback(

        (e: MouseEvent) => {

            const target = e.target as Node | null;

            const onCanvas =

                target !== null &&

                (
                    target === gl.domElement ||
                    gl.domElement.contains(target)
                );

            if (onCanvas)
                e.preventDefault();

        },

        [gl]

    );

    //----------------------------------------------------
    // Events
    //----------------------------------------------------

    useEffect(() => {

        window.addEventListener(
            "pointerdown",
            handlePointerDown
        );

        window.addEventListener(
            "pointermove",
            handlePointerMove
        );

        window.addEventListener(
            "pointerup",
            handlePointerUp
        );

        window.addEventListener(
            "contextmenu",
            handleContextMenu
        );

        return () => {

            window.removeEventListener(
                "pointerdown",
                handlePointerDown
            );

            window.removeEventListener(
                "pointermove",
                handlePointerMove
            );

            window.removeEventListener(
                "pointerup",
                handlePointerUp
            );

            window.removeEventListener(
                "contextmenu",
                handleContextMenu
            );

        };

    }, [

        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handleContextMenu

    ]);

    //----------------------------------------------------
    // Ghost Preview
    //----------------------------------------------------

    const ghostHalfLength = 0.10;

    const ghostStart = new Vector3(
        currentPoint.current.x - ghostHalfLength,
        0,
        currentPoint.current.z
    );

    const ghostEnd = new Vector3(
        currentPoint.current.x + ghostHalfLength,
        0,
        currentPoint.current.z
    );

    //----------------------------------------------------
    // Render
    //----------------------------------------------------

    return (

        <>

            {state.activeTool === Tool.Wall && (

                <>

                    <AlignmentGuides
                        guides={guides.current}
                    />

                    <CornerHighlight
                        guides={guides.current}
                    />

                    {startPoint ? (

                        <>

                            <PreviewWall
                                start={startPoint}
                                end={currentPoint.current}
                                height={state.wallHeight}
                                thickness={state.wallThickness}
                            />

                            <WallMeasurement
                                start={startPoint}
                                end={currentPoint.current}
                                height={state.wallHeight}
                            />

                        </>

                    ) : (

                        <PreviewWall
                            start={ghostStart}
                            end={ghostEnd}
                            height={state.wallHeight}
                            thickness={state.wallThickness}
                        />

                    )}

                </>

            )}

        </>

    );

}