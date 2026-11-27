import { useEffect, useRef, useState } from "react";
import {
  Armchair,
  Box,
  Grid3x3,
  ImageIcon,
  Loader2,
  PaintRoller,
  Palette,
  Plus,
  Upload,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import AssetThumbnail from "@/components/asset-preview/AssetThumbnail";
import PreviewScene from "@/components/asset-preview/PreviewScene";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Asset,
  AssetStatus,
  AssetType,
} from "@/services/assets/asset-types";
import { createAsset } from "@/services/assets/createAsset";
import {
  DEFAULT_FLOOR_GROUT_WIDTH_M,
  FLOOR_PATTERN_DEFINITIONS,
  floorDimensionToMeters,
  isHerringboneTileRatio,
  isFloorPattern,
} from "../../../../shared/flooring/patterns";
import type {
  FloorDimensionUnit,
  FloorPattern,
} from "../../../../shared/flooring/patterns";
import {
  FURNITURE_CATEGORY_OPTIONS,
  FURNITURE_SPECIAL_CATEGORIES,
  isOptionalFurniturePrice,
} from "@/services/assets/furnitureCategories";
import { useAuth } from "@/context/AuthContext";

interface CreateAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (asset: Asset) => void;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const CATEGORY_OPTIONS: Record<
  AssetType,
  readonly (readonly [string, string])[]
> = {
  furniture: [
    ...FURNITURE_CATEGORY_OPTIONS,
    ...FURNITURE_SPECIAL_CATEGORIES,
  ],
  floor: [
    ["wood", "Wood"],
    ["tile", "Tiles"],
    ["brick", "Bricks"],
    ["paint", "Paint"],
    ["other", "Other"],
  ],
  // Walls can use a solid color OR an image, for every category.
  wall: [
    ["paint", "Paint"],
    ["wallfinish", "Wall finish"],
    ["tile", "Tile"],
    ["stone", "Stone"],
    ["brick", "Brick"],
    ["wood", "Wood"],
    ["other", "Other"],
  ],
};

const ASSET_TYPE_CARDS: {
  value: AssetType;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: "furniture",
    label: "Furniture",
    description: "3D GLB models",
    icon: Armchair,
  },
  {
    value: "floor",
    label: "Floors",
    description: "Tile & floor materials",
    icon: Grid3x3,
  },
  {
    value: "wall",
    label: "Walls",
    description: "Paint or physical tile textures",
    icon: PaintRoller,
  },
];

const INITIAL_FILES = {
  modelFile: null as File | null,
  diffuseFile: null as File | null,
};

const DEFAULT_COLOR = "#dedbd3";

