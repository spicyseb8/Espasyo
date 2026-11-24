import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Info } from "lucide-react";

import {
    GUIDE_PAGES,
    GUIDE_SHORTCUTS,
    type GuidePage,
    type GuideSection,
} from "./guideContent";

interface Props {
    autoOpen?: boolean;
    onAutoGuideSeen?: () => void;
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

const FOCUS_RING =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Plain-button styles (no shadcn Button needed).
const BTN_BASE =
    `inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${FOCUS_RING}`;
const BTN_SM = `${BTN_BASE} h-8 px-3`;
const BTN_OUTLINE = `${BTN_SM} border border-border bg-background hover:bg-muted`;
const BTN_GHOST = `${BTN_SM} text-muted-foreground hover:bg-muted hover:text-foreground`;
const BTN_PRIMARY = `${BTN_SM} bg-primary text-primary-foreground hover:bg-primary/90`;

function ImageSlot({ src, alt }: { src?: string; alt: string }) {
    return src ? (
        <img
            className="mt-3 max-h-48 w-full rounded-lg border border-border/60 bg-muted/40 object-contain"
            src={src}
            alt={alt}
        />
    ) : null;
}

function ShortcutSection({ title }: { title: string }) {
    const categories = Object.entries(GUIDE_SHORTCUTS) as [
        keyof typeof GUIDE_SHORTCUTS,
        (typeof GUIDE_SHORTCUTS)[keyof typeof GUIDE_SHORTCUTS],
    ][];

    return (
        <details className="group rounded-lg border border-border/60 px-3">
            <summary
                className={`cursor-pointer select-none rounded-md py-2.5 text-sm font-medium ${FOCUS_RING}`}
            >
                {title}
            </summary>
            <div className="space-y-4 border-t border-border/60 py-3">
                {categories.map(([category, shortcuts]) => (
                    <section key={category}>
                        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {category}
                        </h4>
                        {shortcuts.map(shortcut => (
                            <div
                                className="flex items-center justify-between gap-3 py-1 text-sm"
                                key={shortcut.label}
                            >
                                <span>{shortcut.label}</span>
                                <span className="inline-flex gap-1">
                                    {shortcut.keys.map((key, index) => (
                                        <kbd
                                            key={`${shortcut.label}-${key}-${index}`}
                                            className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground"
                                        >
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

function SectionTitle({ children }: { children: ReactNode }) {
    return <h3 className="mb-2 text-sm font-semibold">{children}</h3>;
}

function renderSection(
    section: GuideSection,
    page: GuidePage,
    activeDesignTab: string,
    setActiveDesignTab: (tab: string) => void,
): ReactNode {
    switch (section.type) {
        case "text":
            return (
                <section key={section.id}>
                    {section.title && <SectionTitle>{section.title}</SectionTitle>}
                    <div className="space-y-2">
                        {section.paragraphs.map(paragraph => (
                            <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">
                                {paragraph}
                            </p>
                        ))}
                    </div>
                    {section.bullets && (
                        <ul className="mt-3 space-y-1.5">
                            {section.bullets.map(bullet => (
                                <li
                                    key={bullet}
                                    className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                                    />
                                    <span>{bullet}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <ImageSlot src={section.imageSrc} alt={section.title ?? page.title} />
                </section>
            );
        case "steps":
            return (
                <section key={section.id}>
                    {section.title && <SectionTitle>{section.title}</SectionTitle>}
                    <ol className="space-y-1.5">
                        {section.steps.map((step, index) => (
                            <li
                                key={step}
                                className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground"
                                >
                                    {index + 1}
                                </span>
                                <span className="leading-relaxed">{step}</span>
                            </li>
                        ))}
                    </ol>
                    <ImageSlot src={section.imageSrc} alt={section.title ?? page.title} />
                </section>
            );
        case "table":
            return (
                <section key={section.id}>
                    {section.title && <SectionTitle>{section.title}</SectionTitle>}
                    <div className="overflow-hidden rounded-lg border border-border/60">
                        <table className="w-full text-sm">
                            <tbody>
                                {section.rows.map(row => (
                                    <tr key={row.label} className="border-b border-border/60 last:border-0">
                                        <th
                                            scope="row"
                                            className="w-[34%] px-3 py-2 text-left align-top font-medium"
                                        >
                                            {row.label}
                                        </th>
                                        <td className="px-3 py-2 align-top text-muted-foreground">
                                            {row.description}
                                        </td>
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
                <section key={section.id}>
                    <ShortcutSection title={section.title} />
                    <ImageSlot src={section.imageSrc} alt={section.title} />
                </section>
            );
        case "tabs": {
            const activeTab = section.tabs.find(tab => tab.id === activeDesignTab) ?? section.tabs[0];
            if (!activeTab) return null;

            return (
                <section key={section.id}>
                    <div
                        className="mb-3 flex items-center gap-1 border-b border-border"
                        role="tablist"
                        aria-label="Design tools"
                    >
                        {section.tabs.map(tab => {
                            const selected = activeTab.id === tab.id;
                            return (
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={selected}
                                    aria-controls={`guide-tab-panel-${tab.id}`}
                                    id={`guide-tab-${tab.id}`}
                                    key={tab.id}
                                    onClick={() => setActiveDesignTab(tab.id)}
                                    className={`border-b-2 px-3 py-2 text-sm transition-colors ${FOCUS_RING} ${
                                        selected
                                            ? "border-primary font-medium text-foreground"
                                            : "border-transparent text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                    <div
                        role="tabpanel"
                        id={`guide-tab-panel-${activeTab.id}`}
                        aria-labelledby={`guide-tab-${activeTab.id}`}
                        className="space-y-4"
                    >
                        {activeTab.sections.map(child =>
                            renderSection(child, page, activeDesignTab, setActiveDesignTab)
                        )}
                        {activeTab.advanced && (
                            <details className="rounded-lg border border-border/60 px-3">
                                <summary
                                    className={`cursor-pointer select-none rounded-md py-2.5 text-sm font-medium ${FOCUS_RING}`}
                                >
                                    {activeTab.advanced.title}
                                </summary>
                                <div className="space-y-2 border-t border-border/60 py-3">
                                    {activeTab.advanced.paragraphs.map(paragraph => (
                                        <p
                                            key={paragraph}
                                            className="text-sm leading-relaxed text-muted-foreground"
                                        >
                                            {paragraph}
                                        </p>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                    <ImageSlot src={section.imageSrc} alt={page.title} />
                </section>
            );
        }
    }
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

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
                    'button:not([disabled]), [href], input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
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
                className={`${BTN_BASE} instruction-trigger-button h-10 w-10 rounded-full border border-border bg-background hover:bg-muted`}
                onClick={openManually}
                aria-label="Open instructions"
                ref={triggerRef}
            >
                <Info size={18} aria-hidden="true" />
            </button>

            {isOpen && activePage && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
                    ref={overlayRef}
                    onClick={event => {
                        if (event.target === event.currentTarget) close();
                    }}
                >
                    <div
                        className="flex h-[min(560px,92vh)] w-[min(560px,100%)] flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="instruction-page-title"
                        ref={dialogRef}
                        onClick={event => event.stopPropagation()}
                    >
                        <header className="shrink-0 space-y-2 px-5 pb-1 pt-4">
                            <span className="inline-flex h-5 items-center rounded border border-border px-1.5 text-[11px] font-normal text-muted-foreground">
                                Page {pageIndex + 1} of {GUIDE_PAGES.length}
                            </span>
                            <h2
                                className="text-xl font-semibold tracking-tight outline-none"
                                id="instruction-page-title"
                                tabIndex={-1}
                                ref={pageHeadingRef}
                            >
                                {activePage.title}
                            </h2>
                        </header>

                        <div
                            className="flex shrink-0 items-center gap-1 px-5 pt-2"
                            aria-label={`Page ${pageIndex + 1} of ${GUIDE_PAGES.length}`}
                        >
                            {GUIDE_PAGES.map((page, index) => (
                                <button
                                    type="button"
                                    key={page.id}
                                    className={`group flex-1 rounded-full py-1.5 ${FOCUS_RING}`}
                                    aria-label={`Go to page ${index + 1}: ${page.title}`}
                                    aria-current={index === pageIndex ? "step" : undefined}
                                    onClick={() => goToPage(index)}
                                >
                                    <span
                                        className={`block h-1 rounded-full transition-colors ${
                                            index <= pageIndex
                                                ? "bg-primary"
                                                : "bg-muted group-hover:bg-border"
                                        }`}
                                    />
                                </button>
                            ))}
                        </div>

                        <main
                            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4"
                            key={activePage.id}
                        >
                            {activePage.sections.map(section =>
                                renderSection(section, activePage, activeDesignTab, setActiveDesignTab)
                            )}
                        </main>

                        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-3">
                            <button type="button" className={BTN_GHOST} onClick={close}>
                                Skip / Close
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className={BTN_OUTLINE}
                                    onClick={() => goToPage(pageIndex - 1)}
                                    disabled={pageIndex === 0}
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    className={BTN_PRIMARY}
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