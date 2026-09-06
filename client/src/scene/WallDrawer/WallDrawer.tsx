import {
    useFrame,
    useThree
} from "@react-three/fiber";

import {
    CanvasTexture,
    DoubleSide,
    Plane,
    Raycaster,
    Vector3
} from "three";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import useEditor
    from "../../context/editor/useEditor";

import {
    Tool
} from "../../context/editor/tools";

import type {
    Wall
} from "../../engine/walls/WallTypes";

import {
    BuildTool
} from "../../context/BuildTool";

import PreviewWall
    from "../Preview/PreviewWall";

import WallMeasurement
    from "../Preview/WallMeasurement";

import type {
    MeasurementGroup
} from "../../engine/walls/Measurement";

import AlignmentGuides
    from "../Guides/AlignmentGuides";

import CornerHighlight
    from "../Corners/CornerHighlight";

import {
    snapToGrid,
    snap90Degrees,
    snapToWall,
    snapToWallEndpoint
} from "../../engine/walls/wallSnapping";

import {
    getAlignmentGuides
} from "../../engine/walls/Alignment";

import {
    placeWall
} from "../../engine/walls/PlaceWalls";

import {
    hitWallByRaycast
} from "../../engine/walls/wallHit";

//==================================================
// SHARED RAYCASTER
//==================================================

const raycaster =
    new Raycaster();

//==================================================
// GROUND PLANE
//==================================================

const groundPlane =
    new Plane(
        new Vector3(
            0,
            1,
            0
        ),
        0
    );

//==================================================
// ROOM RECTANGLE
//==================================================

function getRoomRectangle(
    start: Vector3,
    end: Vector3
): Vector3[] {

    const minX =
        Math.min(
            start.x,
            end.x
        );

    const maxX =
        Math.max(
            start.x,
            end.x
        );

    const minZ =
        Math.min(
            start.z,
            end.z
        );

    const maxZ =
        Math.max(
            start.z,
            end.z
        );

    return [

        new Vector3(
            minX,
            0,
            minZ
        ),

        new Vector3(
            maxX,
            0,
            minZ
        ),

        new Vector3(
            maxX,
            0,
            maxZ
        ),

        new Vector3(
            minX,
            0,
            maxZ
        )

    ];
}

//==================================================
// POLYGON BOUNDS
//==================================================

function polygonBounds(
    points: Vector3[]
) {

    const xs =
        points.map(
            point =>
                point.x
        );

    const zs =
        points.map(
            point =>
                point.z
        );

    return {

        minX:
            Math.min(
                ...xs
            ),

        maxX:
            Math.max(
                ...xs
            ),

        minZ:
            Math.min(
                ...zs
            ),

        maxZ:
            Math.max(
                ...zs
            )

    };
}

//==================================================
// WALL ORIENTATION
//==================================================

function isHorizontalWall(
    wall: Wall
) {

    return (

        Math.abs(
            wall.end.position.x -
            wall.start.position.x
        ) > 0.001 &&

        Math.abs(
            wall.end.position.z -
            wall.start.position.z
        ) < 0.001

    );
}

function isVerticalWall(
    wall: Wall
) {

    return (

        Math.abs(
            wall.end.position.z -
            wall.start.position.z
        ) > 0.001 &&

        Math.abs(
            wall.end.position.x -
            wall.start.position.x
        ) < 0.001

    );
}

//==================================================
// SEGMENT / WALL OVERLAP
//==================================================

