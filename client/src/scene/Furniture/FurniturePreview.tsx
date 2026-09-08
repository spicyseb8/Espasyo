import {
    Suspense,
    useEffect,
    useMemo,
    useRef
} from "react";

import {
    useFrame,
    useThree
} from "@react-three/fiber";

import {
    useGLTF
} from "@react-three/drei";

import {
    Box3,
    Group,
    Mesh,
    MeshStandardMaterial,
    Object3D,
    Raycaster,
    Vector3
} from "three";

import useEditor
    from "../../context/editor/useEditor";

import {
    getFurnitureScale
} from "./FurnitureSizing";

import {
    furnitureInteraction
} from "./FurnitureInteraction";

import {
    snapFurniturePlacement,
    getWallFrame
} from "./FurnitureSnapping";

import type {
    AssetBounds
} from "../Build/AssetBounds";

import {
    buildFurniturePlacement
} from "./FurniturePlacement";

import {
    checkFurnitureCollision
} from "../../engine/furniture/FurnitureCollision";

import type {
    FurnitureCollisionResult
} from "../../engine/furniture/FurnitureCollision";

import {
    BuildTool
} from "../../context/BuildTool";

import {
    hitWallByRaycast
} from "../../engine/walls/wallHit";

import type {
    Furniture
} from "../../engine/furniture/FurnitureTypes";

//==================================================
// Find furniture ID from hierarchy
//==================================================

function getFurnitureId(
    object: Object3D
): string | null {
    let current:
        Object3D | null =
        object;

    while (current) {
        const furnitureId =
            current.userData
                ?.furnitureId;

        if (
            typeof furnitureId ===
            "string"
        ) {
            return furnitureId;
        }

        current =
            current.parent;
    }

    return null;
}

//==================================================
// Find floor objects
//==================================================

function getFloorObjects(
    scene: Object3D
): Object3D[] {
    const result:
        Object3D[] = [];

    scene.traverse(
        object => {
            if (
                object.userData
                    ?.isFloor === true
            ) {
                result.push(
                    object
                );
            }
        }
    );

    return result;
}

//==================================================
// Raycast vertically to floor
//==================================================

function getFloorPointAtXZ(
    x: number,
    z: number,
    floorObjects: Object3D[],
    raycaster: Raycaster
): Vector3 | null {
    if (
        floorObjects.length === 0
    ) {
        return null;
    }

    raycaster.set(
        new Vector3(
            x,
            1000,
            z
        ),
        new Vector3(
            0,
            -1,
            0
        )
    );

    const hits =
        raycaster.intersectObjects(
            floorObjects,
            true
        );

    if (
        hits.length === 0
    ) {
        return null;
    }

    return hits[0]
        .point
        .clone();
}

//==================================================
// Furniture footprint points
//==================================================

function getFootprintPoints(
    position: Vector3,
    width: number,
    depth: number,
    rotationY: number
): Vector3[] {
    const cos =
        Math.cos(
            rotationY
        );

    const sin =
        Math.sin(
            rotationY
        );

    const halfWidth =
        width * 0.5;

    const halfDepth =
        depth * 0.5;

    const localPoints = [
        {
            x: -halfWidth,
            z: -halfDepth
        },
        {
            x: halfWidth,
            z: -halfDepth
        },
        {
            x: halfWidth,
            z: halfDepth
        },
        {
            x: -halfWidth,
            z: halfDepth
        }
    ];

    return localPoints.map(
        point =>
            new Vector3(
                position.x +
                    point.x * cos -
                    point.z * sin,

                0,

                position.z +
                    point.x * sin +
                    point.z * cos
            )
    );
}

//==================================================
// Check furniture footprint is inside floor
//==================================================

