import { useState } from "react";
import { Info, Search } from "lucide-react";
import "./InstructionModal.css";

type Shortcut = {
    label: string;
    keys: string[];
};

type Step = {
    image: string;
    text: string;
    locked?: boolean;
    costNote?: boolean;
};

const CATEGORIES = [
    "General",
    "Camera",
    "How it Works",
] as const;

type Category = (typeof CATEGORIES)[number];
type ShortcutCategory = Exclude<Category, "How it Works">;

const SHORTCUTS: Record<ShortcutCategory, Shortcut[]> = {
    General: [
        { label: "Confirm Action", keys: ["Space"] },
        { label: "Cancel Action", keys: ["Shift", "Space"] },
        { label: "Undo", keys: ["Ctrl", "Z"] },
        { label: "Redo", keys: ["Ctrl", "Y"] },
        { label: "Delete", keys: ["Del"] },
    ],

    Camera: [
        { label: "Move Forward", keys: ["W"] },
        { label: "Move Backward", keys: ["S"] },
        { label: "Move Left", keys: ["A"] },
        { label: "Move Right", keys: ["D"] },
    ],
};

const STEPS: Step[] = [
    {
        image: "/images/step-1.png",
        text: "Floorplan: Lay out the walls of your house or room. This is your blueprint before anything else gets built.",
    },
    {
        image: "/images/step-2.png",
        text: "Confirm Layout: Once you're happy with the walls, confirm the layout. This locks it in — you won't be able to return to the floorplan panel to edit walls after this.",
        locked: true,
    },
    {
        image: "/images/step-3.png",
        text: "Build: Add door openings and windows to your confirmed walls.",
    },
    {
        image: "/images/step-4.png",
        text: "Confirm Build: Confirm your doors and windows. Like the layout step, this is final — there's no returning to the build panel afterward.",
        locked: true,
    },
    {
        image: "/images/step-5.png",
        text: "Furniture: Select a piece of furniture, click Apply, then place it in your space. You can freely move back and forth between this and the remaining panels. Your estimated cost updates automatically as you add furniture.",
        costNote: true,
    },
    {
        image: "/images/step-6.png",
        text: "Design: Select a floor or wall, choose a texture or design for it, then click Apply. Your estimated cost updates automatically as you apply designs, too.",
        costNote: true,
    },
    {
        image: "/images/step-7.png",
        text: "Save: Review your final estimated cost, save your design, or export it to PDF.",
    },
];

export default function InstructionModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeCategory, setActiveCategory] =
        useState<Category>("General");
    const [query, setQuery] = useState("");
    const [stepIndex, setStepIndex] = useState(0);

    const isHowItWorks = activeCategory === "How it Works";

    const shortcuts = isHowItWorks
        ? []
        : SHORTCUTS[activeCategory].filter((shortcut) =>
              shortcut.label
                  .toLowerCase()
                  .includes(query.toLowerCase())
          );

    const handleCategoryClick = (category: Category) => {
        setActiveCategory(category);
        setStepIndex(0);
        setQuery("");
    };

    const handleBack = () => {
        setStepIndex((index) => Math.max(index - 1, 0));
    };

    const handleNext = () => {
        setStepIndex((index) =>
            Math.min(index + 1, STEPS.length - 1)
        );
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    return (
        <>
            {/* Instruction button */}
            <button
                type="button"
                className="instruction-button"
                onClick={() => setIsOpen(true)}
                aria-label="Open instructions"
            >
                <Info size={20} />
            </button>

            {/* Modal */}
            {isOpen && (
                <div
                    className="instruction-modal-overlay"
                    onClick={handleClose}
                >
                    <div
                        className="instruction-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="instruction-modal-header">
                            <h4 className="instruction-title">
                                Instructions
                            </h4>

                            <button
                                type="button"
                                className="instruction-close-button"
                                onClick={handleClose}
                                aria-label="Close instructions"
                            >
                                ×
                            </button>
                        </div>

                        <div className="instruction-search-wrapper">
                            <Search
                                size={16}
                                className="instruction-search-icon"
                            />

                            <input
                                className="instruction-search-input"
                                type="text"
                                placeholder={
                                    isHowItWorks
                                        ? "Search unavailable here"
                                        : "Search shortcuts"
                                }
                                value={isHowItWorks ? "" : query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                disabled={isHowItWorks}
                            />
                        </div>

                        <div className="instruction-modal-body">

                            {/* Sidebar */}
                            <div className="instruction-sidebar">
                                {CATEGORIES.map((category) => (
                                    <button
                                        key={category}
                                        type="button"
                                        className={`instruction-sidebar-item ${
                                            category === activeCategory
                                                ? "active"
                                                : ""
                                        }`}
                                        onClick={() =>
                                            handleCategoryClick(category)
                                        }
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>

                            {/* Content */}
                            {isHowItWorks ? (
                                <div className="instruction-steps-panel">

                                    <div className="instruction-step-image-wrapper">
                                        <img
                                            src={STEPS[stepIndex].image}
                                            alt={`Step ${
                                                stepIndex + 1
                                            }`}
                                            className="instruction-step-image"
                                        />

                                        <div className="instruction-step-badges">
                                            {STEPS[stepIndex].locked && (
                                                <span className="instruction-step-badge instruction-step-badge-locked">
                                                    Can't go back after this
                                                </span>
                                            )}

                                            {STEPS[stepIndex].costNote && (
                                                <span className="instruction-step-badge instruction-step-badge-cost">
                                                    Live cost estimate
                                                </span>
                                            )}
                                        </div>

                                        <div className="instruction-step-image-fade" />
                                    </div>

                                    <p className="instruction-step-text">
                                        {STEPS[stepIndex].text}
                                    </p>

                                    <div className="instruction-step-nav">
                                        <button
                                            type="button"
                                            className="instruction-step-nav-button"
                                            onClick={handleBack}
                                            disabled={stepIndex === 0}
                                        >
                                            Back
                                        </button>

                                        <span className="instruction-step-indicator">
                                            {stepIndex + 1} /{" "}
                                            {STEPS.length}
                                        </span>

                                        <button
                                            type="button"
                                            className="instruction-step-nav-button"
                                            onClick={handleNext}
                                            disabled={
                                                stepIndex ===
                                                STEPS.length - 1
                                            }
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="instruction-shortcut-list">
                                    {shortcuts.length === 0 ? (
                                        <p className="instruction-empty-state">
                                            No shortcuts found.
                                        </p>
                                    ) : (
                                        shortcuts.map((shortcut) => (
                                            <div
                                                className="instruction-shortcut-row"
                                                key={shortcut.label}
                                            >
                                                <span className="instruction-shortcut-label">
                                                    {shortcut.label}
                                                </span>

                                                <span className="instruction-key-group">
                                                    {shortcut.keys.map(
                                                        (key, index) =>
                                                            key.toLowerCase() ===
                                                            "or" ? (
                                                                <span
                                                                    className="instruction-key-separator"
                                                                    key={index}
                                                                >
                                                                    {key}
                                                                </span>
                                                            ) : (
                                                                <kbd
                                                                    className="instruction-key"
                                                                    key={index}
                                                                >
                                                                    {key}
                                                                </kbd>
                                                            )
                                                    )}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}