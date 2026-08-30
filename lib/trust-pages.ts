// Config for the four trust pages (about, data source, contact, terms).
// Same URL pattern as the guide pages: ASCII route folder
// (app/site-info/[infoSlug]) with the Thai public path rewritten onto it in
// next.config.ts; use encodeURI() when emitting pathTh in URLs.

export interface TrustPageConfig {
  /** ASCII route segment under /site-info, e.g. "about". */
  slug: string;
  /** Decoded Thai public path, e.g. "/เกี่ยวกับเรา". */
  pathTh: string;
  /** Footer link label / H1. */
  nameTh: string;
  title: string;
  description: string;
}

export const TRUST_PAGES: TrustPageConfig[] = [
  {
    slug: "about",
    pathTh: "/เกี่ยวกับเรา",
    nameTh: "เกี่ยวกับเรา",
    title: "เกี่ยวกับเรา",
    description:
      "ราคาทองวันนี้ (thaigoldtracker.com) เว็บไซต์อิสระสำหรับเช็คราคาทองตามประกาศสมาคมค้าทองคำ ราคาย้อนหลังตั้งแต่ปี 2559 เครื่องคำนวณ และแจ้งเตือนราคาทางอีเมล",
  },
  {
    slug: "data-source",
    pathTh: "/แหล่งข้อมูล",
    nameTh: "แหล่งข้อมูล",
    title: "แหล่งข้อมูลและวิธีการ",
    description:
      "ราคาทองบนเว็บไซต์อ้างอิงจากประกาศสมาคมค้าทองคำ (goldtraders.or.th) ตรวจสอบอัตโนมัติทุก 30 นาที บันทึกด้วยเวลาประกาศจริง พร้อมข้อมูลย้อนหลังตั้งแต่มกราคม 2559",
  },
  {
    slug: "contact",
    pathTh: "/ติดต่อเรา",
    nameTh: "ติดต่อเรา",
    title: "ติดต่อเรา",
    description:
      "ติดต่อทีมงานราคาทองวันนี้ แจ้งข้อมูลผิดพลาดหรือข้อเสนอแนะได้ที่ contact@thaigoldtracker.com",
  },
  {
    slug: "terms",
    pathTh: "/ข้อกำหนด",
    nameTh: "ข้อกำหนด",
    title: "ข้อกำหนดการใช้งานและข้อจำกัดความรับผิดชอบ",
    description:
      "ข้อกำหนดการใช้งานเว็บไซต์ราคาทองวันนี้ ข้อมูลเพื่อประกอบการตัดสินใจเท่านั้น ไม่ใช่คำแนะนำการลงทุน ราคาซื้อขายจริงหน้าร้านอาจแตกต่างจากราคาประกาศ",
  },
];

export function getTrustPageBySlug(slug: string): TrustPageConfig | null {
  return TRUST_PAGES.find((p) => p.slug === slug) ?? null;
}
