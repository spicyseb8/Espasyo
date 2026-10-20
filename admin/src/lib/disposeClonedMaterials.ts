import { Mesh, type Object3D } from "three";

export function disposeClonedMaterials(root: Object3D): void {
    root.traverse(object => {
        if (!(object instanceof Mesh)) {
            return;
        }

        const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

        materials.forEach(material => material.dispose());
    });
}