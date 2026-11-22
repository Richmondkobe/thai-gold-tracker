import type { Metadata } from "next";
import Link from "next/link";
import { formatThaiDateShort } from "@/lib/thai-date";
import { SITE_URL } from "@/lib/site";
import { WIDGET_BRAND, WIDGET_PAGE_PATH, WIDGET_PAGE_UPDATED_AT } from "@/lib/widget";
import type { FaqItem } from "@/lib/faq-content";
import { WidgetBuilder } from "@/components/WidgetBuilder";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";

// The page that offers the free embeddable widget: /วิดเจ็ตราคาทอง (rewritten
// onto this ASCII folder in next.config.ts; /widget and /gold-widget redirect
// to the Thai path). Entirely static - the live prices are inside the preview
// iframe (app/embed/gold-price/[variant]/route.ts), not in this page.

const TITLE = "วิดเจ็ตราคาทองวันนี้ ฟรี สำหรับติดเว็บไซต์และบล็อก";
// 160 characters or fewer.
const DESCRIPTION =
  "วิดเจ็ตราคาทองวันนี้ ใช้ฟรี ไม่ต้องสมัครสมาชิก คัดลอกโค้ดไปวางบนเว็บไซต์ WordPress หรือ Blogger ได้ทันที อัปเดตอัตโนมัติตามประกาศสมาคมค้าทองคำ";

const ENCODED_PATH = encodeURI(WIDGET_PAGE_PATH);

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: ENCODED_PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: ENCODED_PATH },
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "วิดเจ็ตราคาทองนี้ใช้ฟรีจริงหรือไม่",
    answer:
      "ฟรี ไม่มีค่าใช้จ่าย ไม่ต้องสมัครสมาชิก และไม่ต้องขอรหัสใด ๆ เพียงคัดลอกโค้ดจากหน้านี้ไปวางในหน้าเว็บของคุณ ใช้ได้ทั้งเว็บไซต์ส่วนตัว บล็อก และเว็บไซต์ร้านค้า",
  },
  {
    question: "ราคาในวิดเจ็ตอัปเดตบ่อยแค่ไหน",
    answer:
      "วิดเจ็ตดึงราคาล่าสุดที่เว็บไซต์ของเราบันทึกจากประกาศของสมาคมค้าทองคำ เมื่อสมาคมประกาศราคาใหม่ วิดเจ็ตจะแสดงราคานั้นภายในไม่กี่นาทีโดยคุณไม่ต้องทำอะไร และหากเปิดหน้าเว็บค้างไว้ วิดเจ็ตจะโหลดราคาใหม่เองทุก 5 นาที",
  },
  {
    question: "วิดเจ็ตจะทำให้เว็บไซต์ช้าลงหรือไม่",
    answer:
      "วิดเจ็ตเป็นหน้าเว็บขนาดเล็กมากที่แสดงในกรอบ (iframe) ไม่มีสคริปต์ ไม่มีรูปภาพ และไม่โหลดไฟล์จากที่อื่น จึงแทบไม่กระทบความเร็วของหน้าเว็บ และโหลดเมื่อผู้อ่านเลื่อนมาถึงเท่านั้น",
  },
  {
    question: "วิดเจ็ตเก็บข้อมูลผู้เข้าชมเว็บไซต์ของฉันหรือไม่",
    answer:
      "ไม่เก็บ วิดเจ็ตไม่ใช้คุกกี้ ไม่มีสคริปต์ติดตาม และไม่มีโฆษณา ตัววิดเจ็ตเป็นเพียงข้อความและตัวเลขราคาทองเท่านั้น",
  },
  {
    question: "ใช้กับ WordPress และ Blogger ได้หรือไม่",
    answer:
      "ได้ ใน WordPress ให้เพิ่มบล็อก “HTML กำหนดเอง” (Custom HTML) แล้ววางโค้ด ส่วนใน Blogger ให้เพิ่มแกดเจ็ต “HTML/JavaScript” ในหน้าเลย์เอาต์ หรือสลับไปที่มุมมอง HTML ของบทความแล้ววางโค้ด บางแพลตฟอร์มที่ไม่อนุญาตให้ฝัง iframe อาจใช้วิดเจ็ตนี้ไม่ได้",
  },
  {
    question: "ต้องคงบรรทัดเครดิตใต้วิดเจ็ตไว้หรือไม่",
    answer: `ขอให้คงบรรทัด “ราคาทองจาก ${WIDGET_BRAND}” ที่มากับโค้ดไว้ เพื่อให้ผู้อ่านของคุณทราบแหล่งที่มาของราคาและกดมาดูรายละเอียดเพิ่มเติมได้ บรรทัดนี้เป็นข้อความธรรมดาในหน้าเว็บของคุณ ปรับขนาดหรือสีตัวอักษรให้เข้ากับเว็บไซต์ได้`,
  },
];

const H2_CLASS = "text-xl font-bold text-gray-900 dark:text-gray-50";
const TEXT_CLASS = "text-base leading-relaxed text-gray-700 dark:text-gray-300";
const LIST_CLASS =
  "mt-3 flex list-disc flex-col gap-1.5 pl-5 text-base leading-relaxed text-gray-700 dark:text-gray-300";
const LINK_CLASS = "text-sm font-medium text-amber-600 hover:underline dark:text-amber-400";

