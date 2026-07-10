import useEditor from "../../context/editor/useEditor";

import WallMeasurement from "../Preview/WallMeasurement";
import { buildMeasurementGroups } from "../../engine/walls/Measurement";

export default function WallMeasurements() {

    const { state } = useEditor();

    const groups = buildMeasurementGroups(state.walls);

    return (

        <>

            {groups.map((group) => (

                <WallMeasurement

                    key={`${group.start.id}-${group.end.id}`}

                    start={group.start.position}

                    end={group.end.position}

                    length={group.length}

                />

            ))}

        </>

    );

}