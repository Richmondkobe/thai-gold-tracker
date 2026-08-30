import type { Metadata } from "next";
import Link from "next/link";
import { formatThaiDateLong } from "@/lib/thai-date";
import { toBangkokDateString } from "@/lib/bangkok";
import { getLatestPrices, type GoldPriceRow } from "@/lib/gold-price-queries";
import { WEIGHT_PAGES, weightPagePath } from "@/lib/weight-pages";
import { GUIDE_PAGES, guidePagePath } from "@/lib/guide-pages";
import { ProfitCalculator } from "@/components/ProfitCalculator";
import { MarketStatusLine } from "@/components/MarketStatusLine";
import { JsonLd } from "@/components/JsonLd";
import { PROFIT_CALC_PATH, SITE_URL } from "@/lib/site";

export const revalidate = 300;

const TITLE = "คำนวณกำไรขาดทุนทอง เทียบราคาที่ซื้อกับราคารับซื้อวันนี้";
const DESCRIPTION =
  "เครื่องมือคำนวณกำไร/ขาดทุนจากทองคำแท่งและทองรูปพรรณที่ถืออยู่ กรอกราคาที่ซื้อหรือเลือกวันที่ซื้อเพื่อดึงราคาประกาศย้อนหลัง เทียบกับราคารับซื้อคืนวันนี้ พร้อมจุดเท่าทุน";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: encodeURI(PROFIT_CALC_PATH) },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: encodeURI(PROFIT_CALC_PATH),
  },
};

async function loadLatest(): Promise<GoldPriceRow | null> {
  try {
    const [latest] = await getLatestPrices(1);
    return latest ?? null;
  } catch (err) {
    console.error(
      "[gold-profit] failed to load price data:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export default async function GoldProfitPage() {
  const latest = await loadLatest();
  const todayBangkok = toBangkokDateString(new Date());

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-6">
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
              name: TITLE,
              item: `${SITE_URL}${encodeURI(PROFIT_CALC_PATH)}`,
            },
          ],
        }}
      />

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 sm:text-3xl">
          คำนวณกำไรขาดทุนทอง
          <span className="mt-1 block text-base font-normal text-gray-500 dark:text-gray-400">
            {formatThaiDateLong(new Date())}
          </span>
        </h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          กรอกน้ำหนักทองและราคาที่ซื้อมา หรือเลือกวันที่ซื้อเพื่อดึงราคาประกาศของวันนั้น
          ระบบจะเทียบกับราคารับซื้อคืนตามประกาศล่าสุดของสมาคมค้าทองคำ
          แสดงกำไร/ขาดทุนทั้งจำนวนเงินและเปอร์เซ็นต์ พร้อมราคารับซื้อที่ทำให้เท่าทุน
          มีข้อมูลราคาย้อนหลังตั้งแต่ต้นปี 2559
        </p>
      </header>

      {latest ? (
        <>
          <ProfitCalculator latest={latest} todayBangkok={todayBangkok} />
          <MarketStatusLine fetchedAt={latest.fetchedAt} />
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          ยังไม่มีข้อมูลราคาทองในระบบ กรุณากลับมาตรวจสอบใหม่อีกครั้ง
        </p>
      )}

      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
          เช็คราคาทองตามน้ำหนัก
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {WEIGHT_PAGES.map((p) => (
            <li key={p.slug}>
              <Link
                href={weightPagePath(p)}
                className="inline-block rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:border-amber-500 hover:text-amber-600 dark:border-gray-700 dark:text-gray-300"
              >
                ราคา{p.nameTh}
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
            href={guidePagePath(GUIDE_PAGES[0])}
            className="inline-block text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
          >
            ทอง 1 บาท กี่กรัม? ตารางแปลงน้ำหนักทอง →
          </Link>
        </div>
      </section>

      <footer className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>
          ข้อมูลราคาทองคำอ้างอิงจากประกาศของสมาคมค้าทองคำ (goldtraders.or.th)
          ผลการคำนวณเป็นการประมาณจากราคาประกาศ ราคาซื้อขายจริงหน้าร้านอาจแตกต่างกัน
          โปรดตรวจสอบราคาล่าสุดก่อนทำธุรกรรม
        </p>
      </footer>
    </main>
  );
}
