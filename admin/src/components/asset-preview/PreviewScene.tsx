import PreviewCanvas from "./PreviewCanvas";
import type { Asset } from "@/services/assets/asset-types";

export default function PreviewScene({
  asset = null,
}: {
  asset?: Asset | null;
}) {
  return (
    <div className="h-full w-full overflow-hidden bg-[#dfe0de]">
      <PreviewCanvas asset={asset} />
    </div>
  );
}