import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatThaiDateLong, formatThaiPrice } from "@/lib/thai-date";
import { getLatestPrices, type GoldPriceRow } from "@/lib/gold-price-queries";
import {
  WEIGHT_PAGES,
  getWeightPageBySlug,
  weightPagePath,
  type WeightPageConfig,
} from "@/lib/weight-pages";
import { GoldCalculator } from "@/components/GoldCalculator";
import { MarketStatusLine } from "@/components/MarketStatusLine";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/site";

export const revalidate = 300;

// dynamicParams stays at its default (true): with `false`, this Next version
// compares the percent-encoded request segment against the decoded values from
// generateStaticParams and 404s every Thai slug. Unknown slugs 404 via
// notFound() below instead.
export function generateStaticParams() {
  return WEIGHT_PAGES.map((p) => ({ weightSlug: p.slug }));
}

interface Props {
  params: Promise<{ weightSlug: string }>;
}

// The segment arrives percent-encoded; decode before the config lookup.
async function resolveConfig(params: Props["params"]): Promise<WeightPageConfig> {
  const { weightSlug } = await params;
  const config = getWeightPageBySlug(decodeURIComponent(weightSlug));
  if (!config) notFound();
  return config;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = await resolveConfig(params);
  const path = encodeURI(weightPagePath(config));
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

async function loadLatest(): Promise<GoldPriceRow | null> {
  try {
    const [latest] = await getLatestPrices(1);
    return latest ?? null;
  } catch (err) {
    console.error(
      "[weight-page] failed to load price data:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export default async function WeightPage({ params }: Props) {
  const config = await resolveConfig(params);
  const latest = await loadLatest();
  const { nameTh, bahtWeight } = config;

  const barBuyValue = latest ? bahtWeight * latest.barBuy : null;
  const barSellValue = latest ? bahtWeight * latest.barSell : null;
  const ornamentBuyValue = latest ? bahtWeight * latest.ornamentBuy : null;
  const ornamentSellValue = latest ? bahtWeight * latest.ornamentSell : null;

  const otherPages = WEIGHT_PAGES.filter((p) => p.slug !== config.slug);

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
              name: config.title,
              item: `${SITE_URL}${encodeURI(weightPagePath(config))}`,
            },
          ],
        }}
      />

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 sm:text-3xl">
          ราคา{nameTh}วันนี้
          <span className="mt-1 block text-base font-normal text-gray-500 dark:text-gray-400">
            {formatThaiDateLong(new Date())}
            {barSellValue !== null &&
              ` — ทองคำแท่งขายออก ${formatThaiPrice(barSellValue)} บาท`}
          </span>
        </h1>
      </header>

      {latest ? (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">
              มูลค่า{nameTh} ตามราคาประกาศล่าสุด
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ValueCell label="ทองคำแท่ง ถ้าซื้อวันนี้" value={barSellValue} />
              <ValueCell label="ทองคำแท่ง ถ้าขายวันนี้" value={barBuyValue} />
              <ValueCell label="ทองรูปพรรณ ถ้าซื้อวันนี้" value={ornamentSellValue} />
              <ValueCell
                label="ทองรูปพรรณ ถ้าขายวันนี้ (ฐานภาษี)"
                value={ornamentBuyValue}
              />
            </dl>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              ราคาขายออกทองรูปพรรณรวมค่ากำเหน็จแล้ว
              ส่วนราคารับซื้อ (ฐานภาษี) เป็นตัวเลขอ้างอิงสำหรับการคำนวณภาษี
              โดยทั่วไปร้านทองจะคิดราคารับซื้อคืนทองรูปพรรณจากราคาทองคำแท่งหักค่าหลอม/ค่าสึกหรอ
              จำนวนเงินที่ได้รับจริงจึงมักสูงกว่ามูลค่าที่แสดงไว้
            </p>
            <MarketStatusLine fetchedAt={latest.fetchedAt} />
          </section>

          <GoldCalculator latest={latest} initialBahtWeight={bahtWeight} />
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          ยังไม่มีข้อมูลราคาทองในระบบ กรุณากลับมาตรวจสอบใหม่อีกครั้ง
        </p>
      )}

      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
          ราคาทองน้ำหนักอื่น
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {otherPages.map((p) => (
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
        <Link
          href="/"
          className="mt-3 inline-block text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
        >
          ดูราคาทองวันนี้ทั้งหมด →
        </Link>
      </section>

      <footer className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>
          ข้อมูลราคาทองคำอ้างอิงจากประกาศของสมาคมค้าทองคำ (goldtraders.or.th)
          ราคาอาจมีการเปลี่ยนแปลงได้ตลอดเวลาทำการ โปรดตรวจสอบราคาล่าสุดก่อนทำธุรกรรม
        </p>
      </footer>
    </main>
  );
}

function ValueCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {value !== null ? `${formatThaiPrice(value)} บาท` : "—"}
      </dd>
    </div>
  );
}
