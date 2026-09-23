import "./BuildPanel.css";

import {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    Search
} from "lucide-react";

import AssetSection
    from "./AssetSection";

import {
    AssetLibrary
} from "../../../assets/AssetLibrary";

import type {
    Asset
} from "../../../assets/Asset";

import {
    getDoorAssets,
    getWindowAssets
} from "../../../engine/build/FirebaseDoorWindowLibrary";


function filterAssets(
    assets: Asset[],
    query: string
) {

    if (
        !query
    ) {

        return assets;
    }

    const q =
        query.toLowerCase();

    return assets.filter(
        asset =>
            asset.name
                .toLowerCase()
                .includes(q)
    );
}


export default function BuildPanel() {

    const [
        query,
        setQuery
    ] = useState("");

    const [
        doors,
        setDoors
    ] = useState<Asset[]>([]);

    const [
        windows,
        setWindows
    ] = useState<Asset[]>([]);

    const [
        loading,
        setLoading
    ] = useState(true);


    //--------------------------------------------------
    // Load Firebase doors/windows
    //--------------------------------------------------

    useEffect(
        () => {

            let cancelled =
                false;

            setLoading(true);

            Promise.all([
                getDoorAssets(),
                getWindowAssets()
            ])
                .then(
                    ([
                        firebaseDoors,
                        firebaseWindows
                    ]) => {

                        if (
                            cancelled
                        ) {

                            return;
                        }

                        setDoors(
                            firebaseDoors
                        );

                        setWindows(
                            firebaseWindows
                        );

                    }
                )
                .catch(
                    error => {

                        console.error(
                            "Failed to load Firebase doors/windows:",
                            error
                        );

                    }
                )
                .finally(
                    () => {

                        if (
                            !cancelled
                        ) {

                            setLoading(false);

                        }

                    }
                );

            return () => {

                cancelled =
                    true;

            };

        },
        []
    );


    const sections =
        useMemo(
            () => ([

                // Openings remain local for now.
                {
                    title:
                        "Openings",
                    assets:
                        AssetLibrary.openings
                },

                // Doors now come from Firebase.
                {
                    title:
                        "Doors",
                    assets:
                        doors
                },

                // Windows now come from Firebase.
                {
                    title:
                        "Windows",
                    assets:
                        windows
                }

            ]),
            [
                doors,
                windows
            ]
        );


    const isSearching =
        query.trim().length > 0;


    return (

        <div
            className="build-panel"
        >

            <div
                className="build-panel-search"
            >

                <Search
                    size={14}
                    className="build-panel-search-icon"
                />

                <input
                    type="text"
                    placeholder="Search assets"
                    value={query}
                    onChange={
                        event =>
                            setQuery(
                                event.target.value
                            )
                    }
                />

            </div>


            {
                loading &&
                doors.length === 0 &&
                windows.length === 0 && (

                    <div
                        style={{
                            padding:
                                "12px",
                            fontSize:
                                "12px",
                            opacity:
                                0.65
                        }}
                    >
                        Loading doors and windows...
                    </div>

                )
            }


            <div
                className="build-panel-sections"
            >

                {
                    sections.map(
                        section => (

                            <AssetSection
                                key={
                                    section.title
                                }

                                title={
                                    section.title
                                }

                                assets={
                                    filterAssets(
                                        section.assets,
                                        query
                                    )
                                }

                                defaultOpen={
                                    section.title ===
                                    "Openings"
                                }

                                forceOpen={
                                    isSearching
                                        ? true
                                        : undefined
                                }
                            />

                        )
                    )
                }

            </div>

        </div>
    );
}
