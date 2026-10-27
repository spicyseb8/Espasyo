import {
    Sofa,
    Paintbrush,
    FolderOpen,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

interface Props {
    activeTab: string;

    walkthroughMode: boolean;

    panelOpen: boolean;

    onTabChange: (tab: string) => void;
}

const TABS = [
    {
        id: "furniture",
        label: "Furniture",
        icon: Sofa,
    },
    {
        id: "design",
        label: "Design",
        icon: Paintbrush,
    },
    {
        id: "project",
        label: "Project",
        icon: FolderOpen,
    },
] as const;

export default function WorkspaceTabs({
    activeTab,
    walkthroughMode,
    panelOpen,
    onTabChange,
}: Props) {
    const reduce = useReducedMotion();

    return (
        <div
            className={
                walkthroughMode
                    ? "workspace-tabs walkthrough-locked"
                    : "workspace-tabs"
            }
            role="toolbar"
            aria-label="Workspace tabs"
        >
            {TABS.map((tab) => {
                const Icon = tab.icon;

                const isActive = activeTab === tab.id && panelOpen;

                return (
                    <button
                        key={tab.id}
                        type="button"
                        aria-label={tab.label}
                        aria-pressed={isActive}
                        title={tab.label}
                        disabled={walkthroughMode}
                        className={isActive ? "tab active" : "tab"}
                        onClick={() => onTabChange(tab.id)}
                    >
                        {isActive && (
                            <motion.span
                                layoutId="workspaceTabPill"
                                className="tab-pill"
                                transition={
                                    reduce
                                        ? { duration: 0 }
                                        : {
                                              type: "spring",
                                              bounce: 0,
                                              duration: 0.35,
                                          }
                                }
                            />
                        )}

                        <Icon size={18} className="tab-icon" />

                        {isActive && (
                            <span className="tab-label">{tab.label}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}