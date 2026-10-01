"use client";

import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

interface ArticleLinkFeedbackProps {
  className?: string;
  compact?: boolean;
  idleLabel?: string;
  iconSize?: number;
}

export function ArticleLinkFeedback({
  className,
  compact = false,
  idleLabel,
  iconSize = 18,
}: ArticleLinkFeedbackProps) {
  const { pending } = useLinkStatus();

  if (pending) {
    return (
      <span
        aria-live="polite"
        className={cn(
          "inline-flex min-h-6 items-center gap-2 whitespace-nowrap font-sans text-xs font-medium text-primary",
          compact &&
            "col-start-1 row-start-1 justify-self-end md:col-auto md:row-auto",
          className,
        )}
        role="status"
      >
        <LoaderCircle
          aria-hidden="true"
          className="shrink-0 motion-safe:animate-spin"
          size={iconSize}
        />
        <span className={compact ? "md:sr-only" : undefined}>
          正在打开文章…
        </span>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center gap-2",
        compact && "hidden md:inline-flex",
        className,
      )}
    >
      {idleLabel ? <span>{idleLabel}</span> : null}
      <ArrowUpRight
        className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        size={iconSize}
      />
    </span>
  );
}
