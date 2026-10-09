import { useEffect, useRef, useState } from "react";
import { Armchair, Grid3x3, Loader2, PaintRoller, Plus, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import AssetThumbnail from "@/components/asset-preview/AssetThumbnail";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Asset, AssetStatus, AssetType } from "@/services/assets/asset-types";
import { createAsset } from "@/services/assets/createAsset";
import { useAuth } from "@/context/AuthContext";

interface CreateAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (asset: Asset) => void;
}

const FURNITURE_CATEGORIES = [
  ["livingroom", "Living room"],
  ["bedroom", "Bedroom"],
  ["diningroom", "Dining room"],
  ["kitchen", "Kitchen"],
  ["bathroom", "Bathroom"],
  ["office", "Office"],
] as const;

const CATEGORY_OPTIONS: Record<AssetType, readonly (readonly [string, string])[]> = {
  furniture: FURNITURE_CATEGORIES,
  floor: [["wood", "Wood"], ["tile", "Tiles"], ["brick", "Bricks"], ["paint", "Paint"], ["other", "Other"]],
  wall: [["paint", "Paint"], ["wallfinish", "Wall finish"], ["tile", "Tile"], ["stone", "Stone"], ["brick", "Brick"], ["wood", "Wood"], ["other", "Other"]],
};

const ASSET_TYPE_CARDS: { value: AssetType; label: string; description: string; icon: LucideIcon }[] = [
  { value: "furniture", label: "Furnitures", description: "3D GLB models", icon: Armchair },
  { value: "floor", label: "Floors", description: "Floor materials", icon: Grid3x3 },
  { value: "wall", label: "Walls", description: "Wall materials", icon: PaintRoller },
];

const INITIAL_FILES = {
  modelFile: null as File | null,
  diffuseFile: null as File | null,
  normalFile: null as File | null,
  roughnessFile: null as File | null,
  aoFile: null as File | null,
};

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
        "group flex flex-col items-center gap-3 rounded-xl border p-5 text-center",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-1 hover:border-primary/60 hover:bg-accent/40 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-60",
        selected
          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
          : "border-border/60 bg-background",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200",
          "group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        ].join(" ")}
      >
        <Icon size={22} />
      </span>
      <span className="space-y-0.5">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
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
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (file?: File) => void;
  required?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium">{label}{required ? " *" : ""}</span>
      <span className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
        <Upload size={15} />
        <span className="min-w-0 flex-1 truncate">{file?.name ?? "Choose file"}</span>
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => onChange(event.target.files?.[0])}
        />
      </span>
    </label>
  );
}

