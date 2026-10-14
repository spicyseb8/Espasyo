import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Lock, MapPin, MessageCircle } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";

import { emitAdminCommentMarkerClick } from "../../services/adminCommentEvents";
import {
    subscribeToAdminComments,
    type AdminComment
} from "../../services/adminCommentService";

interface AdminCommentsProps {
    projectId: string | null;
}

// ---------------------------------------------------------------------------
// Helpers (display only)
// ---------------------------------------------------------------------------
function toDate(value: unknown): Date | null {
    if (
        value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof (value as { toDate: () => Date }).toDate === "function"
    ) {
        return (value as { toDate: () => Date }).toDate();
    }

    if (value instanceof Date) return value;

    return null;
}

// Pending server timestamps are null for a moment — treat them as "now".
function dayKey(date: Date | null): string {
    return (date ?? new Date()).toDateString();
}

function dayLabel(date: Date | null): string {
    const target = date ?? new Date();
    const today = new Date();
    const startOf = (d: Date) =>
        new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    const diffDays = Math.round((startOf(today) - startOf(target)) / 86_400_000);

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";

    return target.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: target.getFullYear() === today.getFullYear() ? undefined : "numeric"
    });
}

function timeLabel(date: Date | null): string {
    if (!date) return "Just now";

    return date.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit"
    });
}

function initials(name: string | undefined): string {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "A";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const BUBBLE =
    "rounded-2xl rounded-tl-md bg-black/[0.05] px-3 py-2";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminComments({ projectId }: AdminCommentsProps) {
    const [open, setOpen] = useState(false);
    const [comments, setComments] = useState<AdminComment[]>([]);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!projectId) {
            setComments([]);
            return;
        }

        return subscribeToAdminComments(projectId, setComments, (error) => {
            console.error("Failed to load admin comments:", error);
        });
    }, [projectId]);

    // Chat behaviour: open at the newest message
    useEffect(() => {
        if (!open) return;

        const frame = requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({ block: "end" });
        });

        return () => cancelAnimationFrame(frame);
    }, [open, comments.length]);

    const handleFocus = (commentId: string) => {
        emitAdminCommentMarkerClick(commentId);
    };

    let lastDay = "";

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Toggle admin comments"
                        title="Admin comments"
                        className="relative h-[34px] w-[34px] rounded-full border-black/20 bg-transparent text-[#1b1b1b] shadow-none transition hover:border-[#1b1b1b] hover:bg-black/5 data-[popup-open]:border-[#1b1b1b] data-[popup-open]:bg-black/5"
                    />
                }
            >
                <MessageCircle className="h-[15px] w-[15px]" strokeWidth={1.75} />

                {comments.length > 0 && (
                    <span className="admin-comments-count absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none tabular-nums">
                        {comments.length}
                    </span>
                )}
            </PopoverTrigger>

            <PopoverContent
                align="end"
                sideOffset={10}
                className="z-[1100] w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-black/10 bg-white p-0 font-sans text-[#1b1b1b] shadow-[0_18px_48px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.05)]"
            >
                {/* Header */}
                <div className="flex items-center gap-2.5 border-b border-black/[0.07] px-4 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1b1b1b] text-white">
                        <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>

                    <div className="min-w-0">
                        <h3 className="text-[13px] font-semibold leading-tight">
                            Admin review
                        </h3>
                        <p className="text-[11px] leading-tight text-black/50">
                            {comments.length === 0
                                ? "No comments yet"
                                : `${comments.length} ${
                                      comments.length === 1 ? "comment" : "comments"
                                  }`}
                        </p>
                    </div>
                </div>

                {/* Thread */}
                <div className="max-h-[400px] min-h-[140px] overflow-y-auto px-3.5 py-3 [scrollbar-width:thin]">
                    {comments.length === 0 ? (
                        <div className="flex h-[140px] flex-col items-center justify-center gap-2 text-center">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] text-black/35">
                                <MessageCircle className="h-4 w-4" strokeWidth={1.5} />
                            </span>
                            <p className="max-w-[220px] text-[13px] leading-relaxed text-black/50">
                                Feedback from your admin will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {comments.map((comment) => {
                                const date = toDate(comment.createdAt);
                                const key = dayKey(date);
                                const showDay = key !== lastDay;
                                lastDay = key;

                                const specific = comment.targetType !== "project";

                                return (
                                    <Fragment key={comment.id}>
                                        {showDay && (
                                            <div className="flex justify-center">
                                                <span className="rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-black/45">
                                                    {dayLabel(date)}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-start gap-2">
                                            <Avatar className="mt-px h-6 w-6 shrink-0">
                                                <AvatarFallback className="bg-[#1b1b1b] text-[9px] font-medium text-white">
                                                    {initials(comment.adminName)}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0 max-w-[88%]">
                                                <div className="mb-0.5 flex items-baseline gap-1.5 px-0.5">
                                                    <span className="truncate text-[11px] font-semibold leading-tight">
                                                        {comment.adminName}
                                                    </span>
                                                    <span className="shrink-0 text-[10px] tabular-nums leading-tight text-black/40">
                                                        {timeLabel(date)}
                                                    </span>
                                                </div>

                                                {specific ? (
                                                    // Whole bubble is the button: text on top,
                                                    // small location below, arrow on the right.
                                                    <button
                                                        type="button"
                                                        onClick={() => handleFocus(comment.id)}
                                                        title="Focus on comment"
                                                        aria-label={`Focus on ${comment.targetLabel}`}
                                                        className={`group flex w-full items-center gap-3 text-left transition hover:bg-black/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b1b1b] ${BUBBLE}`}
                                                    >
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block whitespace-pre-wrap break-words text-[13px] leading-snug">
                                                                {comment.text}
                                                            </span>

                                                            <span className="mt-1 flex items-center gap-1 text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-black/45">
                                                                <MapPin
                                                                    className="h-2.5 w-2.5 shrink-0"
                                                                    strokeWidth={2}
                                                                />
                                                                <span className="truncate">
                                                                    {comment.targetLabel}
                                                                </span>
                                                            </span>
                                                        </span>

                                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-black/50 ring-1 ring-black/10 transition group-hover:bg-[#1b1b1b] group-hover:text-white group-hover:ring-[#1b1b1b]">
                                                            <ArrowUpRight
                                                                className="h-3 w-3"
                                                                strokeWidth={2}
                                                            />
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <div className={BUBBLE}>
                                                        <p className="whitespace-pre-wrap break-words text-[13px] leading-snug">
                                                            {comment.text}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Fragment>
                                );
                            })}

                            <div ref={bottomRef} />
                        </div>
                    )}
                </div>

                {/* Read-only footer (replaces the message input) */}
                <div className="flex items-center gap-2 border-t border-black/[0.07] bg-black/[0.02] px-4 py-2.5 text-[11px] text-black/45">
                    <Lock className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                    <span>Read-only · replies aren&apos;t available here</span>
                </div>
            </PopoverContent>
        </Popover>
    );
}