import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import {
    getAdminClients,
    type AdminClient
} from "@/services/assets/projectService";
import { createManagedFloorPlanDraft } from "@/services/assets/projectStructureService";
import LoadingScreen from "@/components/LoadingScreen";

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
                    setError("Unable to search eligible clients. Please try again.");
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

    function openDialog() {
        setProjectName("");
        setSearch("");
        setClients([]);
        setSelectedClientId("");
        setHasIneligibleMatches(false);
        setError("");
        setOpen(true);
    }

    async function createProject() {
        if (!projectName.trim() || !selectedClientId || creating) return;
        const client = clients.find(item => item.uid === selectedClientId);
        if (!client?.eligible) return;

        setCreating(true);
        setError("");
        try {
            const draft = await createManagedFloorPlanDraft({
                projectName: projectName.trim(),
                ownerId: client.uid
            });
            setOpen(false);
            setOpeningEditor(true);
            navigate(`/projects/draft/${encodeURIComponent(draft.draftId)}`, {
                state: {
                    ownerName: client.name,
                    showInitializationLoading: true
                }
            });
        } catch (createError) {
            setError(createError instanceof Error
                ? createError.message
                : "Unable to create the floor-plan draft.");
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <section
                        className="w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-lg"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-floor-plan-title"
                    >
                        <div className="mb-4">
                            <h2 id="create-floor-plan-title" className="font-medium">Create floor-plan project</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Choose an eligible client. A draft reserves their one floor-plan slot but is not available to them until published.
                            </p>
                        </div>
                        <label className="mb-4 grid gap-2 text-sm">
                            Floor-plan name
                            <input
                                className="h-9 rounded-md border border-border bg-background px-3"
                                value={projectName}
                                onChange={event => setProjectName(event.target.value)}
                                maxLength={120}
                                required
                                autoFocus
                                placeholder="Enter project name"
                            />
                        </label>
                        <label className="grid gap-2 text-sm">
                            Search clients
                            <span className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3"
                                    value={search}
                                    onChange={event => {
                                        setSearch(event.target.value);
                                        setSelectedClientId("");
                                    }}
                                    placeholder="Search by name or email"
                                    aria-label="Search clients by name or email"
                                />
                            </span>
                        </label>
                        <div className="mt-2 max-h-48 overflow-auto rounded-md border border-border" role="listbox" aria-label="Clients">
                            {loadingClients ? (
                                <p className="p-3 text-sm text-muted-foreground">Searching clients...</p>
                            ) : clients.length > 0 ? (
                                clients.map(client => (
                                    <div key={client.uid} className="border-b border-border px-3 py-2 last:border-b-0">
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={selectedClientId === client.uid}
                                            className={`block w-full rounded text-left ${client.eligible ? "hover:bg-muted" : "cursor-not-allowed opacity-70"} ${selectedClientId === client.uid ? "bg-muted" : ""}`}
                                            disabled={!client.eligible}
                                            onClick={() => setSelectedClientId(client.uid)}
                                        >
                                            <span className="block text-sm font-medium">{client.name}</span>
                                            <span className="block text-xs text-muted-foreground">{client.email || "No email address"}</span>
                                        </button>
                                        {!client.eligible && (client.existingProjectId || client.existingDraftId) && (
                                            <div className="mt-1 flex items-center justify-between gap-2">
                                                <span className="text-xs text-amber-700">
                                                    {client.existingDraftId
                                                        ? "This client already has a floorplan. You can view the existing draft, but cannot create another one."
                                                        : "This client already has a floorplan. You can view the existing project, but cannot create another one."}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="shrink-0 text-xs underline"
                                                    onClick={() => openExistingFloorPlan(client)}
                                                >
                                                    {client.existingDraftId ? "View draft" : "View project"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="p-3 text-sm text-muted-foreground">
                                    {search ? "No eligible clients match this search." : "No eligible clients are available."}
                                </p>
                            )}
                        </div>
                        {hasIneligibleMatches && (
                            <p className="mt-2 text-xs text-amber-700" role="status">
                                Some matching accounts are admin or employee accounts, or already have a floorplan, so they cannot be selected.
                            </p>
                        )}
                        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                className="h-9 rounded-md border border-border px-3 text-sm"
                                onClick={() => setOpen(false)}
                                disabled={creating}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
                                disabled={!projectName.trim() || !selectedClientId || loadingClients || creating}
                                onClick={() => void createProject()}
                            >
                                {creating ? "Creating..." : "Create Floor Plan"}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}
