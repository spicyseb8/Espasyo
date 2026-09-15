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
    buildInteraction
} from "../Build/BuildInteraction";

import useEditor
    from "../../context/editor/useEditor";


//==================================================
// PROPS
//==================================================

interface Props {

    door:
        DoorType;

}


//==================================================
// HIGHLIGHT SETTINGS
//==================================================

const HOVER_COLOR =
    "#63B8FF";

const HOVER_EMISSIVE_INTENSITY =
    0.35;


//==================================================
// DOOR HIGHLIGHT
//==================================================

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
                    : [
                        child.material
                    ];


            materials.forEach(
                material => {

                    const standard =
                        material as
                            | MeshStandardMaterial
                            | MeshPhysicalMaterial;


                    //--------------------------------------------------
                    // Standard / Physical
                    //--------------------------------------------------

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

                        }

                        else {

                            standard.emissive.set(
                                0x000000
                            );

                            standard.emissiveIntensity =
                                0;

                        }

                        return;
                    }


                    //--------------------------------------------------
                    // Fallback
                    //--------------------------------------------------

                    if (
                        "color" in material &&
                        material.color
                    ) {

                        if (
                            highlighted
                        ) {

                            material.color.offsetHSL(
                                0,
                                0,
                                0.12
                            );

                        }

                    }

                }
            );

        }
    );

}


//==================================================
// DOOR
//==================================================

export default function Door({
    door
}: Props) {

    const {
        state
    } = useEditor();


    const [
        hovered,
        setHovered
    ] = useState(
        false
    );


    //==================================================
    // CURSOR
    //==================================================

    useCursor(
        hovered &&
        !state.walkthroughMode,

        'url("/cursors/hand.png") 16 16, pointer'
    );


    //--------------------------------------------------
    // Asset
    //--------------------------------------------------

    const asset =
        findAsset(
            door.assetId
        );


    //--------------------------------------------------
    // GLTF
    //--------------------------------------------------

    const {
        scene
    } = useGLTF(
        asset?.model ?? ""
    );


    //--------------------------------------------------
    // Hide only the door currently being moved
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
    // Clone
    //--------------------------------------------------

    const model =
        useMemo(
            () => {

                const clone =
                    scene.clone(
                        true
                    );


                clone.traverse(
                    child => {

                        child.userData = {

                            ...child.userData,

                            doorId:
                                door.id

                        };


                        //--------------------------------------------------
                        // Clone material
                        //--------------------------------------------------

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

                            }

                            else if (
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
                door.id
            ]
        );


    //--------------------------------------------------
    // Hover enter
    //--------------------------------------------------

    const handlePointerEnter =
        (event: any) => {

            if (
                state.walkthroughMode
            ) {

                return;
            }


            event.stopPropagation();


            setHovered(
                true
            );


            setDoorHighlight(
                model,
                true
            );

        };


    //--------------------------------------------------
    // Hover leave
    //--------------------------------------------------

    const handlePointerLeave =
        (event: any) => {

            if (
                state.walkthroughMode
            ) {

                return;
            }


            event.stopPropagation();


            setHovered(
                false
            );


            setDoorHighlight(
                model,
                false
            );

        };


    //--------------------------------------------------
    // Render
    //--------------------------------------------------

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
                door.rotationY,
                0
            ]}

            onPointerEnter={
                handlePointerEnter
            }

            onPointerLeave={
                handlePointerLeave
            }

        >

            <group

                rotation={[
                    0,
                    Math.PI / 2,
                    0
                ]}

            >

                <primitive
                    object={
                        model
                    }
                />

            </group>

        </group>

    );
}