import { BAHT_TO_GRAM_BAR, BAHT_TO_GRAM_ORNAMENT } from "@/lib/gold-weight";

// Config for the statically generated explainer pages under /ความรู้.
// Same URL pattern as lib/weight-pages.ts: the route folder is ASCII
// (app/gold-guide/[guideSlug]) and next.config.ts rewrites the Thai path
// onto it; use encodeURI() when emitting the path in URLs.

export interface GuidePageConfig {
  /** Decoded path segment under /ความรู้, e.g. "ทอง-1-บาท-กี่กรัม". */
  slug: string;
  title: string;
  description: string;
}

export const GUIDE_PAGES: GuidePageConfig[] = [
  {
    slug: "ทอง-1-บาท-กี่กรัม",
    title: "ทอง 1 บาท กี่กรัม ตารางแปลงน้ำหนักทองเป็นกรัม",
    description: `ทองคำแท่ง 1 บาท หนัก ${BAHT_TO_GRAM_BAR} กรัม ส่วนทองรูปพรรณ 1 บาท หนัก ${BAHT_TO_GRAM_ORNAMENT} กรัม พร้อมตารางแปลงน้ำหนักทองตั้งแต่ 1 สลึงถึง 10 บาทเป็นกรัม และลิงก์ดูราคาทองแต่ละน้ำหนัก`,
  },
];

export function getGuidePageBySlug(slug: string): GuidePageConfig | null {
  return GUIDE_PAGES.find((p) => p.slug === slug) ?? null;
}

/** Decoded app path, e.g. "/ความรู้/ทอง-1-บาท-กี่กรัม". Wrap in encodeURI() for URLs. */
export function guidePagePath(config: GuidePageConfig): string {
  return `/ความรู้/${config.slug}`;
}
