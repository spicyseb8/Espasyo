import {
    memo,
    useMemo
} from "react";
import {
    Line
} from "@react-three/drei";
import {
    Vector3
} from "three";
import useEditor
    from "../../context/editor/useEditor";
import WallPiece
    from "./WallPiece";
import {
    buildWallMeshes
} from "../../engine/walls/WallMeshBuilder";
import {
    solveRegions
} from "../../engine/regions/RegionSolver";
import {
    getWallFinishSides
} from "./WallFinishUtils";
interface WallOutlineProps {
    start: Vector3;
    end: Vector3;
    height: number;
    thickness: number;
    connectedStart: boolean;
    connectedEnd: boolean;
}
function WallOutline({
    start,
    end,
    height,
    thickness,
    connectedStart,
    connectedEnd
}: WallOutlineProps) {
    const direction =
        new Vector3()
            .subVectors(
                end,
                start
            );
    const length =
        direction.length();
    if (
        length <=
        0.001
    ) {
        return null;
    }
    direction.normalize();
    const center =
        start.clone()
            .add(
                direction
                    .clone()
                    .multiplyScalar(
                        length * 0.5
                    )
            );
    const rotationY =
        -Math.atan2(
            direction.z,
            direction.x
        );
    const halfLength =
        length * 0.5;
    const halfThickness =
        thickness * 0.5;
    const topEdges: Vector3[][] = [
        [
            new Vector3(
                -halfLength,
                height,
                halfThickness
            ),
            new Vector3(
                halfLength,
                height,
                halfThickness
            )
        ],
        [
            new Vector3(
                -halfLength,
                height,
                -halfThickness
            ),
            new Vector3(
                halfLength,
                height,
                -halfThickness
            )
        ]
    ];
    return (
        <group
            position={
                center
            }
            rotation={[
                0,
                rotationY,
                0
            ]}
        >
            {}
            {
                topEdges.map(
                    (
                        edge,
                        index
                    ) => (
                        <Line
                            key={
                                `wall-top-edge-${index}`
                            }
                            points={
                                edge
                            }
                            color="#252525"
                            lineWidth={
                                1
                            }
                        />
                    )
                )
            }
            {}
            {
                !connectedStart && (
                    <>
                        {}
                        <Line
                            points={[
                                new Vector3(
                                    -halfLength,
                                    0,
                                    halfThickness
                                ),
                                new Vector3(
                                    -halfLength,
                                    height,
                                    halfThickness
                                )
                            ]}
                            color="#252525"
                            lineWidth={
                                1
                            }
                        />
                        {}
                        <Line
                            points={[
                                new Vector3(
                                    -halfLength,
                                    0,
                                    -halfThickness
                                ),
                                new Vector3(
                                    -halfLength,
                                    height,
                                    -halfThickness
                                )
                            ]}
                            color="#252525"
                            lineWidth={
                                1
                            }
                        />
                        {}
                        <Line
                            points={[
                                new Vector3(
                                    -halfLength,
                                    height,
                                    -halfThickness
                                ),
                                new Vector3(
                                    -halfLength,
                                    height,
                                    halfThickness
                                )
                            ]}
                            color="#252525"
                            lineWidth={
                                1
                            }
                        />
                    </>
                )
            }
            {}
            {
                !connectedEnd && (
                    <>
                        {}
                        <Line
                            points={[
                                new Vector3(
                                    halfLength,
                                    0,
                                    halfThickness
                                ),
                                new Vector3(
                                    halfLength,
                                    height,
                                    halfThickness
                                )
                            ]}
                            color="#252525"
                            lineWidth={
                                1
                            }
                        />
                        {}
                        <Line
                            points={[
                                new Vector3(
                                    halfLength,
                                    0,
                                    -halfThickness
                                ),
                                new Vector3(
                                    halfLength,
                                    height,
                                    -halfThickness
                                )
                            ]}
                            color="#252525"
                            lineWidth={
                                1
                            }
                        />
                        {}
                        <Line
                            points={[
                                new Vector3(
                                    halfLength,
                                    height,
                                    -halfThickness
                                ),
                                new Vector3(
                                    halfLength,
                                    height,
                                    halfThickness
                                )
                            ]}
                            color="#252525"
                            lineWidth={
                                1
                            }
                        />
                    </>
                )
            }
        </group>
    );
}
function pointToSegmentDistanceXZ(
    point: Vector3,
    start: Vector3,
    end: Vector3
): number {
    const px =
        point.x;
    const pz =
        point.z;
    const sx =
        start.x;
    const sz =
        start.z;
    const ex =
        end.x;
    const ez =
        end.z;
    const dx =
        ex -
        sx;
    const dz =
        ez -
        sz;
    const lengthSquared =
        dx * dx +
        dz * dz;
    if (
        lengthSquared <=
        0.000001
    ) {
        return Math.sqrt(
            (px - sx) ** 2 +
            (pz - sz) ** 2
        );
    }
    let t =
        (
            (px - sx) * dx +
            (pz - sz) * dz
        ) /
        lengthSquared;
    t =
        Math.max(
            0,
            Math.min(
                1,
                t
            )
        );
    const closestX =
        sx +
        t * dx;
    const closestZ =
        sz +
        t * dz;
    return Math.sqrt(
        (px - closestX) ** 2 +
        (pz - closestZ) ** 2
    );
}
interface WallConnectionData {
    id: string;
    start: {
        position: Vector3;
    };
    end: {
        position: Vector3;
    };
}
function isWallEndpointConnected(
    wallId: string,
    point: Vector3,
    walls: WallConnectionData[]
): boolean {
    const CONNECTION_TOLERANCE =
        0.05;
    return walls.some(
        otherWall => {
            if (
                otherWall.id ===
                wallId
            ) {
                return false;
            }
            const otherStart =
                otherWall.start.position;
            const otherEnd =
                otherWall.end.position;
            return (
                pointToSegmentDistanceXZ(
                    point,
                    otherStart,
                    otherEnd
                ) <=
                CONNECTION_TOLERANCE
            );
        }
    );
}
function Walls() {
    const {
        state
    } = useEditor();
    const regions =
        useMemo(
            () =>
                solveRegions(
                    state.corners,
                    state.walls
                ),
            [
                state.corners,
                state.walls
            ]
        );
    return (
        <group>
            {
                state.walls.map(
                    wall => {
                        const pieces =
                            buildWallMeshes(
                                wall,
                                state.wallHeight,
                                state.wallThickness,
                                state.doors,
                                state.openings,
                                state.windows
                            );
                        const finishSides =
                            getWallFinishSides(
                                wall,
                                regions,
                                state.wallFinishes
                            );
                        const wallStart =
                            wall.start.position;
                        const wallEnd =
                            wall.end.position;
                        const connectedStart =
                            isWallEndpointConnected(
                                wall.id,
                                wallStart,
                                state.walls as WallConnectionData[]
                            );
                        const connectedEnd =
                            isWallEndpointConnected(
                                wall.id,
                                wallEnd,
                                state.walls as WallConnectionData[]
                            );
                        return (
                            <group
                                key={
                                    wall.id
                                }
                            >
                                {}
                                {
                                    pieces.map(
                                        (
                                            piece,
                                            index
                                        ) => (
                                            <WallPiece
                                                key={
                                                    `${wall.id}-${index}`
                                                }
                                                wallId={
                                                    wall.id
                                                }
                                                piece={
                                                    piece
                                                }
                                                finishSides={
                                                    finishSides
                                                }
                                            />
                                        )
                                    )
                                }
                                {}
                                <WallOutline
                                    start={
                                        wallStart
                                    }
                                    end={
                                        wallEnd
                                    }
                                    height={
                                        state.wallHeight
                                    }
                                    thickness={
                                        state.wallThickness
                                    }
                                    connectedStart={
                                        connectedStart
                                    }
                                    connectedEnd={
                                        connectedEnd
                                    }
                                />
                            </group>
                        );
                    }
                )
            }
        </group>
    );
}
export default memo(
    Walls
);