function isFootprintInsideFloor(
    position: Vector3,
    width: number,
    depth: number,
    rotationY: number,
    floorObjects: Object3D[],
    raycaster: Raycaster
): boolean {
    if (
        floorObjects.length === 0
    ) {
        return false;
    }

    const points =
        getFootprintPoints(
            position,
            width,
            depth,
            rotationY
        );

    points.push(
        new Vector3(
            position.x,
            0,
            position.z
        )
    );

    for (
        const point of points
    ) {
        const floorPoint =
            getFloorPointAtXZ(
                point.x,
                point.z,
                floorObjects,
                raycaster
            );

        if (!floorPoint) {
            return false;
        }
    }

    return true;
}

//==================================================
// Find furniture by ID
//==================================================

function findFurniture(
    furniture: Furniture[],
    id: string
): Furniture | null {
    return (
        furniture.find(
            item =>
                item.id === id
        ) ?? null
    );
}

//==================================================
// Find furniture being used as support
//==================================================

function getFurnitureSupport(
    raycaster: Raycaster,
    scene: Object3D,
    furniture: Furniture[]
): {
    furniture: Furniture;
    point: Vector3;
} | null {
    const hits =
        raycaster.intersectObjects(
            scene.children,
            true
        );

    for (
        const hit of hits
    ) {
        const furnitureId =
            getFurnitureId(
                hit.object
            );

        if (!furnitureId) {
            continue;
        }

        const supportingFurniture =
            findFurniture(
                furniture,
                furnitureId
            );

        if (
            !supportingFurniture
        ) {
            continue;
        }

        const topY =
            supportingFurniture.position.y +
            supportingFurniture.height;

        if (
            Math.abs(
                hit.point.y -
                topY
            ) > 0.08
        ) {
            continue;
        }

        return {
            furniture:
                supportingFurniture,

            point:
                hit.point.clone()
        };
    }

    return null;
}

//==================================================
// Furniture preview model
//==================================================

