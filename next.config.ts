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
    ];
  },
};

export default nextConfig;
