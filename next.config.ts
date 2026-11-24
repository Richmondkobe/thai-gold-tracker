import type { NextConfig } from "next";

// Thai month names for the daily report short links below. Duplicated from
// lib/thai-date.ts on purpose: this file is loaded by Next before the app's
// path aliases exist.
const THAI_MONTH_NAMES = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const nextConfig: NextConfig = {
  // Public URLs for the per-weight and explainer pages are Thai
  // (/ราคาทอง/1-สลึง, /ความรู้/ทอง-1-บาท-กี่กรัม) for SEO, but this Next version
  // does not route non-ASCII app-directory folder names, so the routes live at
  // ASCII folders (app/gold-weight, app/gold-guide) and the Thai paths are
  // rewritten onto them. The rewrite sources must be percent-encoded — the
  // matcher sees the encoded request path, not the decoded one. The redirects
  // keep the ASCII paths from existing as duplicate public URLs.
  async rewrites() {
    return [
      {
        source: `/${encodeURIComponent("ราคาทอง")}/:weightSlug`,
        destination: "/gold-weight/:weightSlug",
      },
      {
        source: `/${encodeURIComponent("ความรู้")}/:guideSlug`,
        destination: "/gold-guide/:guideSlug",
      },
      {
        source: `/${encodeURIComponent("ราคาทองปี")}/:year`,
        destination: "/gold-price-year/:year",
      },
      {
        source: `/${encodeURIComponent("ราคาทองเดือน")}/:monthSlug`,
        destination: "/gold-price-month/:monthSlug",
      },
      {
        // Daily report pages, /รายงานราคาทอง/23-พฤศจิกายน-2569 (lib/report-pages.ts).
        source: `/${encodeURIComponent("รายงานราคาทอง")}/:reportSlug`,
        destination: "/gold-report/:reportSlug",
      },
      {
        source: `/${encodeURIComponent("คำนวณกำไรขาดทุนทอง")}`,
        destination: "/gold-profit",
      },
      {
        // The embeddable widget's page (lib/widget.ts). The widget itself is
        // served from /embed/gold-price/... and needs no rewrite.
        source: `/${encodeURIComponent("วิดเจ็ตราคาทอง")}`,
        destination: "/gold-widget",
      },
      {
        source: `/${encodeURIComponent("เกี่ยวกับเรา")}`,
        destination: "/site-info/about",
      },
      {
        source: `/${encodeURIComponent("แหล่งข้อมูล")}`,
        destination: "/site-info/data-source",
      },
      {
        source: `/${encodeURIComponent("ติดต่อเรา")}`,
        destination: "/site-info/contact",
      },
      {
        source: `/${encodeURIComponent("ข้อกำหนด")}`,
        destination: "/site-info/terms",
      },
      {
        source: `/${encodeURIComponent("นโยบายความเป็นส่วนตัว")}`,
        destination: "/site-info/privacy",
      },
      {
        // IndexNow key file, /<key>.txt at the site root. The route only
        // answers when <key> is the configured INDEXNOW_KEY; any other root
        // .txt name gets its 404. Real files and routes (robots.txt) are
        // matched before rewrites, so they are unaffected.
        source: "/:key([A-Za-z0-9-]+).txt",
        destination: "/api/indexnow-key/:key",
      },
    ];
  },
  async headers() {
    return [
      {
        // The private /pro area must never be indexed. Its pages also carry a
        // noindex <meta> tag (app/pro/layout.tsx); this header covers every
        // response under /pro, redirects included. /pro is deliberately not in
        // robots.txt - that would publish the path.
        source: "/pro/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        // The push service worker (public/sw.js). Never cached, so a fix to
        // it reaches every subscribed browser on its next update check.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/gold-weight/:weightSlug",
        destination: "/ราคาทอง/:weightSlug",
        permanent: true,
      },
      {
        source: "/gold-guide/:guideSlug",
        destination: "/ความรู้/:guideSlug",
        permanent: true,
      },
      {
        source: "/gold-price-year/:year",
        destination: "/ราคาทองปี/:year",
        permanent: true,
      },
      {
        source: "/gold-price-month/:monthSlug",
        destination: "/ราคาทองเดือน/:monthSlug",
        permanent: true,
      },
      {
        source: "/gold-report/:reportSlug",
        destination: "/รายงานราคาทอง/:reportSlug",
        permanent: true,
      },
      // Short ASCII share links for the daily reports: /r/23-11-2569
      // (day-month-Buddhist year, no leading zeros) -> the Thai report URL.
      // They exist only so the link in the report's "share" text survives
      // being pasted into LINE or a blog (reportShortPath in
      // lib/report-pages.ts). One entry per month, because the destination
      // needs the month's Thai name.
      ...THAI_MONTH_NAMES.map((monthName, index) => ({
        source: `/r/:day([1-9]|[12]\\d|3[01])-${index + 1}-:year(\\d{4})`,
        destination: `/รายงานราคาทอง/:day-${monthName}-:year`,
        permanent: true,
      })),
      {
        source: "/gold-profit",
        destination: "/คำนวณกำไรขาดทุนทอง",
        permanent: true,
      },
      {
        source: "/gold-widget",
        destination: "/วิดเจ็ตราคาทอง",
        permanent: true,
      },
      {
        // Short ASCII alias, easy to type and to say.
        source: "/widget",
        destination: "/วิดเจ็ตราคาทอง",
        permanent: true,
      },
      {
        source: "/site-info/about",
        destination: "/เกี่ยวกับเรา",
        permanent: true,
      },
      {
        source: "/site-info/data-source",
        destination: "/แหล่งข้อมูล",
        permanent: true,
      },
      {
        source: "/site-info/contact",
        destination: "/ติดต่อเรา",
        permanent: true,
      },
      {
        source: "/site-info/terms",
        destination: "/ข้อกำหนด",
        permanent: true,
      },
      {
        source: "/site-info/privacy",
        destination: "/นโยบายความเป็นส่วนตัว",
        permanent: true,
      },
      {
        // Short ASCII alias for the privacy notice, for emails and letters.
        source: "/privacy",
        destination: "/นโยบายความเป็นส่วนตัว",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
