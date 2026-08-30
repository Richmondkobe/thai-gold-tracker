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
import { SITE_URL } from "@/lib/site";

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

  // Single explainer for now; when a second guide is added, branch on
  // config.slug to the matching content component here.
  return <Gold1BahtGramsContent config={config} />;
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
        <Link
          href="/"
          className="mt-3 inline-block text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
        >
          ดูราคาทองวันนี้ทั้งหมด →
        </Link>
      </section>

      <footer className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>
          น้ำหนักทองอ้างอิงตามมาตรฐานที่ใช้ซื้อขายทั่วไปในประเทศไทย
          ตามประกาศราคาของสมาคมค้าทองคำ (goldtraders.or.th)
        </p>
      </footer>
    </main>
  );
}
