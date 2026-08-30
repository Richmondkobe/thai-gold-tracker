"use client";

import { useState } from "react";
import { QUICK_WEIGHTS } from "@/lib/gold-weight";
import { formatThaiDateShort, formatThaiPrice, formatThaiTime } from "@/lib/thai-date";
import type { GoldPriceRow } from "@/lib/gold-price-queries";

type GoldType = "bar" | "ornament";

interface DailyPriceLookup {
  requestedDate: string;
  priceDate: string;
  fetchedAt: string;
  barSell: number;
  ornamentSell: number;
}

const DATA_START = "2016-01-02";

function parsePositive(input: string): number | null {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function ProfitCalculator({
  latest,
  todayBangkok,
}: {
  latest: GoldPriceRow;
  /** Bangkok YYYY-MM-DD from the server, so the date picker's max never drifts on the client's timezone. */
  todayBangkok: string;
}) {
  const [goldType, setGoldType] = useState<GoldType>("bar");
  const [weightInput, setWeightInput] = useState("1");
  const [priceInput, setPriceInput] = useState("");
  const [kamnetInput, setKamnetInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [lookup, setLookup] = useState<DailyPriceLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [priceEdited, setPriceEdited] = useState(false);

  const weight = parsePositive(weightInput);
  const purchasePrice = parsePositive(priceInput);
  const kamnetRaw = parsePositive(kamnetInput);
  const kamnet = goldType === "ornament" && kamnetRaw !== null ? kamnetRaw : 0;

  const buyBackPrice = goldType === "bar" ? latest.barBuy : latest.ornamentBuy;

  const costPerBaht = purchasePrice !== null ? purchasePrice + kamnet : null;
  const totalCost = weight !== null && costPerBaht !== null ? weight * costPerBaht : null;
  const currentValue = weight !== null ? weight * buyBackPrice : null;
  const profitLoss =
    totalCost !== null && currentValue !== null ? currentValue - totalCost : null;
  const profitLossPct =
    profitLoss !== null && totalCost !== null ? (profitLoss / totalCost) * 100 : null;
  // Weight cancels: value >= cost exactly when buy-back reaches cost per baht.
  const breakEven = costPerBaht;

  function prefillFromLookup(data: DailyPriceLookup, type: GoldType) {
    setPriceInput(String(type === "bar" ? data.barSell : data.ornamentSell));
    setPriceEdited(false);
  }

  async function handleDateChange(date: string) {
    setDateInput(date);
    setLookup(null);
    setLookupError(null);
    if (!date) return;

    setLookupLoading(true);
    try {
      const res = await fetch(`/api/daily-price?date=${date}`);
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error ?? "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setLookup(data as DailyPriceLookup);
      prefillFromLookup(data as DailyPriceLookup, goldType);
    } catch {
      setLookupError("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLookupLoading(false);
    }
  }

  function handleGoldTypeChange(type: GoldType) {
    setGoldType(type);
    // Keep the prefill in sync with the selected type unless the user has
    // typed their own price since the lookup.
    if (lookup && !priceEdited) prefillFromLookup(lookup, type);
  }

  const lookupDate = lookup ? new Date(lookup.priceDate) : null;
  const lookupTime = lookup ? new Date(lookup.fetchedAt) : null;
  const marketWasClosed = lookup !== null && lookup.priceDate !== lookup.requestedDate;

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50";
  const labelClass = "mb-1 block text-xs text-gray-500 dark:text-gray-400";

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">
        คำนวณกำไร/ขาดทุนจากทองที่ถืออยู่
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        เทียบราคาที่ซื้อมากับราคารับซื้อคืนตามประกาศล่าสุดของสมาคมค้าทองคำ
      </p>

      <fieldset className="mt-4 flex gap-4">
        <legend className={labelClass}>ประเภททอง</legend>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="radio"
            name="pl-gold-type"
            value="bar"
            checked={goldType === "bar"}
            onChange={() => handleGoldTypeChange("bar")}
            className="accent-amber-500"
          />
          ทองคำแท่ง
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="radio"
            name="pl-gold-type"
            value="ornament"
            checked={goldType === "ornament"}
            onChange={() => handleGoldTypeChange("ornament")}
            className="accent-amber-500"
          />
          ทองรูปพรรณ
        </label>
      </fieldset>

      <div className="mt-4">
        <label htmlFor="pl-weight" className={labelClass}>
          น้ำหนักทอง (บาท)
        </label>
        <input
          id="pl-weight"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={weightInput}
          onChange={(e) => setWeightInput(e.target.value)}
          className={inputClass}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_WEIGHTS.map(({ label, baht }) => (
            <button
              key={label}
              type="button"
              onClick={() => setWeightInput(String(baht))}
              className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:border-amber-500 hover:text-amber-600 dark:border-gray-700 dark:text-gray-300"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="pl-date" className={labelClass}>
          วันที่ซื้อ (ไม่บังคับ - ใช้เติมราคาประกาศของวันนั้นให้อัตโนมัติ)
        </label>
        <input
          id="pl-date"
          type="date"
          min={DATA_START}
          max={todayBangkok}
          value={dateInput}
          onChange={(e) => handleDateChange(e.target.value)}
          className={inputClass}
        />
        {lookupLoading && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">กำลังค้นหาราคา...</p>
        )}
        {lookupError && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{lookupError}</p>
        )}
        {lookup && lookupDate && lookupTime && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {marketWasClosed
              ? `ตลาดปิดในวันที่เลือก ใช้ราคาปิดล่าสุดก่อนหน้า วันที่ ${formatThaiDateShort(lookupDate)}`
              : `ใช้ราคาปิดวันที่ ${formatThaiDateShort(lookupDate)}`}{" "}
            (ประกาศเวลา {formatThaiTime(lookupTime)})
            {goldType === "ornament" && " - ราคาประกาศไม่รวมค่ากำเหน็จ"}{" "}
            แก้ไขเป็นราคาตามใบเสร็จของคุณได้
          </p>
        )}
      </div>

      <div className="mt-4">
        <label htmlFor="pl-price" className={labelClass}>
          ราคาที่ซื้อ (บาทละ)
        </label>
        <input
          id="pl-price"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={priceInput}
          onChange={(e) => {
            setPriceInput(e.target.value);
            setPriceEdited(true);
          }}
          placeholder="เช่น 65000"
          className={inputClass}
        />
      </div>

      {goldType === "ornament" && (
        <div className="mt-4">
          <label htmlFor="pl-kamnet" className={labelClass}>
            ค่ากำเหน็จ (บาทละ, ไม่บังคับ - ดูจากใบเสร็จ)
          </label>
          <input
            id="pl-kamnet"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={kamnetInput}
            onChange={(e) => setKamnetInput(e.target.value)}
            placeholder="เช่น 800"
            className={inputClass}
          />
        </div>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResultCell label="ต้นทุนรวม" value={totalCost} />
        <ResultCell
          label={
            goldType === "ornament"
              ? "มูลค่าปัจจุบัน (รับซื้อ ฐานภาษี)"
              : "มูลค่าปัจจุบัน (รับซื้อ)"
          }
          value={currentValue}
        />
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <dt className="text-xs text-gray-500 dark:text-gray-400">กำไร/ขาดทุน</dt>
          <dd
            className={`mt-1 text-lg font-semibold tabular-nums ${
              profitLoss === null
                ? "text-gray-900 dark:text-gray-50"
                : profitLoss >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
            }`}
          >
            {profitLoss !== null && profitLossPct !== null
              ? `${profitLoss >= 0 ? "+" : "-"}${formatThaiPrice(Math.abs(profitLoss))} บาท (${profitLossPct >= 0 ? "+" : "-"}${Math.abs(profitLossPct).toFixed(2)}%)`
              : "—"}
          </dd>
        </div>
        <ResultCell label="ราคารับซื้อที่เท่าทุน (บาทละ)" value={breakEven} />
      </dl>

      {goldType === "ornament" && kamnetRaw === null && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
          ยังไม่ได้กรอกค่ากำเหน็จ: ต้นทุนที่แสดงจึงต่ำกว่าที่จ่ายจริง
          ขณะเดียวกันมูลค่าปัจจุบันใช้ราคารับซื้อ (ฐานภาษี) ซึ่งมักต่ำกว่าราคารับซื้อหน้าร้าน
          ผลลัพธ์จึงเป็นเพียงการประมาณ และอาจคลาดเคลื่อนได้ทั้งสองทิศทาง
          กรอกค่ากำเหน็จจากใบเสร็จเพื่อให้ฝั่งต้นทุนแม่นยำขึ้น
        </p>
      )}

      {goldType === "ornament" && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          ราคารับซื้อ (ฐานภาษี) เป็นตัวเลขอ้างอิงสำหรับการคำนวณภาษี
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
