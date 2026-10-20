import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Info, Search } from "lucide-react";

import { getFurnitureAssets } from "../engine/furniture/FirebaseFurnitureLibrary";
import { getFloorMaterials } from "../engine/materials/floors";
import { getWallMaterials } from "../engine/materials/walls";
import NavBar from "./NavBar";

import type { Asset } from "../assets/Asset";
import type { Material } from "../engine/materials/MaterialTypes";
import type { FurnitureCategory } from "../engine/furniture/FurnitureCategory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Division = "furniture" | "floors" | "walls";
type FloorCategory = "Wood" | "Tiles" | "Bricks";

interface LibraryItem {
  id: string;
  type: Division;
  name: string;
  price: string;
  priceValue: number;
  /** Raw category key used for filtering */
  category?: string;
  /** Text shown at the bottom-left of the card */
  label: string;
  /** Furniture + floors */
  image?: string;
  /** Walls only */
  color?: string;
}

type SortKey = "default" | "priceAsc" | "priceDesc" | "nameAsc";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const COLUMNS = 4;
const ROWS = 3;
const ITEMS_PER_PAGE = COLUMNS * ROWS; // 12

// Put the hero image in /public (e.g. /public/library-hero.jpg) and point this at it.
const LIBRARY_HERO_IMAGE = `${import.meta.env.BASE_URL}background/library-bg.jpg`;
const HERO_SURFACE = "#f4f4f2"; // should match the image's light background

const DIVISIONS: { key: Division; label: string }[] = [
  { key: "furniture", label: "Furniture" },
  { key: "floors", label: "Floors" },
  { key: "walls", label: "Walls" },
];

const FURNITURE_CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  livingRoom: "Living Room",
  bedroom: "Bedroom",
  diningRoom: "Dining Room",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  office: "Office",
};

const CATEGORY_OPTIONS: Record<
  Division,
  { value: string; label: string }[]
> = {
  furniture: [
    { value: "all", label: "All" },
    ...(Object.keys(FURNITURE_CATEGORY_LABELS) as FurnitureCategory[]).map(
      (k) => ({ value: k, label: FURNITURE_CATEGORY_LABELS[k] }),
    ),
  ],
  floors: [
    { value: "all", label: "All" },
    { value: "Wood", label: "Wood" },
    { value: "Tiles", label: "Tiles" },
    { value: "Bricks", label: "Bricks" },
  ],
  walls: [{ value: "all", label: "All" }],
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "nameAsc", label: "Name (A–Z)" },
  { value: "priceAsc", label: "Price (low to high)" },
  { value: "priceDesc", label: "Price (high to low)" },
];

// ---------------------------------------------------------------------------
// Firebase → Library mapping helpers
// ---------------------------------------------------------------------------
function peso(price: number): string {
  return `₱${Number.isFinite(price) ? price.toLocaleString() : "0"}`;
}

