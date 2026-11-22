import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  changeWord,
  formatThaiChange,
  formatThaiDateCompact,
  formatThaiDateLong,
  formatThaiPrice,
  formatThaiTime,
} from "@/lib/thai-date";
import { toBangkokDateString } from "@/lib/bangkok";
import { getDailyHistory } from "@/lib/gold-price-queries";
import {
  buildReportDescription,
  buildReportShareText,
  buildReportSummary,
  buildReportTitle,
  isReportInProgress,
  loadDailyReport,
  type DailyReport,
  type LoadedDailyReport,
} from "@/lib/daily-report";
import {
  getReportPageByDate,
  getReportPageBySlug,
  reportDateAsInstant,
  reportPagePath,
  reportShortPath,
  type ReportPageConfig,
} from "@/lib/report-pages";
import { getMonthPageBySlug, monthPagePath } from "@/lib/month-pages";
import { ReportAnnouncementTable } from "@/components/ReportAnnouncementTable";
import { OfficialPurityTable } from "@/components/OfficialPurityTable";
import { ShareSummaryBox } from "@/components/ShareSummaryBox";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Same interval as the other price pages. It keeps TODAY's report within a
// few minutes of the latest announcement; for a finished day a regeneration
// just reproduces the same page, and only happens when someone visits it.
export const revalidate = 300;

