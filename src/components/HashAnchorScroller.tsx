"use client";

import { useEffect } from "react";

function currentHashId(): string {
  const hash = window.location.hash.slice(1);
  if (!hash) return "";

  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

export function HashAnchorScroller() {
  useEffect(() => {
    let frame = 0;

    const scrollToHash = () => {
      const id = currentHashId();
      if (!id) return;
      frame = window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView();
      });
    };

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, []);

  return null;
}
