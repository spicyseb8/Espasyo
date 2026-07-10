import { wallAngle, wallCenter, wallLength } from "../../engine/walls/WallMath";

import type { Vector3 } from "three";

interface PreviewWallProps {

    start: Vector3;

    end: Vector3;

    height: number;

    thickness: number;

}

export default function PreviewWall({

    start,

    end,

    height,

    thickness

}: PreviewWallProps) {

    const length = wallLength(start, end);

    const angle = wallAngle(start, end);

    const center = wallCenter(start, end);

    return (

        <mesh

            position={[

                center.x,

                height / 2,

                center.z

            ]}

            rotation={[0, -angle, 0]}

        >

            <boxGeometry

                args={[

                    length,

                    height,

                    thickness

                ]}

            />

            <meshStandardMaterial

                color="#4DA3FF"

                transparent

                opacity={0.45}

            />

        </mesh>

    );

}