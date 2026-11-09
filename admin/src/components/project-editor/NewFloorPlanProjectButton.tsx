import { useEffect, useState } from "react";
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

export default function NewFloorPlanProjectButton() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [projectName, setProjectName] = useState("");
    const [search, setSearch] = useState("");
    const [clients, setClients] = useState<AdminClient[]>([]);
    const [selectedClientId, setSelectedClientId] = useState("");
    const [hasIneligibleMatches, setHasIneligibleMatches] = useState(false);
    const [loadingClients, setLoadingClients] = useState(false);
    const [creating, setCreating] = useState(false);
    const [openingEditor, setOpeningEditor] = useState(false);
    const [error, setError] = useState("");
    const [tab, setTab] = useState<"available" | "unavailable">("available");

    const selectedClient = clients.find(
        client => client.uid === selectedClientId && client.eligible
    );
    const availableClients = clients.filter(client => client.eligible);
    const unavailableClients = clients.filter(client => !client.eligible);
    const visibleClients = tab === "available" ? availableClients : unavailableClients;

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            setLoadingClients(true);
            getAdminClients(search)
                .then(result => {
                    if (cancelled) return;
                    setClients(result.clients);
                    setHasIneligibleMatches(result.hasIneligibleMatches);
                    setSelectedClientId(current =>
                        result.clients.some(client => client.uid === current && client.eligible)
                            ? current
                            : ""
                    );
                })
                .catch(loadError => {
                    console.error("Failed to search clients for floor-plan creation:", loadError);
                    if (cancelled) return;
                    setClients([]);
                    setHasIneligibleMatches(false);
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
        setHasIneligibleMatches(false);
        setError("");
        setTab("available");
        setOpen(true);
    }

    async function createProject() {
        if (!projectName.trim() || !selectedClient || creating) return;

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
            setCreating(false);
        }
    }

    function openExistingFloorPlan(client: AdminClient) {
        setOpen(false);
        if (client.existingDraftId) {
            navigate(`/projects/draft/${encodeURIComponent(client.existingDraftId)}`);
        } else if (client.existingProjectId) {
            navigate(`/projects/edit/${encodeURIComponent(client.existingProjectId)}`);
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

                        <div className="grid gap-5 px-5 py-5">
                            {/* Name */}
                            <label className="grid gap-1.5 text-sm font-medium">
                                Name
                                <input
                                    className="h-10 rounded-md border border-border bg-background px-3 font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    value={projectName}
                                    onChange={event => setProjectName(event.target.value)}
                                    maxLength={120}
                                    autoFocus
                                    placeholder="e.g. Ground floor"
                                />
                            </label>

                            {/* Client */}
                            <div className="grid gap-1.5">
                                <span className="text-sm font-medium">Client</span>

                                {selectedClient ? (
                                    <div className="flex items-center gap-3 rounded-md border border-primary bg-primary/5 px-3 py-2.5">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                            {initials(selectedClient.name)}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{selectedClient.name}</span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {selectedClient.email || "No email"}
                                            </span>
                                        </span>
                                        <button
                                            type="button"
                                            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
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
                                        <div className="flex gap-1 rounded-md bg-muted p-1 text-sm" role="tablist">
                                            {([
                                                ["available", "Available", availableClients.length],
                                                ["unavailable", "Unavailable", unavailableClients.length]
                                            ] as const).map(([key, label, count]) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={tab === key}
                                                    onClick={() => setTab(key)}
                                                    className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${
                                                        tab === key
                                                            ? "bg-background shadow-sm"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    {label}
                                                    {!loadingClients && (
                                                        <span className="ml-1.5 text-xs text-muted-foreground">{count}</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        <div
                                            className="max-h-52 overflow-auto rounded-md border border-border"
                                            role="listbox"
                                            aria-label="Clients"
                                        >
                                            {loadingClients ? (
                                                <p className="p-4 text-center text-sm text-muted-foreground">Searching…</p>
                                            ) : visibleClients.length > 0 ? (
                                                visibleClients.map(client => {
                                                    const hasExisting = !!(client.existingDraftId || client.existingProjectId);
                                                    return (
                                                        <div
                                                            key={client.uid}
                                                            className="flex items-center gap-2 border-b border-border last:border-b-0"
                                                        >
                                                            <button
                                                                type="button"
                                                                role="option"
                                                                aria-selected={false}
                                                                disabled={!client.eligible}
                                                                onClick={() => setSelectedClientId(client.uid)}
                                                                className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left ${
                                                                    client.eligible ? "hover:bg-muted" : "cursor-not-allowed opacity-50"
                                                                }`}
                                                            >
                                                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                                                                    {initials(client.name)}
                                                                </span>
                                                                <span className="min-w-0">
                                                                    <span className="block truncate text-sm font-medium">{client.name}</span>
                                                                    <span className="block truncate text-xs text-muted-foreground">
                                                                        {client.email || "No email"}
                                                                    </span>
                                                                </span>
                                                            </button>
                                                            {!client.eligible && hasExisting && (
                                                                <button
                                                                    type="button"
                                                                    className="mr-3 shrink-0 text-xs font-medium text-primary hover:underline"
                                                                    onClick={() => openExistingFloorPlan(client)}
                                                                >
                                                                    Has plan · View
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <p className="p-4 text-center text-sm text-muted-foreground">
                                                    {tab === "available" ? "No available clients found" : "No unavailable clients"}
                                                </p>
                                            )}
                                        </div>
                                        {tab === "unavailable" && hasIneligibleMatches && (
                                            <p className="text-xs text-muted-foreground" role="status">
                                                Some matches can't be selected.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            {error && (
                                <p className="text-sm text-destructive" role="alert">{error}</p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
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
                    </section>
                </div>
            )}
        </>
    );
}