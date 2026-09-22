import {
   
    useMemo,
    useState
} from "react";

import {
    useCursor,
    useGLTF
} from "@react-three/drei";

import {
    Mesh,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    Object3D
} from "three";

import type {
    Door as DoorType
} from "../../engine/doors/DoorTypes";

import {
    findAsset
} from "../../assets/AssetLibrary";

import {
    getCachedDoorAsset,
    
} from "../../engine/build/FirebaseDoorWindowLibrary";

import {
    buildInteraction
} from "../Build/BuildInteraction";

import useEditor
    from "../../context/editor/useEditor";


interface Props {

    door:
        DoorType;
}


const HOVER_COLOR =
    "#63B8FF";

const HOVER_EMISSIVE_INTENSITY =
    0.35;


function setDoorHighlight(
    object:
        Object3D,
    highlighted:
        boolean
) {

    object.traverse(
        child => {

            if (
                !(child instanceof Mesh)
            ) {

                return;
            }

            const materials =
                Array.isArray(
                    child.material
                )
                    ? child.material
                    : [child.material];

            materials.forEach(
                material => {

                    const standard =
                        material as
                            | MeshStandardMaterial
                            | MeshPhysicalMaterial;

                    if (
                        "emissive" in standard &&
                        standard.emissive
                    ) {

                        if (
                            highlighted
                        ) {

                            standard.emissive.set(
                                HOVER_COLOR
                            );

                            standard.emissiveIntensity =
                                HOVER_EMISSIVE_INTENSITY;

                        } else {

                            standard.emissive.set(
                                0x000000
                            );

                            standard.emissiveIntensity =
                                0;

                        }

                        return;
                    }

                    if (
                        "color" in material &&
                        material.color &&
                        highlighted
                    ) {

                        material.color.offsetHSL(
                            0,
                            0,
                            0.12
                        );

                    }
                }
            );
        }
    );
}


export default function Door({
    door
}: Props) {

    const {
        state
    } = useEditor();

    const [
        hovered,
        setHovered
    ] = useState(false);


    useCursor(
        hovered &&
        !state.walkthroughMode,
        'url("/cursors/hand.png") 16 16, pointer'
    );


    //--------------------------------------------------
    // Firebase first; local asset remains as fallback.
    //--------------------------------------------------

    const asset =
        getCachedDoorAsset(
            door.assetId
        ) ??
        findAsset(
            door.assetId
        );


    //--------------------------------------------------
    // GLTF hook must run consistently.
    //--------------------------------------------------

    const {
        scene
    } = useGLTF(
        asset?.model ?? ""
    );


    //--------------------------------------------------
    // Clone before the moving-state return so the hook
    // order stays stable when a door starts moving.
    //--------------------------------------------------

    const model =
        useMemo(
            () => {

                const clone =
                    scene.clone(
                        true
                    );

                const scale =
                    asset?.scale ?? 1;

                clone.scale.set(
                    scale,
                    scale,
                    scale
                );

                clone.traverse(
                    child => {

                        child.userData = {
                            ...child.userData,
                            doorId:
                                door.id
                        };

                        if (
                            child instanceof Mesh
                        ) {

                            if (
                                Array.isArray(
                                    child.material
                                )
                            ) {

                                child.material =
                                    child.material.map(
                                        material =>
                                            material.clone()
                                    );

                            } else if (
                                child.material
                            ) {

                                child.material =
                                    child.material.clone();

                            }

                            child.castShadow =
                                true;

                            child.receiveShadow =
                                true;

                        }
                    }
                );

                return clone;

            },
            [
                scene,
                door.id,
                asset?.scale
            ]
        );


    //--------------------------------------------------
    // Hover handlers
    //--------------------------------------------------

    const handlePointerEnter =
        (event: any) => {

            if (
                state.walkthroughMode
            ) {

                return;
            }

            event.stopPropagation();

            setHovered(true);

            setDoorHighlight(
                model,
                true
            );
        };


    const handlePointerLeave =
        (event: any) => {

            if (
                state.walkthroughMode
            ) {

                return;
            }

            event.stopPropagation();

            setHovered(false);

            setDoorHighlight(
                model,
                false
            );
        };


    //--------------------------------------------------
    // Hide only the door currently being moved.
    //--------------------------------------------------

    const isMoving =
        buildInteraction.moveTarget?.type ===
            "door" &&
        buildInteraction.moveTarget.id ===
            door.id;

    if (
        !asset ||
        isMoving
    ) {

        return null;
    }


    //--------------------------------------------------
    // Use Firebase/local asset rotation offset when
    // present. The current local door is Math.PI / 2,
    // so its behavior remains unchanged.
    //--------------------------------------------------

    const rotationOffsetY =
        asset.rotationOffsetY ??
        Math.PI / 2;


    const finalRotationY =
        door.rotationY +
        rotationOffsetY;


    return (

        <group
            userData={{
                doorId:
                    door.id
            }}
            position={
                door.position
            }
            rotation={[
                0,
                finalRotationY,
                0
            ]}
            onPointerEnter={
                handlePointerEnter
            }
            onPointerLeave={
                handlePointerLeave
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
