import { useEffect, useMemo, useState } from "react";

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import AssetCard from "@/components/ui/assert-card";
import { Button } from "@/components/ui/button";
import AssetThumbnail from "../../asset-preview/AssetThumbnail";
import PreviewScene from "@/components/asset-preview/PreviewScene";
import CreateAssetModal from "@/components/createfunc/CreateAssetModal";
import { loadTexture } from "@/components/asset-preview/assetPreviewUtils";

import { getFurnitureAssets } from "@/services/assets/furniture";
import { getWallAssets } from "@/services/assets/walls";
import { getFloorAssets } from "@/services/assets/floors";
import { updateAsset } from "@/services/assets/update";
import { invalidateAssetCacheSources } from "@/lib/assetLibraryCache";

import type {
  Asset,
  AssetType,
  AssetStatus,
} from "@/services/assets/asset-types";

import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { deleteAsset } from "@/services/assets/deleteAsset";
import { removeCachedDoorWindowAsset } from "@/services/assets/FirebaseDoorWindowLibrary";
import { removeCachedFloorMaterial } from "@/services/assets/floorsload";
import { removeCachedFurnitureAsset } from "@/services/assets/furnitureload";

interface AssetLibraryProps {
  type: AssetType;
  onTypeChange?: (type: AssetType) => void;
}

const ASSET_TYPES: {
  value: AssetType;
  label: string;
}[] = [
  { value: "furniture", label: "Furniture" },
  { value: "wall", label: "Wall" },
  { value: "floor", label: "Floor" },
];

const getTitle = (type: AssetType) =>
  ASSET_TYPES.find((option) => option.value === type)?.label ?? "";

