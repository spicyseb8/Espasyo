import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Plus, Search, X } from "lucide-react";
import {
    getAdminClients,
    type AdminClient
} from "@/services/assets/projectService";
import { createManagedFloorPlanDraft } from "@/services/assets/projectStructureService";
import LoadingScreen from "@/components/LoadingScreen";

function initials(name: string) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase())
        .join("") || "?";
}

function matchesClientSearch(client: AdminClient, searchQuery: string) {
    return !searchQuery ||
        `${client.name} ${client.email ?? ""}`.toLocaleLowerCase().includes(searchQuery);
}

export default function NewFloorPlanProjectButton() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [projectName, setProjectName] = useState("");
    const [search, setSearch] = useState("");
    const [clients, setClients] = useState<AdminClient[]>([]);
    const [selectedClientId, setSelectedClientId] = useState("");
    const [loadingClients, setLoadingClients] = useState(false);
    const [creating, setCreating] = useState(false);
    const creatingRef = useRef(false);
    const [openingEditor, setOpeningEditor] = useState(false);
    const [error, setError] = useState("");

    const searchQuery = search.trim().toLocaleLowerCase();

    const availableClients = useMemo(
        () => clients.filter(client => matchesClientSearch(client, searchQuery)),
        [clients, searchQuery]
    );
    const selectedClient = availableClients.find(client => client.uid === selectedClientId);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            setLoadingClients(true);
            getAdminClients(search)
                .then(result => {
                    if (cancelled) return;
                    setClients(result.clients);
                    setSelectedClientId(current =>
                        result.clients.some(client => client.uid === current)
                            ? current
                            : ""
                    );
                })
                .catch(loadError => {
                    console.error("Failed to search clients for floor-plan creation:", loadError);
                    if (cancelled) return;
                    setClients([]);
                    setError("Unable to search clients. Please try again.");
                })
                .finally(() => {
                    if (!cancelled) setLoadingClients(false);
                });
        }, 200);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [open, search]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !creating) setOpen(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, creating]);

    function openDialog() {
        setProjectName("");
        setSearch("");
        setClients([]);
        setSelectedClientId("");
        setLoadingClients(false);
        setError("");
        setOpen(true);
    }

    async function createProject() {
        if (!projectName.trim() || !selectedClient || creatingRef.current) return;

        creatingRef.current = true;
        setCreating(true);
        setError("");
        try {
            const draft = await createManagedFloorPlanDraft({
                projectName: projectName.trim(),
                ownerId: selectedClient.uid
            });
            setOpen(false);
            setOpeningEditor(true);
            navigate(`/projects/draft/${encodeURIComponent(draft.draftId)}`, {
                state: {
                    ownerName: selectedClient.name,
                    showInitializationLoading: true
                }
            });
        } catch (createError) {
            setError(createError instanceof Error
                ? createError.message
                : "Unable to create the floor plan.");
        } finally {
            creatingRef.current = false;
            setCreating(false);
        }
    }

    if (openingEditor) {
        return <LoadingScreen label="Preparing Floor Plan" />;
    }

    const canCreate = !!projectName.trim() && !!selectedClient && !creating;

    return (
        <>
            <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                onClick={openDialog}
            >
                <Plus size={16} />
                New Floor-Plan Project
            </button>
            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget && !creating) setOpen(false);
                    }}
                >
                    <section
                        className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-floor-plan-title"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <h2 id="create-floor-plan-title" className="text-base font-semibold">
                                New floor plan
                            </h2>
                            <button
                                type="button"
                                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={() => setOpen(false)}
                                disabled={creating}
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid gap-6 px-5 py-5">
                            {/* Step 1: Name */}
                            <label className="grid gap-1.5 text-sm font-medium">
                                1. Name the floor plan
                                <input
                                    className="h-10 rounded-md border border-border bg-background px-3 font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    value={projectName}
                                    onChange={event => setProjectName(event.target.value)}
                                    maxLength={80}
                                    autoFocus
                                    placeholder="e.g. Ground floor"
                                />
                            </label>

                            {/* Step 2: Client */}
                            <div className="grid gap-2">
                                <span className="text-sm font-medium">2. Choose a client</span>

                                {selectedClient ? (
                                    /* A client is chosen: show only the confirmation, no list */
                                    <div
                                        className="flex items-center gap-3 rounded-lg border-2 border-primary bg-primary/5 px-3 py-3"
                                        role="status"
                                    >
                                        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                                            {initials(selectedClient.name)}
                                            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-white ring-2 ring-background">
                                                <Check size={10} strokeWidth={3} />
                                            </span>
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[11px] font-medium uppercase tracking-wide text-primary">
                                                Selected client
                                            </span>
                                            <span className="block truncate text-sm font-semibold">
                                                {selectedClient.name}
                                            </span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {selectedClient.email || "No email"}
                                            </span>
                                        </span>
                                        <button
                                            type="button"
                                            className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
                                            onClick={() => setSelectedClientId("")}
                                            disabled={creating}
                                        >
                                            Change
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <input
                                                className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                value={search}
                                                onChange={event => setSearch(event.target.value)}
                                                placeholder="Search by name or email"
                                                aria-label="Search clients by name or email"
                                            />
                                        </div>

                                        <div
                                            className="max-h-52 overflow-auto rounded-md border border-border"
                                            role="listbox"
                                            aria-label="Available clients"
                                        >
                                            {loadingClients ? (
                                                <p className="p-4 text-center text-sm text-muted-foreground">Searching…</p>
                                            ) : availableClients.length > 0 ? (
                                                availableClients.map(client => (
                                                    <button
                                                        key={client.uid}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={false}
                                                        onClick={() => {
                                                            setSelectedClientId(client.uid);
                                                            setError("");
                                                        }}
                                                        className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-muted"
                                                    >
                                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                                                            {initials(client.name)}
                                                        </span>
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-sm font-medium">{client.name}</span>
                                                            <span className="block truncate text-xs text-muted-foreground">
                                                                {client.email || "No email"}
                                                            </span>
                                                            <span className="block text-xs text-muted-foreground">
                                                                {client.projectCount} {client.projectCount === 1 ? "floor plan" : "floor plans"}
                                                            </span>
                                                        </span>
                                                    </button>
                                                ))
                                            ) : (
                                                <p className="p-4 text-center text-sm text-muted-foreground">No clients found</p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {error && (
                                <p className="text-sm text-destructive" role="alert">{error}</p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
                            <p className="min-w-0 truncate text-xs text-muted-foreground">
                                {!projectName.trim()
                                    ? "Enter a name to continue"
                                    : !selectedClient
                                        ? "Choose a client to continue"
                                        : "Ready to create"}
                            </p>
                            <div className="flex shrink-0 gap-2">
                                <button
                                    type="button"
                                    className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
                                    onClick={() => setOpen(false)}
                                    disabled={creating}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                                    disabled={!canCreate}
                                    onClick={() => void createProject()}
                                >
                                    {creating ? "Creating…" : (<><Check size={16} />Create</>)}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}