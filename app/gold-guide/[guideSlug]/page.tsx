import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BAHT_TO_GRAM_BAR, BAHT_TO_GRAM_ORNAMENT } from "@/lib/gold-weight";
import {
  GUIDE_PAGES,
  getGuidePageBySlug,
  guidePagePath,
  type GuidePageConfig,
} from "@/lib/guide-pages";
import { WEIGHT_PAGES, weightPagePath } from "@/lib/weight-pages";
import { JsonLd } from "@/components/JsonLd";
import { PROFIT_CALC_PATH, SITE_URL } from "@/lib/site";

// Same routing pattern as app/gold-weight/[weightSlug]: ASCII folder, Thai
// public URL via rewrite, unknown slugs 404 via notFound() (dynamicParams=false
// mismatches encoded request segments against decoded static params).
export function generateStaticParams() {
  return GUIDE_PAGES.map((p) => ({ guideSlug: p.slug }));
}

interface Props {
  params: Promise<{ guideSlug: string }>;
}

async function resolveConfig(params: Props["params"]): Promise<GuidePageConfig> {
  const { guideSlug } = await params;
  const config = getGuidePageBySlug(decodeURIComponent(guideSlug));
  if (!config) notFound();
  return config;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = await resolveConfig(params);
  const path = encodeURI(guidePagePath(config));
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

const gramFormatter = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 3,
});

function grams(bahtWeight: number, gramsPerBaht: number): string {
  return gramFormatter.format(bahtWeight * gramsPerBaht);
}

export default async function GuidePage({ params }: Props) {
  const config = await resolveConfig(params);
  const Content = CONTENT[config.slug];
  return <Content config={config} />;
}

