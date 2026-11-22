"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The "share this" box on a daily report: a short ready-made summary and a
 * copy button. The text itself is built on the server (buildReportShareText)
 * and is in the server-rendered HTML; this client component only adds the
 * copy-to-clipboard behaviour on top of it. The text sits in a plain element
 * (not a textarea) so all of it is visible at any screen width.
 */
export function ShareSummaryBox({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const textRef = useRef<HTMLParagraphElement>(null);
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
      // Older browsers and some in-app browsers (LINE's among them) have no
      // async clipboard: select the text and use the legacy command instead.
      const selection = window.getSelection();
      if (textRef.current && selection) {
        selection.selectAllChildren(textRef.current);
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

  return (
    <section
      aria-labelledby="share-heading"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <h2 id="share-heading" className="text-xl font-bold text-gray-900 dark:text-gray-50">
        แชร์สรุปราคาทอง
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        ข้อความสรุปสั้น ๆ พร้อมลิงก์รายงาน คัดลอกไปวางใน LINE หรือบทความของคุณได้เลย
      </p>
      <p
        ref={textRef}
        className="mt-3 select-all whitespace-pre-line break-words rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
      >
        {text}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        >
          คัดลอกข้อความ
        </button>
        <p role="status" aria-live="polite" className="text-sm text-gray-600 dark:text-gray-400">
          {status === "copied" && "คัดลอกแล้ว นำไปวางได้เลย"}
          {status === "failed" && "คัดลอกอัตโนมัติไม่ได้ กรุณากดค้างที่ข้อความแล้วเลือกคัดลอก"}
        </p>
      </div>
    </section>
  );
}
