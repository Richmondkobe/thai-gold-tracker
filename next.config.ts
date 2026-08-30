import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The public URLs for the per-weight pages are Thai (/ราคาทอง/1-สลึง) for SEO,
  // but this Next version does not route non-ASCII app-directory folder names,
  // so the route lives at app/gold-weight/[weightSlug] and the Thai path is
  // rewritten onto it. The redirect keeps /gold-weight/* from existing as a
  // duplicate public URL.
  async rewrites() {
    return [
      {
        // Percent-encoded form of /ราคาทอง/:weightSlug — the matcher sees the
        // encoded request path, not the decoded one.
        source: `/${encodeURIComponent("ราคาทอง")}/:weightSlug`,
        destination: "/gold-weight/:weightSlug",
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
    ];
  },
};

export default nextConfig;
