import { Sphere } from "@react-three/drei";
import type { AlignmentGuide } from "../../engine/walls/Alignment";
import useEditor from "../../context/editor/useEditor";

interface CornerHighlightProps {
    guides: AlignmentGuide[];
}

export default function CornerHighlight({
    guides,
}: CornerHighlightProps) {

    const { state } = useEditor();

    // Keep one guide per corner
    const cornerGuideMap = new Map<string, AlignmentGuide>();

    guides.forEach((guide) => {
        const existing = cornerGuideMap.get(guide.cornerId);

        // Prefer an aligned guide if one exists
        if (!existing || guide.aligned) {
            cornerGuideMap.set(guide.cornerId, guide);
        }
    });

    return (
        <>
            {Array.from(cornerGuideMap.entries()).map(
                ([cornerId, guide]) => {

                    const corner = state.corners.find(
                        c => c.id === cornerId
                    );

                    if (!corner) return null;

                    const color = guide.aligned
                        ? "#22C55E"     // Green
                        : "#4DA3FF";    // Blue

                    return (
                        <Sphere
                            key={cornerId}
                            position={[
                                corner.position.x,
                                0.15,
                                corner.position.z,
                            ]}
                            args={[0.15, 16, 16]}
                        >
                            <meshStandardMaterial
                                color={color}
                                emissive={color}
                                emissiveIntensity={0.8}
                            />
                        </Sphere>
                    );
                }
            )}
        </>
    );
}