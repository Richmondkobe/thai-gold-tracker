"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export type CopyStatus = "idle" | "copied" | "failed";

/**
 * Copy-to-clipboard for a piece of text that is already on the page.
 * `fallbackRef` points at the element showing that text: older browsers and
 * some in-app browsers (LINE's among them) have no async clipboard, so the
 * fallback selects that element and uses the legacy copy command. The status
 * returns to "idle" after a few seconds.
 */
export function useCopyText(
  text: string,
  fallbackRef: RefObject<HTMLElement | null>,
): { status: CopyStatus; copy: () => Promise<void> } {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  async function copy() {
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const selection = window.getSelection();
      if (fallbackRef.current && selection) {
        selection.selectAllChildren(fallbackRef.current);
        try {
          copied = document.execCommand("copy");
        } catch {
          copied = false;
        }
      }
    }

    setStatus(copied ? "copied" : "failed");
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus("idle"), 4000);
  }

  return { status, copy };
}
