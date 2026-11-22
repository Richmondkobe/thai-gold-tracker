// The free embeddable gold price widget: its sizes, themes, URLs and the embed
// code other sites paste in. Pure (no server or browser APIs), because it is
// used by the widget page (server), the builder on that page (client) and the
// iframe document itself (app/embed/gold-price/[variant]/route.ts).
//
// The embed code is deliberately boring HTML - one wrapper <div>, one <iframe>
// and one credit line with a plain link - with inline styles only and no
// <script>. That is what makes it survive WordPress's Custom HTML block,
// Blogger's HTML/JavaScript gadget and strict content security policies, and
// what guarantees it cannot break a host page: the wrapper has a max-width,
// the iframe fills it (so it can only ever be narrower, never wider, than the
// column it is in) and its height is fixed.

/** Decoded public path of the widget page; served from app/gold-widget via the rewrite in next.config.ts. encodeURI() for URLs. */
export const WIDGET_PAGE_PATH = "/วิดเจ็ตราคาทอง";

/** Date the widget page's text was last edited - the sitemap's lastmod. Bump by hand. */
export const WIDGET_PAGE_UPDATED_AT = "2026-11-23";

/** The brand name used in the credit link. Keep the anchor branded; never turn it into a keyword. */
export const WIDGET_BRAND = "ThaiGoldTracker";

export type WidgetSize = "sidebar" | "banner" | "mobile";
export type WidgetTheme = "light" | "dark";

export interface WidgetSizeConfig {
  id: WidgetSize;
  /** Thai label on the widget page. */
  label: string;
  /** Thai one-line description of where it fits. */
  hint: string;
  /** Widest the widget is ever drawn, in px. It always shrinks to fit a narrower column. */
  maxWidth: number;
  /** Fixed height in px. */
  height: number;
  /** The iframe's `width` attribute (the inline style is what actually sizes it). */
  widthAttribute: string;
}

// Heights are tied to the layouts in the iframe document: the card layout
// (sidebar, mobile) needs 300px, and the banner's narrow fallback is designed
// to show everything in 130px. Change them together with that file's CSS and
// re-check each size at its narrowest width.
export const WIDGET_SIZES: WidgetSizeConfig[] = [
  {
    id: "sidebar",
    label: "แถบข้าง",
    hint: "300 × 300 พิกเซล เหมาะกับแถบข้างของเว็บไซต์หรือบล็อก",
    maxWidth: 300,
    height: 300,
    widthAttribute: "300",
  },
  {
    id: "banner",
    label: "แบนเนอร์แนวนอน",
    hint: "728 × 130 พิกเซล เหมาะกับส่วนบนหรือท้ายบทความ ย่อตามความกว้างของหน้าได้",
    maxWidth: 728,
    height: 130,
    widthAttribute: "728",
  },
  {
    id: "mobile",
    label: "มือถือ",
    hint: "กว้างเต็มคอลัมน์ (สูงสุด 480 พิกเซล) สูง 300 พิกเซล เหมาะกับหน้าเว็บบนมือถือ",
    maxWidth: 480,
    height: 300,
    widthAttribute: "100%",
  },
];

export const WIDGET_THEMES: { id: WidgetTheme; label: string }[] = [
  { id: "light", label: "สว่าง" },
  { id: "dark", label: "มืด" },
];

export function getWidgetSize(size: WidgetSize): WidgetSizeConfig {
  return WIDGET_SIZES.find((s) => s.id === size) ?? WIDGET_SIZES[0];
}

/** Path of the iframe document for one size and theme, e.g. "/embed/gold-price/sidebar-light". */
export function widgetEmbedPath(size: WidgetSize, theme: WidgetTheme): string {
  return `/embed/gold-price/${size}-${theme}`;
}

/** Parses the [variant] segment ("sidebar-light"); null for anything else. */
export function parseWidgetVariant(
  variant: string,
): { size: WidgetSize; theme: WidgetTheme } | null {
  const match = /^(sidebar|banner|mobile)-(light|dark)$/.exec(variant);
  return match ? { size: match[1] as WidgetSize, theme: match[2] as WidgetTheme } : null;
}

/** Inline style of the wrapper <div> in the embed code. */
export function widgetWrapperStyle(size: WidgetSize): string {
  return `max-width:${getWidgetSize(size).maxWidth}px`;
}

/**
 * Inline style of the <iframe> in the embed code. It sets every box property
 * a theme's global `iframe { ... }` rule is likely to touch (margin, padding,
 * border, max-width, height): inline styles win over a theme's stylesheet, so
 * the widget keeps its size and stays inside its column whatever the theme
 * does. Found by testing against exactly such a rule.
 */
export function widgetIframeStyle(size: WidgetSize): string {
  return `display:block;width:100%;max-width:100%;height:${getWidgetSize(size).height}px;margin:0;padding:0;border:0;border-radius:12px;overflow:hidden`;
}

/** Inline style of the credit line under the iframe (resets the indent and padding themes give paragraphs). */
export const WIDGET_CREDIT_STYLE =
  "margin:6px 0 0;padding:0;font-size:12px;line-height:1.4;text-align:center;text-indent:0";

/** Title attribute of the iframe (read by screen readers). */
export const WIDGET_IFRAME_TITLE = "ราคาทองวันนี้";

/**
 * The HTML a site owner pastes into their page. `siteUrl` is our own origin
 * with no trailing slash (SITE_URL).
 *
 * The credit line sits OUTSIDE the iframe, in the host page, as an ordinary
 * visible link whose anchor text is the brand name only.
 */
export function buildWidgetEmbedCode(siteUrl: string, size: WidgetSize, theme: WidgetTheme): string {
  const config = getWidgetSize(size);
  return [
    `<div style="${widgetWrapperStyle(size)}">`,
    `<iframe src="${siteUrl}${widgetEmbedPath(size, theme)}" title="${WIDGET_IFRAME_TITLE}" width="${config.widthAttribute}" height="${config.height}" loading="lazy" scrolling="no" frameborder="0" style="${widgetIframeStyle(size)}"></iframe>`,
    `<p style="${WIDGET_CREDIT_STYLE}">ราคาทองจาก <a href="${siteUrl}/" target="_blank" rel="noopener">${WIDGET_BRAND}</a></p>`,
    `</div>`,
  ].join("\n");
}