function FurniturePreviewModel() {
    const {
        state
    } = useEditor();

    const {
        camera,
        scene
    } = useThree();

    const asset =
        state.selectedAsset!;

    const previewRef =
        useRef<Group>(null);

    const raycaster =
        useMemo(
            () =>
                new Raycaster(),
            []
        );

    const supportRaycaster =
        useMemo(
            () =>
                new Raycaster(),
            []
        );

    //--------------------------------------------------
    // Load GLB
    //--------------------------------------------------

    const {
        scene: gltfScene
    } = useGLTF(
        asset.model
    );

    //--------------------------------------------------
    // Clone and size
    //--------------------------------------------------

    const model =
        useMemo(
            () => {
                const clone =
                    gltfScene.clone();

                if (
                    asset.furnitureDimensions
                ) {
                    const scale =
                        getFurnitureScale(
                            clone,
                            asset.furnitureDimensions
                        );

                    clone.scale.copy(
                        scale
                    );
                }

                return clone;
            },
            [
                gltfScene,
                asset.furnitureDimensions
            ]
        );

    //--------------------------------------------------
    // Preview material
    //--------------------------------------------------

    useEffect(
        () => {
            model.traverse(
                child => {
                    if (
                        !(child instanceof Mesh)
                    ) {
                        return;
                    }

                    child.material =
                        new MeshStandardMaterial({
                            color:
                                "#4DA3FF",

                            transparent:
                                true,

                            opacity:
                                0.55,

                            depthTest:
                                true,

                            depthWrite:
                                false,

                            roughness:
                                0.75,

                            metalness:
                                0
                        });

                    child.renderOrder =
                        0;
                }
            );
        },
        [
            model
        ]
    );

    //--------------------------------------------------
    // Measure
    //--------------------------------------------------

    const bounds:
        AssetBounds =
        useMemo(
            () => {
                const box =
                    new Box3()
                        .setFromObject(
                            model
                        );

                const size =
                    new Vector3();

                box.getSize(
                    size
                );

                return {
                    width:
                        size.x,

                    height:
                        size.y,

                    depth:
                        size.z
                };
            },
            [
                model
            ]
        );

    //--------------------------------------------------
    // Live preview
    //--------------------------------------------------

    useFrame(
        () => {
            if (
                !previewRef.current
            ) {
                return;
            }

            //--------------------------------------------------
            // Mouse ray
            //--------------------------------------------------

            raycaster.setFromCamera(
                furnitureInteraction.pointer,
                camera
            );

            //--------------------------------------------------
            // Placement rules
            //--------------------------------------------------

            const placementSurfaces =
                asset.placementSurfaces ??
                ["floor"];

            const snapTargets =
                asset.snapTargets ??
                [
                    "wall",
                    "furniture"
                ];

            const canPlaceOnFloor =
                placementSurfaces.includes(
                    "floor"
                );

            const canPlaceOnWall =
                placementSurfaces.includes(
                    "wall"
                );

            const canPlaceOnFurniture =
                placementSurfaces.includes(
                    "furniture"
                );

            //--------------------------------------------------
            // Floor
            //--------------------------------------------------

            const floorObjects =
                getFloorObjects(
                    scene
                );

            //--------------------------------------------------
            // Wall hit
            //--------------------------------------------------

            const wallHit =
                hitWallByRaycast(
                    raycaster,
                    scene.children,
                    state.walls
                );

            //--------------------------------------------------
            // Furniture support
            //--------------------------------------------------

            let support:
                {
                    furniture: Furniture;
                    point: Vector3;
                } | null = null;

            if (
                canPlaceOnFurniture
            ) {
                support =
                    getFurnitureSupport(
                        supportRaycaster,
                        scene,
                        state.furniture
                    );
            }

            //--------------------------------------------------
            // Result
            //--------------------------------------------------

            let finalTransform:
                ReturnType<
                    typeof buildFurniturePlacement
                > | null =
                null;

            /*
             * IMPORTANT:
             *
             * Give this the full union type.
             *
             * This fixes the TypeScript error from
             * the previous implementation.
             */
            let previewCollision:
                FurnitureCollisionResult = {
                    valid: false,
                    reason: "wall"
                };

            let previewIsWall =
                false;

            //--------------------------------------------------
            // PLACE ON FURNITURE
            //--------------------------------------------------

            if (
                support
            ) {
                const supportY =
                    support.furniture.position.y +
                    support.furniture.height;

                const basePlacement =
                    buildFurniturePlacement(
                        new Vector3(
                            support.point.x,
                            supportY,
                            support.point.z
                        ),
                        asset,
                        bounds,
                        furnitureInteraction.rotationY
                    );

                basePlacement.position.y =
                    supportY;

                finalTransform =
                    basePlacement;

                previewCollision =
                    checkFurnitureCollision(
                        finalTransform.position,
                        bounds.width,
                        bounds.depth,
                        finalTransform.rotationY,
                        state.walls,
                        state.furniture,
                        state.wallThickness,
                        0.01,
                        {
                            height:
                                bounds.height,

                            ignoreFurnitureId:
                                support.furniture.id
                        }
                    );
            }
            
            //--------------------------------------------------
            // WALL MOUNT
            //--------------------------------------------------

            else if (
                wallHit &&
                canPlaceOnWall
            ) {
                const frame =
                    getWallFrame(
                        wallHit.wall,
                        state.walls
                    );

                if (
                    frame
                ) {
                    previewIsWall =
                        true;

                    const wallPoint =
                        wallHit.surfacePoint;

                    const basePlacement =
                        buildFurniturePlacement(
                            new Vector3(
                                wallPoint.x,
                                0,
                                wallPoint.z
                            ),
                            asset,
                            bounds,
                            furnitureInteraction.rotationY
                        );

                    const wallStart =
                        wallHit.wall
                            .start.position;

                    const tangent =
                        frame.tangent;

                    const relativeX =
                        wallPoint.x -
                        wallStart.x;

                    const relativeZ =
                        wallPoint.z -
                        wallStart.z;

                    let alongWall =
                        relativeX *
                            tangent.x +

                        relativeZ *
                            tangent.z;

                    const tangentExtent =
                        getFurnitureWallExtent(
                            bounds.width,
                            bounds.depth,
                            furnitureInteraction.rotationY,
                            tangent
                        );

                    alongWall =
                        Math.max(
                            tangentExtent,
                            Math.min(
                                frame.wallLength -
                                    tangentExtent,
                                alongWall
                            )
                        );

                    const wallCenterPoint =
                        new Vector3(
                            wallStart.x +
                                tangent.x *
                                alongWall,

                            0,

                            wallStart.z +
                                tangent.z *
                                alongWall
                        );

                    const normal =
                        frame.interiorNormal;

                    const normalExtent =
                        getFurnitureWallExtent(
                            bounds.width,
                            bounds.depth,
                            furnitureInteraction.rotationY,
                            normal
                        );

                    const mountedX =
                        wallCenterPoint.x +
                        normal.x *
                        (
                            state.wallThickness * 0.5 +
                            normalExtent +
                            0.02
                        );

                    const mountedZ =
                        wallCenterPoint.z +
                        normal.z *
                        (
                            state.wallThickness * 0.5 +
                            normalExtent +
                            0.02
                        );

                    const halfHeight =
                        bounds.height * 0.5;

                    let bottomY =
                        wallPoint.y -
                        halfHeight;

                    bottomY =
                        Math.max(
                            0,
                            Math.min(
                                state.wallHeight -
                                    bounds.height,
                                bottomY
                            )
                        );

                    basePlacement.position =
                        new Vector3(
                            mountedX,
                            bottomY,
                            mountedZ
                        );

                    finalTransform =
                        basePlacement;

                    previewCollision =
                        checkFurnitureCollision(
                            finalTransform.position,
                            bounds.width,
                            bounds.depth,
                            finalTransform.rotationY,
                            state.walls,
                            state.furniture,
                            state.wallThickness,
                            0.01,
                            {
                                height:
                                    bounds.height,

                                ignoreWallId:
                                    wallHit.wall.id
                            }
                        );
                }
            }

            //--------------------------------------------------
            // FLOOR
            //--------------------------------------------------

            else if (
                canPlaceOnFloor
            ) {
                const floorPoint =
                    new Vector3();

                let foundFloor =
                    false;

                //--------------------------------------------------
                // Wall ray hit → search down to floor
                //--------------------------------------------------

                if (
                    wallHit
                ) {
                    const floorPointFromWall =
                        getFloorPointAtXZ(
                            wallHit.point.x,
                            wallHit.point.z,
                            floorObjects,
                            raycaster
                        );

                    if (
                        floorPointFromWall
                    ) {
                        floorPoint.copy(
                            floorPointFromWall
                        );

                        foundFloor =
                            true;
                    }
                }

                //--------------------------------------------------
                // Normal floor hit
                //--------------------------------------------------

                if (
                    !foundFloor
                ) {
                    const hits =
                        raycaster.intersectObjects(
                            floorObjects,
                            true
                        );

                    if (
                        hits.length > 0
                    ) {
                        floorPoint.copy(
                            hits[0].point
                        );

                        foundFloor =
                            true;
                    }
                }

                //--------------------------------------------------
                // No floor
                //--------------------------------------------------

                if (
                    !foundFloor
                ) {
                    furnitureInteraction
                        .clearPreview();

                    previewRef.current.visible =
                        false;

                    return;
                }

                //--------------------------------------------------
                // Base placement
                //--------------------------------------------------

                const transform =
                    buildFurniturePlacement(
                        floorPoint,
                        asset,
                        bounds,
                        furnitureInteraction.rotationY
                    );

                //--------------------------------------------------
                // Wall / furniture snap
                //--------------------------------------------------

                finalTransform =
                    snapFurniturePlacement(
                        floorPoint,
                        transform,
                        bounds,
                        state.walls,
                        state.furniture,
                        state.wallThickness,
                        snapTargets
                    );

                //--------------------------------------------------
                // Footprint
                //--------------------------------------------------

                const insideFloor =
                    isFootprintInsideFloor(
                        finalTransform.position,
                        bounds.width,
                        bounds.depth,
                        finalTransform.rotationY,
                        floorObjects,
                        supportRaycaster
                    );

                //--------------------------------------------------
                // Collision
                //--------------------------------------------------

                if (
                    !insideFloor
                ) {
                    previewCollision = {
                        valid: false,
                        reason: "wall"
                    };
                }
                else {
                    previewCollision =
                        checkFurnitureCollision(
                            finalTransform.position,
                            bounds.width,
                            bounds.depth,
                            finalTransform.rotationY,
                            state.walls,
                            state.furniture,
                            state.wallThickness,
                            0.01,
                            {
                                height:
                                    bounds.height
                            }
                        );
                }
            }

            //--------------------------------------------------
            // Unsupported
            //--------------------------------------------------

            else {
                furnitureInteraction
                    .clearPreview();

                previewRef.current.visible =
                    false;

                return;
            }

            //--------------------------------------------------
            // Safety
            //--------------------------------------------------

            if (
                !finalTransform
            ) {
                furnitureInteraction
                    .clearPreview();

                previewRef.current.visible =
                    false;

                return;
            }

            //--------------------------------------------------
            // Store
            //--------------------------------------------------

            furnitureInteraction.currentPlacement =
                finalTransform;

            furnitureInteraction.currentBounds =
                bounds;

            furnitureInteraction.currentCollision =
                previewCollision;

            //--------------------------------------------------
            // Show
            //--------------------------------------------------

            previewRef.current.visible =
                true;

            //--------------------------------------------------
            // Position
            //--------------------------------------------------

            previewRef.current.position.copy(
                finalTransform.position
            );

            previewRef.current.position.y +=
                finalTransform.modelOffset.y;

            //--------------------------------------------------
            // Rotation
            //--------------------------------------------------

            previewRef.current.rotation.y =
                finalTransform.rotationY;

            //--------------------------------------------------
            // Color
            //--------------------------------------------------

            model.traverse(
                child => {
                    if (
                        !(child instanceof Mesh)
                    ) {
                        return;
                    }

                    if (
                        child.material
                            instanceof
                        MeshStandardMaterial
                    ) {
                        child.material.color.set(
                            previewCollision.valid
                                ? "#4DA3FF"
                                : "#D9534F"
                        );

                        child.material.depthTest =
                            !previewIsWall;

                        child.material.depthWrite =
                            false;

                        child.renderOrder =
                            previewIsWall
                                ? 1000
                                : 0;
                    }
                }
            );
        }
    );

    //--------------------------------------------------
    // Render
    //--------------------------------------------------

    return (
        <group
            ref={
                previewRef
            }
        >
            <primitive
                object={
                    model
                }
            />
        </group>
    );
}

