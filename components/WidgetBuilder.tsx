"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useCopyText } from "@/components/useCopyText";
import {
  WIDGET_BRAND,
  WIDGET_IFRAME_TITLE,
  WIDGET_SIZES,
  WIDGET_THEMES,
  buildWidgetEmbedCode,
  getWidgetSize,
  widgetEmbedPath,
  type WidgetSize,
  type WidgetTheme,
} from "@/lib/widget";

/**
 * The interactive part of the widget page: pick a size and a theme, see the
 * real widget, copy the matching embed code. The server renders it in its
 * default state (sidebar, light), so the preview iframe and a complete embed
 * code are in the HTML before any script runs.
 *
 * The preview is the embed code's own markup - same wrapper width, same
 * iframe size, same credit line - so what is shown is what a host page gets.
 * Only its src is relative, so it also works on preview deployments.
 */
export function WidgetBuilder({ siteUrl }: { siteUrl: string }) {
  const [size, setSize] = useState<WidgetSize>("sidebar");
  const [theme, setTheme] = useState<WidgetTheme>("light");
  const codeRef = useRef<HTMLElement>(null);

  const config = getWidgetSize(size);
  const code = buildWidgetEmbedCode(siteUrl, size, theme);
  const { status, copy } = useCopyText(code, codeRef);

  return (
    <section
      aria-labelledby="builder-heading"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <h2 id="builder-heading" className="text-xl font-bold text-gray-900 dark:text-gray-50">
        เลือกขนาดและสี แล้วคัดลอกโค้ด
      </h2>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">ขนาด</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WIDGET_SIZES.map((option) => (
            <OptionButton
              key={option.id}
              name="widget-size"
              label={option.label}
              checked={size === option.id}
              onSelect={() => setSize(option.id)}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{config.hint}</p>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">สีพื้น</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WIDGET_THEMES.map((option) => (
            <OptionButton
              key={option.id}
              name="widget-theme"
              label={option.label}
              checked={theme === option.id}
              onSelect={() => setTheme(option.id)}
            />
          ))}
        </div>
      </fieldset>

      <h3 className="mt-5 text-sm font-medium text-gray-700 dark:text-gray-300">
        ตัวอย่างวิดเจ็ต (ราคาจริงล่าสุด)
      </h3>
      <div className="mt-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
        <div style={{ maxWidth: config.maxWidth }}>
          <iframe
            // A new document per variant: without the key React would keep the
            // old iframe and only swap its src, flashing the previous size.
            key={`${size}-${theme}`}
            src={widgetEmbedPath(size, theme)}
            title={WIDGET_IFRAME_TITLE}
            height={config.height}
            loading="lazy"
            scrolling="no"
            style={{
              display: "block",
              width: "100%",
              maxWidth: "100%",
              height: config.height,
              margin: 0,
              padding: 0,
              border: 0,
              borderRadius: 12,
              overflow: "hidden",
            }}
          />
          <p className="mt-1.5 text-center text-xs text-gray-600 dark:text-gray-400">
            ราคาทองจาก{" "}
            <Link href="/" className="underline">
              {WIDGET_BRAND}
            </Link>
          </p>
        </div>
      </div>

      <h3 className="mt-5 text-sm font-medium text-gray-700 dark:text-gray-300">
        โค้ดสำหรับวางบนเว็บไซต์ของคุณ
      </h3>
      <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50">
        <code ref={codeRef} className="select-all whitespace-pre-wrap break-all">
          {code}
        </code>
      </pre>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        >
          คัดลอกโค้ด
        </button>
        <p role="status" aria-live="polite" className="text-sm text-gray-600 dark:text-gray-400">
          {status === "copied" && "คัดลอกแล้ว นำไปวางในหน้าเว็บของคุณได้เลย"}
          {status === "failed" && "คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกโค้ดทั้งหมดแล้วคัดลอกเอง"}
        </p>
      </div>
    </section>
  );
}

/** A radio button drawn as a pill; the real <input> stays in the DOM for keyboards and screen readers. */
function OptionButton({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium focus-within:ring-2 focus-within:ring-amber-500 ${
        checked
          ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-gray-300 text-gray-700 hover:border-amber-500 dark:border-gray-700 dark:text-gray-300"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      {label}
    </label>
  );
}
