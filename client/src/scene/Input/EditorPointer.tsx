import type { ThreeEvent } from "@react-three/fiber";
import { Vector3 } from "three";

interface EditorPointerProps {

    onPointerDown?(point: Vector3): void;

    onPointerMove?(point: Vector3): void;

    onPointerUp?(point: Vector3): void;

}

export default function EditorPointer({

    onPointerDown,

    onPointerMove,

    onPointerUp

}: EditorPointerProps) {

    return (

        <mesh

            rotation={[-Math.PI / 2, 0, 0]}

            position={[0, 0, 0]}

            visible={false}

            onPointerDown={(event: ThreeEvent<PointerEvent>) => {

                event.stopPropagation();

                onPointerDown?.(

                    event.point.clone()

                );

            }}

            onPointerMove={(event: ThreeEvent<PointerEvent>) => {

                onPointerMove?.(

                    event.point.clone()

                );

            }}

            onPointerUp={(event: ThreeEvent<PointerEvent>) => {

                event.stopPropagation();

                onPointerUp?.(

                    event.point.clone()

                );

            }}

        >

            <planeGeometry args={[1000, 1000]} />

        </mesh>

    );

}