export default function AssetLibrary({
  type,
  onTypeChange,
}: AssetLibraryProps) {
  const { role } = useAuth();

  const canCreateAssets = role === "superadmin";

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailPage, setDetailPage] = useState<1 | 2>(1);

  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  // Flooring dimensions are measured in meters.
  // Existing assets without dimensions start with blank fields.
  const [editLength, setEditLength] = useState("");
  const [editWidth, setEditWidth] = useState("");

  const [editStatus, setEditStatus] =
    useState<AssetStatus>("available");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createNotice, setCreateNotice] = useState("");

  const assetsPerPage = 20;

  //==================================================
  // LOAD ASSETS
  //==================================================

  useEffect(() => {
    async function loadAssets() {
      setLoading(true);
      setError(null);
      setAssets([]);
      setSelectedAsset(null);
      setCurrentPage(1);
      setCategoryFilter("all");
      setDetailPage(1);

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

        data.forEach((asset) => {
          if (
            (asset.asset_type === "floor" ||
              asset.asset_type === "wall") &&
            asset.diffuse_path
          ) {
            loadTexture(asset.diffuse_path, {
              repeat: [1, 1],
              anisotropy: 8,
              cacheable: asset.asset_status?.trim().toLowerCase() === "available",
            });
          }
        });
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

  //==================================================
  // FILTER AND PAGINATION
  //==================================================

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(
        assets
          .map((asset) => asset.category)
          .filter(Boolean)
      )
    );

    return unique.sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const filtered = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return assets.filter((asset) => {
      const matchesCategory =
        categoryFilter === "all" ||
        asset.category === categoryFilter;

      const matchesSearch =
        !searchValue ||
        asset.name.toLowerCase().includes(searchValue) ||
        asset.category.toLowerCase().includes(searchValue);

      return matchesCategory && matchesSearch;
    });
  }, [assets, search, categoryFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / assetsPerPage)
  );

  const startIndex = (currentPage - 1) * assetsPerPage;

  const paginatedAssets = filtered.slice(
    startIndex,
    startIndex + assetsPerPage
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value: string | null) => {
    if (value === null) return;

    setCategoryFilter(value);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleTypeChange = (value: AssetType) => {
    setSearch("");
    setCategoryFilter("all");
    setCurrentPage(1);
    setDetailPage(1);

    onTypeChange?.(value);
  };

  //==================================================
  // SELECT AND EDIT ASSET
  //==================================================

  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setSaveError(null);

    setEditName(asset.name);
    setEditPrice(String(asset.price));

    setEditLength(
      asset.length == null ? "" : String(asset.length)
    );

    setEditWidth(
      asset.width == null ? "" : String(asset.width)
    );

    setEditStatus(asset.asset_status ?? "available");
    setDetailPage(1);
  };

  const handleNext = () => {
    if (!selectedAsset) return;

    setSaveError(null);
    setEditName(selectedAsset.name);
    setEditPrice(String(selectedAsset.price));

    setEditLength(
      selectedAsset.length == null
        ? ""
        : String(selectedAsset.length)
    );

    setEditWidth(
      selectedAsset.width == null
        ? ""
        : String(selectedAsset.width)
    );

    setEditStatus(
      selectedAsset.asset_status ?? "available"
    );

    setDetailPage(2);
  };

  const handleDiscard = () => {
    if (!selectedAsset) return;

    setSaveError(null);
    setEditName(selectedAsset.name);
    setEditPrice(String(selectedAsset.price));

    setEditLength(
      selectedAsset.length == null
        ? ""
        : String(selectedAsset.length)
    );

    setEditWidth(
      selectedAsset.width == null
        ? ""
        : String(selectedAsset.width)
    );

    setEditStatus(
      selectedAsset.asset_status ?? "available"
    );

    setDetailPage(1);
  };

  //==================================================
  // SAVE ASSET
  //==================================================

  const handleSave = async () => {
    if (!selectedAsset) return;

    const trimmedName = editName.trim();
    const numericPrice = Number(editPrice);

    setSaveError(null);

    if (!trimmedName) {
      setSaveError("Asset name is required.");
      return;
    }

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice < 0
    ) {
      setSaveError(
        "Price must be a valid number that is 0 or greater."
      );
      return;
    }

    // Dimensions are required only for floor assets.
    let floorDimensions:
      | {
          length: number;
          width: number;
        }
      | undefined;

    if (selectedAsset.asset_type === "floor") {
      const numericLength = Number(editLength);
      const numericWidth = Number(editWidth);

      if (
        !editLength.trim() ||
        !Number.isFinite(numericLength) ||
        numericLength <= 0
      ) {
        setSaveError(
          "Floor length must be greater than 0 meters."
        );
        return;
      }

      if (
        !editWidth.trim() ||
        !Number.isFinite(numericWidth) ||
        numericWidth <= 0
      ) {
        setSaveError(
          "Floor width must be greater than 0 meters."
        );
        return;
      }

      floorDimensions = {
        length: numericLength,
        width: numericWidth,
      };
    }

    try {
      setSaving(true);

      await updateAsset(selectedAsset.id, {
        name: trimmedName,
        price: numericPrice,
        asset_status: editStatus,
        ...(floorDimensions ?? {}),
      });

      let cacheWarning = false;
      if (
        selectedAsset.asset_status !== editStatus &&
        editStatus !== "available"
      ) {
        try {
          await invalidateAssetCacheSources(selectedAsset);
        } catch (error) {
          console.error("Failed to clear the unpublished asset cache:", error);
          cacheWarning = true;
        }
      }

      const updatedAsset: Asset = {
        ...selectedAsset,
        name: trimmedName,
        price: numericPrice,
        asset_status: editStatus,
        ...(floorDimensions ?? {}),
      };

      setSelectedAsset(updatedAsset);

      setAssets((current) =>
        current.map((asset) =>
          asset.id === updatedAsset.id
            ? updatedAsset
            : asset
        )
      );

      setDetailPage(1);
      setSaveError(
        cacheWarning
          ? "Changes were saved, but this browser could not clear the cached asset preview."
          : ""
      );
    } catch (err) {
      console.error("Failed to update asset:", err);

      setSaveError(
        "Failed to save changes. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAsset || !canCreateAssets) return;

    const assetToDelete = selectedAsset;
    setDeleteError(null);
    setDeleting(true);

    try {
      await deleteAsset(assetToDelete.id);

      let cacheWarning = false;
      try {
        await invalidateAssetCacheSources(assetToDelete);
      } catch (cacheError) {
        console.error("Failed to clear the deleted asset cache:", cacheError);
        cacheWarning = true;
      }

      removeCachedFurnitureAsset(assetToDelete.id);
      removeCachedFloorMaterial(assetToDelete.id);
      removeCachedDoorWindowAsset(assetToDelete.id);

      setAssets((current) =>
        current.filter((asset) => asset.id !== assetToDelete.id)
      );
      setSelectedAsset(null);
      setDetailPage(1);
      setDeleteConfirmOpen(false);
      setCreateNotice(
        cacheWarning
          ? `${assetToDelete.name} was deleted. This browser could not clear its cached preview.`
          : `${assetToDelete.name} was deleted.`
      );
    } catch (error) {
      console.error("Failed to delete asset:", error);
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Failed to delete asset."
      );
    } finally {
      setDeleting(false);
    }
  };

  //==================================================
  // RENDER
  //==================================================

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

          {createNotice && (
            <p
              role="status"
              className="mt-1 text-xs text-muted-foreground"
            >
              {createNotice}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canCreateAssets && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setCreateNotice("");
                setCreateOpen(true);
              }}
            >
              <Plus />
              Create
            </Button>
          )}

          <Select
            value={categoryFilter}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger className="w-36 bg-background">
              <SelectValue placeholder="Category" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                All Categories
              </SelectItem>

              {categories.map((category) => (
                <SelectItem
                  key={category}
                  value={category}
                >
                  {category}
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

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Asset details panel */}
        <div className="w-72 shrink-0 overflow-hidden p-2">
          {!selectedAsset ? (
            <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
              Select an asset to preview
            </div>
          ) : detailPage === 1 ? (
            <div className="flex h-full flex-col">
              <div className="h-56 shrink-0 overflow-hidden rounded-2xl bg-muted">
                {selectedAsset.asset_type === "furniture" ? (
                  <AssetThumbnail asset={selectedAsset} staticPreview />
                ) : (
                  <PreviewScene asset={selectedAsset} />
                )}
              </div>

              <div className="mt-4">
                <h3 className="text-base font-semibold">
                  {selectedAsset.name}
                </h3>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Price
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    ${selectedAsset.price}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Category
                  </p>
                  <span className="mt-1 inline-flex max-w-full rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    <span className="truncate">
                      {selectedAsset.category}
                    </span>
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 items-center gap-4">
                <p className="text-xs text-muted-foreground">
                  Status
                </p>

                <p className="text-sm">
                  {selectedAsset.asset_status === "not_available"
                    ? "Not Available"
                    : "Available"}
                </p>
              </div>

              {/* Show existing flooring dimensions, if saved */}
              {selectedAsset.asset_type === "floor" && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Length
                    </p>
                    <p className="mt-1 text-sm">
                      {selectedAsset.length != null
                        ? `${selectedAsset.length} m`
                        : "Not set"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">
                      Width
                    </p>
                    <p className="mt-1 text-sm">
                      {selectedAsset.width != null
                        ? `${selectedAsset.width} m`
                        : "Not set"}
                    </p>
                  </div>
                </div>
              )}

              {deleteError && (
                <p className="mt-3 text-xs text-destructive" role="alert">
                  {deleteError}
                </p>
              )}

              <div className="mt-auto pt-4">
                <div className="flex gap-2">
                  {canCreateAssets && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteConfirmOpen(true);
                      }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <h3 className="text-base font-semibold">
                  Edit Asset
                </h3>

                <button
                  type="button"
                  onClick={() => setDetailPage(1)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Back
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-medium">
                    Asset Preview
                  </label>

                  <div className="h-36 overflow-hidden rounded-xl border border-border bg-muted">
                    <AssetThumbnail asset={selectedAsset} staticPreview />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">
                    Name
                  </label>

                  <Input
                    value={editName}
                    onChange={(event) =>
                      setEditName(event.target.value)
                    }
                    disabled={saving}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">
                      Price
                    </label>

                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={editPrice}
                      onChange={(event) =>
                        setEditPrice(event.target.value)
                      }
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium">
                      Status
                    </label>

                    <Select
                      value={editStatus}
                      onValueChange={(value) =>
                        setEditStatus(value as AssetStatus)
                      }
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="available">
                          Available
                        </SelectItem>

                        <SelectItem value="not_available">
                          Not Available
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Flooring-only dimension inputs */}
                {selectedAsset.asset_type === "floor" && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="mb-1 text-xs font-medium">
                      Flooring Dimensions *
                    </p>

                    <p className="mb-3 text-xs text-muted-foreground">
                      Enter the flooring piece length and width in meters.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label
                          htmlFor="edit-floor-length"
                          className="text-xs font-medium"
                        >
                          Length (m) *
                        </label>

                        <Input
                          id="edit-floor-length"
                          type="number"
                          min="0.01"
                          step="any"
                          value={editLength}
                          onChange={(event) =>
                            setEditLength(event.target.value)
                          }
                          placeholder="Enter length"
                          disabled={saving}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="edit-floor-width"
                          className="text-xs font-medium"
                        >
                          Width (m) *
                        </label>

                        <Input
                          id="edit-floor-width"
                          type="number"
                          min="0.01"
                          step="any"
                          value={editWidth}
                          onChange={(event) =>
                            setEditWidth(event.target.value)
                          }
                          placeholder="Enter width"
                          disabled={saving}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">
                      Category
                    </label>

                    <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                      {selectedAsset.category}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium">
                      Asset Type
                    </label>

                    <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm capitalize text-muted-foreground">
                      {selectedAsset.asset_type}
                    </div>
                  </div>
                </div>

                {(selectedAsset.color ||
                  selectedAsset.roughness != null ||
                  selectedAsset.metalness != null) && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="mb-2 text-xs font-medium">
                      Material
                    </p>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {selectedAsset.color && (
                        <div>
                          <p className="text-muted-foreground">
                            Color
                          </p>
                          <p className="mt-1">
                            {selectedAsset.color}
                          </p>
                        </div>
                      )}

                      {selectedAsset.roughness != null && (
                        <div>
                          <p className="text-muted-foreground">
                            Roughness
                          </p>
                          <p className="mt-1">
                            {selectedAsset.roughness}
                          </p>
                        </div>
                      )}

                      {selectedAsset.metalness != null && (
                        <div>
                          <p className="text-muted-foreground">
                            Metalness
                          </p>
                          <p className="mt-1">
                            {selectedAsset.metalness}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(selectedAsset.storage_path ||
                  selectedAsset.diffuse_path) && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="mb-2 text-xs font-medium">
                      Files
                    </p>

                    <div className="space-y-2 text-xs">
                      {selectedAsset.storage_path && (
                        <div>
                          <p className="text-muted-foreground">
                            Model
                          </p>
                          <p className="break-all">
                            {selectedAsset.storage_path}
                          </p>
                        </div>
                      )}

                      {selectedAsset.diffuse_path && (
                        <div>
                          <p className="text-muted-foreground">
                            Diffuse
                          </p>
                          <p className="break-all">
                            {selectedAsset.diffuse_path}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {saveError && (
                <p className="mt-3 shrink-0 text-xs text-destructive">
                  {saveError}
                </p>
              )}

              <div className="mt-3 flex shrink-0 gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleDiscard}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Discard
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setConfirmOpen(true)}
                  className="flex-1 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>

        <Separator orientation="vertical" className="h-auto" />

        {/* Asset catalog */}
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
                    onClick={() => handleSelectAsset(asset)}
                    className={`rounded-3xl text-left transition-shadow ${
                      selectedAsset?.id === asset.id
                        ? "ring-2 ring-offset-2 ring-[#6b8050]"
                        : ""
                    }`}
                  >
                    <AssetCard
                      preview={<AssetThumbnail asset={asset} staticPreview />}
                      title={asset.name}
                      categories={[asset.category]}
                      className="max-w-none"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

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

      {/* Confirm save dialog */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Save changes?
            </AlertDialogTitle>

            <AlertDialogDescription>
              Are you sure you want to save these changes to{" "}
              <strong>{selectedAsset?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={saving}
              onClick={async (event) => {
                event.preventDefault();
                setConfirmOpen(false);
                await handleSave();
              }}
            >
              {saving ? "Saving..." : "Yes, Save Changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (!deleting) setDeleteConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this asset?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedAsset?.name}</strong> and its stored files will be
              permanently deleted. Saved projects that reference it will omit
              the deleted asset when they are loaded.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (event) => {
                event.preventDefault();
                await handleDelete();
              }}
            >
              {deleting ? "Deleting..." : "Delete Asset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create asset modal */}
      {canCreateAssets && (
        <CreateAssetModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(createdAsset) => {
            setCreateOpen(false);

            if (createdAsset.asset_type === type) {
              setAssets((current) => [
                createdAsset,
                ...current,
              ]);

              handleSelectAsset(createdAsset);

              setCreateNotice(
                `${createdAsset.name} was created.`
              );
            } else if (onTypeChange) {
              handleTypeChange(createdAsset.asset_type);
            } else {
              setCreateNotice(
                `${createdAsset.name} was created. Select ${getTitle(
                  createdAsset.asset_type
                )} in the sidebar to view it.`
              );
            }
          }}
        />
      )}
    </div>
  );
}