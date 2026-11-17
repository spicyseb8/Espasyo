import { useEffect, type RefObject } from "react";
import { Check, X } from "lucide-react";

import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  LegalDocumentContent,
  type LegalDocument,
} from "@/components/legal/LegalDocumentContent";

const TITLES: Record<LegalDocument, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
};

type LegalModalProps = {
  open: boolean;
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

export function LegalModal({
  open,
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
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const bothRead = termsRead && privacyRead;
  const unread = [
    !termsRead && TITLES.terms,
    !privacyRead && TITLES.privacy,
  ].filter(Boolean) as string[];
  const read: Record<LegalDocument, boolean> = {
    terms: termsRead,
    privacy: privacyRead,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        className="flex h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:h-[85vh] sm:rounded-xl"
        onClick={event => event.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 id="legal-modal-title" className="text-lg font-semibold tracking-tight">
              {TITLES[activeDocument]}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Please read both documents to the end before you continue.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-1 shrink-0"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </header>

        {/* Document switcher */}
        <div className="mt-4 px-6" role="tablist" aria-label="Legal documents">
          <div className="inline-flex rounded-lg bg-muted p-1">
            {(Object.keys(TITLES) as LegalDocument[]).map(doc => {
              const active = doc === activeDocument;
              return (
                <button
                  key={doc}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSwitchDocument(doc)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {TITLES[doc]}
                  <span
                    className={cn(
                      "grid size-4 place-items-center rounded-full border",
                      read[doc]
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {read[doc] && <Check className="size-3" aria-label="Read" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reading progress */}
        <div
          className="mt-4 h-0.5 w-full bg-border"
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full bg-primary transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        {/* Document body */}
        <div
          ref={scrollAreaRef}
          tabIndex={0}
          aria-label={`${TITLES[activeDocument]} content`}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-8 focus-visible:outline-none sm:px-10"
        >
          <div
            ref={contentRef}
            className="mx-auto max-w-[68ch] text-[15px] leading-7 text-foreground/85"
          >
            <LegalDocumentContent document={activeDocument} />
          </div>
        </div>

        {/* Footer */}
        <footer className="space-y-3 border-t bg-muted/40 px-6 py-4">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {showAgreement ? (
              <label
                className={cn(
                  "flex items-start gap-3 text-sm leading-snug",
                  bothRead ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground",
                )}
              >
                <input
                  type="checkbox"
                  checked={agreed}
                  disabled={!bothRead}
                  onChange={event => onAgreedChange(event.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  {bothRead
                    ? "I have read and agree to the Terms of Service and Privacy Policy."
                    : `Still to read: ${unread.join(" and ")}.`}
                </span>
              </label>
            ) : (
              <p className="text-sm text-muted-foreground">
                {bothRead ? "You have read both documents." : `Still to read: ${unread.join(" and ")}.`}
              </p>
            )}
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
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