import "./WorkspaceTabs.css";

import {
    DraftingCompass,
    Hammer,
    Sofa,
    Paintbrush,
    Lightbulb,
    FolderOpen
} from "lucide-react";
interface Props {

    activeTab: string;
    layoutConfirmed: boolean;

    onTabChange: (tab: string) => void;

}

export default function WorkspaceTabs({

    activeTab,
    layoutConfirmed,

    onTabChange

}: Props) {

    const tabs = [

        {
            id: "floorplan",
            icon: DraftingCompass
        },

        {
            id: "build",
            icon: Hammer
        },

        {
            id: "furniture",
            icon: Sofa
        },

        {
            id: "design",
            icon: Paintbrush
        },

        {
            id: "lighting",
            icon: Lightbulb
        },

        {
            id: "project",
            icon: FolderOpen
        }

    ];

    return (

        <div className="workspace-tabs">

            {tabs.map((tab) => {

                const Icon = tab.icon;

                const disabled =
                layoutConfirmed &&
                tab.id === "floorplan";

                return (

                    <button

                        key={tab.id}

                        disabled={disabled}

                        className={
                            `${activeTab === tab.id ? "tab active" : "tab"} ${
                                disabled ? "disabled" : ""
                            }`
                        }

                        onClick={() => onTabChange(tab.id)}

                    >

                        <Icon size={20} />

                    </button>

                );
            })}

        </div>

    );

}