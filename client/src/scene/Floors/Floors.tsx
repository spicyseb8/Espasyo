import { useMemo } from "react";

import useEditor from "../../context/editor/useEditor";

import Floor from "./Floor";

import { solveRegions } from "../../engine/regions/RegionSolver";

export default function Floors() {

    const { state } = useEditor();

    const regions = useMemo(() => {

        return solveRegions(
            state.corners,
            state.walls
        );

    }, [
        state.corners,
        state.walls,
    ]);

    return (
        <>
            {regions.map(region => (
                <Floor
                    key={region.id}
                    region={region}
                />
            ))}
        </>
    );
}