import useEditor from "../../context/editor/useEditor";

import { Tool } from "../../context/editor/tools";

import WallMeasurement from "../Preview/WallMeasurement";

import {

    buildMeasurementGroups

} from "../../engine/walls/Measurement";

export default function WallMeasurements() {

    const { state } = useEditor();

    //----------------------------------------
    // Preview handled inside WallDrawer
    //----------------------------------------

    if (

        state.activeTool === Tool.Wall

    ) {

        return null;

    }

    //----------------------------------------
    // Hidden
    //----------------------------------------

    if (

        !state.showWallMeasurements &&

        !state.selectedWallId

    ) {

        return null;

    }

    const groups = buildMeasurementGroups(

        state.walls

    );

    //----------------------------------------
    // Selected wall only
    //----------------------------------------

    if (state.selectedWallId) {

        const group = groups.find(

            g =>

                g.walls.some(

                    wall =>

                        wall.id === state.selectedWallId

                )

        );

        if (!group)
            return null;

        return (

            <WallMeasurement

                measurement={group}

            />

        );

    }

    //----------------------------------------
    // Show all
    //----------------------------------------

    return (

        <>

            {

                groups.map(group => (

                    <WallMeasurement

                        key={

                            `${group.start.id}-${group.end.id}`

                        }

                        measurement={group}

                    />

                ))

            }

        </>

    );

}