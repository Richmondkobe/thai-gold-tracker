import type { Metadata } from "next";

// The private /pro area (see "Private /pro area" in CLAUDE.md). Nothing here
// may be indexed: this metadata adds the noindex <meta> tag to every /pro
// page, and next.config.ts sends the same rule as an X-Robots-Tag header.
// /pro is deliberately NOT in robots.txt - listing it there would publish the
// path, and would stop crawlers from ever seeing the noindex.
//
// This layout does not check the login: each page and each Server Action
// does that itself with requireProSession().
export const metadata: Metadata = {
  title: { absolute: "Pro" },
  description: "Private area.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function ProLayout({ children }: LayoutProps<"/pro">) {
  return (
    <div lang="en" className="flex flex-1 flex-col">
      {children}
    </div>
  );
}
