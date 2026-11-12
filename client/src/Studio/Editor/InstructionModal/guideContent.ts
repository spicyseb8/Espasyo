export interface GuideShortcut {
    label: string;
    keys: string[];
}

export interface GuideTab {
    id: string;
    label: string;
    sections: GuideSection[];
    advanced?: {
        title: string;
        paragraphs: string[];
    };
}

export type GuideSection =
    | {
        id: string;
        type: "text";
        title?: string;
        paragraphs: string[];
        bullets?: string[];
        imageSrc?: string;
    }
    | {
        id: string;
        type: "steps";
        title?: string;
        steps: string[];
        imageSrc?: string;
    }
    | {
        id: string;
        type: "table";
        title?: string;
        rows: { label: string; description: string }[];
        imageSrc?: string;
    }
    | {
        id: string;
        type: "tabs";
        tabs: GuideTab[];
        imageSrc?: string;
    }
    | {
        id: string;
        type: "shortcuts";
        title: string;
        imageSrc?: string;
    };

export interface GuidePage {
    id: string;
    title: string;
    sections: GuideSection[];
}

// TODO: verify: the legacy modal lists Space, Shift+Space, and Delete shortcuts,
// but those actions are not implemented in the client editor's keyboard handlers.
export const GUIDE_SHORTCUTS: Record<"General" | "Camera", GuideShortcut[]> = {
    General: [
        {
            label: "Open or close the last used panel (Furniture, Flooring, or Paint)",
            keys: ["Tab"],
        },
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

export const GUIDE_PAGES: GuidePage[] = [
    {
        id: "welcome",
        title: "Welcome to your project",
        sections: [
            {
                id: "welcome-copy",
                type: "text",
                paragraphs: [
                    "Your studio prepared this floor plan for you. You furnish it, choose finishes, save your work, and submit it for review.",
                    "You can't change walls or the room layout. That is handled by your studio.",
                    "This is a preliminary design proposal, not a construction-ready plan.",
                ],
                bullets: [
                    "Quick flow: Design → Check budget → Save → Submit → Approval or revision.",
                ],
            },
        ],
    },
    {
        id: "getting-around",
        title: "Getting around",
        sections: [
            {
                id: "camera-controls",
                type: "text",
                title: "Camera controls",
                // TODO: verify exact mouse and trackpad gestures; they are not documented in code.
                paragraphs: [
                    "Use W, A, S, and D to move the camera.",
                ],
            },
            {
                id: "top-bar",
                type: "text",
                title: "Top bar",
                paragraphs: [
                    "Project: open the project panel for its name, status, deadline, Save, and Submit controls. Project Budget is in the Estimate menu.",
                    "Undo / Redo: step back or forward through your changes. These buttons are disabled when there is nothing to undo or when the project is locked.",
                    "Admin comments: feedback from your studio appears here.",
                    "Estimate: see the live estimated cost and breakdown. Download cost breakdown PDF exports that breakdown.",
                ],
            },
            {
                id: "floors",
                type: "text",
                title: "Floors",
                paragraphs: [
                    "If the project has several floors, switch with the floor tabs (1F, 2F...). Furniture and finishes apply to the active floor.",
                ],
            },
            {
                id: "walkthrough",
                type: "text",
                title: "Walkthrough",
                paragraphs: [
                    "Click Start Walkthrough, choose a starting point in the scene, and use the same control to exit. The workspace panel closes and the tabs are disabled during walkthrough.",
                    "If you see “Create a room first”, it means the plan doesn't have enough walls for walkthrough yet; contact your studio.",
                ],
            },
            {
                id: "panel-tip",
                type: "text",
                paragraphs: [
                    "Click the active tab, press Tab, or press Escape to close the side panel. Press Tab again to reopen the last one you used.",
                ],
            },
            {
                id: "keyboard-shortcuts",
                type: "shortcuts",
                title: "Keyboard shortcuts",
            },
        ],
    },
    {
        id: "design",
        title: "Design your space",
        sections: [
            {
                id: "design-start",
                type: "text",
                paragraphs: [
                    "No panel is open when the editor loads. Pick a tab or press Tab to begin.",
                ],
            },
            {
                id: "design-tabs",
                type: "tabs",
                tabs: [
                    {
                        id: "furniture",
                        label: "Furniture",
                        sections: [
                            {
                                id: "furniture-steps",
                                type: "steps",
                                steps: [
                                    "Open Furniture. Browse All, Favorites, or a category, or search by name.",
                                    "Select an item card, then click Apply.",
                                    "Move the item into the scene and click to place it. Invalid placements (overlapping or colliding with other objects) are blocked.",
                                    "Click a placed item to use the toolbar: Rotate (when available), Duplicate, Move, Delete.",
                                    "Repeat to add more items. Star items to save them as favorites.",
                                ],
                            },
                        ],
                    },
                    {
                        id: "flooring",
                        label: "Flooring",
                        sections: [
                            {
                                id: "flooring-steps",
                                type: "steps",
                                steps: [
                                    "Search, or filter by All / Tiles / Wood. Use the favorites-first toggle if needed.",
                                    "Select a material (the cursor shows paint mode).",
                                    "Click the floor you want to change.",
                                    "Click “Apply this material to the room” to confirm. This button disappears after a few seconds if unused.",
                                    "Cancel a selection with Escape or right-click.",
                                ],
                            },
                        ],
                        advanced: {
                            title: "Advanced: Surface separator",
                            paragraphs: [
                                "Choose Add a surface separator, then select Horizontal or Vertical to divide a surface into sections for separate finishes.",
                            ],
                        },
                    },
                    {
                        id: "paint",
                        label: "Paint",
                        sections: [
                            {
                                id: "paint-steps",
                                type: "steps",
                                steps: [
                                    "Search for a paint or wall finish. Use favorites-first if needed.",
                                    "Select a material, then click the wall surface.",
                                    "Click “Apply this material to the room” to confirm. The finish applies to the room-facing wall surfaces, and the result depends on which side of the wall you clicked.",
                                    "Cancel with Escape or right-click.",
                                ],
                            },
                        ],
                        advanced: {
                            title: "Advanced: Surface separator",
                            paragraphs: [
                                "Choose Add a surface separator, then select Horizontal or Vertical to divide a surface into sections for separate finishes.",
                            ],
                        },
                    },
                ],
            },
            {
                id: "save-reminder",
                type: "text",
                paragraphs: [
                    "Changes aren't stored until you save (see page 5).",
                ],
            },
        ],
    },
    {
        id: "budget",
        title: "Watch your budget",
        sections: [
            {
                id: "budget-details",
                type: "text",
                paragraphs: [
                    "The Estimate updates as you add furniture and finishes. Click it to see the breakdown.",
                    "Set a maximum budget in Project Budget (must be greater than ₱0; you can remove it). The estimate shows Within Budget, Near Budget, or Over Budget.",
                    "If an item has a missing or invalid price, the estimate may be marked incomplete.",
                    "The estimate is based on catalog prices. It is not a final quotation.",
                    "Download cost breakdown PDF exports your cost breakdown.",
                ],
            },
        ],
    },
    {
        id: "save-submit",
        title: "Save, submit, and what happens next",
        sections: [
            {
                id: "save-and-submit",
                type: "text",
                paragraphs: [
                    "Save: open Project and click Save Project (first time) or Save Changes. Your project name is set by your studio and can't be changed. Save often.",
                    "Deadline: you can edit only before the deadline shown in the Project panel.",
                    "Submit: after saving at least once, click Submit for Review, read and tick the Project Submission Agreement, optionally allow public sharing (lets your approved design be shown to other clients as a view-only inspiration), then click Confirm Submission.",
                    "While under review, editing is paused.",
                    "Outcomes: the studio will approve it (read-only from then on) or request revisions (you'll see their comments under Admin comments and can edit again).",
                    "Important: approval is a design reference, not construction authorization. Final specifications, quotations, and agreements are handled separately.",
                ],
            },
            {
                id: "edit-locks",
                type: "table",
                title: "Why can't I edit?",
                rows: [
                    { label: "No deadline set", description: "Wait for your studio to set one." },
                    { label: "Deadline passed", description: "The project is read-only." },
                    { label: "Submitted", description: "The project is under review." },
                    { label: "Approved", description: "The project is read-only." },
                    { label: "No saved version", description: "Submit is disabled until you save once." },
                ],
            },
            {
                id: "project-name-note",
                type: "text",
                paragraphs: [
                    "For managed projects, the Project panel's Project Name is the name used when saving and is set by your studio. The separate name box in the top bar is stored in this browser.",
                ],
            },
        ],
    },
];