type WallMode = "paint" | "texture";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Accepts "#abc", "abc", "#aabbcc", "aabbcc" and returns "#aabbcc" or null.
function normalizeHex(value: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;

  let hex = match[1].toLowerCase();
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  return `#${hex}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesAccept(file: File, accept: string): boolean {
  const rules = accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  return rules.some((rule) => {
    if (rule.startsWith(".")) return name.endsWith(rule);
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border/60 p-5">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function AssetTypeCard({
  label,
  description,
  icon: Icon,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  description: string;
  icon: LucideIcon;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={[
        "group flex items-center gap-3 rounded-xl border p-4 text-left",
        "transition-all duration-200 ease-out",
        "hover:border-primary/60 hover:bg-accent/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-60",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border/60 bg-background",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground",
        ].join(" ")}
      >
        <Icon size={20} />
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}

function FileField({
  label,
  accept,
  file,
  onChange,
  required = false,
  hint,
  size = "lg",
  icon: Icon = Upload,
  disabled,
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (file?: File) => void;
  required?: boolean;
  hint?: string;
  size?: "lg" | "sm";
  icon?: LucideIcon;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;

    const dropped = event.dataTransfer.files?.[0];
    if (dropped && matchesAccept(dropped, accept)) onChange(dropped);
  };

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>

      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon size={16} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {file.name}
            </span>
            <span className="block text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </span>
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={`Remove ${label}`}
            disabled={disabled}
            onClick={() => onChange(undefined)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={[
            "flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-center transition-colors",
            "focus-within:ring-2 focus-within:ring-ring",
            size === "lg" ? "px-4 py-8" : "px-3 py-4",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:border-primary/60 hover:bg-accent/40",
            disabled ? "pointer-events-none opacity-60" : "",
          ].join(" ")}
        >
          <Icon
            size={size === "lg" ? 22 : 18}
            className="text-muted-foreground"
          />
          <span className="text-sm font-medium">
            Click to upload{" "}
            <span className="font-normal text-muted-foreground">
              or drag and drop
            </span>
          </span>
          {hint && (
            <span className="text-xs text-muted-foreground">{hint}</span>
          )}

          <input
            type="file"
            accept={accept}
            disabled={disabled}
            className="sr-only"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              event.target.value = "";
              if (picked) onChange(picked);
            }}
          />
        </label>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export default function CreateAssetModal({
  open,
  onOpenChange,
  onCreated,
}: CreateAssetModalProps) {
  const { role } = useAuth();

  const [assetType, setAssetType] = useState<AssetType | "">("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<AssetStatus>("available");

  const [placementSurface, setPlacementSurface] = useState<
    "floor" | "wall" | "furniture"
  >("floor");

  // Walls: paint color or physical image texture.
  const [wallMode, setWallMode] = useState<WallMode>("paint");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [hexInput, setHexInput] = useState(DEFAULT_COLOR);

  const [metalness, setMetalness] = useState("0");
  const [shareWithWalls, setShareWithWalls] = useState(false);

  // Flooring dimensions are entered in the selected unit and converted to meters on submit.
  const [floorLength, setFloorLength] = useState("");
  const [floorWidth, setFloorWidth] = useState("");
  const [floorDimensionUnit, setFloorDimensionUnit] =
    useState<FloorDimensionUnit>("cm");
  const [floorPattern, setFloorPattern] =
    useState<FloorPattern>("stack-bond");

  const [files, setFiles] = useState(INITIAL_FILES);
  const [modelPreviewURL, setModelPreviewURL] = useState<string | null>(null);
  const [diffusePreviewURL, setDiffusePreviewURL] = useState<string | null>(
    null
  );

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const previewURLs = useRef<{
    model: string | null;
    diffuse: string | null;
  }>({
    model: null,
    diffuse: null,
  });

  const isCustomCategory = addingCategory || category === "other";
  const resolvedCategory = isCustomCategory
    ? customCategory.trim()
    : category;
  const hasPhysicalTexture =
    assetType === "floor" ||
    (assetType === "wall" && wallMode === "texture");
  const priceIsOptional =
    assetType === "furniture" && isOptionalFurniturePrice(category);

  const hexInvalid = hexInput.trim() !== "" && !normalizeHex(hexInput);

  const categoryLabel = isCustomCategory
    ? resolvedCategory
    : (assetType &&
      CATEGORY_OPTIONS[assetType].find(([value]) => value === category)?.[1]) ||
      resolvedCategory;

  const parsedFloorLength = Number(floorLength);
  const parsedFloorWidth = Number(floorWidth);
  const previewFloorLength =
    floorLength.trim() &&
    Number.isFinite(parsedFloorLength) &&
    parsedFloorLength > 0
      ? floorDimensionToMeters(parsedFloorLength, floorDimensionUnit)
      : 0.6;
  const previewFloorWidth =
    floorWidth.trim() &&
    Number.isFinite(parsedFloorWidth) &&
    parsedFloorWidth > 0
      ? floorDimensionToMeters(parsedFloorWidth, floorDimensionUnit)
      : 0.3;

  const previewAsset: Asset = {
    id: "new-asset-preview",
    name: name.trim() || "Asset preview",
    asset_type: assetType || "furniture",
    category: resolvedCategory,
    price: price.trim() ? Number(price) : undefined,
    model_url: modelPreviewURL,
    model_path: modelPreviewURL,
    storage_path: modelPreviewURL,
    diffuse_url: diffusePreviewURL,
    diffuse_path: diffusePreviewURL,
    base_color_url: diffusePreviewURL,
    color:
      assetType === "wall" && wallMode === "paint"
        ? color
        : null,
    roughness: 0.8,
    metalness: Number(metalness),
    floorMaterialMode: hasPhysicalTexture ? "single-tile" : undefined,
    floorPattern: hasPhysicalTexture ? floorPattern : undefined,
    length: hasPhysicalTexture ? previewFloorLength : undefined,
    width: hasPhysicalTexture ? previewFloorWidth : undefined,
  };

  const clearPreviewURLs = () => {
    Object.values(previewURLs.current).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });

    previewURLs.current = {
      model: null,
      diffuse: null,
    };

    setModelPreviewURL(null);
    setDiffusePreviewURL(null);
  };

  useEffect(
    () => () => {
      Object.values(previewURLs.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    },
    []
  );

  const reset = () => {
    clearPreviewURLs();

    setAssetType("");
    setName("");
    setCategory("");
    setCustomCategory("");
    setAddingCategory(false);
    setPrice("");
    setStatus("available");
    setPlacementSurface("floor");
    setWallMode("paint");
    setColor(DEFAULT_COLOR);
    setHexInput(DEFAULT_COLOR);
    setMetalness("0");
    setShareWithWalls(false);

    setFloorLength("");
    setFloorWidth("");
    setFloorDimensionUnit("cm");
    setFloorPattern("stack-bond");

    setFiles(INITIAL_FILES);
    setError("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (saving) return;

    if (!nextOpen) reset();

    onOpenChange(nextOpen);
  };

  const handleTypeChange = (value: string | null) => {
    if (!value || value === assetType) return;

    clearPreviewURLs();

    const nextType = value as AssetType;

    setAssetType(nextType);
    setCategory(CATEGORY_OPTIONS[nextType][0]?.[0] ?? "");
    setCustomCategory("");
    setAddingCategory(false);
    setFiles(INITIAL_FILES);
    setWallMode("paint");
    setShareWithWalls(false);

    // Clear the old dimensions when switching asset types.
    setFloorLength("");
    setFloorWidth("");
    setFloorDimensionUnit("cm");
    setFloorPattern("stack-bond");

    setError("");
  };

  const setFile = (key: keyof typeof INITIAL_FILES, file?: File) => {
    const previewKey =
      key === "modelFile" ? "model" : key === "diffuseFile" ? "diffuse" : null;

    if (previewKey) {
      const previousURL = previewURLs.current[previewKey];

      if (previousURL) {
        URL.revokeObjectURL(previousURL);
      }

      const nextURL = file ? URL.createObjectURL(file) : null;

      previewURLs.current[previewKey] = nextURL;

      if (previewKey === "model") {
        setModelPreviewURL(nextURL);
      } else {
        setDiffusePreviewURL(nextURL);
      }
    }

    setFiles((current) => ({
      ...current,
      [key]: file ?? null,
    }));

    setError("");
  };

  const handleWallModeChange = (mode: WallMode) => {
    if (mode === wallMode) return;

    setWallMode(mode);

    // Switching to paint drops any uploaded image.
    if (mode === "paint" && files.diffuseFile) {
      setFile("diffuseFile", undefined);
    }

    setError("");
  };

  const handlePickColor = (value: string) => {
    setColor(value);
    setHexInput(value);
    setError("");
  };

  const handleHexChange = (value: string) => {
    setHexInput(value);

    const normalized = normalizeHex(value);
    if (normalized) setColor(normalized);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (role !== "superadmin") {
      setError("Only superadmins can create assets.");
      return;
    }

    const numericPrice = Number(price);
    const hasPrice = price.trim() !== "";

    if (!assetType) {
      return setError("Choose an asset type.");
    }

    if (!name.trim()) {
      return setError("Enter an asset name.");
    }

    if (!resolvedCategory) {
      return setError("Choose or enter a category.");
    }

    if (
      (!priceIsOptional && !hasPrice) ||
      (hasPrice && (!Number.isFinite(numericPrice) || numericPrice < 0))
    ) {
      return setError("Enter a valid price of 0 or more.");
    }

    if (assetType === "furniture" && !files.modelFile) {
      return setError("Upload a GLB model for furniture.");
    }

    if (assetType === "floor" && !files.diffuseFile) {
      return setError("Upload a diffuse texture for floors.");
    }

    if (assetType === "wall") {
      if (wallMode === "texture" && !files.diffuseFile) {
        return setError(
          "Upload a texture for this wall material, or switch to Paint."
        );
      }

      if (wallMode === "paint" && !normalizeHex(hexInput)) {
        return setError("Enter a valid color, for example #DEDBD3.");
      }
    }

    // Both dimensions are mandatory for physical floor and wall textures.
    if (hasPhysicalTexture) {
      const numericLength = Number(floorLength);
      const numericWidth = Number(floorWidth);

      if (
        !floorLength.trim() ||
        !Number.isFinite(numericLength) ||
        numericLength <= 0
      ) {
        return setError(`Enter a material length greater than 0 ${floorDimensionUnit}.`);
      }

      if (
        !floorWidth.trim() ||
        !Number.isFinite(numericWidth) ||
        numericWidth <= 0
      ) {
        return setError(`Enter a material width greater than 0 ${floorDimensionUnit}.`);
      }

      if (
        floorDimensionToMeters(numericLength, floorDimensionUnit) <= DEFAULT_FLOOR_GROUT_WIDTH_M ||
        floorDimensionToMeters(numericWidth, floorDimensionUnit) <= DEFAULT_FLOOR_GROUT_WIDTH_M
      ) {
        return setError("Tile length and width must each be greater than the 3 mm grout width.");
      }

      if (
        floorPattern === "herringbone" &&
        !isHerringboneTileRatio(
          floorDimensionToMeters(numericLength, floorDimensionUnit),
          floorDimensionToMeters(numericWidth, floorDimensionUnit)
        )
      ) {
        return setError("Herringbone requires tile length to be twice the tile width.");
      }
    }

    setSaving(true);

    try {
      const useWallColor = assetType === "wall" && wallMode === "paint";

      const created = await createAsset({
        asset_type: assetType,
        name,
        category: resolvedCategory,
        ...(assetType === "floor"
          ? { pricePerPiece: numericPrice }
          : {
              price: priceIsOptional && !hasPrice ? undefined : numericPrice,
            }),
        asset_status: status,

        modelFile: files.modelFile ?? undefined,
        diffuseFile: useWallColor ? undefined : files.diffuseFile ?? undefined,

        color: useWallColor ? color : undefined,

        metalness: assetType !== "furniture" ? Number(metalness) : undefined,
        shareWithWalls:
          assetType === "floor" ? shareWithWalls : undefined,

        placement_surface:
          assetType === "furniture" ? placementSurface : undefined,

        // Include dimensions for floors and image-based wall textures.
        length:
          hasPhysicalTexture
            ? floorDimensionToMeters(Number(floorLength), floorDimensionUnit)
            : undefined,

        width:
          hasPhysicalTexture
            ? floorDimensionToMeters(Number(floorWidth), floorDimensionUnit)
            : undefined,

        floorPattern:
          hasPhysicalTexture ? floorPattern : undefined,
      });

      onCreated(created);
      reset();
      onOpenChange(false);
    } catch (createError) {
      console.error("Failed to create asset:", createError);

      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create asset."
      );
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Preview panel                                                     */
  /* ---------------------------------------------------------------- */

  const renderPreview = () => {
    if (assetType === "furniture") {
      return modelPreviewURL ? (
        <AssetThumbnail asset={previewAsset} />
      ) : (
        <PreviewEmpty icon={Box} text="Upload a GLB model to preview it in 3D." />
      );
    }

    if (assetType === "floor") {
      return diffusePreviewURL ? (
        <img
          src={diffusePreviewURL}
          alt={name.trim() || "Uploaded floor tile"}
          className="h-full w-full object-contain"
        />
      ) : (
        <PreviewEmpty icon={ImageIcon} text="Upload a tile image to preview it." />
      );
    }

    if (assetType === "wall") {
      return <PreviewScene asset={previewAsset} />;
    }

    return (
      <PreviewEmpty
        icon={ImageIcon}
        text="Choose an asset type to preview it in 3D."
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b border-border/60 px-8 py-6">
          <DialogTitle className="text-lg">Create asset</DialogTitle>

          <DialogDescription>
            Add a 3D furniture model or a floor/wall material to the shared
            library.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-8 py-6">
            {/* Step 1: type */}
            <div className="space-y-2">
              <p className="text-sm font-medium">What are you adding?</p>

              <div
                role="radiogroup"
                aria-label="Asset type"
                className="grid gap-3 sm:grid-cols-3"
              >
                {ASSET_TYPE_CARDS.map((card) => (
                  <AssetTypeCard
                    key={card.value}
                    label={card.label}
                    description={card.description}
                    icon={card.icon}
                    selected={assetType === card.value}
                    disabled={saving}
                    onSelect={() => handleTypeChange(card.value)}
                  />
                ))}
              </div>
            </div>

            {!assetType && (
              <div className="rounded-xl border border-dashed border-border/70 px-6 py-12 text-center text-sm text-muted-foreground">
                Choose an asset type above to get started.
              </div>
            )}

            {assetType && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                {/* Form column */}
                <div className="min-w-0 space-y-5">
                  <Section title="Details">
                    <Field
                      label="Name"
                      htmlFor="new-asset-name"
                      required
                    >
                      <Input
                        id="new-asset-name"
                        className="w-full"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="e.g. Oak dining chair"
                        required
                        disabled={saving}
                      />
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Category" required>
                        <div className="flex gap-2">
                          {isCustomCategory ? (
                            <Input
                              className="min-w-0 flex-1"
                              value={customCategory}
                              onChange={(event) =>
                                setCustomCategory(event.target.value)
                              }
                              placeholder="Enter category name"
                              required
                              disabled={saving}
                            />
                          ) : (
                            <Select
                              value={category}
                              onValueChange={(value) => setCategory(value ?? "")}
                              disabled={saving}
                            >
                              <SelectTrigger className="min-w-0 flex-1">
                                <SelectValue placeholder="Choose a category" />
                              </SelectTrigger>

                              <SelectContent>
                                {CATEGORY_OPTIONS[assetType].map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (addingCategory || category === "other") {
                                setAddingCategory(false);
                                if (category === "other") {
                                  setCategory(
                                    CATEGORY_OPTIONS[assetType][0]?.[0] ?? ""
                                  );
                                }
                              } else {
                                setAddingCategory(true);
                              }
                              setCustomCategory("");
                            }}
                            disabled={saving}
                          >
                            {isCustomCategory ? "Choose" : "Add"}
                          </Button>
                        </div>
                      </Field>

                      <Field label="Availability">
                        <Select
                          value={status}
                          onValueChange={(value) =>
                            setStatus(value as AssetStatus)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="not_available">
                              Not available
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>

                    <Field
                      label={
                        assetType === "floor"
                          ? "Price per tile"
                          : priceIsOptional
                            ? "Price (optional)"
                            : "Price"
                      }
                      htmlFor="new-asset-price"
                      required={!priceIsOptional}
                    >
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          ₱
                        </span>
                        <Input
                          id="new-asset-price"
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full pl-7"
                          placeholder="0.00"
                          value={price}
                          onChange={(event) => setPrice(event.target.value)}
                          required={!priceIsOptional}
                          disabled={saving}
                        />
                      </div>
                    </Field>
                  </Section>

                  {/* Furniture */}
                  {assetType === "furniture" && (
                    <Section
                      title="3D model"
                      description="Upload the GLB file and choose where it can be placed."
                    >
                      <FileField
                        label="Model file"
                        accept=".glb,model/gltf-binary"
                        file={files.modelFile}
                        onChange={(file) => setFile("modelFile", file)}
                        hint="GLB files only"
                        icon={Box}
                        disabled={saving}
                        required
                      />

                      <Field label="Placement surface">
                        <Select
                          value={placementSurface}
                          onValueChange={(value) =>
                            setPlacementSurface(
                              value as typeof placementSurface
                            )
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="floor">Floor</SelectItem>
                            <SelectItem value="wall">Wall</SelectItem>
                            <SelectItem value="furniture">Furniture</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </Section>
                  )}

                  {assetType === "floor" && (
                    <Section
                      title="Single tile image"
                      description="The image is cropped to fill each configured tile face."
                    >
                      <FileField
                        label="Diffuse texture"
                        accept="image/*"
                        file={files.diffuseFile}
                        onChange={(file) => setFile("diffuseFile", file)}
                        hint="PNG, JPG or WebP"
                        icon={ImageIcon}
                        disabled={saving}
                        required
                      />
                    </Section>
                  )}

                  {/* Walls */}
                  {assetType === "wall" && (
                    <Section
                      title="Wall material"
                      description="Choose Paint for a solid color or Texture for a physical tile or panel."
                    >
                      <div
                        role="radiogroup"
                        aria-label="Wall material type"
                        className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1"
                      >
                        {(
                          [
                            ["paint", "Paint", Palette],
                            ["texture", "Texture", ImageIcon],
                          ] as const
                        ).map(([value, label, Icon]) => {
                          const active = wallMode === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              disabled={saving}
                              onClick={() => handleWallModeChange(value)}
                              className={[
                                "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                active
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground",
                              ].join(" ")}
                            >
                              <Icon size={16} />
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {wallMode === "paint" ? (
                        <div className="space-y-4">
                          <div className="flex items-end gap-3">
                            <Field label="Pick a color">
                              <input
                                type="color"
                                value={color}
                                onChange={(event) =>
                                  handlePickColor(event.target.value)
                                }
                                aria-label="Wall color picker"
                                disabled={saving}
                                className="h-10 w-16 cursor-pointer rounded-md border border-border bg-background p-1"
                              />
                            </Field>

                            <div className="min-w-0 flex-1">
                              <Field label="Hex code" htmlFor="wall-hex">
                                <Input
                                  id="wall-hex"
                                  className="w-full font-mono uppercase"
                                  value={hexInput}
                                  onChange={(event) =>
                                    handleHexChange(event.target.value)
                                  }
                                  onBlur={() => {
                                    if (hexInvalid) setHexInput(color);
                                    else setHexInput(color);
                                  }}
                                  placeholder="#DEDBD3"
                                  maxLength={7}
                                  aria-invalid={hexInvalid}
                                  disabled={saving}
                                />
                              </Field>
                            </div>
                          </div>

                          {hexInvalid && (
                            <p className="-mt-2 text-xs text-destructive">
                              Use a hex code like #DEDBD3.
                            </p>
                          )}

                        </div>
                      ) : (
                        <FileField
                          label="Wall texture image"
                          accept="image/*"
                          file={files.diffuseFile}
                          onChange={(file) => setFile("diffuseFile", file)}
                          hint="One tile or panel image; dimensions control its repetition."
                          icon={ImageIcon}
                          disabled={saving}
                          required
                        />
                      )}
                    </Section>
                  )}

                  {hasPhysicalTexture && (
                    <>
                      <Section
                        title={assetType === "floor" ? "Tile dimensions" : "Material dimensions"}
                        description={
                          assetType === "floor"
                            ? "Physical size of one tile; image pixel dimensions do not affect this."
                            : "Physical width and height of one wall tile or panel; these determine texture repetition."
                        }
                      >
                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px]">
                          <Field label="Length" htmlFor="material-length" required>
                            <Input
                              id="material-length"
                              type="number"
                              min="0"
                              step="any"
                              className="w-full"
                              value={floorLength}
                              onChange={(event) =>
                                setFloorLength(event.target.value)
                              }
                              placeholder={floorDimensionUnit === "cm" ? "60" : "600"}
                              required
                              disabled={saving}
                            />
                          </Field>

                          <Field label="Width" htmlFor="material-width" required>
                            <Input
                              id="material-width"
                              type="number"
                              min="0"
                              step="any"
                              className="w-full"
                              value={floorWidth}
                              onChange={(event) =>
                                setFloorWidth(event.target.value)
                              }
                              placeholder={floorDimensionUnit === "cm" ? "30" : "300"}
                              required
                              disabled={saving}
                            />
                          </Field>

                          <Field label="Unit" htmlFor="material-dimension-unit" required>
                            <Select
                              value={floorDimensionUnit}
                              disabled={saving}
                              onValueChange={(value) => {
                                if (value !== "cm" && value !== "mm") return;
                                if (value === floorDimensionUnit) return;
                                const unitFactor = value === "mm" ? 10 : 0.1;
                                const convertValue = (current: string) => {
                                  if (!current.trim()) return current;
                                  const numeric = Number(current);
                                  return Number.isFinite(numeric)
                                    ? String(numeric * unitFactor)
                                    : current;
                                };
                                setFloorLength(convertValue(floorLength));
                                setFloorWidth(convertValue(floorWidth));
                                setFloorDimensionUnit(value);
                              }}
                            >
                              <SelectTrigger id="material-dimension-unit" className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cm">cm</SelectItem>
                                <SelectItem value="mm">mm</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>
                      </Section>

                      <Section
                        title={assetType === "floor" ? "Laying pattern" : "Texture pattern"}
                        description="Choose a supported tile arrangement."
                      >
                        <Field label="Pattern" htmlFor="material-pattern" required>
                          <Select
                            value={floorPattern}
                            disabled={saving}
                            onValueChange={(value) => {
                              if (isFloorPattern(value)) setFloorPattern(value);
                            }}
                          >
                            <SelectTrigger id="material-pattern" className="w-full">
                              <SelectValue />
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
                        <p className="text-xs text-muted-foreground">
                          Grout is {DEFAULT_FLOOR_GROUT_WIDTH_M * 1000} mm wide.
                          {floorPattern === "herringbone" &&
                            " Herringbone requires a 2:1 length-to-width ratio."}
                        </p>
                        {assetType === "floor" && (
                          <label className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={shareWithWalls}
                              onChange={(event) =>
                                setShareWithWalls(event.target.checked)
                              }
                              disabled={saving}
                              className="mt-0.5 size-4 accent-primary"
                            />
                            <span>
                              <span className="font-medium">Share with Walls</span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                Make this same floor asset available as a wall texture.
                              </span>
                            </span>
                          </label>
                        )}
                      </Section>
                    </>
                  )}

                  {/* Optional material settings (floors + walls) */}
                  {assetType !== "furniture" && (
                    <details className="group rounded-xl border border-border/60">
                      <summary className="cursor-pointer select-none list-none px-5 py-4 text-sm font-semibold">
                        Advanced material settings
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          optional
                        </span>
                      </summary>

                      <div className="space-y-4 border-t border-border/60 px-5 py-5">
                        <div className="max-w-sm">
                          <Field label="Metalness (0–1)" htmlFor="asset-metalness">
                            <Input
                              id="asset-metalness"
                              type="number"
                              min="0"
                              max="1"
                              step="0.05"
                              className="w-full"
                              value={metalness}
                              onChange={(event) =>
                                setMetalness(event.target.value)
                              }
                              disabled={saving}
                            />
                          </Field>
                        </div>
                      </div>
                    </details>
                  )}
                </div>

                {/* Preview column */}
                <aside className="min-w-0 space-y-3 lg:sticky lg:top-0 lg:self-start">
                  <p className="text-sm font-medium">Live preview</p>

                  <div className="aspect-square w-full overflow-hidden rounded-xl border border-border/60 bg-muted">
                    {renderPreview()}
                  </div>

                  <div className="rounded-xl border border-border/60 px-4 py-3">
                    <p className="truncate text-sm font-semibold">
                      {name.trim() || "Untitled asset"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[
                        categoryLabel,
                        price.trim() && Number.isFinite(Number(price))
                          ? `₱${Number(price).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}${assetType === "floor" ? " / tile" : ""}`
                          : null,
                        assetType === "wall" && wallMode === "paint"
                          ? color.toUpperCase()
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No details yet"}
                    </p>
                  </div>
                </aside>
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border/60 bg-background px-8 py-4">
            <p
              role="alert"
              className="min-w-0 flex-1 truncate text-sm text-destructive"
            >
              {error}
            </p>

            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={saving || !assetType}>
                {saving ? <Loader2 className="animate-spin" /> : <Plus />}

                {saving ? "Creating..." : "Create asset"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PreviewEmpty({
  icon: Icon,
  text,
}: {
  icon: LucideIcon;
  text: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
      <Icon size={28} className="opacity-60" />
      {text}
    </div>
  );
}