"use client";

import { useState } from "react";
import { formatThaiPrice } from "@/lib/thai-date";
import { BAHT_TO_GRAM_BAR, BAHT_TO_GRAM_ORNAMENT } from "@/lib/gold-weight";
import type { GoldPriceRow } from "@/lib/gold-price-queries";

type GoldType = "bar" | "ornament";
type WeightMode = "baht" | "gram";

const QUICK_WEIGHTS = [
  { label: "1 สลึง", baht: 0.25 },
  { label: "ครึ่งบาท", baht: 0.5 },
  { label: "1 บาท", baht: 1 },
  { label: "2 บาท", baht: 2 },
  { label: "5 บาท", baht: 5 },
  { label: "10 บาท", baht: 10 },
];

export function GoldCalculator({ latest }: { latest: GoldPriceRow }) {
  const [goldType, setGoldType] = useState<GoldType>("bar");
  const [mode, setMode] = useState<WeightMode>("baht");
  const [weightInput, setWeightInput] = useState("1");

  const bahtToGram = goldType === "bar" ? BAHT_TO_GRAM_BAR : BAHT_TO_GRAM_ORNAMENT;
  const parsed = Number(weightInput);
  const weightInBaht =
    Number.isFinite(parsed) && parsed > 0
      ? mode === "baht"
        ? parsed
        : parsed / bahtToGram
      : null;

  const sellOutPrice = goldType === "bar" ? latest.barSell : latest.ornamentSell;
  const buyBackPrice = goldType === "bar" ? latest.barBuy : latest.ornamentBuy;

  const buyValue = weightInBaht !== null ? weightInBaht * sellOutPrice : null;
  const sellValue = weightInBaht !== null ? weightInBaht * buyBackPrice : null;
  const spread = buyValue !== null && sellValue !== null ? buyValue - sellValue : null;

  const sellLabel =
    goldType === "ornament" ? "มูลค่าถ้าขายวันนี้ (ฐานภาษี)" : "มูลค่าถ้าขายวันนี้";

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">
        คำนวณมูลค่าทองคำ
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        คำนวณจากราคาประกาศล่าสุดของสมาคมค้าทองคำ
      </p>

      <fieldset className="mt-4 flex gap-4">
        <legend className="mb-1 text-xs text-gray-500 dark:text-gray-400">ประเภททอง</legend>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="radio"
            name="gold-type"
            value="bar"
            checked={goldType === "bar"}
            onChange={() => setGoldType("bar")}
            className="accent-amber-500"
          />
          ทองคำแท่ง
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="radio"
            name="gold-type"
            value="ornament"
            checked={goldType === "ornament"}
            onChange={() => setGoldType("ornament")}
            className="accent-amber-500"
          />
          ทองรูปพรรณ
        </label>
      </fieldset>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label htmlFor="gold-weight" className="text-xs text-gray-500 dark:text-gray-400">
            น้ำหนักทอง
          </label>
          <div className="flex rounded-full border border-gray-300 p-0.5 text-xs dark:border-gray-700">
            <button
              type="button"
              onClick={() => setMode("baht")}
              className={`rounded-full px-3 py-1 ${
                mode === "baht"
                  ? "bg-amber-500 font-medium text-white"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              บาททอง
            </button>
            <button
              type="button"
              onClick={() => setMode("gram")}
              className={`rounded-full px-3 py-1 ${
                mode === "gram"
                  ? "bg-amber-500 font-medium text-white"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              กรัม
            </button>
          </div>
        </div>
        <input
          id="gold-weight"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={weightInput}
          onChange={(e) => setWeightInput(e.target.value)}
          placeholder={mode === "baht" ? "เช่น 1" : `เช่น ${bahtToGram}`}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_WEIGHTS.map(({ label, baht }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setMode("baht");
                setWeightInput(String(baht));
              }}
              className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:border-amber-500 hover:text-amber-600 dark:border-gray-700 dark:text-gray-300"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ResultCell label="มูลค่าถ้าซื้อวันนี้" value={buyValue} />
        <ResultCell label={sellLabel} value={sellValue} />
        <ResultCell label="ส่วนต่าง" value={spread} />
      </dl>

      {goldType === "ornament" && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          ราคาขายออกทองรูปพรรณรวมค่ากำเหน็จแล้ว
          ส่วนราคารับซื้อ (ฐานภาษี) ที่ใช้คำนวณมูลค่าถ้าขายวันนี้
          เป็นตัวเลขอ้างอิงสำหรับการคำนวณภาษี ไม่ใช่ราคารับซื้อหน้าร้าน
          โดยทั่วไปร้านทองจะคิดราคารับซื้อคืนทองรูปพรรณจากราคาทองคำแท่งหักค่าหลอม/ค่าสึกหรอ
          จำนวนเงินที่ได้รับจริงจึงมักสูงกว่ามูลค่าที่แสดงไว้
        </p>
      )}
    </section>
  );
}

function ResultCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {value !== null ? `${formatThaiPrice(value)} บาท` : "—"}
      </dd>
    </div>
  );
}
