// Config for the statically generated /ราคาทอง/[weightSlug] pages.
// `slug` is the decoded Thai path segment under /ราคาทอง (Next handles the
// percent-encoding); use encodeURI() when emitting the path in canonical/OG
// URLs and the sitemap.

export interface WeightPageConfig {
  /** Decoded path segment under /ราคาทอง, e.g. "1-สลึง". */
  slug: string;
  /** Weight phrase used in headings, e.g. "ทอง 1 สลึง" -> "ราคาทอง 1 สลึงวันนี้". */
  nameTh: string;
  bahtWeight: number;
  title: string;
  description: string;
}

export const WEIGHT_PAGES: WeightPageConfig[] = [
  {
    slug: "1-สลึง",
    nameTh: "ทอง 1 สลึง",
    bahtWeight: 0.25,
    title: "ราคาทอง 1 สลึงวันนี้ ทองคำแท่งและทองรูปพรรณ",
    description:
      "เช็คราคาทอง 1 สลึงวันนี้ (ประมาณ 3.81 กรัม) ทั้งทองคำแท่งและทองรูปพรรณ ราคาซื้อ-ขายอัปเดตตามประกาศสมาคมค้าทองคำ พร้อมเครื่องคำนวณมูลค่าทอง",
  },
  {
    slug: "ครึ่งบาท",
    nameTh: "ทองครึ่งบาท",
    bahtWeight: 0.5,
    title: "ราคาทองครึ่งบาทวันนี้ ทองคำแท่งและทองรูปพรรณ",
    description:
      "เช็คราคาทองครึ่งบาท (2 สลึง) วันนี้ (ประมาณ 7.62 กรัม) ทั้งทองคำแท่งและทองรูปพรรณ ราคาซื้อ-ขายอัปเดตตามประกาศสมาคมค้าทองคำ พร้อมเครื่องคำนวณมูลค่าทอง",
  },
  {
    slug: "1-บาท",
    nameTh: "ทอง 1 บาท",
    bahtWeight: 1,
    title: "ราคาทอง 1 บาทวันนี้ ทองคำแท่งและทองรูปพรรณ",
    description:
      "เช็คราคาทอง 1 บาทวันนี้ (15.244 กรัม) ทั้งทองคำแท่งและทองรูปพรรณ ราคาซื้อ-ขายอัปเดตตามประกาศสมาคมค้าทองคำ พร้อมเครื่องคำนวณมูลค่าทอง",
  },
  {
    slug: "2-บาท",
    nameTh: "ทอง 2 บาท",
    bahtWeight: 2,
    title: "ราคาทอง 2 บาทวันนี้ ทองคำแท่งและทองรูปพรรณ",
    description:
      "เช็คราคาทอง 2 บาทวันนี้ (ประมาณ 30.49 กรัม) ทั้งทองคำแท่งและทองรูปพรรณ ราคาซื้อ-ขายอัปเดตตามประกาศสมาคมค้าทองคำ พร้อมเครื่องคำนวณมูลค่าทอง",
  },
  {
    slug: "5-บาท",
    nameTh: "ทอง 5 บาท",
    bahtWeight: 5,
    title: "ราคาทอง 5 บาทวันนี้ ทองคำแท่งและทองรูปพรรณ",
    description:
      "เช็คราคาทอง 5 บาทวันนี้ (ประมาณ 76.22 กรัม) ทั้งทองคำแท่งและทองรูปพรรณ ราคาซื้อ-ขายอัปเดตตามประกาศสมาคมค้าทองคำ พร้อมเครื่องคำนวณมูลค่าทอง",
  },
  {
    slug: "10-บาท",
    nameTh: "ทอง 10 บาท",
    bahtWeight: 10,
    title: "ราคาทอง 10 บาทวันนี้ ทองคำแท่งและทองรูปพรรณ",
    description:
      "เช็คราคาทอง 10 บาทวันนี้ (ประมาณ 152.44 กรัม) ทั้งทองคำแท่งและทองรูปพรรณ ราคาซื้อ-ขายอัปเดตตามประกาศสมาคมค้าทองคำ พร้อมเครื่องคำนวณมูลค่าทอง",
  },
];

export function getWeightPageBySlug(slug: string): WeightPageConfig | null {
  return WEIGHT_PAGES.find((p) => p.slug === slug) ?? null;
}

/** Decoded app path, e.g. "/ราคาทอง/1-สลึง". Wrap in encodeURI() for URLs. */
export function weightPagePath(config: WeightPageConfig): string {
  return `/ราคาทอง/${config.slug}`;
}
