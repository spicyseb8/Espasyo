import {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";

import {
    EditorContext
} from "./EditorContext";

import {
    editorReducer
} from "./editor/editorReducer";

import {
    initialState
} from "./editor/initialState";

import type {
    EditorState
} from "./editor/types";

import type {
    EditorAction
} from "./editor/editorActions";

import {
    createFloorPlanSnapshot,
    createEditorSnapshot,
    restoreFloorPlanSnapshot,
    restoreEditorSnapshot,
    trimHistory
} from "./editor/EditorHistory";

import type {
    FloorPlanSnapshot,
    EditorSnapshot
} from "./editor/EditorHistory";

//==================================================
// HISTORY ACTION CLASSIFICATION
//==================================================

//--------------------------------------------------
// Floor Plan actions
//--------------------------------------------------

function isFloorPlanAction(
    action: EditorAction
): boolean {

    switch (
        action.type
    ) {

        case "ADD_WALL":
        case "REMOVE_WALL":
        case "SET_WALLS":
        case "SET_CORNERS":
        case "SET_WALL_HEIGHT":
        case "SET_WALL_THICKNESS":

            return true;

        default:

            return false;
    }
}

//--------------------------------------------------
// Global editor actions
//--------------------------------------------------

function isGlobalEditorAction(
    action: EditorAction
): boolean {

    switch (
        action.type
    ) {

        case "ADD_FURNITURE":

        case "UPDATE_FURNITURE":

        case "REMOVE_FURNITURE":

        case "ADD_DOOR":

        case "UPDATE_DOOR":

        case "REMOVE_DOOR":

        case "ADD_WINDOW":

        case "UPDATE_WINDOW":

        case "REMOVE_WINDOW":

        case "ADD_OPENING":

        case "SET_FLOOR_FINISH":

        case "SET_WALL_FINISH":

            return true;

        default:

            return false;
    }
}
//--------------------------------------------------
// Material actions can be dispatched multiple
// times during one user action.
//
// Example:
// Apply floor material to ALL rooms
// → several SET_FLOOR_FINISH dispatches.
//
// They should create ONE Undo entry.
//--------------------------------------------------

function isMaterialAction(
    action: EditorAction
): boolean {

    switch (
        action.type
    ) {

        case "SET_FLOOR_FINISH":
        case "SET_WALL_FINISH":

            return true;

        default:

            return false;
    }
}

//==================================================
// INPUT TARGET
//==================================================

function isTypingTarget(
    target: EventTarget | null
): boolean {

    const element =
        target as HTMLElement | null;

    if (!element) {
        return false;
    }

    const tag =
        element.tagName?.toLowerCase();

    return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        element.isContentEditable
    );
}

//==================================================
// PROVIDER
//==================================================

