"use client";

import type { ReactNode } from "react";

export function SpotlightSurfaces({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div className={className} onPointerMove={(event) => {
      if (event.pointerType !== "mouse") return;
      const card = (event.target as Element).closest<HTMLElement>(".spotlight-card");
      if (!card) return;
      const bounds = card.getBoundingClientRect();
      card.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
      card.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
    }}>
      {children}
    </div>
  );
}
