import {
    Suspense,
    useEffect,
    useMemo,
    useRef,
    useState
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
    findAsset
} from "../../assets/AssetLibrary";

import {
    getCachedFurnitureAsset,
    getFurnitureAssets
} from "../../engine/furniture/FirebaseFurnitureLibrary";

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

import type {
    Asset
} from "../../assets/Asset";


//======================================================
// FIND FURNITURE ASSET
//======================================================

function findFurnitureAsset(
    assetId: string
): Asset | null {

    return (

        getCachedFurnitureAsset(
            assetId
        ) ??

        (
            findAsset(
                assetId
            ) ?? null
        )

    );

}


//======================================================
// FIND FURNITURE ID FROM HIERARCHY
//======================================================

function getFurnitureId(
    object: Object3D
): string | null {

    let current:
        Object3D | null =
        object;


    while (
        current
    ) {

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


//======================================================
// FIND FLOOR OBJECTS
//======================================================

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


//======================================================
// RAYCAST VERTICALLY TO FLOOR
//======================================================

function getFloorPointAtXZ(

    x: number,

    z: number,

    floorObjects:
        Object3D[],

    raycaster:
        Raycaster

): Vector3 | null {


    if (
        floorObjects.length ===
        0
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
        hits.length ===
        0
    ) {

        return null;

    }


    return hits[0]
        .point
        .clone();

}


//======================================================
// FURNITURE FOOTPRINT POINTS
//======================================================

function getFootprintPoints(

    position:
        Vector3,

    width:
        number,

    depth:
        number,

    rotationY:
        number

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
        width *
        0.5;


    const halfDepth =
        depth *
        0.5;


    const localPoints = [

        {
            x:
                -halfWidth,

            z:
                -halfDepth
        },

        {
            x:
                halfWidth,

            z:
                -halfDepth
        },

        {
            x:
                halfWidth,

            z:
                halfDepth
        },

        {
            x:
                -halfWidth,

            z:
                halfDepth
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


//======================================================
// CHECK FOOTPRINT INSIDE FLOOR
//======================================================

function isFootprintInsideFloor(

    position:
        Vector3,

    width:
        number,

    depth:
        number,

    rotationY:
        number,

    floorObjects:
        Object3D[],

    raycaster:
        Raycaster

): boolean {


    if (
        floorObjects.length ===
        0
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
        const point
        of points
    ) {


        const floorPoint =
            getFloorPointAtXZ(

                point.x,

                point.z,

                floorObjects,

                raycaster

            );


        if (
            !floorPoint
        ) {

            return false;

        }

    }


    return true;

}


//======================================================
// FIND FURNITURE BY ID
//======================================================

function findFurniture(

    furniture:
        Furniture[],

    id:
        string

): Furniture | null {


    return (

        furniture.find(

            item =>
                item.id ===
                id

        ) ?? null

    );

}


//======================================================
// FIND FURNITURE SUPPORT
//======================================================

function getFurnitureSupport(

    raycaster:
        Raycaster,

    scene:
        Object3D,

    furniture:
        Furniture[],

    ignoreFurnitureId:
        string | null

): {

    furniture:
        Furniture;

    point:
        Vector3;

} | null {


    const hits =
        raycaster.intersectObjects(

            scene.children,

            true

        );


    for (
        const hit
        of hits
    ) {


        const furnitureId =
            getFurnitureId(
                hit.object
            );


        if (
            !furnitureId
        ) {

            continue;

        }


        if (
            ignoreFurnitureId &&

            furnitureId ===
                ignoreFurnitureId
        ) {

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


//======================================================
// INTERIOR WALL FACE
//======================================================

function isInteriorWallFace(

    wall: {

        start: {

            position:
                Vector3;

        };

        end: {

            position:
                Vector3;

        };

    },

    surfacePoint:
        Vector3,

    interiorNormal: {

        x:
            number;

        z:
            number;

    },

    wallThickness:
        number

): boolean {


    const wallDirection =
        wall.end.position.clone().sub(

            wall.start.position

        );


    wallDirection.y =
        0;


    const wallLength =
        wallDirection.length();


    if (
        wallLength <=
        0.0001
    ) {

        return false;

    }


    wallDirection.normalize();


    const wallStart =
        new Vector3(

            wall.start.position.x,

            0,

            wall.start.position.z

        );


    const hitPoint =
        new Vector3(

            surfacePoint.x,

            0,

            surfacePoint.z

        );


    const toHit =
        hitPoint.clone().sub(
            wallStart
        );


    const alongWall =
        toHit.dot(
            wallDirection
        );


    const endMargin =
        Math.max(

            0.03,

            wallThickness *
            0.60

        );


    if (
        alongWall <=
        endMargin
    ) {

        return false;

    }


    if (
        alongWall >=
        wallLength -
        endMargin
    ) {

        return false;

    }


    const centerLinePoint =
        wallStart.clone().addScaledVector(

            wallDirection,

            alongWall

        );


    const offset =
        hitPoint.clone().sub(
            centerLinePoint
        );


    const interiorDepth =

        offset.x *
            interiorNormal.x +

        offset.z *
            interiorNormal.z;


    const minimumInteriorDepth =
        Math.max(

            0.015,

            wallThickness *
            0.20

        );


    return (

        interiorDepth >=
        minimumInteriorDepth

    );

}


//======================================================
// WALL FURNITURE ROTATION
//======================================================

function getWallFurnitureRotation(

    interiorNormal: {

        x:
            number;

        z:
            number;

    }

): number {

    return Math.atan2(

        interiorNormal.x,

        interiorNormal.z

    );

}


//======================================================
// PREVIEW MODEL PROPS
//======================================================

interface FurniturePreviewModelProps {

    asset:
        Asset;

    movingFurnitureId:
        string | null;

}


//======================================================
// PREVIEW MATERIAL
//======================================================

function createPreviewMaterial():
    MeshStandardMaterial {

    return new MeshStandardMaterial({

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

}


//======================================================
// PREPARE PREVIEW MATERIALS
//======================================================

function preparePreviewMaterials(

    model:
        Object3D

): void {


    model.traverse(

        child => {

            if (
                !(child instanceof Mesh)
            ) {

                return;

            }


            if (
                Array.isArray(
                    child.material
                )
            ) {

                child.material =
                    child.material.map(

                        () =>
                            createPreviewMaterial()

                    );

            }

            else {

                child.material =
                    createPreviewMaterial();

            }


            child.renderOrder =
                0;

        }

    );

}


//======================================================
// PREVIEW MODEL
//======================================================

function FurniturePreviewModel({

    asset,

    movingFurnitureId

}: FurniturePreviewModelProps) {


    const {
        state
    } = useEditor();


    const {
        camera,
        scene
    } = useThree();


    //--------------------------------------------------
    // Preview group
    //--------------------------------------------------

    const previewRef =
        useRef<Group>(
            null
        );


    //--------------------------------------------------
    // Raycasters
    //--------------------------------------------------

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
    // GLTF
    //--------------------------------------------------

    const {
        scene: gltfScene
    } = useGLTF(

        asset.model

    );


    //--------------------------------------------------
    // Clone
    //--------------------------------------------------

    const model =
        useMemo(

            () => {

                const clone =
                    gltfScene.clone(
                        true
                    );


                preparePreviewMaterials(
                    clone
                );


                return clone;

            },

            [
                gltfScene
            ]

        );


    //--------------------------------------------------
    // MEASURE NATIVE GLB
    //--------------------------------------------------

    const bounds:
        AssetBounds =

        useMemo(

            () => {

                model.updateMatrixWorld(
                    true
                );


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


                const center =
                    new Vector3();


                box.getCenter(
                    center
                );


                return {

                    width:
                        size.x,

                    height:
                        size.y,

                    depth:
                        size.z,

                    minX:
                        box.min.x,

                    maxX:
                        box.max.x,

                    minY:
                        box.min.y,

                    maxY:
                        box.max.y,

                    minZ:
                        box.min.z,

                    maxZ:
                        box.max.z,

                    centerX:
                        center.x,

                    centerZ:
                        center.z

                };

            },

            [
                model
            ]

        );


    //--------------------------------------------------
    // LIVE PREVIEW
    //--------------------------------------------------

    useFrame(

        () => {

            if (
                !previewRef.current
            ) {

                return;

            }


            raycaster.setFromCamera(

                furnitureInteraction.pointer,

                camera

            );


            const placementSurfaces =
                asset.placementSurfaces ??
                [
                    "floor"
                ];


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


            const floorObjects =
                getFloorObjects(
                    scene
                );


            const wallHit =
                hitWallByRaycast(

                    raycaster,

                    scene.children,

                    state.walls

                );


            let support:
                {

                    furniture:
                        Furniture;

                    point:
                        Vector3;

                } | null =
                null;


            if (
                canPlaceOnFurniture
            ) {

                support =
                    getFurnitureSupport(

                        supportRaycaster,

                        scene,

                        state.furniture,

                        movingFurnitureId

                    );

            }


            let finalTransform:
                ReturnType<
                    typeof buildFurniturePlacement
                > | null =
                null;


            let previewCollision:
                FurnitureCollisionResult = {

                    valid:
                        false,

                    reason:
                        "wall"

                };


            let previewIsWall =
                false;


            //==================================================
            // FURNITURE SURFACE
            //==================================================

            if (
                support
            ) {

                const supportY =
                    support.furniture.position.y +

                    support.furniture.height;


                const surfaceRotationY =
                    furnitureInteraction.rotationY;


                const basePlacement =
                    buildFurniturePlacement(

                        new Vector3(

                            support.point.x,

                            supportY,

                            support.point.z

                        ),

                        asset,

                        bounds,

                        surfaceRotationY

                    );


                basePlacement.position.y =
                    supportY;


                basePlacement.placementMode =
                    "surface";


                basePlacement.parentFurnitureId =
                    support.furniture.id;


                basePlacement.wallId =
                    null;


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
                                movingFurnitureId ??
                                support.furniture.id

                        }

                    );

            }


            //==================================================
            // WALL FURNITURE
            //==================================================

            else if (
                canPlaceOnWall &&
                wallHit
            ) {

                const frame =
                    getWallFrame(

                        wallHit.wall,

                        state.walls

                    );


                if (
                    !frame
                ) {

                    furnitureInteraction
                        .clearPreview();


                    previewRef.current.visible =
                        false;


                    return;

                }


                const validInteriorFace =
                    isInteriorWallFace(

                        wallHit.wall,

                        wallHit.surfacePoint,

                        frame.interiorNormal,

                        state.wallThickness

                    );


                if (
                    !validInteriorFace
                ) {

                    furnitureInteraction
                        .clearPreview();


                    previewRef.current.visible =
                        false;


                    return;

                }


                previewIsWall =
                    true;


                const wallPoint =
                    wallHit.surfacePoint;


                const wallStart =
                    wallHit.wall
                        .start.position;


                const tangent =
                    frame.tangent;


                const wallRotationY =
                    getWallFurnitureRotation(

                        frame.interiorNormal

                    );


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

                        wallRotationY,

                        tangent

                    );


                const wallTooSmall =
                    frame.wallLength <
                    tangentExtent * 2;


                if (
                    wallTooSmall
                ) {

                    alongWall =
                        frame.wallLength *
                        0.5;

                }

                else {

                    alongWall =
                        Math.max(

                            tangentExtent,

                            Math.min(

                                frame.wallLength -
                                    tangentExtent,

                                alongWall

                            )

                        );

                }


                const wallCenterPoint =
                    new Vector3(

                        wallStart.x +
                            tangent.x *
                            alongWall,

                        wallPoint.y,

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

                        wallRotationY,

                        normal

                    );


                const mountedDistance =

                    state.wallThickness *
                        0.5 +

                    normalExtent +

                    0.02;


                const mountedX =
                    wallCenterPoint.x +

                    normal.x *
                    mountedDistance;


                const mountedZ =
                    wallCenterPoint.z +

                    normal.z *
                    mountedDistance;


                const halfHeight =
                    bounds.height *
                    0.5;


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


                const basePlacement =
                    buildFurniturePlacement(

                        new Vector3(

                            mountedX,

                            bottomY,

                            mountedZ

                        ),

                        asset,

                        bounds,

                        wallRotationY

                    );


                basePlacement.position =
                    new Vector3(

                        mountedX,

                        bottomY,

                        mountedZ

                    );


                basePlacement.placementMode =
                    "wall";


                basePlacement.wallId =
                    wallHit.wall.id;


                basePlacement.parentFurnitureId =
                    null;


                basePlacement.surfaceNormal =
                    new Vector3(

                        normal.x,

                        0,

                        normal.z

                    );


                basePlacement.rotationY =
                    wallRotationY;


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
                                wallHit.wall.id,

                            ignoreFurnitureId:
                                movingFurnitureId ??
                                undefined

                        }

                    );


                if (

                    wallTooSmall ||

                    bounds.height >
                        state.wallHeight

                ) {

                    previewCollision = {

                        valid:
                            false,

                        reason:
                            "wall"

                    };

                }

            }


            //==================================================
            // FLOOR FURNITURE
            //==================================================

            else if (
                canPlaceOnFloor
            ) {

                const floorPoint =
                    new Vector3();


                let foundFloor =
                    false;


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


                if (
                    !foundFloor
                ) {

                    furnitureInteraction
                        .clearPreview();


                    previewRef.current.visible =
                        false;


                    return;

                }


                const transform =
                    buildFurniturePlacement(

                        floorPoint,

                        asset,

                        bounds,

                        furnitureInteraction.rotationY

                    );


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


                const insideFloor =
                    isFootprintInsideFloor(

                        finalTransform.position,

                        bounds.width,

                        bounds.depth,

                        finalTransform.rotationY,

                        floorObjects,

                        supportRaycaster

                    );


                if (
                    !insideFloor
                ) {

                    previewCollision = {

                        valid:
                            false,

                        reason:
                            "wall"

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
                                    bounds.height,

                                ignoreFurnitureId:
                                    movingFurnitureId ??
                                    undefined

                            }

                        );

                }

            }


            //==================================================
            // NOT SUPPORTED
            //==================================================

            else {

                furnitureInteraction
                    .clearPreview();


                previewRef.current.visible =
                    false;


                return;

            }


            //==================================================
            // SAFETY
            //==================================================

            if (
                !finalTransform
            ) {

                furnitureInteraction
                    .clearPreview();


                previewRef.current.visible =
                    false;


                return;

            }


            //==================================================
            // STORE PREVIEW
            //==================================================

            furnitureInteraction.currentPlacement =
                finalTransform;


            furnitureInteraction.currentBounds =
                bounds;


            furnitureInteraction.currentCollision =
                previewCollision;


            //==================================================
            // SHOW PREVIEW
            //==================================================

            previewRef.current.visible =
                true;


            previewRef.current.position.copy(

                finalTransform.position

            );


            previewRef.current.rotation.y =
                finalTransform.rotationY;


            model.position.copy(

                finalTransform.modelOffset

            );


            //==================================================
            // PREVIEW COLOR
            //==================================================

            const previewColor =
                previewCollision.valid
                    ? "#4DA3FF"
                    : "#D9534F";


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
                            previewColor
                        );


                        child.material.depthTest =
                            !previewIsWall;


                        child.material.depthWrite =
                            false;


                        child.renderOrder =
                            previewIsWall
                                ? 1000
                                : 0;


                        return;

                    }


                    if (
                        Array.isArray(
                            child.material
                        )
                    ) {

                        for (

                            const material
                            of child.material

                        ) {

                            if (
                                material
                                    instanceof
                                MeshStandardMaterial
                            ) {

                                material.color.set(
                                    previewColor
                                );


                                material.depthTest =
                                    !previewIsWall;


                                material.depthWrite =
                                    false;

                            }

                        }


                        child.renderOrder =
                            previewIsWall
                                ? 1000
                                : 0;

                    }

                }

            );

        }

    );


    //======================================================
    // RENDER
    //======================================================

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


//======================================================
// WRAPPER
//======================================================

export default function FurniturePreview() {

    const {
        state,
        dispatch
    } = useEditor();


    //==================================================
    // Firebase furniture catalog
    //==================================================

    const [
        firebaseFurnitureAssets,
        setFirebaseFurnitureAssets
    ] = useState<
        Asset[]
    >([]);


    //==================================================
    // TRACK FURNITURE COUNT
    //==================================================
    //
    // When furniture is actually placed, state.furniture
    // increases by one.
    //
    // We use this to end the current placement session.
    //
    // This means:
    //
    //     Select furniture
    //          ↓
    //     Place furniture
    //          ↓
    //     Selection is cleared
    //          ↓
    //     Preview disappears
    //
    // To place another furniture item, the user must
    // select it again from the Furniture panel.
    //==================================================

    const furnitureCountRef =
        useRef(
            state.furniture.length
        );


    useEffect(

        () => {

            const previousCount =
                furnitureCountRef.current;


            const currentCount =
                state.furniture.length;


            //--------------------------------------------------
            // A new furniture item was added.
            //--------------------------------------------------

            if (
                currentCount >
                previousCount
            ) {

                //--------------------------------------------------
                // End the current placement session.
                //--------------------------------------------------

                dispatch({

                    type:
                        "SET_SELECTED_ASSET",

                    payload:
                        null

                });


                dispatch({

                    type:
                        "SET_BUILD_TOOL",

                    payload:
                        BuildTool.None

                });


                //--------------------------------------------------
                // Clear the preview placement data.
                //--------------------------------------------------

                furnitureInteraction
                    .clearPreview();

            }


            //--------------------------------------------------
            // Always remember the latest count.
            //
            // This also handles:
            //
            // - deleting furniture
            // - loading a project
            // - moving existing furniture
            //--------------------------------------------------

            furnitureCountRef.current =
                currentCount;

        },

        [
            state.furniture.length,
            dispatch
        ]

    );


    //==================================================
    // LOAD FIREBASE CATALOG
    //==================================================

    useEffect(

        () => {

            let cancelled =
                false;


            getFurnitureAssets()

                .then(

                    assets => {

                        if (
                            !cancelled
                        ) {

                            setFirebaseFurnitureAssets(
                                assets
                            );

                        }

                    }

                )

                .catch(

                    error => {

                        console.error(

                            "Failed to load Firebase furniture catalog for preview:",

                            error

                        );

                    }

                );


            return () => {

                cancelled =
                    true;

            };

        },

        []

    );


    //==================================================
    // FIND PREVIEW FURNITURE ASSET
    //==================================================

    const findPreviewFurnitureAsset =
        (assetId: string):
            Asset | null => {

            return (

                firebaseFurnitureAssets.find(

                    asset =>
                        asset.id ===
                        assetId

                ) ??

                findFurnitureAsset(
                    assetId
                )

            );

        };


    //==================================================
    // LAYOUT REQUIRED
    //==================================================

    if (
        !state.layoutConfirmed
    ) {

        return null;

    }


    //==================================================
    // EXISTING FURNITURE BEING MOVED
    //==================================================

    const movingFurniture =
        state.movingFurnitureId

            ? findFurniture(

                state.furniture,

                state.movingFurnitureId

            )

            : null;


    //==================================================
    // ASSET FOR MOVING FURNITURE
    //==================================================

    const movingAsset =
        movingFurniture

            ? findPreviewFurnitureAsset(

                movingFurniture.assetId

            )

            : null;


    //==================================================
    // NEW FURNITURE PREVIEW
    //==================================================

    const newFurniturePreview =

        state.selectedAsset &&

        state.selectedAsset.type ===
            BuildTool.Furniture &&

        state.buildTool ===
            BuildTool.Furniture;


    //==================================================
    // EXISTING FURNITURE MOVEMENT
    //==================================================

    const movingFurniturePreview =

        movingFurniture !== null &&

        movingAsset !== null;


    //==================================================
    // NOTHING TO RENDER
    //==================================================

    if (

        !newFurniturePreview &&

        !movingFurniturePreview

    ) {

        return null;

    }


    //==================================================
    // SELECT ACTUAL ASSET
    //==================================================

    const previewAsset =

        movingFurniturePreview

            ? movingAsset

            : state.selectedAsset;


    //==================================================
    // SAFETY
    //==================================================

    if (
        !previewAsset
    ) {

        return null;

    }


    //==================================================
    // SAFETY FOR MODEL URL
    //==================================================

    if (

        typeof previewAsset.model !==
        "string" ||

        previewAsset.model.trim() ===
        ""

    ) {

        return null;

    }


    return (

        <Suspense
            fallback={
                null
            }
        >

            <FurniturePreviewModel

                asset={
                    previewAsset
                }

                movingFurnitureId={
                    state.movingFurnitureId
                }

            />

        </Suspense>

    );

}


//======================================================
// FURNITURE WALL EXTENT
//======================================================

function getFurnitureWallExtent(

    width:
        number,

    depth:
        number,

    rotationY:
        number,

    axis: {

        x:
            number;

        z:
            number;

    }

): number {


    const localX = {

        x:
            Math.cos(
                rotationY
            ),

        z:
            Math.sin(
                rotationY
            )

    };


    const localZ = {

        x:
            -Math.sin(
                rotationY
            ),

        z:
            Math.cos(
                rotationY
            )

    };


    const xDot =
        localX.x *
            axis.x +

        localX.z *
            axis.z;


    const zDot =
        localZ.x *
            axis.x +

        localZ.z *
            axis.z;


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