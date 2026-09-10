import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import AssetCard from "@/components/ui/assert-card";

interface Asset {
  id: string;
  name: string;
  price: string;
  image: string;
  description: string;
  categories: string[];
}

type AssetType = "furniture" | "materials" | "textures";

interface AssetLibraryProps {
  type: AssetType;
  onTypeChange?: (type: AssetType) => void;
}

/*
 * Central place for the asset-type options shown in the Select.
 * Swap these when materials/textures become walls/floors.
 */
const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "furniture", label: "Furniture" },
  { value: "materials", label: "Materials" },
  { value: "textures", label: "Textures" },
];

/*
 * Placeholder data — swap for Firestore once the layout is approved.
 */
const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80";

const placeholderAssets: Asset[] = Array.from({ length: 20 }, (_, index) => ({
  id: `asset-${index + 1}`,
  name: "Ice Matcha",
  price: "10$",
  image: PLACEHOLDER_IMAGE,
  description:
    "A refreshing iced matcha made with stone-ground green tea, fresh milk, and a hint of vanilla. Served over ice with mint leaves.",
  categories: ["Matcha", "Ice cream", "Honey", "Milk"],
}));

function getTitle(type: AssetType) {
  return ASSET_TYPES.find((option) => option.value === type)?.label ?? "";
}

export default function AssetLibrary({ type, onTypeChange }: AssetLibraryProps) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(
    placeholderAssets[0]
  );

  const assetsPerPage = 20;

  const filtered = placeholderAssets.filter((asset) =>
    `${asset.name} ${asset.categories.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / assetsPerPage)
  );

  const startIndex = (currentPage - 1) * assetsPerPage;

  const paginatedAssets = filtered.slice(
    startIndex,
    startIndex + assetsPerPage
  );

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-lg border border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">{getTitle(type)}</h2>

          <p className="text-xs text-muted-foreground">
            Manage {getTitle(type).toLowerCase()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={type}
            onValueChange={(value) => onTypeChange?.(value as AssetType)}
          >
            <SelectTrigger className="w-36 bg-background">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {ASSET_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder={`Search ${getTitle(type).toLowerCase()}...`}
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            className="w-64 bg-background"
          />
        </div>
      </div>

      {/* Body: fixed left preview + scrollable right catalogue */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: selected asset preview */}
        <div className="w-72 shrink-0 overflow-y-auto p-4">
          {selectedAsset ? (
            <div>
              <div className="overflow-hidden rounded-2xl bg-[#a9c08f]">
                <img
                  src={selectedAsset.image}
                  alt={selectedAsset.name}
                  className="h-56 w-full object-cover"
                />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">
                  {selectedAsset.name}
                </h3>

                <span className="text-base font-semibold underline underline-offset-2">
                  {selectedAsset.price}
                </span>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {selectedAsset.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedAsset.categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
              Select an asset to preview
            </div>
          )}
        </div>

        <Separator orientation="vertical" className="h-auto" />

        {/* Right: scrollable card catalogue */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {paginatedAssets.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No {getTitle(type).toLowerCase()} found.
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-4">
                {paginatedAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedAsset(asset)}
                    className={`rounded-3xl text-left transition-shadow ${
                      selectedAsset?.id === asset.id
                        ? "ring-2 ring-offset-2 ring-[#6b8050]"
                        : ""
                    }`}
                  >
                    <AssetCard
                      image={asset.image}
                      title={asset.name}
                      categories={asset.categories}
                      className="max-w-none"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {filtered.length > 0
                ? `Showing ${startIndex + 1}-${Math.min(
                    startIndex + assetsPerPage,
                    filtered.length
                  )} of ${filtered.length}`
                : "Showing 0 of 0"}
            </p>

            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      goToPage(currentPage - 1);
                    }}
                    className={
                      currentPage === 1
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1
                ).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      isActive={currentPage === page}
                      onClick={(event) => {
                        event.preventDefault();
                        goToPage(page);
                      }}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      goToPage(currentPage + 1);
                    }}
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>
    </div>
  );
}