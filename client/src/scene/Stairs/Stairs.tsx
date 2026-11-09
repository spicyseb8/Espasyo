import { useEffect, useMemo } from "react";
import { BoxGeometry, BufferGeometry, Quaternion, Vector3 } from "three";
import useEditor from "../../context/editor/useEditor";
import {
    calculateStaircaseGeometry,
    validateStaircaseDimensions,
    type ProceduralStaircaseData,
    type StaircaseGeometryBox,
    type StaircaseLandingData
} from "../../../../shared/staircaseGeometry.ts";

function boxKey(box: StaircaseGeometryBox): string {
    return `${box.size.x}:${box.size.y}:${box.size.z}`;
}

function ReadOnlyStaircase({ stair }: { stair: ProceduralStaircaseData }) {
    const geometry = useMemo(() => {
        if (
            !stair ||
            !stair.position ||
            ![stair.position.x, stair.position.y, stair.position.z, stair.rotationY]
                .every(Number.isFinite) ||
            validateStaircaseDimensions(stair)
        ) return null;
        return calculateStaircaseGeometry(stair);
    }, [stair]);
    const boxes = useMemo(() => {
        const geometries = new Map<string, BoxGeometry>();
        if (!geometry) return geometries;
        const allBoxes = [
            ...geometry.flights.flatMap(flight => [...flight.treads, ...flight.risers]),
            ...geometry.landings.map(landing => ({
                position: landing.center,
                size: landing.size
            }))
        ];
        for (const box of allBoxes) {
            const key = boxKey(box);
            if (!geometries.has(key)) {
                geometries.set(key, new BoxGeometry(box.size.x, box.size.y, box.size.z));
            }
        }
        return geometries;
    }, [geometry]);
    const railings = useMemo(() => geometry?.railings.map(segment => {
        const delta = new Vector3(
            segment.end.x - segment.start.x,
            segment.end.y - segment.start.y,
            segment.end.z - segment.start.z
        );
        return {
            geometry: new BoxGeometry(delta.length(), 0.05, 0.05),
            position: [
                (segment.start.x + segment.end.x) / 2,
                (segment.start.y + segment.end.y) / 2,
                (segment.start.z + segment.end.z) / 2
            ] as [number, number, number],
            quaternion: new Quaternion().setFromUnitVectors(
                new Vector3(1, 0, 0),
                delta.normalize()
            ),
            posts: segment.posts.map(post => post.position)
        };
    }) ?? [], [geometry]);
    const postGeometry = useMemo(() => new BoxGeometry(0.05, 0.9, 0.05), []);
    useEffect(() => () => {
        boxes.forEach(item => item.dispose());
        railings.forEach(item => item.geometry.dispose());
        postGeometry.dispose();
    }, [boxes, postGeometry, railings]);

    if (!geometry) return null;

    return (
        <group
            position={[stair.position.x, stair.position.y, stair.position.z]}
            rotation-y={stair.rotationY}
        >
            {geometry.flights.map(flight => (
                <group key={flight.id}>
                    {[...flight.treads, ...flight.risers].map((box, index) => (
                        <mesh
                            key={`${flight.id}-step-${index}`}
                            geometry={boxes.get(boxKey(box))}
                            position={[box.position.x, box.position.y, box.position.z]}
                            castShadow
                            receiveShadow
                        >
                            <meshStandardMaterial
                                color={index < flight.treads.length ? "#d8c8af" : "#a99174"}
                            />
                        </mesh>
                    ))}
                </group>
            ))}
            {geometry.landings.map((landing, index) => (
                <mesh
                    key={`landing-${index}`}
                    geometry={boxes.get(`${landing.size.x}:${landing.size.y}:${landing.size.z}`)}
                    position={[landing.center.x, landing.center.y, landing.center.z]}
                    castShadow
                    receiveShadow
                >
                    <meshStandardMaterial color="#d8c8af" />
                </mesh>
            ))}
            {stair.railings !== false && railings.map((railing, index) => (
                <group key={`railing-${index}`}>
                    <mesh
                        geometry={railing.geometry}
                        position={railing.position}
                        quaternion={railing.quaternion}
                        castShadow
                        receiveShadow
                    >
                        <meshStandardMaterial color="#725d48" />
                    </mesh>
                    {railing.posts.map((post, postIndex) => (
                        <mesh
                            key={`post-${postIndex}`}
                            geometry={postGeometry}
                            position={[post.x, post.y, post.z]}
                            castShadow
                            receiveShadow
                        >
                            <meshStandardMaterial color="#725d48" />
                        </mesh>
                    ))}
                </group>
            ))}
        </group>
    );
}

