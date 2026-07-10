import { Shape, Vector3 } from "three";

interface Props{
    corners: Vector3[];
}

export default function FloorRenderer({

    corners

}: Props) {

    const shape = new Shape();

    shape.moveTo(
        corners[0].x,
        corners[0].z
    );

    for (let i = 1; i < corners.length; i++) {

        shape.lineTo(
            corners[i].x,
            corners[i].z
        );

    }

    return (

        <mesh
            rotation={[-Math.PI / 2,0,0]}
        >

            <shapeGeometry
                args={[shape]}
            />

            <meshStandardMaterial
                color="#dddddd"
            />

        </mesh>

    );

}