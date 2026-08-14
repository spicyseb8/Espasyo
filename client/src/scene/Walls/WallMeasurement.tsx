import useEditor from "../../context/editor/useEditor";

import WallMeasurement from "../Preview/WallMeasurement";
import { buildWallMeasurementGroups } from "../../engine/walls/Measurement";

export default function WallMeasurements() {

    const { state } = useEditor();

    if (!state.showWallMeasurements) {
        return null;
    }

    const measurements = buildWallMeasurementGroups(state.walls, state.wallHeight);

    return (

        <>

            {measurements.map((measurement) => (

                <WallMeasurement

                    key={measurement.id}

                    start={measurement.start}
                    end={measurement.end}
                    length={measurement.length}
                />

            ))}

        </>

    );

}