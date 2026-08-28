import {
    Box3,
    Group,
    Vector3
} from "three";

import type { Asset } from "../../assets/Asset";

export interface NormalizedWindowModel {

    model: Group;

    bounds: {

        width: number;

        height: number;

        depth: number;

    };

}


/**
 * Normalizes a window GLB so that the
 * CENTER of its actual geometry becomes
 * the model origin (0, 0, 0).
 *
 * This is important because different GLB
 * files can have their own arbitrary origins.
 */
export function normalizeWindowModel(
    source: Group,
    asset: Asset
): NormalizedWindowModel {

    // --------------------------------------------------------
    // Clone the original model
    // --------------------------------------------------------

    const model =
        source.clone(true);


    // --------------------------------------------------------
    // Apply asset scale ONCE
    // --------------------------------------------------------

    const scale =
        asset.scale ?? 1;

    model.scale.set(
        scale,
        scale,
        scale
    );


    model.updateMatrixWorld(true);


    // --------------------------------------------------------
    // Get actual geometry bounds
    // --------------------------------------------------------

    const box =
        new Box3()
            .setFromObject(model);


    const size =
        new Vector3();


    const center =
        new Vector3();


    box.getSize(size);

    box.getCenter(center);


    // --------------------------------------------------------
    // Move the ACTUAL GEOMETRY CENTER
    // to the model origin
    // --------------------------------------------------------

    model.position.x -=
        center.x;

    model.position.y -=
        center.y;

    model.position.z -=
        center.z;


    model.updateMatrixWorld(true);


    // --------------------------------------------------------
    // Recalculate bounds after normalization
    // --------------------------------------------------------

    const normalizedBox =
        new Box3()
            .setFromObject(model);


    const normalizedSize =
        new Vector3();


    normalizedBox.getSize(
        normalizedSize
    );


    // --------------------------------------------------------
    // Return normalized model
    // --------------------------------------------------------

    return {

        model,

        bounds: {

            width:
                normalizedSize.x,

            height:
                normalizedSize.y,

            depth:
                normalizedSize.z

        }

    };

}