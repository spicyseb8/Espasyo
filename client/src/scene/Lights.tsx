
import {
    useEffect,
    useMemo,
    useRef
} from "react";
import {
    DirectionalLight,
    Vector3
} from "three";
import useEditor
    from "../context/editor/useEditor";
import {
    solveRegions
} from "../engine/regions/RegionSolver";
import {
    getRegionCenter
} from "../engine/regions/RegionCenter";

export default function Lights() {
    const { state } = useEditor();

    const directionalLightRef =
        useRef<DirectionalLight | null>(null);

    const houseBounds = useMemo(() => {
        const corners = state.corners ?? [];

        if (corners.length === 0) {
            return {
                center: new Vector3(0, 0, 0),
                halfSize: 15
            };
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;

        for (const corner of corners) {
            const x = corner.position.x;
            const z = corner.position.z;

            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
        }

        const center = new Vector3(
            (minX + maxX) * 0.5,
            0,
            (minZ + maxZ) * 0.5
        );

        const width = maxX - minX;
        const depth = maxZ - minZ;
        const largestDimension = Math.max(width, depth);
        const margin = 4;

        const halfSize = Math.max(
            10,
            largestDimension * 0.5 + margin
        );

        return {
            center,
            halfSize
        };
    }, [state.corners]);

    const roomLights = useMemo(() => {
        const regions = solveRegions(
            state.corners,
            state.walls
        ).filter(
            region =>
                region.corners.length >= 3 &&
                Math.abs(region.area) > 0.01
        );

        return regions.map(region => {
            const center = getRegionCenter(region);
            const outer = region.boundaryLoops[0]?.corners ?? [];

            let minX = Infinity;
            let maxX = -Infinity;
            let minZ = Infinity;
            let maxZ = -Infinity;

            for (const point of outer) {
                minX = Math.min(minX, point.x);
                maxX = Math.max(maxX, point.x);
                minZ = Math.min(minZ, point.z);
                maxZ = Math.max(maxZ, point.z);
            }

            const width = Number.isFinite(minX)
                ? maxX - minX
                : 0;

            const depth = Number.isFinite(minZ)
                ? maxZ - minZ
                : 0;

            const largestDimension = Math.max(
                width,
                depth,
                2
            );

            return {
                id: region.id,
                center,
                height: Math.max(
                    state.wallHeight - 0.15,
                    0.05
                ),
                distance: Math.max(
                    6,
                    largestDimension * 1.8
                )
            };
        });
    }, [
        state.corners,
        state.walls,
        state.wallHeight
    ]);

    useEffect(() => {
        const light = directionalLightRef.current;

        if (!light) {
            return;
        }

        light.target.position.set(
            houseBounds.center.x,
            0,
            houseBounds.center.z
        );

        light.target.updateMatrixWorld();
    }, [
        houseBounds.center.x,
        houseBounds.center.z
    ]);

    const shadowSize = houseBounds.halfSize;

    return (
        <>
            <ambientLight intensity={1.0} />

            {roomLights.map(roomLight => (
                <pointLight
                    key={`room-light-${roomLight.id}`}
                    name={`RoomLight-${roomLight.id}`}
                    position={[
                        roomLight.center.x,
                        roomLight.height,
                        roomLight.center.z
                    ]}
                    color="#fff1d6"
                    intensity={8}
                    distance={roomLight.distance}
                    decay={2}
                />
            ))}

            <directionalLight
                ref={directionalLightRef}
                castShadow
                position={[
                    houseBounds.center.x + 8,
                    14,
                    houseBounds.center.z + 8
                ]}
                intensity={2.0}
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-near={0.1}
                shadow-camera-far={60}
                shadow-camera-left={-shadowSize}
                shadow-camera-right={shadowSize}
                shadow-camera-top={shadowSize}
                shadow-camera-bottom={-shadowSize}
                shadow-bias={-0.0001}
                shadow-normalBias={0.02}
            />
        </>
    );
}
