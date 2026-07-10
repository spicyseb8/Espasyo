import { useThree, useFrame } from "@react-three/fiber";
import { useEffect } from "react";

import useEditor from "../../context/editor/useEditor";
import { Tool } from "../../context/editor/tools";

export default function WallDrawer() {

    const { state } = useEditor();

    const { camera, pointer } = useThree();

    useFrame(() => {

        if (state.activeTool !== Tool.Wall)
            return;

        // Temporary
        console.log(
            "Mouse:",
            pointer.x.toFixed(2),
            pointer.y.toFixed(2)
        );

    });

    return null;
}