import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import {
    getAdminClients,
    type AdminClient
} from "@/services/assets/projectService";
import LoadingScreen from "@/components/LoadingScreen";

export default function NewFloorPlanProjectButton() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [clients, setClients] = useState<AdminClient[]>([]);
    const [selectedClientId, setSelectedClientId] = useState("");
    const [loadingClients, setLoadingClients] = useState(false);
    const [openingEditor, setOpeningEditor] = useState(false);
    const [error, setError] = useState("");

    async function openDialog() {
        setOpen(true);
        setError("");
        setLoadingClients(true);
        try {
            setClients(await getAdminClients());
        } catch (loadError) {
            console.error("Failed to load clients for floor-plan creation:", loadError);
            setError("Unable to load clients. Please try again.");
        } finally {
            setLoadingClients(false);
        }
    }

    function createProject() {
        const client = clients.find(item => item.id === selectedClientId);
        if (!client || openingEditor) return;
        setOpeningEditor(true);
        setOpen(false);
        try {
            navigate(`/projects/new/${encodeURIComponent(client.uid)}`, {
                state: { ownerName: client.name }
            });
        } catch (navigationError) {
            setOpeningEditor(false);
            setOpen(true);
            setError(navigationError instanceof Error
                ? `Unable to open the floor plan: ${navigationError.message}`
                : "Unable to open the floor plan.");
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
                    <div className="w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-lg">
                        <div className="mb-4">
                            <p className="font-medium">Create floor-plan project</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Select the client who will own the project.
                            </p>
                        </div>
                        <label className="grid gap-2 text-sm">
                            Client
                            <select
                                className="h-9 rounded-md border border-border bg-background px-3"
                                value={selectedClientId}
                                onChange={event => setSelectedClientId(event.target.value)}
                                disabled={loadingClients}
                            >
                                <option value="">
                                    {loadingClients ? "Loading clients..." : "Select a client"}
                                </option>
                                {clients.map(client => (
                                    <option key={client.id} value={client.id}>
                                        {client.name}{client.email ? ` (${client.email})` : ""}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                className="h-9 rounded-md border border-border px-3 text-sm"
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
                                disabled={!selectedClientId || loadingClients}
                                onClick={createProject}
                            >
                                Create Floor Plan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
