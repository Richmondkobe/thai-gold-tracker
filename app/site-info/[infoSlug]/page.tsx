import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { TRUST_PAGES, getTrustPageBySlug, type TrustPageConfig } from "@/lib/trust-pages";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/site";

// Same routing pattern as app/gold-guide/[guideSlug]: ASCII folder, Thai
// public URLs via rewrites in next.config.ts, unknown slugs 404 via notFound().
export function generateStaticParams() {
  return TRUST_PAGES.map((p) => ({ infoSlug: p.slug }));
}

interface Props {
  params: Promise<{ infoSlug: string }>;
}

async function resolveConfig(params: Props["params"]): Promise<TrustPageConfig> {
  const { infoSlug } = await params;
  const config = getTrustPageBySlug(decodeURIComponent(infoSlug));
  if (!config) notFound();
  return config;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = await resolveConfig(params);
  const path = encodeURI(config.pathTh);
  return {
    title: config.title,
    description: config.description,
    alternates: { canonical: path },
    openGraph: {
      title: config.title,
      description: config.description,
      url: path,
    },
  };
}

export default async function TrustPage({ params }: Props) {
  const config = await resolveConfig(params);
  const Content = CONTENT[config.slug];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "ราคาทองวันนี้",
              item: `${SITE_URL}/`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: config.title,
              item: `${SITE_URL}${encodeURI(config.pathTh)}`,
            },
          ],
        }}
      />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 sm:text-3xl">
        {config.title}
      </h1>
      <Content />
    </main>
  );
}

const sectionHeading = "text-lg font-bold text-gray-900 dark:text-gray-50";
const paragraph = "text-sm leading-relaxed text-gray-600 dark:text-gray-400";
const strong = "font-semibold text-gray-900 dark:text-gray-100";

function AboutContent() {
  return (
    <div className="flex flex-col gap-4">
      <p className={paragraph}>
        <span className={strong}>ราคาทองวันนี้</span> (thaigoldtracker.com)
        เป็นเว็บไซต์อิสระ ดำเนินการโดย Richmond Kobe
        จัดทำขึ้นเพื่อให้ทุกคนเช็คราคาทองตามประกาศได้สะดวกและรวดเร็ว
      </p>
      <p className={paragraph}>
        เว็บไซต์นี้<span className={strong}>ไม่มีความเกี่ยวข้องกับสมาคมค้าทองคำ</span>{" "}
        (Gold Traders Association)
        เราเป็นเพียงผู้รวบรวมและแสดงราคาตามประกาศของสมาคมฯ เท่านั้น
      </p>
      <h2 className={sectionHeading}>สิ่งที่เว็บไซต์นี้ให้บริการ</h2>
      <ul className={`${paragraph} list-inside list-disc space-y-1`}>
        <li>
          ราคาทองคำแท่งและทองรูปพรรณตามประกาศสมาคมค้าทองคำ อัปเดตระหว่างวัน
        </li>
        <li>ราคาทองย้อนหลังตั้งแต่เดือนมกราคม พ.ศ. 2559 พร้อมกราฟและสถิติรายปี</li>
        <li>เครื่องคำนวณมูลค่าทอง และเครื่องคำนวณกำไร/ขาดทุน</li>
        <li>บริการแจ้งเตือนราคาทองทางอีเมลเมื่อราคาถึงเป้าหมายที่ตั้งไว้</li>
      </ul>
    </div>
  );
}

