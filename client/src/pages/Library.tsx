import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Armchair,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Check,
} from "lucide-react";

import { getFurnitureAssets } from "../engine/furniture/FirebaseFurnitureLibrary";
import { getFloorMaterials } from "../engine/materials/floors";
import { getWallMaterials } from "../engine/materials/walls";

import type { Asset } from "../assets/Asset";
import type { Material } from "../engine/materials/MaterialTypes";
import type { FurnitureCategory } from "../engine/furniture/FurnitureCategory";

import AssetModelThumbnail from "../Studio/Workspace/AssetModelThumbnail";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Division = "furniture" | "floors" | "walls";
type FloorCategory = "Wood" | "Tiles" | "Bricks";
type FurnitureFilter = "All" | FurnitureCategory;

interface BaseItem {
  id: string;
  name: string;
  description: string;
  type: Division;
  price: string;
}

interface FurnitureItem extends BaseItem {
  type: "furniture";
  image: string;
  model: string;
  category?: FurnitureCategory;
}

interface FloorItem extends BaseItem {
  type: "floors";
  image: string;
  category?: FloorCategory;
}

interface WallItem extends BaseItem {
  type: "walls";
  color: string;
}

type LibraryItem = FurnitureItem | FloorItem | WallItem;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DESCRIPTION_FALLBACK = "No description available.";

const FLOOR_CATEGORIES: ("All" | FloorCategory)[] = [
  "All",
  "Wood",
  "Tiles",
  "Bricks",
];

const FURNITURE_CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  livingRoom: "Living Room",
  bedroom: "Bedroom",
  diningRoom: "Dining Room",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  office: "Office",
};

const FURNITURE_CATEGORIES: FurnitureFilter[] = [
  "All",
  "livingRoom",
  "bedroom",
  "diningRoom",
  "kitchen",
  "bathroom",
  "office",
];

const ASSETS_PER_PAGE = 20;

// ---------------------------------------------------------------------------
// Firebase → Library mapping helpers
// ---------------------------------------------------------------------------
function formatFurniturePrice(price: number): string {
  return `₱${Number.isFinite(price) ? price.toLocaleString() : "0"}`;
}

function formatFloorPrice(price: number): string {
  return `₱${Number.isFinite(price) ? price.toLocaleString() : "0"} / sqm`;
}

function formatWallPrice(price: number): string {
  return `₱${Number.isFinite(price) ? price.toLocaleString() : "0"}`;
}

function normalizeFloorCategory(
  raw?: string,
): FloorCategory | undefined {
  if (typeof raw !== "string") return undefined;

  const value = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");

  switch (value) {
    case "wood":
    case "hardwood":
      return "Wood";
    case "tile":
    case "tiles":
    case "ceramic":
    case "porcelain":
      return "Tiles";
    case "brick":
    case "bricks":
      return "Bricks";
    default:
      return undefined;
  }
}

function mapFurnitureAsset(asset: Asset): FurnitureItem {
  return {
    id: asset.id,
    type: "furniture",
    name: asset.name,
    description: DESCRIPTION_FALLBACK,
    price: formatFurniturePrice(asset.price ?? 0),
    image: asset.thumbnail ?? "",
    model: asset.model ?? "",
    category: asset.furnitureCategory,
  };
}

function mapFloorMaterial(material: Material): FloorItem | null {
  const image =
    material.thumbnail?.trim() ||
    material.texture?.trim() ||
    "";

  if (!image) return null;

  return {
    id: material.id,
    type: "floors",
    name: material.name,
    description: DESCRIPTION_FALLBACK,
    price: formatFloorPrice(material.pricePerSquareMeter ?? 0),
    image,
    category: normalizeFloorCategory(material.sourceCategory),
  };
}

function mapWallMaterial(material: Material): WallItem {
  const color =
    (material.color && material.color.trim()) || "#cccccc";

  return {
    id: material.id,
    type: "walls",
    name: material.name,
    description: DESCRIPTION_FALLBACK,
    price: formatWallPrice(material.pricePerSquareMeter ?? 0),
    color,
  };
}

