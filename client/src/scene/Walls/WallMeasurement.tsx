
import useEditor from "../../context/editor/useEditor";
import WallMeasurement from "../Preview/WallMeasurement";
import { buildWallMeasurementGroups } from "../../engine/walls/Measurement";

export default function WallMeasurements() {
    const { state } = useEditor();
    const selectedWallId = state.selectedWallId;

    if (!selectedWallId || state.walkthroughMode) {
        return null;
    }

    const measurements = buildWallMeasurementGroups(
        state.walls,
        state.wallHeight,
        state.wallThickness
    );

    const selectedMeasurements = measurements.filter((measurement) => {
        if (measurement.id === selectedWallId) {
            return true;
        }

        return measurement.walls?.some(
            (wall) => wall.id === selectedWallId
        );
    });

    return (
        <>
            {selectedMeasurements.map((measurement) => (
                <WallMeasurement
                    key={measurement.id}
                    measurement={measurement}
                />
            ))}
        </>
    );
}