function DataSourceContent() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className={sectionHeading}>แหล่งที่มาของราคา</h2>
      <p className={paragraph}>
        ราคาทองทั้งหมดบนเว็บไซต์นี้อ้างอิงจากประกาศของสมาคมค้าทองคำ
        (goldtraders.or.th) ซึ่งเป็นราคากลางที่ร้านทองทั่วประเทศใช้อ้างอิง
      </p>
      <h2 className={sectionHeading}>การอัปเดต</h2>
      <p className={paragraph}>
        ระบบตรวจสอบประกาศราคาใหม่โดยอัตโนมัติทุก 30 นาที
        ราคาแต่ละรายการบันทึกด้วย<span className={strong}>เวลาประกาศจริงของสมาคมฯ</span>{" "}
        ไม่ใช่เวลาที่ระบบของเราดึงข้อมูล
        ดังนั้นเวลาที่แสดงบนเว็บไซต์คือเวลาประกาศเสมอ
      </p>
      <h2 className={sectionHeading}>เมื่อไม่มีประกาศใหม่</h2>
      <p className={paragraph}>
        หากแหล่งข้อมูลไม่พร้อมใช้งาน หรือตลาดปิด (วันอาทิตย์และวันหยุด)
        เว็บไซต์จะแสดงราคาประกาศล่าสุดพร้อมวันที่และเวลาของประกาศนั้น
        และแถบ &ldquo;ตลาดปิด&rdquo;
        จะแสดงให้เห็นชัดเจนว่าราคาที่เห็นมาจากวันก่อนหน้า
      </p>
      <h2 className={sectionHeading}>ข้อมูลย้อนหลัง</h2>
      <p className={paragraph}>
        เก็บราคาย้อนหลังตั้งแต่เดือนมกราคม พ.ศ. 2559
        ทั้งราคาปิดรายวันและราคาระหว่างวัน
      </p>
    </div>
  );
}

function ContactContent() {
  return (
    <div className="flex flex-col gap-4">
      <p className={paragraph}>
        ติดต่อทีมงานได้ที่{" "}
        <a
          href="mailto:contact@thaigoldtracker.com"
          className="font-medium text-amber-600 hover:underline dark:text-amber-400"
        >
          contact@thaigoldtracker.com
        </a>
      </p>
      <p className={paragraph}>
        หากพบราคาที่ไม่ตรงกับประกาศ ข้อมูลผิดพลาด
        หรือส่วนใดของเว็บไซต์ทำงานไม่ถูกต้อง แจ้งเราได้เลย
        เรายินดีรับทุกคำติชมและจะตรวจสอบแก้ไขโดยเร็วที่สุด
      </p>
    </div>
  );
}

function TermsContent() {
  return (
    <ul className={`${paragraph} list-inside list-disc space-y-3`}>
      <li>
        ข้อมูลราคาทองบนเว็บไซต์นี้จัดทำขึ้น
        <span className={strong}>เพื่อประกอบข้อมูลเท่านั้น</span>{" "}
        ไม่ใช่คำแนะนำในการลงทุน
        การตัดสินใจซื้อขายทองคำเป็นความรับผิดชอบของผู้ใช้เอง
      </li>
      <li>
        ราคาซื้อขายจริงที่หน้าร้านทองอาจแตกต่างจากราคาประกาศ
        โปรดตรวจสอบราคากับร้านค้าก่อนทำธุรกรรมทุกครั้ง
      </li>
      <li>
        ราคารับซื้อทองรูปพรรณที่แสดงเป็นตัวเลข
        <span className={strong}>ฐานภาษี</span>ตามประกาศของสมาคมค้าทองคำ
        ซึ่งเป็นตัวเลขอ้างอิงสำหรับการคำนวณภาษี ไม่ใช่ราคารับซื้อจริงหน้าร้าน
      </li>
      <li>
        เราพยายามให้ข้อมูลถูกต้องและเป็นปัจจุบันที่สุด แต่
        <span className={strong}>ไม่รับประกัน</span>ความถูกต้อง ครบถ้วน
        หรือความพร้อมใช้งานของข้อมูลและเว็บไซต์
        และไม่รับผิดชอบต่อความเสียหายใด ๆ จากการใช้ข้อมูลบนเว็บไซต์นี้
      </li>
    </ul>
  );
}

const CONTENT: Record<string, () => ReactNode> = {
  about: AboutContent,
  "data-source": DataSourceContent,
  contact: ContactContent,
  terms: TermsContent,
};
