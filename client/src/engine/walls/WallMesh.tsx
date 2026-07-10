import { useMemo } from "react";
import {
    BoxGeometry,
    Matrix4,
    Quaternion,
    Vector3
} from "three";

interface Props {
    start: Vector3;
    end: Vector3;
    thickness: number;
    height: number;
}

export default function WallMesh({

    start,
    end,
    thickness,
    height

}: Props) {

    const geometry = useMemo(() => {

        const direction = new Vector3()
            .subVectors(end, start);

        const length = direction.length();

        const geometry = new BoxGeometry(

            length,
            height,
            thickness

        );

        const midpoint = new Vector3()

            .addVectors(start, end)

            .multiplyScalar(0.5);

        midpoint.y = height / 2;

        direction.normalize();

        const quaternion = new Quaternion()

            .setFromUnitVectors(

                new Vector3(1, 0, 0),

                direction

            );

        const matrix = new Matrix4()

            .compose(

                midpoint,

                quaternion,

                new Vector3(1, 1, 1)

            );

        geometry.applyMatrix4(matrix);

        return geometry;

    }, [

        start,
        end,
        thickness,
        height

    ]);

    return geometry;

}