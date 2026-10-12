import "./BuildPanel.css";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import useEditor from "../../../context/editor/useEditor";
import AssetSection from "./AssetSection";
import { AssetLibrary } from "../../../assets/AssetLibrary";
import type { Asset } from "../../../assets/Asset";
import { getDoorAssets, getWindowAssets } from "../../../engine/build/FirebaseDoorWindowLibrary";

function filterAssets(assets: Asset[], query: string) {
    if (!query) {
        return assets;
    }

    const q = query.toLowerCase();

    return assets.filter(asset => asset.name.toLowerCase().includes(q));
}

export default function BuildPanel() {
    const { state } = useEditor();
    const [query, setQuery] = useState("");
    const [doors, setDoors] = useState<Asset[]>([]);
    const [windows, setWindows] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        setLoading(true);

        Promise.all([
            getDoorAssets(),
            getWindowAssets()
        ])
            .then(([firebaseDoors, firebaseWindows]) => {
                if (cancelled) {
                    return;
                }

                setDoors(firebaseDoors);
                setWindows(firebaseWindows);
            })
            .catch(error => {
                console.error("Failed to load Firebase doors/windows:", error);
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const sections = useMemo(
        () => [
            {
                title: "Openings",
                assets: AssetLibrary.openings
            },
            {
                title: "Doors",
                assets: doors
            },
            {
                title: "Windows",
                assets: windows
            }
        ],
        [doors, windows]
    );

    const isSearching = query.trim().length > 0;
    const layoutLocked = !state.layoutConfirmed;

    return (
        <div
            className="build-panel"
            style={{
                opacity: layoutLocked ? 0.5 : 1,
                pointerEvents: layoutLocked ? "none" : "auto"
            }}
        >
            {layoutLocked && (
                <div
                    style={{
                        padding: "10px 12px",
                        textAlign: "center",
                        fontSize: "12px",
                        lineHeight: 1.4
                    }}
                >
                    Confirm the layout first before placing doors, windows, or openings.
                </div>
            )}

            <div className="build-panel-search">
                <Search
                    size={14}
                    className="build-panel-search-icon"
                />
                <input
                    type="text"
                    placeholder="Search assets"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                />
            </div>

            {loading &&
                doors.length === 0 &&
                windows.length === 0 && (
                    <div
                        style={{
                            padding: "12px",
                            fontSize: "12px",
                            opacity: 0.65
                        }}
                    >
                        Loading doors and windows...
                    </div>
                )}

            <div className="build-panel-sections">
                {sections.map(section => (
                    <AssetSection
                        key={section.title}
                        title={section.title}
                        assets={filterAssets(section.assets, query)}
                        defaultOpen={section.title === "Openings"}
                        forceOpen={isSearching ? true : undefined}
                    />
                ))}
            </div>
        </div>
    );
}