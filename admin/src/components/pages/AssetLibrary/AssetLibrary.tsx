import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import AssetCard from "@/components/ui/assert-card";
import PreviewScene from "@/components/asset-preview/PreviewScene";
import { loadTexture } from "@/components/asset-preview/assetPreviewUtils";
import { getFurnitureAssets } from "@/services/assets/furniture";
import { getWallAssets } from "@/services/assets/walls";
import { getFloorAssets } from "@/services/assets/floors";
import { updateAsset } from "@/services/assets/update";
import type { Asset, AssetType, AssetStatus } from "@/services/assets/asset-types";

interface AssetLibraryProps { type: AssetType; onTypeChange?: (type: AssetType) => void; }

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "furniture", label: "Furniture" },
  { value: "wall", label: "Wall" },
  { value: "floor", label: "Floor" },
];

const getTitle = (type: AssetType) => ASSET_TYPES.find((o) => o.value === type)?.label ?? "";

export default function AssetLibrary({ type, onTypeChange }: AssetLibraryProps) {
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
  const [editStatus, setEditStatus] = useState<AssetStatus>("available");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const assetsPerPage = 20;

  useEffect(() => {
    async function loadAssets() {
      setLoading(true); setError(null); setAssets([]); setSelectedAsset(null);
      setCurrentPage(1); setCategoryFilter("all"); setDetailPage(1);
      try {
        let data: Asset[] = [];
        if (type === "furniture") data = await getFurnitureAssets();
        if (type === "wall") data = await getWallAssets();
        if (type === "floor") data = await getFloorAssets();
        setAssets(data);
        data.forEach((asset) => {
          if ((asset.asset_type === "floor" || asset.asset_type === "wall") && asset.diffuse_path)
            loadTexture(asset.diffuse_path, { repeat: [1, 1], anisotropy: 8 });
        });
      } catch (err) {
        console.error("Failed to load assets:", err);
        setAssets([]); setError("Failed to load assets.");
      } finally { setLoading(false); }
    }
    loadAssets();
  }, [type]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(assets.map((a) => a.category).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const filtered = useMemo(() => {
    const searchValue = search.toLowerCase().trim();
    return assets.filter((asset) => {
      const matchesCategory = categoryFilter === "all" || asset.category === categoryFilter;
      const matchesSearch = !searchValue || asset.name.toLowerCase().includes(searchValue) || asset.category.toLowerCase().includes(searchValue);
      return matchesCategory && matchesSearch;
    });
  }, [assets, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / assetsPerPage));
  const startIndex = (currentPage - 1) * assetsPerPage;
  const paginatedAssets = filtered.slice(startIndex, startIndex + assetsPerPage);

  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const handleSearch = (value: string) => { setSearch(value); setCurrentPage(1); };
  const handleCategoryChange = (value: string | null) => { if (value === null) return; setCategoryFilter(value); setCurrentPage(1); };
  const goToPage = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };
  const OnTypeChange = (value: AssetType) => { setSearch(""); setCategoryFilter("all"); setCurrentPage(1); setDetailPage(1); onTypeChange?.(value); };

  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset); setSaveError(null); setEditName(asset.name);
    setEditPrice(String(asset.price)); setEditStatus(asset.asset_status ?? "available"); setDetailPage(1);
  };

  const handleNext = () => {
    if (!selectedAsset) return;
    setSaveError(null); setEditName(selectedAsset.name);
    setEditPrice(String(selectedAsset.price)); setEditStatus(selectedAsset.asset_status ?? "available"); setDetailPage(2);
  };

  const handleDiscard = () => {
    if (!selectedAsset) return;
    setSaveError(null); setEditName(selectedAsset.name);
    setEditPrice(String(selectedAsset.price)); setEditStatus(selectedAsset.asset_status ?? "available"); setDetailPage(1);
  };

  const handleSave = async () => {
    if (!selectedAsset) return;
    const trimmedName = editName.trim();
    const numericPrice = Number(editPrice);
    setSaveError(null);
    if (!trimmedName) { setSaveError("Asset name is required."); return; }
    if (!Number.isFinite(numericPrice) || numericPrice < 0) { setSaveError("Price must be a valid number that is 0 or greater."); return; }
    try {
      setSaving(true);
      await updateAsset(selectedAsset.id, { name: trimmedName, price: numericPrice, asset_status: editStatus });
      const updatedAsset: Asset = { ...selectedAsset, name: trimmedName, price: numericPrice, asset_status: editStatus };
      setSelectedAsset(updatedAsset);
      setAssets((current) => current.map((a) => a.id === updatedAsset.id ? updatedAsset : a));
      setDetailPage(1);
    } catch (err) {
      console.error("Failed to update asset:", err);
      setSaveError("Failed to save changes. Please try again.");
    } finally { setSaving(false); }
  };

  const getAssetImage = (asset: Asset): string | null => {
    if (asset.thumbnail_path) return asset.thumbnail_path;
    if (asset.color) {
      const encoded = asset.color.replace("#", "%23");
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='100%25' height='100%25' fill='${encoded}'/%3E%3C/svg%3E`;
    }
    return null;
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">{getTitle(type)}</h2>
          <p className="text-xs text-muted-foreground">Manage {getTitle(type).toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-36 bg-background"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder={`Search ${getTitle(type).toLowerCase()}...`} value={search} onChange={(e) => handleSearch(e.target.value)} className="w-64 bg-background" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 shrink-0 overflow-hidden p-2">
          {!selectedAsset ? (
            <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">Select an asset to preview</div>
          ) : detailPage === 1 ? (
            <div className="flex h-full flex-col">
              <div className="h-56 shrink-0 overflow-hidden rounded-2xl bg-muted"><PreviewScene asset={selectedAsset} /></div>
              <div className="mt-4"><h3 className="text-base font-semibold">{selectedAsset.name}</h3></div>
              <div className="mt-3"><p className="text-xs text-muted-foreground">Price</p><p className="text-sm font-semibold">${selectedAsset.price}</p></div>
              <div className="mt-3"><p className="text-xs text-muted-foreground">Category</p><span className="mt-1 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{selectedAsset.category}</span></div>
              <div className="mt-3"><p className="text-xs text-muted-foreground">Status</p><p className="mt-1 text-sm">{selectedAsset.asset_status === "not_available" ? "Not Available" : "Available"}</p></div>
              <div className="mt-auto pt-4"><button type="button" onClick={handleNext} className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90">Edit</button></div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">Edit Asset</h3>
                <button type="button" onClick={() => setDetailPage(1)} className="text-xs text-muted-foreground hover:text-foreground">Back</button>
              </div>
              <div className="space-y-2"><label className="text-xs font-medium">Name</label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div className="mt-4 space-y-2"><label className="text-xs font-medium">Price</label><Input type="number" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} /></div>
              <div className="mt-4 space-y-2"><label className="text-xs font-medium">Category</label><div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">{selectedAsset.category}</div></div>
              <div className="mt-4 space-y-2"><label className="text-xs font-medium">Asset Type</label><div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">{selectedAsset.asset_type}</div></div>
              <div className="mt-4 space-y-2">
                <label className="text-xs font-medium">Asset Status</label>
                <Select value={editStatus} onValueChange={(value) => setEditStatus(value as AssetStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="not_available">Not Available</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium">Description</p>
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                  {Object.entries(selectedAsset).filter(([key]) => !["id", "name", "price", "asset_status", "created_at", "updated_at"].includes(key)).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="text-right">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {saveError && <p className="mt-4 text-xs text-destructive">{saveError}</p>}
              <div className="mt-auto flex gap-2 pt-4">
                <button type="button" disabled={saving} onClick={handleDiscard} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">Discard Changes</button>
                <button type="button" disabled={saving} onClick={handleSave} className="flex-1 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50">{saving ? "Saving..." : "Confirm Changes"}</button>
              </div>
            </div>
          )}
        </div>

        <Separator orientation="vertical" className="h-auto" />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading {getTitle(type).toLowerCase()}...</div>
            ) : error ? (
              <div className="flex h-full items-center justify-center text-sm text-destructive">{error}</div>
            ) : paginatedAssets.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No {getTitle(type).toLowerCase()} found.</div>
            ) : (
              <div className="grid grid-cols-5 gap-4">
                {paginatedAssets.map((asset) => (
                  <button key={asset.id} type="button" onClick={() => handleSelectAsset(asset)} className={`rounded-3xl text-left transition-shadow ${selectedAsset?.id === asset.id ? "ring-2 ring-offset-2 ring-[#6b8050]" : ""}`}>
                    <AssetCard image={getAssetImage(asset)} title={asset.name} categories={[asset.category]} className="max-w-none" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {filtered.length > 0 ? `Showing ${startIndex + 1}-${Math.min(startIndex + assetsPerPage, filtered.length)} of ${filtered.length}` : "Showing 0 of 0"}
            </p>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); goToPage(currentPage - 1); }} className={currentPage === 1 ? "pointer-events-none opacity-50" : ""} />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink href="#" isActive={currentPage === page} onClick={(e) => { e.preventDefault(); goToPage(page); }}>{page}</PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext href="#" onClick={(e) => { e.preventDefault(); goToPage(currentPage + 1); }} className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>
    </div>
  );
}