function segmentOverlapsWall(
    start: Vector3,
    end: Vector3,
    wall: Wall,
    tolerance = 0.05
): boolean {

    const horizontal =
        Math.abs(
            start.z -
            end.z
        ) < tolerance;

    const vertical =
        Math.abs(
            start.x -
            end.x
        ) < tolerance;

    if (
        !horizontal &&
        !vertical
    ) {

        return false;

    }

    const wallHorizontal =
        isHorizontalWall(
            wall
        );

    const wallVertical =
        isVerticalWall(
            wall
        );

    if (
        horizontal &&
        !wallHorizontal
    ) {

        return false;

    }

    if (
        vertical &&
        !wallVertical
    ) {

        return false;

    }

    const edgeX1 =
        Math.min(
            start.x,
            end.x
        );

    const edgeX2 =
        Math.max(
            start.x,
            end.x
        );

    const edgeZ1 =
        Math.min(
            start.z,
            end.z
        );

    const edgeZ2 =
        Math.max(
            start.z,
            end.z
        );

    const wallX1 =
        Math.min(
            wall.start.position.x,
            wall.end.position.x
        );

    const wallX2 =
        Math.max(
            wall.start.position.x,
            wall.end.position.x
        );

    const wallZ1 =
        Math.min(
            wall.start.position.z,
            wall.end.position.z
        );

    const wallZ2 =
        Math.max(
            wall.start.position.z,
            wall.end.position.z
        );

    const sameX =
        Math.abs(
            start.x -
            wall.start.position.x
        ) < tolerance &&
        Math.abs(
            end.x -
            wall.end.position.x
        ) < tolerance;

    const sameZ =
        Math.abs(
            start.z -
            wall.start.position.z
        ) < tolerance &&
        Math.abs(
            end.z -
            wall.end.position.z
        ) < tolerance;

    if (
        horizontal &&
        Math.abs(
            start.z -
            wall.start.position.z
        ) < tolerance
    ) {

        const overlapStart =
            Math.max(
                edgeX1,
                wallX1
            );

        const overlapEnd =
            Math.min(
                edgeX2,
                wallX2
            );

        if (
            overlapEnd -
            overlapStart >
            tolerance ||
            sameX
        ) {

            return true;

        }

    }

    if (
        vertical &&
        Math.abs(
            start.x -
            wall.start.position.x
        ) < tolerance
    ) {

        const overlapStart =
            Math.max(
                edgeZ1,
                wallZ1
            );

        const overlapEnd =
            Math.min(
                edgeZ2,
                wallZ2
            );

        if (
            overlapEnd -
            overlapStart >
            tolerance ||
            sameZ
        ) {

            return true;

        }

    }

    return false;
}

//==================================================
// CLIP ROOM BY EXISTING WALLS
//==================================================

function clipRoomByExistingWalls(
    room: Vector3[],
    walls: Wall[]
): Vector3[][] {

    let rooms:
        Vector3[][] = [
            room
        ];

    for (
        const wall
        of walls
    ) {

        const nextRooms:
            Vector3[][] = [];

        for (
            const currentRoom
            of rooms
        ) {

            const bounds =
                polygonBounds(
                    currentRoom
                );

            const wallX =
                wall.start.position.x;

            const wallZ =
                wall.start.position.z;

            //--------------------------------------------------
            // Vertical wall
            //--------------------------------------------------

            if (
                isVerticalWall(
                    wall
                )
            ) {

                const xInside =
                    wallX >
                        bounds.minX +
                        0.05 &&
                    wallX <
                        bounds.maxX -
                        0.05;

                const zOverlaps =
                    wall.start.position.z >=
                        bounds.minZ -
                        0.05 &&
                    wall.start.position.z <=
                        bounds.maxZ +
                        0.05;

                if (
                    !xInside ||
                    !zOverlaps
                ) {

                    nextRooms.push(
                        currentRoom
                    );

                    continue;

                }

                const leftRoom = [

                    new Vector3(
                        bounds.minX,
                        0,
                        bounds.minZ
                    ),

                    new Vector3(
                        wallX,
                        0,
                        bounds.minZ
                    ),

                    new Vector3(
                        wallX,
                        0,
                        bounds.maxZ
                    ),

                    new Vector3(
                        bounds.minX,
                        0,
                        bounds.maxZ
                    )

                ];

                const rightRoom = [

                    new Vector3(
                        wallX,
                        0,
                        bounds.minZ
                    ),

                    new Vector3(
                        bounds.maxX,
                        0,
                        bounds.minZ
                    ),

                    new Vector3(
                        bounds.maxX,
                        0,
                        bounds.maxZ
                    ),

                    new Vector3(
                        wallX,
                        0,
                        bounds.maxZ
                    )

                ];

                nextRooms.push(
                    leftRoom,
                    rightRoom
                );

            }

            //--------------------------------------------------
            // Horizontal wall
            //--------------------------------------------------

            else if (
                isHorizontalWall(
                    wall
                )
            ) {

                const zInside =
                    wallZ >
                        bounds.minZ +
                        0.05 &&
                    wallZ <
                        bounds.maxZ -
                        0.05;

                const xOverlaps =
                    wall.start.position.x >=
                        bounds.minX -
                        0.05 &&
                    wall.start.position.x <=
                        bounds.maxX +
                        0.05;

                if (
                    !zInside ||
                    !xOverlaps
                ) {

                    nextRooms.push(
                        currentRoom
                    );

                    continue;

                }

                const topRoom = [

                    new Vector3(
                        bounds.minX,
                        0,
                        bounds.minZ
                    ),

                    new Vector3(
                        bounds.maxX,
                        0,
                        bounds.minZ
                    ),

                    new Vector3(
                        bounds.maxX,
                        0,
                        wallZ
                    ),

                    new Vector3(
                        bounds.minX,
                        0,
                        wallZ
                    )

                ];

                const bottomRoom = [

                    new Vector3(
                        bounds.minX,
                        0,
                        wallZ
                    ),

                    new Vector3(
                        bounds.maxX,
                        0,
                        wallZ
                    ),

                    new Vector3(
                        bounds.maxX,
                        0,
                        bounds.maxZ
                    ),

                    new Vector3(
                        bounds.minX,
                        0,
                        bounds.maxZ
                    )

                ];

                nextRooms.push(
                    topRoom,
                    bottomRoom
                );

            }

            //--------------------------------------------------
            // Other wall shape
            //--------------------------------------------------

            else {

                nextRooms.push(
                    currentRoom
                );

            }

        }

        rooms =
            nextRooms.length > 0
                ? nextRooms
                : rooms;

    }

    return rooms;
}

