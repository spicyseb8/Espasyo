import { useMemo } from "react";

import useEditor from "../../context/editor/useEditor";

import Floor from "./Floor";

import { solveRegions } from "../../engine/regions/RegionSolver";

export default function Floors() {

    const { state } = useEditor();

    const regions = useMemo(() => {

        const filteredRegions = solveRegions(
            state.corners,
            state.walls
        ).filter(region => {
            const area = Math.abs(region.area || 0);
            return region.corners.length >= 3 && area > 0.01;
        });

        return filteredRegions;

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