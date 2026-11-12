import { useCallback, useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

import {
    GUIDE_PAGES,
    GUIDE_SHORTCUTS,
    type GuidePage,
    type GuideSection,
} from "./guideContent";
import "./InstructionModal.css";

interface Props {
    autoOpen?: boolean;
    onAutoGuideSeen?: () => void;
}

function ImageSlot({ src, alt }: { src?: string; alt: string }) {
    return src ? <img className="guide-image" src={src} alt={alt} /> : null;
}

function ShortcutSection({ title }: { title: string }) {
    const categories = Object.entries(GUIDE_SHORTCUTS) as [
        keyof typeof GUIDE_SHORTCUTS,
        (typeof GUIDE_SHORTCUTS)[keyof typeof GUIDE_SHORTCUTS],
    ][];

    return (
        <details className="guide-collapsible">
            <summary>{title}</summary>
            <div className="guide-shortcuts">
                {categories.map(([category, shortcuts]) => (
                    <section key={category}>
                        <h4>{category}</h4>
                        {shortcuts.map(shortcut => (
                            <div className="guide-shortcut-row" key={shortcut.label}>
                                <span>{shortcut.label}</span>
                                <span className="guide-keys">
                                    {shortcut.keys.map((key, index) => (
                                        <kbd key={`${shortcut.label}-${key}-${index}`}>
                                            {key}
                                        </kbd>
                                    ))}
                                </span>
                            </div>
                        ))}
                    </section>
                ))}
            </div>
        </details>
    );
}

function renderSection(
    section: GuideSection,
    page: GuidePage,
    activeDesignTab: string,
    setActiveDesignTab: (tab: string) => void,
): React.ReactNode {
    switch (section.type) {
        case "text":
            return (
                <section className="guide-section" key={section.id}>
                    {section.title && <h3>{section.title}</h3>}
                    {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                    {section.bullets && (
                        <ul>
                            {section.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}
                        </ul>
                    )}
                    <ImageSlot src={section.imageSrc} alt={section.title ?? page.title} />
                </section>
            );
        case "steps":
            return (
                <section className="guide-section" key={section.id}>
                    {section.title && <h3>{section.title}</h3>}
                    <ol className="guide-steps">
                        {section.steps.map(step => <li key={step}>{step}</li>)}
                    </ol>
                    <ImageSlot src={section.imageSrc} alt={section.title ?? page.title} />
                </section>
            );
        case "table":
            return (
                <section className="guide-section" key={section.id}>
                    {section.title && <h3>{section.title}</h3>}
                    <div className="guide-table-wrap">
                        <table className="guide-table">
                            <tbody>
                                {section.rows.map(row => (
                                    <tr key={row.label}>
                                        <th scope="row">{row.label}</th>
                                        <td>{row.description}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <ImageSlot src={section.imageSrc} alt={section.title ?? page.title} />
                </section>
            );
        case "shortcuts":
            return (
                <section className="guide-section" key={section.id}>
                    <ShortcutSection title={section.title} />
                    <ImageSlot src={section.imageSrc} alt={section.title} />
                </section>
            );
        case "tabs": {
            const activeTab = section.tabs.find(tab => tab.id === activeDesignTab) ?? section.tabs[0];
            if (!activeTab) return null;

            return (
                <section className="guide-section" key={section.id}>
                    <div className="guide-tabs" role="tablist" aria-label="Design tools">
                        {section.tabs.map(tab => (
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab.id === tab.id}
                                aria-controls={`guide-tab-panel-${tab.id}`}
                                id={`guide-tab-${tab.id}`}
                                className={activeTab.id === tab.id ? "active" : ""}
                                key={tab.id}
                                onClick={() => setActiveDesignTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div
                        role="tabpanel"
                        id={`guide-tab-panel-${activeTab.id}`}
                        aria-labelledby={`guide-tab-${activeTab.id}`}
                        className="guide-tab-panel"
                    >
                        {activeTab.sections.map(child =>
                            renderSection(child, page, activeDesignTab, setActiveDesignTab)
                        )}
                        {activeTab.advanced && (
                            <details className="guide-collapsible">
                                <summary>{activeTab.advanced.title}</summary>
                                {activeTab.advanced.paragraphs.map(paragraph => (
                                    <p key={paragraph}>{paragraph}</p>
                                ))}
                            </details>
                        )}
                    </div>
                    <ImageSlot src={section.imageSrc} alt={page.title} />
                </section>
            );
        }
    }
}

export default function InstructionModal({ autoOpen = false, onAutoGuideSeen }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [pageIndex, setPageIndex] = useState(0);
    const [activeDesignTab, setActiveDesignTab] = useState("furniture");
    const [autoOpenedThisTime, setAutoOpenedThisTime] = useState(false);
    const autoOpenHandled = useRef(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const pageHeadingRef = useRef<HTMLHeadingElement>(null);
    const activePage = GUIDE_PAGES[pageIndex];
    const lastPage = pageIndex === GUIDE_PAGES.length - 1;

    const openManually = () => {
        autoOpenHandled.current = true;
        setAutoOpenedThisTime(false);
        setPageIndex(0);
        setIsOpen(true);
    };

    useEffect(() => {
        if (!autoOpen || autoOpenHandled.current || isOpen) return;
        autoOpenHandled.current = true;
        setAutoOpenedThisTime(true);
        setPageIndex(0);
        setIsOpen(true);
    }, [autoOpen, isOpen]);

    const close = useCallback(() => {
        setIsOpen(false);
        if (autoOpenedThisTime) onAutoGuideSeen?.();
        setAutoOpenedThisTime(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
    }, [autoOpenedThisTime, onAutoGuideSeen]);

    const goToPage = useCallback((index: number) => {
        const nextIndex = Math.max(0, Math.min(index, GUIDE_PAGES.length - 1));
        setPageIndex(nextIndex);
        window.requestAnimationFrame(() => pageHeadingRef.current?.focus());
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const getFocusableElements = () => {
            if (!dialogRef.current) return [];
            return Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ),
            ).filter(element => element.getAttribute("aria-hidden") !== "true");
        };

        const focusInitial = window.requestAnimationFrame(() => {
            pageHeadingRef.current?.focus();
        });

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                close();
                return;
            }

            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                goToPage(pageIndex + (event.key === "ArrowRight" ? 1 : -1));
                return;
            }

            if (event.key === "Tab") {
                const focusable = getFocusableElements();
                if (!focusable.length) {
                    event.preventDefault();
                    return;
                }
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
                return;
            }

            const key = event.key.toLowerCase();
            const editorShortcut =
                ["w", "a", "s", "d", "r", "delete", "backspace", " "].includes(key) ||
                ((event.ctrlKey || event.metaKey) && ["a", "c", "d", "p", "s", "v", "x", "y", "z"].includes(key));
            if (editorShortcut) {
                const focusedButton = dialogRef.current?.contains(document.activeElement) &&
                    (document.activeElement as HTMLElement).tagName === "BUTTON";
                if (!(key === " " && focusedButton)) event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
        };

        const handlePointer = (event: Event) => {
            if (event.target === overlayRef.current || dialogRef.current?.contains(event.target as Node)) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        };

        window.addEventListener("keydown", handleKeyDown, true);
        window.addEventListener("pointerdown", handlePointer, true);
        window.addEventListener("click", handlePointer, true);
        return () => {
            window.cancelAnimationFrame(focusInitial);
            window.removeEventListener("keydown", handleKeyDown, true);
            window.removeEventListener("pointerdown", handlePointer, true);
            window.removeEventListener("click", handlePointer, true);
        };
    }, [close, goToPage, isOpen, pageIndex]);

    return (
        <>
            <button
                type="button"
                className="instruction-button"
                onClick={openManually}
                aria-label="Open instructions"
                ref={triggerRef}
            >
                <Info size={20} aria-hidden="true" />
            </button>

            {isOpen && activePage && (
                <div
                    className="instruction-modal-overlay"
                    ref={overlayRef}
                    onClick={event => {
                        if (event.target === event.currentTarget) close();
                    }}
                >
                    <div
                        className="instruction-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="instruction-page-title"
                        ref={dialogRef}
                        onClick={event => event.stopPropagation()}
                    >
                        <header className="instruction-modal-header">
                            <div>
                                <p className="instruction-page-count">
                                    Page {pageIndex + 1} of {GUIDE_PAGES.length}
                                </p>
                                <h2
                                    className="instruction-title"
                                    id="instruction-page-title"
                                    tabIndex={-1}
                                    ref={pageHeadingRef}
                                >
                                    {activePage.title}
                                </h2>
                            </div>
                        </header>

                        <div
                            className="instruction-page-dots"
                            aria-label={`Page ${pageIndex + 1} of ${GUIDE_PAGES.length}`}
                        >
                            {GUIDE_PAGES.map((page, index) => (
                                <button
                                    type="button"
                                    key={page.id}
                                    className={index === pageIndex ? "active" : ""}
                                    aria-label={`Go to page ${index + 1}: ${page.title}`}
                                    aria-current={index === pageIndex ? "step" : undefined}
                                    onClick={() => goToPage(index)}
                                />
                            ))}
                        </div>

                        <main className="instruction-modal-content" key={activePage.id}>
                            {activePage.sections.map(section =>
                                renderSection(section, activePage, activeDesignTab, setActiveDesignTab)
                            )}
                        </main>

                        <footer className="instruction-modal-footer">
                            <button
                                type="button"
                                className="guide-secondary-button"
                                onClick={close}
                            >
                                Skip / Close
                            </button>
                            <div className="guide-page-actions">
                                <button
                                    type="button"
                                    className="guide-secondary-button"
                                    onClick={() => goToPage(pageIndex - 1)}
                                    disabled={pageIndex === 0}
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    className="guide-primary-button"
                                    onClick={lastPage ? close : () => goToPage(pageIndex + 1)}
                                >
                                    {lastPage ? "Start designing" : "Next"}
                                </button>
                            </div>
                        </footer>
                    </div>
                </div>
            )}
        </>
    );
}
