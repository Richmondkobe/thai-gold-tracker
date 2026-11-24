import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  CONTACT_EMAIL,
  PRIVACY_PAGE_SLUG,
  TRUST_PAGES,
  getTrustPageBySlug,
  type TrustPageConfig,
} from "@/lib/trust-pages";
import { formatThaiDateLong } from "@/lib/thai-date";
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
        ระบบตรวจสอบประกาศราคาใหม่โดยอัตโนมัติประมาณทุก 2 นาที
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

const subHeading = "text-base font-semibold text-gray-900 dark:text-gray-100";
const link = "font-medium text-amber-600 hover:underline dark:text-amber-400";
const bulletList = `${paragraph} list-outside list-disc space-y-2 pl-5`;

function ContactEmailLink() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
      {CONTACT_EMAIL}
    </a>
  );
}

// The privacy notice: Thai, then the same text in English. Every statement
// here describes what the code does today - see the note on the "privacy"
// entry in lib/trust-pages.ts before changing what the site stores.
function PrivacyContent() {
  const updatedAt = new Date(
    `${getTrustPageBySlug(PRIVACY_PAGE_SLUG)!.updatedAt}T00:00:00+07:00`,
  );
  const updatedAtEn = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(updatedAt);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <p className="text-xs text-gray-500 dark:text-gray-500">
          อัปเดตล่าสุด: {formatThaiDateLong(updatedAt)} ·{" "}
          <a href="#privacy-english" className={link}>
            English version below
          </a>
        </p>
        <p className={paragraph}>
          <span className={strong}>ราคาทองวันนี้</span> (thaigoldtracker.com)
          ดำเนินการโดย Richmond Kobe หน้านี้อธิบายว่าเราเก็บข้อมูลส่วนบุคคลอะไร
          เพื่ออะไร และคุณยกเลิกหรือขอให้ลบข้อมูลได้อย่างไร
          คุณเข้าชมเว็บไซต์ได้โดยไม่ต้องสมัครสมาชิกและไม่ต้องให้ข้อมูลใด ๆ
        </p>

        <h2 className={sectionHeading}>ข้อมูลที่เราเก็บ</h2>
        <p className={paragraph}>
          เราเก็บข้อมูลเฉพาะเมื่อคุณเลือกรับการแจ้งเตือนราคาทองด้วยตัวเองเท่านั้น
        </p>
        <ul className={bulletList}>
          <li>
            <span className={strong}>การแจ้งเตือนทางอีเมล:</span>{" "}
            ที่อยู่อีเมลของคุณ รูปแบบการแจ้งเตือนที่เลือก
            ราคาเป้าหมายและเงื่อนไข (ถ้าตั้งไว้) สถานะการยืนยัน
            และวันเวลาที่สมัคร
          </li>
          <li>
            <span className={strong}>การแจ้งเตือนบนเบราว์เซอร์:</span>{" "}
            ที่อยู่สำหรับส่งการแจ้งเตือนที่เบราว์เซอร์ของคุณออกให้
            กุญแจเข้ารหัสของเบราว์เซอร์ วันเวลาที่เปิดใช้
            และเวลาที่ส่งสำเร็จครั้งล่าสุด
            ข้อมูลนี้ไม่ได้บอกชื่อหรืออีเมลของคุณ
            และเว็บไซต์จะบันทึกเวลาหนึ่งค่าไว้ในเบราว์เซอร์ของคุณเองเพื่อให้ระบบทำงานถูกต้อง
          </li>
          <li>
            <span className={strong}>บันทึกทางเทคนิค:</span>{" "}
            ผู้ให้บริการโฮสติ้งของเราบันทึกข้อมูลการเข้าใช้งานตามปกติ เช่น
            หมายเลข IP และชนิดของเบราว์เซอร์
            เพื่อความปลอดภัยและการแก้ไขปัญหา
          </li>
        </ul>
        <p className={paragraph}>
          เว็บไซต์นี้ไม่ใช้คุกกี้เพื่อติดตามหรือโฆษณา
          และไม่ใช้เครื่องมือวิเคราะห์ผู้เข้าชมของบุคคลที่สาม
        </p>

        <h2 className={sectionHeading}>เราใช้ข้อมูลเพื่ออะไร</h2>
        <p className={paragraph}>
          เพื่อส่งการแจ้งเตือนราคาทองที่คุณขอไว้
          รวมถึงอีเมลยืนยันการสมัคร เท่านั้น
          เราใช้ข้อมูลนี้โดยอาศัยความยินยอมของคุณ ซึ่งคุณถอนได้ทุกเมื่อ
          เรา<span className={strong}>ไม่ขาย ไม่ให้เช่า</span>{" "}
          และไม่ใช้ข้อมูลของคุณเพื่อการตลาดหรือโฆษณา
        </p>

        <h2 className={sectionHeading}>ผู้ให้บริการที่ช่วยเราประมวลผลข้อมูล</h2>
        <ul className={bulletList}>
          <li>Supabase: ฐานข้อมูล (เซิร์ฟเวอร์ในประเทศสิงคโปร์)</li>
          <li>Vercel: โฮสติ้งเว็บไซต์</li>
          <li>Resend: ส่งอีเมลแจ้งเตือน</li>
          <li>GitHub: เก็บสำเนาสำรองฐานข้อมูลในที่เก็บส่วนตัว</li>
          <li>
            บริการแจ้งเตือนของผู้ผลิตเบราว์เซอร์ของคุณ (Google, Mozilla, Apple
            หรือ Microsoft): ส่งการแจ้งเตือนไปยังเครื่องของคุณ
            โดยเนื้อหาการแจ้งเตือนถูกเข้ารหัส
          </li>
        </ul>
        <p className={paragraph}>
          ผู้ให้บริการเหล่านี้บางรายอยู่นอกประเทศไทย
          เราไม่เปิดเผยข้อมูลของคุณแก่ผู้อื่นนอกจากนี้
          เว้นแต่กฎหมายกำหนดให้ต้องเปิดเผย
        </p>

        <h2 className={sectionHeading}>เราเก็บข้อมูลไว้นานเท่าใด</h2>
        <ul className={bulletList}>
          <li>
            <span className={strong}>อีเมล:</span>{" "}
            จนกว่าคุณจะยกเลิกการแจ้งเตือนหรือขอให้เราลบ
            เมื่อคุณยกเลิก ข้อมูลการแจ้งเตือนนั้นจะถูกลบออกจากฐานข้อมูลของเรา
            หากคุณสมัครแล้วไม่ได้กดยืนยันในอีเมล เราจะไม่ส่งการแจ้งเตือนใด ๆ
            และคุณขอให้ลบอีเมลนั้นได้เช่นกัน
          </li>
          <li>
            <span className={strong}>การแจ้งเตือนบนเบราว์เซอร์:</span>{" "}
            จนกว่าคุณจะปิดการแจ้งเตือน
            หรือจนกว่าบริการแจ้งเตือนของเบราว์เซอร์แจ้งว่าใช้ไม่ได้แล้ว
            ซึ่งระบบจะลบให้อัตโนมัติ
          </li>
          <li>
            <span className={strong}>สำเนาสำรองข้อมูล:</span>{" "}
            เราสำรองฐานข้อมูลทุกวันเพื่อป้องกันข้อมูลสูญหาย
            สำเนาสำรองแต่ละชุดเก็บไว้เป็นส่วนตัวและถูกลบอัตโนมัติเมื่อครบ 30 วัน
            ข้อมูลที่คุณยกเลิกหรือขอให้ลบแล้วจึงอาจยังอยู่ในสำเนาสำรองได้อีกไม่เกิน
            30 วัน
          </li>
        </ul>

        <h2 className={sectionHeading}>วิธียกเลิกและขอลบข้อมูล</h2>
        <ul className={bulletList}>
          <li>
            <span className={strong}>อีเมล:</span>{" "}
            กดลิงก์ &ldquo;ยกเลิกการแจ้งเตือน&rdquo;
            ที่ท้ายอีเมลแจ้งเตือนทุกฉบับ แล้วกดยืนยันในหน้าที่เปิดขึ้น
          </li>
          <li>
            <span className={strong}>เบราว์เซอร์:</span>{" "}
            กดปุ่ม &ldquo;ปิดการแจ้งเตือน&rdquo; ที่หน้าแรกบนเครื่องเดียวกัน
            หรือปิดการแจ้งเตือนของเว็บไซต์นี้ในการตั้งค่าเบราว์เซอร์
          </li>
          <li>
            <span className={strong}>ขอให้เราดำเนินการให้:</span> ส่งอีเมลถึง{" "}
            <ContactEmailLink /> จากที่อยู่อีเมลที่ต้องการให้ลบ
          </li>
        </ul>

        <h2 className={sectionHeading}>สิทธิของคุณ</h2>
        <p className={paragraph}>
          คุณมีสิทธิขอดู ขอแก้ไข หรือขอให้ลบข้อมูลของคุณ
          และถอนความยินยอมได้ทุกเมื่อ
          ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
          หากมีคำถามหรือต้องการใช้สิทธิ ติดต่อ <ContactEmailLink />
        </p>

        <h2 className={sectionHeading}>การเปลี่ยนแปลงนโยบายนี้</h2>
        <p className={paragraph}>
          หากเราเปลี่ยนวิธีเก็บหรือใช้ข้อมูล เราจะแก้ไขหน้านี้และวันที่
          &ldquo;อัปเดตล่าสุด&rdquo; ด้านบน
        </p>
      </section>

      <section
        id="privacy-english"
        lang="en"
        className="flex scroll-mt-4 flex-col gap-4 border-t border-gray-200 pt-8 dark:border-gray-800"
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">Privacy Notice</h2>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Last updated: {updatedAtEn}
        </p>
        <p className={paragraph}>
          <span className={strong}>ThaiGoldTracker</span> (thaigoldtracker.com) is run by
          Richmond Kobe. This page explains what personal data we collect, why, and how
          you can unsubscribe or ask us to delete it. You can use the website without an
          account and without giving us any information.
        </p>

        <h3 className={subHeading}>What we collect</h3>
        <p className={paragraph}>
          We collect data only when you choose to receive gold price alerts.
        </p>
        <ul className={bulletList}>
          <li>
            <span className={strong}>Email alerts:</span> your email address, the kind of
            alert you chose, your target price and condition (if you set one), whether
            you confirmed, and the date and time you signed up.
          </li>
          <li>
            <span className={strong}>Browser notifications:</span> the notification
            address your browser issues, your browser&rsquo;s encryption keys, the date
            and time you turned notifications on, and the time of the last successful
            delivery. This does not tell us your name or email address. The site also
            saves one timestamp in your own browser so that the feature works correctly.
          </li>
          <li>
            <span className={strong}>Technical logs:</span> our hosting provider keeps
            standard access logs, such as IP address and browser type, for security and
            troubleshooting.
          </li>
        </ul>
        <p className={paragraph}>
          This website uses no tracking or advertising cookies and no third-party
          visitor analytics.
        </p>

        <h3 className={subHeading}>Why we use it</h3>
        <p className={paragraph}>
          Only to send the gold price alerts you asked for, including the email that
          confirms your sign-up. We use this data on the basis of your consent, which you
          can withdraw at any time. We <span className={strong}>do not sell or rent</span>{" "}
          your data and do not use it for marketing or advertising.
        </p>

        <h3 className={subHeading}>Service providers that process data for us</h3>
        <ul className={bulletList}>
          <li>Supabase: database (servers in Singapore)</li>
          <li>Vercel: website hosting</li>
          <li>Resend: sending alert emails</li>
          <li>GitHub: stores the database backups in a private repository</li>
          <li>
            Your browser maker&rsquo;s notification service (Google, Mozilla, Apple or
            Microsoft): delivers notifications to your device. The notification content
            is encrypted.
          </li>
        </ul>
        <p className={paragraph}>
          Some of these providers are outside Thailand. We do not share your data with
          anyone else unless the law requires it.
        </p>

        <h3 className={subHeading}>How long we keep it</h3>
        <ul className={bulletList}>
          <li>
            <span className={strong}>Email:</span> until you unsubscribe or ask us to
            delete it. When you unsubscribe, that alert is deleted from our database. If
            you sign up but never confirm by email, we send no alerts, and you can ask us
            to delete the address too.
          </li>
          <li>
            <span className={strong}>Browser notifications:</span> until you turn them
            off, or until your browser&rsquo;s notification service reports that the
            subscription no longer works, when it is deleted automatically.
          </li>
          <li>
            <span className={strong}>Backups:</span> we back up the database every day
            to protect against data loss. Each backup copy is kept privately and
            deleted automatically after 30 days, so data you have unsubscribed or
            asked us to delete can remain in backup copies for up to 30 days.
          </li>
        </ul>

        <h3 className={subHeading}>How to unsubscribe or ask for deletion</h3>
        <ul className={bulletList}>
          <li>
            <span className={strong}>Email:</span> use the unsubscribe link
            (&ldquo;ยกเลิกการแจ้งเตือน&rdquo;) at the bottom of every alert email, then
            confirm on the page that opens.
          </li>
          <li>
            <span className={strong}>Browser:</span> press the
            &ldquo;ปิดการแจ้งเตือน&rdquo; (turn off notifications) button on the homepage
            on the same device, or turn off notifications for this site in your browser
            settings.
          </li>
          <li>
            <span className={strong}>Ask us to do it:</span> email <ContactEmailLink />{" "}
            from the address you want deleted.
          </li>
        </ul>

        <h3 className={subHeading}>Your rights</h3>
        <p className={paragraph}>
          You can ask to see, correct or delete your data, and you can withdraw your
          consent at any time, under Thailand&rsquo;s Personal Data Protection Act B.E.
          2562 (2019). For questions or requests, contact <ContactEmailLink />.
        </p>

        <h3 className={subHeading}>Changes to this notice</h3>
        <p className={paragraph}>
          If we change how we collect or use data, we will update this page and the
          &ldquo;last updated&rdquo; date above.
        </p>
      </section>
    </div>
  );
}

const CONTENT: Record<string, () => ReactNode> = {
  about: AboutContent,
  "data-source": DataSourceContent,
  contact: ContactContent,
  terms: TermsContent,
  [PRIVACY_PAGE_SLUG]: PrivacyContent,
};