function ReadOnlyStaircaseLanding({
    landing,
    isEditing
}: {
    landing: StaircaseLandingData;
    isEditing: boolean;
}) {
    const outlineGeometry = useMemo(() => {
        const halfRun = landing.run / 2;
        const halfWidth = landing.width / 2;
        const chevronHalfLength = landing.run * 0.12;
        const chevronHalfWidth = landing.width * 0.18;
        const chevronSpacing = landing.run * 0.12;
        const firstChevronCenter = halfRun - chevronSpacing / 2;
        const secondChevronCenter = halfRun + chevronSpacing / 2;
        const geometry = new BufferGeometry().setFromPoints([
            new Vector3(0, 0.045, -halfWidth),
            new Vector3(landing.run, 0.045, -halfWidth),
            new Vector3(landing.run, 0.045, -halfWidth),
            new Vector3(landing.run, 0.045, halfWidth),
            new Vector3(landing.run, 0.045, halfWidth),
            new Vector3(0, 0.045, halfWidth),
            new Vector3(0, 0.045, halfWidth),
            new Vector3(0, 0.045, -halfWidth),
            new Vector3(
                firstChevronCenter - chevronHalfLength,
                0.05,
                -chevronHalfWidth
            ),
            new Vector3(firstChevronCenter + chevronHalfLength, 0.05, 0),
            new Vector3(firstChevronCenter + chevronHalfLength, 0.05, 0),
            new Vector3(
                firstChevronCenter - chevronHalfLength,
                0.05,
                chevronHalfWidth
            ),
            new Vector3(
                secondChevronCenter - chevronHalfLength,
                0.05,
                -chevronHalfWidth
            ),
            new Vector3(secondChevronCenter + chevronHalfLength, 0.05, 0),
            new Vector3(secondChevronCenter + chevronHalfLength, 0.05, 0),
            new Vector3(
                secondChevronCenter - chevronHalfLength,
                0.05,
                chevronHalfWidth
            )
        ]);
        return geometry;
    }, [landing.run, landing.width]);

    useEffect(() => () => outlineGeometry.dispose(), [outlineGeometry]);

    return (
        <group
            position={[landing.position.x, landing.position.y, landing.position.z]}
            rotation-y={landing.rotationY}
        >
            <mesh rotation-x={-Math.PI / 2} position={[landing.run / 2, 0.018, 0]}>
                <planeGeometry args={[landing.run, landing.width]} />
                <meshStandardMaterial
                    color="#b4a991"
                    transparent
                    opacity={isEditing ? 0.24 : 0.14}
                    roughness={1}
                    depthWrite={false}
                />
            </mesh>
            <lineSegments geometry={outlineGeometry} renderOrder={2}>
                <lineBasicMaterial
                    color={isEditing ? "#526875" : "#887c68"}
                    transparent={!isEditing}
                    opacity={isEditing ? 0.95 : 0.65}
                    depthTest={false}
                />
            </lineSegments>
        </group>
    );
}

export default function Stairs() {
    const { state } = useEditor();
    const isEditing = state.selectedAsset !== null || state.movingFurnitureId !== null;
    return (
        <>
            {state.stairs.map(stair => (
                <ReadOnlyStaircase key={stair.id} stair={stair} />
            ))}
            {state.stairLandings.map(landing => (
                <ReadOnlyStaircaseLanding
                    key={landing.id}
                    landing={landing}
                    isEditing={isEditing}
                />
            ))}
        </>
    );
}
