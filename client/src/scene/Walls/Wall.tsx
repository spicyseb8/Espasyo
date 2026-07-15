import { memo, useState } from "react";
import useEditor from "../../context/editor/useEditor";
import type { Wall as WallType } from "../../engine/walls";

function WallComponent({
    wall,
}: {
    wall: WallType;
}) {

    const { state, dispatch } = useEditor();

    const [hovered, setHovered] = useState(false);

    const selected = state.selectedWallId === wall.id;

    // Global settings
    const height = state.wallHeight;
    const thickness = state.wallThickness;

    const dx =
        wall.end.position.x -
        wall.start.position.x;

    const dz =
        wall.end.position.z -
        wall.start.position.z;

    const length = Math.sqrt(
        dx * dx +
        dz * dz
    );

    const angle = Math.atan2(
        dz,
        dx
    );

    const centerX =
        (
            wall.start.position.x +
            wall.end.position.x
        ) / 2;

    const centerZ =
        (
            wall.start.position.z +
            wall.end.position.z
        ) / 2;

    return (

        <mesh
            position={[
                centerX,
                height / 2,
                centerZ
            ]}
            rotation={[
                0,
                -angle,
                0
            ]}
            // Tag this mesh with its wall id so raycasts (WallDrawer's
            // click/hover picking via hitWallByRaycast) can identify
            // which wall was actually intercepted by the ray.
            userData={{
                wallId: wall.id
            }}
            onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(true);
            }}
            onPointerOut={() => {
                setHovered(false);
            }}
            onClick={(e) => {
                e.stopPropagation();

                dispatch({
                    type: "SELECT_WALL",
                    payload: wall.id
                });
            }}
        >

            <boxGeometry
                args={[
                    length,
                    height,
                    thickness
                ]}
            />

            <meshStandardMaterial
                color={
                    selected
                        ? "#2196F3"
                        : hovered
                        ? "#8CC8FF"
                        : "#D9D9D9"
                }
            />

        </mesh>

    );
}

export default memo(WallComponent);