export default function EditorProvider({

    children

}: {

    children:
        React.ReactNode;

}) {

    //==================================================
    // EDITOR STATE
    //==================================================

    const [
        state,
        setState
    ] = useState<EditorState>(
        initialState
    );

    //--------------------------------------------------
    // Always keep the newest state available to
    // synchronous dispatch calls.
    //--------------------------------------------------

    const stateRef =
        useRef<EditorState>(
            initialState
        );

    //==================================================
    // FLOOR PLAN HISTORY
    //==================================================

    const floorPast =
        useRef<FloorPlanSnapshot[]>(
            []
        );

    const floorFuture =
        useRef<FloorPlanSnapshot[]>(
            []
        );

    //==================================================
    // GLOBAL EDITOR HISTORY
    //==================================================

    const editorPast =
        useRef<EditorSnapshot[]>(
            []
        );

    const editorFuture =
        useRef<EditorSnapshot[]>(
            []
        );

    //==================================================
    // FORCE HISTORY UI UPDATE
    //==================================================

    const [
        historyVersion,
        setHistoryVersion
    ] = useState(0);

    const refreshHistoryUI =
        useCallback(() => {

            setHistoryVersion(
                value =>
                    value + 1
            );

        }, []);

    //==================================================
    // PENDING FLOOR GROUP
    //==================================================
    //
    // WallDrawer currently creates one wall by
    // dispatching:
    //
    // SET_CORNERS
    // SET_WALLS
    //
    // Those two dispatches represent ONE user action.
    //==================================================

    const pendingFloorSnapshot =
        useRef<FloorPlanSnapshot | null>(
            null
        );

    const floorGroupToken =
        useRef(0);

    //==================================================
    // PENDING GLOBAL GROUP
    //==================================================
    //
    // Used mainly for applying a material to multiple
    // rooms/walls in one click.
    //==================================================

    const pendingEditorSnapshot =
        useRef<EditorSnapshot | null>(
            null
        );

    const editorGroupToken =
        useRef(0);

    //==================================================
    // ADD FLOOR HISTORY
    //==================================================

    const pushFloorHistory =
        useCallback(
            (
                snapshot:
                    FloorPlanSnapshot
            ) => {

                floorPast.current =
                    trimHistory([
                        ...floorPast.current,
                        snapshot
                    ]);

                //--------------------------------------------------
                // A new action destroys the redo path.
                //--------------------------------------------------

                floorFuture.current =
                    [];

                refreshHistoryUI();
            },
            [
                refreshHistoryUI
            ]
        );

    //==================================================
    // ADD GLOBAL HISTORY
    //==================================================

    const pushEditorHistory =
        useCallback(
            (
                snapshot:
                    EditorSnapshot
            ) => {

                editorPast.current =
                    trimHistory([
                        ...editorPast.current,
                        snapshot
                    ]);

                //--------------------------------------------------
                // A new action destroys the redo path.
                //--------------------------------------------------

                editorFuture.current =
                    [];

                refreshHistoryUI();
            },
            [
                refreshHistoryUI
            ]
        );

    //==================================================
    // FLUSH PENDING FLOOR HISTORY
    //==================================================

    const flushPendingFloorHistory =
        useCallback(
            () => {

                if (
                    !pendingFloorSnapshot.current
                ) {
                    return;
                }

                const snapshot =
                    pendingFloorSnapshot.current;

                pendingFloorSnapshot.current =
                    null;

                floorGroupToken.current +=
                    1;

                pushFloorHistory(
                    snapshot
                );
            },
            [
                pushFloorHistory
            ]
        );

    //==================================================
    // FLUSH PENDING GLOBAL HISTORY
    //==================================================

    const flushPendingEditorHistory =
        useCallback(
            () => {

                if (
                    !pendingEditorSnapshot.current
                ) {
                    return;
                }

                const snapshot =
                    pendingEditorSnapshot.current;

                pendingEditorSnapshot.current =
                    null;

                editorGroupToken.current +=
                    1;

                pushEditorHistory(
                    snapshot
                );
            },
            [
                pushEditorHistory
            ]
        );

    //==================================================
    // SCHEDULE FLOOR GROUP COMMIT
    //==================================================

    const scheduleFloorGroupCommit =
        useCallback(() => {

            const token =
                floorGroupToken.current +
                1;

            floorGroupToken.current =
                token;

            queueMicrotask(() => {

                //--------------------------------------------------
                // SET_WALLS may have already committed the
                // group. In that case the token has changed.
                //--------------------------------------------------

                if (
                    floorGroupToken.current !==
                    token
                ) {
                    return;
                }

                flushPendingFloorHistory();
            });

        }, [
            flushPendingFloorHistory
        ]);

    //==================================================
    // SCHEDULE GLOBAL GROUP COMMIT
    //==================================================

    const scheduleEditorGroupCommit =
        useCallback(() => {

            const token =
                editorGroupToken.current +
                1;

            editorGroupToken.current =
                token;

            queueMicrotask(() => {

                if (
                    editorGroupToken.current !==
                    token
                ) {
                    return;
                }

                flushPendingEditorHistory();
            });

        }, [
            flushPendingEditorHistory
        ]);

    //==================================================
    // DISPATCH
    //==================================================

    const dispatch =
        useCallback(
            (
                action:
                    EditorAction
            ) => {

                const currentState =
                    stateRef.current;

                //--------------------------------------------------
                // Flush pending history when necessary.
                //--------------------------------------------------

                if (
                    isFloorPlanAction(action) &&
                    action.type !==
                        "SET_CORNERS" &&
                    action.type !==
                        "SET_WALLS"
                ) {

                    flushPendingFloorHistory();
                }

                if (
                    isGlobalEditorAction(action) &&
                    !isMaterialAction(action)
                ) {

                    flushPendingEditorHistory();
                }

                //--------------------------------------------------
                // Determine which history this action belongs to.
                //--------------------------------------------------

                const floorPlanAction =
                    isFloorPlanAction(
                        action
                    );

                const globalEditorAction =
                    isGlobalEditorAction(
                        action
                    );

                //--------------------------------------------------
                // Floor Plan history is only active BEFORE
                // Confirm Layout.
                //--------------------------------------------------

                const shouldRecordFloor =
                    floorPlanAction &&
                    !currentState.layoutConfirmed;

                //--------------------------------------------------
                // Global history is only active AFTER
                // Confirm Layout.
                //--------------------------------------------------

                const shouldRecordGlobal =
                    globalEditorAction &&
                    currentState.layoutConfirmed;

                //==================================================
                // FLOOR PLAN
                //==================================================

                if (
                    shouldRecordFloor
                ) {

                    //--------------------------------------------------
                    // SET_CORNERS begins a grouped wall operation.
                    //--------------------------------------------------

                    if (
                        action.type ===
                        "SET_CORNERS"
                    ) {

                        if (
                            !pendingFloorSnapshot.current
                        ) {

                            pendingFloorSnapshot.current =
                                createFloorPlanSnapshot(
                                    currentState
                                );
                        }

                        const nextState =
                            editorReducer(
                                currentState,
                                action
                            );

                        //--------------------------------------------------
                        // No actual change.
                        //--------------------------------------------------

                        if (
                            nextState ===
                            currentState
                        ) {
                            return;
                        }

                        stateRef.current =
                            nextState;

                        setState(
                            nextState
                        );

                        scheduleFloorGroupCommit();

                        return;
                    }

                    //--------------------------------------------------
                    // SET_WALLS completes the grouped wall operation.
                    //--------------------------------------------------

                    if (
                        action.type ===
                        "SET_WALLS"
                    ) {

                        //--------------------------------------------------
                        // If no SET_CORNERS came before it, this is
                        // still a valid standalone state change.
                        //--------------------------------------------------

                        if (
                            !pendingFloorSnapshot.current
                        ) {

                            pendingFloorSnapshot.current =
                                createFloorPlanSnapshot(
                                    currentState
                                );
                        }

                        const nextState =
                            editorReducer(
                                currentState,
                                action
                            );

                        if (
                            nextState ===
                            currentState
                        ) {
                            return;
                        }

                        stateRef.current =
                            nextState;

                        setState(
                            nextState
                        );

                        //--------------------------------------------------
                        // Finish ONE history entry for the complete
                        // wall/room operation.
                        //--------------------------------------------------

                        const snapshot =
                            pendingFloorSnapshot.current;

                        pendingFloorSnapshot.current =
                            null;

                        floorGroupToken.current +=
                            1;

                        if (
                            snapshot
                        ) {

                            pushFloorHistory(
                                snapshot
                            );
                        }

                        return;
                    }

                    //--------------------------------------------------
                    // Other floor-plan action.
                    //--------------------------------------------------

                    const snapshot =
                        createFloorPlanSnapshot(
                            currentState
                        );

                    const nextState =
                        editorReducer(
                            currentState,
                            action
                        );

                    if (
                        nextState ===
                        currentState
                    ) {
                        return;
                    }

                    stateRef.current =
                        nextState;

                    setState(
                        nextState
                    );

                    pushFloorHistory(
                        snapshot
                    );

                    return;
                }

                //==================================================
                // GLOBAL EDITOR
                //==================================================

                if (
                    shouldRecordGlobal
                ) {

                    //--------------------------------------------------
                    // Materials can be dispatched several times
                    // during one button click.
                    //--------------------------------------------------

                    if (
                        isMaterialAction(action)
                    ) {

                        if (
                            !pendingEditorSnapshot.current
                        ) {

                            pendingEditorSnapshot.current =
                                createEditorSnapshot(
                                    currentState
                                );
                        }

                        const nextState =
                            editorReducer(
                                currentState,
                                action
                            );

                        if (
                            nextState ===
                            currentState
                        ) {
                            return;
                        }

                        stateRef.current =
                            nextState;

                        setState(
                            nextState
                        );

                        scheduleEditorGroupCommit();

                        return;
                    }

                    //--------------------------------------------------
                    // Normal global action.
                    //--------------------------------------------------

                    const snapshot =
                        createEditorSnapshot(
                            currentState
                        );

                    const nextState =
                        editorReducer(
                            currentState,
                            action
                        );

                    if (
                        nextState ===
                        currentState
                    ) {
                        return;
                    }

                    stateRef.current =
                        nextState;

                    setState(
                        nextState
                    );

                    pushEditorHistory(
                        snapshot
                    );

                    return;
                }

                //==================================================
                // NON-HISTORY ACTION
                //==================================================

                const nextState =
                    editorReducer(
                        currentState,
                        action
                    );

                if (
                    nextState ===
                    currentState
                ) {
                    return;
                }

                stateRef.current =
                    nextState;

                setState(
                    nextState
                );
            },
            [
                flushPendingFloorHistory,
                flushPendingEditorHistory,
                pushFloorHistory,
                pushEditorHistory,
                scheduleFloorGroupCommit,
                scheduleEditorGroupCommit
            ]
        );

    //==================================================
    // UNDO
    //==================================================

    const undo =
        useCallback(() => {

            const currentState =
                stateRef.current;

            //--------------------------------------------------
            // Never modify anything while in walkthrough.
            //--------------------------------------------------

            if (
                currentState.walkthroughMode
            ) {
                return;
            }

            //--------------------------------------------------
            // BEFORE CONFIRM:
            // use Floor Plan history.
            //--------------------------------------------------

            if (
                !currentState.layoutConfirmed
            ) {

                flushPendingFloorHistory();

                if (
                    floorPast.current.length ===
                    0
                ) {
                    return;
                }

                const previousSnapshot =
                    floorPast.current.pop();

                if (
                    !previousSnapshot
                ) {
                    return;
                }

                //--------------------------------------------------
                // Current state becomes redo.
                //--------------------------------------------------

                floorFuture.current =
                    [
                        createFloorPlanSnapshot(
                            currentState
                        ),
                        ...floorFuture.current
                    ];

                //--------------------------------------------------
                // Restore complete floor-plan structure.
                //--------------------------------------------------

                const restored =
                    restoreFloorPlanSnapshot(
                        currentState,
                        previousSnapshot
                    );

                stateRef.current =
                    restored;

                setState(
                    restored
                );

                refreshHistoryUI();

                return;
            }

            //--------------------------------------------------
            // AFTER CONFIRM:
            // use Global Editor history.
            //--------------------------------------------------

            flushPendingEditorHistory();

            if (
                editorPast.current.length ===
                0
            ) {
                return;
            }

            const previousSnapshot =
                editorPast.current.pop();

            if (
                !previousSnapshot
            ) {
                return;
            }

            //--------------------------------------------------
            // Current editor state becomes redo.
            //--------------------------------------------------

            editorFuture.current =
                [
                    createEditorSnapshot(
                        currentState
                    ),
                    ...editorFuture.current
                ];

            //--------------------------------------------------
            // Restore furniture/assets/materials only.
            //--------------------------------------------------

            const restored =
                restoreEditorSnapshot(
                    currentState,
                    previousSnapshot
                );

            stateRef.current =
                restored;

            setState(
                restored
            );

            refreshHistoryUI();

        }, [
            flushPendingFloorHistory,
            flushPendingEditorHistory,
            refreshHistoryUI
        ]);

    //==================================================
    // REDO
    //==================================================

    const redo =
        useCallback(() => {

            const currentState =
                stateRef.current;

            //--------------------------------------------------
            // Never modify anything while in walkthrough.
            //--------------------------------------------------

            if (
                currentState.walkthroughMode
            ) {
                return;
            }

            //==================================================
            // BEFORE CONFIRM
            //==================================================

            if (
                !currentState.layoutConfirmed
            ) {

                flushPendingFloorHistory();

                if (
                    floorFuture.current.length ===
                    0
                ) {
                    return;
                }

                const nextSnapshot =
                    floorFuture.current.shift();

                if (
                    !nextSnapshot
                ) {
                    return;
                }

                //--------------------------------------------------
                // Current becomes undo.
                //--------------------------------------------------

                floorPast.current =
                    trimHistory([
                        ...floorPast.current,

                        createFloorPlanSnapshot(
                            currentState
                        )
                    ]);

                //--------------------------------------------------
                // Restore.
                //--------------------------------------------------

                const restored =
                    restoreFloorPlanSnapshot(
                        currentState,
                        nextSnapshot
                    );

                stateRef.current =
                    restored;

                setState(
                    restored
                );

                refreshHistoryUI();

                return;
            }

            //==================================================
            // AFTER CONFIRM
            //==================================================

            flushPendingEditorHistory();

            if (
                editorFuture.current.length ===
                0
            ) {
                return;
            }

            const nextSnapshot =
                editorFuture.current.shift();

            if (
                !nextSnapshot
            ) {
                return;
            }

            //--------------------------------------------------
            // Current becomes undo.
            //--------------------------------------------------

            editorPast.current =
                trimHistory([
                    ...editorPast.current,

                    createEditorSnapshot(
                        currentState
                    )
                ]);

            //--------------------------------------------------
            // Restore.
            //--------------------------------------------------

            const restored =
                restoreEditorSnapshot(
                    currentState,
                    nextSnapshot
                );

            stateRef.current =
                restored;

            setState(
                restored
            );

            refreshHistoryUI();

        }, [
            flushPendingFloorHistory,
            flushPendingEditorHistory,
            refreshHistoryUI
        ]);

    //==================================================
    // KEYBOARD UNDO / REDO
    //==================================================

    useEffect(() => {

        function handleKeyDown(
            event: KeyboardEvent
        ) {

            //--------------------------------------------------
            // Don't steal Ctrl+Z/Y from text fields.
            //--------------------------------------------------

            if (
                isTypingTarget(
                    event.target
                )
            ) {
                return;
            }

            if (
                !event.ctrlKey &&
                !event.metaKey
            ) {
                return;
            }

            //--------------------------------------------------
            // UNDO
            //--------------------------------------------------

            if (
                event.key.toLowerCase() ===
                "z" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                undo();

                return;
            }

            //--------------------------------------------------
            // REDO
            //
            // Ctrl+Y
            // Ctrl+Shift+Z
            //--------------------------------------------------

            if (
                event.key.toLowerCase() ===
                    "y" ||

                (
                    event.key.toLowerCase() ===
                        "z" &&
                    event.shiftKey
                )
            ) {

                event.preventDefault();

                redo();

                return;
            }
        }

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {

            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };

    }, [
        undo,
        redo
    ]);

    //==================================================
    // VALUES USED BY CONTEXT
    //==================================================

    void historyVersion;

    const canUndo =
        state.layoutConfirmed

            ? editorPast.current.length > 0

            : floorPast.current.length > 0;

    const canRedo =
        state.layoutConfirmed

            ? editorFuture.current.length > 0

            : floorFuture.current.length > 0;

    //==================================================
    // PROVIDER
    //==================================================

    return (

        <EditorContext.Provider

            value={{

                state,

                dispatch,

                undo,

                redo,

                canUndo,

                canRedo

            }}

        >

            {children}

        </EditorContext.Provider>
    );
}