function Gold1BahtGramsContent({ config }: { config: GuidePageConfig }) {
  const answerText = `ทองคำแท่ง 1 บาท หนัก ${BAHT_TO_GRAM_BAR} กรัม ส่วนทองรูปพรรณ 1 บาท หนัก ${BAHT_TO_GRAM_ORNAMENT} กรัม ทั้งสองแบบมีความบริสุทธิ์ 96.5% เท่ากัน`;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "ทอง 1 บาท กี่กรัม",
              acceptedAnswer: { "@type": "Answer", text: answerText },
            },
          ],
        }}
      />
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
              item: `${SITE_URL}${encodeURI(guidePagePath(config))}`,
            },
          ],
        }}
      />

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 sm:text-3xl">
          ทอง 1 บาท กี่กรัม?
        </h1>
        <p className="mt-3 text-base text-gray-700 dark:text-gray-300">
          ทองคำแท่ง 1 บาท หนัก{" "}
          <strong className="text-gray-900 dark:text-gray-50">
            {BAHT_TO_GRAM_BAR} กรัม
          </strong>{" "}
          ส่วนทองรูปพรรณ 1 บาท หนัก{" "}
          <strong className="text-gray-900 dark:text-gray-50">
            {BAHT_TO_GRAM_ORNAMENT} กรัม
          </strong>
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">
          ทำไมน้ำหนักทองสองแบบจึงไม่เท่ากัน
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          ทองคำแท่งและทองรูปพรรณมีความบริสุทธิ์ 96.5% เท่ากัน
          แต่มาตรฐานน้ำหนัก &ldquo;1 บาททอง&rdquo; ที่ใช้ในการซื้อขายเป็นคนละเกณฑ์กันตามธรรมเนียมการค้า
          โดยทองคำแท่งใช้เกณฑ์ 1 บาท = {BAHT_TO_GRAM_BAR} กรัม
          ส่วนทองรูปพรรณใช้เกณฑ์ 1 บาท = {BAHT_TO_GRAM_ORNAMENT} กรัม
          ในทางปฏิบัติสิ่งที่สำคัญคือใช้ตัวเลขให้ตรงกับประเภททอง
          จะเทียบน้ำหนักหรือคำนวณมูลค่าทองคำแท่งต้องใช้เกณฑ์ของทองคำแท่ง
          และทองรูปพรรณต้องใช้เกณฑ์ของทองรูปพรรณ
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
          ตารางแปลงน้ำหนักทองเป็นกรัม
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-400">
                <th className="px-4 py-3 font-medium">น้ำหนักทอง</th>
                <th className="px-4 py-3 text-right font-medium">
                  ทองคำแท่ง (กรัม)
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  ทองรูปพรรณ (กรัม)
                </th>
              </tr>
            </thead>
            <tbody>
              {WEIGHT_PAGES.map((w) => (
                <tr
                  key={w.slug}
                  className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
                >
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {w.nameTh}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-50">
                    {grams(w.bahtWeight, BAHT_TO_GRAM_BAR)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-50">
                    {grams(w.bahtWeight, BAHT_TO_GRAM_ORNAMENT)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <GuideCrossLinks />

      <footer className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>
          น้ำหนักทองอ้างอิงตามมาตรฐานที่ใช้ซื้อขายทั่วไปในประเทศไทย
          ตามประกาศราคาของสมาคมค้าทองคำ (goldtraders.or.th)
        </p>
      </footer>
    </main>
  );
}

const guideHeading = "text-lg font-bold text-gray-900 dark:text-gray-50";
const guideParagraph = "text-sm leading-relaxed text-gray-600 dark:text-gray-400";
const guideStrong = "font-semibold text-gray-900 dark:text-gray-100";

function GuideCrossLinks() {
  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
        เช็คราคาทองตามน้ำหนัก
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {WEIGHT_PAGES.map((w) => (
          <li key={w.slug}>
            <Link
              href={weightPagePath(w)}
              className="inline-block rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:border-amber-500 hover:text-amber-600 dark:border-gray-700 dark:text-gray-300"
            >
              ราคา{w.nameTh}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:gap-6">
        <Link
          href="/"
          className="inline-block text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
        >
          ดูราคาทองวันนี้ทั้งหมด →
        </Link>
        <Link
          href={PROFIT_CALC_PATH}
          className="inline-block text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
        >
          คำนวณกำไรขาดทุนทอง →
        </Link>
      </div>
    </section>
  );
}

function GuideShell({
  config,
  h1,
  faqAnswer,
  footerNote,
  children,
}: {
  config: GuidePageConfig;
  h1: string;
  faqAnswer: string;
  footerNote: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: h1.replace(/\?$/, ""),
              acceptedAnswer: { "@type": "Answer", text: faqAnswer },
            },
          ],
        }}
      />
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
              item: `${SITE_URL}${encodeURI(guidePagePath(config))}`,
            },
          ],
        }}
      />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 sm:text-3xl">
        {h1}
      </h1>
      {children}
      <GuideCrossLinks />
      <footer className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>{footerNote}</p>
      </footer>
    </main>
  );
}

const KAMNET_ANSWER =
  "ค่ากำเหน็จคือค่าแรงและค่าฝีมือในการขึ้นรูปทองคำแท่งให้เป็นทองรูปพรรณ รวมถึงส่วนต่างกำไรของร้านทอง ตามท้องตลาดทั่วไปมักอยู่ราว 500-800 บาทต่อน้ำหนักทอง 1 บาท ขึ้นอยู่กับร้านและลวดลาย";

