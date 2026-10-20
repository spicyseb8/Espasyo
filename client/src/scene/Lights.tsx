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

//==================================================
// LIGHTING SETTINGS
//==================================================

const AMBIENT_INTENSITY = 0.4;

const ROOM_LIGHT_INTENSITY = 1.5;
const ROOM_LIGHT_DISTANCE_MULTIPLIER = 1.4;

const DIRECTIONAL_INTENSITY = 2.0;

//==================================================
// SHADOW SETTINGS
//==================================================

// Light direction (target -> light). Same diagonal
// direction as the original (8, 14, 8) setup.
const LIGHT_DIRECTION = new Vector3(8, 14, 8).normalize();

// Extra vertical space above the walls (roof edges, etc.).
const SHADOW_HEIGHT_HEADROOM = 1;

// Padding around the fitted frustum.
const SHADOW_MARGIN_BASE = 0.3;
const SHADOW_MARGIN_RATIO = 0.01;

// Desired world-space size of one shadow texel (meters).
const TARGET_TEXEL_SIZE = 0.015;
const SHADOW_MAP_TIERS = [1024, 2048, 4096];

// Fallback footprint used only when there are no corners yet.
const EMPTY_HALF_EXTENT = 2;

//==================================================
// SHADOW FIT
//==================================================

interface ShadowFit {
    target: Vector3;
    lightPosition: Vector3;
    left: number;
    right: number;
    top: number;
    bottom: number;
    near: number;
    far: number;
    mapSize: number;
    normalBias: number;
}

const _right = new Vector3();
const _up = new Vector3();

function fitShadow(
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    height: number
): ShadowFit {
    const minY = 0;
    const maxY = height + SHADOW_HEIGHT_HEADROOM;

    const target = new Vector3(
        (minX + maxX) * 0.5,
        (minY + maxY) * 0.5,
        (minZ + maxZ) * 0.5
    );

    // Light camera basis (camera looks along -dir).
    _right
        .crossVectors(
            new Vector3(0, 1, 0),
            LIGHT_DIRECTION
        )
        .normalize();

    _up
        .crossVectors(
            LIGHT_DIRECTION,
            _right
        )
        .normalize();

    let minLx = Infinity;
    let maxLx = -Infinity;
    let minLy = Infinity;
    let maxLy = -Infinity;
    let minLz = Infinity;
    let maxLz = -Infinity;

    const p = new Vector3();

    // Project all 8 corners of the building box into
    // light space for a tight, rotation-aware fit.
    for (const x of [minX, maxX]) {
        for (const y of [minY, maxY]) {
            for (const z of [minZ, maxZ]) {
                p.set(x, y, z).sub(target);

                const lx = p.dot(_right);
                const ly = p.dot(_up);
                const lz = p.dot(LIGHT_DIRECTION);

                minLx = Math.min(minLx, lx);
                maxLx = Math.max(maxLx, lx);
                minLy = Math.min(minLy, ly);
                maxLy = Math.max(maxLy, ly);
                minLz = Math.min(minLz, lz);
                maxLz = Math.max(maxLz, lz);
            }
        }
    }

    const extent = Math.max(
        maxLx - minLx,
        maxLy - minLy
    );

    const margin =
        SHADOW_MARGIN_BASE +
        extent * SHADOW_MARGIN_RATIO;

    const left = minLx - margin;
    const right = maxLx + margin;
    const bottom = minLy - margin;
    const top = maxLy + margin;

    // Place the light just beyond the geometry
    // closest to it, then size near/far to the
    // actual depth range.
    const padding = margin + 0.5;
    const distance = maxLz + padding;

    const lightPosition = target
        .clone()
        .addScaledVector(
            LIGHT_DIRECTION,
            distance
        );

    const near = 0.1;
    const far = distance - minLz + padding;

    const largestSpan = Math.max(
        right - left,
        top - bottom
    );

    const neededSize =
        largestSpan / TARGET_TEXEL_SIZE;

    const mapSize =
        SHADOW_MAP_TIERS.find(
            size => size >= neededSize
        ) ??
        SHADOW_MAP_TIERS[
            SHADOW_MAP_TIERS.length - 1
        ];

    // Scale normal bias with texel size so small rooms
    // don't detach and large ones don't show acne.
    const texel = largestSpan / mapSize;

    const normalBias = Math.min(
        0.04,
        Math.max(0.001, texel * 2)
    );

    return {
        target,
        lightPosition,
        left,
        right,
        top,
        bottom,
        near,
        far,
        mapSize,
        normalBias
    };
}

