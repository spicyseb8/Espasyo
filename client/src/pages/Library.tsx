// src/pages/LibraryPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import NavBar from "../pages/NavBar";
import {
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Info,
  Check,
  Ruler,
  Layers,
  Tag,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Division = "furniture" | "floors" | "walls";

interface BaseItem {
  id: string;
  name: string;
  description: string;
  type: Division;
  material: string;
  size: string;
  price: string;
}

interface FurnitureItem extends BaseItem {
  type: "furniture";
  image: string;
}

interface FloorItem extends BaseItem {
  type: "floors";
  image: string;
}

interface WallItem extends BaseItem {
  type: "walls";
  color: string;
}

type LibraryItem = FurnitureItem | FloorItem | WallItem;

// ---------------------------------------------------------------------------
// Floor textures
// ---------------------------------------------------------------------------
const FLOOR_TEXTURE = {
  chevronLightOak: "/textures/chevron-light-oak.jpg",
  chevronWeatheredOak: "/textures/chevron-weathered-oak.jpg",
  herringboneAgedOak: "/textures/herringbone-aged-oak.jpg",
  plankWalnut: "/textures/plank-walnut.jpg",
  plankCherryMahogany: "/textures/plank-cherry-mahogany.jpg",
  herringboneCherry: "/textures/herringbone-cherry.jpg",
  darkSlateStone: "/textures/dark-slate-stone.jpg",
  whiteVeinedMarble: "/textures/white-veined-marble.jpg",
} as const;

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------
const FURNITURE_ITEMS: FurnitureItem[] = [
  {
    id: "f1",
    type: "furniture",
    name: "Lounge Sofa",
    description:
      "Mid-century modern sofa with walnut legs and soft linen upholstery — designed for everyday comfort in a living room or lounge area.",
    material: "Linen upholstery, solid walnut legs",
    size: '84" W × 35" D × 32" H',
    price: "₱48,500",
    image:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=900&auto=format&fit=crop",
  },
  {
    id: "f2",
    type: "furniture",
    name: "Club Chair",
    description:
      "Classic club chair with velvet upholstery and a dark stained wood frame — a timeless accent piece for reading corners.",
    material: "Velvet, dark-stained oak",
    size: '32" W × 34" D × 30" H',
    price: "₱22,900",
    image:
      "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?q=80&w=900&auto=format&fit=crop",
  },
  {
    id: "f3",
    type: "furniture",
    name: "Wooden Table",
    description:
      "Modern dining table in solid ash with a minimalist profile and a matte protective finish.",
    material: "Solid ash, matte PU finish",
    size: '72" L × 36" W × 30" H',
    price: "₱31,200",
    image:
      "https://static.vecteezy.com/system/resources/thumbnails/051/068/514/small/modern-and-stylish-wooden-table-png.png",
  },
  {
    id: "f4",
    type: "furniture",
    name: "Accent Armchair",
    description:
      "Sculptural armchair with a curved backrest and boucle fabric — a soft focal point for any room.",
    material: "Boucle fabric, metal base",
    size: '30" W × 32" D × 29" H',
    price: "₱19,800",
    image:
      "https://images.unsplash.com/photo-1503602642458-232111445657?q=80&w=900&auto=format&fit=crop",
  },
  {
    id: "f5",
    type: "furniture",
    name: "Coffee Table",
    description:
      "Low-profile coffee table with a sculpted stone top and solid oak base — quietly elegant.",
    material: "Travertine top, oak base",
    size: '48" L × 24" W × 16" H',
    price: "₱26,400",
    image:
      "https://images.unsplash.com/photo-1567016432779-094069958ea5?q=80&w=900&auto=format&fit=crop",
  },
  {
    id: "f6",
    type: "furniture",
    name: "Bookshelf",
    description:
      "Open shelving unit in warm walnut with slim metal uprights — perfect for displaying objects and books.",
    material: "Walnut veneer, black metal",
    size: '36" W × 14" D × 72" H',
    price: "₱24,600",
    image:
      "https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?q=80&w=900&auto=format&fit=crop",
  },
  {
    id: "f7",
    type: "furniture",
    name: "Side Table",
    description:
      "Compact round side table with a tapered base — a versatile companion to any seating.",
    material: "Solid beech, satin finish",
    size: '18" ⌀ × 22" H',
    price: "₱8,900",
    image:
      "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?q=80&w=900&auto=format&fit=crop",
  },
  {
    id: "f8",
    type: "furniture",
    name: "Dining Chair",
    description:
      "Slim dining chair with a contoured seat and solid beech legs — understated and sturdy.",
    material: "Beech wood, woven seat",
    size: '18" W × 20" D × 32" H',
    price: "₱6,700",
    image:
      "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?q=80&w=900&auto=format&fit=crop",
  },
  {
    id: "f9",
    type: "furniture",
    name: "Daybed",
    description:
      "Dual-purpose daybed with a tufted back and hidden storage — ideal for compact living.",
    material: "Cotton blend, oak frame",
    size: '78" L × 38" W × 30" H',
    price: "₱37,500",
    image:
      "https://images.unsplash.com/photo-1540574163026-643ea20ade25?q=80&w=900&auto=format&fit=crop",
  },
  {
    id: "f10",
    type: "furniture",
    name: "Ottoman",
    description:
      "Upholstered ottoman with a soft top and wooden feet — extra seating or a footrest.",
    material: "Linen, solid rubberwood",
    size: '24" ⌀ × 18" H',
    price: "₱7,400",
    image:
      "https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?q=80&w=900&auto=format&fit=crop",
  },
];

// ---------------------------------------------------------------------------
// Floors — sphere renders with accurate details
// ---------------------------------------------------------------------------
const FLOOR_ITEMS: FloorItem[] = [
  {
    id: "fl1",
    type: "floors",
    name: "Light Oak Chevron",
    description:
      "Pale honey-toned oak laid in a chevron pattern with a satin finish. Bright, airy, and classic — well suited to Nordic and transitional interiors.",
    material: "Engineered oak, chevron, satin lacquer",
    size: "600 × 120 × 15 mm",
    price: "₱3,900 / sqm",
    image: FLOOR_TEXTURE.chevronLightOak,
  },
  {
    id: "fl2",
    type: "floors",
    name: "Weathered Grey Oak Chevron",
    description:
      "Grey-brown oak with a subtle whitewash in a chevron layout. Rustic yet refined — good for coastal, farmhouse, and modern-rustic schemes.",
    material: "Engineered oak, chevron, whitewash oil",
    size: "600 × 120 × 15 mm",
    price: "₱4,100 / sqm",
    image: FLOOR_TEXTURE.chevronWeatheredOak,
  },
  {
    id: "fl3",
    type: "floors",
    name: "Aged Oak Herringbone",
    description:
      "Mid-brown oak herringbone with visible knots and grain variation. Warm, characterful, and timeless — a classic choice for living and dining.",
    material: "Engineered oak, herringbone, matte lacquer",
    size: "600 × 120 × 15 mm",
    price: "₱3,700 / sqm",
    image: FLOOR_TEXTURE.herringboneAgedOak,
  },
  {
    id: "fl4",
    type: "floors",
    name: "Walnut Plank",
    description:
      "Cool-toned walnut planks with straight grain and subtle colour play. Sophisticated and quiet — pairs well with both warm and cool palettes.",
    material: "Engineered walnut, plank, satin oil",
    size: "1200 × 180 × 15 mm",
    price: "₱5,400 / sqm",
    image: FLOOR_TEXTURE.plankWalnut,
  },
  {
    id: "fl5",
    type: "floors",
    name: "Cherry Mahogany Plank",
    description:
      "Deep reddish-brown planks with a glossy finish. Rich and formal — traditionally used in libraries, studies, and formal dining rooms.",
    material: "Engineered cherry/mahogany, gloss lacquer",
    size: "1200 × 180 × 15 mm",
    price: "₱5,900 / sqm",
    image: FLOOR_TEXTURE.plankCherryMahogany,
  },
  {
    id: "fl6",
    type: "floors",
    name: "Cherry Herringbone",
    description:
      "The same rich cherry tones arranged in herringbone — formal geometry with warm colour. Suited to classic and period-inspired interiors.",
    material: "Engineered cherry, herringbone, gloss lacquer",
    size: "600 × 120 × 15 mm",
    price: "₱5,600 / sqm",
    image: FLOOR_TEXTURE.herringboneCherry,
  },
  {
    id: "fl7",
    type: "floors",
    name: "Dark Slate Stone",
    description:
      "Charcoal-grey slate with a subtle relief and matte finish. Durable and earthy — ideal for entryways, kitchens, and bathrooms.",
    material: "Natural slate tile, matte",
    size: "600 × 300 × 12 mm",
    price: "₱4,600 / sqm",
    image: FLOOR_TEXTURE.darkSlateStone,
  },
  {
    id: "fl8",
    type: "floors",
    name: "White Veined Marble",
    description:
      "Bright white marble with soft grey veining and a polished surface. Luxurious and luminous — a statement floor for formal spaces.",
    material: "Polished marble slab",
    size: "600 × 600 × 18 mm",
    price: "₱6,900 / sqm",
    image: FLOOR_TEXTURE.whiteVeinedMarble,
  },
];

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------
const WALL_ITEMS: WallItem[] = [
  { id: "w1", type: "walls", name: "Warm White", description: "Soft warm white — timeless, bright, and endlessly versatile.", material: "Low-VOC latex, eggshell", size: "Per 4L can (covers ~35 sqm)", price: "₱1,850", color: "#f5f0e8" },
  { id: "w2", type: "walls", name: "Clay Beige", description: "Earthy beige with a hint of clay — grounding and calm.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱1,850", color: "#d9c7b2" },
  { id: "w3", type: "walls", name: "Sage Green", description: "Calming sage green — a soft, natural accent.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱1,950", color: "#b2c2a8" },
  { id: "w4", type: "walls", name: "Soft Grey", description: "Neutral soft grey — modern, quiet, and easy to live with.", material: "Low-VOC latex, eggshell", size: "Per 4L can (covers ~35 sqm)", price: "₱1,850", color: "#d0cfcd" },
  { id: "w5", type: "walls", name: "Dusty Rose", description: "Subtle dusty rose — warm and romantic.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱1,950", color: "#d9b8b0" },
  { id: "w6", type: "walls", name: "Deep Navy", description: "Deep navy blue — bold, sophisticated, dramatic.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱2,050", color: "#2c3e50" },
  { id: "w7", type: "walls", name: "Olive", description: "Muted olive green — organic and quietly luxurious.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱2,050", color: "#8a8b5c" },
  { id: "w8", type: "walls", name: "Terracotta", description: "Warm terracotta — earthy and sun-baked.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱2,050", color: "#c1795a" },
  { id: "w9", type: "walls", name: "Charcoal", description: "Rich charcoal grey — moody and refined.", material: "Low-VOC latex, eggshell", size: "Per 4L can (covers ~35 sqm)", price: "₱2,150", color: "#4a4a4a" },
  { id: "w10", type: "walls", name: "Blush Pink", description: "Soft blush pink — gentle and inviting.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱1,950", color: "#e8c4c4" },
  { id: "w11", type: "walls", name: "Greige", description: "Grey-beige hybrid — modern neutral.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱1,900", color: "#c8c0b6" },
  { id: "w12", type: "walls", name: "Mushroom", description: "Warm taupe with a hint of brown — sophisticated.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱1,950", color: "#a89a8c" },
  { id: "w13", type: "walls", name: "Powder Blue", description: "Soft powder blue — calm and refreshing.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱1,950", color: "#b8ccd9" },
  { id: "w14", type: "walls", name: "Forest Green", description: "Deep forest green — rich and elegant.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱2,150", color: "#3f5e4a" },
  { id: "w15", type: "walls", name: "Sand", description: "Warm sandy beige — light and natural.", material: "Low-VOC latex, eggshell", size: "Per 4L can (covers ~35 sqm)", price: "₱1,900", color: "#e0d4b8" },
  { id: "w16", type: "walls", name: "Mustard", description: "Bold mustard yellow — energetic and warm.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱2,100", color: "#c9a227" },
  { id: "w17", type: "walls", name: "Burgundy", description: "Deep burgundy red — dramatic and luxurious.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱2,200", color: "#6b2737" },
  { id: "w18", type: "walls", name: "Lavender", description: "Soft lavender — calming and contemporary.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱1,950", color: "#c3b8d9" },
  { id: "w19", type: "walls", name: "Slate Blue", description: "Muted slate blue — cool and grounded.", material: "Low-VOC latex, matte", size: "Per 4L can (covers ~35 sqm)", price: "₱2,050", color: "#5f7488" },
  { id: "w20", type: "walls", name: "Cream", description: "Classic cream — brighter than beige, warmer than white.", material: "Low-VOC latex, eggshell", size: "Per 4L can (covers ~35 sqm)", price: "₱1,850", color: "#f0e8d5" },
];

const ALL_ITEMS: Record<Division, LibraryItem[]> = {
  furniture: FURNITURE_ITEMS,
  floors: FLOOR_ITEMS,
  walls: WALL_ITEMS,
};

const DIVISION_META: Record<
  Division,
  { label: string; title: string; blurb: string }
> = {
  furniture: {
    label: "",
    title: "Furniture Library",
    blurb:
      "Browse our curated furniture pieces. Scroll to see more options — click any item to see its details on the right.",
  },
  floors: {
    label: "",
    title: "Floor Finishes",
    blurb:
      "PBR sphere previews — five at a time. Use the next button below the row to see more finishes.",
  },
  walls: {
    label: "",
    title: "Wall Finishes",
    blurb:
      "Interior paint colours commonly chosen by clients. Click a swatch to see details.",
  },
};

const FLOORS_PER_PAGE = 5;

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
          : "translate-y-6 opacity-0 blur-md"
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel with local fade-blur on item change
// ---------------------------------------------------------------------------
function DetailPanel({ item }: { item: LibraryItem | null }) {
  const [veil, setVeil] = useState(false);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    const id = item?.id ?? null;
    if (id === lastId.current) return;
    lastId.current = id;
    setVeil(true);
    const t = setTimeout(() => setVeil(false), 260);
    return () => clearTimeout(t);
  }, [item]);

  if (!item) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-ink/15 bg-white/50 p-10 text-center">
        <Info className="mb-3 h-6 w-6 text-ink/30" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink/60">No item selected</p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-ink/40">
          Click any item to see its materials, size, and price.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col rounded-3xl border border-ink/10 bg-white/70 p-6 backdrop-blur-md">
      <div
        className={`flex h-full flex-col transition-all duration-300 ${
          veil ? "opacity-0 blur-sm" : "opacity-100 blur-0"
        }`}
      >
        {/* FULL-WIDTH PREVIEW — no padding, no border, edge-to-edge */}
        <div className="mb-5 overflow-hidden rounded-2xl bg-cream">
          {item.type === "walls" ? (
            <div
              className="h-56 w-full"
              style={{ backgroundColor: item.color }}
            />
          ) : item.type === "floors" ? (
            <img
              src={item.image}
              alt={item.name}
              className="h-56 w-full scale-125 object-cover transition-transform duration-500"
            />
          ) : (
            <img
              src={item.image}
              alt={item.name}
              className="h-56 w-full object-cover transition-transform duration-500"
            />
          )}
        </div>

        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-clay-500">
          {DIVISION_META[item.type].title}
        </p>
        <h3 className="mt-1 font-display text-2xl font-semibold text-ink">
          {item.name}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-ink/60">
          {item.description}
        </p>

        <dl className="mt-6 space-y-3 border-t border-ink/10 pt-5 text-sm">
          <div className="flex items-start gap-3">
            <Layers
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-clay-500"
              strokeWidth={1.75}
            />
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-widest text-ink/40">
                Material
              </dt>
              <dd className="text-ink/80">{item.material}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Ruler
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-clay-500"
              strokeWidth={1.75}
            />
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-widest text-ink/40">
                Size
              </dt>
              <dd className="text-ink/80">{item.size}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Tag
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-clay-500"
              strokeWidth={1.75}
            />
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-widest text-ink/40">
                Price
              </dt>
              <dd className="font-semibold text-ink">{item.price}</dd>
            </div>
          </div>
        </dl>
      </div>
    </div>
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
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col overflow-hidden rounded-2xl border-2 bg-white p-2 text-left transition-all duration-300 ${
        active
          ? "border-clay-500 shadow-[0_0_0_4px_rgba(178,107,75,0.12)]"
          : "border-transparent hover:-translate-y-0.5 hover:border-ink/15 hover:shadow-lg"
      }`}
    >
      <div className="relative h-32 w-full overflow-hidden rounded-xl bg-cream">
        <img
          src={item.image}
          alt={item.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        {active && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-clay-500 text-white shadow-md">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="mt-2 px-1 pb-1">
        <p className="truncate text-xs font-semibold text-ink">{item.name}</p>
        <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-ink/40">
          {item.material}
        </p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Floor tile — sphere render, zoomed, no border, checkmark outside
// ---------------------------------------------------------------------------
function FloorTile({
  item,
  active,
  onClick,
}: {
  item: FloorItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center overflow-visible rounded-2xl border-2 bg-white p-3 text-center transition-all duration-300 ${
        active
          ? "border-clay-500 shadow-[0_0_0_4px_rgba(178,107,75,0.12)]"
          : "border-transparent hover:-translate-y-0.5 hover:border-ink/15 hover:shadow-lg"
      }`}
    >
      <div className="relative flex h-28 w-28 items-center justify-center overflow-visible rounded-full bg-cream">
        <div className="h-full w-full overflow-hidden rounded-full">
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full scale-125 object-cover transition-transform duration-500 group-hover:scale-150"
          />
        </div>
        {active && (
          <span className="absolute -right-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-clay-500 text-white shadow-md">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="mt-3 w-full px-1 pb-1">
        <p className="truncate text-xs font-semibold text-ink">{item.name}</p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Wall swatch
// ---------------------------------------------------------------------------
function WallSwatch({
  item,
  active,
  onClick,
}: {
  item: WallItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center gap-2 rounded-2xl border-2 bg-white p-3 transition-all duration-300 ${
        active
          ? "border-clay-500 shadow-[0_0_0_4px_rgba(178,107,75,0.12)]"
          : "border-transparent hover:-translate-y-0.5 hover:border-ink/15 hover:shadow-lg"
      }`}
    >
      <div className="relative">
        <div
          className="h-14 w-14 rounded-full border border-ink/10 transition-transform duration-300 group-hover:scale-105"
          style={{ backgroundColor: item.color }}
        />
        {active && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-clay-500 text-white shadow-md">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </div>
      <p className="text-[11px] font-semibold text-ink">{item.name}</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({ division }: { division: Division }) {
  const meta = DIVISION_META[division];
  return (
    <div className="mb-6 max-w-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-clay-500">
        {meta.label}
      </p>
      <h2 className="mt-1 font-display text-3xl font-semibold text-ink md:text-4xl">
        {meta.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink/50">{meta.blurb}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Furniture section
// ---------------------------------------------------------------------------
function FurnitureSection({
  items,
  activeItem,
  onSelect,
}: {
  items: FurnitureItem[];
  activeItem: LibraryItem | null;
  onSelect: (item: LibraryItem) => void;
}) {
  const active =
    activeItem && activeItem.type === "furniture" ? activeItem : null;
  return (
    <section className="scroll-mt-24">
      <SectionHeader division="furniture" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-3xl border border-ink/10 bg-white/40 p-4 sm:p-5">
          <div className="grid max-h-[560px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
            {items.map((item) => (
              <FurnitureTile
                key={item.id}
                item={item}
                active={active?.id === item.id}
                onClick={() => onSelect(item)}
              />
            ))}
          </div>
        </div>
        <div className="lg:sticky lg:top-6 lg:h-[560px]">
          <DetailPanel item={active} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Floors section — detail LEFT, sphere renders RIGHT, one row + pager below
// ---------------------------------------------------------------------------
function FloorsSection({
  items,
  activeItem,
  onSelect,
}: {
  items: FloorItem[];
  activeItem: LibraryItem | null;
  onSelect: (item: LibraryItem) => void;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / FLOORS_PER_PAGE));
  const visible = useMemo(
    () => items.slice(page * FLOORS_PER_PAGE, (page + 1) * FLOORS_PER_PAGE),
    [items, page],
  );

  const active = activeItem && activeItem.type === "floors" ? activeItem : null;

  return (
    <section className="scroll-mt-24">
      <SectionHeader division="floors" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* LEFT — description / details */}
        <div className="lg:sticky lg:top-6 lg:h-[420px]">
          <DetailPanel item={active} />
        </div>

        {/* RIGHT — one row of 5 sphere renders + pager below */}
        <div className="rounded-3xl border border-ink/10 bg-white/40 p-4 sm:p-5">
          <div
            key={`floors-${page}`}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
            style={{ animation: "fadeBlur 420ms ease" }}
          >
            {visible.map((item) => (
              <FloorTile
                key={item.id}
                item={item}
                active={active?.id === item.id}
                onClick={() => onSelect(item)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label="Previous"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-white text-ink/70 transition hover:border-ink/30 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              </button>
              <span className="text-[10px] font-medium uppercase tracking-widest text-ink/40">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                aria-label="Next"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-white text-ink/70 transition hover:border-ink/30 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          )}
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
  activeItem,
  onSelect,
}: {
  items: WallItem[];
  activeItem: LibraryItem | null;
  onSelect: (item: LibraryItem) => void;
}) {
  const active = activeItem && activeItem.type === "walls" ? activeItem : null;
  return (
    <section className="scroll-mt-24">
      <SectionHeader division="walls" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-3xl border border-ink/10 bg-white/40 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item) => (
              <WallSwatch
                key={item.id}
                item={item}
                active={active?.id === item.id}
                onClick={() => onSelect(item)}
              />
            ))}
          </div>
        </div>
        <div className="lg:sticky lg:top-6 lg:h-[560px]">
          <DetailPanel item={active} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LibraryPage() {
  const [activeItems, setActiveItems] = useState<
    Partial<Record<Division, LibraryItem>>
  >({});
  const [veil, setVeil] = useState(false);

  const handleSelect = (item: LibraryItem) => {
    setVeil(true);
    setActiveItems((prev) => ({ ...prev, [item.type]: item }));
    window.setTimeout(() => setVeil(false), 220);
  };

  return (
    <div className="min-h-screen w-full bg-cream">
      <TransitionVeil active={veil} />

      {/* Shared animated NavBar (Home / Library / Studio + Sign In) */}
      <NavBar />

      {/* Intro */}
      <main className="mx-auto max-w-[1400px] px-6 py-12 md:px-10">
        <Reveal>
          <div className="mb-12 max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-clay-500">
              Material Library
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold text-ink md:text-5xl">
              Build your palette.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink/60">
              Three divisions — furniture, floors, and walls — each with a
              browsing panel and a detail panel. Click any item to see its
              materials, size, and price.
            </p>
          </div>
        </Reveal>

        <div className="space-y-24">
          <Reveal>
            <FurnitureSection
              items={ALL_ITEMS.furniture as FurnitureItem[]}
              activeItem={activeItems.furniture ?? null}
              onSelect={handleSelect}
            />
          </Reveal>
          <Reveal>
            <FloorsSection
              items={ALL_ITEMS.floors as FloorItem[]}
              activeItem={activeItems.floors ?? null}
              onSelect={handleSelect}
            />
          </Reveal>
          <Reveal>
            <WallsSection
              items={ALL_ITEMS.walls as WallItem[]}
              activeItem={activeItems.walls ?? null}
              onSelect={handleSelect}
            />
          </Reveal>
        </div>

        <Reveal>
          <div className="mt-20 flex justify-center">
            <Link
              to="/studio"
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-clay-700"
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
