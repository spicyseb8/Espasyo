import "./WorkspaceTabs.css";

import {
    DraftingCompass,
    Hammer,
    Sofa,
    Paintbrush,
    Lightbulb,
    FolderOpen,
    Lock
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

        { id: "floorplan", label: "Floor Plan", icon: DraftingCompass },
        { id: "build", label: "Build", icon: Hammer },
        { id: "furniture", label: "Furniture", icon: Sofa },
        { id: "design", label: "Design", icon: Paintbrush },
        { id: "lighting", label: "Lighting", icon: Lightbulb },
        { id: "project", label: "Project", icon: FolderOpen }

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
                        aria-label={tab.label}

                        className={
                            `${activeTab === tab.id ? "tab active" : "tab"} ${
                                disabled ? "disabled" : ""
                            }`
                        }

                        onClick={() => onTabChange(tab.id)}

                    >

                        <Icon size={20} />
                        {disabled && <Lock size={10} className="tab-lock" />}
                        <span className="tab-tooltip">{tab.label}</span>

                    </button>

                );
            })}

        </div>

    );

}