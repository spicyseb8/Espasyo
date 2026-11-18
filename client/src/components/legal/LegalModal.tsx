import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { LegalDocumentContent } from "./LegalDocumentContent";
import {
  LEGAL_DOCUMENTS,
  REQUIRED_DOCUMENTS,
  type LegalDocument,
} from "./LegalDocuments";

type LegalModalProps = {
  open: boolean;
  documents?: LegalDocument[];
  activeDocument: LegalDocument;
  onSwitchDocument: (document: LegalDocument) => void;
  onClose: () => void;

  termsRead: boolean;
  privacyRead: boolean;
  /** 0 to 1, how far the active document has been scrolled. */
  progress: number;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;

  agreed: boolean;
  onAgreedChange: (checked: boolean) => void;

  /** Label and handler for the main button. */
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  /** When false the agree checkbox is hidden (reading only). */
  showAgreement: boolean;
  error?: string;
};

/** One muted border colour used for every line in the dialog. */
const BORDER = "border-muted-foreground/25";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

/** Green check that pops in and draws itself when a document is finished. */
function ReadCheck() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span
      role="img"
      aria-label="Read"
      className={cn(
        "grid size-[18px] shrink-0 place-items-center rounded-full bg-emerald-500 transition-all duration-300 ease-out motion-reduce:transition-none",
        shown ? "scale-100 opacity-100" : "scale-50 opacity-0",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-3"
        fill="none"
        stroke="white"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={shown ? 0 : 1}
          className="transition-[stroke-dashoffset] delay-150 duration-300 ease-out motion-reduce:transition-none"
        />
      </svg>
    </span>
  );
}

export function LegalModal({
  open,
  documents = REQUIRED_DOCUMENTS,
  activeDocument,
  onSwitchDocument,
  onClose,
  termsRead,
  privacyRead,
  progress,
  scrollAreaRef,
  contentRef,
  agreed,
  onAgreedChange,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  showAgreement,
  error,
}: LegalModalProps) {
  const dialogRef = useRef<HTMLElement>(null);

  // Close on Escape and lock page scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  // Move focus into the dialog on open and restore it on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = window.document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  // Start each document at the top.
  useEffect(() => {
    if (open) scrollAreaRef.current?.scrollTo({ top: 0 });
  }, [open, activeDocument, scrollAreaRef]);

  if (!open) return null;

  const isRead = (doc: LegalDocument) =>
    doc === "terms" ? termsRead : doc === "privacy" ? privacyRead : false;
  const isRequired = (doc: LegalDocument) => REQUIRED_DOCUMENTS.includes(doc);

  const bothRead = termsRead && privacyRead;
  const unread = [
    !termsRead && LEGAL_DOCUMENTS.terms.navTitle,
    !privacyRead && LEGAL_DOCUMENTS.privacy.navTitle,
  ].filter(Boolean) as string[];

  const visibleDocuments = documents.filter(doc => doc in LEGAL_DOCUMENTS);
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const active = LEGAL_DOCUMENTS[activeDocument];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Legal documents"
        className={cn(
          "flex h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-2xl outline-none sm:h-[88vh] sm:rounded-2xl",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200",
          BORDER,
        )}
        onClick={event => event.stopPropagation()}
      >
        {/* Tabs */}
        <header
          className={cn(
            "relative flex items-center justify-center border-b px-4 py-3 sm:px-6",
            BORDER,
          )}
        >
          <div
            role="tablist"
            aria-label="Legal documents"
            className="flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visibleDocuments.map(doc => {
              const isActive = doc === activeDocument;
              return (
                <button
                  key={doc}
                  type="button"
                  role="tab"
                  id={`legal-tab-${doc}`}
                  aria-selected={isActive}
                  aria-controls="legal-panel"
                  onClick={() => onSwitchDocument(doc)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                    FOCUS_RING,
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {LEGAL_DOCUMENTS[doc].navTitle}
                  {isRequired(doc) && isRead(doc) && <ReadCheck />}
                </button>
              );
            })}
          </div>

          {/* Reading progress sits on the header's own bottom line */}
          <div
            className="absolute inset-x-0 -bottom-px h-0.5"
            role="progressbar"
            aria-label="Reading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full bg-muted-foreground/60 transition-[width] duration-150"
              style={{ width: `${percent}%` }}
            />
          </div>
        </header>

        {/* Document */}
        <div
          ref={scrollAreaRef}
          id="legal-panel"
          role="tabpanel"
          aria-labelledby={`legal-tab-${activeDocument}`}
          tabIndex={0}
          aria-label={`${active.navTitle} content`}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 sm:px-10 sm:py-10"
        >
          <div ref={contentRef} className="mx-auto max-w-[36rem]">
            <LegalDocumentContent document={activeDocument} />
          </div>
        </div>

        {/* Footer */}
        <footer className={cn("space-y-3 border-t px-5 py-4 sm:px-6", BORDER)}>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {showAgreement ? (
              <div className="min-w-0">
                <label
                  className={cn(
                    "flex items-start gap-3 text-sm leading-snug",
                    bothRead ? "cursor-pointer text-foreground" : "cursor-not-allowed text-muted-foreground",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={agreed}
                    disabled={!bothRead}
                    onChange={event => onAgreedChange(event.target.checked)}
                    className="mt-0.5 size-[18px] shrink-0 accent-primary"
                  />
                  <span>I have read and agree to the Terms of Service and Privacy Policy.</span>
                </label>
                {!bothRead && (
                  <p className="mt-1.5 pl-[30px] text-xs text-muted-foreground">
                    Read {unread.join(" and ")} to the end to unlock this.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {bothRead
                  ? "You have read both documents."
                  : `Still to read: ${unread.join(" and ")}.`}
              </p>
            )}

            <div className="flex shrink-0 gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
              <Button
                type="button"
                variant="outline"
                className="border-muted-foreground/30"
                onClick={onClose}
              >
                Close
              </Button>
              <Button type="button" disabled={primaryDisabled} onClick={onPrimary}>
                {primaryLabel}
              </Button>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default LegalModal;