import "./WorkspaceTabs.css";

import {
    DraftingCompass,
    Hammer,
    Sofa,
    Paintbrush,
    FolderOpen
} from "lucide-react";

interface Props {

    activeTab: string;

    layoutConfirmed: boolean;

    walkthroughMode: boolean;

    onTabChange: (
        tab: string
    ) => void;

}

export default function WorkspaceTabs({

    activeTab,

    layoutConfirmed,

    walkthroughMode,

    onTabChange

}: Props) {

    const tabs = [

        {
            id:
                "floorplan",

            label:
                "Floor Plan",

            icon:
                DraftingCompass
        },

        {
            id:
                "build",

            label:
                "Build",

            icon:
                Hammer
        },

        {
            id:
                "furniture",

            label:
                "Furniture",

            icon:
                Sofa
        },

        {
            id:
                "design",

            label:
                "Design",

            icon:
                Paintbrush
        },

        {
            id:
                "project",

            label:
                "Project",

            icon:
                FolderOpen
        }

    ];


    return (

        <div
            className={
                walkthroughMode
                    ? "workspace-tabs walkthrough-locked"
                    : "workspace-tabs"
            }
        >

            {
                tabs.map(
                    (
                        tab
                    ) => {

                        const Icon =
                            tab.icon;


                        return (

                            <button

                                key={
                                    tab.id
                                }

                                type="button"

                                aria-label={
                                    tab.label
                                }

                                disabled={
                                    walkthroughMode
                                }

                                className={

                                    activeTab ===
                                    tab.id

                                        ? "tab active"

                                        : "tab"

                                }

                                onClick={() =>
                                    onTabChange(
                                        tab.id
                                    )
                                }

                            >

                                <Icon
                                    size={20}
                                />

                                <span
                                    className="tab-tooltip"
                                >

                                    {
                                        tab.label
                                    }

                                </span>

                            </button>

                        );

                    }
                )
            }

        </div>

    );
}