import { Box3, Group, Vector3 } from "three";
import type { Asset } from "../engine/assets/Asset";

export interface AdminElementModelBounds {
    width: number;
    height: number;
    depth: number;
}

export function prepareAdminDoorModel(source: Group, asset: Asset): Group {
    const model = source.clone(true);
    const scale = asset.scale ?? 1;
    model.scale.set(scale, scale, scale);
    model.updateMatrixWorld(true);
    return model;
}

export function normalizeAdminWindowModel(source: Group, asset: Asset): Group {
    const model = source.clone(true);
    const scale = asset.scale ?? 1;
    model.scale.set(scale, scale, scale);
    model.updateMatrixWorld(true);

    const box = new Box3().setFromObject(model);
    const center = new Vector3();
    box.getCenter(center);
    model.position.sub(center);
    model.updateMatrixWorld(true);
    return model;
}

export function getAdminElementModelBounds(model: Group): AdminElementModelBounds {
    model.updateMatrixWorld(true);
    const size = new Vector3();
    new Box3().setFromObject(model).getSize(size);
    return {
        width: size.x,
        height: size.y,
        depth: size.z
    };
}

export function fitAdminElementModelToBounds(
    model: Group,
    dimensions: AdminElementModelBounds
): Group {
    const current = getAdminElementModelBounds(model);
    if (current.width <= 0 || current.height <= 0 || current.depth <= 0) return model;

    model.scale.set(
        model.scale.x * dimensions.width / current.width,
        model.scale.y * dimensions.height / current.height,
        model.scale.z * dimensions.depth / current.depth
    );
    model.updateMatrixWorld(true);
    return model;
}