//==================================================
// ROOM DIMENSIONS
//==================================================

function getRoomDimensions(
    start: Vector3,
    end: Vector3
) {

    const width =
        Math.abs(
            end.x -
            start.x
        );

    const height =
        Math.abs(
            end.z -
            start.z
        );

    return {

        width,

        height,

        area:
            width *
            height

    };
}

//==================================================
// LIVE WALL MEASUREMENT
//==================================================

function buildLiveMeasurement(
    start: Vector3,
    end: Vector3,
    height: number,
    thickness: number
): MeasurementGroup {

    const length =
        start.distanceTo(
            end
        );

    const direction =
        length >
        0.0001

            ? end
                .clone()
                .sub(start)
                .normalize()

            : new Vector3(
                1,
                0,
                0
            );

    const normal =
        new Vector3(
            -direction.z,
            0,
            direction.x
        );

    const center =
        start
            .clone()
            .add(end)
            .multiplyScalar(
                0.5
            );

    return {

        id:
            "preview",

        start:
            start.clone(),

        end:
            end.clone(),

        length,

        area:
            length *
            height,

        center,

        direction,

        normal,

        height,

        thickness,

        walls:
            []

    };
}

//==================================================
// LABEL TEXTURE
//==================================================

function useLabelTexture(
    text: string
) {

    const texture =
        useMemo(() => {

            if (!text) {
                return null;
            }

            const canvas =
                document.createElement(
                    "canvas"
                );

            const size =
                1024;

            canvas.width =
                size;

            canvas.height =
                512;

            const ctx =
                canvas.getContext(
                    "2d"
                );

            if (!ctx) {
                return null;
            }

            ctx.clearRect(
                0,
                0,
                size,
                512
            );

            ctx.textAlign =
                "center";

            ctx.textBaseline =
                "middle";

            ctx.font =
                "800 220px Arial";

            ctx.lineJoin =
                "round";

            ctx.lineWidth =
                20;

            ctx.strokeStyle =
                "rgba(0, 0, 0, 0.45)";

            ctx.strokeText(
                text,
                size / 2,
                256
            );

            ctx.fillStyle =
                "rgba(255, 255, 255, 0.96)";

            ctx.fillText(
                text,
                size / 2,
                256
            );

            const newTexture =
                new CanvasTexture(
                    canvas
                );

            newTexture.needsUpdate =
                true;

            return newTexture;

        }, [
            text
        ]);

    useEffect(() => {

        return () => {

            texture?.dispose();

        };

    }, [
        texture
    ]);

    return texture;
}

//==================================================
// ROOM LABEL
//==================================================

interface RoomLabelProps {

    texture:
        CanvasTexture | null;

    position:
        [number, number, number];

    width:
        number;

    height:
        number;
}

function RoomLabel({
    texture,
    position,
    width,
    height
}: RoomLabelProps) {

    if (!texture) {
        return null;
    }

    return (

        <mesh
            position={
                position
            }
            rotation={[
                -Math.PI / 2,
                0,
                0
            ]}
        >

            <planeGeometry
                args={[
                    width,
                    height
                ]}
            />

            <meshBasicMaterial
                map={
                    texture
                }
                transparent
                depthWrite={
                    false
                }
                alphaTest={
                    0.05
                }
                side={
                    DoubleSide
                }
            />

        </mesh>
    );
}

//==================================================
// MAIN WALL DRAWER
//==================================================