function KamnetContent({ config }: { config: GuidePageConfig }) {
  return (
    <GuideShell
      config={config}
      h1="ค่ากำเหน็จทองคืออะไร?"
      faqAnswer={KAMNET_ANSWER}
      footerNote="ตัวเลขค่ากำเหน็จเป็นช่วงราคาที่พบทั่วไปในตลาด ไม่ใช่อัตราทางการ ค่ากำเหน็จจริงขึ้นอยู่กับร้านและชิ้นงาน ข้อมูลราคาทองอ้างอิงจากประกาศของสมาคมค้าทองคำ (goldtraders.or.th)"
    >
      <p className={guideParagraph}>
        ค่ากำเหน็จคือค่าแรงและค่าฝีมือในการขึ้นรูปทองคำแท่งให้เป็นทองรูปพรรณ เช่น
        สร้อย แหวน กำไล รวมถึงส่วนต่างกำไรของร้านทอง
        ค่ากำเหน็จนี้เองคือเหตุผลที่ราคาขายออกทองรูปพรรณสูงกว่าทองคำแท่งเสมอ
      </p>

      <h2 className={guideHeading}>ค่ากำเหน็จปกติอยู่ที่เท่าไหร่</h2>
      <p className={guideParagraph}>
        สมาคมค้าทองคำไม่ได้กำหนดอัตราค่ากำเหน็จกลาง
        แต่ละร้านตั้งเองตามลวดลายและความยากของงาน ตามท้องตลาดทั่วไปมักอยู่ราว{" "}
        <span className={guideStrong}>500-800 บาทต่อน้ำหนักทอง 1 บาท</span>{" "}
        ลายที่ประณีตหรือแบรนด์บางแห่งอาจสูงถึง 1,200 บาทหรือมากกว่า
        ตัวเลขเหล่านี้เป็นช่วงราคาที่พบทั่วไป ไม่ใช่อัตราทางการ —
        ค่ากำเหน็จจริงขึ้นอยู่กับร้านและชิ้นงานแต่ละชิ้น
      </p>

      <h2 className={guideHeading}>สิทธิของผู้ซื้อ</h2>
      <p className={guideParagraph}>
        กฎหมายกำหนดให้ร้านทองต้อง
        <span className={guideStrong}>
          แสดงค่ากำเหน็จไว้ที่ตัวสินค้าหรือถาดวางสินค้า
        </span>{" "}
        และห้ามเรียกเก็บเกินราคาที่แสดงไว้
        ก่อนซื้อจึงควรดูป้ายค่ากำเหน็จและเทียบระหว่างร้านได้เสมอ
      </p>

      <h2 className={guideHeading}>ทองชิ้นเล็กจ่ายค่ากำเหน็จเต็ม</h2>
      <p className={guideParagraph}>
        ทองน้ำหนักต่ำกว่า 1 บาท (เช่น 1 สลึง ครึ่งสลึง)
        ร้านมักคิดค่ากำเหน็จเท่ากับทอง 1 บาท เพราะใช้ฝีมือขึ้นรูปไม่ต่างกัน
        ทองชิ้นเล็กจึงมีต้นทุนค่ากำเหน็จต่อน้ำหนักสูงกว่ามาก
      </p>

      <h2 className={guideHeading}>สูตรคำนวณราคาที่ต้องจ่าย</h2>
      <p className={`${guideParagraph} rounded-lg bg-gray-50 p-4 font-medium text-gray-900 dark:bg-gray-800 dark:text-gray-100`}>
        ราคาที่จ่าย = (ราคาทองต่อบาท × น้ำหนักทอง) + ค่ากำเหน็จ
      </p>
      <p className={guideParagraph}>
        ลองคำนวณต้นทุนจริงของทองรูปพรรณที่ถืออยู่ได้ที่{" "}
        <Link
          href={PROFIT_CALC_PATH}
          className="font-medium text-amber-600 hover:underline dark:text-amber-400"
        >
          เครื่องคำนวณกำไรขาดทุนทอง
        </Link>{" "}
        ซึ่งมีช่องกรอกค่ากำเหน็จโดยเฉพาะ
      </p>
    </GuideShell>
  );
}

const SELL_DEDUCTION_ANSWER =
  "ตามแนวทางของสำนักงานคณะกรรมการกลางว่าด้วยราคาสินค้าและบริการ ร้านทองรับซื้อคืนทองรูปพรรณโดยห้ามหักค่ากำเหน็จเกิน 5% ของราคาทองหน้าร้าน ในทางปฏิบัติทองรูปพรรณมักถูกหักราว 5-6% ส่วนทองคำแท่งโดยทั่วไปราวบาทละ 100 บาท จำนวนหักจริงขึ้นอยู่กับแต่ละร้าน";