//==================================================
// Furniture extent helper
//==================================================

function getFurnitureWallExtent(
    width: number,
    depth: number,
    rotationY: number,
    axis: {
        x: number;
        z: number;
    }
): number {
    const localX = {
        x: Math.cos(
            rotationY
        ),
        z: Math.sin(
            rotationY
        )
    };

    const localZ = {
        x: -Math.sin(
            rotationY
        ),
        z: Math.cos(
            rotationY
        )
    };

    const xDot =
        localX.x * axis.x +
        localX.z * axis.z;

    const zDot =
        localZ.x * axis.x +
        localZ.z * axis.z;

    return (
        width *
        0.5 *
        Math.abs(
            xDot
        ) +

        depth *
        0.5 *
        Math.abs(
            zDot
        )
    );
}

//==================================================
// Wrapper
//==================================================

export default function FurniturePreview() {
    const {
        state
    } = useEditor();

    if (
        !state.layoutConfirmed
    ) {
        return null;
    }

    if (
        !state.selectedAsset
    ) {
        return null;
    }

    if (
        state.selectedAsset.type !==
        BuildTool.Furniture
    ) {
        return null;
    }

    if (
        state.buildTool !==
        BuildTool.Furniture
    ) {
        return null;
    }

    return (
        <Suspense
            fallback={
                null
            }
        >
            <FurniturePreviewModel />
        </Suspense>
    );
}