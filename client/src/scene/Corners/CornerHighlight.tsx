import { Sphere } from "@react-three/drei";
import type { AlignmentGuide } from "../../engine/walls/Alignment";
import useEditor from "../../context/editor/useEditor";

interface CornerHighlightProps {
    guides: AlignmentGuide[];
}

export default function CornerHighlight({ guides }: CornerHighlightProps) {
    const { state } = useEditor();

    // Get unique corner IDs from guides
    const cornerIds = new Set(guides.map(g => g.cornerId));

    return (
        <>
            {Array.from(cornerIds).map(cornerId => {
                const corner = state.corners.find(c => c.id === cornerId);
                if (!corner) return null;

                return (
                    <Sphere
                        key={cornerId}
                        position={[corner.position.x, 0.15, corner.position.z]}
                        args={[0.15, 16, 16]}
                    >
                        <meshStandardMaterial color="#FFD700" emissive="#FFA500" />
                    </Sphere>
                );
            })}
        </>
    );
}