export default function WidgetPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "ราคาทองวันนี้", item: `${SITE_URL}/` },
            {
              "@type": "ListItem",
              position: 2,
              name: "วิดเจ็ตราคาทอง",
              item: `${SITE_URL}${ENCODED_PATH}`,
            },
          ],
        }}
      />

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 sm:text-3xl">
          วิดเจ็ตราคาทองวันนี้
          <span className="mt-1 block text-base font-normal text-gray-500 dark:text-gray-400">
            ติดบนเว็บไซต์หรือบล็อกของคุณได้ฟรี
          </span>
        </h1>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          อัปเดตล่าสุด:{" "}
          <time dateTime={WIDGET_PAGE_UPDATED_AT}>
            {formatThaiDateShort(new Date(WIDGET_PAGE_UPDATED_AT))}
          </time>
        </p>
      </header>

      <p className={TEXT_CLASS}>
        แสดงราคาทองคำแท่งและทองรูปพรรณล่าสุดบนเว็บไซต์ของคุณด้วยการวางโค้ดเพียงครั้งเดียว ใช้ฟรี
        ไม่ต้องสมัครสมาชิก และไม่ต้องคอยแก้ไขตัวเลขเอง
        เพราะวิดเจ็ตจะอัปเดตเองทุกครั้งที่สมาคมค้าทองคำประกาศราคาใหม่
      </p>

      <WidgetBuilder siteUrl={SITE_URL} />

      <section aria-labelledby="install-heading">
        <h2 id="install-heading" className={H2_CLASS}>
          วิธีติดตั้ง
        </h2>
        <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-base leading-relaxed text-gray-700 dark:text-gray-300">
          <li>เลือกขนาดและสีพื้นที่เข้ากับเว็บไซต์ของคุณจากกล่องด้านบน</li>
          <li>กดปุ่ม “คัดลอกโค้ด”</li>
          <li>วางโค้ดในตำแหน่งที่ต้องการให้ราคาทองแสดงบนหน้าเว็บ แล้วบันทึก</li>
        </ol>
        <ul className={LIST_CLASS}>
          <li>
            <strong className="font-semibold text-gray-900 dark:text-gray-100">WordPress:</strong>{" "}
            เพิ่มบล็อก “HTML กำหนดเอง” (Custom HTML) ในบทความ หน้า หรือพื้นที่วิดเจ็ตของธีม
            แล้ววางโค้ดลงไป
          </li>
          <li>
            <strong className="font-semibold text-gray-900 dark:text-gray-100">Blogger:</strong>{" "}
            ไปที่เลย์เอาต์ เพิ่มแกดเจ็ต “HTML/JavaScript” แล้ววางโค้ด
            หรือสลับบทความไปที่มุมมอง HTML แล้ววางโค้ดในตำแหน่งที่ต้องการ
          </li>
          <li>
            <strong className="font-semibold text-gray-900 dark:text-gray-100">
              เว็บไซต์ทั่วไป:
            </strong>{" "}
            วางโค้ดในไฟล์ HTML ตรงตำแหน่งที่ต้องการได้เลย ไม่ต้องเพิ่มสคริปต์หรือไฟล์อื่น
          </li>
        </ul>
      </section>

      <section aria-labelledby="shows-heading">
        <h2 id="shows-heading" className={H2_CLASS}>
          วิดเจ็ตแสดงอะไรบ้าง
        </h2>
        <ul className={LIST_CLASS}>
          <li>ราคาทองคำแท่ง 96.5% รับซื้อและขายออก</li>
          <li>ราคาทองรูปพรรณ 96.5% รับซื้อ (ฐานภาษี) และขายออก</li>
          <li>
            ส่วนต่างของราคาทองคำแท่งขายออก เทียบกับราคาก่อนหน้าและเทียบกับราคาปิดของวันก่อน
          </li>
          <li>วันและเวลาของประกาศล่าสุด พร้อมลำดับประกาศของวัน (ประกาศครั้งที่)</li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          ราคาทั้งหมดเป็นราคาต่อน้ำหนักทอง 1 บาท ตามประกาศของสมาคมค้าทองคำ
          วิดเจ็ตมีขนาดคงที่และย่อตามความกว้างของคอลัมน์โดยอัตโนมัติ
          จึงไม่ดันเนื้อหาส่วนอื่นของหน้าเว็บ
        </p>
      </section>

      <section aria-labelledby="terms-heading">
        <h2 id="terms-heading" className={H2_CLASS}>
          เงื่อนไขการใช้งานโดยย่อ
        </h2>
        <ul className={LIST_CLASS}>
          <li>ใช้ได้ฟรีบนเว็บไซต์ทุกประเภท ไม่จำกัดจำนวนหน้า</li>
          <li>
            ขอให้คงบรรทัดเครดิต “ราคาทองจาก {WIDGET_BRAND}” ใต้วิดเจ็ตไว้ตามโค้ดที่คัดลอก
          </li>
          <li>
            ราคาในวิดเจ็ตใช้เพื่ออ้างอิงเท่านั้น
            ควรตรวจสอบราคากับร้านทองอีกครั้งก่อนซื้อขายจริง
          </li>
        </ul>
      </section>

      <FaqSection items={FAQ_ITEMS} />

      <div className="flex flex-col gap-2">
        <Link href="/" className={LINK_CLASS}>
          ← ดูราคาทองวันนี้
        </Link>
        <Link href="/แหล่งข้อมูล" className={LINK_CLASS}>
          แหล่งข้อมูลและวิธีการของเรา →
        </Link>
      </div>
    </main>
  );
}
