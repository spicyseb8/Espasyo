import { useFrame, useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector3 } from "three";
import { useEffect, useRef, useState, useCallback } from "react";
import { hitWall } from "../../engine/walls/wallHit";
import { splitWall } from "../../engine/walls/wallSplit";
import { findOrCreateCorner } from "../../engine/walls/CornerSolver";
import useEditor from "../../context/editor/useEditor";
import { Tool } from "../../context/editor/tools";
import WallMeasurement from "../Preview/WallMeasurement";
import PreviewWall from "../Preview/PreviewWall";
import { getAlignmentGuides } from "../../engine/walls/Alignment";
import AlignmentGuides from "../Guides/AlignmentGuides";
import CornerHighlight from "../Corners/CornerHighlight";
import {
    snapToGrid,
    snap90Degrees, 
    snapToWallEndpoint, 
    snapToWall
} from "../../engine/walls/wallSnapping";

const raycaster = new Raycaster();
const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

export default function WallDrawer() {
    const { state, dispatch } = useEditor();
    const { camera, pointer } = useThree();
    
    const mouseDown = useRef({ x: 0, y: 0 });
    const moved = useRef(false);
    const [startPoint, setStartPoint] = useState<Vector3 | null>(null);
  
    const [, forceUpdate] = useState(0);
    const currentPoint = useRef(new Vector3());
    const guides = useRef<ReturnType<typeof getAlignmentGuides>>([]);

    useFrame(() => {
        if (state.activeTool !== Tool.Wall) return;
        
        raycaster.setFromCamera(pointer, camera);
        const point = new Vector3();
        raycaster.ray.intersectPlane(groundPlane, point);

        let snapped = point.clone();

        // 1. Grid
        if (state.snapEnabled) {
            snapped = snapToGrid(snapped, state.gridSize);
        }

        // 2. Endpoint
        snapped = snapToWallEndpoint(snapped, state.walls);

        // 3. Wall Body
        snapped = snapToWall(snapped, state.walls);

        // 4. 90°
        if (startPoint) {
            snapped = snap90Degrees(startPoint, snapped);
        }

        currentPoint.current.copy(snapped);
        guides.current = getAlignmentGuides(snapped, state.corners);
        forceUpdate(v => v + 1);
    });

    const handlePointerDown = useCallback((e: PointerEvent) => {
        mouseDown.current = {
            x: e.clientX,
            y: e.clientY
        };
        moved.current = false;
    }, []);

    const handlePointerMove = useCallback((e: PointerEvent) => {
        const dx = e.clientX - mouseDown.current.x;
        const dy = e.clientY - mouseDown.current.y;

        if (Math.sqrt(dx * dx + dy * dy) > 5) {
            moved.current = true;
        }
    }, []);

    const handlePointerUp = useCallback(() => {
        if (moved.current) return;
        if (state.activeTool !== Tool.Wall) return;

        if (startPoint === null) {
            setStartPoint(currentPoint.current.clone());
            return;
        }

        // Batch all operations together
        const operations: any[] = [];
        const workingCorners = [...state.corners];
        
        const hit = hitWall(
            currentPoint.current,
            state.walls
        );

        if (hit) {

            const onStart =
                currentPoint.current.distanceTo(
                    hit.start.position
                ) < 0.001;

            const onEnd =
                currentPoint.current.distanceTo(
                    hit.end.position
                ) < 0.001;

            if (!onStart && !onEnd) {

                const {

                    corner: splitCorner,

                    isNew: splitIsNew

                } = findOrCreateCorner(

                    currentPoint.current,

                    workingCorners

                );

                if (splitIsNew) {

                    workingCorners.push(splitCorner);

                    operations.push({

                        type: "ADD_CORNER",

                        payload: splitCorner

                    });

                }

                const [first, second] = splitWall(

                    hit,

                    splitCorner

                );

                operations.push({

                    type: "REMOVE_WALL",

                    payload: hit.id

                });

                operations.push({

                    type: "ADD_WALL",

                    payload: first
                    
                });

                operations.push({

                    type: "ADD_WALL",

                    payload: second

                });

            }

        }


        // ---------- START CORNER ----------

const {
    corner: startCorner,
    isNew: startIsNew
} = findOrCreateCorner(
    startPoint,
    workingCorners
);

if (startIsNew) {
    workingCorners.push(startCorner);
    console.log("Corner (start)", startCorner.id, startCorner.position);
    operations.push({
        type: "ADD_CORNER",
        payload: startCorner
    });
}


// ---------- END CORNER ----------

const {
    corner: endCorner,
    isNew: endIsNew
} = findOrCreateCorner(
    currentPoint.current,
    workingCorners
);

if (endIsNew) {
    workingCorners.push(endCorner);
console.log("Corner (end)", endCorner.id, endCorner.position);
    operations.push({
        type: "ADD_CORNER",
        payload: endCorner
    });
}


 // ---------- CREATE WALL ----------
    const newWall = {
        id: crypto.randomUUID(),
        start: startCorner,
        end: endCorner,
        height: state.wallHeight,
        thickness: state.wallThickness
    };

    console.log("Wall", newWall.start.position, newWall.end.position);

    operations.push({
        type: "ADD_WALL",
        payload: newWall
    });

    // Dispatch all operations (batched by React)
    for (const operation of operations) {
        dispatch(operation);
    }

    setStartPoint(null);
}, [startPoint, state.activeTool, state.walls, state.corners, state.wallHeight, state.wallThickness, dispatch]);

    useEffect(() => {
        window.addEventListener("pointerdown", handlePointerDown as any);
        window.addEventListener("pointermove", handlePointerMove as any);
        window.addEventListener("pointerup", handlePointerUp as any);

        return () => {
            window.removeEventListener("pointerdown", handlePointerDown as any);
            window.removeEventListener("pointermove", handlePointerMove as any);
            window.removeEventListener("pointerup", handlePointerUp as any);
        };
    }, [handlePointerDown, handlePointerMove, handlePointerUp]);

    return (
        <>
            <AlignmentGuides guides={guides.current} />
            <CornerHighlight guides={guides.current} />
            {startPoint && (
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
            )}
        </>
    );
}