import { useEffect, useState } from "react";
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

import { getFurnitureAssets } from "@/services/assets/furniture";
import { getWallAssets } from "@/services/assets/walls";
import { getFloorAssets } from "@/services/assets/floors";

import type {
  Asset,
  AssetType,
} from "@/services/assets/asset-types";

interface AssetLibraryProps {
  type: AssetType;
  onTypeChange?: (type: AssetType) => void;
}

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "furniture", label: "Furniture" },
  { value: "wall", label: "Wall" },
  { value: "floor", label: "Floor" },
];

function getTitle(type: AssetType) {
  return (
    ASSET_TYPES.find((option) => option.value === type)?.label ?? ""
  );
}

export default function AssetLibrary({
  type,
  onTypeChange,
}: AssetLibraryProps) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(
    null
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assetsPerPage = 20;

  /*
   * Load assets from Firestore whenever
   * the selected asset type changes.
   */
  useEffect(() => {
    async function loadAssets() {
      setLoading(true);
      setError(null);
      setAssets([]);
      setSelectedAsset(null);
      setCurrentPage(1);

      try {
        let data: Asset[] = [];

        if (type === "furniture") {
          data = await getFurnitureAssets();
        }

        if (type === "wall") {
          data = await getWallAssets();
        }

        if (type === "floor") {
          data = await getFloorAssets();
        }

        setAssets(data);
      } catch (err) {
        console.error("Failed to load assets:", err);

        setAssets([]);
        setError("Failed to load assets.");
      } finally {
        setLoading(false);
      }
    }

    loadAssets();
  }, [type]);

  /*
   * Search/filter assets.
   */
  const filtered = assets.filter((asset) =>
    `${asset.name} ${asset.category}`
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

  const handleTypeChange = (value: AssetType) => {
    setSearch("");
    setCurrentPage(1);

    onTypeChange?.(value);
  };

  /*
   * Creates a simple color preview for assets
   * that don't have a thumbnail yet.
   */
  const getAssetImage = (asset: Asset) => {
    if (asset.thumbnail_path) {
      return asset.thumbnail_path;
    }

    if (asset.color) {
      const encodedColor = asset.color.replace("#", "%23");

      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='100%25' height='100%25' fill='${encodedColor}'/%3E%3C/svg%3E`;
    }

    return "";
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-lg border border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">
            {getTitle(type)}
          </h2>

          <p className="text-xs text-muted-foreground">
            Manage {getTitle(type).toLowerCase()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={type}
            onValueChange={(value) =>
              handleTypeChange(value as AssetType)
            }
          >
            <SelectTrigger className="w-36 bg-background">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {ASSET_TYPES.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder={`Search ${getTitle(type).toLowerCase()}...`}
            value={search}
            onChange={(event) =>
              handleSearch(event.target.value)
            }
            className="w-64 bg-background"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: selected asset preview */}
        <div className="w-72 shrink-0 overflow-y-auto p-4">
          {selectedAsset ? (
            <div>
              {/* Preview */}
              <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-muted">
                {selectedAsset.thumbnail_path ? (
                  <img
                    src={selectedAsset.thumbnail_path}
                    alt={selectedAsset.name}
                    className="h-full w-full object-cover"
                  />
                ) : selectedAsset.color ? (
                  <div
                    className="h-full w-full"
                    style={{
                      backgroundColor: selectedAsset.color,
                    }}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No preview available
                  </span>
                )}
              </div>

              {/* Name + price */}
              <div className="mt-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">
                  {selectedAsset.name}
                </h3>

                <span className="text-base font-semibold underline underline-offset-2">
                  ${selectedAsset.price}
                </span>
              </div>

              {/* Category */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {selectedAsset.category}
                </span>
              </div>

              {/* Color */}
              {selectedAsset.color && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">
                    Color
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-full border border-border"
                      style={{
                        backgroundColor: selectedAsset.color,
                      }}
                    />

                    <span className="text-sm">
                      {selectedAsset.color}
                    </span>
                  </div>
                </div>
              )}

              {/* Roughness */}
              {selectedAsset.roughness !== undefined && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">
                    Roughness
                  </p>

                  <p className="text-sm">
                    {selectedAsset.roughness}
                  </p>
                </div>
              )}

              {/* Metalness */}
              {selectedAsset.metalness !== undefined && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">
                    Metalness
                  </p>

                  <p className="text-sm">
                    {selectedAsset.metalness}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
              Select an asset to preview
            </div>
          )}
        </div>

        <Separator orientation="vertical" className="h-auto" />

        {/* Right: scrollable catalogue */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading {getTitle(type).toLowerCase()}...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center text-sm text-destructive">
                {error}
              </div>
            ) : paginatedAssets.length === 0 ? (
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
                      image={getAssetImage(asset)}
                      title={asset.name}
                      categories={[asset.category]}
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