function SellDeductionContent({ config }: { config: GuidePageConfig }) {
  return (
    <GuideShell
      config={config}
      h1="ขายทองรูปพรรณ โดนหักเท่าไหร่?"
      faqAnswer={SELL_DEDUCTION_ANSWER}
      footerNote="ตัวเลขค่าหักเป็นค่าที่พบทั่วไปในตลาด จำนวนหักจริงขึ้นอยู่กับแต่ละร้าน ข้อมูลราคาทองอ้างอิงจากประกาศของสมาคมค้าทองคำ (goldtraders.or.th)"
    >
      <p className={guideParagraph}>
        ตามแนวทางของ
        <span className={guideStrong}>
          สำนักงานคณะกรรมการกลางว่าด้วยราคาสินค้าและบริการ
        </span>{" "}
        ร้านทองรับซื้อคืนทองรูปพรรณโดย
        <span className={guideStrong}>
          ห้ามหักค่ากำเหน็จเกิน 5% ของราคาทองหน้าร้าน
        </span>{" "}
        ในทางปฏิบัติทองรูปพรรณมักถูกหักราว 5-6%
        ส่วนทองคำแท่งถูกหักน้อยกว่ามาก โดยทั่วไปราวบาทละ 100 บาท
        ตัวเลขเหล่านี้เป็นค่าที่พบทั่วไปในตลาด จำนวนหักจริงขึ้นอยู่กับแต่ละร้าน
      </p>

      <h2 className={guideHeading}>ทำไมทองรูปพรรณถูกหักมากกว่าทองแท่ง</h2>
      <p className={guideParagraph}>
        ทองรูปพรรณที่รับซื้อคืนต้องนำไปหลอมใหม่
        ระหว่างหลอมมีการสูญเสียเนื้อทองจากตะเข็บบัดกรีและส่วนผสมในชิ้นงาน
        ร้านจึงหักส่วนนี้จากราคารับซื้อ ทองคำแท่งไม่ต้องหลอมแปรรูป
        จึงถูกหักเพียงเล็กน้อย
      </p>

      <h2 className={guideHeading}>
        ราคารับซื้อ (ฐานภาษี) บนเว็บไซต์นี้ไม่ใช่ราคาหน้าร้าน
      </h2>
      <p className={guideParagraph}>
        ตัวเลขรับซื้อทองรูปพรรณที่แสดงตามประกาศสมาคมค้าทองคำเป็น
        <span className={guideStrong}>ตัวเลขอ้างอิงสำหรับการคำนวณภาษี</span>{" "}
        ราคารับซื้อจริงหน้าร้านมักคิดจากราคาทองคำแท่งหักตามเกณฑ์ข้างต้น
        ซึ่งอาจแตกต่างจากตัวเลขฐานภาษีที่แสดงไว้
        ควรสอบถามราคารับซื้อจริงกับทางร้านก่อนขายทุกครั้ง
      </p>

      <h2 className={guideHeading}>ก่อนขายควรทำอะไร</h2>
      <p className={guideParagraph}>
        เช็คราคาทองประกาศล่าสุดก่อนไปร้าน เทียบราคารับซื้อจากหลายร้าน
        และคำนวณกำไร/ขาดทุนล่วงหน้าได้ที่{" "}
        <Link
          href={PROFIT_CALC_PATH}
          className="font-medium text-amber-600 hover:underline dark:text-amber-400"
        >
          เครื่องคำนวณกำไรขาดทุนทอง
        </Link>
      </p>
    </GuideShell>
  );
}

const CONTENT: Record<
  string,
  (props: { config: GuidePageConfig }) => React.ReactNode
> = {
  "ทอง-1-บาท-กี่กรัม": Gold1BahtGramsContent,
  "ค่ากำเหน็จทอง-คืออะไร": KamnetContent,
  "ขายทองรูปพรรณ-หักเท่าไหร่": SellDeductionContent,
};