function normalizeFloorCategory(raw?: string): FloorCategory | undefined {
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

function mapFurnitureAsset(asset: Asset): LibraryItem {
  const price = asset.price ?? 0;
  return {
    id: asset.id,
    type: "furniture",
    name: asset.name,
    price: peso(price),
    priceValue: Number.isFinite(price) ? price : 0,
    category: asset.furnitureCategory,
    label: asset.furnitureCategory
      ? FURNITURE_CATEGORY_LABELS[asset.furnitureCategory]
      : "Furniture",
    image: asset.thumbnail ?? "",
  };
}

function mapFloorMaterial(material: Material): LibraryItem | null {
  const image = material.thumbnail?.trim() || material.texture?.trim() || "";
  if (!image) return null;

  const price = material.pricePerSquareMeter ?? 0;
  const category = normalizeFloorCategory(material.sourceCategory);

  return {
    id: material.id,
    type: "floors",
    name: material.name,
    price: `${peso(price)} / sqm`,
    priceValue: Number.isFinite(price) ? price : 0,
    category,
    label: category ?? "Floor",
    image,
  };
}

function mapWallMaterial(material: Material): LibraryItem {
  const price = material.pricePerSquareMeter ?? 0;
  return {
    id: material.id,
    type: "walls",
    name: material.name,
    price: peso(price),
    priceValue: Number.isFinite(price) ? price : 0,
    label: "Paint",
    color: (material.color && material.color.trim()) || "#cccccc",
  };
}

// ---------------------------------------------------------------------------
// Hero: full-width first division of the page (image + intro text).
// The navbar floats over the top of it.
// ---------------------------------------------------------------------------
interface HeroStat {
  label: string;
  value: number;
  loading: boolean;
}

function LibraryHero({ stats }: { stats: HeroStat[] }) {
  const [mounted, setMounted] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section
      aria-labelledby="library-title"
      className="relative flex w-full flex-col overflow-hidden md:block md:h-[clamp(440px,42vw,640px)]"
      style={{ backgroundColor: HERO_SURFACE }}
    >
      {/* Image: fills the whole division on desktop, sits below the text on mobile */}
      <div className="relative order-2 h-56 md:absolute md:inset-0 md:h-full">
        {!imageFailed && (
          <img
            src={LIBRARY_HERO_IMAGE}
            alt=""
            aria-hidden="true"
            draggable={false}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
            className={`h-full w-full object-cover object-right transition-all duration-1000 ease-out motion-reduce:transition-none ${
              imageLoaded ? "scale-100 opacity-100" : "scale-105 opacity-0"
            }`}
          />
        )}
      </div>

      {/* Soft fade on the left so the text always reads cleanly */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden md:block"
        style={{
          background: `linear-gradient(to right, ${HERO_SURFACE} 0%, rgba(244,244,242,0) 48%)`,
        }}
      />

      {/* Text, aligned with the page content below; top padding clears the navbar */}
      <div className="relative z-10 order-1 mx-auto w-full max-w-[1400px] px-6 pb-6 pt-24 md:flex md:h-full md:items-center md:px-10 md:pb-0 md:pt-[72px]">
        <div
          className={`transition-all duration-700 ease-out motion-reduce:transition-none md:max-w-[46%] ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <h1
            id="library-title"
            className="mt-3 text-4xl font-semibold tracking-tight text-[#1b1b1b] md:text-5xl"
          >
            Our collection
          </h1>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-black/55">
            Furniture, floors and wall colors to design your space. Browse,
            compare and pick what fits.
          </p>

          <ul className="mt-6 flex items-center gap-5">
            {stats.map((stat, index) => (
              <li
                key={stat.label}
                className={`flex items-baseline gap-1.5 ${
                  index > 0 ? "border-l border-black/10 pl-5" : ""
                }`}
              >
                <span className="text-[15px] font-semibold tabular-nums text-[#1b1b1b]">
                  {stat.loading ? "–" : stat.value}
                </span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-black/45">
                  {stat.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Filter select (styled native select with a tiny label inside)
// ---------------------------------------------------------------------------
function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`relative block ${disabled ? "opacity-50" : ""}`}
      aria-label={label}
    >
      <span className="pointer-events-none absolute left-3 top-1.5 text-[8px] font-medium uppercase tracking-[0.12em] text-black/50">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-[38px] w-full cursor-pointer appearance-none rounded-md border border-black/15 bg-white px-3 pb-0 pt-3.5 text-[11px] font-medium text-[#1b1b1b] outline-none transition hover:border-black/35 focus:border-black/60 disabled:cursor-not-allowed [&>option]:bg-white [&>option]:text-[#1b1b1b]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/60"
        strokeWidth={1.75}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Collection card
// ---------------------------------------------------------------------------
function CollectionCard({ item }: { item: LibraryItem }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = Boolean(item.image?.trim()) && !imgError;
  const isFurniture = item.type === "furniture";

  return (
    <article className="flex aspect-[4/5] flex-col rounded-xl bg-black/[0.05] p-3.5 transition-colors duration-200 hover:bg-black/[0.08]">
      {/* top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[12px] font-medium leading-tight text-[#1b1b1b]">
            {item.name}
          </h3>
          <p className="mt-0.5 truncate text-[9px] uppercase tracking-wide text-black/45">
            {item.price}
          </p>
        </div>
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-black/5 text-black/60"
          aria-hidden
        >
          <Info className="h-2.5 w-2.5" strokeWidth={2} />
        </span>
      </div>

      {/* swatch */}
      <div className="flex min-h-0 flex-1 items-center justify-center py-3">
        {isFurniture ? (
          // Furniture: no backdrop, just the object with a soft shadow
          <div className="relative h-full w-full">
            {/* ground shadow */}
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-[6%] left-1/2 h-[9%] w-[62%] -translate-x-1/2 rounded-[50%] bg-black/25 blur-md"
            />
            <div className="relative h-full w-full drop-shadow-[0_6px_8px_rgba(0,0,0,0.18)]">
              {hasImage ? (
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-wider text-black/30">
                  Preview unavailable
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative h-full max-h-[78%] w-[56%] overflow-hidden rounded-[3px] bg-[#ececec] shadow-[0_1px_3px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
            {item.type === "walls" ? (
              <div
                className="h-full w-full"
                style={{ backgroundColor: item.color }}
              />
            ) : hasImage ? (
              <img
                src={item.image}
                alt={item.name}
                loading="lazy"
                onError={() => setImgError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-wider text-black/30">
                No preview
              </div>
            )}
          </div>
        )}
      </div>

      {/* bottom label */}
      <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-black/55">
        {item.label}
      </p>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="aspect-[4/5] animate-pulse rounded-xl bg-black/[0.06]" />
  );
}

// ---------------------------------------------------------------------------
// Page dots
// ---------------------------------------------------------------------------
function PageDots({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return <div />;

  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          onClick={() => onChange(page)}
          aria-label={`Page ${page}`}
          aria-current={page === currentPage}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            page === currentPage
              ? "w-3 bg-[#1b1b1b]"
              : "w-1.5 bg-black/25 hover:bg-black/50"
          }`}
        />
      ))}
    </div>
  );
}

function RoundArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "next" ? ChevronRight : ChevronLeft;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "next" ? "Next page" : "Previous page"}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1b1b1b] text-white shadow-md transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LibraryPage() {
  const [division, setDivision] = useState<Division>("furniture");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("default");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  //--------------------------------------------------
  // Firebase-backed state
  //--------------------------------------------------
  const [furnitureItems, setFurnitureItems] = useState<LibraryItem[]>([]);
  const [floorItems, setFloorItems] = useState<LibraryItem[]>([]);
  const [wallItems, setWallItems] = useState<LibraryItem[]>([]);

  const [loading, setLoading] = useState<Record<Division, boolean>>({
    furniture: true,
    floors: true,
    walls: true,
  });

  useEffect(() => {
    let cancelled = false;

    const done = (key: Division) => {
      if (!cancelled) setLoading((prev) => ({ ...prev, [key]: false }));
    };

    getFurnitureAssets()
      .then((assets) => {
        if (!cancelled) setFurnitureItems(assets.map(mapFurnitureAsset));
      })
      .catch((err) => {
        console.error("Failed to load furniture assets:", err);
        if (!cancelled) setFurnitureItems([]);
      })
      .finally(() => done("furniture"));

    getFloorMaterials()
      .then((materials) => {
        if (cancelled) return;
        setFloorItems(
          materials
            .map(mapFloorMaterial)
            .filter((x): x is LibraryItem => Boolean(x)),
        );
      })
      .catch((err) => {
        console.error("Failed to load floor materials:", err);
        if (!cancelled) setFloorItems([]);
      })
      .finally(() => done("floors"));

    getWallMaterials()
      .then((materials) => {
        if (!cancelled) setWallItems(materials.map(mapWallMaterial));
      })
      .catch((err) => {
        console.error("Failed to load wall materials:", err);
        if (!cancelled) setWallItems([]);
      })
      .finally(() => done("walls"));

    return () => {
      cancelled = true;
    };
  }, []);

  // Reset to the first page whenever the visible set changes
  useEffect(() => {
    setPage(1);
  }, [division, category, sort, query]);

  const switchDivision = (next: Division) => {
    setDivision(next);
    setCategory("all");
  };

  const source =
    division === "furniture"
      ? furnitureItems
      : division === "floors"
        ? floorItems
        : wallItems;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = source.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });

    if (sort === "nameAsc") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "priceAsc") {
      list = [...list].sort((a, b) => a.priceValue - b.priceValue);
    } else if (sort === "priceDesc") {
      list = [...list].sort((a, b) => b.priceValue - a.priceValue);
    }

    return list;
  }, [source, category, sort, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const isLoading = loading[division];
  const title = DIVISIONS.find((d) => d.key === division)?.label ?? "";

  const heroStats: HeroStat[] = [
    { label: "Furniture", value: furnitureItems.length, loading: loading.furniture },
    { label: "Floors", value: floorItems.length, loading: loading.floors },
    { label: "Walls", value: wallItems.length, loading: loading.walls },
  ];

  return (
    <div className="min-h-screen w-full bg-white font-sans text-[#1b1b1b] antialiased">
      <NavBar />

      {/* Division 1: full-width hero (image + intro text) */}
      <LibraryHero stats={heroStats} />

      {/* Division 2: the collection */}
      <main className="mx-auto max-w-[1400px] px-6 pb-16 pt-10 md:px-10">
        {/* Division tabs */}
        <div className="mb-4 flex items-center gap-2">
          {DIVISIONS.map((d) => (
            <button
              key={d.key}
              onClick={() => switchDivision(d.key)}
              className={`rounded-full border px-4 py-1.5 text-[11px] font-medium transition ${
                division === d.key
                  ? "border-[#1b1b1b] bg-[#1b1b1b] text-white"
                  : "border-black/20 text-black/60 hover:border-black/50 hover:text-[#1b1b1b]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FilterSelect
            label="Category"
            value={category}
            options={CATEGORY_OPTIONS[division]}
            onChange={setCategory}
            disabled={division === "walls"}
          />
          <FilterSelect
            label="Sort by"
            value={sort}
            options={SORT_OPTIONS}
            onChange={(v) => setSort(v as SortKey)}
          />
          <label className="relative block" aria-label="Search">
            <span className="pointer-events-none absolute left-3 top-1.5 text-[8px] font-medium uppercase tracking-[0.12em] text-black/50">
              Search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}`}
              className="h-[38px] w-full rounded-md border border-black/15 bg-white px-3 pb-0 pr-9 pt-3.5 text-[11px] font-medium text-[#1b1b1b] outline-none transition placeholder:text-black/30 hover:border-black/35 focus:border-black/60"
            />
            <Search
              className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/60"
              strokeWidth={1.75}
            />
          </label>
        </div>

        {/* Grid: 4 columns x 3 rows */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: ITEMS_PER_PAGE }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center rounded-xl bg-black/[0.05] text-[13px] text-black/45">
            Nothing matches these filters. Clear the search or pick another
            category.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {paginated.map((item) => (
              <CollectionCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        )}

        {/* Footer: dots + count + page arrows */}
        <div className="mt-6 flex items-center justify-between gap-4">
          <PageDots
            currentPage={safePage}
            totalPages={totalPages}
            onChange={setPage}
          />
          <div className="flex items-center gap-4">
            <p className="text-[11px] text-black/45">
              {filtered.length > 0
                ? `${startIndex + 1}–${Math.min(
                    startIndex + ITEMS_PER_PAGE,
                    filtered.length,
                  )} of ${filtered.length}`
                : "0 items"}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <RoundArrow
                  direction="prev"
                  disabled={safePage === 1}
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                />
                <RoundArrow
                  direction="next"
                  disabled={safePage === totalPages}
                  onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}