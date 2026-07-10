import useEditor from "../../context/editor/useEditor";

import Floor from "./Floor";

import { solveRegions } from "../../engine/regions/RegionSolver";

export default function Floors() {

    const { state } = useEditor();

    const regions = solveRegions(
        state.corners,
        state.walls
    );

    return (

        <>

            {regions.map((region, index) => (

                <Floor

                    key={index}

                    polygon={region.corners}

                />

            ))}

        </>

    );

}