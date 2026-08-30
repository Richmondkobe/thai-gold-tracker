// Single source of truth for site identity used across metadata, JSON-LD,
// and the sitemap. Set NEXT_PUBLIC_SITE_URL in Vercel to your real domain.
export const SITE_NAME = "ราคาทองวันนี้";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_DESCRIPTION =
  "ราคาทองคำแท่งและทองรูปพรรณวันนี้ อัปเดตตามประกาศสมาคมค้าทองคำ พร้อมราคาย้อนหลังและกราฟราคาทอง";

// Public (decoded) path of the profit/loss calculator - served from
// app/gold-profit via the rewrite in next.config.ts. encodeURI() for URLs.
export const PROFIT_CALC_PATH = "/คำนวณกำไรขาดทุนทอง";
