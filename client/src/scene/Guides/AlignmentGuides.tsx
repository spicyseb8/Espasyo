import { Line } from "@react-three/drei";
import type { AlignmentGuide } from "../../engine/walls/Alignment";

interface AlignmentGuidesProps {
    guides: AlignmentGuide[];
}

export default function AlignmentGuides({ guides }: AlignmentGuidesProps) {
    return (
        <>
            {guides.map((guide, index) => (
                <Line
                    key={`${guide.cornerId}-${guide.direction}-${index}`}
                    points={[
                        [guide.start.x, 0.01, guide.start.z],
                        [guide.end.x, 0.01, guide.end.z]
                    ]}
                    color={guide.direction === "horizontal" ? "#FF6B6B" : "#4ECDC4"}
                    lineWidth={2}
                    dashed={false}
                />
            ))}
        </>
    );
}