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
    snapToWallEndpoint,
    snapToCorner
} from "../../engine/walls/wallSnapping";

import { getAlignmentGuides } from "../../engine/walls/Alignment";
import { placeWall } from "../../engine/walls/PlaceWalls";

const raycaster = new Raycaster();
const groundPlane = new Plane(
    new Vector3(0, 1, 0),
    0
);

export default function WallDrawer() {

    const { state, dispatch } = useEditor();

    const { camera, pointer } = useThree();

    const mouseDown = useRef({
        x: 0,
        y: 0
    });

    const moved = useRef(false);

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

    useFrame(() => {

        if (state.activeTool !== Tool.Wall)
            return;

        raycaster.setFromCamera(
            pointer,
            camera
        );

        const point = new Vector3();

        raycaster.ray.intersectPlane(
            groundPlane,
            point
        );

        let snapped = point.clone();

        if (state.snapEnabled) {

        snapped = snapToGrid(

            snapped,

            state.gridSize

        );

    }

    // 2 Existing corner

    snapped = snapToCorner(

        snapped,

        state.corners

    );

    // 3 Existing endpoint

    snapped = snapToWallEndpoint(

        snapped,

        state.walls

    );

    // 4 Wall body

    snapped = snapToWall(

        snapped,

        state.walls

    );

    // 5 90°

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

        },

        []

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

        if (moved.current)
            return;

        if (state.activeTool !== Tool.Wall)
            return;

        //--------------------------------
        // First Click
        //--------------------------------

        if (!startPoint) {

            setStartPoint(
                currentPoint.current.clone()
            );

            return;

        }

        //--------------------------------
        // Create Wall
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

        setStartPoint(null);

    },

    [

        startPoint,

        state.activeTool,

        state.corners,

        state.walls,

        dispatch

    ]);

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

        };

    },

    [

        handlePointerDown,

        handlePointerMove,

        handlePointerUp

    ]);
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
        <AlignmentGuides
            guides={guides.current}
        />

        <CornerHighlight
            guides={guides.current}
        />

        {state.activeTool === Tool.Wall && (
            startPoint ? (
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
            )
        )}
    </>
);

}