// ---------------------------------------------------------------------------
// Fade-blur transition veil
// ---------------------------------------------------------------------------
function TransitionVeil({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-50 transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-cream/40 backdrop-blur-sm" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reveal-on-scroll wrapper
// ---------------------------------------------------------------------------
function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "-10% 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transform-gpu transition-all duration-700 ease-out ${
        visible
          ? "translate-y-0 opacity-100 blur-0"
          : "translate-y-4 opacity-0 blur-sm"
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
function LoadingState() {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-[13px] text-ink/45">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-ink/15 border-t-ink/60"
        aria-hidden
      />
      Loading…
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pager
// ---------------------------------------------------------------------------
function Pager({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 bg-white text-ink/60 transition hover:border-ink/30 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onChange(page)}
          className={`flex h-8 min-w-[32px] items-center justify-center rounded-lg border px-2 text-[12px] font-medium transition ${
            currentPage === page
              ? "border-ink bg-ink text-white"
              : "border-ink/10 bg-white text-ink/60 hover:border-ink/30 hover:text-ink"
          }`}
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 bg-white text-ink/60 transition hover:border-ink/30 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next page"
      >
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------
function DetailPanel({ item }: { item: LibraryItem | null }) {
  const [veil, setVeil] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    const id = item?.id ?? null;
    if (id === lastId.current) return;
    lastId.current = id;
    setThumbError(false);
    setVeil(true);
    const t = setTimeout(() => setVeil(false), 260);
    return () => clearTimeout(t);
  }, [item]);

  if (!item) {
    return (
      <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-ink/15 bg-white/50 p-10 text-center">
        <Info className="mb-3 h-6 w-6 text-ink/30" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink/60">No item selected</p>
        <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-ink/40">
          Click any item to see its details.
        </p>
      </div>
    );
  }

  const isWall = item.type === "walls";
  const hasThumb =
    (item.type === "furniture" || item.type === "floors") &&
    Boolean(item.image?.trim()) &&
    !thumbError;

  return (
    <div className="relative flex h-full flex-col rounded-3xl border border-ink/8 bg-white/80 p-7 shadow-[0_1px_2px_rgba(0,0,0,0.02)] backdrop-blur-md">
      <div
        className={`flex h-full flex-col transition-all duration-300 ${
          veil ? "opacity-0 blur-sm" : "opacity-100 blur-0"
        }`}
      >
        {/* Preview */}
        <div className="mb-6 overflow-hidden rounded-2xl bg-cream">
          {isWall ? (
            <div
              className="h-52 w-full"
              style={{ backgroundColor: item.color }}
            />
          ) : hasThumb ? (
            <img
              src={item.image}
              alt={item.name}
              onError={() => setThumbError(true)}
              className="h-52 w-full object-cover transition-transform duration-500"
            />
          ) : item.type === "furniture" && item.model ? (
            <div className="h-52 w-full">
              <AssetModelThumbnail model={item.model} />
            </div>
          ) : (
            <div className="flex h-52 w-full items-center justify-center text-[11px] uppercase tracking-wider text-ink/30">
              No preview
            </div>
          )}
        </div>

        {/* Name + price row */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-2xl font-semibold tracking-tight text-ink">
            {item.name}
          </h3>
          <span className="text-lg font-semibold text-ink underline underline-offset-4">
            {item.price}
          </span>
        </div>

        {/* Category chip */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-ink/50">
            {item.type === "walls"
              ? "Paint"
              : item.type === "floors"
                ? "Floor"
                : "Furniture"}
          </span>
        </div>

        <p className="mt-4 text-[14px] leading-relaxed text-ink/65">
          {item.description}
        </p>

        {/* Details */}
        {isWall && (
          <dl className="mt-6 space-y-4 border-t border-ink/10 pt-5">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/40">
                Color
              </dt>
              <dd className="mt-2 flex items-center gap-2">
                <span
                  className="h-6 w-6 rounded-full border border-ink/10"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[13px] text-ink/80">{item.color}</span>
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic category dropdown
// ---------------------------------------------------------------------------
function CategoryDropdown<T extends string>({
  value,
  options,
  onChange,
  formatLabel,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  formatLabel?: (v: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const display = (v: T) => (formatLabel ? formatLabel(v) : v);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-ink/15 bg-white px-3.5 py-2 text-[12px] font-medium text-ink/75 transition hover:border-ink/30 hover:text-ink"
      >
        {display(value)}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${
            open ? "rotate-180" : "rotate-0"
          }`}
          strokeWidth={2}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-20 mt-2 min-w-[150px] overflow-hidden rounded-xl border border-ink/10 bg-white shadow-lg"
          style={{ animation: "fadeBlur 220ms ease" }}
        >
          {options.map((c) => (
            <button
              key={c}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2.5 text-left text-[12px] font-medium transition ${
                value === c
                  ? "bg-clay-500/10 text-clay-600"
                  : "text-ink/70 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              {display(c)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asset tile (floors + walls)
// ---------------------------------------------------------------------------
function AssetTile({
  item,
  active,
  onClick,
  showColorBlock,
}: {
  item: LibraryItem;
  active: boolean;
  onClick: () => void;
  showColorBlock: boolean;
}) {
  const [thumbError, setThumbError] = useState(false);

  const hasThumb =
    item.type === "floors" &&
    Boolean(item.image?.trim()) &&
    !thumbError;

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-all duration-300 ${
        active
          ? "border-[#6b8050] shadow-[0_0_0_3px_rgba(107,128,80,0.15)]"
          : "border-transparent hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-cream">
        {showColorBlock && item.type === "walls" ? (
          <div
            className="h-full w-full"
            style={{ backgroundColor: item.color }}
          />
        ) : hasThumb && item.type === "floors" ? (
          <img
            src={item.image}
            alt={item.name}
            onError={() => setThumbError(true)}
            className="h-full w-full scale-110 object-cover transition-transform duration-500 group-hover:scale-125"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wider text-ink/30">
            No preview
          </div>
        )}

        {active && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#6b8050] text-white shadow-md">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="truncate text-[13px] font-semibold text-ink">
          {item.name}
        </p>
        <span className="mt-1.5 inline-block rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink/45">
          {item.type === "walls"
            ? "paint"
            : item.type === "floors"
              ? "floor"
              : "furniture"}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Furniture tile
// ---------------------------------------------------------------------------
function FurnitureTile({
  item,
  active,
  onClick,
}: {
  item: FurnitureItem;
  active: boolean;
  onClick: () => void;
}) {
  const [thumbError, setThumbError] = useState(false);
  const hasThumb = Boolean(item.image?.trim()) && !thumbError;

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white p-2.5 text-left transition-all duration-300 ${
        active
          ? "border-clay-500 shadow-[0_0_0_3px_rgba(178,107,75,0.12)]"
          : "border-ink/8 hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-md"
      }`}
    >
      <div className="relative h-32 w-full overflow-hidden rounded-xl bg-cream">
        {hasThumb ? (
          <img
            src={item.image}
            alt={item.name}
            onError={() => setThumbError(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : item.model ? (
          <AssetModelThumbnail model={item.model} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wider text-ink/30">
            No preview
          </div>
        )}
        {active && (
          <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-clay-500 text-white shadow-md">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="mt-3 px-1 pb-1">
        <p className="truncate text-[13px] font-semibold text-ink">
          {item.name}
        </p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
const DIVISION_META: Record<
  Division,
  { label: string; title: string; blurb: string }
> = {
  furniture: {
    label: "",
    title: "Furniture Library",
    blurb:
      "Browse our curated furniture pieces. Scroll to see more options — click any item to see its details.",
  },
  floors: {
    label: "",
    title: "Floor Finishes",
    blurb:
      "Manage floor finishes — filter by type and click any finish to preview.",
  },
  walls: {
    label: "",
    title: "Wall Finishes",
    blurb:
      "Manage wall finishes — click any swatch to preview its colour.",
  },
};

function SectionHeader({ division }: { division: Division }) {
  const meta = DIVISION_META[division];
  return (
    <div className="mb-7 max-w-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-clay-500">
        {meta.label}
      </p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
        {meta.title}
      </h2>
      <p className="mt-2.5 text-[15px] leading-relaxed text-ink/55">
        {meta.blurb}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Furniture section
// ---------------------------------------------------------------------------
function FurnitureSection({
  items,
  loading,
  activeItem,
  onSelect,
}: {
  items: FurnitureItem[];
  loading: boolean;
  activeItem: LibraryItem | null;
  onSelect: (item: LibraryItem) => void;
}) {
  const [category, setCategory] = useState<FurnitureFilter>("All");

  const filtered = useMemo(() => {
    if (category === "All") return items;
    return items.filter((i) => i.category === category);
  }, [items, category]);

  const active =
    activeItem && activeItem.type === "furniture" ? activeItem : null;

  return (
    <section className="scroll-mt-24">
      <SectionHeader division="furniture" />
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_380px]">
        <div className="rounded-3xl border border-ink/8 bg-white/40 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink">
              Browse pieces
            </h3>
            <CategoryDropdown<FurnitureFilter>
              value={category}
              options={FURNITURE_CATEGORIES}
              onChange={setCategory}
              formatLabel={(v) =>
                v === "All" ? "All" : FURNITURE_CATEGORY_LABELS[v]
              }
            />
          </div>

          {loading ? (
            <div className="h-[520px]">
              <LoadingState />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-[520px] items-center justify-center text-[13px] text-ink/40">
              No furniture in this category.
            </div>
          ) : (
            <div className="grid max-h-[580px] grid-cols-2 gap-3.5 overflow-y-auto pr-1 sm:grid-cols-3">
              {filtered.map((item) => (
                <FurnitureTile
                  key={item.id}
                  item={item}
                  active={active?.id === item.id}
                  onClick={() => onSelect(item)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="lg:sticky lg:top-6 lg:h-[580px]">
          <DetailPanel item={active} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Floors section
// ---------------------------------------------------------------------------
function FloorsSection({
  items,
  loading,
  activeItem,
  onSelect,
}: {
  items: FloorItem[];
  loading: boolean;
  activeItem: LibraryItem | null;
  onSelect: (item: LibraryItem) => void;
}) {
  const [category, setCategory] = useState<"All" | FloorCategory>("All");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [category]);

  const filtered = useMemo(
    () =>
      category === "All"
        ? items
        : items.filter((i) => i.category === category),
    [items, category],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ASSETS_PER_PAGE));
  const startIndex = (page - 1) * ASSETS_PER_PAGE;
  const paginated = filtered.slice(startIndex, startIndex + ASSETS_PER_PAGE);

  const active = activeItem && activeItem.type === "floors" ? activeItem : null;

  return (
    <section className="scroll-mt-24">
      <SectionHeader division="floors" />

      <div className="flex h-[640px] overflow-hidden rounded-3xl border border-ink/8 bg-white/40">
        {/* LEFT — selected preview */}
        <div className="w-[320px] shrink-0 overflow-y-auto border-r border-ink/8 p-5">
          <DetailPanel item={active} />
        </div>

        {/* RIGHT — catalogue */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* toolbar */}
          <div className="flex items-center justify-between border-b border-ink/8 px-5 py-4">
            <div>
              <h3 className="text-[15px] font-semibold text-ink">
                Floor finishes
              </h3>
              <p className="mt-0.5 text-[12px] text-ink/45">
                Filter and browse by type
              </p>
            </div>
            <CategoryDropdown<"All" | FloorCategory>
              value={category}
              options={FLOOR_CATEGORIES}
              onChange={setCategory}
            />
          </div>

          {/* scrollable grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <LoadingState />
            ) : paginated.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[13px] text-ink/40">
                No finishes in this category.
              </div>
            ) : (
              <div
                key={`floors-${category}-${page}`}
                className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                style={{ animation: "fadeBlur 420ms ease" }}
              >
                {paginated.map((item) => (
                  <AssetTile
                    key={item.id}
                    item={item}
                    active={active?.id === item.id}
                    onClick={() => onSelect(item)}
                    showColorBlock={false}
                  />
                ))}
              </div>
            )}
          </div>

          {/* footer */}
          <div className="flex items-center justify-between border-t border-ink/8 px-5 py-3">
            <p className="text-[12px] text-ink/45">
              {filtered.length > 0
                ? `Showing ${startIndex + 1}-${Math.min(
                    startIndex + ASSETS_PER_PAGE,
                    filtered.length,
                  )} of ${filtered.length}`
                : "Showing 0 of 0"}
            </p>
            <Pager
              currentPage={page}
              totalPages={totalPages}
              onChange={setPage}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Walls section
// ---------------------------------------------------------------------------
function WallsSection({
  items,
  loading,
  activeItem,
  onSelect,
}: {
  items: WallItem[];
  loading: boolean;
  activeItem: LibraryItem | null;
  onSelect: (item: LibraryItem) => void;
}) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / ASSETS_PER_PAGE));
  const startIndex = (page - 1) * ASSETS_PER_PAGE;
  const paginated = items.slice(startIndex, startIndex + ASSETS_PER_PAGE);

  const active = activeItem && activeItem.type === "walls" ? activeItem : null;

  return (
    <section className="scroll-mt-24">
      <SectionHeader division="walls" />

      <div className="flex h-[640px] overflow-hidden rounded-3xl border border-ink/8 bg-white/40">
        {/* LEFT — selected preview */}
        <div className="w-[320px] shrink-0 overflow-y-auto border-r border-ink/8 p-5">
          <DetailPanel item={active} />
        </div>

        {/* RIGHT — catalogue */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* toolbar */}
          <div className="flex items-center justify-between border-b border-ink/8 px-5 py-4">
            <div>
              <h3 className="text-[15px] font-semibold text-ink">
                Wall finishes
              </h3>
              <p className="mt-0.5 text-[12px] text-ink/45">
                Browse all interior paint colours
              </p>
            </div>
          </div>

          {/* scrollable grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <LoadingState />
            ) : paginated.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[13px] text-ink/40">
                No wall finishes available.
              </div>
            ) : (
              <div
                key={`walls-${page}`}
                className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                style={{ animation: "fadeBlur 420ms ease" }}
              >
                {paginated.map((item) => (
                  <AssetTile
                    key={item.id}
                    item={item}
                    active={active?.id === item.id}
                    onClick={() => onSelect(item)}
                    showColorBlock={true}
                  />
                ))}
              </div>
            )}
          </div>

          {/* footer */}
          <div className="flex items-center justify-between border-t border-ink/8 px-5 py-3">
            <p className="text-[12px] text-ink/45">
              {items.length > 0
                ? `Showing ${startIndex + 1}-${Math.min(
                    startIndex + ASSETS_PER_PAGE,
                    items.length,
                  )} of ${items.length}`
                : "Showing 0 of 0"}
            </p>
            <Pager
              currentPage={page}
              totalPages={totalPages}
              onChange={setPage}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "Library", to: "/library" },
  { label: "Studio", to: "/studio" },
];

export default function LibraryPage() {
  const [activeItems, setActiveItems] = useState<
    Partial<Record<Division, LibraryItem>>
  >({});
  const [veil, setVeil] = useState(false);

  //--------------------------------------------------
  // Firebase-backed state
  //--------------------------------------------------
  const [furnitureItems, setFurnitureItems] = useState<FurnitureItem[]>([]);
  const [floorItems, setFloorItems] = useState<FloorItem[]>([]);
  const [wallItems, setWallItems] = useState<WallItem[]>([]);

  const [furnitureLoading, setFurnitureLoading] = useState(true);
  const [floorLoading, setFloorLoading] = useState(true);
  const [wallLoading, setWallLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    //--------------------------------------------------
    // Furniture
    //--------------------------------------------------
    getFurnitureAssets()
      .then((assets) => {
        if (cancelled) return;
        setFurnitureItems(assets.map(mapFurnitureAsset));
      })
      .catch((err) => {
        console.error("Failed to load furniture assets:", err);
        if (!cancelled) setFurnitureItems([]);
      })
      .finally(() => {
        if (!cancelled) setFurnitureLoading(false);
      });

    //--------------------------------------------------
    // Floors
    //--------------------------------------------------
    getFloorMaterials()
      .then((materials) => {
        if (cancelled) return;
        const mapped = materials
          .map(mapFloorMaterial)
          .filter((x): x is FloorItem => Boolean(x));
        setFloorItems(mapped);
      })
      .catch((err) => {
        console.error("Failed to load floor materials:", err);
        if (!cancelled) setFloorItems([]);
      })
      .finally(() => {
        if (!cancelled) setFloorLoading(false);
      });

    //--------------------------------------------------
    // Walls
    //--------------------------------------------------
    getWallMaterials()
      .then((materials) => {
        if (cancelled) return;
        setWallItems(materials.map(mapWallMaterial));
      })
      .catch((err) => {
        console.error("Failed to load wall materials:", err);
        if (!cancelled) setWallItems([]);
      })
      .finally(() => {
        if (!cancelled) setWallLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (item: LibraryItem) => {
    setVeil(true);
    setActiveItems((prev) => ({ ...prev, [item.type]: item }));
    window.setTimeout(() => setVeil(false), 220);
  };

  return (
    <div className="min-h-screen w-full bg-cream font-sans text-ink antialiased">
      <TransitionVeil active={veil} />

      {/* Nav */}
      <header className="border-b border-ink/8 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 md:px-10">
          <Link to="/" className="flex items-center gap-2.5">
            <Armchair className="h-5 w-5 text-ink" strokeWidth={1.5} />
            <span className="text-[15px] font-semibold uppercase tracking-[0.14em] text-ink">
              Espasyo
            </span>
          </Link>

          <nav className="hidden items-center gap-10 sm:flex">
            {NAV_LINKS.map((link) => {
              const active = link.label === "Library";
              return (
                <Link
                  key={link.label}
                  to={link.to}
                  className={`relative text-[12px] font-medium uppercase tracking-[0.14em] transition ${
                    active ? "text-ink" : "text-ink/55 hover:text-ink"
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute -bottom-1.5 left-0 h-[2px] w-full origin-left bg-ink transition-transform duration-300 ${
                      active ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          <Link
            to="/login"
            className="rounded-lg bg-ink px-5 py-2.5 text-[12px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-clay-700"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Intro */}
      <main className="mx-auto max-w-[1400px] px-6 py-14 md:px-10">
        <Reveal>
          <div className="mb-14 max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-clay-500">
              Material Library
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink md:text-5xl">
              Build your palette.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-ink/60">
              Three divisions — furniture, floors, and walls — each with a
              browsing panel and a detail panel. Click any item to see its
              details.
            </p>
          </div>
        </Reveal>

        <div className="space-y-28">
          <Reveal>
            <FurnitureSection
              items={furnitureItems}
              loading={furnitureLoading}
              activeItem={activeItems.furniture ?? null}
              onSelect={handleSelect}
            />
          </Reveal>
          <Reveal>
            <FloorsSection
              items={floorItems}
              loading={floorLoading}
              activeItem={activeItems.floors ?? null}
              onSelect={handleSelect}
            />
          </Reveal>
          <Reveal>
            <WallsSection
              items={wallItems}
              loading={wallLoading}
              activeItem={activeItems.walls ?? null}
              onSelect={handleSelect}
            />
          </Reveal>
        </div>

        <Reveal>
          <div className="mt-24 flex justify-center">
            <Link
              to="/studio"
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-[12px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-clay-700"
            >
              Continue to studio
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </Reveal>
      </main>

      <style>{`
        @keyframes fadeBlur {
          from { opacity: 0; filter: blur(6px); }
          to   { opacity: 1; filter: blur(0); }
        }
      `}</style>
    </div>
  );
}