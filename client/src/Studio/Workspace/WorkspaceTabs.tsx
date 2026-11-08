import {
    Grid2X2,
    Sofa,
    Paintbrush,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export type WorkspacePanel =
    | "furniture"
    | "flooring"
    | "paint"
    | "project"
    | null;

interface Props {
    activePanel: WorkspacePanel;
    walkthroughMode: boolean;
    onPanelChange: (panel: WorkspacePanel) => void;
}

const TABS = [
    {
        id: "furniture",
        label: "Furniture",
        icon: Sofa,
    },
    {
        id: "flooring",
        label: "Flooring",
        icon: Grid2X2,
    },
    {
        id: "paint",
        label: "Paint",
        icon: Paintbrush,
    },
] as const;

export default function WorkspaceTabs({
    activePanel,
    walkthroughMode,
    onPanelChange,
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
            aria-label="Editor panels"
        >
            {TABS.map((tab) => {
                const Icon = tab.icon;

                const isActive = activePanel === tab.id;

                return (
                    <button
                        key={tab.id}
                        type="button"
                        aria-label={`${tab.label} panel`}
                        aria-pressed={isActive}
                        title={tab.label}
                        disabled={walkthroughMode}
                        className={isActive ? "tab active" : "tab"}
                        onClick={() =>
                            onPanelChange(isActive ? null : tab.id)
                        }
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
                        <span className="tab-label">{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}