// Only the last few days are built ahead of time; every other day is generated
// the first time it is requested and then cached like any ISR page.
// dynamicParams stays at its default (true) for the reason given in
// app/gold-weight/[weightSlug]/page.tsx: Thai slugs arrive percent-encoded.
export async function generateStaticParams() {
  try {
    const recent = await getDailyHistory(7);
    return recent
      .map((row) => getReportPageByDate(row.priceDate))
      .filter((config): config is ReportPageConfig => config !== null)
      .map((config) => ({ reportSlug: config.slug }));
  } catch (err) {
    console.error(
      "[gold-report] could not list recent days at build time:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

interface Props {
  params: Promise<{ reportSlug: string }>;
}

// The segment arrives percent-encoded; decode before the lookup. Anything
// that is not a real day from REPORT_START_DATE up to today 404s without a
// database query.
async function resolveConfig(params: Props["params"]): Promise<ReportPageConfig> {
  const { reportSlug } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(reportSlug);
  } catch {
    notFound();
  }
  const config = getReportPageBySlug(decoded);
  if (!config || config.date > toBangkokDateString(new Date())) notFound();
  return config;
}

// Two different "nothing" results, deliberately (same as the month page):
// `report: null` means the day genuinely has no price row (a Sunday or a
// holiday) and the page 404s, while a return of `null` means the lookup
// FAILED, in which case the page stays up with a "no data right now" note
// rather than 404ing a real day.
//
// TODAY is the one exception to the 404: before the day's first price change
// the page answers 200 with a short "not yet" note and noindex (isAwaited
// below). A 404 would be cached by ISR, and the first visitor to follow the
// homepage link after the first announcement could be handed that stale 404.
// Nothing links to the page or lists it in the sitemap until the report
// exists, so search engines never see the placeholder.
async function loadReport(date: string): Promise<LoadedDailyReport | null> {
  try {
    return await loadDailyReport(date);
  } catch (err) {
    console.error(
      `[gold-report] failed to load ${date}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Today's report, requested before today has a price change. */
function isAwaited(config: ReportPageConfig, loaded: LoadedDailyReport | null): boolean {
  return loaded !== null && !loaded.report && config.date === toBangkokDateString(new Date());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = await resolveConfig(params);
  const loaded = await loadReport(config.date);
  const awaited = isAwaited(config, loaded);
  if (loaded && !loaded.report && !awaited) notFound();
  const report = loaded?.report ?? null;

  const title = buildReportTitle(config);
  const description = buildReportDescription(
    config,
    report,
    report ? isReportInProgress(report) : false,
  );
  const encodedPath = encodeURI(reportPagePath(config));

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: encodedPath },
    ...(awaited && { robots: { index: false, follow: true } }),
    openGraph: {
      type: "article",
      title,
      description,
      url: encodedPath,
      ...(report && {
        publishedTime: report.firstAnnouncedAt.toISOString(),
        modifiedTime: report.lastAnnouncedAt.toISOString(),
      }),
    },
  };
}

const LINK_CLASS = "text-sm font-medium text-amber-600 hover:underline dark:text-amber-400";

function changeColor(value: number | null): string {
  if (value === null || value === 0) return "text-gray-500 dark:text-gray-400";
  return value > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
}

/** One of the four prices, with its change against the previous trading day's close. */
function PriceCell({ label, value, change }: { label: string; value: number; change: number | null }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {formatThaiPrice(value)}
        {change !== null && (
          <span className={`block text-xs font-medium ${changeColor(change)}`}>
            <span className="sr-only">{changeWord(change)} </span>
            {change === 0 ? "ไม่เปลี่ยนแปลง" : formatThaiChange(change)}
          </span>
        )}
      </dd>
    </div>
  );
}

function StatCell({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-base font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {value}
        {note && (
          <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{note}</span>
        )}
      </dd>
    </div>
  );
}

function ReportBody({
  config,
  report,
  inProgress,
}: {
  config: ReportPageConfig;
  report: DailyReport;
  inProgress: boolean;
}) {
  const closeWord = inProgress ? "ราคาล่าสุด" : "ราคาปิด";
  const previousDay = report.previousClose
    ? formatThaiDateCompact(new Date(`${report.previousClose.date}T12:00:00+07:00`))
    : null;
  const barSellChange = report.changes?.barSell ?? null;
  const shareUrl = `${SITE_URL}${reportShortPath(config)}`;

  return (
    <>
      <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">
        {buildReportSummary(report, inProgress)}
      </p>

      {inProgress && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          รายงานของวันนี้ยังไม่ปิดวัน ตัวเลขในหน้านี้จะอัปเดตตามประกาศใหม่ของสมาคมค้าทองคำ{" "}
          <Link href="/" className="font-medium underline">
            ดูราคาทองล่าสุดที่หน้าแรก
          </Link>
        </p>
      )}

      <section
        aria-labelledby="closing-heading"
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 id="closing-heading" className="text-xl font-bold text-gray-900 dark:text-gray-50">
          {closeWord}ของวัน
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          บาทละ (บาท) ตามประกาศเวลา {formatThaiTime(report.close.time)}
          {previousDay && ` ตัวเลขเล็กคือส่วนต่างจากราคาปิดของวันทำการก่อนหน้า (${previousDay})`}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <PriceCell
            label="ทองคำแท่ง รับซื้อ"
            value={report.close.barBuy}
            change={report.changes?.barBuy ?? null}
          />
          <PriceCell
            label="ทองคำแท่ง ขายออก"
            value={report.close.barSell}
            change={report.changes?.barSell ?? null}
          />
          <PriceCell
            label="ทองรูปพรรณ รับซื้อ (ฐานภาษี)"
            value={report.close.ornamentBuy}
            change={report.changes?.ornamentBuy ?? null}
          />
          <PriceCell
            label="ทองรูปพรรณ ขายออก"
            value={report.close.ornamentSell}
            change={report.changes?.ornamentSell ?? null}
          />
        </dl>
      </section>

      <section aria-labelledby="day-stats-heading">
        <h2 id="day-stats-heading" className="text-xl font-bold text-gray-900 dark:text-gray-50">
          ราคาเปิด ปิด สูงสุด และต่ำสุด
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCell
            label="ราคาเปิด"
            value={formatThaiPrice(report.open.barSell)}
            note={`เวลา ${formatThaiTime(report.open.time)}`}
          />
          <StatCell
            label={closeWord}
            value={formatThaiPrice(report.close.barSell)}
            note={`เวลา ${formatThaiTime(report.close.time)}`}
          />
          <StatCell
            label="เทียบวันทำการก่อนหน้า"
            value={
              barSellChange === null
                ? "–"
                : barSellChange === 0
                  ? "ไม่เปลี่ยนแปลง"
                  : `${formatThaiChange(barSellChange)} บาท`
            }
            note={
              barSellChange !== null && barSellChange !== 0 && report.changePercent !== null
                ? `${barSellChange > 0 ? "+" : "-"}${Math.abs(report.changePercent).toFixed(2)}%`
                : undefined
            }
          />
          <StatCell
            label="สูงสุดของวัน"
            value={formatThaiPrice(report.high.price)}
            note={`เวลา ${formatThaiTime(report.high.time)}`}
          />
          <StatCell
            label="ต่ำสุดของวัน"
            value={formatThaiPrice(report.low.price)}
            note={`เวลา ${formatThaiTime(report.low.time)}`}
          />
          <StatCell
            label="ปรับราคา"
            value={`${report.priceChanges} ครั้ง`}
            note={
              report.lastSeq !== null ? `ประกาศล่าสุดที่ปรับราคา ครั้งที่ ${report.lastSeq}` : undefined
            }
          />
        </dl>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          ราคาทองคำแท่งขายออก บาทละ (บาท)
        </p>
      </section>

      <section aria-labelledby="announcements-heading">
        <h2
          id="announcements-heading"
          className="text-xl font-bold text-gray-900 dark:text-gray-50"
        >
          ราคาทองทุกประกาศ วันที่ {config.day} {config.monthName} {config.buddhistYear}
        </h2>
        <div className="mt-3">
          <ReportAnnouncementTable announcements={report.announcements} />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          ราคาบาทละ (บาท) เรียงจากประกาศแรกของวัน “ครั้งที่”
          คือลำดับประกาศของสมาคมค้าทองคำในวันนั้น
          ช่องเปลี่ยนแปลงคือราคาทองคำแท่งขายออกเทียบกับประกาศก่อนหน้า
          ประกาศที่ราคาเท่ากับครั้งก่อนหน้าอาจไม่แสดงครบทุกครั้ง ลำดับในตารางจึงอาจข้ามได้
        </p>
      </section>

      <OfficialPurityTable
        latest={{
          ornamentBuy: report.close.ornamentBuy,
          officialPurityBuy: report.purity,
          announcedAt: report.close.time,
        }}
        intro={`ราคารับซื้อทองรูปพรรณ (ฐานภาษี) แต่ละเปอร์เซ็นต์ตามประกาศของสมาคมค้าทองคำ ณ ${closeWord}ของวันที่ ${formatThaiDateCompact(reportDateAsInstant(config))} เวลา ${formatThaiTime(report.close.time)} หน่วยเป็นบาท`}
        estimateTableBelow={false}
      />

      <ShareSummaryBox text={buildReportShareText(report, inProgress, shareUrl)} />
    </>
  );
}

export default async function ReportPage({ params }: Props) {
  const config = await resolveConfig(params);
  const loaded = await loadReport(config.date);
  const awaited = isAwaited(config, loaded);
  if (loaded && !loaded.report && !awaited) notFound();
  const report = loaded?.report ?? null;
  const previous = loaded?.previous ?? null;
  const next = loaded?.next ?? null;

  const inProgress = report ? isReportInProgress(report) : false;
  const path = reportPagePath(config);
  const url = `${SITE_URL}${encodeURI(path)}`;
  const dateLabel = `${config.day} ${config.monthName} ${config.buddhistYear}`;
  const monthPage = getMonthPageBySlug(
    `${config.monthName}-${config.buddhistYear}`,
    reportDateAsInstant(config),
  );
  const site = { "@type": "Organization", name: SITE_NAME, url: SITE_URL };

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
              name: "ราคาทองย้อนหลัง",
              item: `${SITE_URL}/history`,
            },
            ...(monthPage
              ? [
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: `ราคาทองเดือน${monthPage.monthName} ${monthPage.buddhistYear}`,
                    item: `${SITE_URL}${encodeURI(monthPagePath(monthPage))}`,
                  },
                ]
              : []),
            {
              "@type": "ListItem",
              position: monthPage ? 4 : 3,
              name: `รายงานราคาทอง ${dateLabel}`,
              item: url,
            },
          ],
        }}
      />
      {report && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Article",
            headline: buildReportTitle(config),
            description: buildReportDescription(config, report, inProgress),
            inLanguage: "th",
            // Published = the day's first announcement; modified = its latest.
            datePublished: report.firstAnnouncedAt.toISOString(),
            dateModified: report.lastAnnouncedAt.toISOString(),
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
            author: site,
            publisher: {
              ...site,
              logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/icon-512.png` },
            },
          }}
        />
      )}

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 sm:text-3xl">
          รายงานราคาทอง
          <span className="mt-1 block text-base font-normal text-gray-500 dark:text-gray-400">
            {formatThaiDateLong(reportDateAsInstant(config))}
          </span>
        </h1>
        {report && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            ประกาศแรกของวัน{" "}
            <time dateTime={report.firstAnnouncedAt.toISOString()}>
              {formatThaiTime(report.firstAnnouncedAt)}
            </time>{" "}
            · อัปเดตล่าสุดตามประกาศเวลา{" "}
            <time dateTime={report.lastAnnouncedAt.toISOString()}>
              {formatThaiTime(report.lastAnnouncedAt)}
            </time>
          </p>
        )}
      </header>

      {report ? (
        <ReportBody config={config} report={report} inProgress={inProgress} />
      ) : awaited ? (
        <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm leading-relaxed text-gray-600 dark:border-gray-700 dark:text-gray-400">
          วันนี้สมาคมค้าทองคำยังไม่ได้ประกาศปรับราคาทอง
          รายงานของวันนี้จะแสดงที่หน้านี้โดยอัตโนมัติหลังประกาศปรับราคาครั้งแรกของวัน{" "}
          <Link href="/" className="font-medium text-amber-600 underline dark:text-amber-400">
            ดูราคาทองล่าสุดที่หน้าแรก
          </Link>
        </p>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          ไม่สามารถแสดงรายงานราคาทองของวันที่ {dateLabel} ได้ในขณะนี้ กรุณาลองใหม่อีกครั้งภายหลัง
        </p>
      )}

      <nav
        aria-label="รายงานราคาทองวันอื่น"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-800"
      >
        {previous ? (
          <Link href={reportPagePath(previous)} className={LINK_CLASS}>
            ← {previous.day} {previous.monthName} {previous.buddhistYear}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={reportPagePath(next)} className={LINK_CLASS}>
            {next.day} {next.monthName} {next.buddhistYear} →
          </Link>
        )}
      </nav>

      <div className="flex flex-col gap-2">
        {monthPage && (
          <Link href={monthPagePath(monthPage)} className={LINK_CLASS}>
            ดูราคาทองทั้งเดือน{monthPage.monthName} {monthPage.buddhistYear} →
          </Link>
        )}
        <Link href="/" className={LINK_CLASS}>
          ดูราคาทองวันนี้ล่าสุด →
        </Link>
        <Link href="/history" className={LINK_CLASS}>
          ← ดูราคาทองย้อนหลังทั้งหมด
        </Link>
      </div>

      <footer className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>
          รายงานนี้จัดทำโดยอัตโนมัติจากราคาที่สมาคมค้าทองคำ (goldtraders.or.th) ประกาศในแต่ละวัน
          ข้อความสรุปสร้างจากตัวเลขในตารางเท่านั้น ไม่ใช่บทวิเคราะห์หรือคำแนะนำการลงทุน
        </p>
      </footer>
    </main>
  );
}
