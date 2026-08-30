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