export default function Lights() {
    const {
        state
    } = useEditor();

    const directionalLightRef =
        useRef<DirectionalLight | null>(null);

    //==================================================
    // FIT SHADOW CAMERA TO ACTUAL GEOMETRY
    //==================================================

    const shadowFit = useMemo<ShadowFit>(() => {
        const corners = state.corners ?? [];

        let minX = -EMPTY_HALF_EXTENT;
        let maxX = EMPTY_HALF_EXTENT;
        let minZ = -EMPTY_HALF_EXTENT;
        let maxZ = EMPTY_HALF_EXTENT;

        if (corners.length > 0) {
            minX = Infinity;
            maxX = -Infinity;
            minZ = Infinity;
            maxZ = -Infinity;

            for (const corner of corners) {
                const x = corner.position.x;
                const z = corner.position.z;

                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);

                minZ = Math.min(minZ, z);
                maxZ = Math.max(maxZ, z);
            }
        }

        return fitShadow(
            minX,
            maxX,
            minZ,
            maxZ,
            state.wallHeight
        );
    }, [
        state.corners,
        state.wallHeight
    ]);

    //==================================================
    // CALCULATE ROOM LIGHTS
    //==================================================

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
            const center =
                getRegionCenter(region);

            const outer =
                region.boundaryLoops[0]?.corners ?? [];

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

            const distance = Math.max(
                6,
                largestDimension *
                    ROOM_LIGHT_DISTANCE_MULTIPLIER
            );

            return {
                id: region.id,
                center,
                height: Math.max(
                    state.wallHeight - 0.15,
                    0.05
                ),
                distance
            };
        });
    }, [
        state.corners,
        state.walls,
        state.wallHeight
    ]);

    //==================================================
    // APPLY SHADOW CAMERA (IMPERATIVELY)
    //==================================================

    // Done imperatively so the projection matrix is always
    // rebuilt and the shadow map is reallocated when the
    // resolution tier changes.
    useEffect(() => {
        const light =
            directionalLightRef.current;

        if (!light) {
            return;
        }

        light.target.position.copy(
            shadowFit.target
        );
        light.target.updateMatrixWorld();

        const shadow = light.shadow;
        const camera = shadow.camera;

        camera.left = shadowFit.left;
        camera.right = shadowFit.right;
        camera.top = shadowFit.top;
        camera.bottom = shadowFit.bottom;
        camera.near = shadowFit.near;
        camera.far = shadowFit.far;
        camera.updateProjectionMatrix();

        if (
            shadow.map &&
            shadow.map.width !== shadowFit.mapSize
        ) {
            shadow.map.dispose();
            shadow.map = null;
        }

        shadow.mapSize.set(
            shadowFit.mapSize,
            shadowFit.mapSize
        );

        shadow.bias = -0.0001;
        shadow.normalBias = shadowFit.normalBias;
        shadow.needsUpdate = true;
    }, [shadowFit]);

    //==================================================
    // RENDER LIGHTS
    //==================================================

    return (
        <>
            {/* General fill lighting */}

            <ambientLight
                intensity={AMBIENT_INTENSITY}
            />

            {/* Indoor fill lights.
                These intentionally do not cast shadows. */}

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
                    intensity={ROOM_LIGHT_INTENSITY}
                    distance={roomLight.distance}
                    decay={2}
                    castShadow={false}
                />
            ))}

            {/* Main light responsible for shadows */}

            <directionalLight
                ref={directionalLightRef}
                castShadow
                position={shadowFit.lightPosition}
                intensity={DIRECTIONAL_INTENSITY}
                shadow-mapSize-width={
                    shadowFit.mapSize
                }
                shadow-mapSize-height={
                    shadowFit.mapSize
                }
            />

            {/* Keeps the light target in the scene graph. */}

            {directionalLightRef.current && (
                <primitive
                    object={
                        directionalLightRef.current.target
                    }
                />
            )}
        </>
    );
}