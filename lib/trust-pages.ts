// Config for the five trust pages (about, data source, contact, terms,
// privacy).
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
  /**
   * Date this page's text was last edited, "YYYY-MM-DD" - the sitemap's
   * lastmod. Bump it by hand when the page's content changes.
   */
  updatedAt: string;
}

/** The privacy notice, linked from the footer and from both alert sign-ups. */
export const PRIVACY_PAGE_SLUG = "privacy";
export const PRIVACY_PAGE_PATH = "/นโยบายความเป็นส่วนตัว";

/** Where privacy and deletion requests go (also shown on the contact page). */
export const CONTACT_EMAIL = "contact@thaigoldtracker.com";

export const TRUST_PAGES: TrustPageConfig[] = [
  {
    slug: "about",
    updatedAt: "2026-08-30",
    pathTh: "/เกี่ยวกับเรา",
    nameTh: "เกี่ยวกับเรา",
    title: "เกี่ยวกับเรา",
    description:
      "ราคาทองวันนี้ (thaigoldtracker.com) เว็บไซต์อิสระสำหรับเช็คราคาทองตามประกาศสมาคมค้าทองคำ ราคาย้อนหลังตั้งแต่ปี 2559 เครื่องคำนวณ และแจ้งเตือนราคาทางอีเมล",
  },
  {
    slug: "data-source",
    updatedAt: "2026-11-24",
    pathTh: "/แหล่งข้อมูล",
    nameTh: "แหล่งข้อมูล",
    title: "แหล่งข้อมูลและวิธีการ",
    description:
      "ราคาทองบนเว็บไซต์อ้างอิงจากประกาศสมาคมค้าทองคำ (goldtraders.or.th) ตรวจสอบอัตโนมัติประมาณทุก 2 นาที บันทึกด้วยเวลาประกาศจริง มีข้อมูลย้อนหลังตั้งแต่มกราคม 2559",
  },
  {
    slug: "contact",
    updatedAt: "2026-08-30",
    pathTh: "/ติดต่อเรา",
    nameTh: "ติดต่อเรา",
    title: "ติดต่อเรา",
    description:
      "ติดต่อทีมงานราคาทองวันนี้ แจ้งข้อมูลผิดพลาดหรือข้อเสนอแนะได้ที่ contact@thaigoldtracker.com",
  },
  {
    slug: "terms",
    updatedAt: "2026-08-30",
    pathTh: "/ข้อกำหนด",
    nameTh: "ข้อกำหนด",
    title: "ข้อกำหนดการใช้งานและข้อจำกัดความรับผิดชอบ",
    description:
      "ข้อกำหนดการใช้งานเว็บไซต์ราคาทองวันนี้ ข้อมูลเพื่อประกอบการตัดสินใจเท่านั้น ไม่ใช่คำแนะนำการลงทุน ราคาซื้อขายจริงหน้าร้านอาจแตกต่างจากราคาประกาศ",
  },
  {
    // Thai first, then the same text in English, on one page. It describes
    // what the code stores today (price_alerts, push_subscriptions): when a
    // change makes the site collect, keep or share anything else, change this
    // page in the same commit and bump updatedAt.
    slug: PRIVACY_PAGE_SLUG,
    updatedAt: "2026-11-24",
    pathTh: PRIVACY_PAGE_PATH,
    nameTh: "นโยบายความเป็นส่วนตัว",
    title: "นโยบายความเป็นส่วนตัว (Privacy Notice)",
    description:
      "ราคาทองวันนี้เก็บเฉพาะอีเมลและข้อมูลการแจ้งเตือนบนเบราว์เซอร์ของผู้ที่สมัครรับแจ้งเตือนราคาทอง ไม่ใช้คุกกี้ติดตาม ยกเลิกหรือขอลบข้อมูลได้ทุกเมื่อ",
  },
];

export function getTrustPageBySlug(slug: string): TrustPageConfig | null {
  return TRUST_PAGES.find((p) => p.slug === slug) ?? null;
}