export default function WallDrawer() {

    const {
        state,
        dispatch
    } = useEditor();

    const {
        camera,
        pointer,
        gl,
        scene
    } = useThree();

    //--------------------------------------------------
    // Mouse
    //--------------------------------------------------

    const mouseDown =
        useRef({

            x: 0,

            y: 0

        });

    const moved =
        useRef(false);

    const pointerButton =
        useRef(0);

    const startedOnCanvas =
        useRef(false);

    const isClick =
        useRef(false);

    //--------------------------------------------------
    // Wall drawing state
    //--------------------------------------------------

    const [
        startPoint,
        setStartPoint
    ] =
        useState<Vector3 | null>(
            null
        );

    const [
        roomStartPoint,
        setRoomStartPoint
    ] =
        useState<Vector3 | null>(
            null
        );

    const currentPoint =
        useRef(
            new Vector3()
        );

    const guides =
        useRef<
            ReturnType<
                typeof getAlignmentGuides
            >
        >([]);

    const [
        ,
        forceUpdate
    ] =
        useState(0);

    const isDrawing =
        useRef(false);

    //--------------------------------------------------
    // Draft wall length
    //--------------------------------------------------

    const lastDraftLength =
        useRef<number | null>(
            null
        );

    //--------------------------------------------------
    // BLUEPRINT MODE
    //
    // Selected + unlocked = calibration mode.
    // During calibration, this component must not
    // draw walls or rooms.
    //--------------------------------------------------

    const blueprintCalibrationMode =
        state.blueprint?.selected === true &&
        state.blueprint?.locked === false;

    //--------------------------------------------------
    // Blueprint selected + locked
    //
    // This is tracing mode.
    //--------------------------------------------------



    //--------------------------------------------------
    // Clear live drawing state whenever blueprint
    // enters calibration mode.
    //--------------------------------------------------

    useEffect(() => {

        if (
            blueprintCalibrationMode
        ) {

            setStartPoint(
                null
            );

            setRoomStartPoint(
                null
            );

            currentPoint.current.set(
                0,
                0,
                0
            );

            guides.current =
                [];

            isDrawing.current =
                false;

            moved.current =
                false;

            isClick.current =
                false;

            if (
                lastDraftLength.current !==
                null
            ) {

                lastDraftLength.current =
                    null;

                dispatch({

                    type:
                        "SET_DRAFT_WALL_LENGTH",

                    payload:
                        null

                });

            }

        }

    }, [
        blueprintCalibrationMode,
        dispatch
    ]);

    //--------------------------------------------------
    // Measurement cleanup
    //--------------------------------------------------

    useEffect(() => {

        if (
            state.activeTool !==
                Tool.Wall &&
            lastDraftLength.current !==
                null
        ) {

            lastDraftLength.current =
                null;

            dispatch({

                type:
                    "SET_DRAFT_WALL_LENGTH",

                payload:
                    null

            });

        }

        return () => {

            if (
                lastDraftLength.current !==
                null
            ) {

                lastDraftLength.current =
                    null;

                dispatch({

                    type:
                        "SET_DRAFT_WALL_LENGTH",

                    payload:
                        null

                });

            }

        };

    }, [
        state.activeTool,
        dispatch
    ]);

    //==================================================
    // MOUSE POSITION
    //==================================================

    useFrame(() => {

        //--------------------------------------------------
        // During blueprint calibration, the wall tool
        // must completely stop calculating points.
        //--------------------------------------------------

        if (
            blueprintCalibrationMode
        ) {

            return;

        }

        //--------------------------------------------------
        // Only Wall / Room tools
        //--------------------------------------------------

        if (
            state.activeTool !==
                Tool.Wall &&
            state.activeTool !==
                Tool.Room
        ) {

            return;

        }

        //--------------------------------------------------
        // Raycast
        //--------------------------------------------------

        raycaster.setFromCamera(
            pointer,
            camera
        );

        const wallHit =
            hitWallByRaycast(

                raycaster,

                scene.children,

                state.walls

            );

        let point:
            Vector3;

        //--------------------------------------------------
        // Wall hit
        //--------------------------------------------------

        if (
            wallHit
        ) {

            point =
                wallHit.point;

        }

        //--------------------------------------------------
        // Ground hit
        //--------------------------------------------------

        else {

            point =
                new Vector3();

            raycaster.ray.intersectPlane(
                groundPlane,
                point
            );

        }

        //--------------------------------------------------
        // Grid snapping
        //--------------------------------------------------

        let snapped =
            point.clone();

        if (
            state.snapEnabled
        ) {

            snapped =
                snapToGrid(
                    snapped,
                    state.gridSize
                );

        }

        //--------------------------------------------------
        // Wall snapping
        //--------------------------------------------------

        snapped =
            snapToWallEndpoint(
                snapped,
                state.walls
            );

        snapped =
            snapToWall(
                snapped,
                state.walls
            );

        //--------------------------------------------------
        // 90 degree wall constraint
        //--------------------------------------------------

        if (
            state.activeTool ===
                Tool.Wall &&
            startPoint
        ) {

            snapped =
                snap90Degrees(
                    startPoint,
                    snapped
                );

        }

        //--------------------------------------------------
        // Store current point
        //--------------------------------------------------

        currentPoint.current.copy(
            snapped
        );

        //--------------------------------------------------
        // Alignment guides
        //--------------------------------------------------

        if (
            state.activeTool ===
            Tool.Wall
        ) {

            guides.current =
                getAlignmentGuides(
                    snapped,
                    state.corners
                );

        } else {

            guides.current =
                [];

        }

        //--------------------------------------------------
        // Live wall measurement
        //--------------------------------------------------

        if (
            state.activeTool ===
                Tool.Wall &&
            startPoint
        ) {

            const draftLength =
                Math.round(

                    startPoint
                        .distanceTo(
                            currentPoint.current
                        ) *
                    100

                ) / 100;

            if (
                lastDraftLength.current !==
                draftLength
            ) {

                lastDraftLength.current =
                    draftLength;

                dispatch({

                    type:
                        "SET_DRAFT_WALL_LENGTH",

                    payload:
                        draftLength

                });

            }

        } else if (
            lastDraftLength.current !==
            null
        ) {

            lastDraftLength.current =
                null;

            dispatch({

                type:
                    "SET_DRAFT_WALL_LENGTH",

                payload:
                    null

            });

        }

        //--------------------------------------------------
        // Trigger render
        //--------------------------------------------------

        forceUpdate(
            value =>
                value + 1
        );

    });

    //==================================================
    // POINTER DOWN
    //==================================================

    const handlePointerDown =
        useCallback(
            (
                e: PointerEvent
            ) => {

                //--------------------------------------------------
                // Blueprint calibration mode owns the pointer.
                //
                // User can only manipulate the blueprint.
                //--------------------------------------------------

                if (
                    blueprintCalibrationMode
                ) {

                    return;

                }

                //--------------------------------------------------
                // Existing wall-based build tools
                //--------------------------------------------------

                if (

                    state.buildTool ===
                        BuildTool.Door ||

                    state.buildTool ===
                        BuildTool.Window ||

                    state.buildTool ===
                        BuildTool.Opening

                ) {

                    return;

                }

                //--------------------------------------------------
                // Store mouse position
                //--------------------------------------------------

                mouseDown.current = {

                    x:
                        e.clientX,

                    y:
                        e.clientY

                };

                moved.current =
                    false;

                pointerButton.current =
                    e.button;

                isClick.current =
                    true;

                //--------------------------------------------------
                // Canvas check
                //--------------------------------------------------

                const target =
                    e.target as Node | null;

                startedOnCanvas.current =
                    target !== null &&
                    (
                        target ===
                        gl.domElement ||

                        gl.domElement.contains(
                            target
                        )
                    );

                if (
                    !startedOnCanvas.current
                ) {

                    return;

                }

                //--------------------------------------------------
                // Left / right click
                //--------------------------------------------------

                if (
                    e.button === 0 ||
                    e.button === 2
                ) {

                    isDrawing.current =
                        true;

                }

            },
            [
                gl,
                state.buildTool,
                blueprintCalibrationMode
            ]
        );

    //==================================================
    // POINTER MOVE
    //==================================================

    const handlePointerMove =
        useCallback(
            (
                e: PointerEvent
            ) => {

                //--------------------------------------------------
                // Blueprint calibration mode
                //--------------------------------------------------

                if (
                    blueprintCalibrationMode
                ) {

                    return;

                }

                const dx =
                    e.clientX -
                    mouseDown.current.x;

                const dy =
                    e.clientY -
                    mouseDown.current.y;

                //--------------------------------------------------
                // Detect drag
                //--------------------------------------------------

                if (
                    Math.sqrt(
                        dx * dx +
                        dy * dy
                    ) > 5
                ) {

                    moved.current =
                        true;

                    isClick.current =
                        false;

                    isDrawing.current =
                        false;

                }

            },
            [
                blueprintCalibrationMode
            ]
        );

    //==================================================
    // POINTER UP
    //==================================================

    const handlePointerUp =
        useCallback(
            () => {

                //--------------------------------------------------
                // Blueprint calibration mode
                //--------------------------------------------------

                if (
                    blueprintCalibrationMode
                ) {

                    isDrawing.current =
                        false;

                    return;

                }

                //--------------------------------------------------
                // Must begin on canvas
                //--------------------------------------------------

                if (
                    !startedOnCanvas.current
                ) {

                    isDrawing.current =
                        false;

                    return;

                }

                //--------------------------------------------------
                // Ignore drag
                //--------------------------------------------------

                if (
                    moved.current ||
                    !isClick.current
                ) {

                    isDrawing.current =
                        false;

                    return;

                }

                //--------------------------------------------------
                // Right click
                //--------------------------------------------------

                if (
                    pointerButton.current ===
                    2
                ) {

                    if (
                        state.layoutConfirmed
                    ) {

                        isDrawing.current =
                            false;

                        return;

                    }

                    //--------------------------------------------------
                    // Room cancel
                    //--------------------------------------------------

                    if (
                        state.activeTool ===
                        Tool.Room
                    ) {

                        setRoomStartPoint(
                            null
                        );

                        dispatch({

                            type:
                                "SET_ACTIVE_TOOL",

                            payload:
                                Tool.Select

                        });

                        guides.current =
                            [];

                        isDrawing.current =
                            false;

                        return;

                    }

                    //--------------------------------------------------
                    // Toggle Wall / Select
                    //--------------------------------------------------

                    dispatch({

                        type:
                            "SET_ACTIVE_TOOL",

                        payload:
                            state.activeTool ===
                            Tool.Wall

                                ? Tool.Select

                                : Tool.Wall

                    });

                    setStartPoint(
                        null
                    );

                    guides.current =
                        [];

                    isDrawing.current =
                        false;

                    return;

                }

                //--------------------------------------------------
                // Left click only from here
                //--------------------------------------------------

                if (
                    pointerButton.current !==
                    0
                ) {

                    isDrawing.current =
                        false;

                    return;

                }

                //==================================================
                // ROOM TOOL
                //==================================================

                if (
                    state.activeTool ===
                    Tool.Room
                ) {

                    //--------------------------------------------------
                    // First click
                    //--------------------------------------------------

                    if (
                        roomStartPoint ===
                        null
                    ) {

                        setRoomStartPoint(

                            currentPoint.current.clone()

                        );

                        isDrawing.current =
                            false;

                        return;

                    }

                    //--------------------------------------------------
                    // Create room rectangle
                    //--------------------------------------------------

                    const rect =
                        getRoomRectangle(

                            roomStartPoint,

                            currentPoint.current

                        );

                    if (
                        rect.length !==
                        4
                    ) {

                        setRoomStartPoint(
                            null
                        );

                        isDrawing.current =
                            false;

                        return;

                    }

                    //--------------------------------------------------
                    // Existing geometry
                    //--------------------------------------------------

                    let corners =
                        [
                            ...state.corners
                        ];

                    let walls =
                        [
                            ...state.walls
                        ];

                    //--------------------------------------------------
                    // Clip against existing walls
                    //--------------------------------------------------

                    const roomPolygons =
                        clipRoomByExistingWalls(
                            rect,
                            walls
                        );

                    //--------------------------------------------------
                    // Create new walls
                    //--------------------------------------------------

                    for (
                        const polygon
                        of roomPolygons
                    ) {

                        for (
                            let index = 0;
                            index <
                                polygon.length;
                            index++
                        ) {

                            const nextIndex =
                                (
                                    index +
                                    1
                                ) %
                                polygon.length;

                            const start =
                                polygon[index];

                            const end =
                                polygon[
                                    nextIndex
                                ];

                            //--------------------------------------------------
                            // Don't duplicate existing wall
                            //--------------------------------------------------

                            const overlapsExistingWall =
                                walls.some(
                                    wall =>
                                        segmentOverlapsWall(
                                            start,
                                            end,
                                            wall
                                        )
                                );

                            if (
                                overlapsExistingWall
                            ) {

                                continue;

                            }

                            const result =
                                placeWall(

                                    corners,

                                    walls,

                                    start,

                                    end

                                );

                            corners =
                                result.corners;

                            walls =
                                result.walls;

                        }

                    }

                    //--------------------------------------------------
                    // Update state
                    //--------------------------------------------------

                    dispatch({

                        type:
                            "SET_CORNERS",

                        payload:
                            corners

                    });

                    dispatch({

                        type:
                            "SET_WALLS",

                        payload:
                            walls

                    });

                    setRoomStartPoint(
                        null
                    );

                    isDrawing.current =
                        false;

                    return;

                }

                //==================================================
                // WALL TOOL
                //==================================================

                if (
                    state.activeTool !==
                    Tool.Wall
                ) {

                    isDrawing.current =
                        false;

                    return;

                }

                //--------------------------------------------------
                // First wall click
                //--------------------------------------------------

                if (
                    startPoint ===
                    null
                ) {

                    setStartPoint(

                        currentPoint.current.clone()

                    );

                    isDrawing.current =
                        false;

                    return;

                }

                //--------------------------------------------------
                // Create wall
                //--------------------------------------------------

                const result =
                    placeWall(

                        state.corners,

                        state.walls,

                        startPoint,

                        currentPoint.current

                    );

                //--------------------------------------------------
                // Update corners
                //--------------------------------------------------

                dispatch({

                    type:
                        "SET_CORNERS",

                    payload:
                        result.corners

                });

                //--------------------------------------------------
                // Update walls
                //--------------------------------------------------

                dispatch({

                    type:
                        "SET_WALLS",

                    payload:
                        result.walls

                });

                //--------------------------------------------------
                // Continue or finish
                //--------------------------------------------------

                if (
                    result.shouldFinish
                ) {

                    setStartPoint(
                        null
                    );

                } else {

                    setStartPoint(

                        result.endCorner.position.clone()

                    );

                }

                isDrawing.current =
                    false;

            },
            [
                startPoint,
                state.activeTool,
                state.layoutConfirmed,
                state.corners,
                state.walls,
                state.buildTool,
                roomStartPoint,
                dispatch,
                blueprintCalibrationMode
            ]
        );

    //==================================================
    // CONTEXT MENU
    //==================================================

    const handleContextMenu =
        useCallback(
            (
                e: MouseEvent
            ) => {

                const target =
                    e.target as Node | null;

                const onCanvas =
                    target !== null &&
                    (
                        target ===
                        gl.domElement ||

                        gl.domElement.contains(
                            target
                        )
                    );

                if (
                    onCanvas
                ) {

                    e.preventDefault();

                }

            },
            [gl]
        );

    //==================================================
    // EVENT LISTENERS
    //==================================================

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

    //==================================================
    // LIVE PREVIEW DATA
    //==================================================

    const ghostHalfLength =
        0.10;

    const ghostStart =
        new Vector3(

            currentPoint.current.x -
                ghostHalfLength,

            0,

            currentPoint.current.z

        );

    const ghostEnd =
        new Vector3(

            currentPoint.current.x +
                ghostHalfLength,

            0,

            currentPoint.current.z

        );

    const roomRect =
        roomStartPoint
            ? getRoomRectangle(
                roomStartPoint,
                currentPoint.current
            )
            : null;

    const roomDimensions =
        roomStartPoint
            ? getRoomDimensions(
                roomStartPoint,
                currentPoint.current
            )
            : null;

    //--------------------------------------------------
    // Room labels
    //--------------------------------------------------

    const widthLabelText =
        roomDimensions
            ? `${roomDimensions.width.toFixed(2)} m`
            : "";

    const heightLabelText =
        roomDimensions
            ? `${roomDimensions.height.toFixed(2)} m`
            : "";

    const areaLabelText =
        roomDimensions
            ? `${roomDimensions.area.toFixed(2)} m²`
            : "";

    const widthTexture =
        useLabelTexture(
            widthLabelText
        );

    const heightTexture =
        useLabelTexture(
            heightLabelText
        );

    const areaTexture =
        useLabelTexture(
            areaLabelText
        );

    //==================================================
    // RENDER
    //==================================================

    return (

        <>

            {/* ==================================================
                WALL TOOL
               ================================================== */}

            {
                state.activeTool ===
                    Tool.Wall &&
                !blueprintCalibrationMode &&
                (
                    <>

                        <AlignmentGuides
                            guides={
                                guides.current
                            }
                        />

                        <CornerHighlight
                            guides={
                                guides.current
                            }
                        />

                        {
                            startPoint
                                ? (

                                    <>

                                        <PreviewWall

                                            start={
                                                startPoint
                                            }

                                            end={
                                                currentPoint.current
                                            }

                                            height={
                                                state.wallHeight
                                            }

                                            thickness={
                                                state.wallThickness
                                            }

                                        />

                                        <WallMeasurement

                                            measurement={
                                                buildLiveMeasurement(

                                                    startPoint,

                                                    currentPoint.current,

                                                    state.wallHeight,

                                                    state.wallThickness

                                                )
                                            }

                                        />

                                    </>

                                )
                                : (

                                    <PreviewWall

                                        start={
                                            ghostStart
                                        }

                                        end={
                                            ghostEnd
                                        }

                                        height={
                                            state.wallHeight
                                        }

                                        thickness={
                                            state.wallThickness
                                        }

                                    />

                                )
                        }

                    </>
                )
            }


            {/* ==================================================
                ROOM TOOL
               ================================================== */}

            {
                state.activeTool ===
                    Tool.Room &&
                !blueprintCalibrationMode &&
                roomStartPoint &&
                roomRect &&
                roomDimensions &&
                (

                    <>

                        {
                            roomRect.map(
                                (
                                    point,
                                    index
                                ) => {

                                    const next =
                                        roomRect[
                                            (
                                                index +
                                                1
                                            ) %
                                            roomRect.length
                                        ];

                                    return (

                                        <PreviewWall

                                            key={
                                                `room-wall-${index}`
                                            }

                                            start={
                                                point
                                            }

                                            end={
                                                next
                                            }

                                            height={
                                                state.wallHeight
                                            }

                                            thickness={
                                                state.wallThickness
                                            }

                                        />

                                    );

                                }
                            )
                        }


                        {/* ----------------------------------
                            Room preview floor
                           ---------------------------------- */}

                        <mesh

                            position={[

                                (
                                    roomRect[0].x +
                                    roomRect[2].x
                                ) /
                                2,

                                0.02,

                                (
                                    roomRect[0].z +
                                    roomRect[2].z
                                ) /
                                2

                            ]}

                            rotation={[
                                -Math.PI / 2,
                                0,
                                0
                            ]}

                        >

                            <planeGeometry

                                args={[

                                    Math.max(
                                        roomDimensions.width,
                                        0.1
                                    ),

                                    Math.max(
                                        roomDimensions.height,
                                        0.1
                                    )

                                ]}

                            />

                            <meshStandardMaterial

                                color="#7ec8ff"

                                transparent

                                opacity={
                                    0.42
                                }

                                side={
                                    DoubleSide
                                }

                            />

                        </mesh>


                        {/* ----------------------------------
                            Width
                           ---------------------------------- */}

                        <RoomLabel

                            texture={
                                widthTexture
                            }

                            position={[

                                (
                                    roomRect[0].x +
                                    roomRect[2].x
                                ) /
                                2,

                                0.03,

                                roomRect[0].z +
                                (
                                    roomRect[2].z -
                                    roomRect[0].z
                                ) *
                                0.18

                            ]}

                            width={
                                Math.max(
                                    roomDimensions.width *
                                    0.55,
                                    0.6
                                )
                            }

                            height={
                                Math.max(
                                    roomDimensions.width *
                                    0.55,
                                    0.6
                                ) *
                                0.5
                            }

                        />


                        {/* ----------------------------------
                            Height
                           ---------------------------------- */}

                        <RoomLabel

                            texture={
                                heightTexture
                            }

                            position={[

                                roomRect[0].x +
                                (
                                    roomRect[2].x -
                                    roomRect[0].x
                                ) *
                                0.82,

                                0.03,

                                (
                                    roomRect[0].z +
                                    roomRect[2].z
                                ) /
                                2

                            ]}

                            width={
                                Math.max(
                                    roomDimensions.height *
                                    0.55,
                                    0.6
                                )
                            }

                            height={
                                Math.max(
                                    roomDimensions.height *
                                    0.55,
                                    0.6
                                ) *
                                0.5
                            }

                        />


                        {/* ----------------------------------
                            Area
                           ---------------------------------- */}

                        <RoomLabel

                            texture={
                                areaTexture
                            }

                            position={[

                                (
                                    roomRect[0].x +
                                    roomRect[2].x
                                ) /
                                2,

                                0.035,

                                (
                                    roomRect[0].z +
                                    roomRect[2].z
                                ) /
                                2

                            ]}

                            width={
                                Math.max(
                                    roomDimensions.width *
                                    0.6,
                                    0.9
                                )
                            }

                            height={
                                Math.max(
                                    roomDimensions.width *
                                    0.6,
                                    0.9
                                ) *
                                0.4
                            }

                        />

                    </>

                )
            }

        </>
    );
}