import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AssetCard from "@/components/ui/assert-card";
import AssetThumbnail from "../../asset-preview/AssetThumbnail";
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

const getTitle = (type: AssetType) => ASSET_TYPES.find((option) => option.value === type)?.label ?? "";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const assetsPerPage = 20;

  useEffect(() => {
    async function loadAssets() {
      setLoading(true); setError(null); setAssets([]); setSelectedAsset(null); setCurrentPage(1); setCategoryFilter("all"); setDetailPage(1);
      try {
        let data: Asset[] = [];
        if (type === "furniture") data = await getFurnitureAssets();
        if (type === "wall") data = await getWallAssets();
        if (type === "floor") data = await getFloorAssets();
        setAssets(data);
        data.forEach((asset) => { if ((asset.asset_type === "floor" || asset.asset_type === "wall") && asset.diffuse_path) loadTexture(asset.diffuse_path, { repeat: [1, 1], anisotropy: 8 }); });
      } catch (err) { console.error("Failed to load assets:", err); setAssets([]); setError("Failed to load assets."); } finally { setLoading(false); }
    }
    loadAssets();
  }, [type]);

  const categories = useMemo(() => { const unique = Array.from(new Set(assets.map((asset) => asset.category).filter(Boolean))); return unique.sort((a, b) => a.localeCompare(b)); }, [assets]);

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
  const handleTypeChange = (value: AssetType) => { setSearch(""); setCategoryFilter("all"); setCurrentPage(1); setDetailPage(1); onTypeChange?.(value); };
  const handleSelectAsset = (asset: Asset) => { setSelectedAsset(asset); setSaveError(null); setEditName(asset.name); setEditPrice(String(asset.price)); setEditStatus(asset.asset_status ?? "available"); setDetailPage(1); };

  const handleNext = () => { if (!selectedAsset) return; setSaveError(null); setEditName(selectedAsset.name); setEditPrice(String(selectedAsset.price)); setEditStatus(selectedAsset.asset_status ?? "available"); setDetailPage(2); };

  const handleDiscard = () => { if (!selectedAsset) return; setSaveError(null); setEditName(selectedAsset.name); setEditPrice(String(selectedAsset.price)); setEditStatus(selectedAsset.asset_status ?? "available"); setDetailPage(1); };

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
      setAssets((current) => current.map((asset) => asset.id === updatedAsset.id ? updatedAsset : asset));
      setDetailPage(1);
    } catch (err) { console.error("Failed to update asset:", err); setSaveError("Failed to save changes. Please try again."); } finally { setSaving(false); }
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
              {categories.map((category) => (<SelectItem key={category} value={category}>{category}</SelectItem>))}
            </SelectContent>
          </Select>
          <Input placeholder={`Search ${getTitle(type).toLowerCase()}...`} value={search} onChange={(event) => handleSearch(event.target.value)} className="w-64 bg-background" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 shrink-0 overflow-hidden p-2">
          {!selectedAsset ? (
            <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">Select an asset to preview</div>
          ) : detailPage === 1 ? (
            <div className="flex h-full flex-col">
              <div className="h-56 shrink-0 overflow-hidden rounded-2xl bg-muted">
                {selectedAsset.asset_type === "furniture" ? (
                  <AssetThumbnail asset={selectedAsset} />
                ) : (
                  <PreviewScene asset={selectedAsset} />
                )}
              </div>
              <div className="mt-4"><h3 className="text-base font-semibold">{selectedAsset.name}</h3></div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Price</p><p className="mt-1 text-sm font-semibold">${selectedAsset.price}</p></div>
                <div><p className="text-xs text-muted-foreground">Category</p><span className="mt-1 inline-flex max-w-full rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"><span className="truncate">{selectedAsset.category}</span></span></div>
              </div>
              <div className="mt-4 grid grid-cols-2 items-center gap-4">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm">{selectedAsset.asset_status === "not_available" ? "Not Available" : "Available"}</p>
              </div>
              <div className="mt-auto pt-4">
                <button type="button" onClick={handleNext} className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90">Edit</button>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <h3 className="text-base font-semibold">Edit Asset</h3>
                <button type="button" onClick={() => setDetailPage(1)} className="text-xs text-muted-foreground hover:text-foreground">Back</button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-medium">Asset Preview</label>
                  <div className="h-36 overflow-hidden rounded-xl border border-border bg-muted">
                    <AssetThumbnail asset={selectedAsset} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Name</label>
                  <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Price</label>
                    <Input type="number" min="0" value={editPrice} onChange={(event) => setEditPrice(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Status</label>
                    <Select value={editStatus} onValueChange={(value) => setEditStatus(value as AssetStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="not_available">Not Available</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Category</label>
                    <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">{selectedAsset.category}</div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Asset Type</label>
                    <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm capitalize text-muted-foreground">{selectedAsset.asset_type}</div>
                  </div>
                </div>

                {(selectedAsset.color || selectedAsset.roughness != null || selectedAsset.metalness != null) && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="mb-2 text-xs font-medium">Material</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {selectedAsset.color && (<div><p className="text-muted-foreground">Color</p><p className="mt-1">{selectedAsset.color}</p></div>)}
                      {selectedAsset.roughness != null && (<div><p className="text-muted-foreground">Roughness</p><p className="mt-1">{selectedAsset.roughness}</p></div>)}
                      {selectedAsset.metalness != null && (<div><p className="text-muted-foreground">Metalness</p><p className="mt-1">{selectedAsset.metalness}</p></div>)}
                    </div>
                  </div>
                )}

                {(selectedAsset.storage_path || selectedAsset.diffuse_path) && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="mb-2 text-xs font-medium">Files</p>
                    <div className="space-y-2 text-xs">
                      {selectedAsset.storage_path && (<div><p className="text-muted-foreground">Model</p><p className="break-all">{selectedAsset.storage_path}</p></div>)}
                      {selectedAsset.diffuse_path && (<div><p className="text-muted-foreground">Diffuse</p><p className="break-all">{selectedAsset.diffuse_path}</p></div>)}
                    </div>
                  </div>
                )}
              </div>

              {saveError && (<p className="mt-3 shrink-0 text-xs text-destructive">{saveError}</p>)}

              <div className="mt-3 flex shrink-0 gap-2 border-t border-border pt-3">
                <button type="button" disabled={saving} onClick={handleDiscard} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">Discard</button>
                <button type="button" disabled={saving} onClick={() => setConfirmOpen(true)} className="flex-1 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50">Confirm</button>
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
                    <AssetCard preview={<AssetThumbnail asset={asset} />} title={asset.name} categories={[asset.category]} className="max-w-none" />
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
                  <PaginationPrevious href="#" onClick={(event) => { event.preventDefault(); goToPage(currentPage - 1); }} className={currentPage === 1 ? "pointer-events-none opacity-50" : ""} />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink href="#" isActive={currentPage === page} onClick={(event) => { event.preventDefault(); goToPage(page); }}>{page}</PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext href="#" onClick={(event) => { event.preventDefault(); goToPage(currentPage + 1); }} className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save these changes to <strong>{selectedAsset?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={async (event) => { event.preventDefault(); setConfirmOpen(false); await handleSave(); }}>
              {saving ? "Saving..." : "Yes, Save Changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}