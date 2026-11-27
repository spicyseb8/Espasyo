import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import AssetThumbnail from "../../asset-preview/AssetThumbnail";
import PreviewScene from "@/components/asset-preview/PreviewScene";
import CreateAssetModal from "@/components/createfunc/CreateAssetModal";
import { loadTexture } from "@/components/asset-preview/assetPreviewUtils";

import { getFurnitureAssets } from "@/services/assets/furniture";
import { getWallAssets } from "@/services/assets/walls";
import { getFloorAssets } from "@/services/assets/floors";
import { updateAsset } from "@/services/assets/update";
import { refreshWallMaterials } from "@/services/assets/wallsload";
import {
  FURNITURE_CATEGORY_OPTIONS,
  FURNITURE_LEGACY_CATEGORIES,
  FURNITURE_SPECIAL_CATEGORIES,
  isOptionalFurniturePrice,
} from "@/services/assets/furnitureCategories";
import {
  metersToCentimeters,
  resolveMeterDimension,
} from "@/services/assets/flooringDimensions";
import { invalidateAssetCacheSources } from "@/lib/assetLibraryCache";

import type {
  Asset,
  AssetType,
  AssetStatus,
} from "@/services/assets/asset-types";

import {
  CheckCircle2,
  EyeOff,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { deleteAsset } from "@/services/assets/deleteAsset";
import { removeCachedDoorWindowAsset } from "@/services/assets/FirebaseDoorWindowLibrary";
import { removeCachedFloorMaterial } from "@/services/assets/floorsload";
import { removeCachedFurnitureAsset } from "@/services/assets/furnitureload";
import {
  floorDimensionToMeters,
  FLOOR_PATTERN_DEFINITIONS,
  isHerringboneTileRatio,
  isFloorPattern,
} from "../../../../../shared/flooring/patterns";
import type {
  FloorDimensionUnit,
  FloorPattern,
} from "../../../../../shared/flooring/patterns";

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

const getPriceInputValue = (asset: Asset) =>
  asset.asset_type === "floor"
    ? asset.pricePerPiece == null
      ? ""
      : String(asset.pricePerPiece)
    : asset.price == null
      ? ""
      : String(asset.price);

const metersToCentimetersInput = (value?: number | null) =>
  typeof value === "number" && Number.isFinite(value)
    ? String(metersToCentimeters(value))
    : "";

const formatPeso = (value: number) =>
  `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

const getPriceDisplay = (asset: Asset) => {
  if (asset.asset_type === "floor") {
    if (asset.pricePerPiece != null) {
      return {
        label: "Price per tile",
        value: formatPeso(asset.pricePerPiece),
      };
    }
    return {
      label: "Legacy price (per m²)",
      value: asset.price != null ? formatPeso(asset.price) : "Not set",
    };
  }
  return {
    label: "Price",
    value: asset.price != null ? formatPeso(asset.price) : "Price unavailable",
  };
};

const getCategoryLabel = (value: string) =>
  [
    ...FURNITURE_CATEGORY_OPTIONS,
    ...FURNITURE_SPECIAL_CATEGORIES,
    ...FURNITURE_LEGACY_CATEGORIES,
  ].find(([option]) => option === value)?.[1] ?? value;

type FormErrors = Partial<
  Record<"name" | "price" | "length" | "width" | "pattern", string>
>;

function StatusPill({ status }: { status?: AssetStatus | null }) {
  const unavailable = status === "not_available";
  const Icon = unavailable ? EyeOff : CheckCircle2;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        unavailable
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-emerald-300 bg-emerald-50 text-emerald-800"
      }`}
    >
      <Icon size={12} aria-hidden="true" />
      {unavailable ? "Not available" : "Available"}
    </span>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-b border-border py-6 last:border-b-0">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-message`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-message`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default function AssetLibrary({
  type,
  onTypeChange,
}: AssetLibraryProps) {
  const { role } = useAuth();

  const canManageAssets = role === "superadmin";

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailPage, setDetailPage] = useState<1 | 2>(1);

  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPrice, setEditPrice] = useState("");

  // Flooring dimensions are entered in centimeters.
  // Existing assets without dimensions start with blank fields.
  const [editLength, setEditLength] = useState("");
  const [editWidth, setEditWidth] = useState("");
  const [editFloorDimensionUnit, setEditFloorDimensionUnit] =
    useState<FloorDimensionUnit>("cm");
  const [editFloorPattern, setEditFloorPattern] =
    useState<FloorPattern>("stack-bond");
  const [editShareWithWalls, setEditShareWithWalls] = useState(false);

  const [editStatus, setEditStatus] =
    useState<AssetStatus>("available");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createNotice, setCreateNotice] = useState("");

  const assetsPerPage = 20;

  const selectedPreviewAsset = useMemo(() => {
    if (!selectedAsset) return null;

    const hasPhysicalTexture =
      selectedAsset.asset_type === "floor" ||
      selectedAsset.floorMaterialMode === "single-tile";
    if (!hasPhysicalTexture) return selectedAsset;

    const enteredLength = Number(editLength);
    const enteredWidth = Number(editWidth);
    const previewLength =
      editLength.trim() &&
      Number.isFinite(enteredLength) &&
      enteredLength > 0
        ? floorDimensionToMeters(enteredLength, editFloorDimensionUnit)
        : selectedAsset.length;
    const previewWidth =
      editWidth.trim() &&
      Number.isFinite(enteredWidth) &&
      enteredWidth > 0
        ? floorDimensionToMeters(enteredWidth, editFloorDimensionUnit)
        : selectedAsset.width;

    return {
      ...selectedAsset,
      floorPattern: editFloorPattern,
      length: previewLength,
      width: previewWidth,
    };
  }, [
    selectedAsset,
    editFloorPattern,
    editFloorDimensionUnit,
    editLength,
    editWidth,
  ]);

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

  const handleFloorDimensionUnitChange = (value: string | null) => {
    if (value !== "cm" && value !== "mm") return;
    if (value === editFloorDimensionUnit) return;

    const factor = value === "mm" ? 10 : 0.1;
    const convert = (current: string) => {
      if (!current.trim()) return current;
      const numeric = Number(current);
      return Number.isFinite(numeric)
        ? String(Number((numeric * factor).toFixed(6)))
        : current;
    };

    setEditLength(convert(editLength));
    setEditWidth(convert(editWidth));
    setEditFloorDimensionUnit(value);
  };

  //==================================================
  // SELECT AND EDIT ASSET
  //==================================================

  const resetForm = (asset: Asset) => {
    setSaveError(null);
    setShowErrors(false);

    setEditName(asset.name);
    setEditCategory(asset.category);
    setEditPrice(getPriceInputValue(asset));

    setEditLength(
      metersToCentimetersInput(asset.length)
    );

    setEditWidth(
      metersToCentimetersInput(asset.width)
    );
    setEditFloorDimensionUnit("cm");
    setEditFloorPattern(
      isFloorPattern(asset.floorPattern) ? asset.floorPattern : "stack-bond"
    );

    setEditStatus(asset.asset_status ?? "available");
    setEditShareWithWalls(asset.shareWithWalls === true);
  };

  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setDeleteError(null);
    resetForm(asset);
    setDetailPage(1);
  };

  const openEditor = () => {
    if (!selectedAsset) return;

    setCreateNotice("");
    resetForm(selectedAsset);
    setDetailPage(2);
  };

  //==================================================
  // FORM STATE
  //==================================================

  const hasPhysicalTexture =
    selectedAsset?.asset_type === "floor" ||
    selectedAsset?.floorMaterialMode === "single-tile";

  const optionalPrice =
    selectedAsset?.asset_type === "furniture" &&
    isOptionalFurniturePrice(editCategory);

  const getFormErrors = (): FormErrors => {
    const errors: FormErrors = {};
    if (!selectedAsset) return errors;

    const numericPrice = Number(editPrice);
    const hasPrice = editPrice.trim() !== "";

    if (!editName.trim()) {
      errors.name = "Asset name is required.";
    }

    if (
      (!optionalPrice && !hasPrice) ||
      (hasPrice &&
        (!Number.isFinite(numericPrice) || numericPrice < 0))
    ) {
      errors.price =
        selectedAsset.asset_type === "floor"
          ? "Enter a valid price per tile that is 0 or greater."
          : "Price must be a valid number that is 0 or greater.";
    }

    // Dimensions are required for floors and patterned wall textures.
    if (hasPhysicalTexture) {
      const numericLength = Number(editLength);
      const numericWidth = Number(editWidth);

      if (
        !editLength.trim() ||
        !Number.isFinite(numericLength) ||
        numericLength <= 0
      ) {
        errors.length = `Material length must be greater than 0 ${editFloorDimensionUnit}.`;
      }

      if (
        !editWidth.trim() ||
        !Number.isFinite(numericWidth) ||
        numericWidth <= 0
      ) {
        errors.width = `Material width must be greater than 0 ${editFloorDimensionUnit}.`;
      }

      if (
        !errors.length &&
        !errors.width &&
        selectedAsset.floorMaterialMode === "single-tile" &&
        editFloorPattern === "herringbone" &&
        !isHerringboneTileRatio(
          resolveMeterDimension(
            numericLength,
            selectedAsset.length,
            editFloorDimensionUnit
          ),
          resolveMeterDimension(
            numericWidth,
            selectedAsset.width,
            editFloorDimensionUnit
          )
        )
      ) {
        errors.pattern = "Herringbone requires material length to be twice its width.";
      }
    }

    return errors;
  };

  const formErrors = getFormErrors();
  const hasFormErrors = Object.keys(formErrors).length > 0;
  const visibleErrors: FormErrors = showErrors ? formErrors : {};

  // Compare sizes in meters so switching cm/mm is not counted as a change.
  const isSameSize = (entered: string, saved?: number | null) => {
    const initial = metersToCentimetersInput(saved);
    if (!initial || !entered.trim()) return initial === entered.trim();

    return (
      Math.abs(
        floorDimensionToMeters(Number(entered), editFloorDimensionUnit) -
          floorDimensionToMeters(Number(initial), "cm")
      ) < 1e-9
    );
  };

  const isDirty =
    selectedAsset !== null &&
    (editName !== selectedAsset.name ||
      editCategory !== selectedAsset.category ||
      editPrice !== getPriceInputValue(selectedAsset) ||
      editStatus !== (selectedAsset.asset_status ?? "available") ||
      (selectedAsset.asset_type === "floor" &&
        editShareWithWalls !== (selectedAsset.shareWithWalls === true)) ||
      (hasPhysicalTexture &&
        (!isSameSize(editLength, selectedAsset.length) ||
          !isSameSize(editWidth, selectedAsset.width))) ||
      (selectedAsset.floorMaterialMode === "single-tile" &&
        editFloorPattern !==
          (isFloorPattern(selectedAsset.floorPattern)
            ? selectedAsset.floorPattern
            : "stack-bond")));

  const closeEditor = () => {
    if (!selectedAsset || saving) return;
    if (
      canManageAssets &&
      isDirty &&
      !window.confirm("Discard your unsaved changes?")
    ) {
      return;
    }

    resetForm(selectedAsset);
    setDetailPage(1);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canManageAssets || saving || !isDirty) return;

    setSaveError(null);

    if (hasFormErrors) {
      setShowErrors(true);

      // Jump to the first field that needs attention.
      const fieldIds: Record<keyof FormErrors, string> = {
        name: "edit-asset-name",
        price: "edit-asset-price",
        length: "edit-floor-length",
        width: "edit-floor-width",
        pattern: "edit-floor-pattern",
      };
      const firstError = Object.keys(formErrors)[0] as keyof FormErrors;
      document.getElementById(fieldIds[firstError])?.focus();
      return;
    }

    setConfirmOpen(true);
  };

  //==================================================
  // SAVE ASSET
  //==================================================

  const handleSave = async () => {
    if (!selectedAsset || !canManageAssets) return;

    const trimmedName = editName.trim();
    const numericPrice = Number(editPrice);
    const hasPrice = editPrice.trim() !== "";

    setSaveError(null);

    if (hasFormErrors) {
      setShowErrors(true);
      return;
    }

    const floorDimensions = hasPhysicalTexture
      ? {
          length: resolveMeterDimension(
            Number(editLength),
            selectedAsset.length,
            editFloorDimensionUnit
          ),
          width: resolveMeterDimension(
            Number(editWidth),
            selectedAsset.width,
            editFloorDimensionUnit
          ),
        }
      : undefined;

    try {
      setSaving(true);

      await updateAsset(selectedAsset.id, {
        asset_type: selectedAsset.asset_type,
        name: trimmedName,
        category: editCategory,
        ...(selectedAsset.asset_type === "floor"
          ? { shareWithWalls: editShareWithWalls }
          : {}),
        ...(selectedAsset.asset_type === "floor"
          ? { pricePerPiece: numericPrice }
          : {
              price:
                optionalPrice && !hasPrice
                  ? undefined
                  : numericPrice,
            }),
        asset_status: editStatus,
        ...(floorDimensions ?? {}),
        ...(selectedAsset.floorMaterialMode === "single-tile"
          ? { floorPattern: editFloorPattern }
          : {}),
      });

      let cacheWarning = false;
      if (
        selectedAsset.asset_type === "floor" &&
        selectedAsset.shareWithWalls !== editShareWithWalls
      ) {
        try {
          await refreshWallMaterials();
        } catch (error) {
          console.error("Failed to refresh shared wall materials:", error);
          cacheWarning = true;
        }
      }

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
        category: editCategory,
        asset_status: editStatus,
        ...(selectedAsset.asset_type === "floor"
          ? { shareWithWalls: editShareWithWalls }
          : {}),
        ...(selectedAsset.asset_type === "floor"
          ? { pricePerPiece: numericPrice }
          : {
              price:
                optionalPrice && !hasPrice
                  ? undefined
                  : numericPrice,
            }),
        ...(floorDimensions ?? {}),
        ...(selectedAsset.floorMaterialMode === "single-tile"
          ? { floorPattern: editFloorPattern }
          : {}),
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
      setCreateNotice(
        cacheWarning
          ? "Changes were saved, but this browser could not clear the cached asset preview."
          : `Changes to ${trimmedName} were saved.`
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
    if (!selectedAsset || !canManageAssets) return;

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
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">
            {getTitle(type)}
          </h2>

          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading..."
              : `${assets.length} ${assets.length === 1 ? "asset" : "assets"} in this library`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label={`Search ${getTitle(type).toLowerCase()}`}
              placeholder={`Search ${getTitle(type).toLowerCase()}...`}
              value={search}
              onChange={(event) =>
                handleSearch(event.target.value)
              }
              className="w-64 bg-background pl-9"
            />
          </div>

          <Select
            value={categoryFilter}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger className="w-44 bg-background" aria-label="Filter by category">
              <SelectValue placeholder="Category">
                {categoryFilter === "all"
                  ? "All categories"
                  : getCategoryLabel(categoryFilter)}
              </SelectValue>
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                All categories
              </SelectItem>

              {categories.map((category) => (
                <SelectItem
                  key={category}
                  value={category}
                >
                  {getCategoryLabel(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canManageAssets && (
            <Button
              type="button"
              onClick={() => {
                setCreateNotice("");
                setCreateOpen(true);
              }}
            >
              <Plus />
              Create asset
            </Button>
          )}
        </div>
      </div>

      {createNotice && (
        <div
          role="status"
          className="flex items-center gap-2 border-b border-emerald-300 bg-emerald-50 px-6 py-2 text-sm text-emerald-900"
        >
          <CheckCircle2 size={16} aria-hidden="true" className="shrink-0" />
          <p className="flex-1">{createNotice}</p>
          <button
            type="button"
            onClick={() => setCreateNotice("")}
            aria-label="Dismiss message"
            className="rounded-sm p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Selected asset summary */}
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto p-5">
          {!selectedAsset ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 text-center">
              <Eye size={22} aria-hidden="true" className="text-muted-foreground" />
              <p className="text-sm font-medium">No asset selected</p>
              <p className="text-xs text-muted-foreground">
                Choose an asset to see its preview and details.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4">
              <div className="h-48 shrink-0 overflow-hidden rounded-2xl bg-muted">
                {/* Unmounted while editing so only one preview renders at a time */}
                {detailPage === 1 &&
                  (selectedAsset.asset_type === "furniture" ? (
                    <AssetThumbnail asset={selectedAsset} staticPreview />
                  ) : (
                    <PreviewScene asset={selectedAsset} />
                  ))}
              </div>

              <div className="space-y-2">
                <h3 className="break-words text-xl font-semibold">
                  {selectedAsset.name}
                </h3>
                <StatusPill status={selectedAsset.asset_status} />
              </div>

              <dl className="divide-y divide-border border-y border-border text-sm">
                {[
                  [
                    getPriceDisplay(selectedAsset).label,
                    getPriceDisplay(selectedAsset).value,
                  ],
                  ["Category", getCategoryLabel(selectedAsset.category)],
                  ...(hasPhysicalTexture
                    ? [
                        [
                          "Length",
                          selectedAsset.length != null
                            ? `${metersToCentimeters(selectedAsset.length)} cm`
                            : "Not set",
                        ],
                        [
                          "Width",
                          selectedAsset.width != null
                            ? `${metersToCentimeters(selectedAsset.width)} cm`
                            : "Not set",
                        ],
                      ]
                    : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words text-right font-medium">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-auto space-y-2">
                <Button type="button" className="w-full" onClick={openEditor}>
                  {canManageAssets ? <Pencil /> : <Eye />}
                  {canManageAssets ? "Edit asset" : "View details"}
                </Button>

                {canManageAssets && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <Trash2 />
                    Delete asset
                  </Button>
                )}
              </div>
            </div>
          )}
        </aside>

        <Separator orientation="vertical" className="h-auto" />

        {/* Asset catalog */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5">
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
              <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-5">
                {paginatedAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => handleSelectAsset(asset)}
                    aria-pressed={selectedAsset?.id === asset.id}
                    className={`relative rounded-3xl text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none ${
                      selectedAsset?.id === asset.id
                        ? "ring-2 ring-offset-2 ring-[#6b8050]"
                        : ""
                    }`}
                  >
                    {asset.asset_status === "not_available" && (
                      <span className="absolute left-3 top-3 z-10">
                        <StatusPill status={asset.asset_status} />
                      </span>
                    )}
                    <AssetCard
                      preview={
                        <AssetThumbnail
                          asset={asset}
                          staticPreview
                          cardPreview={
                            asset.asset_type === "floor" ||
                            asset.asset_type === "wall"
                          }
                        />
                      }
                      title={asset.name}
                      categories={[getCategoryLabel(asset.category)]}
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

      {/* Edit asset dialog */}
      <Dialog
        open={detailPage === 2 && selectedAsset !== null}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent className="flex h-[90vh] max-h-[760px] w-[95vw] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          {selectedAsset && (
            <>
              <header className="shrink-0 border-b border-border px-6 py-4 pr-14">
                <DialogTitle className="text-lg font-semibold">
                  {canManageAssets ? "Edit asset" : "Asset details"}
                </DialogTitle>
                <DialogDescription className="mt-1 truncate text-sm text-muted-foreground">
                  {getTitle(selectedAsset.asset_type)} · {selectedAsset.name}
                </DialogDescription>
              </header>

              <form
                noValidate
                onSubmit={handleSubmit}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:grid md:grid-cols-[5fr_6fr] md:grid-rows-1 md:overflow-hidden">
                  {/* Preview */}
                  <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-muted/30 p-6 md:min-h-0 md:border-b-0 md:border-r">
                    <p className="text-sm font-medium">Preview</p>
                    <div className="h-64 overflow-hidden rounded-2xl border border-border bg-muted md:h-auto md:min-h-0 md:flex-1">
                      {selectedAsset.asset_type === "furniture" ? (
                        <AssetThumbnail asset={selectedAsset} staticPreview />
                      ) : (
                        <PreviewScene asset={selectedPreviewAsset} />
                      )}
                    </div>
                    {hasPhysicalTexture && (
                      <p className="text-xs text-muted-foreground">
                        The preview updates as you change the size or pattern.
                      </p>
                    )}
                  </div>

                  {/* Fields */}
                  <fieldset
                    disabled={!canManageAssets || saving}
                    className="min-w-0 border-0 px-6 py-0 md:min-h-0 md:overflow-y-auto"
                  >
                    <FormSection title="Basic details">
                      <Field id="edit-asset-name" label="Name" error={visibleErrors.name}>
                        <Input
                          id="edit-asset-name"
                          value={editName}
                          onChange={(event) =>
                            setEditName(event.target.value)
                          }
                          disabled={!canManageAssets || saving}
                          aria-invalid={Boolean(visibleErrors.name)}
                          aria-describedby="edit-asset-name-message"
                          className="h-10"
                        />
                      </Field>

                      {selectedAsset.asset_type === "furniture" ? (
                        <Field id="edit-asset-category" label="Category">
                          <Select
                            value={editCategory}
                            onValueChange={(value) => {
                              if (value !== null) setEditCategory(value);
                            }}
                            disabled={!canManageAssets || saving}
                          >
                            <SelectTrigger id="edit-asset-category" className="w-full">
                              <SelectValue>{getCategoryLabel(editCategory)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {![
                                ...FURNITURE_CATEGORY_OPTIONS,
                                ...FURNITURE_SPECIAL_CATEGORIES,
                              ].some(([value]) => value === editCategory) && (
                                <SelectItem value={editCategory} disabled>
                                  {getCategoryLabel(editCategory)}
                                </SelectItem>
                              )}
                              {FURNITURE_CATEGORY_OPTIONS.map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                              {FURNITURE_SPECIAL_CATEGORIES.map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      ) : (
                        <dl className="text-sm">
                          <dt className="font-medium">Category</dt>
                          <dd className="mt-1 text-muted-foreground">
                            {selectedAsset.category} (can't be changed)
                          </dd>
                        </dl>
                      )}
                    </FormSection>

                    <FormSection title="Pricing">
                      <Field
                        id="edit-asset-price"
                        label={
                          selectedAsset.asset_type === "floor"
                            ? "Price per tile"
                            : "Price"
                        }
                        error={visibleErrors.price}
                        hint={
                          optionalPrice
                            ? "Optional for Decorations and Appliances."
                            : selectedAsset.asset_type === "floor" &&
                                selectedAsset.pricePerPiece == null
                              ? "The legacy price field is treated as ₱/m². Enter the intended tile price; the legacy value will remain unchanged."
                              : undefined
                        }
                      >
                        <div className="relative">
                          <span
                            aria-hidden="true"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                          >
                            ₱
                          </span>
                          <Input
                            id="edit-asset-price"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            value={editPrice}
                            onChange={(event) =>
                              setEditPrice(event.target.value)
                            }
                            disabled={!canManageAssets || saving}
                            required={!optionalPrice}
                            aria-invalid={Boolean(visibleErrors.price)}
                            aria-describedby="edit-asset-price-message"
                            placeholder="0.00"
                            className="h-10 pl-8"
                          />
                        </div>
                      </Field>
                    </FormSection>

                    {hasPhysicalTexture && (
                      <FormSection
                        title="Material size"
                        description="The physical length and width of one tile or panel."
                      >
                        <div
                          role="group"
                          aria-label="Unit"
                          className="inline-flex rounded-lg border border-border bg-muted/40 p-1"
                        >
                          {(["cm", "mm"] as const).map((unit) => (
                            <button
                              key={unit}
                              type="button"
                              aria-pressed={editFloorDimensionUnit === unit}
                              onClick={() => handleFloorDimensionUnitChange(unit)}
                              className={`rounded-md px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                editFloorDimensionUnit === unit
                                  ? "bg-background font-medium shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {unit}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                          <Field
                            id="edit-floor-length"
                            label={`Length (${editFloorDimensionUnit})`}
                            error={visibleErrors.length}
                          >
                            <Input
                              id="edit-floor-length"
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="any"
                              value={editLength}
                              onChange={(event) =>
                                setEditLength(event.target.value)
                              }
                              placeholder="Enter length"
                              disabled={!canManageAssets || saving}
                              required
                              aria-invalid={Boolean(visibleErrors.length)}
                              aria-describedby="edit-floor-length-message"
                              className="h-10"
                            />
                          </Field>

                          <Field
                            id="edit-floor-width"
                            label={`Width (${editFloorDimensionUnit})`}
                            error={visibleErrors.width}
                          >
                            <Input
                              id="edit-floor-width"
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="any"
                              value={editWidth}
                              onChange={(event) =>
                                setEditWidth(event.target.value)
                              }
                              placeholder="Enter width"
                              disabled={!canManageAssets || saving}
                              required
                              aria-invalid={Boolean(visibleErrors.width)}
                              aria-describedby="edit-floor-width-message"
                              className="h-10"
                            />
                          </Field>
                        </div>

                        {selectedAsset.floorMaterialMode === "single-tile" ? (
                          <Field
                            id="edit-floor-pattern"
                            label="Pattern"
                            error={visibleErrors.pattern}
                            hint={
                              editFloorPattern === "herringbone"
                                ? "Herringbone requires material length to be twice its width."
                                : undefined
                            }
                          >
                            <Select
                              value={editFloorPattern}
                              onValueChange={(value) => {
                                if (isFloorPattern(value)) setEditFloorPattern(value);
                              }}
                              disabled={!canManageAssets || saving}
                            >
                              <SelectTrigger id="edit-floor-pattern" className="w-full">
                                <SelectValue>
                                  {FLOOR_PATTERN_DEFINITIONS.find(
                                    (pattern) => pattern.id === editFloorPattern
                                  )?.label ?? editFloorPattern}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {FLOOR_PATTERN_DEFINITIONS.map((pattern) => (
                                  <SelectItem key={pattern.id} value={pattern.id}>
                                    {pattern.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            This older material keeps its existing texture-sheet rendering. Editing dimensions will not convert it to single-tile mode.
                          </p>
                        )}
                      </FormSection>
                    )}

                    <FormSection title="Availability">
                      <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                        <div>
                          <p className="text-sm font-medium">
                            {editStatus === "available" ? "Available" : "Not available"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {editStatus === "available"
                              ? "This asset is turned on for use."
                              : "This asset is turned off."}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-label="Asset availability"
                          aria-checked={editStatus === "available"}
                          onClick={() =>
                            setEditStatus((current) =>
                              current === "available"
                                ? "not_available"
                                : "available"
                            )
                          }
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                            editStatus === "available"
                              ? "bg-emerald-600"
                              : "bg-gray-500"
                          }`}
                        >
                          <span
                            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                              editStatus === "available"
                                ? "translate-x-5"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {selectedAsset.asset_type === "floor" && (
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 text-sm">
                          <input
                            type="checkbox"
                            checked={editShareWithWalls}
                            onChange={(event) =>
                              setEditShareWithWalls(event.target.checked)
                            }
                            className="mt-0.5 size-4 accent-primary"
                          />
                          <span>
                            <span className="font-medium">Share with walls</span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Make this same floor asset available as a wall texture.
                            </span>
                          </span>
                        </label>
                      )}
                    </FormSection>
                  </fieldset>
                </div>

                <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
                  <p
                    aria-live="polite"
                    className={`text-sm ${
                      saveError || (showErrors && hasFormErrors)
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {!canManageAssets
                      ? "View only. Only superadmins can edit assets."
                      : saveError
                        ? saveError
                        : showErrors && hasFormErrors
                          ? "Fix the highlighted fields to continue."
                          : isDirty
                            ? "You have unsaved changes."
                            : "No changes yet."}
                  </p>

                  <div className="ml-auto flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={closeEditor}
                    >
                      {canManageAssets && isDirty ? "Discard changes" : "Close"}
                    </Button>
                    {canManageAssets && (
                      <Button type="submit" disabled={saving || !isDirty}>
                        {saving ? "Saving..." : "Save changes"}
                      </Button>
                    )}
                  </div>
                </footer>
              </form>
            </>
          )}

          {/* Confirm save dialog (nested so it stacks above the editor) */}
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
                  {saving ? "Saving..." : "Yes, save changes"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogContent>
      </Dialog>

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

          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}

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
      {canManageAssets && (
        <CreateAssetModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(createdAsset) => {
            setCreateOpen(false);

            if (
              createdAsset.asset_type === "floor" &&
              createdAsset.shareWithWalls === true
            ) {
              void refreshWallMaterials().catch((error: unknown) => {
                console.error("Failed to refresh newly shared wall materials:", error);
                setCreateNotice(
                  `${createdAsset.name} was created, but the wall texture list could not be refreshed.`
                );
              });
            }

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