import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, FolderOpen, Layers3, Plus, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearProjectSession } from "../services/projectEditSessionService";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { getDrafts } from "../services/projectDraftService";
import type { DraftProject } from "../services/projectDraftService";
import NavBar from "./NavBar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface UserProject {
  projectId: string;
  projectName: string;
  ownerId: string;
  jsonPath: string;
  jsonUrl: string;
  schemaVersion: number;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

type Filter = "all" | "projects" | "drafts";
type SortKey = "recent" | "name";

interface StudioItem {
  key: string;
  kind: "project" | "draft";
  name: string;
  time: number;
  meta: string;
  thumbnail?: string;
  onOpen: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
// Put the hero image in /public (e.g. /public/studio-hero.jpg) and point this at it.
const STUDIO_HERO_IMAGE = "public/background/studio-bg.jpg";
// Save your PNG as public/background/create-blank.png (or change this path).
const CREATE_BLANK_IMAGE = "public/modal/create-blank.png";
const HERO_SURFACE = "#faf7f2"; // should match the image's light background
const DEFAULT_PROJECT_NAME = "Untitled project";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

function getTime(value: unknown): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const ms = new Date(value).getTime();
    if (!Number.isNaN(ms)) return ms;
  }

  return 0;
}

function formatWhen(ms: number): string {
  if (!ms) return "Unknown date";
  const diff = Date.now() - ms;
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  if (diff < MIN) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(ms).toLocaleDateString(undefined, DATE_FORMAT);
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------
const PRIMARY_BUTTON =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#1b1b1b] bg-[#1b1b1b] px-5 py-2.5 text-[12px] font-medium text-white transition hover:bg-black active:translate-y-px";

const GRID = "grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

// Hero: full-width first division of the page (image + welcome text).
// The navbar floats over the top of it.
interface HeroStat {
  label: string;
  value: number;
}

function StudioHero({
  firstName,
  stats,
  loading,
  onCreate,
}: {
  firstName: string;
  stats: HeroStat[];
  loading: boolean;
  onCreate: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section
      aria-labelledby="studio-title"
      className="relative flex w-full flex-col overflow-hidden md:block md:h-[clamp(440px,42vw,640px)]"
      style={{ backgroundColor: HERO_SURFACE }}
    >
      {/* Image: fills the whole division on desktop, sits below the text on mobile */}
      <div className="relative order-2 h-56 md:absolute md:inset-0 md:h-full">
        {!imageFailed && (
          <img
            src={STUDIO_HERO_IMAGE}
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
          background: `linear-gradient(to right, ${HERO_SURFACE} 0%, rgba(250,247,242,0) 48%)`,
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
            id="studio-title"
            className="mt-3 text-4xl font-semibold tracking-tight text-[#1b1b1b] md:text-5xl"
          >
            {firstName ? `Welcome back, ${firstName}` : "Your projects"}
          </h1>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-black/55">
            Pick up where you left off, or start a new room from scratch.
          </p>

          <button type="button" className={`${PRIMARY_BUTTON} mt-6`} onClick={onCreate}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            New project
          </button>

          <ul className="mt-7 flex items-center gap-5">
            {stats.map((stat, index) => (
              <li
                key={stat.label}
                className={`flex items-baseline gap-1.5 ${
                  index > 0 ? "border-l border-black/10 pl-5" : ""
                }`}
              >
                <span className="text-[15px] font-semibold tabular-nums text-[#1b1b1b]">
                  {loading ? "–" : stat.value}
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

function ProjectCard({ item }: { item: StudioItem }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = Boolean(item.thumbnail?.trim()) && !imgError;

  return (
    <button
      type="button"
      onClick={item.onOpen}
      aria-label={`${item.kind === "draft" ? "Continue draft" : "Open project"} ${item.name}`}
      className="group text-left outline-none"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black/[0.05] ring-1 ring-black/5 transition duration-200 group-hover:ring-black/20 group-focus-visible:ring-2 group-focus-visible:ring-[#1b1b1b]">
        {hasImage ? (
          <img
            src={item.thumbnail}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-black/20">
            <FolderOpen className="h-8 w-8" strokeWidth={1.25} />
          </div>
        )}

        {item.kind === "draft" && (
          <span className="absolute left-3 top-3 rounded-full bg-[#faf7f2]/90 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#1b1b1b] shadow-sm backdrop-blur">
            Draft
          </span>
        )}

        <span className="absolute bottom-3 right-3 inline-flex translate-y-1 items-center gap-1 rounded-full bg-[#1b1b1b] px-3 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-md transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          {item.kind === "draft" ? "Continue" : "Open"}
          <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
        </span>
      </div>

      <div className="mt-3 px-0.5">
        <h3 className="truncate text-[13px] font-medium leading-tight text-[#1b1b1b]">
          {item.name}
        </h3>
        <p className="mt-1 truncate text-[10px] uppercase tracking-wide text-black/45">
          {item.meta}
        </p>
      </div>
    </button>
  );
}

function NewProjectCard({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group text-left outline-none">
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-black/25 bg-transparent transition duration-200 group-hover:border-[#1b1b1b] group-hover:bg-black/[0.03] group-focus-visible:border-[#1b1b1b] group-focus-visible:ring-2 group-focus-visible:ring-[#1b1b1b]/20">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1b1b1b] text-white transition group-hover:scale-105">
          <Plus className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="text-[12px] font-medium text-[#1b1b1b]">New project</span>
      </div>
      <div className="mt-3 px-0.5">
        <p className="text-[13px] font-medium leading-tight text-black/0 select-none" aria-hidden>
          &nbsp;
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-black/45">
          Start from a blank room
        </p>
      </div>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div>
      <div className="aspect-[4/3] animate-pulse rounded-xl bg-black/[0.06]" />
      <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-black/[0.06]" />
      <div className="mt-2 h-2 w-1/3 animate-pulse rounded bg-black/[0.05]" />
    </div>
  );
}

function Tab({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[11px] font-medium transition ${
        active
          ? "border-[#1b1b1b] bg-[#1b1b1b] text-white"
          : "border-black/20 text-black/60 hover:border-black/50 hover:text-[#1b1b1b]"
      }`}
    >
      {children}
      <span className={`text-[10px] tabular-nums ${active ? "text-white/60" : "text-black/35"}`}>
        {count}
      </span>
    </button>
  );
}

function NewProjectModal({
  projectName,
  onProjectNameChange,
  onClose,
  onCreateBlank,
}: {
  projectName: string;
  onProjectNameChange: (value: string) => void;
  onClose: () => void;
  onCreateBlank: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/45 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="w-full max-w-[520px] rounded-2xl bg-[#faf7f2] p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="new-project-title" className="text-xl font-semibold tracking-tight">
              Create a new project
            </h2>
            <p className="mt-1.5 text-[13px] text-black/55">
              Give your project a name and choose how to get started.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close new project dialog"
            className="rounded-full p-2 text-black/50 transition hover:bg-black/[0.06] hover:text-black"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label htmlFor="new-project-name" className="mt-6 block text-[11px] font-medium text-black/65">
          Project title
        </label>
        <input
          id="new-project-name"
          autoFocus
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onCreateBlank();
          }}
          maxLength={100}
          className="mt-2 h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-[13px] text-[#1b1b1b] outline-none transition placeholder:text-black/35 focus:border-black/50"
          placeholder={DEFAULT_PROJECT_NAME}
        />

        <p className="mb-3 mt-7 text-[11px] font-medium uppercase tracking-[0.12em] text-black/45">
          Choose a starting point
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Selected starting point. Nothing happens until Confirm is pressed. */}
          <button
            type="button"
            aria-pressed="true"
            className="rounded-xl border border-[#1b1b1b] bg-white p-4 text-left ring-1 ring-[#1b1b1b] focus-visible:outline-none"
          >
            <div className="overflow-hidden rounded-lg bg-[#f1efea]">
              <img
                src={CREATE_BLANK_IMAGE}
                alt="create from blank"
                draggable={false}
                className="aspect-[4/3] w-full object-contain"
              />
            </div>
            <span className="mt-4 block text-[13px] font-semibold">Create from blank</span>
            <span className="mt-1 block text-[11px] leading-relaxed text-black/50">
              Start with an empty room and build it your way.
            </span>
          </button>
          <button
            type="button"
            disabled
            aria-describedby="template-unavailable"
            className="cursor-not-allowed rounded-xl border border-black/10 bg-black/[0.025] p-4 text-left opacity-65"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.07] text-black/50">
              <Layers3 className="h-4 w-4" />
            </span>
            <span className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-black/60">
              Create with template
              <span className="rounded-full bg-black/[0.07] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-black/50">
                Soon
              </span>
            </span>
            <span id="template-unavailable" className="mt-1 block text-[11px] leading-relaxed text-black/45">
              Templates aren’t available yet.
            </span>
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onCreateBlank}
            className="rounded-full border border-[#1b1b1b] bg-[#1b1b1b] px-6 py-2.5 text-[12px] font-medium text-white transition hover:bg-black active:translate-y-px"
          >
            Confirm
          </button>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Studio() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<UserProject[]>([]);
  const [drafts, setDrafts] = useState<DraftProject[]>([]);
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [search, setSearch] = useState("");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState(DEFAULT_PROJECT_NAME);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          setProjects([]);
          setDrafts([]);
          setError("Please log in to view your projects.");
          setLoading(false);
        }
        return;
      }

      localStorage.setItem("espasyo_current_user_uid", user.uid);
      if (!cancelled) {
        setFirstName(user.displayName?.trim().split(/\s+/)[0] ?? "");
      }

      try {
        setLoading(true);
        setError("");

        const localDrafts = getDrafts(user.uid);

        const snapshot = await getDocs(
          query(collection(db, "projects"), where("ownerId", "==", user.uid)),
        );

        const loaded: UserProject[] = snapshot.docs.map((document) => {
          const data = document.data();
          return {
            projectId:
              typeof data.projectId === "string" ? data.projectId : document.id,
            projectName:
              typeof data.projectName === "string" ? data.projectName : "Unnamed Project",
            ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
            jsonPath: typeof data.jsonPath === "string" ? data.jsonPath : "",
            jsonUrl: typeof data.jsonUrl === "string" ? data.jsonUrl : "",
            schemaVersion: typeof data.schemaVersion === "number" ? data.schemaVersion : 1,
            thumbnailPath:
              typeof data.thumbnailPath === "string" ? data.thumbnailPath : undefined,
            thumbnailUrl:
              typeof data.thumbnailUrl === "string" ? data.thumbnailUrl : undefined,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });

        if (!cancelled) {
          setDrafts(localDrafts);
          setProjects(loaded);
        }
      } catch (loadError) {
        console.error("Failed to load projects:", loadError);

        if (!cancelled) {
          const firebaseError = loadError as { code?: string };
          setError(
            firebaseError.code
              ? `Failed to load projects: ${firebaseError.code}`
              : "Failed to load your projects.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  function handleOpenNewProject() {
    setNewProjectName(DEFAULT_PROJECT_NAME);
    setNewProjectOpen(true);
  }

  function handleCreateBlankProject() {
    clearProjectSession();
    localStorage.setItem(
      "espasyo_project_name",
      newProjectName.trim() || DEFAULT_PROJECT_NAME,
    );
    setNewProjectOpen(false);
    navigate("/studio/editor");
  }

  const items = useMemo<StudioItem[]>(() => {
    const projectItems: StudioItem[] = projects.map((p) => {
      const time = getTime(p.updatedAt);
      return {
        key: `project-${p.projectId}`,
        kind: "project",
        name: p.projectName,
        time,
        meta: `Edited ${formatWhen(time)}`,
        thumbnail: p.thumbnailUrl,
        onOpen: () => navigate(`/studio/load/${p.projectId}`),
      };
    });

    const draftItems: StudioItem[] = drafts.map((d) => {
      const time = getTime(d.savedAt);
      return {
        key: `draft-${d.draftId}`,
        kind: "draft",
        name: d.projectName,
        time,
        meta: `Saved ${formatWhen(time)}`,
        thumbnail: d.thumbnail,
        onOpen: () => {
          localStorage.setItem("espasyo_project_name", d.projectName);
          navigate(`/studio/editor?draft=${encodeURIComponent(d.draftId)}`);
        },
      };
    });

    return [...projectItems, ...draftItems];
  }, [projects, drafts, navigate]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = items.filter((i) => {
      if (filter === "projects" && i.kind !== "project") return false;
      if (filter === "drafts" && i.kind !== "draft") return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });

    return list.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : b.time - a.time,
    );
  }, [items, filter, sort, search]);

  const isSearching = search.trim().length > 0;
  const showNewTile = !isSearching && filter !== "drafts";
  const hasAnything = items.length > 0;

  const heroStats: HeroStat[] = [
    { label: "Projects", value: projects.length },
    { label: "Drafts", value: drafts.length },
  ];

  return (
    <div className="min-h-screen w-full bg-[#faf7f2] font-sans text-[#1b1b1b] antialiased">
      <NavBar />
      {newProjectOpen && (
        <NewProjectModal
          projectName={newProjectName}
          onProjectNameChange={setNewProjectName}
          onClose={() => setNewProjectOpen(false)}
          onCreateBlank={handleCreateBlankProject}
        />
      )}

      {/* Division 1: full-width hero (image + welcome text) */}
      <StudioHero
        firstName={firstName}
        stats={heroStats}
        loading={loading}
        onCreate={handleOpenNewProject}
      />

      {/* Division 2: your projects */}
      <main className="mx-auto max-w-[1400px] px-6 pb-20 pt-10 md:px-10">
        {/* Controls */}
        {!loading && !error && hasAnything && (
          <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Tab active={filter === "all"} count={items.length} onClick={() => setFilter("all")}>
                All
              </Tab>
              <Tab
                active={filter === "projects"}
                count={projects.length}
                onClick={() => setFilter("projects")}
              >
                Projects
              </Tab>
              <Tab
                active={filter === "drafts"}
                count={drafts.length}
                onClick={() => setFilter("drafts")}
              >
                Drafts
              </Tab>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block sm:w-[240px]" aria-label="Search projects">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/50"
                  strokeWidth={1.75}
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects"
                  className="h-[36px] w-full rounded-md border border-black/15 bg-[#faf7f2] pl-9 pr-3 text-[11px] font-medium text-[#1b1b1b] outline-none transition placeholder:text-black/30 hover:border-black/35 focus:border-black/60"
                />
              </label>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort by"
                className="h-[36px] cursor-pointer rounded-md border border-black/15 bg-[#faf7f2] px-3 text-[11px] font-medium text-[#1b1b1b] outline-none transition hover:border-black/35 focus:border-black/60"
              >
                <option value="recent">Most recent</option>
                <option value="name">Name (A–Z)</option>
              </select>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className={GRID} aria-busy="true" aria-label="Loading projects">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex min-h-[240px] items-center justify-center rounded-xl bg-black/[0.05] px-6 text-center text-[13px] text-black/50">
            {error}
          </div>
        )}

        {/* First-run empty state */}
        {!loading && !error && !hasAnything && (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-black/20 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.05] text-black/40">
              <FolderOpen className="h-5 w-5" strokeWidth={1.25} />
            </span>
            <div>
              <p className="text-[15px] font-medium">Nothing here yet</p>
              <p className="mt-1.5 max-w-[360px] text-[13px] leading-relaxed text-black/50">
                Build your first room, place some furniture, and see the estimated
                cost update as you go.
              </p>
            </div>
            <button type="button" className={PRIMARY_BUTTON} onClick={handleOpenNewProject}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Create your first project
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && !error && hasAnything && (
          <>
            {visible.length === 0 && !showNewTile ? (
              <div className="flex min-h-[240px] items-center justify-center rounded-xl bg-black/[0.05] px-6 text-center text-[13px] text-black/45">
                {isSearching
                  ? "No projects match your search."
                  : filter === "drafts"
                    ? "You have no saved drafts."
                    : "Nothing to show."}
              </div>
            ) : (
              <div className={GRID}>
                {showNewTile && <NewProjectCard onClick={handleOpenNewProject} />}
                {visible.map((item) => (
                  <ProjectCard key={item.key} item={item} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}