export default function CreateAssetModal({ open, onOpenChange, onCreated }: CreateAssetModalProps) {
  const { role } = useAuth();
  const [assetType, setAssetType] = useState<AssetType | "">("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<AssetStatus>("available");
  const [placementSurface, setPlacementSurface] = useState<"floor" | "wall" | "furniture">("floor");
  const [color, setColor] = useState("#dedbd3");
  const [roughness, setRoughness] = useState("0.8");
  const [metalness, setMetalness] = useState("0");
  const [files, setFiles] = useState(INITIAL_FILES);
  const [modelPreviewURL, setModelPreviewURL] = useState<string | null>(null);
  const [diffusePreviewURL, setDiffusePreviewURL] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const previewURLs = useRef<{ model: string | null; diffuse: string | null }>({ model: null, diffuse: null });

  const resolvedCategory = category === "other" ? customCategory.trim() : category;
  const previewAsset: Asset = {
    id: "new-asset-preview",
    name: name.trim() || "Asset preview",
    asset_type: assetType || "furniture",
    category: resolvedCategory,
    price: Number(price) || 0,
    model_url: modelPreviewURL,
    model_path: modelPreviewURL,
    storage_path: modelPreviewURL,
    diffuse_url: diffusePreviewURL,
    diffuse_path: diffusePreviewURL,
    base_color_url: diffusePreviewURL,
    color: assetType === "wall" && !diffusePreviewURL ? color : null,
  };

  const clearPreviewURLs = () => {
    Object.values(previewURLs.current).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    previewURLs.current = { model: null, diffuse: null };
    setModelPreviewURL(null);
    setDiffusePreviewURL(null);
  };

  useEffect(() => () => {
    Object.values(previewURLs.current).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  }, []);

  const reset = () => {
    clearPreviewURLs();
    setAssetType("");
    setName("");
    setCategory("");
    setCustomCategory("");
    setPrice("");
    setStatus("available");
    setPlacementSurface("floor");
    setColor("#dedbd3");
    setRoughness("0.8");
    setMetalness("0");
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
    setFiles(INITIAL_FILES);
    setError("");
  };

  const setFile = (key: keyof typeof INITIAL_FILES, file?: File) => {
    const previewKey = key === "modelFile" ? "model" : key === "diffuseFile" ? "diffuse" : null;
    if (previewKey) {
      const previousURL = previewURLs.current[previewKey];
      if (previousURL) URL.revokeObjectURL(previousURL);
      const nextURL = file ? URL.createObjectURL(file) : null;
      previewURLs.current[previewKey] = nextURL;
      if (previewKey === "model") setModelPreviewURL(nextURL);
      else setDiffusePreviewURL(nextURL);
    }
    setFiles((current) => ({ ...current, [key]: file ?? null }));
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (role !== "superadmin") {
      setError("Only superadmins can create assets.");
      return;
    }

    const numericPrice = Number(price);
    if (!assetType) return setError("Choose an asset type.");
    if (!name.trim()) return setError("Enter an asset name.");
    if (!resolvedCategory) return setError("Choose or enter a category.");
    if (!Number.isFinite(numericPrice) || numericPrice < 0) return setError("Enter a valid price of 0 or more.");
    if (assetType === "furniture" && !files.modelFile) return setError("Upload a GLB model for furniture.");
    if (assetType === "floor" && !files.diffuseFile) return setError("Upload a diffuse texture for floors.");

    setSaving(true);
    try {
      const created = await createAsset({
        asset_type: assetType,
        name,
        category: resolvedCategory,
        price: numericPrice,
        asset_status: status,
        modelFile: files.modelFile ?? undefined,
        diffuseFile: files.diffuseFile ?? undefined,
        normalFile: files.normalFile ?? undefined,
        roughnessFile: files.roughnessFile ?? undefined,
        aoFile: files.aoFile ?? undefined,
        color: assetType === "wall" && !files.diffuseFile ? color : undefined,
        roughness: assetType !== "furniture" ? Number(roughness) : undefined,
        metalness: assetType !== "furniture" ? Number(metalness) : undefined,
        placement_surface: assetType === "furniture" ? placementSurface : undefined,
      });
      onCreated(created);
      reset();
      onOpenChange(false);
    } catch (createError) {
      console.error("Failed to create asset:", createError);
      setError(createError instanceof Error ? createError.message : "Failed to create asset.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border/60 px-7 py-6">
          <DialogTitle>Create Asset</DialogTitle>
          <DialogDescription>Upload a 3D furniture model or a floor/wall material to the shared library.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-7 py-6">
          <div className="space-y-3">
            <div role="radiogroup" aria-labelledby="asset-type-label" className="grid gap-3 sm:grid-cols-3">
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

          {assetType && (
            <>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="new-asset-name" className="text-sm font-medium">Name *</label>
                      <Input id="new-asset-name" value={name} onChange={(event) => setName(event.target.value)} required disabled={saving} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category *</label>
                      <Select value={category} onValueChange={(value) => setCategory(value ?? "")}>
                        <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                        <SelectContent>
                          {CATEGORY_OPTIONS[assetType].map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {category === "other" && (
                        <Input value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="Enter category" required disabled={saving} />
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="new-asset-price" className="text-sm font-medium">Price *</label>
                      <Input id="new-asset-price" type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required disabled={saving} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Availability</label>
                      <Select value={status} onValueChange={(value) => setStatus(value as AssetStatus)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="not_available">Not available</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {assetType === "furniture" ? (
                    <div className="space-y-4 rounded-lg border border-border/60 p-4">
                      <FileField label="3D model (GLB)" accept=".glb,model/gltf-binary" file={files.modelFile} onChange={(file) => setFile("modelFile", file)} required />
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Placement surface</label>
                        <Select value={placementSurface} onValueChange={(value) => setPlacementSurface(value as typeof placementSurface)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="floor">Floor</SelectItem>
                            <SelectItem value="wall">Wall</SelectItem>
                            <SelectItem value="furniture">Furniture</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 rounded-lg border border-border/60 p-4">
                      <FileField label="Diffuse texture" accept="image/*" file={files.diffuseFile} onChange={(file) => setFile("diffuseFile", file)} required={assetType === "floor"} />
                      {assetType === "wall" && (
                        <div className="flex items-center gap-3">
                          <label htmlFor="wall-color" className="text-sm font-medium">Solid color</label>
                          <input id="wall-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border bg-background p-1" disabled={saving} />
                          <span className="text-xs text-muted-foreground">Used when no texture is uploaded</span>
                        </div>
                      )}
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium">Optional material maps and settings</summary>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <FileField label="Normal map" accept="image/*" file={files.normalFile} onChange={(file) => setFile("normalFile", file)} />
                          <FileField label="Roughness map" accept="image/*" file={files.roughnessFile} onChange={(file) => setFile("roughnessFile", file)} />
                          <FileField label="Ambient occlusion map" accept="image/*" file={files.aoFile} onChange={(file) => setFile("aoFile", file)} />
                          <div className="space-y-2">
                            <label htmlFor="asset-roughness" className="text-sm font-medium">Roughness (0–1)</label>
                            <Input id="asset-roughness" type="number" min="0" max="1" step="0.05" value={roughness} onChange={(event) => setRoughness(event.target.value)} disabled={saving} />
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="asset-metalness" className="text-sm font-medium">Metalness (0–1)</label>
                            <Input id="asset-metalness" type="number" min="0" max="1" step="0.05" value={metalness} onChange={(event) => setMetalness(event.target.value)} disabled={saving} />
                          </div>
                        </div>
                      </details>
                    </div>
                  )}
                </div>

                <aside className="space-y-2">
                  <p className="text-sm font-medium">Live preview</p>
                  <div className="h-52 overflow-hidden rounded-lg border border-border/60 bg-muted">
                    {modelPreviewURL || diffusePreviewURL || previewAsset.color ? (
                      <AssetThumbnail asset={previewAsset} />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                        Choose a GLB model or texture to preview it here.
                      </div>
                    )}
                  </div>
                </aside>
              </div>

              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Plus />}
                  {saving ? "Creating..." : "Create asset"}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}