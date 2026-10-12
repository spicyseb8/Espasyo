import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AssetCardProps {
  preview?: ReactNode;
  title: string;
  categories: string[]; // only the first 1-2 are shown
  className?: string;
}

export default function AssetCard({
  preview,
  title,
  categories,
  className,
}: AssetCardProps) {
  const visibleCategories = categories.slice(0, 2);

  return (
    <div
      className={cn(
        "w-full max-w-64 rounded-2xl bg-white p-1.5 shadow-[0_10px_25px_-8px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      <div className="h-44 w-full overflow-hidden rounded-xl bg-neutral-100">
        {preview ?? (
          <div className="flex h-44 w-full items-center justify-center">
            <span className="text-xs text-neutral-400">No preview</span>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between px-1.5">
        <h3 className="text-sm font-semibold text-neutral-900">
          {title}
        </h3>
      </div>

      {visibleCategories.length > 0 && (
        <div className="mb-1 mt-1.5 flex flex-wrap gap-1 px-1.5">
          {visibleCategories.map((category) => (
            <span
              key={category}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500"
            >
              {category}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}