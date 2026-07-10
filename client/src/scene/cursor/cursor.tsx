import { Vector3 } from "three";

interface CursorProps {
    position: Vector3;
}

export default function Cursor({
    position,
}: CursorProps) {

    return (

        <mesh
            position={[
                position.x,
                0.01,
                position.z,
            ]}
        >

            <circleGeometry args={[0.12, 32]} />

            <meshBasicMaterial
                color="#4DA3FF"
                transparent
                opacity={0.75}
            />

        </mesh>

    );

}