import { Grid } from "@react-three/drei";

export default function SceneGrid() {

    return (

        <Grid

            position={[0, -0.01, 0]}

            args={[100, 100]}

            cellSize={1}

            cellThickness={1}

            cellColor="#BDBDBD"

            sectionSize={1}

            sectionThickness={1}

            sectionColor="#BDBDBD"

            fadeDistance={100}

            fadeStrength={1}


        />

    );

}