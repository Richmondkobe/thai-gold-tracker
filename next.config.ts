import type { NextConfig } from "next";

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
        source: `/${encodeURIComponent("คำนวณกำไรขาดทุนทอง")}`,
        destination: "/gold-profit",
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
        source: "/gold-profit",
        destination: "/คำนวณกำไรขาดทุนทอง",
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
    ];
  },
};

export default nextConfig;
